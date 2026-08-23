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
// SAFETY: files are restored with `git checkout --`, so the script refuses to
// run if any candidate file has uncommitted changes (it would clobber them).
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TS_NOCHECK_RE = /^\s*\/\/\s*@ts-nocheck\b/m;
const STRIP_RE = /^[ \t]*\/\/[ \t]*@ts-nocheck\b.*(?:\r?\n|$)/gm;

const args = process.argv.slice(2);
const appOnly = args.includes('--app');
const topN = (() => {
  const i = args.findIndex((a) => a === '-n' || a === '--top');
  const n = i >= 0 ? parseInt(args[i + 1], 10) : NaN;
  return Number.isFinite(n) ? n : 15;
})();

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
  const dirty = execSync('git status --porcelain -- ' + files.map((f) => `'${f}'`).join(' '), {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (dirty) {
    console.error('Refusing to run: these candidate files have uncommitted changes:\n');
    console.error(dirty);
    console.error('\nCommit or stash them first — the scan restores files with `git checkout`.');
    process.exit(2);
  }
}

// Strip headers from `files`, run `cmd`, attribute errors, always restore.
function scanPass(files, cmd) {
  if (!files.length) return {};
  assertClean(files);
  for (const f of files) {
    const p = join(ROOT, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(STRIP_RE, ''));
  }
  let out = '';
  try {
    execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  } finally {
    execSync('git checkout -- ' + files.map((f) => `'${f}'`).join(' '), { cwd: ROOT });
  }
  const counts = Object.fromEntries(files.map((f) => [f, 0]));
  for (const line of out.split('\n')) {
    // Ignore TS6xxx info notes and TS5101 (baseUrl deprecation) — not real
    // per-file checkJs failures.
    const m = line.match(/^(\S+?)\(\d+,\d+\): error (TS\d+)/);
    if (m && m[1] in counts && m[2] !== 'TS5101' && !/^TS6\d\d\d$/.test(m[2])) counts[m[1]]++;
  }
  return counts;
}

function report(label, counts) {
  const files = Object.keys(counts);
  if (!files.length) return;
  const free = files.filter((f) => counts[f] === 0).sort();
  const ranked = files.filter((f) => counts[f] > 0).sort((a, b) => counts[a] - counts[b]);
  console.log(`\n### ${label} — ${files.length} file(s) carry a header`);
  console.log(`\nFREE WINS (0 errors once the header is removed): ${free.length}`);
  for (const f of free) console.log(`  ${f}`);
  console.log(`\nEASIEST NEXT (fewest errors), top ${topN}:`);
  for (const f of ranked.slice(0, topN)) console.log(`  ${String(counts[f]).padStart(3)}  ${f}`);
}

const srcFiles = candidates('src');
report('APP (src/)', scanPass(srcFiles, 'npx tsc --noEmit'));

if (!appOnly) {
  const fnFiles = candidates('functions/src');
  if (existsSync(join(ROOT, 'functions', 'node_modules'))) {
    report('FUNCTIONS (functions/src/)', scanPass(fnFiles, 'npx tsc -p functions'));
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
