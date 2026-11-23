import React, { useMemo, useState } from 'react';
import { useLang } from '../data/i18n.js';
import { PATTERNS, TRI_H, patternName, patternRibs } from '../data/patterns.js';
import { colorOf } from '../data/model.js';

function Thumb({ pattern, color, kind, active }) {
  const tri = kind === 'square'
    ? [[0, 0], [1, 0], [1, 1], [0, 1]]
    : [[0, 0], [1, 0], [0.5, TRI_H]];
  const path = tri.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z';
  const ribs = patternRibs(pattern, 0, false, kind);
  return (
    <svg viewBox={kind === 'square' ? '-0.08 -0.08 1.16 1.16' : `-0.08 -0.08 1.16 ${TRI_H + 0.16}`}
      className="pattern-thumb" preserveAspectRatio="xMidYMid meet">
      <path d={path} fill={active ? '#F2E7D3' : '#F6F1E5'} stroke={active ? '#B4432F' : '#C9BFAE'} strokeWidth=".035" />
      {pattern.fill && <path d={path} fill={color} opacity=".45" />}
      <g stroke={active ? '#B4432F' : color} strokeWidth=".055" strokeLinecap="round" fill="none">
        {ribs.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}
      </g>
    </svg>
  );
}

export default function PatternShelf({
  project, brush, onPattern, onColor, onRib, onEdit
}) {
  const { t, lang } = useLang();
  const kind = project.grid.mode === 'square' ? 'square' : 'triangle';
  const [family, setFamily] = useState('all');
  const patterns = useMemo(() => {
    const list = [
      ...PATTERNS.filter(p => p.cell === kind),
      ...(project.customPatterns || []).filter(p => p.cell === kind)
    ];
    return family === 'all' ? list : list.filter(p => p.family === family);
  }, [kind, family, project.customPatterns]);
  const families = useMemo(() => {
    const set = new Set([...PATTERNS.filter(p => p.cell === kind), ...(project.customPatterns || []).filter(p => p.cell === kind)].map(p => p.family));
    return [...set];
  }, [kind, project.customPatterns]);
  const color = colorOf(project, brush.color).hex;
  const current = patterns.find(p => p.id === brush.patternId) || patterns[0];

  return (
    <div className="shelf">
      <div className="shelf-head">
        <span className="shelf-title">{t('shelf.patterns')}</span>
        <select className="shelf-family" value={family} onChange={e => setFamily(e.target.value)} aria-label={t('shelf.patterns')}>
          <option value="all">{t('shelf.all')}</option>
          {families.map(f => <option key={f} value={f}>{t('pattern.family.' + f)}</option>)}
        </select>
        <span className="shelf-current">
          {current ? patternName(current, lang) : t('shelf.empty')}
          {current && <i>{Math.round(current.density * 100)}%</i>}
        </span>
        <span className="shelf-spacer" />
        <button className="shelf-edit" disabled={!current} onClick={() => onEdit?.(current)}>{t('shelf.editPiece')}</button>
      </div>
      <div className="shelf-body">
        <div className="shelf-patterns">
          {patterns.map(p => (
            <button key={p.id}
              className={'shelf-item' + (brush.patternId === p.id ? ' on' : '')}
              onClick={() => onPattern(p.id)}
              title={`${patternName(p, 'zh')} / ${patternName(p, 'en')} / ${patternName(p, 'ja')}`}>
              <Thumb pattern={p} color={color} kind={kind} active={brush.patternId === p.id} />
              <span>{patternName(p, lang)}</span>
            </button>
          ))}
        </div>
        <div className="shelf-side">
          <div className="shelf-label">{t('shelf.colors')}</div>
          <div className="shelf-swatches">
            {project.printer.colors.map(c => (
              <button key={c.slot} className={'swatch' + (brush.color === c.slot ? ' on' : '')}
                style={{ background: c.hex }} title={c.name?.[lang] || c.name?.en || c.hex}
                onClick={() => onColor(c.slot)} />
            ))}
          </div>
          <div className="shelf-label">{t('shelf.adjust')} · {project.grid.rib.toFixed(1)}mm</div>
          <input type="range" min="1" max="5" step="0.1" value={project.grid.rib}
            onChange={e => onRib?.(+e.target.value)} className="shelf-range" />
        </div>
      </div>
    </div>
  );
}
