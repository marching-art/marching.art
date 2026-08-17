import { describe, it, expect } from 'vitest';
import { articleIdFromPath, mapArticleDoc } from './directorArticlesMap';

describe('articleIdFromPath', () => {
  it('builds the composite feed id from a full article path', () => {
    expect(articleIdFromPath('news_hub/scherzo_2025-26/days/day_12/articles/press_abc123')).toBe(
      'scherzo_2025-26_day_12_press_abc123'
    );
  });

  it('returns null for a too-short path', () => {
    expect(articleIdFromPath('news_hub/season/days/day_1')).toBeNull();
  });
});

describe('mapArticleDoc', () => {
  it('maps a press-release doc, converting a Timestamp createdAt', () => {
    const iso = '2026-08-11T18:00:00.000Z';
    const row = mapArticleDoc('news_hub/s/days/day_3/articles/press_x', {
      headline: 'Aurora unveils 2026',
      summary: 'Big reveal.',
      category: 'press',
      corpsName: 'Aurora',
      imageUrl: null,
      createdAt: { toDate: () => new Date(iso) },
    });
    expect(row).not.toBeNull();
    expect(row?.id).toBe('s_day_3_press_x');
    expect(row?.headline).toBe('Aurora unveils 2026');
    expect(row?.corpsName).toBe('Aurora');
    expect(row?.createdAt).toBe(iso);
  });

  it('accepts an ISO string createdAt and defaults missing fields', () => {
    const row = mapArticleDoc('news_hub/s/days/day_1/articles/community_1', {
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    expect(row?.category).toBe('press'); // default when unset
    expect(row?.headline).toBe('');
    expect(row?.createdAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns null for an unusable path', () => {
    expect(mapArticleDoc('bad/path', { headline: 'x' })).toBeNull();
  });
});
