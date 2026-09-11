// src/utils/chatFormat.ts
// Pure helpers behind the league chat: time labels, run grouping, mention and
// link tokenizing, and the reaction palette. No React, no Firestore — every
// function here is unit-tested in chatFormat.test.ts.

import type { ChatMessage } from '../api/leagues';

/** Mirrors LEAGUE_CHAT_REACTIONS in functions/src/callable/leagueChat.js. */
export const CHAT_REACTIONS = ['🔥', '😂', '👏', '💀', '🏆', '👀'] as const;
export type ChatReaction = (typeof CHAT_REACTIONS)[number];

/** Mirrors MAX_LEAGUE_MESSAGE_LENGTH on the server. */
export const MAX_CHAT_MESSAGE_LENGTH = 1000;

/** Consecutive messages from one sender inside this window collapse into a run. */
const RUN_WINDOW_MS = 5 * 60 * 1000;

/** A Firestore timestamp, a Date, or anything Date accepts. */
export type MaybeTimestamp =
  | { toDate?: () => Date; toMillis?: () => number; seconds?: number }
  | string
  | number
  | Date
  | null
  | undefined;

export function toMillis(value: MaybeTimestamp): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function toDate(value: MaybeTimestamp): Date {
  const ms = toMillis(value);
  return ms ? new Date(ms) : new Date();
}

/** "3:42 PM" — the time a run started. Days come from the separators. */
export function formatClock(value: MaybeTimestamp): string {
  return toDate(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Full stamp for tooltips: "Tue, Sep 8 at 3:42 PM". */
export function formatFullStamp(value: MaybeTimestamp): string {
  const date = toDate(value);
  const day = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${day} at ${formatClock(date)}`;
}

/** Day separator label: Today / Yesterday / "Tue, Sep 8" (with year once it differs). */
export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** A member as the chat needs it. */
export interface ChatMember {
  displayName?: string;
  username?: string;
  corps?: Record<string, { corpsName?: string; name?: string } | undefined>;
}

export type ChatMemberMap = Record<string, ChatMember | undefined>;

/**
 * The name shown on a message. Never "You" — in a group thread a message
 * needs the same name everywhere it's quoted, mentioned, or listed.
 */
export function getChatDisplayName(uid: string | null | undefined, members: ChatMemberMap): string {
  const profile = uid ? members[uid] : undefined;
  const name = profile?.displayName;
  if (name && name !== 'Director') return name;
  if (profile?.username) return profile.username;
  if (name) return name;
  return `Director ${uid?.slice(0, 6) ?? ''}`.trim();
}

/** The `@handle` a mention inserts — usernames are what the push trigger matches. */
export function getMentionHandle(uid: string, members: ChatMemberMap): string | null {
  const profile = members[uid];
  const handle = profile?.username || profile?.displayName;
  if (!handle) return null;
  const compact = handle.replace(/\s+/g, '');
  return /^\w+$/.test(compact) ? compact : null;
}

/** The corps name a member is fielding, if any — shown under their name. */
export function getChatCorpsName(uid: string | null | undefined, members: ChatMemberMap): string {
  const corps = uid ? members[uid]?.corps : undefined;
  if (!corps) return '';
  for (const entry of Object.values(corps)) {
    const name = entry?.corpsName || entry?.name;
    if (name) return name;
  }
  return '';
}

/** Stable hue per member so avatars are tellable apart without uploads. */
export function avatarHue(uid: string | null | undefined): number {
  let hash = 0;
  for (const ch of uid ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------

export type ChatRow =
  | { kind: 'day'; key: string; date: Date }
  | { kind: 'unread'; key: string }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      /** First message of a sender's run: shows avatar, name and time. */
      startsRun: boolean;
      /** Newer than the viewer's read marker when the tab opened. */
      isUnread: boolean;
    };

export interface BuildRowsOptions {
  /** Read marker when the tab opened; 0 means nothing is unread. */
  unreadSince: number;
  viewerUid?: string;
  now?: Date;
}

/**
 * Turn the flat, oldest-first stream into what the list renders: day
 * separators, one "new messages" line at the first unread message that isn't
 * the viewer's own, and run flags so consecutive messages from one sender
 * share a header.
 */
export function buildChatRows(messages: ChatMessage[], opts: BuildRowsOptions): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '';
  let prev: ChatMessage | null = null;
  let unreadPlaced = false;

  for (const message of messages) {
    const date = toDate(message.createdAt);
    const dayKey = date.toDateString();
    let dayBoundary = false;
    if (dayKey !== lastDay) {
      rows.push({ kind: 'day', key: `day-${dayKey}`, date });
      lastDay = dayKey;
      dayBoundary = true;
    }

    const ms = toMillis(message.createdAt);
    const isUnread =
      opts.unreadSince > 0 && ms > opts.unreadSince && message.userId !== opts.viewerUid;
    if (isUnread && !unreadPlaced) {
      rows.push({ kind: 'unread', key: 'unread' });
      unreadPlaced = true;
    }

    const startsRun =
      dayBoundary ||
      !prev ||
      prev.userId !== message.userId ||
      ms - toMillis(prev.createdAt) > RUN_WINDOW_MS ||
      Boolean(message.replyTo) ||
      (isUnread && rows[rows.length - 1]?.kind === 'unread');

    rows.push({ kind: 'message', key: message.id, message, startsRun, isUnread });
    prev = message;
  }
  return rows;
}

// -----------------------------------------------------------------------------
// Message text
// -----------------------------------------------------------------------------

export type MessageToken =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; handle: string }
  | { type: 'link'; value: string; href: string };

const TOKEN_RE = /(@\w+)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/**
 * Split a message into plain text, @mentions and http(s) links. Mentions are
 * kept as typed (the row decides whether the handle resolves to a member).
 */
export function tokenizeMessage(text: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: 'text', value: text.slice(last, index) });
    if (match[1]) tokens.push({ type: 'mention', value: match[1], handle: match[1].slice(1) });
    else tokens.push({ type: 'link', value: match[2], href: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

/** Does this message @mention the viewer (by their username or display name)? */
export function mentionsViewer(
  text: string,
  viewerUid: string | undefined,
  members: ChatMemberMap
) {
  if (!viewerUid) return false;
  const handle = getMentionHandle(viewerUid, members);
  if (!handle) return false;
  const lower = handle.toLowerCase();
  return tokenizeMessage(text).some(
    (t) => t.type === 'mention' && t.handle.toLowerCase() === lower
  );
}

/**
 * The `@query` being typed at the caret, if any — drives the mention picker.
 * Returns the range to replace so the picker can splice the handle in.
 */
export function findMentionQuery(
  text: string,
  caret: number
): { query: string; start: number; end: number } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@(\w*)$/.exec(before);
  if (!match) return null;
  const start = caret - match[2].length - 1;
  return { query: match[2], start, end: caret };
}

/** Members whose handle or name starts with the query, capped for the popover. */
export function filterMentionCandidates(
  members: ChatMemberMap,
  query: string,
  excludeUid?: string,
  cap = 6
): Array<{ uid: string; handle: string; name: string }> {
  const q = query.toLowerCase();
  const out: Array<{ uid: string; handle: string; name: string }> = [];
  for (const uid of Object.keys(members)) {
    if (uid === excludeUid) continue;
    const handle = getMentionHandle(uid, members);
    if (!handle) continue;
    const name = getChatDisplayName(uid, members);
    if (!q || handle.toLowerCase().startsWith(q) || name.toLowerCase().startsWith(q)) {
      out.push({ uid, handle, name });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out.slice(0, cap);
}

/** Reaction chips in palette order, then any legacy emoji the doc still holds. */
export function orderedReactions(
  reactions: Record<string, string[]> | undefined
): Array<{ emoji: string; uids: string[] }> {
  if (!reactions) return [];
  const known = CHAT_REACTIONS.filter((e) => reactions[e]?.length).map((emoji) => ({
    emoji,
    uids: reactions[emoji],
  }));
  const extra = Object.keys(reactions)
    .filter((e) => !(CHAT_REACTIONS as readonly string[]).includes(e) && reactions[e]?.length)
    .map((emoji) => ({ emoji, uids: reactions[emoji] }));
  return [...known, ...extra];
}
