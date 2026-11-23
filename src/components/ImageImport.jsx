import React, { useRef, useState } from 'react';
import { useLang } from '../data/i18n.js';
import { PATTERNS, patternName } from '../data/patterns.js';
import { readImageFile, convertImage } from '../data/image.js';

export default function ImageImport({ project, layout, onApply, onPitch, onClose }) {
  const { t, lang } = useLang();
  const [imgData, setImgData] = useState(null);
  const [family, setFamily] = useState('all');
  const [underlayOpacity, setUnderlayOpacity] = useState(0.4);
  const [autoContrast, setAutoContrast] = useState(true);
  const [overwrite, setOverwrite] = useState(true);
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pitch, setPitch] = useState(project.grid.pitch);
  const fileRef = useRef(null);

  const kind = project.grid.mode === 'square' ? 'square' : 'triangle';
  const all = [...PATTERNS.filter(p => p.cell === kind), ...(project.customPatterns || []).filter(p => p.cell === kind)];
  const families = [...new Set(all.map(p => p.family))];
  const patternIds = family === 'all' ? null : all.filter(p => p.family === family).map(p => p.id);

  const pick = async file => {
    if (!file) return;
    setError('');
    try {
      const r = await readImageFile(file);
      setImgData(r);
      setResult(null);
    } catch {
      setError(t('image.error'));
    }
  };

  const run = async () => {
    if (!imgData?.img) { setError(t('image.noImage')); return; }
    setError('');
    setProgress(0);
    setResult(null);
    try {
      const out = await convertImage(imgData.img, project, layout, {
        autoContrast, overwrite, patternIds
      }, p => setProgress(p));
      setResult(out);
      setProgress(100);
    } catch (e) {
      setError(t('image.error'));
      setProgress(-1);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result.paint, { dataURL: imgData.dataURL, opacity: underlayOpacity });
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet wide image-modal">
        <div className="modal-head">
          <div><h2>{t('image.title')}</h2><div className="modal-sub">{t('image.note')}</div></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <div className="image-grid">
            <div className="image-left">
              <button className="image-drop" onClick={() => fileRef.current?.click()}>
                {imgData
                  ? <img src={imgData.dataURL} alt="" />
                  : <><div className="drop-plus">+</div><div>{t('image.drop')}</div><div className="hint">{t('image.formats')}</div></>}
              </button>
              <input ref={fileRef} type="file" accept="image/*,.svg" hidden onChange={e => pick(e.target.files?.[0])} />
              <div className="range-row">
                <span className="label">{t('image.underlay')}</span>
                <input type="range" min="0" max="1" step="0.05" value={underlayOpacity} onChange={e => setUnderlayOpacity(+e.target.value)} />
                <span className="val">{Math.round(underlayOpacity * 100)}%</span>
              </div>
            </div>
            <div className="image-right">
              <label className="field">
                <span className="label">{t('image.cellSize')}</span>
                <span className="val">
                  <input type="number" min="15" max="120" value={pitch}
                    onChange={e => setPitch(+e.target.value || 50)}
                    onBlur={() => onPitch?.(Math.max(15, Math.min(120, pitch)))}
                    onKeyDown={e => { if (e.key === 'Enter') onPitch?.(Math.max(15, Math.min(120, pitch))); }} />
                  <span className="unit">mm</span>
                </span>
              </label>
              <label className="field">
                <span className="label">{t('image.allowedPatterns')}</span>
                <span className="val">
                  <select value={family} onChange={e => setFamily(e.target.value)}>
                    <option value="all">{t('shelf.all')}</option>
                    {families.map(f => <option key={f} value={f}>{t('pattern.family.' + f)}</option>)}
                  </select>
                </span>
              </label>
              <label className="field">
                <span className="label">{t('image.allowedColors')}</span>
                <span className="val"><span className="hint">{t('left.printerColors', { n: project.printer.colors.length })}</span></span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={autoContrast} onChange={e => setAutoContrast(e.target.checked)} />
                <span>{t('image.autoContrast')}</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                <span>{overwrite ? t('image.overwrite') : t('image.keep')}</span>
              </label>
              <div className="hint">{t('image.estimate', { n: layout.cells.length, t: '≈2s' })}</div>
              {progress >= 0 && progress < 100 && (
                <div className="progress"><div style={{ width: progress + '%' }} /></div>
              )}
              {result && (
                <div className="issue ok">{t('image.estimate', { n: result.count, t: '✓' })} · {t('image.lowConfidence', { n: result.low })}</div>
              )}
              {error && <div className="issue error">{error}</div>}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={run} disabled={!imgData || (progress >= 0 && progress < 100)}>{t('image.preview')}</button>
            <button className="btn solid" onClick={apply} disabled={!result}>{t('image.apply')}</button>
            <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
