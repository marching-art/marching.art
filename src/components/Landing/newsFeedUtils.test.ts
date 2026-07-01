import { describe, it, expect, vi } from 'vitest';
import {
  safeString,
  formatTimestamp,
  getReadingTime,
  getUrgencyBadge,
  getCategoryConfig,
  CATEGORIES,
} from './newsFeedUtils';

describe('safeString', () => {
  it('passes strings through and stringifies numbers', () => {
    expect(safeString('hello')).toBe('hello');
    expect(safeString(42)).toBe('42');
  });

  it('returns empty string for null/undefined', () => {
    expect(safeString(null)).toBe('');
    expect(safeString(undefined)).toBe('');
  });

  it('extracts known string-like properties from objects', () => {
    expect(safeString({ text: 'a' })).toBe('a');
    expect(safeString({ content: 'b' })).toBe('b');
    expect(safeString({ message: 'c' })).toBe('c');
  });

  it('returns empty string for an unrenderable object (and warns)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeString({ foo: 'bar' })).toBe('');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('formatTimestamp', () => {
  const now = new Date('2026-07-01T12:00:00');

  it('shows minutes for very recent stories', () => {
    const tenMinAgo = new Date('2026-07-01T11:50:00');
    expect(formatTimestamp(tenMinAgo, now)).toBe('10m ago');
  });

  it('shows "Today" for earlier the same day', () => {
    const earlier = new Date('2026-07-01T08:00:00');
    expect(formatTimestamp(earlier, now)).toMatch(/^Today, /);
  });

  it('shows "Yesterday" for the prior day', () => {
    const yesterday = new Date('2026-06-30T09:00:00');
    expect(formatTimestamp(yesterday, now)).toMatch(/^Yesterday, /);
  });

  it('shows an absolute date for older stories', () => {
    const older = new Date('2026-06-20T09:00:00');
    const out = formatTimestamp(older, now);
    expect(out).not.toMatch(/ago|Today|Yesterday/);
    expect(out).toMatch(/Jun/);
  });
});

describe('getReadingTime', () => {
  it('uses the backend-provided value when present', () => {
    expect(getReadingTime({ readingTime: '7 min read' })).toBe('7 min read');
  });

  it('estimates from the story text otherwise', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    expect(getReadingTime({ summary: words })).toBe('2 min read'); // 400 / 200
  });

  it('is at least 1 minute for short content', () => {
    expect(getReadingTime({ summary: 'short' })).toBe('1 min read');
  });
});

describe('getUrgencyBadge', () => {
  const now = new Date('2026-07-01T12:00:00');

  it('flags BREAKING within the hour', () => {
    expect(getUrgencyBadge(new Date('2026-07-01T11:30:00'), now)).toEqual({
      label: 'BREAKING',
      type: 'breaking',
    });
  });

  it('flags JUST IN within 6 hours', () => {
    expect(getUrgencyBadge(new Date('2026-07-01T09:00:00'), now)).toEqual({
      label: 'JUST IN',
      type: 'new',
    });
  });

  it('returns null for older stories', () => {
    expect(getUrgencyBadge(new Date('2026-06-30T09:00:00'), now)).toBeNull();
  });
});

describe('getCategoryConfig', () => {
  it('returns distinct config per known category', () => {
    expect(getCategoryConfig('dci').label).toBe('DCI RECAP');
    expect(getCategoryConfig('fantasy').label).toBe('FANTASY');
    expect(getCategoryConfig('analysis').label).toBe('ANALYSIS');
  });

  it('falls back to a generic NEWS config for unknown categories', () => {
    const cfg = getCategoryConfig('something-else');
    expect(cfg.label).toBe('NEWS');
    expect(cfg.icon).toBeTruthy();
  });
});

describe('CATEGORIES', () => {
  it('lists the four filter categories with icons', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['all', 'dci', 'fantasy', 'analysis']);
    for (const c of CATEGORIES) expect(c.icon).toBeTruthy();
  });
});
