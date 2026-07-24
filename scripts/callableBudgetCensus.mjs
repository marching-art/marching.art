#!/usr/bin/env node
// =============================================================================
// CALLABLE WRITE-BUDGET CENSUS + RATCHET
// =============================================================================
// Every user-facing mutation callable must charge a per-uid write budget
// (helpers/callableGuards: assertWriteBudget / assertAuthWithBudget) — the
// abuse/billing throttle that stands in for App Check until enforcement
// flips. Historically that guard was per-file opt-in, so new callables
// shipped unthrottled by default. This census makes throttling the default:
// a callable file counts as guarded when it charges a budget OR gates every
// handler behind the admin claim (assertAdmin); anything else must be listed
// in the committed baseline with a reason (read-only files, webhook shims).
// Adding a NEW unguarded callable file fails CI.
//
// Usage:
//   node scripts/callableBudgetCensus.mjs            # print status
//   node scripts/callableBudgetCensus.mjs --check    # CI gate
//   node scripts/callableBudgetCensus.mjs --update   # rewrite the baseline
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'callable-budget.baseline.json');
const CALLABLE_DIR = join(ROOT, 'functions', 'src', 'callable');

const GUARD_RE = /assertWriteBudget|assertAuthWithBudget|assertAdmin/;

function census() {
  const unguarded = [];
  for (const name of readdirSync(CALLABLE_DIR).sort()) {
    if (!name.endsWith('.js') || name.endsWith('.test.js')) continue;
    const rel = relative(ROOT, join(CALLABLE_DIR, name));
    const source = readFileSync(join(CALLABLE_DIR, name), 'utf8');
    if (!GUARD_RE.test(source)) unguarded.push(rel);
  }
  return unguarded;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

const mode = process.argv[2] ?? '';
const unguarded = census();

if (mode === '--update' || mode === '--fix') {
  const previous = loadBaseline();
  const exempt = {};
  for (const rel of unguarded) {
    exempt[rel] = previous?.exempt?.[rel] ?? 'TODO: document why this file needs no budget';
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ exempt }, null, 2)}\n`);
  console.log(
    `Baseline written to scripts/callable-budget.baseline.json (${unguarded.length} exempt file(s)).`
  );
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error('No baseline found — run `node scripts/callableBudgetCensus.mjs --update` first.');
  process.exit(1);
}

const exemptFiles = new Set(Object.keys(baseline.exempt ?? {}));
const offenders = unguarded.filter((rel) => !exemptFiles.has(rel));
const stale = [...exemptFiles].filter((rel) => !unguarded.includes(rel));

if (offenders.length > 0) {
  console.error(
    `Callable write-budget census FAILED — ${offenders.length} unguarded callable file(s):\n`
  );
  for (const rel of offenders) console.error(`  ✗ ${rel}`);
  console.error(
    '\nEvery user-facing mutation callable must charge a per-uid write budget\n' +
      '(assertAuthWithBudget / assertWriteBudget from helpers/callableGuards) or be\n' +
      'admin-gated (assertAdmin). Genuinely read-only files may be exempted in\n' +
      'scripts/callable-budget.baseline.json with a documented reason.'
  );
  process.exit(1);
}

if (stale.length > 0 && mode !== '--check') {
  console.log(
    `Note: ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} now guarded — run --update to tidy: ${stale.join(', ')}`
  );
}

console.log(
  `Callable write-budget census passed: ${unguarded.length} exempt (read-only) file(s), 0 unguarded.`
);
