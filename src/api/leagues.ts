// Leagues API - League management and operations
// Handles league CRUD, membership, and chat

import {
  collection,
  collectionGroup,
  doc,
  documentId,
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
import { db, paths, withErrorHandling } from './client';
// League actions report funnel events; callFunctionTracked is the
// instrumented transport (see the note in src/api/callable.ts).
import { callFunctionTracked } from './callable';
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
 * Get public leagues with pagination.
 *
 * Only leagues with at least one director registered for the CURRENT season are
 * discoverable. A league's roster is permanent, but participation is not —
 * season rollover preserves each director's corps name, so `members.length`
 * describes who ever joined, not who is playing. Without this filter the browse
 * grid advertised leagues that looked well populated but had nobody fielding a
 * corps, which is the worst thing a new director can join.
 *
 * `seasonActivity.activeMemberCount` is maintained by the backend (see
 * functions/src/helpers/leagueActivity.js) and zeroed at season rollover, so
 * every league goes dark when the season resets and reappears as its members
 * come back and set their corps up.
 *
 * Two consequences worth knowing:
 *  - liveliest leagues sort first (the inequality field must lead the sort),
 *    with newest breaking ties;
 *  - leagues predating this field are absent until the nightly refresh
 *    backfills them, because Firestore inequality filters skip documents that
 *    lack the field.
 *
 * Members and commissioners always reach their own leagues through
 * getMyLeagues/getLeaguesByCreator, which are deliberately unfiltered.
 */
export async function getPublicLeagues(
  pageSize = DEFAULT_PAGE_SIZE,
  lastDoc?: unknown
): Promise<PaginatedResponse<League>> {
  return withErrorHandling(async () => {
    const leaguesRef = collection(db, paths.leagues());

    const constraints = [
      where('isPublic', '==', true),
      where('seasonActivity.activeMemberCount', '>=', 1),
      orderBy('seasonActivity.activeMemberCount', 'desc'),
      orderBy('createdAt', 'desc'),
    ];

    let q = query(leaguesRef, ...constraints, limit(pageSize));

    // Cast lastDoc to the expected type for pagination
    const lastDocSnapshot = lastDoc as QueryDocumentSnapshot<DocumentData> | undefined;
    if (lastDocSnapshot) {
      q = query(leaguesRef, ...constraints, startAfter(lastDocSnapshot), limit(pageSize));
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
 * Get a league's invite code from the member-only meta/private doc.
 * Legacy leagues may still carry the code on the league doc itself until the
 * strip migration runs; callers should prefer that field when present.
 */
export async function getLeagueInviteCode(leagueId: string): Promise<string | null> {
  try {
    const metaRef = doc(db, paths.leagueMeta(leagueId, 'private'));
    const metaDoc = await getDoc(metaRef);
    return metaDoc.exists() ? ((metaDoc.data().inviteCode as string | undefined) ?? null) : null;
  } catch {
    // Non-members are denied by rules; the code simply isn't shown.
    return null;
  }
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
    const result = await callFunctionTracked<LeagueCreationData, ApiResponse<{ leagueId: string }>>(
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
    const result = await callFunctionTracked<{ leagueId: string }, ApiResponse>('joinLeague', {
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
    const result = await callFunctionTracked<{ inviteCode: string }, ApiResponse>(
      'joinLeagueByCode',
      {
        inviteCode,
      }
    );
    return result.data;
  }, 'Failed to join league');
}

/**
 * Leave a league
 */
export async function leaveLeague(leagueId: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunctionTracked<{ leagueId: string }, ApiResponse>('leaveLeague', {
      leagueId,
    });
    return result.data;
  }, 'Failed to leave league');
}

/**
 * Remove a member from a league (commissioner only).
 *
 * The server refunds the removed director's entry fee out of the prize pool and
 * writes the removal to the league activity feed — see removeLeagueMember in
 * functions/src/callable/leagues.js.
 */
export async function removeLeagueMember(leagueId: string, memberId: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunctionTracked<{ leagueId: string; memberId: string }, ApiResponse>(
      'removeLeagueMember',
      { leagueId, memberId }
    );
    return result.data;
  }, 'Failed to remove member');
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
    const result = await callFunctionTracked<{ leagueId: string; message: string }, ApiResponse>(
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
 * The slice of a member's profile document the league views actually render:
 * a name, the corps map (enumerated with Object.values to find the active
 * corps, so every class key has to survive), and the cosmetics sub-object
 * (StandingsTab hands the whole thing to getEquippedCosmetic).
 *
 * Profile documents are large — full corps lineups, score history, the
 * challenge ledger — and a league fans out one per member. Projecting here
 * keeps that bulk out of the react-query cache and out of the props that get
 * drilled through five tabs.
 */
export interface LeagueMemberProfile {
  displayName?: string;
  username?: string;
  corps?: Record<string, { corpsName?: string; name?: string } & DocumentData>;
  cosmetics?: DocumentData;
}

/** Firestore caps `in` filters at 30 values. */
const MEMBER_PROFILE_CHUNK_SIZE = 30;

function projectMemberProfile(data: DocumentData): LeagueMemberProfile {
  return {
    displayName: data.displayName,
    username: data.username,
    corps: data.corps,
    cosmetics: data.cosmetics,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Per-document fallback for getMemberProfiles.
 *
 * The path-based profile rule is `allow read: if true` while the collection
 * group rule requires auth, and a collection group filter on documentId()
 * leans on index behaviour we cannot exercise from the client test suite. If
 * the batched query is ever rejected, degrade to the original fan-out rather
 * than blanking the league — bounded so a large roster cannot open dozens of
 * simultaneous connections.
 */
async function getMemberProfilesIndividually(
  memberUids: string[]
): Promise<Record<string, LeagueMemberProfile>> {
  const profiles: Record<string, LeagueMemberProfile> = {};
  const MAX_CONCURRENT = 10;
  for (const batch of chunk(memberUids, MAX_CONCURRENT)) {
    await Promise.all(
      batch.map(async (uid) => {
        const profileDoc = await getDoc(doc(db, paths.userProfile(uid)));
        if (profileDoc.exists()) {
          profiles[uid] = projectMemberProfile(profileDoc.data());
        }
      })
    );
  }
  return profiles;
}

/**
 * Fetch the profile documents for a set of league members, keyed by uid.
 * Members without a profile document are omitted.
 *
 * Profiles live at `users/{uid}/profile/data`, so they are only reachable as a
 * set through the `profile` collection group — one query per 30 members
 * instead of one round trip per member. `documentId()` in a collection group
 * query must be compared against full document paths, which is why the values
 * are DocumentReferences built from the shared path helper.
 */
export async function getMemberProfiles(
  memberUids: string[]
): Promise<Record<string, LeagueMemberProfile>> {
  if (!memberUids.length) return {};

  const profiles: Record<string, LeagueMemberProfile> = {};
  try {
    await Promise.all(
      chunk(memberUids, MEMBER_PROFILE_CHUNK_SIZE).map(async (uids) => {
        const refs = uids.map((uid) => doc(db, paths.userProfile(uid)));
        const snapshot = await getDocs(
          query(collectionGroup(db, 'profile'), where(documentId(), 'in', refs))
        );
        snapshot.docs.forEach((d) => {
          // `.../users/{uid}/profile/data` — the uid is the grandparent doc.
          const uid = d.ref.parent.parent?.id;
          if (uid) {
            profiles[uid] = projectMemberProfile(d.data());
          }
        });
      })
    );
  } catch (error) {
    console.warn('Batched member profile query failed; falling back to per-document reads', error);
    return getMemberProfilesIndividually(memberUids);
  }
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
