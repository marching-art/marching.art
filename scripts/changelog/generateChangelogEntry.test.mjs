// Unit tests for the automatic changelog generator's pure logic. Run via
// `npm run changelog:selftest` (node --test). These guard the two things that
// matter for an unattended writer: that noise never becomes an entry, and that
// whatever does become an entry is well-formed and bounded.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNoisePr,
  slugify,
  makeEntryId,
  sanitizeEntry,
  prependEntry,
  parseModelDecision,
  heuristicEntry,
  buildPrompt,
  VALID_CATEGORIES,
  MAX_ENTRIES,
} from './generateChangelogEntry.mjs';

// ---------------------------------------------------------------------------
// isNoisePr
// ---------------------------------------------------------------------------

test('isNoisePr drops bot authors', () => {
  assert.equal(isNoisePr({ title: 'Bump firebase', authorLogin: 'dependabot[bot]' }), true);
});

test('isNoisePr drops chore/ci/docs/test titles', () => {
  for (const title of [
    'chore: tidy imports',
    'ci: fix flaky job',
    'docs: update README',
    'test: add coverage',
    'Bump framer-motion from 12 to 13',
    'Fix Prettier formatting',
    'refactor: extract helper',
  ]) {
    assert.equal(isNoisePr({ title }), true, `expected noise: ${title}`);
  }
});

test('isNoisePr drops PRs that touch only non-product files', () => {
  assert.equal(
    isNoisePr({ title: 'Update stuff', files: ['docs/GAMEPLAY.md', 'scripts/x.mjs', 'a.test.ts'] }),
    true
  );
});

test('isNoisePr keeps a real feature that touches product code', () => {
  assert.equal(
    isNoisePr({ title: 'Add press releases for your corps', files: ['src/pages/Dashboard.jsx'] }),
    false
  );
});

test('isNoisePr honors skip/no-changelog labels and player-facing opt-in', () => {
  assert.equal(isNoisePr({ title: 'Add a thing', labels: ['no-changelog'] }), true);
  assert.equal(isNoisePr({ title: 'dependencies', labels: [{ name: 'dependencies' }] }), true);
  // player-facing label overrides a noisy-looking title.
  assert.equal(
    isNoisePr({ title: 'chore: but actually player facing', labels: ['player-facing'] }),
    false
  );
});

// ---------------------------------------------------------------------------
// slugify + makeEntryId
// ---------------------------------------------------------------------------

test('slugify produces url-safe slugs', () => {
  assert.equal(slugify('Podium: veterans start closer!'), 'podium-veterans-start-closer');
  assert.equal(slugify('  Multiple   spaces  '), 'multiple-spaces');
});

test('makeEntryId is stable and de-collides', () => {
  const id = makeEntryId('2026-08-12', 'New feature');
  assert.equal(id, '2026-08-12-new-feature');
  assert.equal(makeEntryId('2026-08-12', 'New feature', [id]), '2026-08-12-new-feature-2');
  assert.equal(
    makeEntryId('2026-08-12', 'New feature', [id, '2026-08-12-new-feature-2']),
    '2026-08-12-new-feature-3'
  );
});

// ---------------------------------------------------------------------------
// sanitizeEntry
// ---------------------------------------------------------------------------

test('sanitizeEntry produces a valid, bounded entry', () => {
  const entry = sanitizeEntry(
    {
      category: 'feature',
      title: 'Post press releases for your corps',
      summary: 'Publish your own corps news instantly.',
      highlights: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
    },
    { date: '2026-08-12', existingIds: [] }
  );
  assert.equal(entry.category, 'feature');
  assert.equal(entry.date, '2026-08-12');
  assert.equal(entry.id, '2026-08-12-post-press-releases-for-your-corps');
  assert.equal(entry.highlights.length, 5); // capped
});

test('sanitizeEntry rejects an invalid category or empty fields', () => {
  assert.equal(
    sanitizeEntry({ category: 'nope', title: 't', summary: 'summary here' }, { date: 'd' }),
    null
  );
  assert.equal(
    sanitizeEntry({ category: 'fix', title: '', summary: 'summary here' }, { date: 'd' }),
    null
  );
  assert.equal(
    sanitizeEntry({ category: 'fix', title: 'x', summary: 'short' }, { date: 'd' }),
    null
  );
});

test('sanitizeEntry clamps over-long title and summary', () => {
  const entry = sanitizeEntry(
    { category: 'fix', title: 'A'.repeat(200), summary: 'B'.repeat(600) },
    { date: '2026-08-12' }
  );
  assert.ok(entry.title.length <= 80);
  assert.ok(entry.summary.length <= 300);
});

test('every valid category is accepted', () => {
  for (const category of VALID_CATEGORIES) {
    const e = sanitizeEntry(
      { category, title: 'Title', summary: 'A valid summary.' },
      { date: 'd' }
    );
    assert.equal(e.category, category);
  }
});

// ---------------------------------------------------------------------------
// prependEntry
// ---------------------------------------------------------------------------

test('prependEntry adds newest-first, dedupes by id, and caps length', () => {
  const entry = (id) => ({
    id,
    date: '2026-01-01',
    title: id,
    category: 'fix',
    summary: 'x'.repeat(10),
  });
  const start = [entry('a'), entry('b')];
  const next = prependEntry(start, entry('c'));
  assert.deepEqual(
    next.map((e) => e.id),
    ['c', 'a', 'b']
  );

  // Dedup: re-adding 'a' moves it to front without duplicating.
  assert.deepEqual(
    prependEntry(next, entry('a')).map((e) => e.id),
    ['a', 'c', 'b']
  );

  // Cap.
  const many = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => entry(`e${i}`));
  assert.equal(prependEntry(many, entry('new')).length, MAX_ENTRIES);
});

// ---------------------------------------------------------------------------
// parseModelDecision
// ---------------------------------------------------------------------------

test('parseModelDecision reads a skip verdict', () => {
  assert.deepEqual(parseModelDecision('{"skip": true}'), { skip: true });
});

test('parseModelDecision reads an entry, tolerating code fences', () => {
  const out = parseModelDecision('```json\n{"category":"feature","title":"T","summary":"S"}\n```');
  assert.equal(out.category, 'feature');
});

test('parseModelDecision defaults to skip on garbage or incomplete objects', () => {
  assert.deepEqual(parseModelDecision('not json'), { skip: true });
  assert.deepEqual(parseModelDecision(''), { skip: true });
  assert.deepEqual(parseModelDecision('{"category":"feature"}'), { skip: true });
});

// ---------------------------------------------------------------------------
// heuristicEntry
// ---------------------------------------------------------------------------

test('heuristicEntry builds an entry from a conventional-commit title', () => {
  const e = heuristicEntry({ title: 'feat: add league chat', date: '2026-08-12' });
  assert.equal(e.category, 'feature');
  assert.equal(e.title, 'Add league chat');
});

test('heuristicEntry maps fix/perf/balance types', () => {
  assert.equal(
    heuristicEntry({ title: 'fix: resolve a scoring crash', date: 'd' }).category,
    'fix'
  );
  assert.equal(
    heuristicEntry({ title: 'perf: speed up the scores page', date: 'd' }).category,
    'improvement'
  );
  assert.equal(
    heuristicEntry({ title: 'balance: tune scoring curve', date: 'd' }).category,
    'balance'
  );
});

test('heuristicEntry returns null for a non-conventional title', () => {
  assert.equal(heuristicEntry({ title: 'Podium veterans start closer', date: 'd' }), null);
});

test('heuristicEntry skips a conventional title too terse to summarize', () => {
  // The summary is derived from the title; an ultra-short one is dropped rather
  // than published as junk.
  assert.equal(heuristicEntry({ title: 'fix: crash', date: 'd' }), null);
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

test('buildPrompt includes the title, body, and a skip instruction', () => {
  const prompt = buildPrompt({ title: 'Add thing', body: 'Details here', files: ['src/a.ts'] });
  assert.match(prompt, /Add thing/);
  assert.match(prompt, /Details here/);
  assert.match(prompt, /"skip": true/);
  assert.match(prompt, /src\/a\.ts/);
});
