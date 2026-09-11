// src/hooks/useLeagueChat.ts
// Streamed league chat for the detail view's Chat tab: the live window, older
// history on demand, a per-device read marker, and the social actions (send,
// reply, react, delete, report) with optimistic local state so a tap feels
// instant even though every write goes through a callable.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteChatMessage,
  getOlderChatMessages,
  postChatMessage,
  reportChatMessage,
  subscribeToChat,
  toggleChatReaction,
  type ChatMessage,
} from '../api/leagues';
import { getLeagueChatReadAt, setLeagueChatReadAt } from '../utils/leagueChatReads';
import { toMillis } from '../utils/chatFormat';

const LIVE_WINDOW = 50;
const PAGE_SIZE = 50;

/** A message the viewer just sent, shown before the stream echoes it back. */
export interface PendingChatMessage extends ChatMessage {
  pending: true;
  status: 'sending' | 'failed';
  error?: string;
}

export type ChatListMessage = ChatMessage | PendingChatMessage;

export function isPendingMessage(message: ChatListMessage): message is PendingChatMessage {
  return (message as PendingChatMessage).pending === true;
}

export interface LeagueChatResult {
  messages: ChatListMessage[];
  /** Messages the viewer hasn't seen, from their stored read marker. */
  unreadCount: number;
  /** Epoch millis of the newest message this device has marked read (0 = never). */
  readAt: number;
  /** True while there may be older history behind the loaded window. */
  hasMore: boolean;
  isLoadingMore: boolean;
  loadOlder: () => Promise<void>;
  /** Called when the viewer is actually looking at the newest message. */
  markRead: () => void;
  /** Post a message, optionally quoting another. Resolves once the server accepted it. */
  sendMessage: (text: string, replyTo?: string | null) => Promise<boolean>;
  /** Re-send a failed local message. */
  retryMessage: (clientId: string) => Promise<boolean>;
  /** Drop a failed local message. */
  discardMessage: (clientId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  reportMessage: (messageId: string, reason: string) => Promise<string>;
}

/**
 * Subscribe to a league's chat.
 *
 * The stream is the newest `LIVE_WINDOW` messages, oldest-first; `loadOlder`
 * pages backwards from the oldest message held. Held in local state rather
 * than the query cache: the snapshot is the only source and there is no fetch
 * to cache. The read marker is per-device (localStorage) rather than a
 * Firestore write per glance at a tab.
 */
export function useLeagueChat(
  leagueId: string | undefined,
  viewerUid?: string | undefined
): LeagueChatResult {
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Initialised synchronously so a tab that mounts on the first render sees
  // the stored marker, not a 0 the reset effect fixes a tick later.
  const [readAt, setReadAt] = useState(() => (leagueId ? getLeagueChatReadAt(leagueId) : 0));
  // Reactions the viewer toggled that the stream hasn't echoed yet, keyed by
  // message id. Cleared for a message whenever its live doc changes.
  const [optimisticReactions, setOptimisticReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const liveRef = useRef<ChatMessage[]>([]);

  // Everything resets per league; nothing may leak across leagues.
  useEffect(() => {
    setLive([]);
    setOlder([]);
    setPending([]);
    setOptimisticReactions({});
    setHasMore(false);
    setReadAt(leagueId ? getLeagueChatReadAt(leagueId) : 0);
    liveRef.current = [];
    if (!leagueId) return;

    const unsubscribe = subscribeToChat(leagueId, (messagesData) => {
      const previous = liveRef.current;
      liveRef.current = messagesData;
      setLive(messagesData);
      // A full window means there is probably history behind it.
      setHasMore((prev) => prev || messagesData.length >= LIVE_WINDOW);
      // The stream is the truth for reactions once it moves.
      setOptimisticReactions((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const next = { ...prev };
        let changed = false;
        for (const message of messagesData) {
          if (!(message.id in next)) continue;
          const before = previous.find((m) => m.id === message.id);
          if (!before || before.reactions !== message.reactions) {
            delete next[message.id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      // A pending message whose server copy arrived is done.
      setPending((prev) =>
        prev.length === 0 ? prev : prev.filter((p) => !messagesData.some((m) => m.id === p.id))
      );
    });

    return () => unsubscribe();
  }, [leagueId]);

  const messages = useMemo<ChatListMessage[]>(() => {
    const stream = older.length > 0 ? [...older, ...live] : live;
    const withReactions =
      Object.keys(optimisticReactions).length === 0
        ? stream
        : stream.map((m) =>
            optimisticReactions[m.id] ? { ...m, reactions: optimisticReactions[m.id] } : m
          );
    return pending.length > 0 ? [...withReactions, ...pending] : withReactions;
  }, [older, live, pending, optimisticReactions]);

  const loadOlder = useCallback(async () => {
    if (!leagueId || isLoadingMore) return;
    const oldest = older[0] ?? live[0];
    if (!oldest) return;

    setIsLoadingMore(true);
    try {
      const page = await getOlderChatMessages(leagueId, oldest.createdAt, PAGE_SIZE);
      if (page.length > 0) setOlder((prev) => [...page, ...prev]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [leagueId, isLoadingMore, older, live]);

  const markRead = useCallback(() => {
    if (!leagueId) return;
    const newest = live[live.length - 1];
    const stamp = toMillis(newest?.createdAt);
    if (!stamp || stamp <= readAt) return;
    setLeagueChatReadAt(leagueId, stamp);
    setReadAt(stamp);
  }, [leagueId, live, readAt]);

  const unreadCount = useMemo(
    () =>
      readAt
        ? live.filter((m) => m.userId !== viewerUid && toMillis(m.createdAt) > readAt).length
        : 0,
    [live, readAt, viewerUid]
  );

  const submit = useCallback(
    async (local: PendingChatMessage): Promise<boolean> => {
      if (!leagueId) return false;
      try {
        const result = await postChatMessage(leagueId, local.message, local.replyTo?.id);
        const serverId = result.messageId;
        // Re-key to the server id so the stream's echo replaces this entry
        // in place; if the echo already landed, drop the local copy.
        setPending((prev) => {
          const echoed = serverId && liveRef.current.some((m) => m.id === serverId);
          if (echoed || !serverId) return prev.filter((p) => p.id !== local.id);
          return prev.map((p) => (p.id === local.id ? { ...p, id: serverId } : p));
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send';
        setPending((prev) =>
          prev.map((p) => (p.id === local.id ? { ...p, status: 'failed', error: message } : p))
        );
        return false;
      }
    },
    [leagueId]
  );

  const sendMessage = useCallback(
    async (text: string, replyTo?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed || !leagueId || !viewerUid) return false;
      const quoted = replyTo ? messages.find((m) => m.id === replyTo) : undefined;
      const local: PendingChatMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: viewerUid,
        message: trimmed,
        createdAt: new Date(),
        pending: true,
        status: 'sending',
        replyTo: quoted
          ? { id: quoted.id, userId: quoted.userId, message: quoted.message }
          : undefined,
      };
      setPending((prev) => [...prev, local]);
      return submit(local);
    },
    [leagueId, viewerUid, messages, submit]
  );

  const retryMessage = useCallback(
    async (clientId: string) => {
      const local = pending.find((p) => p.id === clientId);
      if (!local) return false;
      const retried: PendingChatMessage = {
        ...local,
        status: 'sending',
        error: undefined,
        createdAt: new Date(),
      };
      setPending((prev) => prev.map((p) => (p.id === clientId ? retried : p)));
      return submit(retried);
    },
    [pending, submit]
  );

  const discardMessage = useCallback((clientId: string) => {
    setPending((prev) => prev.filter((p) => p.id !== clientId));
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!leagueId || !viewerUid) return;
      const current = messages.find((m) => m.id === messageId);
      if (!current || isPendingMessage(current)) return;
      const holders = current.reactions?.[emoji] ?? [];
      const has = holders.includes(viewerUid);
      const nextHolders = has ? holders.filter((u) => u !== viewerUid) : [...holders, viewerUid];
      const next = { ...(current.reactions ?? {}) };
      if (nextHolders.length > 0) next[emoji] = nextHolders;
      else delete next[emoji];
      setOptimisticReactions((prev) => ({ ...prev, [messageId]: next }));
      try {
        await toggleChatReaction(leagueId, messageId, emoji);
      } catch (error) {
        setOptimisticReactions((prev) => {
          const copy = { ...prev };
          delete copy[messageId];
          return copy;
        });
        throw error;
      }
    },
    [leagueId, viewerUid, messages]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!leagueId) return;
      await deleteChatMessage(leagueId, messageId);
    },
    [leagueId]
  );

  const reportMessage = useCallback(
    async (messageId: string, reason: string) => {
      if (!leagueId) return '';
      const result = await reportChatMessage(leagueId, messageId, reason);
      return result.message ?? 'Reported.';
    },
    [leagueId]
  );

  return {
    messages,
    unreadCount,
    readAt,
    hasMore,
    isLoadingMore,
    loadOlder,
    markRead,
    sendMessage,
    retryMessage,
    discardMessage,
    toggleReaction,
    deleteMessage,
    reportMessage,
  };
}
