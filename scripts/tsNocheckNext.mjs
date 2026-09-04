#!/usr/bin/env node
// =============================================================================
// @ts-nocheck NEXT-TARGET FINDER
// =============================================================================
// Companion to scripts/tsNocheckCensus.mjs. The census ratchets the header
// count downward; this script tells you WHICH header is cheapest to remove
// next, so knocking one out every time you touch the repo stays a two-minute
// job instead of a hunt.
//
// It temporarily strips the `// @ts-nocheck` header from every grandfathered
// file, runs the same checkJs passes CI runs (`tsc --noEmit` for the app,
// `tsc -p functions` for the backend), attributes each error to its file, then
// restores every file. Files that report ZERO errors are free wins: delete the
// header, run `node scripts/tsNocheckCensus.mjs --update`, done. The rest are
// ranked by error count so you can pick the smallest real fix.
//
// Usage:
//   node scripts/tsNocheckNext.mjs           # scan src + functions/src
//   node scripts/tsNocheckNext.mjs --app     # app pass only (no functions deps)
//   node scripts/tsNocheckNext.mjs -n 25     # show more ranked candidates
//
// TRUSTWORTHINESS: a "0 errors" verdict is only meaningful if the compiler
// actually type-checked the file. So the scan runs the repo-pinned
// `node_modules/typescript` directly (never `npx tsc`, which silently falls
// back to whatever global tsc is on PATH — a fresh web container ships
// TypeScript 6, which rejects this tsconfig's deprecated options and exits
// before checking a single file, making every header look like a free win).
// It also refuses to report if the compiler version differs from the
// lockfile pin, if tsc emitted a config-level error, or if tsc failed without
// producing a single diagnostic.
//
// SAFETY: files are restored with `git checkout --`, so the script refuses to
// run if any candidate file has uncommitted changes (it would clobber them).
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TS_NOCHECK_RE = /^\s*\/\/\s*@ts-nocheck\b/m;
const STRIP_RE = /^[ \t]*\/\/[ \t]*@ts-nocheck\b.*(?:\r?\n|$)/gm;
// `path(line,col): error TSxxxx: message` — tsc's non-pretty per-file form.
const FILE_DIAG_RE = /^(\S+?)\((\d+),(\d+)\): error (TS\d+)/;
// `error TSxxxx: message` — a global diagnostic with no file position
// (bad CLI flag, unreadable tsconfig, ...).
const GLOBAL_DIAG_RE = /^error (TS\d+)/;
// Plenty of headroom: 70 stripped files can emit thousands of lines, and a
// truncated stdout would under-count exactly the files we care about.
const MAX_BUFFER = 256 * 1024 * 1024;

const args = process.argv.slice(2);
const appOnly = args.includes('--app');
const topN = (() => {
  const i = args.findIndex((a) => a === '-n' || a === '--top');
  const n = i >= 0 ? parseInt(args[i + 1], 10) : NaN;
  return Number.isFinite(n) ? n : 15;
})();

function fail(...lines) {
  console.error(lines.join('\n'));
  process.exit(2);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') walk(full, out);
    } else if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(name)) {
      out.push(relative(ROOT, full).split('\\').join('/'));
    }
  }
  return out;
}

function candidates(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return walk(full).filter((rel) => TS_NOCHECK_RE.test(readFileSync(join(ROOT, rel), 'utf8')));
}

function assertClean(files) {
  if (!files.length) return;
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (dirty) {
    fail(
      'Refusing to run: these candidate files have uncommitted changes:\n',
      dirty,
      '\nCommit or stash them first — the scan restores files with `git checkout`.'
    );
  }
}

// Locate the compiler CI runs: the repo-pinned typescript package. A global
// `tsc` on PATH is never acceptable here — see TRUSTWORTHINESS above.
function resolveTsc() {
  const tscPath = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  const pkgPath = join(ROOT, 'node_modules', 'typescript', 'package.json');
  if (!existsSync(tscPath) || !existsSync(pkgPath)) {
    fail(
      'Refusing to run: node_modules/typescript is not installed, so the scan',
      'cannot type-check anything (and `npx tsc` would silently fall back to a',
      'global compiler that may not even read this tsconfig).',
      '',
      '  npm ci        # then re-run'
    );
  }
  const installed = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  let pinned = null;
  try {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
    pinned = lock.packages?.['node_modules/typescript']?.version ?? null;
  } catch {
    /* no lockfile — trust the install */
  }
  if (pinned && pinned !== installed) {
    fail(
      `Refusing to run: node_modules/typescript is ${installed} but package-lock.json pins ${pinned}.`,
      'A different compiler gives different (or zero) diagnostics than CI. Align it:',
      '',
      `  npm install --no-save typescript@${pinned}`
    );
  }
  return { tscPath, version: installed };
}

// Run tsc and split its diagnostics into per-file counts (for `files`),
// config-level errors (which invalidate the whole pass), and errors in files
// outside the candidate set (which mean the tree is already red).
function runTsc(tscPath, tscArgs, files) {
  let out = '';
  let status = 0;
  try {
    out = execFileSync(process.execPath, [tscPath, ...tscArgs], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_BUFFER,
    });
  } catch (e) {
    status = typeof e.status === 'number' ? e.status : 1;
    out = (e.stdout || '') + (e.stderr || '');
    if (e.code === 'ENOBUFS') {
      // Reported by validatePass (after the restore) as a diagnostic-free
      // failure; a truncated report would under-count the files we care about.
      out =
        'tsc output exceeded the capture buffer; raise MAX_BUFFER in scripts/tsNocheckNext.mjs.';
      status = status || 1;
    }
  }
  const candidateSet = new Set(files);
  const counts = Object.fromEntries(files.map((f) => [f, 0]));
  const configErrors = [];
  const otherFiles = new Set();
  let diagnostics = 0;
  for (const line of out.split('\n')) {
    const m = line.match(FILE_DIAG_RE);
    if (m) {
      diagnostics++;
      const file = m[1].split('\\').join('/');
      if (candidateSet.has(file)) counts[file]++;
      else if (/(?:^|\/)tsconfig(?:\.[\w-]+)?\.json$/.test(file)) configErrors.push(line);
      else otherFiles.add(file);
      continue;
    }
    if (GLOBAL_DIAG_RE.test(line)) {
      diagnostics++;
      configErrors.push(line);
    }
  }
  return { counts, otherFiles: [...otherFiles].sort(), configErrors, status, diagnostics, out };
}

// Decide whether a pass can be trusted. Called only AFTER the headers are
// restored — `fail()` exits the process, and `process.exit` skips `finally`
// blocks, so nothing that can abort may run while the tree is modified.
function validatePass(tscArgs, { configErrors, status, diagnostics, out }) {
  if (configErrors.length) {
    fail(
      `Refusing to report: tsc (${tscArgs.join(' ')}) rejected the project configuration, so it`,
      'never type-checked the candidate files — every file would look like a free win.',
      '',
      ...configErrors.map((l) => '  ' + l),
      '',
      'Usually this means a compiler other than the pinned one ran. See the CLAUDE.md note',
      'on aligning TypeScript with the lockfile.'
    );
  }
  if (status !== 0 && diagnostics === 0) {
    fail(
      `Refusing to report: tsc (${tscArgs.join(' ')}) exited ${status} without emitting a`,
      'single diagnostic, so per-file counts would be meaningless. Raw output:',
      '',
      out.trim() || '  (empty)'
    );
  }
}

// Strip headers from `files`, run tsc, attribute errors, always restore.
function scanPass(tscPath, files, tscArgs) {
  if (!files.length) return null;
  assertClean(files);
  for (const f of files) {
    const p = join(ROOT, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(STRIP_RE, ''));
  }
  let result;
  try {
    result = runTsc(tscPath, tscArgs, files);
  } finally {
    // Always restore before anything that might exit the process.
    execFileSync('git', ['checkout', '--', ...files], { cwd: ROOT });
  }
  validatePass(tscArgs, result);
  return result;
}

function report(label, result) {
  if (!result) return;
  const { counts, otherFiles } = result;
  const files = Object.keys(counts);
  const free = files.filter((f) => counts[f] === 0).sort();
  const ranked = files.filter((f) => counts[f] > 0).sort((a, b) => counts[a] - counts[b]);
  console.log(`\n### ${label} — ${files.length} file(s) carry a header`);
  if (otherFiles.length) {
    console.log(
      `\nWARNING: ${otherFiles.length} file(s) WITHOUT a header already fail checkJs (is` +
        ' `npm run typecheck` red on this branch?). Counts below are still per-file:'
    );
    for (const f of otherFiles.slice(0, 10)) console.log(`  ${f}`);
    if (otherFiles.length > 10) console.log(`  … and ${otherFiles.length - 10} more`);
  }
  console.log(`\nFREE WINS (0 errors once the header is removed): ${free.length}`);
  for (const f of free) console.log(`  ${f}`);
  console.log(`\nEASIEST NEXT (fewest errors), top ${topN}:`);
  for (const f of ranked.slice(0, topN)) console.log(`  ${String(counts[f]).padStart(3)}  ${f}`);
}

const { tscPath, version } = resolveTsc();
console.log(`Scanning with node_modules/typescript ${version} (the lockfile pin CI uses).`);

const srcFiles = candidates('src');
report('APP (src/)', scanPass(tscPath, srcFiles, ['--noEmit']));

if (!appOnly) {
  const fnFiles = candidates('functions/src');
  if (existsSync(join(ROOT, 'functions', 'node_modules'))) {
    report('FUNCTIONS (functions/src/)', scanPass(tscPath, fnFiles, ['-p', 'functions']));
  } else if (fnFiles.length) {
    console.log(
      `\n### FUNCTIONS (functions/src/) — skipped: ${fnFiles.length} file(s) carry a header.`
    );
    console.log('  Run `cd functions && npm ci` first, then re-run to scan the backend pass.');
  }
}

console.log(
  '\nRemove a header, then run `node scripts/tsNocheckCensus.mjs --update` to lock the lower ceiling.\n'
);
