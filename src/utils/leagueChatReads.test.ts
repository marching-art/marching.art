// Per-league chat read markers. The league card has always rendered an unread
// dot from `league.hasUnreadMessages` — a field nothing ever wrote — so this is
// the store that finally makes the indicator mean something.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLeagueChatReadAt, getLeagueChatReadAt, setLeagueChatReadAt } from './leagueChatReads';

const STORAGE_KEY = 'marchingart.leagueChatReads';

describe('leagueChatReads', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns 0 for a league that has never been read', () => {
    expect(getLeagueChatReadAt('league-1')).toBe(0);
  });

  it('round-trips a marker per league', () => {
    setLeagueChatReadAt('league-1', 1000);
    setLeagueChatReadAt('league-2', 2000);

    expect(getLeagueChatReadAt('league-1')).toBe(1000);
    expect(getLeagueChatReadAt('league-2')).toBe(2000);
  });

  it('never moves a marker backwards', () => {
    // Opening an older cached page must not un-read newer messages.
    setLeagueChatReadAt('league-1', 5000);
    setLeagueChatReadAt('league-1', 1000);
    expect(getLeagueChatReadAt('league-1')).toBe(5000);
  });

  it('ignores invalid stamps and empty league ids', () => {
    setLeagueChatReadAt('', 1000);
    setLeagueChatReadAt('league-1', 0);
    setLeagueChatReadAt('league-1', Number.NaN);
    setLeagueChatReadAt('league-1', -5);

    expect(getLeagueChatReadAt('league-1')).toBe(0);
    expect(getLeagueChatReadAt('')).toBe(0);
  });

  it('clears a single league without touching the others', () => {
    setLeagueChatReadAt('league-1', 1000);
    setLeagueChatReadAt('league-2', 2000);

    clearLeagueChatReadAt('league-1');

    expect(getLeagueChatReadAt('league-1')).toBe(0);
    expect(getLeagueChatReadAt('league-2')).toBe(2000);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem(STORAGE_KEY, 'not json at all');
    expect(getLeagueChatReadAt('league-1')).toBe(0);

    localStorage.setItem(STORAGE_KEY, '["an","array"]');
    expect(getLeagueChatReadAt('league-1')).toBe(0);

    localStorage.setItem(STORAGE_KEY, '{"league-1":"soon"}');
    expect(getLeagueChatReadAt('league-1')).toBe(0);
  });

  // A chat badge must never be able to throw — Safari private mode, blocked
  // cookies, and SSR all make storage unavailable.
  it('degrades quietly when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => setLeagueChatReadAt('league-1', 1000)).not.toThrow();
    expect(getLeagueChatReadAt('league-1')).toBe(0);
  });
});
