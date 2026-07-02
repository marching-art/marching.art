// Leagues API - League management and operations
// Handles league CRUD, membership, and chat

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Unsubscribe,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, paths, callFunction, withErrorHandling } from './client';
import type {
  League,
  LeagueStanding,
  LeagueCreationData,
  PaginatedResponse,
  ApiResponse,
} from '../types';

// =============================================================================
// LEAGUE QUERIES
// =============================================================================

const DEFAULT_PAGE_SIZE = 12;

/**
 * Get leagues the user is a member of
 */
export async function getMyLeagues(uid: string): Promise<League[]> {
  return withErrorHandling(async () => {
    const leaguesRef = collection(db, paths.leagues());
    const q = query(leaguesRef, where('members', 'array-contains', uid), limit(20));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as League[];
  }, 'Failed to fetch your leagues');
}

/**
 * Get public leagues with pagination
 */
export async function getPublicLeagues(
  pageSize = DEFAULT_PAGE_SIZE,
  lastDoc?: unknown
): Promise<PaginatedResponse<League>> {
  return withErrorHandling(async () => {
    const leaguesRef = collection(db, paths.leagues());

    let q = query(
      leaguesRef,
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    // Cast lastDoc to the expected type for pagination
    const lastDocSnapshot = lastDoc as QueryDocumentSnapshot<DocumentData> | undefined;
    if (lastDocSnapshot) {
      q = query(
        leaguesRef,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocSnapshot),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const leagues = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as League[];

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    return {
      data: leagues,
      hasMore: snapshot.docs.length === pageSize,
      lastDoc: lastVisible,
    };
  }, 'Failed to fetch public leagues');
}

/**
 * Get a single league by ID
 */
export async function getLeague(leagueId: string): Promise<League | null> {
  return withErrorHandling(async () => {
    const leagueRef = doc(db, paths.league(leagueId));
    const leagueDoc = await getDoc(leagueRef);

    if (!leagueDoc.exists()) {
      return null;
    }

    return {
      id: leagueDoc.id,
      ...leagueDoc.data(),
    } as League;
  }, 'Failed to fetch league');
}

/**
 * Subscribe to league updates
 */
export function subscribeToLeague(
  leagueId: string,
  onData: (league: League | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const leagueRef = doc(db, paths.league(leagueId));

  return onSnapshot(
    leagueRef,
    (doc) => {
      if (doc.exists()) {
        onData({ id: doc.id, ...doc.data() } as League);
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('League subscription error:', error);
      onError?.(error);
    }
  );
}

// =============================================================================
// LEAGUE STANDINGS
// =============================================================================

/**
 * Get league standings
 */
export async function getLeagueStandings(leagueId: string): Promise<LeagueStanding[]> {
  return withErrorHandling(async () => {
    const standingsRef = doc(db, paths.leagueStandings(leagueId));
    const standingsDoc = await getDoc(standingsRef);

    if (!standingsDoc.exists()) {
      return [];
    }

    const data = standingsDoc.data();
    return (data.standings || []) as LeagueStanding[];
  }, 'Failed to fetch league standings');
}

/**
 * Subscribe to league standings updates
 */
export function subscribeToStandings(
  leagueId: string,
  onData: (standings: LeagueStanding[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const standingsRef = doc(db, paths.leagueStandings(leagueId));

  return onSnapshot(
    standingsRef,
    (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        onData((data.standings || []) as LeagueStanding[]);
      } else {
        onData([]);
      }
    },
    (error) => {
      console.error('Standings subscription error:', error);
      onError?.(error);
    }
  );
}

// =============================================================================
// LEAGUE ACTIONS (Cloud Functions)
// =============================================================================

/**
 * Create a new league
 */
export async function createLeague(
  data: LeagueCreationData
): Promise<ApiResponse<{ leagueId: string }>> {
  return withErrorHandling(async () => {
    const result = await callFunction<LeagueCreationData, ApiResponse<{ leagueId: string }>>(
      'createLeague',
      data
    );
    return result.data;
  }, 'Failed to create league');
}

/**
 * Join a league by ID
 */
export async function joinLeague(leagueId: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunction<{ leagueId: string }, ApiResponse>('joinLeague', {
      leagueId,
    });
    return result.data;
  }, 'Failed to join league');
}

/**
 * Join a league by invite code
 */
export async function joinLeagueByCode(inviteCode: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunction<{ inviteCode: string }, ApiResponse>('joinLeagueByCode', {
      inviteCode,
    });
    return result.data;
  }, 'Failed to join league');
}

/**
 * Leave a league
 */
export async function leaveLeague(leagueId: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunction<{ leagueId: string }, ApiResponse>('leaveLeague', {
      leagueId,
    });
    return result.data;
  }, 'Failed to leave league');
}

// =============================================================================
// LEAGUE CHAT
// =============================================================================

export interface ChatMessage {
  id: string;
  userId: string;
  username?: string;
  message: string;
  createdAt: Date;
}

/**
 * Subscribe to league chat messages
 */
export function subscribeToChat(
  leagueId: string,
  onData: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
  messageLimit = 50
): Unsubscribe {
  const chatRef = collection(db, paths.leagueChat(leagueId));
  const q = query(chatRef, orderBy('createdAt', 'desc'), limit(messageLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ChatMessage[];

      // Reverse to show oldest first
      onData(messages.reverse());
    },
    (error) => {
      console.error('Chat subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Post a message to league chat
 */
export async function postChatMessage(leagueId: string, message: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunction<{ leagueId: string; message: string }, ApiResponse>(
      'postLeagueMessage',
      { leagueId, message }
    );
    return result.data;
  }, 'Failed to post message');
}

// =============================================================================
// MEMBER PROFILES, MATCHUPS & RECAPS (read helpers for the league detail views)
//
// These return raw Firestore document data and let errors propagate to the
// caller unchanged, so the existing component try/catch and fallback logic
// keep behaving identically. They intentionally do not use withErrorHandling.
// =============================================================================

/**
 * Fetch the profile documents for a set of league members, keyed by uid.
 * Members without a profile document are omitted.
 */
export async function getMemberProfiles(
  memberUids: string[]
): Promise<Record<string, DocumentData>> {
  const profiles: Record<string, DocumentData> = {};
  await Promise.all(
    memberUids.map(async (uid) => {
      const profileDoc = await getDoc(doc(db, paths.userProfile(uid)));
      if (profileDoc.exists()) {
        profiles[uid] = profileDoc.data();
      }
    })
  );
  return profiles;
}

/**
 * Fetch all matchup week documents for a league, as `{ id, ...data }`.
 */
export async function getLeagueMatchups(
  leagueId: string
): Promise<Array<{ id: string } & DocumentData>> {
  const snapshot = await getDocs(collection(db, paths.leagueMatchups(leagueId)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a single week's matchup document for a league, or null if absent.
 */
export async function getLeagueMatchupWeek(
  leagueId: string,
  week: number
): Promise<DocumentData | null> {
  const snap = await getDoc(doc(db, paths.leagueMatchupWeek(leagueId, week)));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fetch a single week's league recap document, or null if absent.
 */
export async function getLeagueWeekRecap(
  leagueId: string,
  week: number
): Promise<DocumentData | null> {
  const snap = await getDoc(doc(db, paths.leagueWeekRecap(leagueId, week)));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fetch the precomputed rivalries metadata document for a league, or null.
 */
export async function getLeagueRivalries(leagueId: string): Promise<DocumentData | null> {
  const snap = await getDoc(doc(db, paths.leagueMeta(leagueId, 'rivalries')));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fetch leagues created by a given user.
 */
export async function getLeaguesByCreator(
  uid: string
): Promise<Array<{ id: string } & DocumentData>> {
  const q = query(collection(db, paths.leagues()), where('creatorId', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a user's pending league invitations, newest first.
 *
 * Uses a simple equality query and sorts client-side to avoid requiring a
 * composite Firestore index.
 */
export async function getPendingInvitations(
  userId: string
): Promise<Array<{ id: string } & DocumentData>> {
  const q = query(
    collection(db, paths.leagueInvitations()),
    where('inviteeUid', '==', userId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const rows: Array<{ id: string } & DocumentData> = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  return rows.sort((a, b) => {
    const aTime = a.invitedAt?.toMillis?.() || 0;
    const bTime = b.invitedAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

// =============================================================================
// SCORING UTILITIES
// =============================================================================

/**
 * Placement points (DCI/NASCAR style scoring)
 */
export const PLACEMENT_POINTS: Record<number, number> = {
  1: 15,
  2: 12,
  3: 10,
  4: 8,
  5: 6,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1,
};

/**
 * Get points for a placement
 */
export function getPlacementPoints(placement: number): number {
  return PLACEMENT_POINTS[placement] || 1;
}
