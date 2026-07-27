// Pure helpers behind the notification bell. These pin the two things a
// reader actually sees — the badge text and the screen-reader label — plus
// the relative-time formatting, which has a deliberate clock-skew guard.
import { describe, it, expect } from 'vitest';
import {
  UNREAD_BADGE_CAP,
  countUnread,
  describeUnread,
  formatRelativeTime,
  formatUnreadBadge,
  toDateOrNull,
} from './notifications';

describe('formatUnreadBadge', () => {
  it('renders nothing when there is nothing unread', () => {
    // '' means "no badge" — a 0 must never render an empty circle.
    expect(formatUnreadBadge(0)).toBe('');
    expect(formatUnreadBadge(-3)).toBe('');
    expect(formatUnreadBadge(Number.NaN)).toBe('');
  });

  it('shows the exact count up to the cap', () => {
    expect(formatUnreadBadge(1)).toBe('1');
    expect(formatUnreadBadge(UNREAD_BADGE_CAP)).toBe(String(UNREAD_BADGE_CAP));
  });

  it('caps larger counts so the badge stays a circle', () => {
    expect(formatUnreadBadge(UNREAD_BADGE_CAP + 1)).toBe(`${UNREAD_BADGE_CAP}+`);
    expect(formatUnreadBadge(9999)).toBe(`${UNREAD_BADGE_CAP}+`);
  });
});

describe('describeUnread', () => {
  it('reports the true count rather than the capped badge text', () => {
    expect(describeUnread(12)).toBe('Notifications, 12 unread');
  });

  it('reads sensibly when the inbox is clear', () => {
    expect(describeUnread(0)).toBe('Notifications, none unread');
  });
});

describe('countUnread', () => {
  it('treats a missing read flag as unread', () => {
    expect(countUnread([{ read: true }, { read: false }, {}])).toBe(2);
  });

  it('is zero for an empty inbox', () => {
    expect(countUnread([])).toBe(0);
  });
});

describe('toDateOrNull', () => {
  it('accepts a Firestore-style timestamp', () => {
    const date = new Date('2026-07-04T12:00:00Z');
    expect(toDateOrNull({ toDate: () => date })?.getTime()).toBe(date.getTime());
  });

  it('returns null for values it cannot read as a date', () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-04T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('collapses the first minute to "Just now"', () => {
    expect(formatRelativeTime(ago(5_000), now)).toBe('Just now');
  });

  it('does not render a negative age when the server clock runs ahead', () => {
    // A fresh server stamp can land slightly in the future.
    expect(formatRelativeTime(new Date(now.getTime() + 30_000), now)).toBe('Just now');
  });

  it('steps through minutes, hours, and days', () => {
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe('3h ago');
    expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe('2d ago');
  });

  it('falls back to a calendar date past a week', () => {
    expect(formatRelativeTime(ago(30 * 86_400_000), now)).toBe('Jun 4');
  });

  it('renders nothing for an unreadable timestamp', () => {
    expect(formatRelativeTime(null, now)).toBe('');
  });
});
