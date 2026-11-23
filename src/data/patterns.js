// Triangular / square pattern pieces.
// Canonical triangle: A(0,0) B(1,0) C(0.5, √3/2). All ribs live inside it.
export const TRI_H = Math.sqrt(3) / 2;
const A = [0, 0], B = [1, 0], C = [0.5, TRI_H];
const G = [0.5, TRI_H / 3];
const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const AB = mid(A, B), BC = mid(B, C), CA = mid(C, A);
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const scaleP = (p, s) => lerp(G, p, s);
const seg = (a, b) => [a, b];

const asanohaRibs = () => [
  seg(G, A), seg(G, B), seg(G, C),
  seg(G, AB), seg(G, BC), seg(G, CA)
];
const innerTri = (s) => [scaleP(A, s), scaleP(B, s), scaleP(C, s)];

function ring(points) {
  return points.map((p, i) => seg(p, points[(i + 1) % points.length]));
}
function hLines(n, f0, f1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * (n === 1 ? 0.5 : i / (n - 1));
    const y = f * TRI_H;
    const x0 = y * 0.5 / TRI_H;
    out.push(seg([x0, y], [1 - x0, y]));
  }
  return out;
}
function diagLines(n, side) {
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (side === 'left') out.push(seg(lerp(A, C, t), lerp(B, C, 1 - t)));
    else out.push(seg(lerp(B, C, t), lerp(A, C, 1 - t)));
  }
  return out;
}

const N = (zh, en, ja) => ({ zh, en, ja });

export const PATTERNS = [
  {
    id: 'empty', cell: 'triangle', family: 'base', density: 0.03, fill: false,
    name: N('空白', 'Empty', '空白'), source: 'transcribed',
    ribs: []
  },
  {
    id: 'solid', cell: 'triangle', family: 'base', density: 1, fill: true,
    name: N('实心', 'Solid', '詰め'), source: 'transcribed',
    ribs: []
  },
  {
    id: 'asanoha', cell: 'triangle', family: 'asanoha', density: 0.46, fill: false,
    name: N('麻叶', 'Asa-no-ha', '麻の葉'), source: 'transcribed',
    ribs: asanohaRibs()
  },
  {
    id: 'asanoha_variant', cell: 'triangle', family: 'asanoha', density: 0.52, fill: false,
    name: N('麻叶变体', 'Asa-no-ha variant', '麻の葉変わり'), source: 'transcribed',
    ribs: [...asanohaRibs(), ...ring(innerTri(0.46))]
  },
  {
    id: 'futae', cell: 'triangle', family: 'asanoha', density: 0.64, fill: false,
    name: N('双层麻叶', 'Futae asa-no-ha', '二重麻の葉'), source: 'transcribed',
    ribs: [...asanohaRibs(), ...ring(innerTri(0.55)), ...innerTri(0.55).map(p => seg(G, p))]
  },
  {
    id: 'tsuno', cell: 'triangle', family: 'asanoha', density: 0.5, fill: false,
    name: N('角麻叶', 'Tsuno asa-no-ha', '角麻の葉'), source: 'transcribed',
    ribs: [...asanohaRibs(), seg(AB, C), seg(BC, A), seg(CA, B)]
  },
  {
    id: 'goma', cell: 'triangle', family: 'goma', density: 0.38, fill: false,
    name: N('胡麻', 'Goma', '胡麻'), source: 'transcribed',
    ribs: hLines(4, 0.16, 0.82)
  },
  {
    id: 'hoshi', cell: 'triangle', family: 'goma', density: 0.55, fill: false,
    name: N('星', 'Hoshi', '星'), source: 'transcribed',
    ribs: [
      ...asanohaRibs(),
      seg(lerp(A, B, 0.2), lerp(A, C, 0.62)),
      seg(lerp(A, B, 0.8), lerp(B, C, 0.62)),
      seg(lerp(A, C, 0.2), lerp(B, C, 0.2))
    ]
  },
  {
    id: 'mitsukude', cell: 'triangle', family: 'mitsukude', density: 0.32, fill: false,
    name: N('三向', 'Mitsukude', '三つ組手'), source: 'transcribed',
    ribs: [seg(G, A), seg(G, B), seg(G, C), ...ring(innerTri(0.34))]
  },
  {
    id: 'kikkou', cell: 'triangle', family: 'kikko', density: 0.44, fill: false,
    name: N('龟甲', 'Kikkō', '亀甲'), source: 'transcribed',
    ribs: [...ring(innerTri(0.55)), ...innerTri(0.55).map((p, i) => seg(p, [A, B, C][i]))]
  },
  {
    id: 'sakura', cell: 'triangle', family: 'kikko', density: 0.56, fill: false,
    name: N('樱龟甲', 'Sakura kikkō', '桜亀甲'), source: 'transcribed',
    ribs: [
      ...ring(Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        return [G[0] + Math.cos(a) * 0.26, G[1] + Math.sin(a) * 0.26];
      })),
      ...Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        return seg(G, [G[0] + Math.cos(a) * 0.26, G[1] + Math.sin(a) * 0.26]);
      })
    ]
  },
  {
    id: 'kazaguruma', cell: 'triangle', family: 'wheel', density: 0.5, fill: false,
    name: N('风车', 'Kaza-guruma', '風車'), source: 'transcribed',
    ribs: [
      seg(G, AB), seg(AB, B), seg(G, BC), seg(BC, C), seg(G, CA), seg(CA, A)
    ]
  },
  {
    id: 'kasane', cell: 'triangle', family: 'rindo', density: 0.6, fill: false,
    name: N('重菱', 'Kasane rindō', '重菱'), source: 'transcribed',
    ribs: [
      seg(A, C), seg(B, C), seg(A, G), seg(B, G),
      seg(lerp(A, C, 0.55), lerp(B, C, 0.55)), seg(lerp(A, B, 0.5), G)
    ]
  },
  {
    id: 'uroko', cell: 'triangle', family: 'scale', density: 0.48, fill: false,
    name: N('鳞', 'Uroko', '鱗'), source: 'transcribed',
    ribs: [
      ...Array.from({ length: 3 }, (_, k) => {
        const y = (0.2 + k * 0.22) * TRI_H;
        const x0 = y * 0.5 / TRI_H;
        return seg([x0, y], [(x0 + 1 - x0) / 2, y - 0.1 * TRI_H]);
      }),
      ...Array.from({ length: 3 }, (_, k) => {
        const y = (0.2 + k * 0.22) * TRI_H;
        const x1 = 1 - y * 0.5 / TRI_H;
        return seg([x1, y], [(x1 + y * 0.5 / TRI_H) / 2, y - 0.1 * TRI_H]);
      })
    ]
  },
  {
    id: 'sankaku', cell: 'triangle', family: 'scale', density: 0.58, fill: false,
    name: N('同心三角', 'Sankaku', '三角'), source: 'transcribed',
    ribs: [...ring(innerTri(0.7)), ...ring(innerTri(0.42)), ...ring(innerTri(0.2))]
  },
  {
    id: 'stripes', cell: 'triangle', family: 'stripe', density: 0.72, fill: false,
    name: N('条纹', 'Stripes', '縞'), source: 'transcribed',
    ribs: hLines(7, 0.1, 0.86)
  },
  {
    id: 'grid', cell: 'triangle', family: 'stripe', density: 0.8, fill: false,
    name: N('细格', 'Fine grid', '細格子'), source: 'transcribed',
    ribs: [...hLines(4, 0.16, 0.82), ...diagLines(4, 'left'), ...diagLines(4, 'right')]
  },
  {
    id: 'pierced', cell: 'triangle', family: 'stripe', density: 0.92, fill: false,
    name: N('密格', 'Pierced solid', '透かし詰め'), source: 'transcribed',
    ribs: [...hLines(6, 0.08, 0.9), ...diagLines(6, 'left'), ...diagLines(6, 'right')]
  },
  // Square grid patterns (canonical square 0..1)
  { id: 'sq_empty', cell: 'square', family: 'base', density: 0.03, fill: false, name: N('空白', 'Empty', '空白'), source: 'transcribed', ribs: [] },
  { id: 'sq_solid', cell: 'square', family: 'base', density: 1, fill: true, name: N('实心', 'Solid', '詰め'), source: 'transcribed', ribs: [] },
  { id: 'sq_cross', cell: 'square', family: 'grid', density: 0.32, fill: false, name: N('十字', 'Cross', '十字'), source: 'transcribed', ribs: [seg([0.5, 0], [0.5, 1]), seg([0, 0.5], [1, 0.5])] },
  { id: 'sq_grid', cell: 'square', family: 'grid', density: 0.62, fill: false, name: N('井字', 'Grid', '井桁'), source: 'transcribed', ribs: [seg([0.33, 0], [0.33, 1]), seg([0.66, 0], [0.66, 1]), seg([0, 0.33], [1, 0.33]), seg([0, 0.66], [1, 0.66])] },
  { id: 'sq_stripes', cell: 'square', family: 'stripe', density: 0.7, fill: false, name: N('条纹', 'Stripes', '縞'), source: 'transcribed', ribs: Array.from({ length: 5 }, (_, i) => seg([0, (i + 1) / 6], [1, (i + 1) / 6])) },
  { id: 'sq_diag', cell: 'square', family: 'stripe', density: 0.55, fill: false, name: N('斜线', 'Diagonal', '斜線'), source: 'transcribed', ribs: [seg([0, 0], [1, 1]), seg([0, 0.5], [0.5, 1]), seg([0.5, 0], [1, 0.5])] },
  { id: 'sq_kikko', cell: 'square', family: 'kikko', density: 0.5, fill: false, name: N('龟甲方', 'Kikkō square', '亀甲'), source: 'transcribed', ribs: [seg([0.2, 0.2], [0.8, 0.2]), seg([0.8, 0.2], [0.8, 0.8]), seg([0.8, 0.8], [0.2, 0.8]), seg([0.2, 0.8], [0.2, 0.2]), seg([0.5, 0], [0.5, 1])] },
  { id: 'sq_flower', cell: 'square', family: 'flower', density: 0.58, fill: false, name: N('花', 'Flower', '花'), source: 'transcribed', ribs: [seg([0.5, 0], [0.5, 1]), seg([0, 0.5], [1, 0.5]), seg([0.2, 0.2], [0.8, 0.8]), seg([0.8, 0.2], [0.2, 0.8])] }
];

export const PATTERN_MAP = Object.fromEntries(PATTERNS.map(p => [p.id, p]));

export function getPattern(id, customPatterns = []) {
  return customPatterns.find(p => p.id === id) || PATTERN_MAP[id] || PATTERN_MAP.asanoha;
}

export function patternName(p, lang = 'zh') {
  if (!p) return '';
  return p.name?.[lang] || p.name?.en || p.name?.zh || p.id;
}

function transformPoint(p, cell, rot, mirror) {
  let x = p[0], y = p[1];
  if (mirror) x = 1 - x;
  if (rot) {
    const ang = (cell === 'square' ? Math.PI / 2 : (Math.PI * 2 / 3)) * rot;
    const cx = 0.5, cy = cell === 'square' ? 0.5 : TRI_H / 3;
    const dx = x - cx, dy = y - cy;
    const c = Math.cos(ang), s = Math.sin(ang);
    x = cx + dx * c - dy * s;
    y = cy + dx * s + dy * c;
  }
  return [x, y];
}

export function patternRibs(pattern, rot = 0, mirror = false, cell = 'triangle') {
  if (!pattern) return [];
  return (pattern.ribs || []).map(([a, b]) => [
    transformPoint(a, cell, rot, mirror),
    transformPoint(b, cell, rot, mirror)
  ]);
}

export function patternDensity(pattern) {
  return pattern?.density ?? 0.5;
}

export function patternFamilies(patterns = PATTERNS) {
  const map = new Map();
  for (const p of patterns) {
    if (!map.has(p.family)) map.set(p.family, []);
    map.get(p.family).push(p);
  }
  return [...map.entries()];
}

export function patternBBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
