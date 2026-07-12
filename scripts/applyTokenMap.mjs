#!/usr/bin/env node
// =============================================================================
// TOKEN CODEMOD — applies scripts/tokenMap.json across src/
// =============================================================================
// Deterministic mechanical half of the visual-identity sweep (§5, Step 7).
// Rewrites hardcoded Tailwind color classes to semantic tokens using the single
// authoritative map, so the bulk of the migration is 100% consistent by
// construction — no per-file drift. The judgment half (gold reassignment,
// emphasis) is handled separately by the fan-out.
//
//   node scripts/applyTokenMap.mjs           # apply the map in place
//   node scripts/applyTokenMap.mjs --dry     # report what would change, no writes
//
// Hex classes (contain "[") match case-insensitively. Named classes are
// boundary-guarded so e.g. text-gray-400 never matches a longer neighbour.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const MAP = JSON.parse(readFileSync(join(ROOT, 'scripts', 'tokenMap.json'), 'utf8'));
const EXCLUDE = [/\.test\./, /\.spec\./, /setupTests/, /\/stories\//, /\.d\.ts$/];
const DRY = process.argv.includes('--dry');

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build [regex, replacement] pairs from the map (skip _note metadata).
const rules = Object.entries(MAP)
  .filter(([from]) => !from.startsWith('_'))
  .map(([from, to]) => {
    const re = from.includes('[')
      ? new RegExp(escape(from), 'gi') // arbitrary-hex class — case-insensitive
      : new RegExp(`(?<![\\w-])${escape(from)}(?![\\w-])`, 'g'); // named class
    return { from, to, re };
  });

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(?:js|jsx|ts|tsx)$/.test(name)) {
      const rel = relative(ROOT, full);
      if (!EXCLUDE.some((rx) => rx.test(rel))) out.push(rel);
    }
  }
  return out;
}

const files = walk(SRC);
let filesChanged = 0;
let totalReplacements = 0;
const perRule = {};

for (const rel of files) {
  const abs = join(ROOT, rel);
  const before = readFileSync(abs, 'utf8');
  let after = before;
  for (const { from, to, re } of rules) {
    after = after.replace(re, () => {
      perRule[from] = (perRule[from] || 0) + 1;
      totalReplacements++;
      return to;
    });
  }
  if (after !== before) {
    filesChanged++;
    if (!DRY) writeFileSync(abs, after);
  }
}

console.log(`${DRY ? '[dry run] ' : ''}${totalReplacements} replacements across ${filesChanged} files.\n`);
const rows = Object.entries(perRule).sort((a, b) => b[1] - a[1]);
for (const [from, n] of rows) console.log(`${String(n).padStart(5)}  ${from} → ${MAP[from]}`);
console.log(`\n${rows.length} of ${rules.length} rules matched.`);
