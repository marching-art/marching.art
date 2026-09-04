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

/**
 * Registry stalls are the only way this gate has ever gone red without a real
 * regression. `npm audit` is one POST to the registry's advisory endpoint; when
 * that endpoint hangs, npm's own defaults (5-minute fetch timeout, 2 retries
 * with exponential backoff) can hold the step for the whole 15-minute job
 * budget, and every deploy gated on that run aborts with it.
 *
 * Three layers keep a hiccup from becoming a failed run:
 *   1. npm is told to fail fast (short --fetch-timeout, no internal retries),
 *      so a stalled request surfaces as an npm error instead of a silent hang.
 *   2. A hard wall-clock cap per attempt (SIGKILL) backs that up in case npm
 *      ignores its own timeout (it has, in the wild).
 *   3. The wrapper retries transient failures with a short backoff — a stall
 *      that clears in a minute no longer needs a human to click "Re-run".
 *
 * npm tries the bulk advisory endpoint and then falls back to the quick one,
 * so one stalled attempt costs up to 2 × fetch-timeout before npm gives up;
 * the hard cap sits just above that. Worst case per manifest is
 * 3 × 45s + 20s backoff ≈ 2.6 min, ≈ 13 min across all five manifests — still
 * inside the job's 15-minute budget, and reached only when EVERY attempt for
 * EVERY manifest hangs the full cap (an outage, not a hiccup). Real transients
 * fail in seconds and retry quickly.
 *
 * Knobs, overridable for local debugging / a slow proxy:
 *   AUDIT_FETCH_TIMEOUT_MS  npm's per-request timeout (default 15000)
 *   AUDIT_ATTEMPTS          attempts per manifest (default 3)
 */
const AUDIT_FETCH_TIMEOUT_MS = positiveInt(process.env.AUDIT_FETCH_TIMEOUT_MS, 15_000);
const AUDIT_TIMEOUT_MS = AUDIT_FETCH_TIMEOUT_MS * 2 + 15_000;
const AUDIT_ATTEMPTS = positiveInt(process.env.AUDIT_ATTEMPTS, 3);
/** Backoff before attempt n (1-based) — 0, 5s, 15s. */
const RETRY_DELAYS_MS = [0, 5_000, 15_000];

/** @param {string | undefined} raw @param {number} fallback */
function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Errors that mean "the registry didn't answer", not "the manifest is bad".
 * npm surfaces these three ways depending on version and endpoint: a
 * `{ error: { code } }` JSON body, a `{ message: "network timeout at: …" }`
 * body with an empty error (npm 10 audit fallback), or stderr only.
 */
const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ERR_SOCKET_TIMEOUT',
  'FETCH_ERROR',
  'E408',
  'E429',
  'E500',
  'E502',
  'E503',
  'E504',
]);
const TRANSIENT_TEXT =
  /network timeout|fetch failed|socket hang up|ECONN\w+|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|E(?:408|429|50[0-4])\b|audit endpoint returned an error|Service Unavailable|Gateway Time-?out|Bad Gateway/i;

class TransientAuditError extends Error {
  /** @param {string} message @param {string} [detail] */
  constructor(message, detail) {
    super(message);
    this.name = 'TransientAuditError';
    this.detail = detail;
  }
}

/** @param {number} ms */
function sleepSync(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** One `npm audit --json` call. Returns the parsed report or throws. */
function runAuditOnce(dir) {
  const args = [
    'audit',
    '--omit=dev',
    '--json',
    // Fail fast at the npm layer; the wrapper owns retries so we get clear
    // per-attempt errors instead of one opaque 12-minute hang.
    `--fetch-timeout=${AUDIT_FETCH_TIMEOUT_MS}`,
    '--fetch-retries=0',
    '--no-fund',
    '--no-update-notifier',
  ];
  let json = '';
  let stderr = '';
  try {
    // npm audit exits non-zero when advisories exist; capture stdout regardless.
    json = execFileSync('npm', args, {
      cwd: join(repoRoot, dir),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: AUDIT_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.signal === 'SIGKILL') {
      throw new TransientAuditError(`did not answer within ${AUDIT_TIMEOUT_MS / 1000}s (hard cap)`);
    }
    json = err.stdout ? err.stdout.toString() : '';
    stderr = err.stderr ? err.stderr.toString() : '';
  }

  let report;
  try {
    report = json ? JSON.parse(json) : null;
  } catch {
    report = null;
  }

  // Happy path (advisories or not): the report carries a metadata block.
  if (report?.metadata?.vulnerabilities) return report;

  // No usable report. Classify: registry/network trouble is retried, anything
  // else (bad lockfile, missing manifest, npm itself broken) fails outright.
  const code = report?.error?.code || stderr.match(/\b(E\d{3}|E[A-Z_]{4,})\b/)?.[1];
  const text = [report?.message, report?.error?.summary, report?.error?.detail, stderr]
    .filter(Boolean)
    .join('\n');
  const summary =
    report?.message ||
    report?.error?.summary ||
    stderr.trim().split('\n').filter(Boolean).slice(-3).join(' ');
  if ((code && TRANSIENT_CODES.has(code)) || TRANSIENT_TEXT.test(text)) {
    throw new TransientAuditError(`registry request failed${code ? ` (${code})` : ''}`, summary);
  }
  if (!json && !stderr) {
    throw new TransientAuditError('npm audit produced no output');
  }
  throw new Error(
    `npm audit for "${dir}" failed with a non-transient error` +
      (code ? ` (${code})` : '') +
      (summary ? `: ${summary}` : '')
  );
}

/** High+critical prod-dependency advisory count for one manifest directory. */
function highCriticalCount(dir) {
  let lastErr;
  for (let attempt = 1; attempt <= AUDIT_ATTEMPTS; attempt++) {
    const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
    if (attempt > 1) {
      console.warn(
        `  ⟳ ${dir}: ${lastErr.message} — retrying in ${delay / 1000}s (attempt ${attempt}/${AUDIT_ATTEMPTS})`
      );
      sleepSync(delay);
    }
    try {
      const vulns = runAuditOnce(dir).metadata.vulnerabilities;
      return (vulns.high || 0) + (vulns.critical || 0);
    } catch (err) {
      if (!(err instanceof TransientAuditError)) throw err;
      lastErr = err;
    }
  }
  throw new Error(
    `npm audit for "${dir}" ${lastErr.message} on all ${AUDIT_ATTEMPTS} attempts — ` +
      'the registry advisory endpoint is stalled or unreachable. Re-run the job; ' +
      'this is not a dependency regression.' +
      (lastErr.detail ? `\n    last npm error: ${lastErr.detail}` : '')
  );
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
