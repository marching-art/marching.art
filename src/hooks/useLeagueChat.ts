// src/hooks/useLeagueChat.ts
// Streamed league chat for the detail view's Chat tab, with older history on
// demand and a per-member read marker.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOlderChatMessages, subscribeToChat, type ChatMessage } from '../api/leagues';
import { getLeagueChatReadAt, setLeagueChatReadAt } from '../utils/leagueChatReads';

const LIVE_WINDOW = 50;
const PAGE_SIZE = 50;

export interface LeagueChatResult {
  messages: ChatMessage[];
  /** Messages the viewer hasn't seen, from their stored read marker. */
  unreadCount: number;
  /** True while there may be older history behind the loaded window. */
  hasMore: boolean;
  isLoadingMore: boolean;
  loadOlder: () => Promise<void>;
  /** Called when the viewer is actually looking at the conversation. */
  markRead: () => void;
}

/**
 * Subscribe to a league's chat.
 *
 * The stream is the newest `LIVE_WINDOW` messages, oldest-first. Anything older
 * had no way to be reached at all — a league that talks for a season lost its
 * own history off the top — so `loadOlder` pages backwards from the oldest
 * message currently held.
 *
 * Held in local state rather than the query cache for the same reason as
 * useLeagueLiveStandings: the snapshot is the only source and there is no fetch
 * to cache. The read marker is per-device (localStorage) rather than a
 * Firestore write per glance at a tab.
 */
export function useLeagueChat(leagueId: string | undefined): LeagueChatResult {
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [readAt, setReadAt] = useState(0);

  // Live window resets per league; older history must not leak across leagues.
  useEffect(() => {
    setLive([]);
    setOlder([]);
    setHasMore(false);
    setReadAt(leagueId ? getLeagueChatReadAt(leagueId) : 0);
    if (!leagueId) return;

    const unsubscribe = subscribeToChat(leagueId, (messagesData) => {
      setLive(messagesData);
      // A full window means there is probably history behind it.
      setHasMore((prev) => prev || messagesData.length >= LIVE_WINDOW);
    });

    return () => unsubscribe();
  }, [leagueId]);

  // Memoized: this feeds the useCallback dependency lists below, so a fresh
  // array each render would rebuild loadOlder/markRead on every tick.
  const messages = useMemo(() => (older.length > 0 ? [...older, ...live] : live), [older, live]);

  const loadOlder = useCallback(async () => {
    if (!leagueId || isLoadingMore) return;
    const oldest = messages[0];
    if (!oldest) return;

    setIsLoadingMore(true);
    try {
      const page = await getOlderChatMessages(leagueId, oldest.createdAt, PAGE_SIZE);
      if (page.length > 0) setOlder((prev) => [...page, ...prev]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [leagueId, isLoadingMore, messages]);

  const markRead = useCallback(() => {
    if (!leagueId) return;
    const newest = messages[messages.length - 1];
    const stamp = toMillis(newest?.createdAt);
    if (!stamp || stamp <= readAt) return;
    setLeagueChatReadAt(leagueId, stamp);
    setReadAt(stamp);
  }, [leagueId, messages, readAt]);

  const unreadCount = useMemo(
    () => (readAt ? messages.filter((m) => toMillis(m.createdAt) > readAt).length : 0),
    [messages, readAt]
  );

  return { messages, unreadCount, hasMore, isLoadingMore, loadOlder, markRead };
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  const candidate = value as { toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === 'function') return candidate.toMillis();
  if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  const parsed = new Date(value as string).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
