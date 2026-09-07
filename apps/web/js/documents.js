/**
 * Document management — multi-document persistence.
 *
 * Storage model (v0.2): an in-memory array is the synchronous read surface
 * (so no caller changed), while IndexedDB is the durable store. Every write
 * updates memory immediately, then mirrors to IndexedDB; a failed mirror
 * surfaces a real warning instead of silently losing work (phase 5).
 *
 * Documents created before v0.2 live in a single `ycorrectDocs` localStorage
 * blob; they are migrated into IndexedDB on first run in one transaction,
 * and the legacy keys are only removed after that transaction commits.
 *
 * If IndexedDB is unavailable (old private-mode browsers), everything falls
 * back to the legacy localStorage path so the app keeps working.
 *
 * NOTE for tests: this module is imported by Node tests for its pure
 * helpers (`normalizeImportedDoc`, `mergeDocsForImport`). All browser-API
 * access lives inside functions — nothing runs at module scope.
 */

// ─── Constants ────────────────────────────────────────────────────

const DB_NAME = 'ycorrect';
const DB_VERSION = 1;
const DOC_STORE = 'docs';
const KV_STORE = 'kv';
const KV_CURRENT_ID = 'currentId';

const LEGACY_DOCS_KEY = 'ycorrectDocs';
const LEGACY_CURRENT_KEY = 'ycorrectCurrent';

// ─── Pure helpers (exported for tests + backup module) ───────────

/** Coerce an untrusted parsed-JSON value into a well-formed document. */
export function normalizeImportedDoc(raw, idFactory = () => crypto.randomUUID()) {
  if (!raw || typeof raw !== 'object' || typeof raw.text !== 'string') return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : idFactory(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled document',
    text: raw.text,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    ignoredIssues: Array.isArray(raw.ignoredIssues)
      ? raw.ignoredIssues.filter(k => typeof k === 'string')
      : [],
  };
}

/**
 * Merge imported docs into existing ones by id.
 * Existing ids are NEVER overwritten (no silent data loss); collisions are
 * re-id'd so both copies survive. Returns the merged list and counts.
 */
export function mergeDocsForImport(existing, incoming, idFactory = () => crypto.randomUUID()) {
  const byId = new Map(existing.map(d => [d.id, d]));
  let added = 0;
  let merged = 0;

  for (const doc of incoming) {
    const clean = normalizeImportedDoc(doc, idFactory);
    if (!clean) continue;
    if (byId.has(clean.id)) {
      // Collision: keep ours, admit theirs under a fresh id
      clean.id = idFactory();
      clean.name = `${clean.name} (imported)`;
      merged++;
    } else {
      added++;
    }
    byId.set(clean.id, clean);
  }

  const docs = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return { docs, added, merged };
}

// ─── State ────────────────────────────────────────────────────────

let docs = [];
let currentId = null;

/** 'idb' | 'legacy-localStorage' — chosen during initDocuments(). */
let backend = null;
let warnedAboutStorage = false;

function warnStorageError() {
  if (warnedAboutStorage) return;
  warnedAboutStorage = true;
  // Lazy import avoidance: utils.notify touches DOM only when called, but a
  // static import would be fine too — we keep it dynamic so pure consumers
  // (Node tests) never load DOM-dependent modules.
  import('./utils.js').then(({ notify }) =>
    notify('⚠ Changes could not be saved — browser storage may be full'),
  ).catch(() => {});
}

// ─── Legacy localStorage fallback ────────────────────────────────

function legacyLoad() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_DOCS_KEY) || '[]');
  } catch {
    return [];
  }
}

function legacySave() {
  try {
    localStorage.setItem(LEGACY_DOCS_KEY, JSON.stringify(docs));
    localStorage.setItem(LEGACY_CURRENT_KEY, currentId);
  } catch {
    warnStorageError();
  }
}

// ─── IndexedDB plumbing ──────────────────────────────────────────

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked by another open tab'));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllDocs(db) {
  return reqToPromise(db.transaction(DOC_STORE).objectStore(DOC_STORE).getAll());
}

async function idbGetKv(db, key) {
  return reqToPromise(db.transaction(KV_STORE).objectStore(KV_STORE).get(key));
}

/** Write one document; resolves even on failure (error is surfaced via toast). */
async function idbPutDoc(doc) {
  try {
    const db = await openDb();
    await reqToPromise(
      db.transaction(DOC_STORE, 'readwrite').objectStore(DOC_STORE).put(structuredClone(doc)),
    );
    db.close();
    warnedAboutStorage = false;
  } catch {
    warnStorageError();
  }
}

async function idbDeleteDoc(id) {
  try {
    const db = await openDb();
    await reqToPromise(db.transaction(DOC_STORE, 'readwrite').objectStore(DOC_STORE).delete(id));
    db.close();
  } catch {
    warnStorageError();
  }
}

async function idbPutCurrentId(id) {
  try {
    const db = await openDb();
    await reqToPromise(db.transaction(KV_STORE, 'readwrite').objectStore(KV_STORE).put(id, KV_CURRENT_ID));
    db.close();
  } catch {
    warnStorageError();
  }
}

/**
 * One transaction writes every migrated doc + the current-id pointer, so a
 * crash mid-migration cannot leave a half-imported library. Returns true if
 * a migration happened (and therefore the legacy keys may be removed).
 */
async function migrateLegacyDocs(db) {
  const raw = localStorage.getItem(LEGACY_DOCS_KEY);
  if (!raw) return false;

  let legacy;
  try {
    legacy = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return false;

  const storeCount = await reqToPromise(db.transaction(DOC_STORE).objectStore(DOC_STORE).count());
  if (storeCount > 0) return false; // IDB already populated — never overwrite

  const normalized = legacy.map(d => normalizeImportedDoc(d)).filter(Boolean);
  if (normalized.length === 0) return false;

  const tx = db.transaction([DOC_STORE, KV_STORE], 'readwrite');
  const docStore = tx.objectStore(DOC_STORE);
  for (const d of normalized) docStore.put(d);
  const legacyCurrent = localStorage.getItem(LEGACY_CURRENT_KEY);
  if (legacyCurrent && normalized.some(d => d.id === legacyCurrent)) {
    tx.objectStore(KV_STORE).put(legacyCurrent, KV_CURRENT_ID);
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  // Committed — safe to drop the legacy blob.
  localStorage.removeItem(LEGACY_DOCS_KEY);
  localStorage.removeItem(LEGACY_CURRENT_KEY);
  return true;
}

// ─── Init ────────────────────────────────────────────────────────

function ensureCurrentDoc() {
  if (!docs.find(d => d.id === currentId)) {
    currentId = docs.length > 0
      ? [...docs].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      : crypto.randomUUID();
    if (docs.length === 0) {
      docs.push({ id: currentId, name: 'Untitled document', text: '', updatedAt: Date.now() });
    }
    saveCurrentId();
  }
}

/**
 * Load the document library before any other module reads it.
 * app.js awaits this as its first action.
 */
export async function initDocuments() {
  try {
    const db = await openDb();
    await migrateLegacyDocs(db);
    docs = (await idbGetAllDocs(db)).filter(Boolean);
    currentId = (await idbGetKv(db, KV_CURRENT_ID)) || null;
    db.close();
    backend = 'idb';
  } catch {
    // IndexedDB unavailable or broken — keep working via localStorage.
    backend = 'legacy-localStorage';
    docs = legacyLoad();
    currentId = localStorage.getItem(LEGACY_CURRENT_KEY);
  }
  ensureCurrentDoc();
}

// ─── Persistence dispatchers ─────────────────────────────────────

function saveDoc(doc) {
  if (backend === 'idb') idbPutDoc(doc);
  else legacySave();
}

function removeStoredDoc(id) {
  if (backend === 'idb') idbDeleteDoc(id);
  else legacySave();
}

function saveCurrentId() {
  if (backend === 'idb') idbPutCurrentId(currentId);
  else legacySave();
}

function saveAll() {
  if (backend === 'idb') {
    for (const d of docs) idbPutDoc(d); // small libraries; fine at this scale
  } else {
    legacySave();
  }
}

// ─── Public API (unchanged shapes — callers did not change) ──────

export function getDocs() {
  return docs;
}

export function getCurrentId() {
  return currentId;
}

export function getCurrentDoc() {
  return docs.find(d => d.id === currentId);
}

export function persistCurrent(text) {
  const doc = getCurrentDoc();
  if (!doc) return;
  doc.text = text;
  doc.updatedAt = Date.now();
  saveDoc(doc);
}

export function switchTo(id) {
  persistCurrent(getCurrentDoc()?.text || '');
  currentId = id;
  saveCurrentId();
  return getCurrentDoc();
}

export function createDoc(name = 'Untitled document') {
  // crypto.randomUUID() — Date.now() collided when two documents were
  // created in the same millisecond (defect 3)
  const id = crypto.randomUUID();
  docs.push({ id, name, text: '', updatedAt: Date.now(), ignoredIssues: [] });
  currentId = id;
  saveCurrentId();
  saveDoc(getCurrentDoc());
  return getCurrentDoc();
}

export function renameDoc(id, name) {
  const doc = docs.find(d => d.id === id);
  if (doc) {
    doc.name = name;
    doc.updatedAt = Date.now();
    saveDoc(doc);
  }
}

export function deleteDoc(id) {
  docs = docs.filter(d => d.id !== id);
  removeStoredDoc(id);

  // If we deleted the current doc, switch to the most recent one
  if (currentId === id) {
    if (docs.length > 0) {
      docs.sort((a, b) => b.updatedAt - a.updatedAt);
      currentId = docs[0].id;
    } else {
      const fresh = createDoc();
      currentId = fresh.id;
    }
    saveCurrentId();
  }

  return getCurrentDoc();
}

// ─── Per-document ignore lists (defect 9) ─────────────────────
// Ignored issues are keyed on `rule.id + message` and stored WITH the
// document, so they are scoped to it and survive reloads.

export function getIgnoredKeys() {
  return getCurrentDoc()?.ignoredIssues || [];
}

export function ignoreIssuePermanently(key) {
  const doc = getCurrentDoc();
  if (!doc) return;
  if (!Array.isArray(doc.ignoredIssues)) doc.ignoredIssues = [];
  if (!doc.ignoredIssues.includes(key)) doc.ignoredIssues.push(key);
  saveDoc(doc);
}

// ─── Backup (import/export all documents) ─────────────────────

/** Snapshot of every document for JSON export. */
export function exportAllDocs() {
  return {
    format: 'ycorrect-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    documents: structuredClone(docs),
  };
}

/**
 * Import documents from a parsed backup object. Returns counts; does NOT
 * touch storage — the caller decides what to do with the result.
 */
export function importDocs(parsed) {
  const incoming = Array.isArray(parsed?.documents)
    ? parsed.documents
    : Array.isArray(parsed) ? parsed : [];
  const result = mergeDocsForImport(docs, incoming);
  docs = result.docs;
  saveAll();
  return result;
}
