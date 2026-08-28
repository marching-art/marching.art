// Dependency-aware deploy targeting for the CI functions deploy.
//
// `firebase deploy --only functions` skips functions whose stored hash matches,
// but that hash covers the WHOLE codebase source archive — so touching any one
// file under functions/ redeploys all ~200 services, which is what grinds
// against the Cloud Run write/CPU quotas. This script diffs HEAD against the
// last successful deploy (a functions-deploy/* tag), walks the CommonJS
// require graph to find which exported functions are actually affected, and
// prints a deploy plan the workflow turns into `--only functions:a,functions:b`.
//
// Output (stdout, single JSON line):
//   { "mode": "full" }                          — deploy everything (fallback)
//   { "mode": "none", "scraper": false }        — nothing to deploy
//   { "mode": "some", "functions": ["a", ...], "scraper": true|false }
//
// The targeted path is only taken when the change is provably confined to
// modules under functions/src/: anything else — index.js, package.json /
// lockfile, firebase.json, .env*, a deleted or renamed file, a file the graph
// can't resolve, an export that can't be traced to a module — falls back to
// "full". Deleting or renaming a function always edits functions/index.js, so
// the targeted path never has pending deletions to prune.
//
// Usage: node scripts/changedFunctions.mjs <base-ref>
// Run from the repo root, after `cd functions && npm ci` (the export mapping
// loads functions/index.js for real).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, 'functions');
const INDEX_PATH = path.join(FUNCTIONS_DIR, 'index.js');

// Paths under functions/ that never ship in the deploy artifact (mirrors the
// "ignore" list for the default codebase in firebase.json).
const IGNORED_FUNCTION_PATHS = [
  /^functions\/node_modules\//,
  /\.test\.js$/,
  /^functions\/rehearsal\//,
  /^functions\/pressboxImporter\//,
  /^functions\/dciArchiveImporter\//,
  /^functions\/src\/scripts\/cleanupLeakedProfileEmails\.js$/,
];

function fullDeploy(reason) {
  process.stderr.write(`changedFunctions: full deploy — ${reason}\n`);
  process.stdout.write(`${JSON.stringify({ mode: 'full' })}\n`);
  process.exit(0);
}

function main() {
  const baseRef = process.argv[2];
  if (!baseRef) fullDeploy('no base ref given');

  let diff;
  try {
    diff = execFileSync('git', ['diff', '--name-status', `${baseRef}`, 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    fullDeploy(`git diff against ${baseRef} failed (missing tag or shallow clone?)`);
  }

  let scraperChanged = false;
  const changedSrcFiles = [];
  for (const line of diff.split('\n')) {
    if (!line.trim()) continue;
    const [status, ...paths] = line.split('\t');
    // For renames (R100 etc.) both the old and new path appear; treat every
    // listed path as changed.
    for (const p of paths) {
      if (p.startsWith('functions-scraper/')) {
        scraperChanged = true;
        continue;
      }
      if (!p.startsWith('functions/')) continue;
      if (IGNORED_FUNCTION_PATHS.some((re) => re.test(p))) continue;
      if (status.startsWith('D') || status.startsWith('R')) {
        fullDeploy(`${p} was deleted or renamed`);
      }
      const isSrcModule = /^functions\/src\/.*\.(js|json)$/.test(p);
      if (!isSrcModule) {
        // index.js, package.json / lockfile, .env*, firebase config, anything
        // unrecognized: affects the whole codebase.
        fullDeploy(`${p} is outside the mapped src/ module graph`);
      }
      changedSrcFiles.push(path.join(ROOT, p));
    }
  }

  if (changedSrcFiles.length === 0) {
    process.stdout.write(`${JSON.stringify({ mode: 'none', scraper: scraperChanged })}\n`);
    return;
  }

  // --- Static require graph over functions/index.js + functions/src ---------
  // Edges: file -> in-project files it require()s. Only string-literal
  // relative requires are resolved; bare specifiers are npm packages.
  const graph = new Map(); // absPath -> Set<absPath>
  const requireRe = /require\(\s*(["'])(\.{1,2}\/[^"']+)\1\s*\)/g;
  const dynamicRelativeRequireRe = /require\(\s*[^"')]/;

  function resolveRelative(fromFile, spec) {
    const base = path.resolve(path.dirname(fromFile), spec);
    for (const candidate of [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  // Drop block comments and whole-line // comments so a require() shown in a
  // JSDoc example doesn't register as an edge (or as a dynamic require).
  // Inline // comments are left alone: trimming them blindly would eat code
  // after string literals containing "//" (URLs).
  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  function walk(file) {
    if (graph.has(file)) return;
    const deps = new Set();
    graph.set(file, deps);
    const source = stripComments(readFileSync(file, 'utf8'));
    if (dynamicRelativeRequireRe.test(source)) {
      // A computed require could hide an edge and cause an UNDER-deploy —
      // the dangerous direction. Bail to a full deploy.
      fullDeploy(`${path.relative(ROOT, file)} contains a dynamic require`);
    }
    for (const match of source.matchAll(requireRe)) {
      const resolved = resolveRelative(file, match[2]);
      if (resolved === null) {
        fullDeploy(`${path.relative(ROOT, file)} requires unresolvable ${match[2]}`);
      }
      deps.add(resolved);
    }
    for (const dep of deps) {
      if (dep.endsWith('.js')) walk(dep);
      else graph.set(dep, graph.get(dep) ?? new Set());
    }
  }
  walk(INDEX_PATH);

  for (const changed of changedSrcFiles) {
    if (!graph.has(changed)) {
      // Not reachable from index.js (e.g. an admin script): deploys nothing.
      process.stderr.write(
        `changedFunctions: ${path.relative(ROOT, changed)} is not reachable from index.js — ignored\n`
      );
    }
  }
  const relevantChanges = changedSrcFiles.filter((f) => graph.has(f));
  if (relevantChanges.length === 0) {
    process.stdout.write(`${JSON.stringify({ mode: 'none', scraper: scraperChanged })}\n`);
    return;
  }

  // Entry modules = files index.js requires directly; each exported function
  // is defined in exactly one of them.
  const entryModules = [...(graph.get(INDEX_PATH) ?? [])];

  // Reverse closure: which entry modules (transitively) require each changed
  // file?
  function reaches(from, target, seen = new Set()) {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    for (const dep of graph.get(from) ?? []) {
      if (reaches(dep, target, seen)) return true;
    }
    return false;
  }
  const affectedEntries = new Set();
  for (const changed of relevantChanges) {
    for (const entry of entryModules) {
      if (reaches(entry, changed)) affectedEntries.add(entry);
    }
  }

  // --- Runtime mapping: entry module -> exported function names -------------
  // Loading index.js gives object identity between each module's exports and
  // the deploy-facing export names, which survives any re-export style.
  const requireFn = createRequire(INDEX_PATH);
  const indexExports = requireFn(INDEX_PATH);
  const moduleExportsByPath = new Map(entryModules.map((m) => [m, requireFn(m)]));

  const affectedFunctions = new Set();
  for (const [name, value] of Object.entries(indexExports)) {
    let owner = null;
    for (const [modPath, modExports] of moduleExportsByPath) {
      if (Object.values(modExports).includes(value)) {
        owner = modPath;
        break;
      }
    }
    if (owner === null) fullDeploy(`export "${name}" could not be traced to a module`);
    if (affectedEntries.has(owner)) affectedFunctions.add(name);
  }

  if (affectedFunctions.size === 0 && !scraperChanged) {
    process.stdout.write(`${JSON.stringify({ mode: 'none', scraper: false })}\n`);
    return;
  }
  if (affectedFunctions.size >= Object.keys(indexExports).length) {
    fullDeploy('every function is affected');
  }
  process.stdout.write(
    `${JSON.stringify({
      mode: 'some',
      functions: [...affectedFunctions].sort(),
      scraper: scraperChanged,
    })}\n`
  );
}

try {
  main();
} catch (err) {
  fullDeploy(`unexpected error: ${err?.message ?? err}`);
}
