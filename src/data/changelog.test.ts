import { describe, it, expect } from 'vitest';
import {
  ROADMAP,
  UPDATE_CATEGORY_META,
  ROADMAP_STATUS_META,
  latestUpdateId,
  countUnseenUpdates,
  loadChangelog,
  type ChangelogEntry,
} from './changelog';
// The integrity checks read the data file directly; production loads it lazily
// via loadChangelog(), but the data contract is the same JSON either way.
import rawEntries from './changelogEntries.json';

const CHANGELOG = rawEntries as ChangelogEntry[];

const entry = (id: string): ChangelogEntry => ({
  id,
  date: '2026-01-01',
  title: `t-${id}`,
  category: 'feature',
  summary: 's',
});

describe('changelog data integrity', () => {
  it('has unique changelog ids', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is ordered newest-first by date', () => {
    for (let i = 1; i < CHANGELOG.length; i += 1) {
      expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date).toBe(true);
    }
  });

  it('every entry has a known category with metadata', () => {
    for (const e of CHANGELOG) {
      expect(UPDATE_CATEGORY_META[e.category]).toBeTruthy();
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.summary.length).toBeGreaterThan(0);
    }
  });

  it('has unique roadmap ids with known statuses', () => {
    const ids = ROADMAP.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ROADMAP) {
      expect(ROADMAP_STATUS_META[r.status]).toBeTruthy();
    }
  });
});

describe('loadChangelog', () => {
  it('resolves to the newest-first changelog entries', async () => {
    const entries = await loadChangelog();
    expect(entries[0].id).toBe(CHANGELOG[0].id);
    expect(entries.length).toBe(CHANGELOG.length);
  });

  it('returns the same cached array on repeat calls', async () => {
    const a = await loadChangelog();
    const b = await loadChangelog();
    expect(a).toBe(b);
  });
});

describe('latestUpdateId', () => {
  it('returns the first entry id', () => {
    expect(latestUpdateId([entry('a'), entry('b')])).toBe('a');
  });
  it('returns null for an empty log', () => {
    expect(latestUpdateId([])).toBeNull();
  });
});

describe('countUnseenUpdates', () => {
  const entries = [entry('a'), entry('b'), entry('c')];

  it('counts everything when never visited (null watermark)', () => {
    expect(countUnseenUpdates(null, entries)).toBe(3);
  });

  it('counts only entries newer than the watermark', () => {
    expect(countUnseenUpdates('a', entries)).toBe(0);
    expect(countUnseenUpdates('b', entries)).toBe(1);
    expect(countUnseenUpdates('c', entries)).toBe(2);
  });

  it('treats an unrecognized watermark as never-seen', () => {
    expect(countUnseenUpdates('gone', entries)).toBe(3);
  });

  it('is zero once the latest entry is marked seen', () => {
    expect(countUnseenUpdates(entries[0].id, entries)).toBe(0);
  });
});
