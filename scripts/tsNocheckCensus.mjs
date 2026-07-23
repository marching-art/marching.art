#!/usr/bin/env node
// =============================================================================
// @ts-nocheck CENSUS + RATCHET
// =============================================================================
// 213+ grandfathered files carry a `// @ts-nocheck -- grandfathered before
// checkJs` header that opts them out of checkJs. This script counts the files
// that still carry a @ts-nocheck header and enforces a ratchet against the
// committed baseline (scripts/ts-nocheck.baseline.json), mirroring the
// design-census and path-literal ratchets: the count may only fall. Typing (or
// deleting) a file removes its header; adding a header to a new file fails CI.
// When a sweep lowers the count, run --update to lock the new ceiling.
//
// Usage:
//   node scripts/tsNocheckCensus.mjs            # print the count vs baseline
//   node scripts/tsNocheckCensus.mjs --check    # CI gate: fail if count rose
//   node scripts/tsNocheckCensus.mjs --files    # list every file with a header
//   node scripts/tsNocheckCensus.mjs --update   # (re)write the baseline ceiling
//                                               # (--fix is an alias)
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'ts-nocheck.baseline.json');
const SCAN_DIRS = ['src', 'functions/src'];

// A @ts-nocheck comment anywhere in the leading comment block of the file.
// In practice every grandfathered file uses the exact first-line header
// `// @ts-nocheck -- grandfathered before checkJs; ...`, but any @ts-nocheck
// directive suppresses checking, so match the directive itself.
const TS_NOCHECK_RE = /^\s*\/\/\s*@ts-nocheck\b/m;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(name)) {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

function census() {
  const offenders = [];
  const perDir = {};
  for (const dir of SCAN_DIRS) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    let count = 0;
    for (const rel of walk(full)) {
      if (TS_NOCHECK_RE.test(readFileSync(join(ROOT, rel), 'utf8'))) {
        offenders.push(rel);
        count += 1;
      }
    }
    perDir[dir] = count;
  }
  offenders.sort();
  return { total: offenders.length, perDir, offenders };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

const arg = process.argv[2];

if (arg === '--update' || arg === '--fix') {
  const { total, perDir } = census();
  const payload = {
    _note:
      'Ratchet ceiling for files carrying a `// @ts-nocheck` header (grandfathered ' +
      'before checkJs). The count may only fall: type or clean up a file, delete its ' +
      'header, then run `node scripts/tsNocheckCensus.mjs --update` to lock the new ' +
      'floor. Never edit these upward by hand.',
    total,
    perDir,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)} (${total} files).`);
  process.exit(0);
}

if (arg === '--files') {
  const { total, offenders } = census();
  for (const rel of offenders) console.log(rel);
  console.log(`\n${total} files carry a @ts-nocheck header.`);
  process.exit(0);
}

if (arg === '--check') {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error('No baseline found. Run `node scripts/tsNocheckCensus.mjs --update` first.');
    process.exit(2);
  }
  const { total } = census();
  const ceil = baseline.total ?? 0;
  if (total > ceil) {
    console.error(
      `\nX @ts-nocheck ratchet FAILED — header count rose: ${ceil} -> ${total} (+${total - ceil}).`
    );
    console.error('\nNew files must pass checkJs without a @ts-nocheck header. Either type the');
    console.error('new code, or remove a header from a grandfathered file to compensate.');
    console.error('Offending files: node scripts/tsNocheckCensus.mjs --files\n');
    process.exit(1);
  }
  if (total < ceil) {
    console.log(
      `@ts-nocheck ratchet holds; count fell (${ceil} -> ${total}). ` +
        'Lower the ceiling with `node scripts/tsNocheckCensus.mjs --update`.'
    );
  } else {
    console.log(`@ts-nocheck ratchet holds (${total} files, ceiling ${ceil}).`);
  }
  process.exit(0);
}

// Default: print the census.
const { total, perDir } = census();
const baseline = loadBaseline();
console.log(`\n@ts-nocheck census — files still carrying a grandfathered header\n`);
for (const [dir, count] of Object.entries(perDir)) {
  console.log(`  ${dir.padEnd(16)} ${String(count).padStart(5)}`);
}
console.log(
  `  ${'TOTAL'.padEnd(16)} ${String(total).padStart(5)}   (ceiling ${baseline ? baseline.total : '—'})`
);
console.log('\n  List offenders:            node scripts/tsNocheckCensus.mjs --files');
console.log('  Enforce the ratchet (CI):  npm run ts-nocheck:check');
console.log('  Lock a lowered count:      node scripts/tsNocheckCensus.mjs --update\n');
