// Image → triangular pattern conversion.
// Per-cell average color/luminance → pattern density + printer palette color.
import { PATTERNS, patternDensity } from './patterns.js';
import { bboxOf, pointInPoly, colorOf } from './model.js';

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('read failed'));
    r.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ dataURL: String(r.result), img });
      img.onerror = () => reject(new Error('decode failed'));
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function rgbToXyz(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return [
    (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047,
    (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0,
    (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  ];
}
function pivot(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
export function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  const fx = pivot(x), fy = pivot(y), fz = pivot(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const kL = 1, kC = 1, kH = 1;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  const Lbarp = (L1 + L2) / 2, Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hbarp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbarp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hbarp - 63) * Math.PI / 180);
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;
  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

function nearestColor(rgb, colors, allowed) {
  const lab = rgbToLab(...rgb);
  let best = null, bestD = Infinity;
  for (const c of colors) {
    if (allowed && allowed.length && !allowed.includes(c.slot)) continue;
    const d = deltaE00(lab, rgbToLab(...hexToRgb(c.hex)));
    if (d < bestD) { bestD = d; best = c; }
  }
  return best || colors[0];
}

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function sampleCell(ctx, cell, bb, cw, ch) {
  const poly = cell.poly;
  const cb = bboxOf(poly);
  let r = 0, g = 0, b = 0, n = 0, l2 = 0;
  const lums = [];
  const N = 4;
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const x = cb.minX + (ix + 0.5) / N * cb.w;
      const y = cb.minY + (iy + 0.5) / N * cb.h;
      if (!pointInPoly([x, y], poly)) continue;
      const px = Math.max(0, Math.min(cw - 1, (x - bb.minX) / bb.w * cw));
      const py = Math.max(0, Math.min(ch - 1, (y - bb.minY) / bb.h * ch));
      const d = ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
      if (d[3] < 12) continue;
      r += d[0]; g += d[1]; b += d[2]; n++;
      lums.push(lum(d[0], d[1], d[2]));
    }
  }
  if (!n) return null;
  const avg = [r / n, g / n, b / n];
  const ml = lums.reduce((s, v) => s + v, 0) / lums.length;
  const variance = lums.reduce((s, v) => s + Math.pow(v - ml, 2), 0) / lums.length;
  return { rgb: avg, lum: ml, std: Math.sqrt(variance), n };
}

export async function convertImage(img, project, layout, opts = {}, onProgress) {
  const bb = layout.bbox;
  if (!bb.w || !bb.h) throw new Error('empty frame');
  const cw = Math.min(1100, Math.max(360, Math.round(bb.w * 2.4)));
  const ch = Math.max(160, Math.round(cw * bb.h / bb.w));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = Math.max(cw / img.width, ch / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

  const kind = project.grid.mode === 'square' ? 'square' : 'triangle';
  const patterns = PATTERNS.filter(p => p.cell === kind && (opts.patternIds?.length ? opts.patternIds.includes(p.id) : true));
  const pool = patterns.length ? patterns : PATTERNS.filter(p => p.cell === kind);
  const colors = project.printer.colors;
  const samples = [];
  for (const cell of layout.cells) {
    const s = sampleCell(ctx, cell, bb, cw, ch);
    if (s) samples.push({ cell, ...s });
  }
  let lo = 0, hi = 1;
  if (opts.autoContrast !== false) {
    const ls = samples.map(s => s.lum).sort((a, b) => a - b);
    if (ls.length) {
      lo = ls[Math.floor(ls.length * 0.05)] ?? 0;
      hi = ls[Math.floor(ls.length * 0.95)] ?? 1;
    }
  }
  const span = Math.max(0.04, hi - lo);
  const paint = { ...(project.paint || {}) };
  let low = 0, count = 0;
  for (let i = 0; i < samples.length; i++) {
    const { cell, rgb, lum: L, std } = samples[i];
    if (opts.overwrite === false && project.paint?.[cell.id]) continue;
    const norm = Math.max(0, Math.min(1, (L - lo) / span));
    const target = 1 - norm;
    const ranked = [...pool].map(p => ({ p, d: Math.abs(patternDensity(p) - target) })).sort((a, b) => a.d - b.d);
    const best = ranked[0];
    const second = ranked[1];
    const lowConf = (second && second.d - best.d < 0.055) || std > 0.22;
    if (lowConf) low++;
    const col = nearestColor(rgb, colors, opts.colorSlots);
    paint[cell.id] = {
      patternId: best.p.id,
      rot: 0,
      mirror: false,
      color: col.slot,
      layer: 'pattern',
      lowConfidence: lowConf
    };
    count++;
    if (onProgress && i % 120 === 0) {
      onProgress(Math.round(i / samples.length * 100));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  if (onProgress) onProgress(100);
  return { paint, count, low, sampled: samples.length };
}
