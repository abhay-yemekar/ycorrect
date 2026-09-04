/**
 * package-extension.js — build a Chrome Web Store upload zip from extension/.
 *
 * Zero-dependency by design: writes a real ZIP with node:zlib only
 * (deflateRawSync + crc32), so the repo's no-runtime-deps story holds
 * even in tooling.
 *
 *   node scripts/package-extension.js          # -> dist/write-right-<version>.zip
 *   import { buildZip } from './package-extension.js'   # programmatic (used by tests)
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const EXTENSION_DIR = fileURLToPath(new URL('../extension/', import.meta.url));

/** All files referenced by the manifest — packaging must never ship a broken zip. */
export function manifestReferencedFiles(m) {
  const files = [];
  const add = (p) => { if (p) files.push(p); };
  for (const icon of Object.values(m.icons || {})) add(icon);
  for (const icon of Object.values(m.action?.default_icon || {})) add(icon);
  add(m.background?.service_worker);
  add(m.action?.default_popup);
  add(m.options_ui?.page);
  for (const cs of m.content_scripts || []) for (const js of cs.js || []) add(js);
  for (const cs of m.content_scripts || []) for (const css of cs.css || []) add(css);
  return files;
}

/** Recursively collect files under dir, returning POSIX-style relative paths. */
export function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.DS_Store') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full, base));
    } else {
      out.push(relative(base, full).split(sep).join('/'));
    }
  }
  return out;
}

// ─── DOS timestamp encoding for ZIP headers ─────────────────────
function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time & 0xffff, day & 0xffff];
}

function localHeader(name, crc, compSize, rawSize, method, dosTime, dosDate) {
  const buf = Buffer.alloc(30);
  buf.writeUInt32LE(0x04034b50, 0);
  buf.writeUInt16LE(20, 4);            // version needed
  buf.writeUInt16LE(0x0800, 6);        // UTF-8 flag
  buf.writeUInt16LE(method, 8);
  buf.writeUInt16LE(dosTime, 10);
  buf.writeUInt16LE(dosDate, 12);
  buf.writeUInt32LE(crc, 14);
  buf.writeUInt32LE(compSize, 18);
  buf.writeUInt32LE(rawSize, 22);
  buf.writeUInt16LE(Buffer.byteLength(name), 26);
  buf.writeUInt16LE(0, 28);            // extra len
  return Buffer.concat([buf, Buffer.from(name, 'utf8')]);
}

function centralEntry(name, crc, compSize, rawSize, method, dosTime, dosDate, offset) {
  const buf = Buffer.alloc(46);
  buf.writeUInt32LE(0x02014b50, 0);
  buf.writeUInt16LE(0x031e, 4);        // made by: unix, 6.3
  buf.writeUInt16LE(20, 6);
  buf.writeUInt16LE(0x0800, 8);
  buf.writeUInt16LE(method, 10);
  buf.writeUInt16LE(dosTime, 12);
  buf.writeUInt16LE(dosDate, 14);
  buf.writeUInt32LE(crc, 16);
  buf.writeUInt32LE(compSize, 20);
  buf.writeUInt32LE(rawSize, 24);
  buf.writeUInt16LE(Buffer.byteLength(name), 28);
  buf.writeUInt16LE(0, 30);            // extra len
  buf.writeUInt16LE(0, 32);            // comment len
  buf.writeUInt16LE(0, 34);            // disk number
  buf.writeUInt16LE(0, 36);            // internal attrs
  buf.writeUInt32LE(0x81a40000, 38);   // external attrs: regular file, 0644
  buf.writeUInt32LE(offset, 42);
  return Buffer.concat([buf, Buffer.from(name, 'utf8')]);
}

/**
 * Build the extension zip into outDir. Returns { outPath, files, zipLength }.
 * Throws if the manifest references files that don't exist.
 */
export function buildZip(outDir) {
  const manifest = JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
  const missing = manifestReferencedFiles(manifest)
    .filter((f) => !statSync(join(EXTENSION_DIR, f), { throwIfNoEntry: false }));
  if (missing.length > 0) {
    throw new Error('manifest references missing files: ' + missing.join(', '));
  }

  const files = collectFiles(EXTENSION_DIR).sort();
  const [dosTime, dosDate] = dosDateTime();
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const name of files) {
    const raw = readFileSync(join(EXTENSION_DIR, name));
    const crc = crc32(raw) >>> 0;
    const method = name.endsWith('.png') ? 0 : 8; // PNGs are already compressed; store them
    const comp = method === 8 ? deflateRawSync(raw) : raw;
    chunks.push(localHeader(name, crc, comp.length, raw.length, method, dosTime, dosDate), comp);
    central.push(centralEntry(name, crc, comp.length, raw.length, method, dosTime, dosDate, offset));
    offset += 30 + Buffer.byteLength(name) + comp.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const zip = Buffer.concat([...chunks, cd, eocd]);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `write-right-${manifest.version}.zip`);
  writeFileSync(outPath, zip);
  return { outPath, files, zipLength: zip.length };
}

// Direct execution: `node scripts/package-extension.js`
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outPath, files, zipLength } = buildZip(fileURLToPath(new URL('../dist/', import.meta.url)));
  console.log(`Packaged ${files.length} files -> ${outPath}`);
  console.log(`  zip size: ${(zipLength / 1024).toFixed(1)} KB`);
  for (const f of files) console.log('  ' + f);
}
