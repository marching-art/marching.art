import { describe, it, expect } from 'vitest';
import {
  CHANGELOG,
  ROADMAP,
  UPDATE_CATEGORY_META,
  ROADMAP_STATUS_META,
  latestUpdateId,
  countUnseenUpdates,
  type ChangelogEntry,
} from './changelog';

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

describe('latestUpdateId', () => {
  it('returns the first entry id', () => {
    expect(latestUpdateId([entry('a'), entry('b')])).toBe('a');
  });
  it('returns null for an empty log', () => {
    expect(latestUpdateId([])).toBeNull();
  });
  it('defaults to the real changelog', () => {
    expect(latestUpdateId()).toBe(CHANGELOG[0].id);
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

  it('is zero once the latest real entry is marked seen', () => {
    expect(countUnseenUpdates(CHANGELOG[0].id)).toBe(0);
  });
});
