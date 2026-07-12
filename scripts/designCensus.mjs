#!/usr/bin/env node
// =============================================================================
// DESIGN-SYSTEM CENSUS + RATCHET
// =============================================================================
// Scans src/ for the visual-identity violations defined in
// docs/VISUAL_IDENTITY_UNIFICATION.md §4 and either prints the census
// (default) or enforces the ratchet against the committed baseline (--check).
//
// The ratchet rule: no invariant count may EXCEED its baseline. Counts may
// only fall. When work drives a count down, run --write to lower the ceiling;
// it can never rise again. This is what makes the unification monotonic and
// keeps "everything" from decaying back into piecemeal — see §4 of the plan.
//
// Usage:
//   node scripts/designCensus.mjs            # print the census table
//   node scripts/designCensus.mjs --write    # (re)write the baseline ceiling
//   node scripts/designCensus.mjs --check     # CI gate: fail if any count rose
//   node scripts/designCensus.mjs --files <invariant-key>  # list offenders
//
// Zero runtime dependencies (Node ≥ 18, ESM).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'design-census.baseline.json');

// Files/directories excluded from the census: tests assert on class strings
// (not shipped UI), Storybook stories are demo scaffolding, and type decls
// carry no styling.
const EXCLUDE = [/\.test\./, /\.spec\./, /setupTests/, /\/stories\//, /\.d\.ts$/];

// -----------------------------------------------------------------------------
// INVARIANTS — each is one row of the Definition-of-Done table (§4).
// `allow` lists repo-relative path prefixes exempt from that invariant, either
// because the hex is DATA (uniform/corps colors) or the file is a legitimate
// brand/reward surface where gold is on-role. Allowlists shrink the *target*;
// the ratchet itself only needs "do not increase".
// -----------------------------------------------------------------------------
const INVARIANTS = [
  {
    key: 'arbitrary-hex',
    label: 'Arbitrary hex utilities  bg-[#..] text-[#..] border-[#..]',
    re: /\b(?:bg|text|border|ring|ring-offset|from|via|to|fill|stroke|decoration|outline|divide|placeholder|caret|accent)-\[#[0-9a-fA-F]{3,8}\]/g,
    // Cosmetic/uniform gradient definitions are DATA (per-item colors), not chrome.
    allow: ['src/data/', 'src/utils/cosmetics.js'],
  },
  {
    key: 'hex-literal',
    label: 'Bare hex literals in source  (#rrggbb / #rgb, outside brackets)',
    // Exclude the bracketed arbitrary form (counted above): its # follows a `[`.
    re: /(?<!\[)#[0-9a-fA-F]{6}\b|(?<!\[)#[0-9a-fA-F]{3}\b/g,
    // Data files: hex here describes uniforms/corps/avatars, not chrome.
    allow: ['src/data/', 'src/utils/cosmetics.js', 'src/utils/corps.ts'],
  },
  {
    key: 'rounded',
    label: 'Rounded corners  (soft box radii; rounded-none & any -full are exempt)',
    // Only match real rounded-* classes (a size suffix is required) so the bare
    // JS identifier/prop `rounded` isn't counted. rounded-full and directional
    // full variants (rounded-l-full) are circles/pills — legitimate when sharp.
    re: /\brounded-(?:[tblrse]{1,2}-)?(?:sm|md|lg|xl|2xl|3xl|none|full)\b/g,
    reject: (m) => !/-(?:none|full)$/.test(m),
    allow: [],
  },
  {
    key: 'banned-effects',
    label: 'Banned effects  bg-gradient-* / backdrop-blur-* / shadow-* / drop-shadow-*',
    re: /\b(?:bg-gradient-to-[a-z]{1,2}|backdrop-blur(?:-[a-z0-9]+)?|shadow-(?:sm|md|lg|xl|2xl|inner)|drop-shadow(?:-[a-z0-9]+)?)\b/g,
    // Cosmetic-uniform gradient definitions are DATA (per-item visuals).
    allow: ['src/data/', 'src/utils/cosmetics.js'],
  },
  {
    key: 'off-role-gold',
    label: 'Gold/amber/yellow color utilities  (brand color used as generic accent)',
    re: /\b(?:bg|text|border|ring|from|via|to|fill|stroke|decoration|outline)-(?:yellow|amber)-\d{2,3}\b|#[eE][aA][bB]308/g,
    // Categorical DATA: class-tier/medal/prestige palettes where gold is one
    // legend value among green/blue/purple tiers, not a decorative accent.
    // Lives in util/api/config files, treated like a chart's categorical scale.
    allow: [
      'src/utils/',
      'src/api/',
      'src/data/',
      'src/pages/scheduleConstants.js',
      'src/pages/onboardingConstants.js',
      'src/pages/hallOfChampionsMeta.js',
      'src/components/Schedule/showRegistrationConfig.js',
      'src/components/Dashboard/sections/constants.js',
    ],
  },
  {
    key: 'legacy-gray',
    label: 'Non-token neutrals  gray-### / slate-### color utilities',
    re: /\b(?:bg|text|border|ring|from|via|to|divide|placeholder)-(?:gray|slate)-\d{2,3}\b/g,
    allow: [],
  },
  {
    key: 'font-display',
    label: 'font-display usage  (orphaned — display face is not loaded)',
    re: /\bfont-display\b/g,
    allow: [],
  },
];

// -----------------------------------------------------------------------------
// File walk
// -----------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(?:js|jsx|ts|tsx)$/.test(name)) {
      const rel = relative(ROOT, full);
      if (!EXCLUDE.some((rx) => rx.test(rel))) out.push(rel);
    }
  }
  return out;
}

function isAllowed(rel, allow) {
  return allow.some((prefix) => rel === prefix || rel.startsWith(prefix));
}

// -----------------------------------------------------------------------------
// Census
// -----------------------------------------------------------------------------
function census() {
  const files = walk(SRC);
  const totals = Object.fromEntries(INVARIANTS.map((i) => [i.key, 0]));
  const perFile = Object.fromEntries(INVARIANTS.map((i) => [i.key, {}]));

  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    for (const inv of INVARIANTS) {
      if (isAllowed(rel, inv.allow)) continue;
      const matches = text.match(inv.re) || [];
      const count = inv.reject ? matches.filter(inv.reject).length : matches.length;
      if (count > 0) {
        totals[inv.key] += count;
        perFile[inv.key][rel] = count;
      }
    }
  }
  return { files: files.length, totals, perFile };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

// -----------------------------------------------------------------------------
// Output modes
// -----------------------------------------------------------------------------
const arg = process.argv[2];

if (arg === '--write') {
  const { files, totals } = census();
  const payload = {
    _note:
      'Ratchet ceiling for the visual-identity unification (docs/VISUAL_IDENTITY_UNIFICATION.md §4). ' +
      'Counts may only fall. After lowering a count, run `npm run census -- --write` to lock the new floor. ' +
      'Never edit these upward by hand.',
    filesScanned: files,
    invariants: totals,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)} (${files} files scanned).`);
  process.exit(0);
}

if (arg === '--files') {
  const key = process.argv[3];
  const inv = INVARIANTS.find((i) => i.key === key);
  if (!inv) {
    console.error(`Unknown invariant "${key}". Keys: ${INVARIANTS.map((i) => i.key).join(', ')}`);
    process.exit(2);
  }
  const { perFile } = census();
  const entries = Object.entries(perFile[key]).sort((a, b) => b[1] - a[1]);
  console.log(`\n${inv.label}\n${'─'.repeat(72)}`);
  for (const [rel, n] of entries) console.log(`${String(n).padStart(5)}  ${rel}`);
  console.log(`\n${entries.length} files, ${entries.reduce((s, [, n]) => s + n, 0)} occurrences.`);
  process.exit(0);
}

if (arg === '--check') {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error('No baseline found. Run `npm run census -- --write` first.');
    process.exit(2);
  }
  const { totals } = census();
  const rose = [];
  const fell = [];
  for (const inv of INVARIANTS) {
    const now = totals[inv.key];
    const ceil = baseline.invariants[inv.key] ?? 0;
    if (now > ceil) rose.push({ inv, now, ceil });
    else if (now < ceil) fell.push({ inv, now, ceil });
  }
  if (rose.length) {
    console.error('\n✗ Design-system ratchet FAILED — these counts rose above the baseline:\n');
    for (const { inv, now, ceil } of rose) {
      console.error(`  ${inv.key}: ${ceil} → ${now}  (+${now - ceil})`);
      console.error(`    ${inv.label}`);
      console.error(`    Offenders: node scripts/designCensus.mjs --files ${inv.key}\n`);
    }
    console.error('The visual identity may only converge. Fix the new violations, or');
    console.error('reuse an existing token instead of a raw value. See §4 of the plan.\n');
    process.exit(1);
  }
  if (fell.length) {
    console.log('\n✓ Ratchet holds. Progress since baseline (lower the ceiling with --write):\n');
    for (const { inv, now, ceil } of fell) {
      console.log(`  ${inv.key}: ${ceil} → ${now}  (${now - ceil})`);
    }
    console.log('');
  } else {
    console.log('✓ Design-system ratchet holds. No counts rose.');
  }
  process.exit(0);
}

// Default: print the census table.
const { files, totals, perFile } = census();
const baseline = loadBaseline();
console.log(`\nDesign-system census — ${files} files scanned (src/, excluding tests & stories)\n`);
console.log(
  `${'INVARIANT'.padEnd(16)}${'COUNT'.padStart(8)}${'CEILING'.padStart(10)}   TOP OFFENDER`
);
console.log('─'.repeat(90));
for (const inv of INVARIANTS) {
  const n = totals[inv.key];
  const ceil = baseline ? (baseline.invariants[inv.key] ?? '—') : '—';
  const top = Object.entries(perFile[inv.key]).sort((a, b) => b[1] - a[1])[0];
  const topStr = top ? `${top[1]}× ${top[0]}` : '';
  console.log(
    `${inv.key.padEnd(16)}${String(n).padStart(8)}${String(ceil).padStart(10)}   ${topStr}`
  );
}
console.log('─'.repeat(90));
console.log(
  `${'TOTAL'.padEnd(16)}${String(Object.values(totals).reduce((a, b) => a + b, 0)).padStart(8)}`
);
console.log('\nInvariant labels:');
for (const inv of INVARIANTS) console.log(`  ${inv.key.padEnd(16)} ${inv.label}`);
console.log('\n  Offenders for one invariant:  node scripts/designCensus.mjs --files <key>');
console.log('  Enforce the ratchet (CI):     npm run census:check\n');
