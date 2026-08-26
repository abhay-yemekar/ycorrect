/**
 * Document management — multi-document support with localStorage persistence.
 */

const STORAGE_KEY = 'ycorrectDocs';
const CURRENT_KEY = 'ycorrectCurrent';

// ─── Storage ──────────────────────────────────────────────────────

function loadDocs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function loadCurrentId() {
  return localStorage.getItem(CURRENT_KEY);
}

function saveCurrentId(id) {
  localStorage.setItem(CURRENT_KEY, id);
}

// ─── State ────────────────────────────────────────────────────────

let docs = loadDocs();
let currentId = loadCurrentId();

// Ensure we have a valid current document
if (!docs.find(d => d.id === currentId)) {
  currentId = crypto.randomUUID();
  docs.push({
    id: currentId,
    name: 'Untitled document',
    text: '',
    updatedAt: Date.now(),
  });
  saveDocs(docs);
  saveCurrentId(currentId);
}

// ─── Public API ───────────────────────────────────────────────────

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
  saveDocs(docs);
}

export function switchTo(id) {
  persistCurrent(getCurrentDoc()?.text || '');
  currentId = id;
  saveCurrentId(id);
  return getCurrentDoc();
}

export function createDoc(name = 'Untitled document') {
  // crypto.randomUUID() — Date.now() collided when two documents were
  // created in the same millisecond (defect 3)
  const id = crypto.randomUUID();
  docs.push({
    id,
    name,
    text: '',
    updatedAt: Date.now(),
  });
  currentId = id;
  saveCurrentId(id);
  saveDocs(docs);
  return getCurrentDoc();
}

export function renameDoc(id, name) {
  const doc = docs.find(d => d.id === id);
  if (doc) {
    doc.name = name;
    saveDocs(docs);
  }
}

export function deleteDoc(id) {
  docs = docs.filter(d => d.id !== id);
  saveDocs(docs);

  // If we deleted the current doc, switch to the most recent one
  if (currentId === id) {
    if (docs.length > 0) {
      docs.sort((a, b) => b.updatedAt - a.updatedAt);
      currentId = docs[0].id;
    } else {
      // Create a fresh doc
      const fresh = createDoc();
      currentId = fresh.id;
    }
    saveCurrentId(currentId);
  }

  return getCurrentDoc();
}

// ─── Per-document ignore lists (defect 9) ─────────────────────
// Ignored issues are keyed on `rule.id + message` and stored WITH the
// document, so they are scoped to it and survive reloads. Documents from
// before this field existed simply have none — treated as empty.

export function getIgnoredKeys() {
  return getCurrentDoc()?.ignoredIssues || [];
}

export function ignoreIssuePermanently(key) {
  const doc = getCurrentDoc();
  if (!doc) return;
  if (!Array.isArray(doc.ignoredIssues)) doc.ignoredIssues = [];
  if (!doc.ignoredIssues.includes(key)) doc.ignoredIssues.push(key);
  saveDocs(docs);
}
