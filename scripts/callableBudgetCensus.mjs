#!/usr/bin/env node
// =============================================================================
// CALLABLE WRITE-BUDGET CENSUS + RATCHET
// =============================================================================
// Every user-facing mutation callable must charge a per-uid write budget
// (helpers/callableGuards: assertWriteBudget / assertAuthWithBudget) — the
// abuse/billing throttle that stands in for App Check until enforcement
// flips. Historically that guard was per-file opt-in, so new callables
// shipped unthrottled by default. This census makes throttling the default.
//
// Scope: functions/src/callable (all files) plus any functions/src/triggers
// or functions/src/scheduled file that exports an onCall — the old census
// only looked at callable/, so onCall handlers living next to their trigger
// (avatar generation, news feed, submissions) shipped unthrottled unnoticed.
//
// Granularity: per CALLABLE, not per file. Each `exports.<name> = onCall(`
// block counts as guarded when its handler charges a budget OR gates on the
// admin claim (assertAdmin); anything else must be listed in the committed
// baseline (keyed `path#exportName`) with a reason (read-only handlers,
// webhook shims). Adding a NEW unguarded callable fails CI.
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
const SCAN_DIRS = [
  join(ROOT, 'functions', 'src', 'callable'),
  join(ROOT, 'functions', 'src', 'triggers'),
  join(ROOT, 'functions', 'src', 'scheduled'),
];

const GUARD_RE = /assertWriteBudget|assertAuthWithBudget|assertAdmin/;
const ONCALL_EXPORT_RE = /^exports\.(\w+)\s*=\s*onCall\(/gm;
const ANY_EXPORT_RE = /^exports\.\w+\s*=/gm;

/**
 * Enumerate every `exports.<name> = onCall(` in a source file and report the
 * unguarded ones. A callable's "block" runs from its export assignment to the
 * next `exports.` assignment (or EOF) — the guard call always sits inside the
 * handler, so a guard match within the block means this callable is guarded.
 */
function unguardedCallables(source) {
  const exportStarts = [...source.matchAll(ANY_EXPORT_RE)].map((m) => m.index);
  const offenders = [];
  for (const match of source.matchAll(ONCALL_EXPORT_RE)) {
    const start = match.index;
    const end = exportStarts.find((i) => i > start) ?? source.length;
    if (!GUARD_RE.test(source.slice(start, end))) offenders.push(match[1]);
  }
  return offenders;
}

function census() {
  const unguarded = [];
  for (const dir of SCAN_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.js') || name.endsWith('.test.js')) continue;
      const rel = relative(ROOT, join(dir, name));
      const source = readFileSync(join(dir, name), 'utf8');
      if (!source.includes('onCall(')) continue;
      for (const exportName of unguardedCallables(source)) {
        unguarded.push(`${rel}#${exportName}`);
      }
    }
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
  for (const key of unguarded) {
    exempt[key] = previous?.exempt?.[key] ?? 'TODO: document why this callable needs no budget';
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ exempt }, null, 2)}\n`);
  console.log(
    `Baseline written to scripts/callable-budget.baseline.json (${unguarded.length} exempt callable(s)).`
  );
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error('No baseline found — run `node scripts/callableBudgetCensus.mjs --update` first.');
  process.exit(1);
}

const exemptKeys = new Set(Object.keys(baseline.exempt ?? {}));
const offenders = unguarded.filter((key) => !exemptKeys.has(key));
const stale = [...exemptKeys].filter((key) => !unguarded.includes(key));

if (offenders.length > 0) {
  console.error(
    `Callable write-budget census FAILED — ${offenders.length} unguarded callable(s):\n`
  );
  for (const key of offenders) console.error(`  ✗ ${key}`);
  console.error(
    '\nEvery user-facing mutation callable must charge a per-uid write budget\n' +
      '(assertAuthWithBudget / assertWriteBudget from helpers/callableGuards) or be\n' +
      'admin-gated (assertAdmin). Genuinely read-only callables may be exempted in\n' +
      'scripts/callable-budget.baseline.json (key: path#exportName) with a\n' +
      'documented reason.'
  );
  process.exit(1);
}

if (stale.length > 0 && mode !== '--check') {
  console.log(
    `Note: ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} now guarded — run --update to tidy: ${stale.join(', ')}`
  );
}

console.log(
  `Callable write-budget census passed: ${unguarded.length} exempt (read-only) callable(s), 0 unguarded.`
);
