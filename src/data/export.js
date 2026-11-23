// Export: 1:1 SVG, CSV block list, 3MF, STL, parts ZIP.
import { zipSync, strToU8 } from 'fflate';
import { patternName, getPattern, patternRibs, TRI_H } from './patterns.js';
import { cellBorderSegments, cellPatternSegments, colorOf, bboxOf } from './model.js';

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  download(new Blob([text], { type: mime }), filename);
}

export function safeName(s) {
  return (s || 'kumiko').replace(/[^\w一-龥-]+/g, '_').slice(0, 60);
}

/* ---------- display geometry ---------- */

export function displayGeometry(project, layout) {
  const segments = [];
  const plates = [];
  for (const cell of layout.cells) {
    const col = colorOf(project, cell.color);
    const a = cell.assignment;
    if (a.layer !== 'empty') {
      if (cell.pattern?.fill) {
        plates.push({ poly: cell.poly, color: col.hex, cellId: cell.id });
      }
      for (const [p, q] of cellPatternSegments(project, cell)) {
        segments.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1], color: col.hex, cellId: cell.id });
      }
    }
    for (const [p, q] of cellBorderSegments(cell)) {
      segments.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1], color: col.hex, cellId: cell.id });
    }
  }
  return {
    segments, plates,
    frame: {
      outer: layout.outer, inner: layout.inner,
      color: colorOf(project, project.frame.color).hex,
      depth: project.grid.depth
    },
    background: {
      color: colorOf(project, project.frame.background).hex,
      thickness: project.grid.backgroundThickness,
      bbox: layout.bbox
    }
  };
}

/* ---------- mesh builders ---------- */

class MeshBuilder {
  constructor() { this.vertices = []; this.indices = []; }
  addV(x, y, z) { this.vertices.push(+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)); return this.vertices.length / 3 - 1; }
  tri(a, b, c) { this.indices.push(a, b, c); }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  box(w, h, d, cx = 0, cy = 0, cz = 0, rotZ = 0) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const c = Math.cos(rotZ), s = Math.sin(rotZ);
    const p = (x, y, z) => {
      const X = x * c - y * s, Y = x * s + y * c;
      return this.addV(cx + X, cy + Y, cz + z);
    };
    const v = [
      p(-hw, -hh, -hd), p(hw, -hh, -hd), p(hw, hh, -hd), p(-hw, hh, -hd),
      p(-hw, -hh, hd), p(hw, -hh, hd), p(hw, hh, hd), p(-hw, hh, hd)
    ];
    this.quad(v[0], v[3], v[2], v[1]);
    this.quad(v[4], v[5], v[6], v[7]);
    this.quad(v[0], v[1], v[5], v[4]);
    this.quad(v[1], v[2], v[6], v[5]);
    this.quad(v[2], v[3], v[7], v[6]);
    this.quad(v[3], v[0], v[4], v[7]);
  }
  prism(points, height, cx = 0, cy = 0, cz = 0) {
    const n = points.length;
    if (n < 3) return;
    const bottom = points.map(([x, y]) => this.addV(cx + x, cy + y, cz));
    const top = points.map(([x, y]) => this.addV(cx + x, cy + y, cz + height));
    for (let i = 1; i < n - 1; i++) {
      this.tri(bottom[0], bottom[i + 1], bottom[i]);
      this.tri(top[0], top[i], top[i + 1]);
      this.quad(bottom[i], bottom[i + 1], top[i + 1], top[i]);
    }
    this.quad(bottom[0], bottom[1], top[1], top[0]);
    this.quad(bottom[n - 1], bottom[0], top[0], top[n - 1]);
  }
  ring(outer, inner, depth) {
    const n = Math.min(outer.length, inner.length);
    if (n < 3) return;
    const ot = outer.slice(0, n).map(([x, y]) => this.addV(x, y, depth));
    const ob = outer.slice(0, n).map(([x, y]) => this.addV(x, y, 0));
    const it = inner.slice(0, n).map(([x, y]) => this.addV(x, y, depth));
    const ib = inner.slice(0, n).map(([x, y]) => this.addV(x, y, 0));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad(ot[i], ot[j], it[j], it[i]); // top
      this.quad(ob[i], ib[i], ib[j], ob[j]); // bottom
      this.quad(ob[i], ob[j], ot[j], ot[i]); // outer wall
      this.quad(ib[i], it[i], it[j], ib[j]); // inner wall
    }
  }
  mesh(name, color) {
    return { name, color, vertices: new Float32Array(this.vertices), indices: new Uint32Array(this.indices) };
  }
}

function segBoxes(segments, rib, height, z = height / 2) {
  const b = new MeshBuilder();
  for (const s of segments) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) continue;
    b.box(len + rib * 0.7, rib, height, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, z, Math.atan2(dy, dx));
  }
  return b;
}

export function buildMeshes(project, layout) {
  const g = displayGeometry(project, layout);
  const meshes = [];
  const frame = new MeshBuilder();
  if (layout.inner) frame.ring(layout.outer, layout.inner, project.grid.depth);
  meshes.push(frame.mesh('frame', colorOf(project, project.frame.color).hex));

  // inserts grouped by color so 3MF can assign materials
  const byColor = new Map();
  for (const s of g.segments) {
    if (!byColor.has(s.color)) byColor.set(s.color, []);
    byColor.get(s.color).push(s);
  }
  for (const [hex, segs] of byColor) {
    const b = segBoxes(segs, project.grid.rib, project.grid.insertThickness);
    meshes.push(b.mesh('inserts-' + hex.replace('#', ''), hex));
  }
  for (const plate of g.plates) {
    const b = new MeshBuilder();
    b.prism(plate.poly, project.grid.insertThickness);
    meshes.push(b.mesh('plate-' + plate.cellId.replace(/:/g, '_'), plate.color));
  }
  const bg = new MeshBuilder();
  const bb = layout.bbox;
  if (layout.inner?.length >= 3) {
    bg.prism(layout.inner, project.grid.backgroundThickness, 0, 0, 0);
  } else {
    bg.box(bb.w, bb.h, project.grid.backgroundThickness, bb.minX + bb.w / 2, bb.minY + bb.h / 2, -project.grid.backgroundThickness / 2);
  }
  meshes.push(bg.mesh('background', colorOf(project, project.frame.background).hex));
  return meshes;
}

export function stlBytes(meshes) {
  const tris = [];
  for (const m of meshes) {
    const v = m.vertices, idx = m.indices;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      tris.push([v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2], v[c], v[c + 1], v[c + 2]]);
    }
  }
  const size = 84 + tris.length * 50;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  new Uint8Array(buf, 0, 80).set(new TextEncoder().encode('Kumiko Studio binary STL').slice(0, 80));
  dv.setUint32(80, tris.length, true);
  let off = 84;
  for (const t of tris) {
    const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2];
    const vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true); off += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(off, t[k], true); off += 4; }
    dv.setUint16(off, 0, true); off += 2;
  }
  return new Uint8Array(buf);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function threeMF(meshes) {
  const used = [...new Set(meshes.map(m => m.color))];
  const bases = used.map((hex, i) => `<base name="color${i + 1}" displaycolor="${hex}FF"/>`).join('');
  const objects = meshes.map((m, i) => {
    const v = m.vertices, idx = m.indices;
    let vs = '';
    for (let k = 0; k < v.length; k += 3) vs += `<vertex x="${v[k].toFixed(4)}" y="${v[k + 1].toFixed(4)}" z="${v[k + 2].toFixed(4)}"/>`;
    let ts = '';
    for (let k = 0; k < idx.length; k += 3) ts += `<triangle v1="${idx[k]}" v2="${idx[k + 1]}" v3="${idx[k + 2]}"/>`;
    return `<object id="${i + 2}" type="model" pid="1" pindex="${used.indexOf(m.color)}" name="${esc(m.name)}"><mesh><vertices>${vs}</vertices><triangles>${ts}</triangles></mesh></object>`;
  }).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">Kumiko Studio panel</metadata>
<resources><basematerials id="1">${bases}</basematerials>${objects}</resources>
<build>${meshes.map((m, i) => `<item objectid="${i + 2}"/>`).join('')}</build>
</model>`;
  const types = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  const zip = zipSync({
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model)
  });
  return new Blob([zip], { type: 'model/3mf' });
}

/* ---------- per-variant parts ---------- */

function canonicalInsertMesh(project, pattern, rot, mirror, kind, color) {
  const p = Math.max(10, project.grid.pitch);
  let tri;
  if (kind === 'square') tri = [[0, 0], [p, 0], [p, p], [0, p]];
  else tri = [[0, 0], [p, 0], [p / 2, p * TRI_H]];
  const cell = { kind, tri, poly: tri, id: 'origin', assignment: { patternId: pattern.id, rot, mirror, color, layer: 'pattern' }, color };
  const b = new MeshBuilder();
  const rib = project.grid.rib;
  for (const [q, w] of cellBorderSegments(cell)) {
    const dx = w[0] - q[0], dy = w[1] - q[1];
    const len = Math.hypot(dx, dy);
    b.box(len + rib * 0.7, rib, project.grid.insertThickness, (q[0] + w[0]) / 2, (q[1] + w[1]) / 2, project.grid.insertThickness / 2, Math.atan2(dy, dx));
  }
  if (pattern.fill) {
    b.prism(tri, project.grid.insertThickness);
  } else {
    for (const [q, w] of cellPatternSegments(project, cell)) {
      const dx = w[0] - q[0], dy = w[1] - q[1];
      const len = Math.hypot(dx, dy);
      b.box(len + rib * 0.7, rib, project.grid.insertThickness, (q[0] + w[0]) / 2, (q[1] + w[1]) / 2, project.grid.insertThickness / 2, Math.atan2(dy, dx));
    }
  }
  return b.mesh(`insert-${pattern.id}-r${rot}-${mirror ? 'm1' : 'm0'}`, color);
}

export function partsZip(project, layout) {
  const plan = layout.plan;
  const files = {};
  for (const g of plan.insertGroups) {
    const pat = getPattern(g.patternId, project.customPatterns || []);
    const mesh = canonicalInsertMesh(project, pat, g.rot, g.mirror, project.grid.mode === 'square' ? 'square' : 'triangle', g.hex);
    const name = `parts/insert-${pat.id}-r${g.rot}-${g.mirror ? 'm1' : 'm0'}-${g.hex.replace('#', '')}.stl`;
    files[name] = stlBytes([mesh]);
  }
  for (const f of plan.frameRows) {
    const b = new MeshBuilder();
    b.box(f.len, project.frame.frameWidth, project.grid.depth, 0, 0, project.grid.depth / 2);
    files[`parts/frame-${Math.round(f.len)}mm.stl`] = stlBytes([b.mesh('frame', colorOf(project, project.frame.color).hex)]);
  }
  for (const b of layout.blocks) {
    const bg = new MeshBuilder();
    bg.box(b.w, b.h, project.grid.backgroundThickness, 0, 0, project.grid.backgroundThickness / 2);
    files[`parts/background-${Math.round(b.w)}x${Math.round(b.h)}.stl`] = stlBytes([bg.mesh('background', colorOf(project, project.frame.background).hex)]);
    const sp = new MeshBuilder();
    sp.box(b.w, b.h, project.grid.depth, 0, 0, project.grid.depth / 2);
    files[`parts/subpanel-${Math.round(b.w)}x${Math.round(b.h)}.stl`] = stlBytes([sp.mesh('subpanel', colorOf(project, project.frame.color).hex)]);
  }
  const lines = [
    'Kumiko Studio parts ZIP',
    `Project: ${project.name}`,
    `Frame: ${project.frame.preset} / actual ${layout.actualW.toFixed(1)} x ${layout.actualH.toFixed(1)} mm`,
    `Pitch: ${project.grid.pitch} mm / rib: ${project.grid.rib} mm / insert thickness: ${project.grid.insertThickness} mm`,
    `Blocks: ${plan.blocks.length} / inserts: ${plan.totals.inserts} / frame segments: ${plan.totals.frameCount}`,
    '',
    'Insert variants (one STL per pattern / rotation / mirror / color):',
    ...plan.insertGroups.map(g => `  ${g.patternId} r${g.rot} ${g.mirror ? 'mirrored' : ''} ${g.hex} x${g.qty}`),
    '',
    'Frame segments and background/subpanel plates are separate STLs.',
    'All dimensions are mm. Place parts flat in the slicer; quantities are in the block list CSV.'
  ].join('\n');
  files['README.txt'] = strToU8(lines);
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

/* ---------- 1:1 SVG / CSV ---------- */

function svgSegs(segments, stroke, width) {
  return segments.map(s => `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}"/>`).join('');
}

export function oneToOneSVG(project, layout, lang, t) {
  const bb = layout.bbox;
  const pad = 34;
  const w = bb.w + pad * 2, h = bb.h + pad * 2 + 30;
  const ox = pad - bb.minX, oy = pad - bb.minY;
  const cellSegs = [];
  for (const cell of layout.cells) {
    if (cell.assignment.layer === 'empty') continue;
    for (const [p, q] of cellPatternSegments(project, cell)) cellSegs.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
  }
  const borders = [];
  for (const cell of layout.cells) for (const [p, q] of cellBorderSegments(cell)) borders.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
  const outerPath = layout.outer.map((p, i) => `${i ? 'L' : 'M'}${(p[0] + ox).toFixed(2)},${(p[1] + oy).toFixed(2)}`).join('') + 'Z';
  const innerPath = layout.inner ? layout.inner.map((p, i) => `${i ? 'L' : 'M'}${(p[0] + ox).toFixed(2)},${(p[1] + oy).toFixed(2)}`).join('') + 'Z' : '';
  const blocks = layout.blocks.map(b =>
    `<rect x="${(b.x + ox).toFixed(2)}" y="${(b.y + oy).toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" fill="none" stroke="#999" stroke-dasharray="4 3" stroke-width=".3"/>
     <text x="${(b.x + ox + 2).toFixed(2)}" y="${(b.y + oy + 6).toFixed(2)}" font-size="4" fill="#666">B${b.index + 1}</text>`).join('');
  const hangers = layout.hangers.map((p, i) =>
    `<g><circle cx="${(p[0] + ox).toFixed(2)}" cy="${(p[1] + oy).toFixed(2)}" r="2" fill="none" stroke="#b4432f" stroke-width=".5"/>
     <text x="${(p[0] + ox + 3).toFixed(2)}" y="${(p[1] + oy + 1).toFixed(2)}" font-size="3" fill="#b4432f">P${i + 1}</text></g>`).join('');
  const title = `${project.name} · ${layout.actualW.toFixed(1)} × ${layout.actualH.toFixed(1)} mm · pitch ${project.grid.pitch} mm`;
  const hangText = layout.hangers.length
    ? layout.hangers.map((p, i) => `P${i + 1} (${p[0].toFixed(0)}, ${p[1].toFixed(0)})`).join(' · ')
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}mm" height="${h.toFixed(1)}mm" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">
<rect width="100%" height="100%" fill="#fff"/>
<g transform="translate(0,0)">
<path d="${outerPath}" fill="none" stroke="#111" stroke-width=".8"/>
${innerPath ? `<path d="${innerPath}" fill="none" stroke="#111" stroke-width=".5"/>` : ''}
<g stroke="#111" stroke-width=".28" fill="none">${svgSegs(borders, '#111', .28)}${svgSegs(cellSegs, '#111', .34)}</g>
${blocks}${hangers}
<g stroke="#111" stroke-width=".3">
<line x1="${ox}" y1="${bb.minY + oy - 8}" x2="${bb.maxX + ox}" y2="${bb.minY + oy - 8}"/>
<line x1="${ox}" y1="${bb.minY + oy - 11}" x2="${ox}" y2="${bb.minY + oy - 5}"/>
<line x1="${bb.maxX + ox}" y1="${bb.minY + oy - 11}" x2="${bb.maxX + ox}" y2="${bb.minY + oy - 5}"/>
</g>
<text x="${(bb.w / 2 + ox).toFixed(2)}" y="${(bb.minY + oy - 11).toFixed(2)}" text-anchor="middle" font-size="4" fill="#111">${bb.w.toFixed(1)} mm</text>
<text x="${pad}" y="12" font-size="4.4" fill="#111">${title}</text>
<text x="${pad}" y="19" font-size="3.2" fill="#b4432f">${t('export.doNotScale')}</text>
<text x="${w - pad}" y="12" text-anchor="end" font-size="3.2" fill="#777">paperview-v1 · ${new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</text>
<text x="${pad}" y="${h - 8}" font-size="3.2" fill="#555">${hangText}</text>
</g>
</svg>`;
}

export function printSVG(svg) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>Kumiko 1:1</title><style>@page{size:auto;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}<script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script></body></html>`);
  w.document.close();
  return true;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function csvPlan(project, layout, lang, t) {
  const pn = id => {
    const pat = getPattern(id, project.customPatterns || []);
    return patternName(pat, lang);
  };
  const lines = [];
  lines.push([
    t('export.blockNo'), t('export.size'), t('export.type'), t('export.pattern'),
    t('export.color'), t('export.qty'), t('export.hours'), t('export.filament')
  ].map(csvEscape).join(','));
  for (const b of layout.plan.blockRows) {
    lines.push([
      `B${b.index + 1}`, `${b.w.toFixed(1)} × ${b.h.toFixed(1)}`, t('common.blocks'),
      '', '', b.insertCount ?? '', b.hours ?? '', b.grams ?? ''
    ].map(csvEscape).join(','));
  }
  lines.push('');
  for (const g of layout.plan.insertGroups) {
    lines.push([
      g.blockIds.map(i => `B${i + 1}`).join(' '), `${project.grid.pitch} mm`,
      'insert', pn(g.patternId), g.hex, g.qty, g.hours, g.grams
    ].map(csvEscape).join(','));
  }
  for (const f of layout.plan.frameRows) {
    lines.push(['', `${f.len.toFixed(1)} mm`, 'frame', '', f.hex, f.qty, f.hours, f.grams].map(csvEscape).join(','));
  }
  lines.push(`"", "","background", "", "", ${layout.blocks.length}, "", ""`);
  lines.push(`"", "","subpanel", "", "", ${layout.blocks.length}, "", ""`);
  return '﻿' + lines.join('\n');
}
