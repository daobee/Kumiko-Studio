import React, { useRef, useState } from 'react';
import { useLang } from '../data/i18n.js';
import { TERMS, TERM_GROUPS, PARAMS, DEFAULT_PROFILE, checkProfile } from '../data/terms.js';
import { layoutOf, normalizeProject } from '../data/model.js';
import { patternName, TRI_H, patternRibs } from '../data/patterns.js';

function Modal({ title, sub, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal-sheet' + (wide ? ' wide' : '')}>
        <div className="modal-head">
          <div><h2>{title}</h2>{sub && <div className="modal-sub">{sub}</div>}</div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PrinterModal({ printer, onSave, onClose }) {
  const { t, lang } = useLang();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(printer)));
  const setBed = (k, v) => setP(x => ({ ...x, bed: { ...x.bed, [k]: v } }));
  const setColor = (i, k, v) => setP(x => {
    const colors = x.colors.map((c, j) => j === i ? { ...c, [k]: v } : c);
    return { ...x, colors };
  });
  const setName = (i, v) => setP(x => {
    const colors = x.colors.map((c, j) => j === i ? { ...c, name: { ...(c.name || {}), [lang]: v } } : c);
    return { ...x, colors };
  });
  const addColor = () => setP(x => {
    const slot = Math.max(-1, ...x.colors.map(c => c.slot)) + 1;
    return { ...x, colors: [...x.colors, { slot, name: { zh: `颜色 ${slot}`, en: `Color ${slot}` }, hex: '#C9A26D' }] };
  });
  const removeColor = i => setP(x => x.colors.length > 1 ? { ...x, colors: x.colors.filter((_, j) => j !== i) } : x);
  return (
    <Modal title={t('printer.title')} sub={t('printer.hint')} onClose={onClose} wide>
      <div className="form-grid">
        <div className="form-section">
          <h4>{t('printer.bed')}</h4>
          <div className="form-row3">
            {['x', 'y', 'z'].map(k => (
              <label className="field" key={k}>
                <span className="label">{t('printer.' + k)}</span>
                <span className="val"><input type="number" min="40" value={p.bed[k]} onChange={e => setBed(k, +e.target.value || 0)} /><span className="unit">mm</span></span>
              </label>
            ))}
          </div>
          <div className="form-row3">
            <label className="field"><span className="label">{t('printer.margin')}</span><span className="val"><input type="number" min="0" value={p.margin} onChange={e => setP(x => ({ ...x, margin: +e.target.value || 0 }))} /><span className="unit">mm</span></span></label>
            <label className="field"><span className="label">{t('printer.nozzle')}</span><span className="val"><input type="number" step="0.1" value={p.nozzle} onChange={e => setP(x => ({ ...x, nozzle: +e.target.value || 0 }))} /><span className="unit">mm</span></span></label>
          </div>
        </div>
        <div className="form-section">
          <h4>{t('printer.colors')}</h4>
          <div className="color-table">
            {p.colors.map((c, i) => (
              <div className="color-row" key={c.slot}>
                <span className="color-slot">{c.slot}</span>
                <input className="color-name" value={c.name?.[lang] || c.name?.en || ''} placeholder={t('printer.namePlaceholder')}
                  onChange={e => setName(i, e.target.value)} />
                <input type="color" value={c.hex} onChange={e => setColor(i, 'hex', e.target.value)} className="color-pick" />
                <button className="linkish" onClick={() => removeColor(i)} disabled={p.colors.length <= 1}>{t('printer.remove')}</button>
              </div>
            ))}
          </div>
          <button className="btn small" onClick={addColor}>{t('printer.add')}</button>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn solid" onClick={() => onSave(p)}>{t('printer.save')}</button>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

export function ProfileModal({ profile, onSave, onClose }) {
  const { t, lang } = useLang();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(profile || DEFAULT_PROFILE)));
  const errs = checkProfile(p);
  const set = (sec, key, v) => setP(x => ({ ...x, [sec]: { ...x[sec], [key]: v } }));
  const setFit = (k, key, v) => setP(x => ({ ...x, fit: { ...x.fit, [k]: { ...(x.fit[k] || {}), [key]: v } } }));
  const allFit = ['subpanel', 'dovetail', 'cell', 'seam'].every(k => (p.fit?.[k]?.fit || 'fit') === 'fit');
  const Num = ({ label, value, onChange, unit = 'mm', step = 0.1 }) => (
    <label className="field">
      <span className="label">{label}</span>
      <span className="val"><input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} /><span className="unit">{unit}</span></span>
    </label>
  );
  return (
    <Modal title={t('profile.title')} sub={t('profile.hint')} onClose={onClose} wide>
      <div className="profile-grid">
        <div>
          <h4>{t('profile.subpanel')}</h4>
          <Num label={t('profile.width')} value={p.subpanel.w} onChange={v => set('subpanel', 'w', v)} />
          <Num label={t('profile.height')} value={p.subpanel.h} onChange={v => set('subpanel', 'h', v)} />
          <Num label={t('profile.thickness')} value={p.subpanel.thickness} onChange={v => set('subpanel', 'thickness', v)} />
          <h4>{t('profile.dovetail')}</h4>
          <Num label={t('profile.angle')} value={p.dovetail.angle} onChange={v => set('dovetail', 'angle', v)} unit="°" step={1} />
          <Num label={t('profile.root')} value={p.dovetail.rootW} onChange={v => set('dovetail', 'rootW', v)} />
          <Num label={t('profile.tip')} value={p.dovetail.tipW} onChange={v => set('dovetail', 'tipW', v)} />
          <Num label={t('profile.depth')} value={p.dovetail.depth} onChange={v => set('dovetail', 'depth', v)} />
          <Num label={t('profile.clearance')} value={p.dovetail.clearance} onChange={v => set('dovetail', 'clearance', v)} step={0.05} />
          <h4>{t('profile.cell')}</h4>
          <Num label={t('profile.inset')} value={p.cell.inset} onChange={v => set('cell', 'inset', v)} />
          <Num label={t('profile.corner')} value={p.cell.cornerRadius} onChange={v => set('cell', 'cornerRadius', v)} />
        </div>
        <div>
          <h4>{t('profile.border')}</h4>
          <Num label={t('profile.width')} value={p.border.width} onChange={v => set('border', 'width', v)} />
          <Num label={t('profile.depth')} value={p.border.depth} onChange={v => set('border', 'depth', v)} />
          <h4>{t('profile.insert')}</h4>
          <Num label={t('profile.thickness')} value={p.insert.thickness} onChange={v => set('insert', 'thickness', v)} />
          <Num label={t('profile.clearance')} value={p.insert.clearance} onChange={v => set('insert', 'clearance', v)} step={0.05} />
          <h4>{t('profile.seam')}</h4>
          <Num label={t('profile.slotDepth')} value={p.seam.slotDepth} onChange={v => set('seam', 'slotDepth', v)} />
          <Num label={t('profile.slotWidth')} value={p.seam.width} onChange={v => set('seam', 'width', v)} />
          <h4>{t('profile.hanger')}</h4>
          <Num label={t('profile.pitch')} value={p.hanger.pitch} onChange={v => set('hanger', 'pitch', v)} />
          <Num label={t('profile.teeth')} value={p.hanger.teeth} onChange={v => set('hanger', 'teeth', v)} unit="" step={1} />
          <h4>{t('profile.fit')}</h4>
          {['subpanel', 'dovetail', 'cell', 'seam'].map(k => (
            <div className="field" key={k}>
              <span className="label">{t('profile.' + (k === 'seam' ? 'seam' : k))}</span>
              <span className="val">
                <select value={p.fit?.[k]?.fit || 'fit'} onChange={e => setFit(k, 'fit', e.target.value)}>
                  <option value="loose">{t('profile.loose')}</option>
                  <option value="fit">{t('profile.fitOk')}</option>
                  <option value="tight">{t('profile.tight')}</option>
                </select>
                <input type="number" step="0.05" value={p.fit?.[k]?.gap ?? 0.2} onChange={e => setFit(k, 'gap', parseFloat(e.target.value) || 0)} />
                <span className="unit">mm</span>
              </span>
            </div>
          ))}
          <label className="check-row">
            <input type="checkbox" checked={!!p.calibrated}
              onChange={e => {
                if (e.target.checked && !allFit) return;
                setP(x => ({ ...x, calibrated: e.target.checked }));
              }} />
            <span>{t('profile.calibrated')}</span>
          </label>
          {!p.calibrated && <div className="hint warn">{t('profile.uncalibrated')}</div>}
        </div>
      </div>
      {errs.length > 0 && <div className="issues">{errs.map((e, i) => <div className="issue error" key={i}>{e}</div>)}</div>}
      <div className="modal-actions">
        <button className="btn solid" onClick={() => onSave({ ...p, revision: (profile?.revision || 0) + 1 })}>{t('profile.save')}</button>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

export function TermsModal({ onClose }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const list = s ? TERMS.filter(x => x.zh.includes(s) || x.ja.includes(s) || x.en.toLowerCase().includes(s) || x.def.includes(s)) : TERMS;
  return (
    <Modal title={t('terms.title')} sub={t('terms.subtitle')} onClose={onClose} wide>
      <div className="terms-search">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('terms.search')} />
        <span>{list.length}</span>
      </div>
      <div className="terms-groups">
        {TERM_GROUPS.map(g => {
          const rows = list.filter(x => x.group === g);
          if (!rows.length) return null;
          return (
            <section key={g}>
              <h4>{t('terms.' + g)}</h4>
              {rows.map(x => (
                <div className="term-row" key={x.id}>
                  <div className="term-zh">{x.zh}</div>
                  <div className="term-ja">{x.ja}</div>
                  <div className="term-en">{x.en}</div>
                  <div className="term-def">{lang === 'en' ? (x.defEn || x.def) : x.def}</div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

export function PatternPieceModal({ pattern, color, onSave, onClose }) {
  const { t, lang } = useLang();
  const [keep, setKeep] = useState(() => (pattern?.ribs || []).map(() => true));
  const ribs = pattern?.ribs || [];
  const tri = pattern?.cell === 'square' ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [1, 0], [0.5, TRI_H]];
  const path = tri.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') + 'Z';
  const save = () => {
    const kept = ribs.filter((_, i) => keep[i]);
    if (!kept.length) return;
    const id = 'custom-' + Date.now().toString(36);
    onSave({
      id, cell: pattern.cell, family: pattern.family,
      density: Math.max(0.05, pattern.density * kept.length / Math.max(1, ribs.length)),
      fill: false, ribs: kept, source: 'original',
      name: { zh: `自绘 ${patternName(pattern, 'zh')}`, en: `Custom ${patternName(pattern, 'en')}`, ja: '自作' }
    });
  };
  return (
    <Modal title={t('pattern.editTitle')} sub={t('pattern.editHint')} onClose={onClose}>
      <div className="piece-edit">
        <svg viewBox={pattern?.cell === 'square' ? '-0.1 -0.1 1.2 1.2' : `-0.1 -0.1 1.2 ${TRI_H + 0.2}`} className="piece-preview">
          <path d={path} fill="#F6F1E5" stroke="#1B1A17" strokeWidth=".02" />
          <g stroke={color} strokeWidth=".04" strokeLinecap="round" fill="none">
            {ribs.map(([a, b], i) => keep[i] ? <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /> : null)}
          </g>
        </svg>
        <div className="piece-ribs">
          <div className="hint">{t('pattern.ribs')} · {ribs.length}</div>
          {ribs.map((_, i) => (
            <label key={i} className="check-row">
              <input type="checkbox" checked={!!keep[i]} onChange={e => setKeep(k => k.map((v, j) => j === i ? e.target.checked : v))} />
              <span>#{i + 1}</span>
            </label>
          ))}
          {!ribs.length && <div className="hint">{t('shelf.empty')}</div>}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn solid" onClick={save} disabled={!pattern || ribs.length === 0}>{t('pattern.applyPiece')}</button>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

export function ProjectLibraryModal({
  projects, currentId, onOpen, onNew, onDuplicate, onRename, onDelete,
  onRestore, onHardDelete, onImportProject, onExportCurrent, onBackup,
  onImportBackup, onClose
}) {
  const { t } = useLang();
  const [renaming, setRenaming] = useState(null);
  const [name, setName] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const fileRef = useRef(null);
  const backupRef = useRef(null);
  const active = projects.filter(p => !p.deletedAt);
  const trash = projects.filter(p => p.deletedAt);
  const list = showTrash ? trash : active;
  const read = (f, cb) => {
    const r = new FileReader();
    r.onload = () => { try { cb(JSON.parse(String(r.result))); } catch { cb(null); } };
    r.readAsText(f);
  };
  return (
    <Modal title={t('project.title')} sub={t('project.subtitle')} onClose={onClose} wide>
      <div className="modal-actions top">
        <button className="btn solid" onClick={onNew}>{t('app.newProject')}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>{t('project.import')}</button>
        <button className="btn" onClick={onExportCurrent}>{t('project.export')}</button>
        <button className="btn" onClick={onBackup}>{t('project.backup')}</button>
        <button className="btn" onClick={() => backupRef.current?.click()}>{t('project.restore')}</button>
        <button className="linkish" onClick={() => setShowTrash(x => !x)}>{showTrash ? t('project.back') : t('project.trash', { n: trash.length })}</button>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) read(f, obj => onImportProject(obj)); e.target.value = ''; }} />
      <input ref={backupRef} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) read(f, obj => onImportBackup(obj)); e.target.value = ''; }} />
      <div className="project-list">
        {list.map(p => {
          let meta = '';
          try {
            const l = layoutOf(normalizeProject(p));
            meta = `${p.spec.width} × ${p.spec.height} mm · ${l.actualW.toFixed(0)} × ${l.actualH.toFixed(0)} · ${l.cells.length} ${t('left.cells')} · ${l.plan.totals.parts} ${t('common.pieces')}`;
          } catch {}
          return (
            <div className={'project-row' + (p.deletedAt ? ' trash' : '')} key={p.id}>
              <div className="project-main">
                {renaming === p.id ? (
                  <input autoFocus value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onRename(p.id, name.trim() || p.name); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={() => { onRename(p.id, name.trim() || p.name); setRenaming(null); }} className="project-rename" />
                ) : <div className="project-name">{p.name} {p.id === currentId && <em>{t('project.current')}</em>}</div>}
                <div className="project-meta">{meta}</div>
              </div>
              <div className="project-actions">
                {!p.deletedAt && <button onClick={() => onOpen(p.id)}>{t('common.open')}</button>}
                {!p.deletedAt && <button onClick={() => onDuplicate(p.id)}>{t('common.duplicate')}</button>}
                {!p.deletedAt && <button onClick={() => { setRenaming(p.id); setName(p.name); }}>{t('common.rename')}</button>}
                {!p.deletedAt && <button className="danger" onClick={() => onDelete(p.id)}>{t('common.delete')}</button>}
                {p.deletedAt && <button onClick={() => onRestore(p.id)}>{t('common.restore')}</button>}
                {p.deletedAt && <button className="danger" onClick={() => onHardDelete(p.id)}>{t('common.delete')}</button>}
              </div>
            </div>
          );
        })}
        {!list.length && <div className="empty">{showTrash ? t('project.trashEmpty') : t('project.empty')}</div>}
      </div>
      <div className="hint" style={{ marginTop: 14 }}>{t('project.deleteHint')}</div>
    </Modal>
  );
}
