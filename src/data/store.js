const DB_NAME = 'kumiko-studio';
const DB_VERSION = 1;
let dbPromise = null;
let fallback = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(err => { fallback = true; throw err; });
  return dbPromise;
}
const LS = {
  key: n => 'kumiko:' + n,
  read(n, d) { try { const v = localStorage.getItem(LS.key(n)); return v ? JSON.parse(v) : d; } catch { return d; } },
  write(n, v) { try { localStorage.setItem(LS.key(n), JSON.stringify(v)); } catch {} },
  list(n) { return Object.values(LS.read(n, {})); },
  get(n, id) { return LS.read(n, {})[id] || null; },
  put(n, o) { const a = LS.read(n, {}); a[o.id || o.key] = o; LS.write(n, a); },
  del(n, id) { const a = LS.read(n, {}); delete a[id]; LS.write(n, a); }
};
function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
export async function listProjects() {
  if (fallback) return LS.list('projects');
  try { return (await tx('projects', 'readonly', s => s.getAll())) || []; }
  catch { fallback = true; return LS.list('projects'); }
}
export async function getProject(id) {
  if (fallback) return LS.get('projects', id);
  try { return await tx('projects', 'readonly', s => s.get(id)); }
  catch { fallback = true; return LS.get('projects', id); }
}
export async function putProject(p) {
  if (fallback) { LS.put('projects', p); return p; }
  try { await tx('projects', 'readwrite', s => s.put(p)); return p; }
  catch { fallback = true; LS.put('projects', p); return p; }
}
export async function deleteProject(id, soft = true) {
  const p = await getProject(id);
  if (!p) return;
  if (soft) { p.deletedAt = new Date().toISOString(); await putProject(p); }
  else {
    if (fallback) { LS.del('projects', id); return; }
    try { await tx('projects', 'readwrite', s => s.delete(id)); }
    catch { fallback = true; LS.del('projects', id); }
  }
}
export async function restoreProject(id) {
  const p = await getProject(id);
  if (!p) return;
  p.deletedAt = null; p.updatedAt = new Date().toISOString();
  await putProject(p);
}
export async function listProfiles() {
  if (fallback) return LS.list('profiles');
  try { return (await tx('profiles', 'readonly', s => s.getAll())) || []; }
  catch { fallback = true; return LS.list('profiles'); }
}
export async function getProfile(id) {
  if (fallback) return LS.get('profiles', id);
  try { return await tx('profiles', 'readonly', s => s.get(id)); }
  catch { fallback = true; return LS.get('profiles', id); }
}
export async function putProfile(p) {
  if (fallback) { LS.put('profiles', p); return p; }
  try { await tx('profiles', 'readwrite', s => s.put(p)); return p; }
  catch { fallback = true; LS.put('profiles', p); return p; }
}
export async function getSetting(key, def = null) {
  if (fallback) return LS.read('settings', {})[key] ?? def;
  try {
    const r = await tx('settings', 'readonly', s => s.get(key));
    return r ? r.value : def;
  } catch { fallback = true; return LS.read('settings', {})[key] ?? def; }
}
export async function setSetting(key, value) {
  if (fallback) { const a = LS.read('settings', {}); a[key] = value; LS.write('settings', a); return; }
  try { await tx('settings', 'readwrite', s => s.put({ key, value })); }
  catch { fallback = true; const a = LS.read('settings', {}); a[key] = value; LS.write('settings', a); }
}
export async function backupAll() {
  const [projects, profiles] = await Promise.all([listProjects(), listProfiles()]);
  return { app: 'kumiko-studio', schemaVersion: 10, at: new Date().toISOString(), projects, profiles };
}
export async function importBundle(bundle) {
  if (!bundle || !Array.isArray(bundle.projects)) throw new Error('invalid backup');
  for (const p of bundle.projects) await putProject(p);
  for (const p of (bundle.profiles || [])) await putProfile(p);
}
export async function requestPersist() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch {}
  return false;
}
export async function storageEstimate() {
  try { if (navigator.storage?.estimate) return await navigator.storage.estimate(); } catch {}
  return null;
}
export const isFallback = () => fallback;
