export const TERM_GROUPS = ['structure', 'pattern', 'print', 'assembly'];

export const TERMS = [
  { id: 'kumiko', group: 'structure', zh: '组子', ja: '組子（くみこ）', en: 'kumiko', def: '不用钉子与胶，靠细木片开槽咬合拼出几何图案的木工技法。', defEn: 'Wood lattice assembled without nails or glue by notching thin strips.' },
  { id: 'jigumi', group: 'structure', zh: '基础网格', ja: '地組（じぐみ）', en: 'jigumi', def: '通长棂条构成的基础格栅，图案装在它里面。', defEn: 'The base lattice of continuous strips into which the pattern is set.' },
  { id: 'pitch', group: 'structure', zh: '格距', ja: 'ピッチ', en: 'pitch', def: '相邻棂条中心距；三角网格中为三角边长。', defEn: 'Centre-to-centre distance between strips; the triangle side in a triangular grid.' },
  { id: 'rib', group: 'structure', zh: '肋厚', ja: '見付（みつけ）', en: 'rib width', def: '从正面看到的棂条宽度。', defEn: 'Visible width of a strip from the front.' },
  { id: 'depth', group: 'structure', zh: '框深', ja: '見込（みこみ）', en: 'depth', def: '棂条前后方向的深度。', defEn: 'Front-to-back depth of a strip.' },
  { id: 'border', group: 'structure', zh: '边框宽', ja: '—', en: 'border', def: '外框料从外沿到内沿的宽度。', defEn: 'Width of the outer frame from its outside edge to its inside edge.' },
  { id: 'subpanel', group: 'structure', zh: '子板', ja: '—', en: 'subpanel', def: '可独立打印的结构块，横向用燕尾互扣。', defEn: 'A structural block that can be printed separately and joined with dovetails.' },
  { id: 'dovetail', group: 'structure', zh: '燕尾', ja: '蟻継ぎ（ありつぎ）', en: 'dovetail', def: '梯形榫头，子板横向互扣。', defEn: 'A trapezoidal tenon that locks subpanels side by side.' },
  { id: 'insert', group: 'structure', zh: '嵌片', ja: '—', en: 'insert', def: '装在一个三角/方格内的图案件；本版一嵌片一色。', defEn: 'A patterned piece fitted into one triangular/square cell; one colour per insert in this version.' },
  { id: 'background', group: 'structure', zh: '背景片', ja: '—', en: 'background insert', def: '嵌片背后的薄片，背光时用半透料。', defEn: 'A thin sheet behind the inserts, translucent when backlit.' },
  { id: 'profile', group: 'structure', zh: '兼容档', ja: '—', en: 'compatibility profile', def: '接口尺寸参数集，决定件能否互换。', defEn: 'A set of interface dimensions that determines whether parts are interchangeable.' },
  { id: 'hanger', group: 'structure', zh: '挂件', ja: '—', en: 'hanger', def: '与墙面挂条咬合的件。', defEn: 'A part that engages the wall cleat.' },
  { id: 'frame', group: 'structure', zh: '外框', ja: '—', en: 'frame', def: '面板最外圈的边框；本版支持矩形、三角、菱形、六角与自定义多边形。', defEn: 'The outer border; this version supports rectangle, triangle, diamond, hexagon and custom polygons.' },
  { id: 'miter', group: 'assembly', zh: '斜接', ja: '留め継ぎ（とめつぎ）', en: 'miter', def: '两根边框料在角部按角平分线拼接。', defEn: 'A corner joint cut along the angle bisector.' },
  { id: 'printBlock', group: 'print', zh: '打印块', ja: '—', en: 'print block', def: '按打印机可打尺寸切出的可单独排板/打印的块。', defEn: 'A block split to fit the printer build volume and printed separately.' },
  { id: 'allowedColors', group: 'print', zh: '可打颜色', ja: '—', en: 'allowed colors', def: '打印机当前可用的耗材颜色集合；图案与手动上色只从这里取。', defEn: 'The filament colours currently available on the printer.' },
  { id: 'buildVolume', group: 'print', zh: '可打尺寸', ja: '—', en: 'build volume', def: '打印机 X/Y/Z 最大成型尺寸；分块不得超出。', defEn: 'Maximum printer X/Y/Z envelope; no single part may exceed it.' },
  { id: 'density', group: 'pattern', zh: '图案密度', ja: '—', en: 'pattern density', def: '一个图案片在格内的视觉覆盖率；图片转换按明暗匹配密度。', defEn: 'Visual coverage of a pattern piece inside its cell; image conversion matches brightness to density.' },
  { id: 'patternPiece', group: 'pattern', zh: '图案片', ja: '—', en: 'pattern piece', def: '一个三角/方格内的归一化图案几何；可旋转 0/120/240°、镜像。', defEn: 'Normalised pattern geometry inside one triangle/square cell; rotatable 0/120/240° and mirrorable.' },
  { id: 'asanoha', group: 'pattern', zh: '麻叶', ja: '麻の葉（あさのは）', en: 'asanoha', def: '六角基底上的放射三角，最经典的组子母题。', defEn: 'The hemp-leaf motif: radiating triangles on a hexagonal base.' },
  { id: 'goma', group: 'pattern', zh: '胡麻', ja: '胡麻（ごま）', en: 'goma', def: '三角格内成组的平行线。', defEn: 'Groups of parallel lines inside a triangular cell.' },
  { id: 'kikko', group: 'pattern', zh: '龟甲', ja: '亀甲（きっこう）', en: 'kikkō', def: '六边形套六边形。', defEn: 'Tortoise-shell hexagons nested in hexagons.' },
  { id: 'sakura', group: 'pattern', zh: '樱龟甲', ja: '桜亀甲', en: 'sakura kikkō', def: '龟甲内的樱花状放射纹。', defEn: 'A cherry-blossom-like radial motif inside a tortoise-shell cell.' },
  { id: 'kazaguruma', group: 'pattern', zh: '风车', ja: '風車（かざぐるま）', en: 'kaza-guruma', def: '三向风车状图案片。', defEn: 'A three-way pinwheel pattern piece.' },
  { id: 'layer', group: 'print', zh: '层高', ja: '—', en: 'layer height', def: '每层厚度；默认 0.2mm，背景片 0.1mm。', defEn: 'Printed layer thickness; 0.2 mm by default, 0.1 mm for background sheets.' },
  { id: 'infill', group: 'print', zh: '填充率', ja: '—', en: 'infill density', def: '内部填充比例；子板 30%、边框 10%。', defEn: 'Internal infill percentage; 30% for subpanels, 10% for borders.' },
  { id: 'coupon', group: 'print', zh: '试片', ja: '—', en: 'test coupon', def: '正式打印前验证配合的小件。', defEn: 'A small test part printed to verify fit before the real print.' },
  { id: 'seam', group: 'assembly', zh: '拼缝', ja: '—', en: 'seam', def: '两块子板相接处的缝。', defEn: 'The joint between two subpanels.' },
  { id: 'groove', group: 'assembly', zh: '凹槽', ja: '—', en: 'groove', def: '为盖片预留的浅槽。', defEn: 'A shallow slot reserved for a seam cover.' },
  { id: 'cleat', group: 'assembly', zh: '挂条', ja: '—', en: 'cleat', def: '墙上的横条，与挂件齿咬合。', defEn: 'A horizontal wall strip that engages the hanger teeth.' },
  { id: 'underlay', group: 'pattern', zh: '底图', ja: '—', en: 'underlay', def: '图片转换时垫在 2D 画布下的原图，仅本机处理。', defEn: 'The source image shown under the 2D canvas during image conversion; processed locally only.' },
  { id: 'lowConfidence', group: 'pattern', zh: '低置信格', ja: '—', en: 'low-confidence cell', def: '自动转换时匹配得分低的格，建议手动检查。', defEn: 'A cell whose automatic image match scored poorly and should be checked manually.' }
];

export const PARAMS = {
  openingWidth: { zh: '洞口宽', ja: '—', en: 'Opening width', unit: 'mm', def: '墙面洞口宽度；实际尺寸由格距与边框向下取整。', up: '可用格数增加', down: '可用格数减少', defEn: 'Wall opening width; actual size is rounded down by pitch and border.', upEn: 'More usable cells', downEn: 'Fewer usable cells' },
  openingHeight: { zh: '洞口高', ja: '—', en: 'Opening height', unit: 'mm', def: '墙面洞口高度；实际尺寸由行高向下取整。', up: '行数增加', down: '行数减少', defEn: 'Wall opening height; actual size is rounded down by row height.', upEn: 'More rows', downEn: 'Fewer rows' },
  edge: { zh: '边数', ja: '—', en: 'Edge count', unit: '格', def: '三角格外沿的格数；影响网格密度与分块。', up: '格更密/件数增加', down: '格更疏/件数减少', defEn: 'Number of cells along a triangular edge; affects density and block count.', upEn: 'Denser grid / more parts', downEn: 'Sparser grid / fewer parts' },
  frameWidth: { zh: '边框宽', ja: '—', en: 'Frame width', unit: 'mm', def: '外框料从外沿到内沿的宽度；需 ≥2×图案肋宽。', up: '更稳，可用格减少', down: '可用格增加，角部变弱', defEn: 'Frame width from outside to inside; must be ≥ 2× the pattern rib.', upEn: 'Stronger, fewer usable cells', downEn: 'More usable cells, weaker corners' },
  pitch: { zh: '格距', ja: 'ピッチ', en: 'Pitch', unit: 'mm', def: '三角边长/相邻格中心距；图案片随之缩放。', up: '格更疏，件数下降', down: '格更密，图案细节增加', defEn: 'Triangle side / centre distance; pattern pieces scale with it.', upEn: 'Sparser grid, fewer parts', downEn: 'Denser grid, more detail' },
  rib: { zh: '图案肋宽', ja: '—', en: 'Pattern rib', unit: 'mm', def: '图案片内肋条宽度；只影响图案片，不改外框。', up: '更结实，透光减少', down: '更轻，易断', defEn: 'Rib width inside a pattern piece; affects the insert only, not the frame.', upEn: 'Stronger, less light', downEn: 'Lighter, more fragile' },
  bedX: { zh: '床宽 X', ja: '—', en: 'Bed X', unit: 'mm', def: '打印机可打宽度；分块不得超过。', up: '可放更大块', down: '分块更多', defEn: 'Printable width; blocks must not exceed it.', upEn: 'Larger blocks allowed', downEn: 'More blocks' },
  bedY: { zh: '床深 Y', ja: '—', en: 'Bed Y', unit: 'mm', def: '打印机可打深度；分块不得超过。', up: '可放更大块', down: '分块更多', defEn: 'Printable depth; blocks must not exceed it.', upEn: 'Larger blocks allowed', downEn: 'More blocks' },
  bedZ: { zh: '床高 Z', ja: '—', en: 'Bed Z', unit: 'mm', def: '打印机可打高度；嵌片/边框厚度不得超过。', up: '可打更厚件', down: '厚度受限', defEn: 'Printable height; insert/frame thickness must not exceed it.', upEn: 'Thicker parts allowed', downEn: 'Thickness limited' },
  colors: { zh: '可打颜色', ja: '—', en: 'Allowed colors', unit: '槽', def: '打印机可用耗材颜色；图案与手动上色只从这里取。', up: '颜色更丰富', down: '颜色更少，自动合并到最近色', defEn: 'Filament colours available on the printer; generated and manual patterns use only these.', upEn: 'Richer colours', downEn: 'Fewer colours, nearest match' }
};

export const DEFAULT_PROFILE = {
  id: 'paperview-v1',
  label: 'Paper View · v1（待标定）',
  labelEn: 'Paper View · v1 (uncalibrated)',
  source: 'transcribed',
  calibrated: false,
  revision: 1,
  notes: '接口尺寸为转录占位值；完成实物对接与截面比对后再启用兼容件。',
  subpanel: { w: 286, h: 358, thickness: 4 },
  dovetail: { angle: 60, rootW: 8, tipW: 5, depth: 3, clearance: 0.2 },
  cell: { inset: 1.2, cornerRadius: 0.8 },
  seam: { slotDepth: 0.8, width: 3, length: 280 },
  border: { width: 12, depth: 12, hiddenDovetail: true },
  hanger: { pitch: 40, thickness: 4, teeth: 6 },
  insert: { thickness: 2, clearance: 0.25 },
  fit: {
    subpanel: { fit: 'fit', gap: 0.2 },
    dovetail: { fit: 'fit', gap: 0.2 },
    cell: { fit: 'fit', gap: 0.2 },
    seam: { fit: 'fit', gap: 0.2 }
  }
};

export function checkProfile(p) {
  const e = [];
  if (!p) return ['Missing profile'];
  if (p.dovetail.clearance >= p.dovetail.depth) e.push('Dovetail clearance must be less than depth / 燕尾间隙必须小于榫深');
  if (p.border.width < 2 * p.insert.thickness) e.push('Border width must be ≥ 2× insert thickness / 边框宽需 ≥2×嵌片厚');
  if (p.seam.width <= 0) e.push('Seam slot width must be > 0 / 盖片槽宽必须大于 0');
  if (p.subpanel.thickness <= 0) e.push('Subpanel thickness must be > 0 / 子板厚必须大于 0');
  return e;
}
