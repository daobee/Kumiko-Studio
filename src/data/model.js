// Core data model: frame polygons, triangle/square grids, pattern cells,
// print blocks, validation and snapshot hashes.
import ClipperLib from 'clipper-lib';
import { getPattern, patternRibs, patternDensity, TRI_H } from './patterns.js';

export const SCHEMA_VERSION = 10;
export const SCALE = 1000;

export const DEFAULT_PRINTER = {
  id: 'printer-default',
  label: { zh: '默认打印机', en: 'Default printer' },
  bed: { x: 250, y: 250, z: 250 },
  margin: 5,
  nozzle: 0.4,
  colors: [
    { slot: 0, name: { zh: '桧', en: 'Hinoki' }, hex: '#C9A26D' },
    { slot: 1, name: { zh: '胡桃', en: 'Walnut' }, hex: '#8A6A48' },
    { slot: 2, name: { zh: '朱', en: 'Vermilion' }, hex: '#B4432F' },
    { slot: 3, name: { zh: '墨', en: 'Ink' }, hex: '#3A3631' },
    { slot: 4, name: { zh: '和纸', en: 'Washi' }, hex: '#EFE1C3' },
    { slot: 5, name: { zh: '青', en: 'Indigo' }, hex: '#5C6E6B' }
  ]
};

export function uid(prefix = 'p') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function newProject(name = '北窗') {
  return {
    id: uid('proj'),
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    revision: 0,
    needsReview: false,
    spec: { width: 300, height: 400 },
    frame: {
      preset: 'rect',
      polygon: null,
      frameWidth: 12,
      color: 0,
      background: 4,
      hangers: true
    },
    grid: {
      mode: 'triangle',
      pitch: 50,
      rib: 2.4,
      depth: 12,
      insertThickness: 2,
      backgroundThickness: 1.5,
      exact: false,
      locked: false
    },
    paint: {},
    printer: JSON.parse(JSON.stringify(DEFAULT_PRINTER)),
    profileId: 'paperview-v1',
    customPatterns: [],
    preview: {
      material: 'matte', light: 'day', backlight: true,
      intensity: 1.1, temp: 3200, view: 'iso', dims: true
    },
    snapshot: null
  };
}

/* ---------- polygon helpers ---------- */

export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ensureCCW(poly) {
  return polyArea(poly) < 0 ? [...poly].reverse() : poly;
}

export function polyCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const cross = p[0] * q[1] - q[0] * p[1];
    a += cross;
    cx += (p[0] + q[0]) * cross;
    cy += (p[1] + q[1]) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

export function bboxOf(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function pointInPoly(pt, poly) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function toPath(poly) {
  const p = ensureCCW(poly);
  return p.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
}
function fromPath(path) {
  return path.map(p => [p.X / SCALE, p.Y / SCALE]);
}
function largestPath(paths) {
  if (!paths || !paths.length) return null;
  let best = null, bestArea = -1;
  for (const p of paths) {
    const a = Math.abs(ClipperLib.Clipper.Area(p));
    if (a > bestArea) { bestArea = a; best = p; }
  }
  return best;
}

export function offsetPoly(poly, delta) {
  if (!poly || poly.length < 3) return null;
  const co = new ClipperLib.ClipperOffset(2, 0.35);
  co.AddPath(toPath(poly), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const sol = new ClipperLib.Paths();
  co.Execute(sol, -Math.abs(delta) * SCALE);
  const p = largestPath(sol);
  return p ? fromPath(p) : null;
}

export function clipPoly(subject, clip) {
  if (!subject || subject.length < 3 || !clip || clip.length < 3) return null;
  const c = new ClipperLib.Clipper();
  c.AddPath(toPath(subject), ClipperLib.PolyType.ptSubject, true);
  c.AddPath(toPath(clip), ClipperLib.PolyType.ptClip, true);
  const sol = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctIntersection, sol,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const p = largestPath(sol);
  return p ? fromPath(p) : null;
}

export function selfIntersects(poly) {
  const n = poly.length;
  const inter = (a, b, c, d) => {
    const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = ccw(a, b, c), d2 = ccw(a, b, d), d3 = ccw(c, d, a), d4 = ccw(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = poly[j], d = poly[(j + 1) % n];
      if (inter(a, b, c, d)) return true;
    }
  }
  return false;
}

export function interiorAngles(poly) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
    const v1 = [a[0] - b[0], a[1] - b[1]];
    const v2 = [c[0] - b[0], c[1] - b[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const l = Math.hypot(...v1) * Math.hypot(...v2) || 1;
    out.push(Math.acos(Math.max(-1, Math.min(1, dot / l))) * 180 / Math.PI);
  }
  return out;
}

/* ---------- frame presets ---------- */

export function framePolygon(project) {
  const W = project.spec.width, H = project.spec.height;
  const f = project.frame;
  if (f.preset === 'custom' && f.polygon?.length >= 3) {
    return ensureCCW(f.polygon.map(([x, y]) => [
      Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))
    ]));
  }
  if (f.preset === 'triangle') return ensureCCW([[W / 2, 0], [W, H], [0, H]]);
  if (f.preset === 'diamond') return ensureCCW([[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]]);
  if (f.preset === 'hex') {
    return ensureCCW([[W * 0.25, 0], [W * 0.75, 0], [W, H / 2], [W * 0.75, H], [W * 0.25, H], [0, H / 2]]);
  }
  return ensureCCW([[0, 0], [W, 0], [W, H], [0, H]]);
}

export function presetPolygon(preset, W, H) {
  if (preset === 'triangle') return [[W / 2, 0], [W, H], [0, H]];
  if (preset === 'diamond') return [[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]];
  if (preset === 'hex') return [[W * 0.25, 0], [W * 0.75, 0], [W, H / 2], [W * 0.75, H], [W * 0.25, H], [0, H / 2]];
  return [[0, 0], [W, 0], [W, H], [0, H]];
}

/* ---------- assignment + pattern mapping ---------- */

export function defaultAssignment(cell) {
  return {
    patternId: cell === 'square' ? 'sq_flower' : 'asanoha',
    rot: 0, mirror: false, color: 0, layer: 'pattern', lowConfidence: false
  };
}

export function assignmentOf(project, id, kind) {
  const a = project.paint?.[id];
  return a ? { ...defaultAssignment(kind), ...a } : defaultAssignment(kind);
}

export function patternOf(project, assignment) {
  return getPattern(assignment?.patternId, project.customPatterns || []);
}

// Map a canonical pattern point (u,v) to the cell in mm.
export function mapCellPoint(cell, u, v) {
  if (cell.kind === 'square') {
    const [A, B, , D] = cell.tri;
    return [
      A[0] + u * (B[0] - A[0]) + v * (D[0] - A[0]),
      A[1] + u * (B[1] - A[1]) + v * (D[1] - A[1])
    ];
  }
  const [A, B, C] = cell.tri;
  const Ux = B[0] - A[0], Uy = B[1] - A[1];
  const Vx = C[0] - A[0] - 0.5 * Ux, Vy = C[1] - A[1] - 0.5 * Uy;
  return [A[0] + u * Ux + (v / TRI_H) * Vx, A[1] + u * Uy + (v / TRI_H) * Vy];
}


export function clipSegmentInPoly(a, b, poly) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const ts = [0, 1];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], d = poly[(i + 1) % poly.length];
    const ex = d[0] - c[0], ey = d[1] - c[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den;
    const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
    if (t > 0.0001 && t < 0.9999 && u >= -0.0001 && u <= 1.0001) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const uniq = [];
  for (const t of ts) if (!uniq.length || Math.abs(t - uniq[uniq.length - 1]) > 1e-6) uniq.push(t);
  const out = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const t0 = uniq[i], t1 = uniq[i + 1];
    if (t1 - t0 < 1e-6) continue;
    const tm = (t0 + t1) / 2;
    const px = a[0] + dx * tm, py = a[1] + dy * tm;
    if (pointInPoly([px, py], poly)) {
      out.push([[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]]);
    }
  }
  return out;
}

export function cellPatternSegments(project, cell) {
  const a = cell.assignment
    ? { ...defaultAssignment(cell.kind), ...cell.assignment }
    : assignmentOf(project, cell.id, cell.kind);
  if (a.layer === 'empty') return [];
  const pattern = patternOf(project, a);
  const ribs = patternRibs(pattern, a.rot, a.mirror, cell.kind === 'square' ? 'square' : 'triangle');
  const out = [];
  for (const [p, q] of ribs) {
    const A = mapCellPoint(cell, p[0], p[1]);
    const B = mapCellPoint(cell, q[0], q[1]);
    for (const [x, y] of clipSegmentInPoly(A, B, cell.poly)) out.push([x, y]);
  }
  return out;
}

export function cellBorderSegments(cell) {
  const poly = cell.poly;
  return poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
}

export function colorOf(project, slot) {
  return project.printer.colors.find(c => c.slot === slot) || project.printer.colors[0];
}

/* ---------- layout ---------- */

function makeTriangleCells(project, inner) {
  const p = Math.max(10, project.grid.pitch);
  const h = p * TRI_H;
  const bb = bboxOf(inner);
  const cells = [];
  const maxA = p * p * TRI_H / 2;
  let r = 0;
  for (let y0 = bb.minY - h; y0 < bb.maxY + h; y0 += h, r++) {
    let c = 0;
    for (let x = bb.minX - p; x < bb.maxX + p; x += p, c++) {
      const variants = [
        { kind: 'up', tri: [[x, y0 + h], [x + p, y0 + h], [x + p / 2, y0]] },
        { kind: 'down', tri: [[x + p / 2, y0], [x + 1.5 * p, y0], [x + p, y0 + h]] }
      ];
      for (const v of variants) {
        const poly = clipPoly(v.tri, inner);
        if (!poly) continue;
        const a = Math.abs(polyArea(poly));
        if (a < Math.max(6, maxA * 0.035)) continue;
        const id = `${r}:${c}:${v.kind}`;
        const cen = polyCentroid(poly);
        const as = assignmentOf(project, id, 'triangle');
        const pat = getPattern(as.patternId, project.customPatterns || []);
        cells.push({
          id, r, c, kind: v.kind, tri: v.tri, poly, centroid: cen,
          area: a, assignment: as, pattern: pat,
          density: patternDensity(pat), color: as.color,
          layer: as.layer, lowConfidence: !!as.lowConfidence
        });
      }
    }
  }
  return cells;
}

function makeSquareCells(project, inner) {
  const p = Math.max(10, project.grid.pitch);
  const bb = bboxOf(inner);
  const cells = [];
  let r = 0;
  for (let y0 = bb.minY - p; y0 < bb.maxY + p; y0 += p, r++) {
    let c = 0;
    for (let x = bb.minX - p; x < bb.maxX + p; x += p, c++) {
      const tri = [[x, y0], [x + p, y0], [x + p, y0 + p], [x, y0 + p]];
      const poly = clipPoly(tri, inner);
      if (!poly) continue;
      const a = Math.abs(polyArea(poly));
      if (a < Math.max(8, p * p * 0.04)) continue;
      const id = `${r}:${c}:square`;
      const cen = polyCentroid(poly);
      const as = assignmentOf(project, id, 'square');
      const pat = getPattern(as.patternId, project.customPatterns || []);
      cells.push({
        id, r, c, kind: 'square', tri, poly, centroid: cen,
        area: a, assignment: as, pattern: pat,
        density: patternDensity(pat), color: as.color,
        layer: as.layer, lowConfidence: !!as.lowConfidence
      });
    }
  }
  return cells;
}

export function frameMaxSegment(project) {
  return Math.max(40, Math.min(project.printer.bed.x, project.printer.bed.y) - 2 * project.printer.margin);
}

export function frameSegmentsOf(project, outer) {
  const max = frameMaxSegment(project);
  const out = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const n = Math.max(1, Math.ceil(len / max));
    const seg = len / n;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      out.push({
        x1: a[0] + (b[0] - a[0]) * t0,
        y1: a[1] + (b[1] - a[1]) * t0,
        x2: a[0] + (b[0] - a[0]) * t1,
        y2: a[1] + (b[1] - a[1]) * t1,
        len: seg, edge: i
      });
    }
  }
  return out;
}

export function hangerPoints(project, outer) {
  if (!project.frame.hangers) return [];
  const bb = bboxOf(outer);
  const topY = bb.minY;
  const top = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    if (Math.abs(a[1] - topY) < 0.01 && Math.abs(b[1] - topY) < 0.01) {
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
      if (x1 - x0 >= 30) top.push([x0, x1]);
    }
  }
  if (!top.length) return [];
  const pts = [];
  for (const [x0, x1] of top) {
    const len = x1 - x0;
    const n = Math.max(1, Math.round(len / 90));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      pts.push([x0 + len * t, topY + project.frame.frameWidth / 2]);
    }
  }
  return pts;
}

export function blocksOf(project, outer, cells, frameSegs) {
  const bb = bboxOf(outer);
  const pr = project.printer;
  const usableX = Math.max(20, pr.bed.x - 2 * pr.margin);
  const usableY = Math.max(20, pr.bed.y - 2 * pr.margin);
  const cols = Math.max(1, Math.ceil(bb.w / usableX));
  const rows = Math.max(1, Math.ceil(bb.h / usableY));
  const blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = bb.minX + c * usableX;
      const y = bb.minY + r * usableY;
      const w = Math.min(usableX, bb.maxX - x);
      const h = Math.min(usableY, bb.maxY - y);
      blocks.push({
        index: blocks.length, r, c, x, y, w, h,
        cells: [], frameSegs: [],
        colors: {}, parts: 0, hours: 0, grams: 0,
        fit: w <= pr.bed.x && h <= pr.bed.y
      });
    }
  }
  const findBlock = (x, y) => {
    for (const b of blocks) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return blocks[0];
  };
  for (const cell of cells) {
    const b = findBlock(cell.centroid[0], cell.centroid[1]);
    b.cells.push(cell.id);
    const col = cell.color;
    b.colors[col] = (b.colors[col] || 0) + 1;
  }
  for (const s of frameSegs) {
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
    const b = findBlock(mx, my);
    b.frameSegs.push(s);
  }
  return blocks;
}

const PER = {
  insert: { min: 4.4, grams: 7 },
  frame: { min: 11, grams: 20 },
  background: { min: 1, grams: 2.5 },
  subpanel: { min: 60, grams: 70 }
};

export function buildPrintPlan(project, layout) {
  const groups = new Map();
  for (const cell of layout.cells) {
    const a = cell.assignment;
    const key = `${a.patternId}|${a.rot}|${a.mirror ? 1 : 0}|${a.color}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key, patternId: a.patternId, patternName: cell.pattern?.name,
        rot: a.rot, mirror: a.mirror, color: a.color,
        hex: colorOf(project, a.color).hex,
        qty: 0, area: 0, blockIds: new Set()
      });
    }
    const g = groups.get(key);
    g.qty++;
    g.area += cell.area;
  }
  const blockGroupCounts = layout.blocks.map(() => new Map());
  for (const b of layout.blocks) {
    for (const id of b.cells) {
      const cell = layout.cellById.get(id);
      if (!cell) continue;
      const a = cell.assignment;
      const key = `${a.patternId}|${a.rot}|${a.mirror ? 1 : 0}|${a.color}`;
      groups.get(key)?.blockIds.add(b.index);
      const m = blockGroupCounts[b.index];
      m.set(key, (m.get(key) || 0) + 1);
    }
  }
  const insertGroups = [...groups.values()].map(g => ({
    ...g, blockIds: [...g.blockIds].sort((a, b) => a - b),
    hours: +(PER.insert.min * g.qty / 60).toFixed(1),
    grams: Math.round(PER.insert.grams * g.qty)
  }));

  const frameGroups = new Map();
  for (const s of layout.frameSegments) {
    const key = `frame|${s.len.toFixed(1)}`;
    if (!frameGroups.has(key)) {
      frameGroups.set(key, {
        key, type: 'frame', qty: 0, len: s.len,
        color: project.frame.color, hex: colorOf(project, project.frame.color).hex
      });
    }
    frameGroups.get(key).qty++;
  }
  const frameRows = [...frameGroups.values()].map(g => ({
    ...g, hours: +(PER.frame.min * g.qty / 60).toFixed(1),
    grams: Math.round(PER.frame.grams * g.qty)
  }));

  const blockRows = layout.blocks.map(b => {
    const background = { type: 'background', qty: 1, color: project.frame.background };
    const subpanel = { type: 'subpanel', qty: 1, color: project.frame.color };
    const counts = blockGroupCounts[b.index] || new Map();
    const inserts = [...counts.values()].reduce((s, n) => s + n, 0);
    const parts = inserts + b.frameSegs.length + 2;
    const hours = +((inserts * PER.insert.min + b.frameSegs.length * PER.frame.min + PER.background.min + PER.subpanel.min) / 60).toFixed(1);
    const grams = Math.round(inserts * PER.insert.grams + b.frameSegs.length * PER.frame.grams + PER.background.grams + PER.subpanel.grams);
    return {
      ...b, parts, hours, grams,
      insertCount: inserts,
      frameCount: b.frameSegs.length,
      background, subpanel
    };
  });

  const inserts = insertGroups.reduce((s, g) => s + g.qty, 0);
  const frameCount = frameRows.reduce((s, g) => s + g.qty, 0);
  const backgrounds = layout.blocks.length;
  const subpanels = layout.blocks.length;
  const parts = inserts + frameCount + backgrounds + subpanels;
  const hours = +(blockRows.reduce((s, b) => s + b.hours, 0)).toFixed(1);
  const grams = blockRows.reduce((s, b) => s + b.grams, 0);
  const colorCounts = new Map();
  const addColor = (slot, n) => colorCounts.set(slot, (colorCounts.get(slot) || 0) + n);
  insertGroups.forEach(g => addColor(g.color, g.qty));
  frameRows.forEach(f => addColor(f.color, f.qty));
  blockRows.forEach(b => { addColor(b.background.color, 1); addColor(b.subpanel.color, 1); });
  const colors = project.printer.colors.map(c => ({
    ...c,
    count: colorCounts.get(c.slot) || 0
  })).filter(c => c.count > 0);

  return {
    insertGroups, frameRows, blockRows, blocks: layout.blocks,
    totals: { inserts, frameCount, backgrounds, subpanels, parts, hours, grams },
    colors,
    fits: blockRows.every(b => b.fit) && frameRows.every(r => r.len <= frameMaxSegment(project))
  };
}

export function layoutOf(project) {
  const outerRaw = framePolygon(project);
  const outer = ensureCCW(outerRaw);
  const inner = offsetPoly(outer, project.frame.frameWidth);
  const bb = bboxOf(outer);
  const warnings = [];
  const cells = inner ? (project.grid.mode === 'square'
    ? makeSquareCells(project, inner) : makeTriangleCells(project, inner)) : [];
  const cellById = new Map(cells.map(c => [c.id, c]));
  const frameSegments = frameSegmentsOf(project, outer);
  const blocks = blocksOf(project, outer, cells, frameSegments);
  const layout = {
    outer, inner, bbox: bb,
    actualW: bb.w, actualH: bb.h,
    cells, cellById, frameSegments, blocks,
    frameMax: frameMaxSegment(project),
    hangers: hangerPoints(project, outer),
    warnings
  };
  layout.plan = buildPrintPlan(project, layout);
  return layout;
}

/* ---------- validation ---------- */

export function validate(project, layout, profile) {
  const out = [];
  const add = (level, code, params = {}) => out.push({ level, code, params });
  const outer = layout.outer;
  if (outer.length < 3) add('error', 'invalidFrame');
  if (selfIntersects(outer)) add('error', 'invalidFrame');
  const angles = interiorAngles(outer);
  if (angles.some(a => a < 20)) add('error', 'invalidFrame');
  if (!layout.inner) add('error', 'invalidFrame');
  if (project.frame.frameWidth < 2 * project.grid.rib) add('error', 'border');
  if (!layout.cells.length) add('error', 'noCells');
  if (!project.printer.colors.length) add('error', 'colors');
  const maxPart = Math.max(project.printer.bed.x, project.printer.bed.y);
  if (project.grid.pitch > maxPart - 2 * project.printer.margin) add('error', 'bed');
  for (const b of layout.blocks) {
    for (const id of b.cells) {
      const c = layout.cellById.get(id);
      if (!c) continue;
      const cb = bboxOf(c.poly);
      if (cb.w > project.printer.bed.x - 2 * project.printer.margin || cb.h > project.printer.bed.y - 2 * project.printer.margin) {
        add('error', 'bed');
        break;
      }
    }
  }
  if (!profile?.calibrated) add('warn', 'profile');
  return out;
}

export function validationText(issue, t) {
  const map = {
    invalidFrame: 'error.invalidFrame',
    border: 'error.border',
    noCells: 'error.noCells',
    bed: 'error.bed',
    profile: 'error.profile',
    colors: 'printer.needColor',
    storage: 'error.storage'
  };
  return t(map[issue.code] || 'error.unknown');
}

export function snapshotOf(project) {
  const paramsHash = hashStr(JSON.stringify({
    spec: project.spec, frame: project.frame, grid: project.grid,
    paint: project.paint, printer: project.printer, profileId: project.profileId
  }));
  const partsHash = hashStr(JSON.stringify({
    frame: project.frame, grid: project.grid, paint: project.paint,
    printer: project.printer, custom: project.customPatterns
  }));
  const profileHash = hashStr(JSON.stringify(project.profileId));
  return { paramsHash, partsHash, profileHash, at: new Date().toISOString() };
}

export function normalizeProject(p) {
  p = p || {};
  const base = newProject(p.name || '北窗');
  const n = { ...base, ...p };
  n.spec = { ...base.spec, ...(p.spec || {}) };
  n.frame = { ...base.frame, ...(p.frame || {}) };
  n.grid = { ...base.grid, ...(p.grid || {}) };
  n.preview = { ...base.preview, ...(p.preview || {}) };
  n.printer = p.printer || base.printer;
  n.paint = p.paint || {};
  n.customPatterns = p.customPatterns || [];
  n.needsReview = !!p.needsReview;
  n.revision = p.revision || 0;
  n.schemaVersion = SCHEMA_VERSION;
  return n;
}
