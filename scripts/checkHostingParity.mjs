#!/usr/bin/env node
// =============================================================================
// HOSTING-CONFIG PARITY CHECK
// =============================================================================
// The site ships from two hosts — Firebase Hosting (firebase.json) and Vercel
// (vercel.json) — and both configs hand-maintain the same security headers,
// cache rules, and function rewrites. They have drifted before: the
// `/api/news` -> getNewsFeedHttp rewrite existed only in firebase.json, so on
// Vercel the endpoint silently returned the SPA shell.
//
// This check fails CI when the two files disagree, mirroring the
// class-registry mirror check (scripts/checkClassRegistrySync.js) for the
// same "two committed copies" problem. It verifies:
//
//   1. HEADER PARITY — every headers block in firebase.json has a Vercel
//      counterpart (sources mapped glob->regex below) carrying the exact
//      same key/value set, and vice versa. Covers the CSP and every other
//      security/cache header.
//   2. REWRITE PARITY — every Cloud Function rewrite in firebase.json has a
//      Vercel rewrite for the same source that targets the same function
//      (as an external cloudfunctions.net URL, since Vercel cannot invoke
//      Firebase functions natively) and sits BEFORE the SPA catch-all, and
//      every non-SPA Vercel rewrite corresponds to a firebase.json one.
//
// Known intentional differences (skipped, not compared):
//   - firebase.json's `**/*.js` / `**/*.css` Content-Type blocks: Firebase
//     Hosting needed explicit MIME fixups; Vercel serves correct MIME types
//     natively.
//
// Usage:
//   node scripts/checkHostingParity.mjs
//
// Zero runtime dependencies (Node >= 18, ESM).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(resolve(repoRoot, name), 'utf8'));

const firebaseHosting = read('firebase.json').hosting;
const vercel = read('vercel.json');

const failures = [];
const fail = (msg) => failures.push(msg);

// --- 1. Header parity --------------------------------------------------------

// firebase.json glob source -> vercel.json path-to-regexp source. A firebase
// headers block whose source is not in this map (and not firebase-only below)
// is itself a failure: add the mapping AND the vercel.json block together.
const SOURCE_MAP = new Map([
  ['/assets/**', '/assets/(.*)'],
  ['/index.html', '/index.html'],
  ['/service-worker.js', '/service-worker.js'],
  ['**', '/(.*)'],
]);

// Firebase-only MIME fixups; Vercel serves correct Content-Type natively.
const FIREBASE_ONLY_SOURCES = new Set(['**/*.js', '**/*.css']);

const toHeaderMap = (block) => new Map((block.headers || []).map((h) => [h.key, h.value]));

const vercelHeaderBlocks = new Map((vercel.headers || []).map((block) => [block.source, block]));

const expectedVercelSources = new Set();

for (const block of firebaseHosting.headers || []) {
  if (FIREBASE_ONLY_SOURCES.has(block.source)) continue;

  const vercelSource = SOURCE_MAP.get(block.source);
  if (!vercelSource) {
    fail(
      `firebase.json headers source "${block.source}" has no vercel.json mapping — ` +
        `add the equivalent block to vercel.json and map it in SOURCE_MAP ` +
        `(scripts/checkHostingParity.mjs), or add it to FIREBASE_ONLY_SOURCES with a reason.`
    );
    continue;
  }
  expectedVercelSources.add(vercelSource);

  const vercelBlock = vercelHeaderBlocks.get(vercelSource);
  if (!vercelBlock) {
    fail(
      `vercel.json is missing the headers block for "${vercelSource}" ` +
        `(mirrors firebase.json "${block.source}").`
    );
    continue;
  }

  const fb = toHeaderMap(block);
  const vc = toHeaderMap(vercelBlock);
  for (const [key, value] of fb) {
    if (!vc.has(key)) {
      fail(`vercel.json "${vercelSource}" is missing header "${key}" (present in firebase.json).`);
    } else if (vc.get(key) !== value) {
      fail(
        `Header "${key}" differs between hosts for "${block.source}":\n` +
          `    firebase.json: ${value}\n` +
          `    vercel.json:   ${vc.get(key)}`
      );
    }
  }
  for (const key of vc.keys()) {
    if (!fb.has(key)) {
      fail(`firebase.json "${block.source}" is missing header "${key}" (present in vercel.json).`);
    }
  }
}

for (const source of vercelHeaderBlocks.keys()) {
  if (!expectedVercelSources.has(source)) {
    fail(
      `vercel.json headers source "${source}" has no firebase.json counterpart — ` +
        `add the equivalent firebase.json block or remove it.`
    );
  }
}

// --- 2. Function-rewrite parity ---------------------------------------------

// firebase.json glob rewrite source -> vercel.json path-to-regexp source.
// Exact-path sources (e.g. /api/news) are identical on both hosts and need
// no entry; add a mapping here whenever a glob rewrite lands, together with
// the vercel.json block. NOTE: for mapped (multi-segment) sources the Vercel
// destination must append the original path (…cloudfunctions.net/<fn>/<path>)
// so the function sees the same req.path Firebase Hosting forwards.
const REWRITE_SOURCE_MAP = new Map([
  ['/api/og/**', '/api/og/:path*'],
  ['/share/**', '/share/:path*'],
  // Firebase needs separate /results and /results/** sources (its glob does
  // not match the bare path); Vercel's :path* covers both with one rewrite.
  ['/results', '/results/:path*'],
  ['/results/**', '/results/:path*'],
]);

const mapRewriteSource = (source) => REWRITE_SOURCE_MAP.get(source) ?? source;

const vercelRewrites = vercel.rewrites || [];
const spaIndex = vercelRewrites.findIndex((r) => r.destination === '/index.html');
if (spaIndex === -1) {
  fail(`vercel.json has no SPA catch-all rewrite to /index.html.`);
}

const firebaseFunctionRewrites = (firebaseHosting.rewrites || []).filter((r) => r.function);

for (const rewrite of firebaseFunctionRewrites) {
  const functionId = rewrite.function.functionId || rewrite.function;
  const expectedSource = mapRewriteSource(rewrite.source);
  const match = vercelRewrites.findIndex((r) => r.source === expectedSource);
  if (match === -1) {
    fail(
      `firebase.json rewrites "${rewrite.source}" to function "${functionId}" but ` +
        `vercel.json has no rewrite for "${expectedSource}" — on Vercel it falls through to ` +
        `the SPA shell. Add a rewrite to the function's public URL (and a REWRITE_SOURCE_MAP ` +
        `entry in scripts/checkHostingParity.mjs if the source is a glob).`
    );
    continue;
  }
  const destination = vercelRewrites[match].destination || '';
  if (!destination.includes(functionId)) {
    fail(
      `vercel.json rewrite for "${rewrite.source}" targets "${destination}", which does ` +
        `not reference function "${functionId}" from firebase.json.`
    );
  }
  if (spaIndex !== -1 && match > spaIndex) {
    fail(
      `vercel.json rewrite for "${rewrite.source}" is listed AFTER the SPA catch-all — ` +
        `the catch-all wins, so the function is never reached. Move it above.`
    );
  }
}

for (const [index, rewrite] of vercelRewrites.entries()) {
  if (index === spaIndex) continue;
  const counterpart = firebaseFunctionRewrites.some(
    (r) => mapRewriteSource(r.source) === rewrite.source
  );
  if (!counterpart) {
    fail(
      `vercel.json rewrite "${rewrite.source}" has no firebase.json counterpart — ` +
        `add the matching function rewrite to firebase.json or remove it.`
    );
  }
}

// --- Report ------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`Hosting-config parity check FAILED (${failures.length} problem(s)):\n`);
  for (const message of failures) console.error(`  ✗ ${message}\n`);
  console.error(
    'firebase.json and vercel.json must describe the same site. Fix the drift in ' +
      'whichever file is stale (see scripts/checkHostingParity.mjs for the mapping rules).'
  );
  process.exit(1);
}

console.log(
  `Hosting-config parity check passed: ${expectedVercelSources.size} header block(s) and ` +
    `${firebaseFunctionRewrites.length} function rewrite(s) in sync across firebase.json and vercel.json.`
);
