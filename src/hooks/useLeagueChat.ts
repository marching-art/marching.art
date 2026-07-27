// src/hooks/useLeagueChat.ts
// Streamed league chat messages for the detail view's Chat tab.

import { useEffect, useState } from 'react';
import { subscribeToChat, type ChatMessage } from '../api/leagues';

/**
 * Subscribe to a league's chat (newest 50, delivered oldest-first by the api
 * helper).
 *
 * Held in local state rather than the query cache for the same reason as
 * useLeagueLiveStandings: the snapshot is the only source, nothing else reads
 * it, and there is no fetch to cache.
 */
export function useLeagueChat(leagueId: string | undefined): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = subscribeToChat(leagueId, (messagesData) => {
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [leagueId]);

  return messages;
}
