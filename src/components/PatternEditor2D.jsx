import React, { useRef, useState, useEffect } from 'react';
import { useLang } from '../data/i18n.js';
import { colorOf, cellPatternSegments, cellBorderSegments, pointInPoly } from '../data/model.js';

function polyPoints(poly) {
  return poly.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

export default function PatternEditor2D({
  project, layout, tool, selection, brush, zoom = 1,
  onSelection, onPaintCell, onStrokeStart, onStrokeEnd,
  onFramePolygon, onFrameCommit,
  underlay, showBlocks = true
}) {
  const { t, lang } = useLang();
  const svgRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  const painting = useRef(false);
  const selecting = useRef(false);
  const selectAdd = useRef(false);
  const dragFrame = useRef(null);
  const [hoverEdge, setHoverEdge] = useState(-1);

  const bb = layout.bbox;
  const pad = 26;
  const z = Math.max(0.4, Math.min(4, zoom || 1));
  const vw = bb.w + pad * 2 / z;
  const vh = bb.h + pad * 2 / z;
  const vx = bb.minX - pad / z;
  const vy = bb.minY - pad / z;

  const toSvg = (e) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  };

  useEffect(() => {
    const up = () => {
      painting.current = false;
      if (selecting.current) {
        selecting.current = false;
        setMarquee(null);
      }
      if (dragFrame.current) {
        dragFrame.current = null;
        onFrameCommit?.();
      }
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [onFrameCommit]);

  const cellDown = (e, cell) => {
    e.stopPropagation();
    const multi = e.shiftKey;
    if (e.button === 2) { onSelection?.(new Set()); return; }
    if (tool === 'brush') {
      e.preventDefault();
      onStrokeStart?.();
      painting.current = true;
      onPaintCell?.(cell);
      return;
    }
    if (tool === 'frame') return;
    // select tool
    if (e.altKey) {
      const next = new Set(selection);
      next.delete(cell.id);
      onSelection?.(next);
      return;
    }
    if (multi) {
      const next = new Set(selection);
      if (next.has(cell.id)) next.delete(cell.id); else next.add(cell.id);
      onSelection?.(next);
    } else {
      onSelection?.(new Set([cell.id]));
    }
    selecting.current = true;
    selectAdd.current = multi;
  };

  const cellEnter = (cell) => {
    if (painting.current && tool === 'brush') onPaintCell?.(cell);
    if (selecting.current && tool === 'select') {
      const next = new Set(selection);
      next.add(cell.id);
      onSelection?.(next);
    }
  };

  const bgDown = (e) => {
    if (e.button === 2) { onSelection?.(new Set()); return; }
    if (tool !== 'select') return;
    if (!e.shiftKey) onSelection?.(new Set());
    const p = toSvg(e);
    selecting.current = true;
    setMarquee({ x0: p[0], y0: p[1], x1: p[0], y1: p[1], add: e.shiftKey });
  };

  const bgMove = (e) => {
    if (!marquee) return;
    const p = toSvg(e);
    setMarquee(m => m ? { ...m, x1: p[0], y1: p[1] } : m);
  };

  const bgUp = () => {
    if (!marquee) return;
    const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1);
    const y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
    if (x1 - x0 > 2 && y1 - y0 > 2) {
      const next = new Set(marquee.add ? selection : []);
      for (const c of layout.cells) {
        const [cx, cy] = c.centroid;
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) next.add(c.id);
      }
      onSelection?.(next);
    }
    setMarquee(null);
    selecting.current = false;
  };

  const vertexDown = (e, i) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (e.altKey) {
      if (layout.outer.length > 3) {
        onStrokeStart?.();
        const poly = layout.outer.filter((_, k) => k !== i);
        onFramePolygon?.(poly, false);
        onFrameCommit?.();
      }
      return;
    }
    const p = toSvg(e);
    dragFrame.current = { i, poly: layout.outer.map(q => [...q]) };
    onStrokeStart?.();
  };

  const vertexMove = (e) => {
    if (!dragFrame.current) return;
    const p = toSvg(e);
    const poly = dragFrame.current.poly.map((q, k) => k === dragFrame.current.i ? [p[0], p[1]] : q);
    dragFrame.current.poly = poly;
    onFramePolygon?.(poly, false);
  };

  const edgeDown = (e, i) => {
    e.stopPropagation();
    if (tool !== 'frame' || e.button !== 0) return;
    const p = toSvg(e);
    const a = layout.outer[i], b = layout.outer[(i + 1) % layout.outer.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
    t = Math.max(0.08, Math.min(0.92, t));
    const q = [a[0] + dx * t, a[1] + dy * t];
    const poly = [...layout.outer];
    poly.splice(i + 1, 0, q);
    onStrokeStart?.();
    onFramePolygon?.(poly, false);
    onFrameCommit?.();
  };

  const cellFill = (cell) => {
    const col = colorOf(project, cell.color).hex;
    const a = cell.assignment;
    if (selection.has(cell.id)) return '#B4432F';
    if (a.layer === 'empty') return '#F1E9D8';
    return col;
  };

  return (
    <svg
      ref={svgRef}
      className={'pattern-svg tool-' + tool}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={(e) => { bgMove(e); vertexMove(e); }}
      onPointerUp={bgUp}
      onContextMenu={(e) => { e.preventDefault(); onSelection?.(new Set()); }}
    >
      <rect x={vx} y={vy} width={vw} height={vh} fill="transparent" onPointerDown={bgDown} />
      <rect x={bb.minX} y={bb.minY} width={bb.w} height={bb.h} fill="#F1E9D8" stroke="none" />
      {underlay?.dataURL && (
        <image href={underlay.dataURL} x={bb.minX} y={bb.minY} width={bb.w} height={bb.h}
          preserveAspectRatio="xMidYMid slice" opacity={underlay.opacity ?? 0.4} />
      )}
      <path d={layout.inner ? layout.inner.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z' : ''}
        fill="#F6F4EF" stroke="none" />
      <g>
        {layout.cells.map(cell => {
          const sel = selection.has(cell.id);
          const col = colorOf(project, cell.color).hex;
          const a = cell.assignment;
          return (
            <g key={cell.id}
              onPointerDown={e => cellDown(e, cell)}
              onPointerEnter={() => cellEnter(cell)}
              style={{ cursor: tool === 'brush' ? 'crosshair' : tool === 'frame' ? 'default' : 'pointer' }}>
              <polygon points={polyPoints(cell.poly)}
                fill={sel ? 'rgba(180,67,47,.12)' : (a.layer === 'empty' ? '#F1E9D8' : col)}
                fillOpacity={sel ? 1 : (a.layer === 'empty' ? 0.35 : 0.24)}
                stroke={sel ? '#B4432F' : 'rgba(90,74,50,.30)'}
                strokeWidth={sel ? 0.9 : 0.35} />
              {a.layer !== 'empty' && cell.pattern && (
                <g stroke={sel ? '#B4432F' : col} strokeWidth={Math.max(0.55, project.grid.rib * 0.7)} strokeLinecap="round" fill="none">
                  {cellPatternSegments(project, cell).map(([p, q], i) => (
                    <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />
                  ))}
                </g>
              )}
              {a.layer !== 'empty' && cell.pattern?.fill && (
                <polygon points={polyPoints(cell.poly)} fill={col} fillOpacity=".35" stroke="none" pointerEvents="none" />
              )}
            </g>
          );
        })}
      </g>
      <path d={layout.outer.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z'}
        fill="none" stroke="#1B1A17" strokeWidth=".9" pointerEvents="none" />
      {layout.inner && (
        <path d={layout.inner.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z'}
          fill="none" stroke="#1B1A17" strokeWidth=".5" opacity=".65" pointerEvents="none" />
      )}
      {showBlocks && layout.blocks.map(b => (
        <g key={b.index} pointerEvents="none">
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#9A9489" strokeWidth=".35" strokeDasharray="3 3" />
          <text x={b.x + 2} y={b.y + 5} fontSize="3.4" fill="#77726A" fontFamily="PingFang SC, sans-serif">B{b.index + 1}</text>
        </g>
      ))}
      {tool === 'frame' && layout.outer.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={Math.max(1.6, 3 / z)} fill="#F6F4EF" stroke="#B4432F" strokeWidth=".6"
            style={{ cursor: 'move' }} onPointerDown={e => vertexDown(e, i)} />
        </g>
      ))}
      {tool === 'frame' && layout.outer.map((a, i) => {
        const b = layout.outer[(i + 1) % layout.outer.length];
        return (
          <line key={'e' + i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={hoverEdge === i ? '#B4432F' : 'transparent'} strokeWidth={Math.max(2, 6 / z)}
            style={{ cursor: 'copy' }}
            onPointerEnter={() => setHoverEdge(i)}
            onPointerLeave={() => setHoverEdge(-1)}
            onPointerDown={e => edgeDown(e, i)} />
        );
      })}
      {marquee && (
        <rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)}
          width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)}
          fill="rgba(180,67,47,.06)" stroke="#B4432F" strokeDasharray="3 2" strokeWidth=".4" pointerEvents="none" />
      )}
    </svg>
  );
}
