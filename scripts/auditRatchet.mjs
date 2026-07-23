#!/usr/bin/env node
// =============================================================================
// DEPENDENCY-AUDIT RATCHET
// =============================================================================
// A blocking, PR-time supply-chain gate that does NOT sit red on pre-existing
// debt. For each workspace manifest it counts high+critical advisories in
// PRODUCTION dependencies (`npm audit --omit=dev`) and compares to the committed
// baseline (scripts/audit-baseline.json).
//
// Ratchet rule (same shape as designCensus / tsNocheckCensus): a manifest's
// count may only FALL. The gate fails if any count EXCEEDS its baseline — i.e.
// a PR introduced a new high/critical prod vulnerability — while the existing
// advisories Dependabot is already working down never block a merge. When a
// Dependabot PR lowers a count, run `--update` to ratchet the ceiling down.
//
// Dev-only advisories (eslint/vite/playwright tooling) are intentionally out of
// scope via --omit=dev: they don't ship to users, and the weekly security.yml
// job already reports the full picture.
//
// Usage:
//   node scripts/auditRatchet.mjs            # CI gate: fail if any count rose
//   node scripts/auditRatchet.mjs --update   # rewrite baseline to current counts
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'audit-baseline.json');

const update = process.argv.includes('--update');

/** High+critical prod-dependency advisory count for one manifest directory. */
function highCriticalCount(dir) {
  let json;
  try {
    // npm audit exits non-zero when advisories exist; capture stdout regardless.
    json = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      cwd: join(repoRoot, dir),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    json = err.stdout ? err.stdout.toString() : '';
  }
  if (!json) throw new Error(`npm audit produced no output for "${dir}"`);
  const vulns = JSON.parse(json).metadata?.vulnerabilities || {};
  return (vulns.high || 0) + (vulns.critical || 0);
}

const baselineDoc = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baseline = baselineDoc.baseline;
const dirs = Object.keys(baseline);

const current = {};
for (const dir of dirs) {
  current[dir] = highCriticalCount(dir);
}

if (update) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ ...baselineDoc, baseline: current }, null, 2)}\n`
  );
  console.log('audit-baseline.json updated:');
  for (const dir of dirs) console.log(`  ${dir}: ${current[dir]}`);
  process.exit(0);
}

const rose = [];
const fell = [];
for (const dir of dirs) {
  const before = baseline[dir];
  const after = current[dir];
  const mark = after > before ? '✗' : after < before ? '↓' : '·';
  console.log(`  ${mark} ${dir}: ${after} (baseline ${before}) high+critical prod advisories`);
  if (after > before) rose.push({ dir, before, after });
  if (after < before) fell.push({ dir, before, after });
}

if (rose.length > 0) {
  console.error('\n✗ Dependency-audit ratchet FAILED — new high/critical prod advisories:');
  for (const { dir, before, after } of rose) {
    console.error(
      `    ${dir}: ${before} → ${after}. Update the dependency or justify the advisory.`
    );
  }
  process.exit(1);
}

if (fell.length > 0) {
  console.log(
    '\n↓ Some counts fell below baseline. Run `node scripts/auditRatchet.mjs --update` to ratchet the ceiling down.'
  );
}
console.log('\n✓ Dependency-audit ratchet passed.');
