#!/usr/bin/env node
// =============================================================================
// FIRESTORE PATH-LITERAL RATCHET
// =============================================================================
// The rule (ARCHITECTURE.md): never hand-write `artifacts/...` Firestore path
// strings — compose them with the path builders instead:
//   - backend:  functions/src/helpers/paths.js
//   - frontend: src/api/client.ts (`paths`)
//
// This script counts the hand-written literals that remain and enforces a
// ratchet against the committed baseline (scripts/path-literals.baseline.json),
// mirroring the design-census ratchet: no file's count may EXCEED its baseline
// and no new offender file may appear. Counts may only fall. When a sweep
// lowers a count, run --write to lock the new ceiling.
//
// Counted:
//   - quoted/template literals containing `artifacts/` (e.g. `artifacts/${ns}/...`)
//   - segment-style path construction starting with 'artifacts', (e.g.
//     doc(db, 'artifacts', DATA_NAMESPACE, ...)) — still a hand-built path
// Not counted:
//   - comment lines (// or *) — prose mentions of paths are fine
//   - the two path-builder modules themselves and src/config/index.ts (which
//     defines the namespace), test files, and __fixtures__
//
// Known intentional exceptions living in the baseline:
//   - Firestore TRIGGER document patterns (onDocumentWritten/... config) are
//     static deploy-time strings; params/helpers cannot be used there
//     (functions/src/triggers/{avatarGeneration,emailTriggers,pushTriggers}.js).
//   - src/api/community.ts reads the frozen legacy 'fantasy_drum_corps_v1'
//     namespace for landing-page stats — see the NOTE at the top of that file.
//   - functions/src/scripts/cleanupLeakedProfileEmails.js is a standalone ops
//     script that resolves its namespace from process.env, not function params.
//
// Usage:
//   node scripts/checkPathLiterals.mjs           # CI gate: fail if any count rose
//   node scripts/checkPathLiterals.mjs --list    # print every offender line
//   node scripts/checkPathLiterals.mjs --write   # (re)write the baseline ceiling
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'path-literals.baseline.json');
const SCAN_DIRS = ['src', 'functions/src'];

// The path-builder modules themselves plus the namespace definition.
const EXEMPT_FILES = new Set([
  'functions/src/helpers/paths.js',
  'src/api/client.ts',
  'src/config/index.ts',
]);
const EXCLUDE = [/\.test\./, /\.spec\./, /__fixtures__/, /setupTests/, /\.d\.ts$/];

// Quoted/template literal containing `artifacts/`, or segment-style
// path construction starting with an 'artifacts' segment argument.
const LITERAL_RE = /["'`]artifacts\/|["'`]artifacts["'`]\s*,/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(name)) {
      const rel = relative(ROOT, full);
      if (EXEMPT_FILES.has(rel)) continue;
      if (!EXCLUDE.some((rx) => rx.test(rel))) out.push(rel);
    }
  }
  return out;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function census() {
  const perFile = {};
  const offenders = [];
  let total = 0;
  for (const dir of SCAN_DIRS) {
    for (const rel of walk(join(ROOT, dir))) {
      const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
      let count = 0;
      lines.forEach((line, i) => {
        if (isCommentLine(line)) return;
        const matches = line.match(LITERAL_RE) || [];
        if (matches.length) {
          count += matches.length;
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
      if (count > 0) {
        perFile[rel] = count;
        total += count;
      }
    }
  }
  return { total, perFile, offenders };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

const arg = process.argv[2];

if (arg === '--write') {
  const { total, perFile } = census();
  const payload = {
    _note:
      'Ratchet ceiling for hand-written artifacts/ Firestore path literals ' +
      '(use the paths helpers: functions/src/helpers/paths.js, src/api/client.ts). ' +
      'Counts may only fall. After lowering a count, run ' +
      '`node scripts/checkPathLiterals.mjs --write` to lock the new floor. ' +
      'Never edit these upward by hand. Remaining entries are the known ' +
      'exceptions documented in scripts/checkPathLiterals.mjs.',
    total,
    files: perFile,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)} (${total} literals).`);
  process.exit(0);
}

if (arg === '--list') {
  const { total, offenders } = census();
  for (const line of offenders) console.log(line);
  console.log(`\n${offenders.length} offending lines, ${total} literals.`);
  process.exit(0);
}

// Default mode: enforce the ratchet (what CI runs).
const baseline = loadBaseline();
if (!baseline) {
  console.error('No baseline found. Run `node scripts/checkPathLiterals.mjs --write` first.');
  process.exit(2);
}
const { total, perFile } = census();
const rose = [];
let fell = false;
const allFiles = new Set([...Object.keys(perFile), ...Object.keys(baseline.files)]);
for (const rel of allFiles) {
  const now = perFile[rel] ?? 0;
  const ceil = baseline.files[rel] ?? 0;
  if (now > ceil) rose.push({ rel, now, ceil });
  else if (now < ceil) fell = true;
}

if (rose.length) {
  console.error('\nX Path-literal ratchet FAILED — hand-written artifacts/ paths increased:\n');
  for (const { rel, now, ceil } of rose) {
    console.error(`  ${rel}: ${ceil} -> ${now}  (+${now - ceil})`);
  }
  console.error('\nCompose Firestore paths with the helpers instead of writing literals:');
  console.error('  backend:  const { paths } = require(".../helpers/paths");');
  console.error("  frontend: import { paths } from '@/api/client';");
  console.error('Offending lines: node scripts/checkPathLiterals.mjs --list\n');
  process.exit(1);
}
if (fell || total < baseline.total) {
  console.log(
    `Path-literal ratchet holds; count fell (${baseline.total} -> ${total}). ` +
      'Lower the ceiling with `node scripts/checkPathLiterals.mjs --write`.'
  );
} else {
  console.log(`Path-literal ratchet holds (${total} literals, ceiling ${baseline.total}).`);
}
process.exit(0);
