import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '../api/leagues';
import {
  buildChatRows,
  filterMentionCandidates,
  findMentionQuery,
  formatDayLabel,
  getChatDisplayName,
  getMentionHandle,
  mentionsViewer,
  orderedReactions,
  toMillis,
  tokenizeMessage,
} from './chatFormat';

const at = (iso: string) => new Date(iso);
const msg = (id: string, userId: string, createdAt: Date, extra: Partial<ChatMessage> = {}) =>
  ({ id, userId, message: `m-${id}`, createdAt, ...extra }) as ChatMessage;

const members = {
  u1: { displayName: 'Chris Rohn', username: 'crohn' },
  u2: { displayName: 'Director', username: 'blue_devil' },
  u3: { username: 'Has Space Name' },
};

describe('toMillis', () => {
  it('reads Firestore shapes, Dates, and strings', () => {
    expect(toMillis({ toMillis: () => 5 })).toBe(5);
    expect(toMillis({ seconds: 2 })).toBe(2000);
    expect(toMillis(at('2026-09-08T12:00:00Z'))).toBe(Date.parse('2026-09-08T12:00:00Z'));
    expect(toMillis('nonsense')).toBe(0);
    expect(toMillis(null)).toBe(0);
  });
});

describe('formatDayLabel', () => {
  const now = at('2026-09-10T15:00:00');
  it('names today and yesterday, then falls back to a date', () => {
    expect(formatDayLabel(at('2026-09-10T01:00:00'), now)).toBe('Today');
    expect(formatDayLabel(at('2026-09-09T23:00:00'), now)).toBe('Yesterday');
    expect(formatDayLabel(at('2026-09-01T12:00:00'), now)).toBe('Tue, Sep 1');
    expect(formatDayLabel(at('2025-12-25T12:00:00'), now)).toContain('2025');
  });
});

describe('names and handles', () => {
  it('prefers a real display name, then the username, never "You"', () => {
    expect(getChatDisplayName('u1', members)).toBe('Chris Rohn');
    expect(getChatDisplayName('u2', members)).toBe('blue_devil');
    expect(getChatDisplayName('zz', members)).toBe('Director zz');
  });
  it('only offers a mention handle the push trigger can match', () => {
    expect(getMentionHandle('u1', members)).toBe('crohn');
    expect(getMentionHandle('u3', members)).toBe('HasSpaceName');
    expect(getMentionHandle('nobody', members)).toBeNull();
  });
});

describe('buildChatRows', () => {
  it('adds day separators and collapses a sender run inside five minutes', () => {
    const rows = buildChatRows(
      [
        msg('a', 'u1', at('2026-09-08T10:00:00')),
        msg('b', 'u1', at('2026-09-08T10:02:00')),
        msg('c', 'u1', at('2026-09-08T10:09:00')),
        msg('d', 'u2', at('2026-09-09T10:10:00')),
      ],
      { unreadSince: 0 }
    );
    expect(rows.map((r) => r.kind)).toEqual([
      'day',
      'message',
      'message',
      'message',
      'day',
      'message',
    ]);
    const flags = rows.filter((r) => r.kind === 'message').map((r) => r.startsRun);
    expect(flags).toEqual([true, false, true, true]);
  });

  it('places one unread line before the first unread message that is not the viewer’s', () => {
    const rows = buildChatRows(
      [
        msg('a', 'u2', at('2026-09-08T10:00:00')),
        msg('mine', 'u1', at('2026-09-08T10:05:00')),
        msg('b', 'u2', at('2026-09-08T10:06:00')),
        msg('c', 'u2', at('2026-09-08T10:07:00')),
      ],
      { unreadSince: Date.parse('2026-09-08T10:01:00'), viewerUid: 'u1' }
    );
    const kinds = rows.map((r) => (r.kind === 'message' ? r.key : r.kind));
    expect(kinds).toEqual(['day', 'a', 'mine', 'unread', 'b', 'c']);
    const b = rows.find((r) => r.kind === 'message' && r.key === 'b');
    expect(b && b.kind === 'message' && b.startsRun).toBe(true);
  });

  it('a reply always starts a run so its quote has a header', () => {
    const rows = buildChatRows(
      [
        msg('a', 'u1', at('2026-09-08T10:00:00')),
        msg('b', 'u1', at('2026-09-08T10:01:00'), {
          replyTo: { id: 'x', userId: 'u2', message: 'hi' },
        }),
      ],
      { unreadSince: 0 }
    );
    const b = rows[2];
    expect(b.kind === 'message' && b.startsRun).toBe(true);
  });
});

describe('tokenizeMessage', () => {
  it('splits mentions and links out of plain text', () => {
    expect(tokenizeMessage('gg @crohn see https://marching.art/leagues. ok')).toEqual([
      { type: 'text', value: 'gg ' },
      { type: 'mention', value: '@crohn', handle: 'crohn' },
      { type: 'text', value: ' see ' },
      { type: 'link', value: 'https://marching.art/leagues', href: 'https://marching.art/leagues' },
      { type: 'text', value: '. ok' },
    ]);
  });
  it('recognises when the viewer is mentioned, case-insensitively', () => {
    expect(mentionsViewer('hey @CROHN', 'u1', members)).toBe(true);
    expect(mentionsViewer('hey @someone', 'u1', members)).toBe(false);
    expect(mentionsViewer('hey @crohn', undefined, members)).toBe(false);
  });
});

describe('mention picker', () => {
  it('finds the @query at the caret only when it is a word being typed', () => {
    expect(findMentionQuery('hi @cr', 6)).toEqual({ query: 'cr', start: 3, end: 6 });
    expect(findMentionQuery('hi @', 4)).toEqual({ query: '', start: 3, end: 4 });
    expect(findMentionQuery('email me@x', 10)).toBeNull();
    expect(findMentionQuery('hi @cr done', 11)).toBeNull();
  });
  it('filters members by handle or name and excludes the viewer', () => {
    expect(filterMentionCandidates(members, 'b', 'u1').map((c) => c.handle)).toEqual([
      'blue_devil',
    ]);
    expect(filterMentionCandidates(members, 'ch', 'u1')).toEqual([]);
    expect(filterMentionCandidates(members, 'ch').map((c) => c.uid)).toEqual(['u1']);
  });
});

describe('orderedReactions', () => {
  it('keeps palette order, drops empties, and appends unknown emoji last', () => {
    expect(
      orderedReactions({ '👀': ['a'], '🔥': ['a', 'b'], '😂': [], '🎺': ['c'] }).map((r) => r.emoji)
    ).toEqual(['🔥', '👀', '🎺']);
    expect(orderedReactions(undefined)).toEqual([]);
  });
});
