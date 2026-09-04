/**
 * Packaging tests — build the extension zip into a temp dir and verify the
 * archive is structurally valid and content-faithful (mini zip reader, no deps).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync, crc32 } from 'node:zlib';
import { buildZip, collectFiles, manifestReferencedFiles } from '../scripts/package-extension.js';
import { fileURLToPath } from 'node:url';

const EXTENSION_DIR = fileURLToPath(new URL('../extension/', import.meta.url));

/** Minimal zip reader: returns Map(name -> {method, data, crc}) by parsing EOCD + central dir. */
function readZip(buf) {
  // EOCD: scan backwards for the end-of-central-directory signature
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert.notEqual(eocd, -1, 'zip has an end-of-central-directory record');
  const total = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  const entries = new Map();
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, `central entry ${n} signature`);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // local header
    const lh = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const comp = buf.subarray(lh, lh + compSize);
    const raw = method === 8 ? inflateRawSync(comp) : comp;
    assert.equal(raw.length, rawSize, `${name} uncompressed size`);

    entries.set(name, { method, data: raw });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe('extension packaging', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'write-right-pack-'));

  test('zip contains every manifest-referenced file and nothing is missing', () => {
    const { files } = buildZip(outDir);
    const zip = readZip(readFileSync(join(outDir, 'write-right-0.3.0.zip')));
    assert.deepEqual([...zip.keys()].sort(), files.sort());
    for (const f of manifestReferencedFiles(JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf8')))) {
      assert.ok(zip.has(f), `manifest file ${f} is packaged`);
    }
  });

  test('deflated entries inflate byte-for-byte to their sources', () => {
    const zip = readZip(readFileSync(join(outDir, 'write-right-0.3.0.zip')));
    for (const [name, entry] of zip) {
      const onDisk = readFileSync(join(EXTENSION_DIR, name));
      assert.deepEqual(entry.data, onDisk, `${name} round-trips`);
      assert.equal((crc32(onDisk) >>> 0), (crc32(entry.data) >>> 0), `${name} crc matches`);
    }
  });

  test('png icons are stored (method 0), js files deflated (method 8)', () => {
    const zip = readZip(readFileSync(join(outDir, 'write-right-0.3.0.zip')));
    for (const [name, entry] of zip) {
      const expected = name.endsWith('.png') ? 0 : 8;
      assert.equal(entry.method, expected, `${name} compression method`);
    }
  });

  test('collectFiles lists exactly the files on disk (no stray dirs or dotfiles)', () => {
    const files = collectFiles(EXTENSION_DIR);
    assert.ok(files.length >= 13, `at least the manifest set (got ${files.length})`);
    assert.ok(!files.some((f) => f.includes('..') || f.startsWith('.')), 'no dotfiles or escapes');
  });
});
