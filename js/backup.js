/**
 * Backup — JSON round-trip of ALL documents.
 *
 * Export produces a single .json file; Import merges a backup into the
 * library without overwriting anything already stored (collisions are
 * admitted under fresh ids, suffixed "(imported)"). This is what keeps
 * yCorrect data from being trapped in one browser profile.
 */

import { $, notify, download, sanitizeFilename } from './utils.js';
import { exportAllDocs, importDocs } from './documents.js';

function exportBackup() {
  const payload = exportAllDocs();
  const date = new Date().toISOString().slice(0, 10);
  const filename = sanitizeFilename(`ycorrect-backup-${date}`) + '.json';
  download(filename, JSON.stringify(payload, null, 2), 'application/json');
  notify(`Exported ${payload.documents.length} document${payload.documents.length === 1 ? '' : 's'}`);
}

async function importBackup(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    notify('Import failed — that file is not valid JSON');
    return;
  }

  if (!parsed || (!Array.isArray(parsed.documents) && !Array.isArray(parsed))) {
    notify('Import failed — not a yCorrect backup file');
    return;
  }
  if (parsed.format && parsed.format !== 'ycorrect-backup') {
    notify('Import failed — unknown backup format');
    return;
  }

  const { added, merged } = importDocs(parsed);
  const parts = [];
  if (added) parts.push(`${added} imported`);
  if (merged) parts.push(`${merged} kept as copies`);
  notify(parts.length ? `Done: ${parts.join(', ')}` : 'Nothing new to import');

  // Re-render the sidebar and reload the editor with the (possibly changed)
  // current document. A full reload is the simplest correct sync.
  setTimeout(() => location.reload(), 900);
}

export function initBackup() {
  const exportBtn = $('[data-backup="export"]');
  if (exportBtn) exportBtn.addEventListener('click', exportBackup);

  const importBtn = $('[data-backup="import"]');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) importBackup(file);
      });
      input.click();
    });
  }
}
