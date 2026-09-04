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
//   node scripts/auditRatchet.mjs --tolerate-outage
//       CI mode: a registry outage that outlasts every retry degrades to a
//       warning instead of a red run — see "Registry outages" below.
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'audit-baseline.json');

const update = process.argv.includes('--update');
const tolerateOutage =
  process.argv.includes('--tolerate-outage') || isTruthy(process.env.AUDIT_TOLERATE_OUTAGE);
const IS_GITHUB = isTruthy(process.env.GITHUB_ACTIONS);

/**
 * Registry stalls are the only way this gate has ever gone red without a real
 * regression. `npm audit` is one POST to the registry's advisory endpoint; when
 * that endpoint hangs, npm's own defaults (5-minute fetch timeout, 2 retries
 * with exponential backoff) can hold the step for the whole 15-minute job
 * budget, and every deploy gated on that run aborts with it.
 *
 * Layers, in the order they engage:
 *   1. npm is told to fail fast (short --fetch-timeout, no internal retries),
 *      so a stalled request surfaces as an npm error instead of a silent hang.
 *   2. A hard wall-clock cap per attempt (SIGKILL) backs that up in case npm
 *      ignores its own timeout (it has, in the wild).
 *   3. The wrapper retries transient failures with a short backoff — a stall
 *      that clears in a minute no longer needs a human to click "Re-run".
 *   4. Once ONE manifest has exhausted its retries the registry is treated as
 *      down for the whole run: the remaining manifests are not probed (they
 *      would only burn the job budget reproducing the same stall) and the run
 *      moves to the outage path below.
 *
 * Registry outages (all retries spent):
 *   The gate's question is "did THIS change introduce a high/critical prod
 *   advisory?", and that question has a registry-free answer for most PRs:
 *   if a manifest's package.json + lockfile are byte-identical to the base
 *   branch (AUDIT_BASE_REF, e.g. `origin/main`), its dependency graph did not
 *   change, so its count cannot have risen — it is reported as verified via
 *   the lockfile. Only manifests whose dependencies DID change are left
 *   genuinely unverified. Those fail the run unless `--tolerate-outage` is set,
 *   in which case they are surfaced as a GitHub warning annotation + step
 *   summary and the run passes; the weekly security.yml audit is the backstop.
 *   `--update` never tolerates an outage — a baseline needs real counts.
 *
 * npm tries the bulk advisory endpoint and then falls back to the quick one,
 * so one stalled attempt costs up to 2 × fetch-timeout before npm gives up;
 * the hard cap sits just above that. Worst case for the whole run is one
 * manifest's retry ladder — 3 × 75s + 20s backoff ≈ 4 min — because the first
 * exhausted manifest short-circuits the rest. Real transients fail in seconds
 * and retry quickly.
 *
 * Knobs, overridable for local debugging / a slow proxy:
 *   AUDIT_FETCH_TIMEOUT_MS  npm's per-request timeout (default 30000)
 *   AUDIT_ATTEMPTS          attempts per manifest (default 3)
 *   AUDIT_BASE_REF          git ref for the lockfile-unchanged fallback
 *                           (default: origin/main when that ref exists)
 *   AUDIT_TOLERATE_OUTAGE   same as --tolerate-outage
 */
const AUDIT_FETCH_TIMEOUT_MS = positiveInt(process.env.AUDIT_FETCH_TIMEOUT_MS, 30_000);
const AUDIT_TIMEOUT_MS = AUDIT_FETCH_TIMEOUT_MS * 2 + 15_000;
const AUDIT_ATTEMPTS = positiveInt(process.env.AUDIT_ATTEMPTS, 3);
/** Backoff before attempt n (1-based) — 0, 5s, 15s. */
const RETRY_DELAYS_MS = [0, 5_000, 15_000];

/** @param {string | undefined} raw @param {number} fallback */
function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** @param {string | undefined} raw */
function isTruthy(raw) {
  return /^(1|true|yes|on)$/i.test(String(raw ?? '').trim());
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

/** Thrown when a manifest's retry ladder is spent — the registry is down. */
class RegistryOutageError extends Error {
  /** @param {string} dir @param {TransientAuditError} last */
  constructor(dir, last) {
    super(
      `npm audit for "${dir}" ${last.message} on all ${AUDIT_ATTEMPTS} attempts — ` +
        'the registry advisory endpoint is stalled or unreachable.'
    );
    this.name = 'RegistryOutageError';
    this.dir = dir;
    this.detail = last.detail;
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

/**
 * High+critical prod-dependency advisory count for one manifest directory.
 * Throws RegistryOutageError once every attempt has failed transiently.
 */
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
  throw new RegistryOutageError(dir, lastErr);
}

// -----------------------------------------------------------------------------
// Outage fallback: "did this change touch the manifest's dependency graph?"
// -----------------------------------------------------------------------------

/** @param {string[]} args @param {{ allowFail?: boolean }} [opts] */
function git(args, opts = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    }).trim();
  } catch (err) {
    if (opts.allowFail) return null;
    throw err;
  }
}

/** The git ref the lockfile-unchanged fallback diffs against, or null. */
function resolveBaseRef() {
  const explicit = process.env.AUDIT_BASE_REF?.trim();
  const ref = explicit || 'origin/main';
  // Refresh the remote-tracking ref first: a shallow CI checkout
  // (actions/checkout fetch-depth 1) doesn't carry the base branch at all, and
  // a long-lived local clone carries a stale one. Offline, fall back to
  // whatever is already there.
  const m = ref.match(/^([^/]+)\/(.+)$/);
  if (m) {
    git(
      ['fetch', '--depth=1', '--quiet', m[1], `+refs/heads/${m[2]}:refs/remotes/${m[1]}/${m[2]}`],
      {
        allowFail: true,
      }
    );
  }
  return git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true })
    ? ref
    : null;
}

/** Files that define a manifest's production dependency graph. */
function graphFiles(dir) {
  return ['package.json', 'package-lock.json', 'npm-shrinkwrap.json']
    .map((f) => relative(repoRoot, join(repoRoot, dir, f)))
    .filter((p) => existsSync(join(repoRoot, p)));
}

/**
 * True when the manifest's dependency graph is identical to the base ref,
 * meaning the audit count cannot have risen in this change. Null when it
 * can't be determined (no base ref, git error).
 */
function graphUnchangedSince(dir, baseRef) {
  if (!baseRef) return null;
  const files = graphFiles(dir);
  if (files.length === 0) return null;
  // Worktree state (not HEAD) is what CI installs from, so diff against it.
  const diff = git(['diff', '--quiet', baseRef, '--', ...files], { allowFail: true });
  if (diff === null) {
    // Exit 1 = differences (execFileSync throws); distinguish from a real
    // git failure by re-running with --stat.
    const stat = git(['diff', '--stat', baseRef, '--', ...files], { allowFail: true });
    return stat === null ? null : false;
  }
  return true;
}

/** @param {string} title @param {string} body */
function annotate(title, body) {
  const flat = body.replace(/\r?\n/g, ' ');
  console.warn(IS_GITHUB ? `::warning title=${title}::${flat}` : `WARNING: ${title} — ${flat}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ⚠️ ${title}\n\n${body}\n\n`);
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const baselineDoc = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baseline = baselineDoc.baseline;
const dirs = Object.keys(baseline);

/** @type {Record<string, number>} */
const current = {};
/** @type {RegistryOutageError | null} */
let outage = null;
for (const dir of dirs) {
  try {
    current[dir] = highCriticalCount(dir);
  } catch (err) {
    if (!(err instanceof RegistryOutageError)) throw err;
    outage = err;
    break; // Registry is down; probing the rest only burns the job budget.
  }
}

if (update) {
  if (outage) {
    console.error(
      `\n✗ ${outage.message}\n  --update needs real counts; re-run once the registry answers.`
    );
    if (outage.detail) console.error(`    last npm error: ${outage.detail}`);
    process.exit(1);
  }
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
/** Manifests the registry never answered for, split by the lockfile fallback. */
const viaLockfile = [];
const unverified = [];
const baseRef = outage ? resolveBaseRef() : null;

for (const dir of dirs) {
  const before = baseline[dir];
  const after = current[dir];
  if (after === undefined) {
    const unchanged = graphUnchangedSince(dir, baseRef);
    if (unchanged) {
      viaLockfile.push(dir);
      console.log(
        `  = ${dir}: registry unavailable; dependency graph unchanged vs ${baseRef} → cannot have risen`
      );
    } else {
      unverified.push(dir);
      console.log(
        `  ? ${dir}: registry unavailable; dependency graph ${unchanged === false ? `differs from ${baseRef}` : 'has no base ref to compare to'} → UNVERIFIED`
      );
    }
    continue;
  }
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

if (outage) {
  const detail = outage.detail ? `\nlast npm error: ${outage.detail}` : '';
  if (unverified.length > 0) {
    const body =
      `${outage.message}\nUnverified manifest(s) whose dependencies changed in this run: ` +
      `${unverified.map((d) => `\`${d}\``).join(', ')}.` +
      (viaLockfile.length > 0
        ? `\nVerified via unchanged lockfile: ${viaLockfile.map((d) => `\`${d}\``).join(', ')}.`
        : '') +
      detail;
    if (!tolerateOutage) {
      console.error(
        `\n✗ ${body}\n  Re-run the job once the registry answers; this is not a dependency regression.`
      );
      process.exit(1);
    }
    annotate(
      'Dependency-audit ratchet: registry outage, changed manifests unverified',
      `${body}\nPassing under --tolerate-outage; the weekly security.yml audit is the backstop. ` +
        'Re-run this job to get a real verdict.'
    );
    console.log(
      '\n⚠ Dependency-audit ratchet passed with UNVERIFIED manifests (registry outage tolerated).'
    );
    process.exit(0);
  }
  annotate(
    'Dependency-audit ratchet: registry outage, verified via lockfiles',
    `${outage.message}\nEvery unreached manifest (${viaLockfile.map((d) => `\`${d}\``).join(', ')}) ` +
      `has a dependency graph identical to ${baseRef}, so no count can have risen.${detail}`
  );
  console.log(
    '\n✓ Dependency-audit ratchet passed (registry outage; unchanged lockfiles verified).'
  );
  process.exit(0);
}

if (fell.length > 0) {
  console.log(
    '\n↓ Some counts fell below baseline. Run `node scripts/auditRatchet.mjs --update` to ratchet the ceiling down.'
  );
}
console.log('\n✓ Dependency-audit ratchet passed.');
