/**
 * Content-script split tests — guard the no-bundler multi-file arrangement.
 *
 * The former single-file content script was split into the files listed in
 * manifest.json (same isolated world, loaded in order, sharing top-level
 * scope — i.e. semantics identical to one concatenated script). These tests
 * lock in the properties that make the split safe:
 *   1. manifest order is the canonical dependency order;
 *   2. concatenating the parts in that order parses (node --check);
 *   3. no top-level declaration is duplicated across parts;
 *   4. exactly one top-level call to init() exists (the bootstrap).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION_DIR = fileURLToPath(new URL('../extension/', import.meta.url));

const CANONICAL_ORDER = [
  'content-core.js',
  'content-badge.js',
  'content-popups.js',
  'content-highlights.js',
  'content-grammar.js',
  'content-synonyms.js',
  'content-events.js',
];

/** Top-level declarations: `const/let/function/async function/class` at column 0. */
const TOP_LEVEL = /^(?:async function|function|const|let|class) ([A-Za-z_$][\w$]*)/gm;

function readManifest() {
  return JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
}

describe('content script split', () => {
  test('manifest lists exactly the canonical parts in dependency order', () => {
    const js = readManifest().content_scripts[0].js;
    assert.deepEqual(js, CANONICAL_ORDER, 'manifest order must match the canonical order');
  });

  test('concatenated parts parse as one script (node --check)', () => {
    const manifest = readManifest();
    const source = manifest.content_scripts[0].js
      .map((f) => readFileSync(join(EXTENSION_DIR, f), 'utf8'))
      .join('\n');
    const dir = mkdtempSync(join(tmpdir(), 'wr-split-'));
    const file = join(dir, 'concat.js');
    writeFileSync(file, source);
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every part parses standalone (no mid-function cut)', () => {
    for (const f of CANONICAL_ORDER) {
      const dir = mkdtempSync(join(tmpdir(), 'wr-part-'));
      const file = join(dir, f);
      writeFileSync(file, readFileSync(join(EXTENSION_DIR, f)));
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('no top-level declaration is duplicated across parts', () => {
    const seen = new Map(); // name -> part
    for (const f of CANONICAL_ORDER) {
      const source = readFileSync(join(EXTENSION_DIR, f), 'utf8');
      for (const m of source.matchAll(TOP_LEVEL)) {
        if (seen.has(m[1])) {
          assert.fail(`${m[1]} declared in both ${seen.get(m[1])} and ${f}`);
        }
        seen.set(m[1], f);
      }
    }
  });

  test('init() is invoked exactly once (the single bootstrap)', () => {
    let calls = 0;
    for (const f of CANONICAL_ORDER) {
      const source = readFileSync(join(EXTENSION_DIR, f), 'utf8');
      calls += (source.match(/^init\(\);$/gm) || []).length;
    }
    assert.equal(calls, 1, 'exactly one top-level init() call across all parts');
  });
});
