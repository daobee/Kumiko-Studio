import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  newProject as createProject, normalizeProject, layoutOf, validate, validationText,
  snapshotOf, uid, colorOf, defaultAssignment, presetPolygon, framePolygon
} from './data/model.js';
import * as store from './data/store.js';
import { LangContext, detectLang, makeT } from './data/i18n.js';
import { DEFAULT_PROFILE, PARAMS, checkProfile } from './data/terms.js';
import { PATTERNS, patternName } from './data/patterns.js';
import {
  download, downloadText, safeName, oneToOneSVG, printSVG, csvPlan,
  threeMF, stlBytes, partsZip, buildMeshes
} from './data/export.js';
import Preview3D from './components/Preview3D.jsx';
import PatternEditor2D from './components/PatternEditor2D.jsx';
import PatternShelf from './components/PatternShelf.jsx';
import ImageImport from './components/ImageImport.jsx';
import {
  PrinterModal, ProfileModal, TermsModal, PatternPieceModal, ProjectLibraryModal
} from './components/Modals.jsx';

const deep = o => JSON.parse(JSON.stringify(o));
const DEFAULTS = {
  brush: { patternId: 'asanoha', color: 0 }
};

function firstPattern(mode) {
  return mode === 'square' ? 'sq_flower' : 'asanoha';
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [lang, setLang] = useState(detectLang());
  const [mode, setMode] = useState('3d');
  const [tool, setTool] = useState('select');
  const [selection, setSelection] = useState(() => new Set());
  const [brush, setBrush] = useState(DEFAULTS.brush);
  const [zoom, setZoom] = useState(1);
  const [mini3d, setMini3d] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [autoDeselect, setAutoDeselect] = useState(false);
  const [underlay, setUnderlay] = useState(null);
  const [modal, setModal] = useState(null);
  const [piecePattern, setPiecePattern] = useState(null);
  const [paramInfo, setParamInfo] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState('saved');
  const [conflict, setConflict] = useState(null);
  const [remote, setRemote] = useState(false);
  const [storage, setStorage] = useState(null);
  const [persisted, setPersisted] = useState(false);
  const [fps, setFps] = useState(60);
  const [shot, setShot] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyVer, setHistoryVer] = useState(0);

  const projectRef = useRef(null);
  const revisionRef = useRef(0);
  const conflictRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const channelRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { conflictRef.current = conflict; }, [conflict]);
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);

  const t = useMemo(() => makeT(lang), [lang]);
  const changeLang = l => {
    setLang(l);
    store.setSetting('locale', l).catch(() => {});
  };

  const layout = useMemo(() => project ? layoutOf(project) : null, [
    project?.frame, project?.grid, project?.paint, project?.printer,
    project?.customPatterns, project?.spec
  ]);
  const issues = useMemo(() => project && layout ? validate(project, layout, profile) : [], [project, layout, profile]);
  const errors = issues.filter(i => i.level === 'error');
  const warns = issues.filter(i => i.level === 'warn');
  const lowConfidence = layout ? layout.cells.filter(c => c.lowConfidence).length : 0;
  const plan = layout?.plan;

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  /* ---------- load ---------- */
  useEffect(() => {
    (async () => {
      let ps = await store.listProjects().catch(() => []);
      const last = await store.getSetting('lastProject', null).catch(() => null);
      let p = ps.find(x => x.id === last && !x.deletedAt) || ps.find(x => !x.deletedAt);
      if (!p) {
        p = createProject('北窗');
        await store.putProject(p);
        ps = [p];
      }
      p = normalizeProject(p);
      let prof = await store.getProfile(p.profileId).catch(() => null);
      if (!prof) { prof = DEFAULT_PROFILE; await store.putProfile(prof).catch(() => {}); }
      const savedLang = await store.getSetting('locale', null).catch(() => null);
      const l = savedLang || detectLang();
      setProjects(ps);
      setProject(p);
      setProfile(prof);
      setLang(l);
      revisionRef.current = p.revision || 0;
      setLoaded(true);
      await store.setSetting('lastProject', p.id).catch(() => {});
      store.requestPersist().then(v => setPersisted(!!v)).catch(() => {});
      store.storageEstimate().then(e => setStorage(e)).catch(() => {});
      if (typeof BroadcastChannel !== 'undefined') channelRef.current = new BroadcastChannel('kumiko-sync');
    })();
    return () => channelRef.current?.close();
  }, []);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !project) return;
    const on = e => {
      if (e.data?.id === project.id && e.data.revision > revisionRef.current) setRemote(true);
    };
    ch.addEventListener('message', on);
    return () => ch.removeEventListener('message', on);
  }, [project?.id, loaded]);

  /* ---------- autosave ---------- */
  async function saveNow() {
    const p = projectRef.current;
    if (!p || !loaded || conflictRef.current) return;
    const existing = await store.getProject(p.id).catch(() => null);
    if (existing && (existing.revision || 0) > revisionRef.current) {
      setConflict(existing); setSaving('conflict'); return;
    }
    const rec = {
      ...p,
      revision: (existing?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
      snapshot: snapshotOf(p)
    };
    await store.putProject(rec);
    revisionRef.current = rec.revision;
    setSaving('saved');
    setProjects(prev => prev.map(x => x.id === rec.id ? rec : x));
    await store.setSetting('lastProject', rec.id).catch(() => {});
    channelRef.current?.postMessage({ id: rec.id, revision: rec.revision });
    store.storageEstimate().then(e => setStorage(e)).catch(() => {});
  }
  useEffect(() => {
    if (!loaded || !project || conflict) return;
    setSaving('busy');
    const h = setTimeout(() => { saveNow(); }, 800);
    return () => clearTimeout(h);
  }, [project, loaded, conflict]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') saveNow(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [loaded]);

  async function reloadDb() {
    const p = await store.getProject(project.id);
    if (!p) return;
    const n = normalizeProject(p);
    setProject(n); revisionRef.current = n.revision || 0;
    setConflict(null); setRemote(false); setSaving('saved');
  }
  async function overwriteDb() {
    const existing = await store.getProject(project.id).catch(() => null);
    const rec = { ...project, revision: (existing?.revision || revisionRef.current || 0) + 1, updatedAt: new Date().toISOString(), snapshot: snapshotOf(project) };
    await store.putProject(rec);
    revisionRef.current = rec.revision;
    setConflict(null); setRemote(false); setSaving('saved');
    setProjects(prev => prev.map(x => x.id === rec.id ? rec : x));
  }

  /* ---------- history ---------- */
  function pushHistory() {
    const p = projectRef.current;
    if (!p) return;
    undoRef.current.push({ paint: deep(p.paint || {}), frame: deep(p.frame) });
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    setHistoryVer(v => v + 1);
  }
  function undo() {
    const p = projectRef.current;
    if (!p || !undoRef.current.length) return;
    const snap = undoRef.current.pop();
    redoRef.current.push({ paint: deep(p.paint || {}), frame: deep(p.frame) });
    setProject({ ...p, ...snap });
    setHistoryVer(v => v + 1);
  }
  function redo() {
    const p = projectRef.current;
    if (!p || !redoRef.current.length) return;
    const snap = redoRef.current.pop();
    undoRef.current.push({ paint: deep(p.paint || {}), frame: deep(p.frame) });
    setProject({ ...p, ...snap });
    setHistoryVer(v => v + 1);
  }
  useEffect(() => {
    const onKey = e => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Escape') {
        setSelection(new Set());
        setParamInfo(null);
        setModal(m => (m ? null : m));
        setExportOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep brush valid when grid mode changes
  useEffect(() => {
    if (!project) return;
    const kind = project.grid.mode === 'square' ? 'square' : 'triangle';
    const exists = PATTERNS.some(p => p.id === brush.patternId && p.cell === kind) ||
      (project.customPatterns || []).some(p => p.id === brush.patternId && p.cell === kind);
    if (!exists) setBrush(b => ({ ...b, patternId: firstPattern(project.grid.mode) }));
  }, [project?.grid.mode, brush.patternId]);

  /* ---------- project edits ---------- */
  const setSpec = (k, v) => setProject(p => ({ ...p, spec: { ...p.spec, [k]: v } }));
  const setFrameField = (k, v) => setProject(p => ({ ...p, frame: { ...p.frame, [k]: v } }));
  const setGridField = (k, v) => setProject(p => {
    const n = { ...p, grid: { ...p.grid, [k]: v } };
    if (k === 'mode') setBrush(b => ({ ...b, patternId: firstPattern(v) }));
    return n;
  });
  const setPreview = (k, v) => setProject(p => ({ ...p, preview: { ...p.preview, [k]: v } }));

  function setFramePreset(preset) {
    pushHistory();
    const p = projectRef.current;
    let poly = null;
    if (preset === 'custom') {
      poly = deep(layout.outer);
      setMode('2d'); setTool('frame');
    }
    setProject(x => ({ ...x, frame: { ...x.frame, preset, polygon: poly } }));
  }

  function onFramePolygon(poly) {
    setProject(p => ({ ...p, frame: { ...p.frame, preset: 'custom', polygon: poly } }));
  }
  function onFrameCommit() {
    setSaving('busy');
  }

  /* ---------- selection / paint ---------- */
  const selectedCells = useMemo(() => {
    if (!layout) return [];
    return [...selection].map(id => layout.cellById.get(id)).filter(Boolean);
  }, [selection, layout]);

  function modifySelection(fn, history = true) {
    if (!selection.size) return false;
    if (history) pushHistory();
    setProject(p => {
      const paint = { ...p.paint };
      for (const id of selection) {
        const cell = layout.cellById.get(id);
        if (!cell) continue;
        const cur = paint[id] || cell.assignment || defaultAssignment(cell.kind);
        paint[id] = { ...defaultAssignment(cell.kind), ...cur, ...fn(cell) };
      }
      return { ...p, paint };
    });
    return true;
  }

  function applyPattern(id) {
    setBrush(b => ({ ...b, patternId: id }));
    if (selection.size) {
      modifySelection(() => ({ patternId: id, layer: 'pattern' }));
      if (autoDeselect) setSelection(new Set());
    } else {
      setTool('brush');
    }
  }
  function applyColor(slot) {
    setBrush(b => ({ ...b, color: slot }));
    if (selection.size) {
      modifySelection(() => ({ color: slot }));
      if (autoDeselect) setSelection(new Set());
    }
  }
  const rotateSel = () => {
    if (!selection.size) return showToast(t('stage.selected', { n: 0 }));
    modifySelection(cell => ({ rot: ((cell.rot || 0) + 1) % (cell.kind === 'square' ? 4 : 3) }));
  };
  const mirrorSel = () => {
    if (!selection.size) return;
    modifySelection(cell => ({ mirror: !cell.mirror }));
  };
  const toggleLayer = () => {
    if (!selection.size) return;
    modifySelection(cell => ({ layer: (cell.assignment?.layer === 'empty' ? 'pattern' : 'empty') }));
  };
  function paintCell(cell) {
    setProject(p => {
      const next = {
        ...defaultAssignment(cell.kind),
        patternId: brush.patternId,
        color: brush.color,
        layer: 'pattern',
        lowConfidence: false
      };
      return { ...p, paint: { ...p.paint, [cell.id]: next } };
    });
  }
  function strokeStart() { pushHistory(); }

  /* ---------- image conversion ---------- */
  function applyImage(paint, underlayData) {
    pushHistory();
    setProject(p => ({ ...p, paint: { ...p.paint, ...paint } }));
    setUnderlay(underlayData);
    setMode('2d');
    setTool('select');
    showToast(t('toast.imageApplied'));
  }

  /* ---------- pattern piece ---------- */
  function savePiece(custom) {
    pushHistory();
    setProject(p => ({
      ...p,
      customPatterns: [...(p.customPatterns || []), custom],
      paint: selection.size
        ? Object.fromEntries(Object.entries(p.paint || {}).map(([id, a]) => selection.has(id) ? [id, { ...a, patternId: custom.id }] : [id, a]))
        : p.paint
    }));
    setBrush(b => ({ ...b, patternId: custom.id }));
    setPiecePattern(null);
    showToast(t('toast.pieceSaved'));
  }

  /* ---------- exports ---------- */
  async function handleExport(kind) {
    setExportOpen(false);
    if (!project || !layout) return;
    if (errors.length && kind !== 'json') {
      showToast(t('toast.blocked', { msg: validationText(errors[0], t) }));
      return;
    }
    try {
      const base = safeName(project.name) + '-' + Math.round(layout.actualW) + 'x' + Math.round(layout.actualH);
      if (kind === 'json') {
        downloadText(JSON.stringify({ ...project, snapshot: snapshotOf(project) }, null, 2), base + '.kumiko.json', 'application/json');
        showToast(t('toast.exported', { name: '.kumiko.json' }));
        return;
      }
      if (kind === 'csv') {
        downloadText(csvPlan(project, layout, lang, t), base + '-blocks.csv', 'text/csv;charset=utf-8');
        showToast(t('toast.exported', { name: 'CSV' }));
        return;
      }
      if (kind === 'svg' || kind === 'pdf') {
        const svg = oneToOneSVG(project, layout, lang, t);
        if (kind === 'svg') {
          downloadText(svg, base + '-1to1.svg', 'image/svg+xml');
          showToast(t('toast.exported', { name: 'SVG' }));
        } else {
          const ok = printSVG(svg);
          if (!ok) showToast(t('toast.blocked', { msg: 'popup' }));
        }
        return;
      }
      const meshes = buildMeshes(project, layout);
      if (kind === '3mf') {
        download(threeMF(meshes), base + '.3mf');
        showToast(t('toast.exported', { name: '3MF' }));
      } else if (kind === 'stl') {
        download(new Blob([stlBytes(meshes)], { type: 'model/stl' }), base + '.stl');
        showToast(t('toast.exported', { name: 'STL' }));
      } else if (kind === 'parts') {
        download(partsZip(project, layout), base + '-parts.zip');
        showToast(t('toast.exported', { name: 'ZIP' }));
      }
      if (!profile.calibrated) showToast(t('profile.uncalibrated'));
    } catch (e) {
      showToast(t('export.failed', { msg: e?.message || t('error.unknown') }));
    }
  }

  /* ---------- project management ---------- */
  async function refreshProjects() {
    const ps = await store.listProjects().catch(() => []);
    setProjects(ps);
    return ps;
  }
  async function openProjectById(id) {
    await saveNow();
    const p = await store.getProject(id);
    if (!p) return;
    const n = normalizeProject(p);
    let prof = await store.getProfile(n.profileId).catch(() => null);
    if (!prof) { prof = DEFAULT_PROFILE; n.profileId = prof.id; }
    setProfile(prof);
    setProject(n);
    revisionRef.current = n.revision || 0;
    setConflict(null); setRemote(false); setSaving('saved');
    setMode('3d'); setModal(null); setSelection(new Set()); setUnderlay(null);
    await store.setSetting('lastProject', n.id).catch(() => {});
    undoRef.current = []; redoRef.current = []; setHistoryVer(v => v + 1);
    await refreshProjects();
  }
  async function newProj() {
    const p = createProject(lang === 'zh' ? '未命名面板' : 'Untitled panel');
    p.printer = JSON.parse(JSON.stringify(project?.printer || p.printer));
    await store.putProject(p);
    await refreshProjects();
    setProfile(DEFAULT_PROFILE);
    setProject(normalizeProject(p));
    revisionRef.current = 0;
    setMode('3d'); setModal(null); setSelection(new Set()); setUnderlay(null);
    await store.setSetting('lastProject', p.id).catch(() => {});
    showToast(t('toast.projectCreated'));
  }
  async function duplicateProject(id) {
    const p = await store.getProject(id);
    if (!p) return;
    const c = { ...deep(p), id: uid('proj'), name: p.name + (lang === 'zh' ? ' 副本' : ' copy'), revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null };
    await store.putProject(c);
    await refreshProjects();
    showToast(t('toast.projectCreated'));
  }
  async function renameProject(id, name) {
    const p = await store.getProject(id);
    if (!p) return;
    p.name = name || p.name; p.updatedAt = new Date().toISOString();
    await store.putProject(p);
    await refreshProjects();
    if (project?.id === id) setProject(prev => ({ ...prev, name: p.name }));
  }
  async function deleteProjectById(id) {
    await store.deleteProject(id, true);
    const ps = await refreshProjects();
    if (project?.id === id) {
      const next = ps.find(x => !x.deletedAt);
      if (next) openProjectById(next.id); else newProj();
    }
    showToast(t('toast.deleted'));
  }
  async function restoreProjectById(id) {
    await store.restoreProject(id);
    await refreshProjects();
    showToast(t('toast.restoredProject'));
  }
  async function hardDelete(id) {
    await store.deleteProject(id, false);
    await refreshProjects();
    showToast(t('toast.deleted'));
  }
  async function importProject(obj) {
    if (!obj || !obj.spec || !obj.grid) { showToast(t('toast.blocked', { msg: 'JSON' })); return; }
    const p = normalizeProject(obj);
    if (projects.some(x => x.id === p.id)) p.id = uid('proj');
    await store.putProject(p);
    await refreshProjects();
    await openProjectById(p.id);
    showToast(t('toast.projectImported'));
  }
  async function backup() {
    const b = await store.backupAll();
    downloadText(JSON.stringify(b, null, 2), 'kumiko-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
    showToast(t('toast.backup'));
  }
  async function importBackup(obj) {
    try {
      await store.importBundle(obj);
      const ps = await refreshProjects();
      showToast(t('toast.restored'));
      if (!ps.find(x => x.id === project?.id && !x.deletedAt)) {
        const next = ps.find(x => !x.deletedAt);
        if (next) openProjectById(next.id);
      }
    } catch (e) { showToast(t('toast.blocked', { msg: e.message })); }
  }
  async function savePrinter(p) {
    setProject(x => ({ ...x, printer: p }));
    setModal(null);
    showToast(t('toast.printerSaved'));
  }
  async function saveProfile(p) {
    await store.putProfile(p);
    setProfile(p);
    setProject(prev => prev ? { ...prev, profileId: p.id } : prev);
    setModal(null);
    showToast(t('toast.profileSaved'));
  }

  /* ---------- parameter popover ---------- */
  useEffect(() => {
    const close = e => {
      if (!e.target.closest('.param-popover') && !e.target.closest('.info-btn')) setParamInfo(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  if (!loaded || !project || !layout) return <div className="app loading">組子 · Kumiko Studio</div>;

  const shapeLabel = { rect: 'left.rect', triangle: 'left.triangle', diamond: 'left.diamond', hex: 'left.hex', custom: 'left.custom' };
  const currentKind = project.grid.mode === 'square' ? 'square' : 'triangle';
  const currentPattern = PATTERNS.find(p => p.id === brush.patternId) || (project.customPatterns || []).find(p => p.id === brush.patternId);
  const dateLocale = lang === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang, t }}>
      <div className="app">
        <header className="topbar">
          <div className="brand"><span className="brand-cn">組子</span><span className="brand-en">KUMIKO STUDIO</span></div>
          <button className="project-btn" onClick={() => setModal('library')} title={t('app.library')}>{project.name}</button>
          <span className="top-meta">{project.spec.width} × {project.spec.height} mm · {layout.cells.length} {t('left.cells')} · {plan.totals.parts} {t('common.pieces')}</span>
          <span className="top-spacer" />
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === 'zh' ? 'on' : ''} onClick={() => changeLang('zh')}>中</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => changeLang('en')}>EN</button>
          </div>
          <button className="icon-btn" onClick={undo} disabled={!undoRef.current.length} title={t('common.undo')}>↶</button>
          <button className="icon-btn" onClick={redo} disabled={!redoRef.current.length} title={t('common.redo')}>↷</button>
          <span className={'saved-dot ' + saving} />
          <span className="saved-label">{saving === 'busy' ? t('app.saving') : saving === 'conflict' ? t('app.conflict') : t('app.saved')}</span>
          <div className="export-wrap">
            <button className="btn" onClick={() => setExportOpen(o => !o)}>{t('app.export')} ▾</button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => handleExport('3mf')}>{t('right.export3mf')}</button>
                <button onClick={() => handleExport('stl')}>{t('right.exportStl')}</button>
                <button onClick={() => handleExport('parts')}>{t('right.export')} ZIP</button>
                <button onClick={() => handleExport('csv')}>{t('right.exportCsv')}</button>
                <button onClick={() => handleExport('svg')}>{t('right.exportSvg')}</button>
                <button onClick={() => handleExport('pdf')}>{t('right.exportPdf')}</button>
                <button onClick={() => handleExport('json')}>{t('right.exportJson')}</button>
              </div>
            )}
          </div>
        </header>

        {conflict && (
          <div className="conflict-bar">
            <span>{t('project.conflict')} (revision {conflict.revision})</span>
            <button onClick={reloadDb}>{t('project.reload')}</button>
            <button onClick={overwriteDb}>{t('project.overwrite')}</button>
          </div>
        )}
        {!conflict && remote && (
          <div className="conflict-bar">
            <span>{t('project.reloadRemote')}</span>
            <button onClick={reloadDb}>{t('project.reload')}</button>
            <button onClick={() => setRemote(false)}>{t('common.close')}</button>
          </div>
        )}

        <div className="workspace">
          <aside className="left-rail">
            <div className="rail-kicker">{t('left.frame')}</div>
            <div className="shape-grid">
              {['rect', 'triangle', 'diamond', 'hex', 'custom'].map(s => (
                <button key={s} className={'shape-btn' + (project.frame.preset === s ? ' on' : '')}
                  onClick={() => setFramePreset(s)}>{t(shapeLabel[s])}</button>
              ))}
            </div>
            <div className="rail-section">
              <div className="rail-kicker">{t('left.opening')}</div>
              <label className="field">
                <span className="label">{t('left.width')}</span>
                <span className="val"><input type="number" min="50" max="2500" value={project.spec.width} onChange={e => setSpec('width', Math.max(50, Math.min(2500, +e.target.value || 50)))} /><span className="unit">mm</span></span>
              </label>
              <label className="field">
                <span className="label">{t('left.height')}</span>
                <span className="val"><input type="number" min="50" max="2500" value={project.spec.height} onChange={e => setSpec('height', Math.max(50, Math.min(2500, +e.target.value || 50)))} /><span className="unit">mm</span></span>
              </label>
              <label className="field">
                <span className="label">{t('left.frameWidth')}<button className="info-btn" onClick={e => setParamInfo({ key: 'frameWidth', anchor: e.currentTarget })}>?</button></span>
                <span className="val"><input type="number" min="4" max="80" value={project.frame.frameWidth} onChange={e => setFrameField('frameWidth', Math.max(4, Math.min(80, +e.target.value || 4)))} /><span className="unit">mm</span></span>
              </label>
            </div>
            <div className="rail-section">
              <div className="rail-kicker">{t('left.grid')}</div>
              <div className="seg">
                <button className={project.grid.mode === 'triangle' ? 'on' : ''} onClick={() => setGridField('mode', 'triangle')}>{t('left.triangleGrid')}</button>
                <button className={project.grid.mode === 'square' ? 'on' : ''} onClick={() => setGridField('mode', 'square')}>{t('left.squareGrid')}</button>
              </div>
              <label className="field">
                <span className="label">{t('left.pitch')}<button className="info-btn" onClick={e => setParamInfo({ key: 'pitch', anchor: e.currentTarget })}>?</button></span>
                <span className="val"><input type="number" min="15" max="120" value={project.grid.pitch} onChange={e => setGridField('pitch', Math.max(15, Math.min(120, +e.target.value || 15)))} /><span className="unit">mm</span></span>
              </label>
              <label className="field">
                <span className="label">{t('left.patternRib')}<button className="info-btn" onClick={e => setParamInfo({ key: 'rib', anchor: e.currentTarget })}>?</button></span>
                <span className="val"><input type="number" min="0.8" max="6" step="0.1" value={project.grid.rib} onChange={e => setGridField('rib', Math.max(0.8, Math.min(6, +e.target.value || 0.8)))} /><span className="unit">mm</span></span>
              </label>
            </div>
            <div className="rail-section">
              <div className="rail-kicker">{t('left.printer')}</div>
              <div className="printer-summary">
                <div><b>{project.printer.bed.x} × {project.printer.bed.y} × {project.printer.bed.z}</b><span>mm</span></div>
                <div className="color-strip">
                  {project.printer.colors.map(c => <i key={c.slot} style={{ background: c.hex }} title={c.name?.[lang] || c.hex} />)}
                </div>
                <button className="linkish" onClick={() => setModal('printer')}>{t('left.editPrinter')}</button>
              </div>
            </div>
            <div className="rail-section">
              <div className="rail-kicker">{t('left.profile')}</div>
              <div className="profile-summary">
                <div>{profile.label}</div>
                <div className={profile.calibrated ? 'ok' : 'warn'}>{profile.calibrated ? t('profile.calibratedOk') : t('left.profilePending')}</div>
                <button className="linkish" onClick={() => setModal('profile')}>{t('left.editProfile')}</button>
              </div>
            </div>
            <div className="actual">
              <div className="rail-kicker">{t('left.actual')}</div>
              <div className="actual-num">{layout.actualW.toFixed(1)} × {layout.actualH.toFixed(1)} <span>mm</span></div>
              <div className="actual-meta">
                <span className={Math.abs(layout.actualW - project.spec.width) / project.spec.width > 0.1 ? 'warn' : ''}>
                  {((layout.actualW - project.spec.width) / project.spec.width * 100).toFixed(1)}%
                </span>
                <span>·</span>
                <span className={Math.abs(layout.actualH - project.spec.height) / project.spec.height > 0.1 ? 'warn' : ''}>
                  {((layout.actualH - project.spec.height) / project.spec.height * 100).toFixed(1)}%
                </span>
                <span>·</span><span>{layout.blocks.length} {t('left.blocks')}</span>
                <span>·</span><span>{layout.cells.length} {t('left.cells')}</span>
              </div>
            </div>
            <div className="issues">
              {warns.slice(0, 2).map((i, k) => <div className="issue warn" key={k}>{validationText(i, t)}</div>)}
              {errors.slice(0, 2).map((i, k) => <div className="issue error" key={k}>{validationText(i, t)}</div>)}
              {!issues.length && <div className="issue ok">{t('frameEditor.ok')}</div>}
            </div>
            <div className="rail-note">{t('left.footnote')}</div>
          </aside>

          <main className="stage">
            {mode === '3d' ? (
              <div className="stage-inner">
                <div className="stage-toolbar">
                  <button className={project.preview.view === 'front' ? 'on' : ''} onClick={() => setPreview('view', 'front')}>{t('stage.front')}</button>
                  <button className={project.preview.view === 'iso' ? 'on' : ''} onClick={() => setPreview('view', 'iso')}>{t('stage.iso')}</button>
                  <button className={project.preview.view === 'side' ? 'on' : ''} onClick={() => setPreview('view', 'side')}>{t('stage.side')}</button>
                  <button className={project.preview.view === 'top' ? 'on' : ''} onClick={() => setPreview('view', 'top')}>{t('stage.top')}</button>
                  <span className="toolbar-sep" />
                  <button className={project.preview.backlight ? 'on' : ''} onClick={() => setPreview('backlight', !project.preview.backlight)}>{t('stage.backlight')}</button>
                  <button className={project.preview.dims ? 'on' : ''} onClick={() => setPreview('dims', !project.preview.dims)}>{t('stage.dims')}</button>
                  <select value={project.preview.material} onChange={e => setPreview('material', e.target.value)} aria-label={t('stage.material')}>
                    <option value="matte">{t('stage.matte')}</option>
                    <option value="silk">{t('stage.silk')}</option>
                    <option value="wood">{t('stage.wood')}</option>
                    <option value="translucent">{t('stage.translucent')}</option>
                  </select>
                  <select value={project.preview.light} onChange={e => setPreview('light', e.target.value)} aria-label={t('stage.light')}>
                    <option value="day">{t('stage.day')}</option>
                    <option value="evening">{t('stage.evening')}</option>
                    <option value="night">{t('stage.night')}</option>
                  </select>
                  <span className="toolbar-spacer" />
                  <button className="tool-btn" onClick={() => { setMode('2d'); setTool('select'); }}>{t('app.editPattern')}</button>
                  <button className="tool-btn" onClick={() => { setMode('2d'); setModal('image'); }}>{t('app.importImage')}</button>
                  <button className="icon-btn" onClick={() => setShot(s => s + 1)} title={t('stage.screenshot')}>◉</button>
                </div>
                <div className="stage-body">
                  <Preview3D project={project} layout={layout} onFps={setFps} screenshotSignal={shot} />
                  {project.preview.dims && (
                    <div className="stage-dim">{t('left.opening')} {project.spec.width} × {project.spec.height} mm</div>
                  )}
                  <div className="stage-badge">{t('stage.plate')} · {t(shapeLabel[project.frame.preset] || 'left.rect')} · {layout.cells.length} {t('left.cells')}</div>
                </div>
                <div className="stage-caption">
                  <span>{t('stage.view')} · {t('stage.' + (project.preview.view || 'iso'))}</span>
                  <span><b>{layout.actualW.toFixed(0)} × {layout.actualH.toFixed(0)}</b> mm · {plan.totals.parts} {t('common.pieces')}</span>
                </div>
              </div>
            ) : (
              <div className="stage-inner mode2d">
                <div className="stage-toolbar">
                  <button className="tool-btn" onClick={() => { setMode('3d'); setTool('select'); }}>{t('app.back3d')}</button>
                  <span className="toolbar-sep" />
                  <button className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')}>{t('stage.select')}</button>
                  <button className={tool === 'brush' ? 'on' : ''} onClick={() => setTool('brush')}>{t('stage.brush')}</button>
                  <button className={tool === 'frame' ? 'on' : ''} onClick={() => setTool('frame')}>{t('stage.frameTool')}</button>
                  <button onClick={() => setModal('image')}>{t('stage.imageTool')}</button>
                  <span className="toolbar-sep" />
                  <button className="icon-btn" onClick={undo} disabled={!undoRef.current.length} title={t('common.undo')}>↶</button>
                  <button className="icon-btn" onClick={redo} disabled={!redoRef.current.length} title={t('common.redo')}>↷</button>
                  <button className={project.grid.mode === 'square' ? 'hidden' : ''} onClick={rotateSel} disabled={!selection.size}>{t('pattern.rotate')}</button>
                  <button onClick={mirrorSel} disabled={!selection.size}>{t('pattern.mirror')}</button>
                  <button onClick={toggleLayer} disabled={!selection.size}>{t('pattern.background')}</button>
                  <button onClick={() => setSelection(new Set())} disabled={!selection.size}>{t('pattern.clear')}</button>
                  <span className="toolbar-spacer" />
                  <label className="toolbar-check"><input type="checkbox" checked={autoDeselect} onChange={e => setAutoDeselect(e.target.checked)} />{t('pattern.autoDeselect')}</label>
                  <button className={showBlocks ? 'on' : ''} onClick={() => setShowBlocks(v => !v)}>{t('frameEditor.blocks')}</button>
                  <button className="icon-btn" onClick={() => setZoom(z => Math.min(4, z * 1.25))} title={t('stage.zoomIn')}>+</button>
                  <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.5, z / 1.25))} title={t('stage.zoomOut')}>−</button>
                  <button className="icon-btn" onClick={() => setZoom(1)} title={t('stage.fit')}>⌂</button>
                  <button className={mini3d ? 'on' : ''} onClick={() => setMini3d(v => !v)}>{t('stage.mini3d')}</button>
                </div>
                <div className="stage-body">
                  <PatternEditor2D
                    project={project} layout={layout} tool={tool} selection={selection} brush={brush}
                    onSelection={setSelection} onPaintCell={paintCell} onStrokeStart={strokeStart}
                    onFramePolygon={onFramePolygon} onFrameCommit={onFrameCommit}
                    underlay={underlay} zoom={zoom} showBlocks={showBlocks}
                  />
                  {mini3d && (
                    <div className="mini3d">
                      <div className="mini3d-head"><span>{t('stage.mini3d')}</span><button onClick={() => setMini3d(false)}>×</button></div>
                      <Preview3D project={project} layout={layout} mini interactive={false} />
                    </div>
                  )}
                </div>
                <div className="stage-status">
                  <span>{t('stage.selected', { n: selection.size })}</span>
                  <span>· {t('stage.tool')} {t(tool === 'brush' ? 'stage.brush' : tool === 'frame' ? 'stage.frameTool' : 'stage.select')}</span>
                  <span>· {t('stage.pattern')} {currentPattern ? patternName(currentPattern, lang) : '—'}</span>
                  <span>· {t('stage.color')} {coLabel(project, brush.color, lang)}</span>
                  {lowConfidence > 0 && <span className="warn">· {t('stage.lowConfidence', { n: lowConfidence })}</span>}
                  {errors.length > 0 && <span className="error">· {validationText(errors[0], t)}</span>}
                </div>
                <PatternShelf project={project} brush={brush} onPattern={applyPattern} onColor={applyColor}
                  onRib={v => setGridField('rib', v)} onEdit={p => { setPiecePattern(p); setModal('piece'); }} />
              </div>
            )}
          </main>

          <aside className="right-rail">
            <div className="rail-kicker">{t('right.printPlan')}</div>
            <div className="plan-stats">
              <div className="plan-stat"><b>{layout.blocks.length}</b><span>{t('right.blocks')}</span></div>
              <div className="plan-stat"><b>{plan.totals.parts}</b><span>{t('right.totalParts')}</span></div>
              <div className="plan-stat"><b>{plan.totals.hours}</b><span>{t('right.hours')}</span></div>
              <div className="plan-stat"><b>{plan.totals.grams}</b><span>{t('right.filament')}</span></div>
            </div>
            <div className={'fit-badge ' + (plan.fits ? 'ok' : 'bad')}>
              {plan.fits ? t('right.fitOk') : t('right.fitBad')}
            </div>
            <div className="rail-section">
              <div className="rail-kicker">{t('right.colorsUsed')}</div>
              <div className="plan-colors">
                {plan.colors.map(c => (
                  <div key={c.slot} className="plan-color">
                    <i style={{ background: c.hex }} />
                    <span>{c.name?.[lang] || c.name?.en || c.slot}</span>
                    <b>{c.count}</b>
                  </div>
                ))}
                {!plan.colors.length && <div className="hint">—</div>}
              </div>
            </div>
            <div className="rail-section block-section">
              <div className="rail-kicker">{t('right.blockList')} <span>{layout.blocks.length}</span></div>
              <div className="block-list">
                {plan.blockRows.map(b => (
                  <div className="block-row" key={b.index}>
                    <div className="block-head"><b>B{b.index + 1}</b><span>{b.w.toFixed(0)} × {b.h.toFixed(0)}</span><em>{b.insertCount} {t('common.pieces')}</em></div>
                    <div className="block-meta">{b.hours} {t('common.hours')} · {b.grams} {t('common.grams')} · {b.frameCount} {t('right.frameShort')}</div>
                  </div>
                ))}
                {!plan.blockRows.length && <div className="hint">{t('right.noBlocks')}</div>}
              </div>
            </div>
            <div className="rail-section export-section">
              <div className="rail-kicker">{t('right.export')}</div>
              <div className="export-list">
                {[
                  ['csv', 'right.exportCsv'],
                  ['svg', 'right.exportSvg'],
                  ['pdf', 'right.exportPdf'],
                  ['3mf', 'right.export3mf'],
                  ['stl', 'right.exportStl'],
                  ['parts', 'right.export'],
                  ['json', 'right.exportJson']
                ].map(([k, label]) => (
                  <div className="export-row" key={k}>
                    <span>{t(label)}{k === 'parts' ? ' ZIP' : ''}</span>
                    <button onClick={() => handleExport(k)}>{t('right.export')}</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rail-note">{t('right.printPlanHint')}</div>
          </aside>
        </div>

        <footer className="statusbar">
          <span>{t('app.autoSave')}</span>
          <span>{t('app.storageUsed')} {storage ? (storage.usage / 1048576).toFixed(1) : '0'} MB / {storage ? (storage.quota / 1073741824).toFixed(1) : '—'} GB</span>
          <button className="status-btn" onClick={async () => { const ok = await store.requestPersist(); setPersisted(!!ok); showToast(ok ? t('app.persisted') : t('app.persist')); }}>
            {persisted ? t('app.persisted') : t('app.persist')}
          </button>
          <span>{fps} fps</span>
          <span className="status-dot" />
          <span>{profile.calibrated ? t('profile.calibratedOk') : t('left.profilePending')}</span>
          <div className="status-right">
            <button className="status-btn" onClick={() => setModal('terms')}>{t('app.terms')}</button>
            <span className="mono">{snapshotOf(project).paramsHash}</span>
            <span>{dateLocale === 'zh-CN' ? new Date().toLocaleDateString('zh-CN') : new Date().toLocaleDateString('en-US')}</span>
          </div>
        </footer>

        {paramInfo && (() => {
          const p = PARAMS[paramInfo.key];
          const r = paramInfo.anchor.getBoundingClientRect();
          const left = Math.min(window.innerWidth - 300, Math.max(14, r.left - 8));
          const top = Math.min(window.innerHeight - 260, r.bottom + 8);
          if (!p) return null;
          return (
            <div className="param-popover" style={{ left, top }}>
              <div className="popover-name">{lang === 'en' ? p.en : p.zh}</div>
              <div className="popover-names">{p.zh} · {p.ja} · {p.en}</div>
              <div className="popover-unit">{p.unit}</div>
              <div className="popover-def">{lang === 'en' ? (p.defEn || p.def) : p.def}</div>
              <div className="popover-fx">
                <em>{t('param.up')}</em><span>{lang === 'en' ? (p.upEn || p.up) : p.up}</span>
                <em>{t('param.down')}</em><span>{lang === 'en' ? (p.downEn || p.down) : p.down}</span>
              </div>
            </div>
          );
        })()}

        {modal === 'library' && (
          <ProjectLibraryModal
            projects={projects} currentId={project.id}
            onOpen={openProjectById} onNew={newProj} onDuplicate={duplicateProject}
            onRename={renameProject} onDelete={deleteProjectById} onRestore={restoreProjectById}
            onHardDelete={hardDelete} onImportProject={importProject}
            onExportCurrent={() => handleExport('json')} onBackup={backup} onImportBackup={importBackup}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'printer' && <PrinterModal printer={project.printer} onSave={savePrinter} onClose={() => setModal(null)} />}
        {modal === 'profile' && <ProfileModal profile={profile} onSave={saveProfile} onClose={() => setModal(null)} />}
        {modal === 'terms' && <TermsModal onClose={() => setModal(null)} />}
        {modal === 'piece' && piecePattern && (
          <PatternPieceModal pattern={piecePattern} color={colorOf(project, brush.color).hex}
            onSave={savePiece} onClose={() => { setModal(null); setPiecePattern(null); }} />
        )}
        {modal === 'image' && (
          <ImageImport project={project} layout={layout}
            onApply={applyImage}
            onPitch={v => setGridField('pitch', v)}
            onClose={() => setModal(null)} />
        )}
        <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
      </div>
    </LangContext.Provider>
  );
}

function coLabel(project, slot, lang) {
  const c = colorOf(project, slot);
  return c?.name?.[lang] || c?.name?.en || c?.hex || '';
}
