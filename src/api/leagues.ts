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
import { getActiveMemberCount, isLeagueDormant } from '../utils/leagueActivity';
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
    // Bounded by `maxMembers`-capped leagues a director can realistically be
    // in, not by the old `limit(20)` — which silently dropped a league for
    // anyone in 21, with no pagination and no indication in the UI that
    // anything was missing.
    const q = query(leaguesRef, where('members', 'array-contains', uid), limit(100));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as League[];
  }, 'Failed to fetch your leagues');
}

/**
 * How many raw league documents a page reads before the dormancy filter runs.
 * Over-fetching keeps a page from collapsing to a handful of cards when a run
 * of leagues happens to be sitting the season out.
 */
const DISCOVER_FETCH_MULTIPLIER = 3;

/**
 * Get public leagues with pagination.
 *
 * Leagues with nobody registered for the CURRENT season are hidden. A league's
 * roster is permanent, but participation is not — season rollover preserves
 * each director's corps name, so `members.length` describes who ever joined,
 * not who is playing. Without this the browse grid advertised leagues that
 * looked well populated but had nobody fielding a corps, which is the worst
 * thing a new director can join.
 *
 * The filter runs on the CLIENT, over a query ordered by `createdAt`, rather
 * than as a Firestore `where('seasonActivity.activeMemberCount', '>=', 1)`.
 * That is deliberate, and it is the fix for leagues that stayed invisible
 * mid-season while their members were plainly competing:
 *
 *  - a server-side inequality is fail-CLOSED. Firestore skips any document
 *    missing the field, so a league whose `seasonActivity` block had not been
 *    written yet — one created before the block existed, or one whose
 *    best-effort refresh was swallowed — dropped out of discovery entirely and
 *    stayed out until a nightly job happened to repair it;
 *  - it also hard-couples discovery to a materialized counter being FRESH. Any
 *    lag between a director registering and their leagues being recomputed
 *    read to everyone else as "this league does not exist".
 *
 * Filtering here inverts that: only leagues we can PROVE are dormant
 * (`activeMemberCount === 0`, per isLeagueDormant) are dropped. Unknown
 * participation shows — an un-backfilled league is not an empty one, the same
 * rule the league cards already follow (src/utils/leagueActivity.ts).
 *
 * Liveliest leagues still sort first, now within the fetched page.
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
    const fetchSize = pageSize * DISCOVER_FETCH_MULTIPLIER;

    const constraints = [where('isPublic', '==', true), orderBy('createdAt', 'desc')];

    // Cast lastDoc to the expected type for pagination
    const lastDocSnapshot = lastDoc as QueryDocumentSnapshot<DocumentData> | undefined;
    const q = lastDocSnapshot
      ? query(leaguesRef, ...constraints, startAfter(lastDocSnapshot), limit(fetchSize))
      : query(leaguesRef, ...constraints, limit(fetchSize));

    const snapshot = await getDocs(q);
    const leagues = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as League)
      .filter((league) => !isLeagueDormant(league))
      .sort((a, b) => (getActiveMemberCount(b) ?? 0) - (getActiveMemberCount(a) ?? 0));

    // The cursor tracks the RAW page, not the filtered result — otherwise
    // resuming from the last surviving league would silently re-read (or skip)
    // whatever the filter removed after it.
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    return {
      data: leagues,
      hasMore: snapshot.docs.length === fetchSize,
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

/** What the createLeague callable actually returns: the new league's id and
 *  its real invite code, at the top level (not nested under `data`). The
 *  success screen shares this code, so it must be the server's — never a
 *  client-side guess. */
export interface CreateLeagueResult {
  success: boolean;
  message?: string;
  inviteCode?: string;
  leagueId?: string;
}

/**
 * Create a new league
 */
export async function createLeague(data: LeagueCreationData): Promise<CreateLeagueResult> {
  return withErrorHandling(async () => {
    const result = await callFunctionTracked<LeagueCreationData, CreateLeagueResult>(
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
 * Page backwards through chat history.
 *
 * `subscribeToChat` streams only the newest 50, and there was no way to reach
 * anything older — a league that talks for a season lost its own history off
 * the top of the window. Returns oldest-first, ready to prepend.
 */
export async function getOlderChatMessages(
  leagueId: string,
  before: unknown,
  pageLimit = 50
): Promise<ChatMessage[]> {
  const chatRef = collection(db, paths.leagueChat(leagueId));
  const q = query(chatRef, orderBy('createdAt', 'desc'), startAfter(before), limit(pageLimit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse();
}

/**
 * Delete a chat message. The author can remove their own; the commissioner can
 * remove anyone's. League chat had no moderation surface at all — no delete, no
 * report, no mute — while storing messages verbatim and rendering them to every
 * member. ChatTab even received `isCommissioner` and discarded it.
 */
export async function deleteChatMessage(leagueId: string, messageId: string): Promise<ApiResponse> {
  return withErrorHandling(async () => {
    const result = await callFunctionTracked<{ leagueId: string; messageId: string }, ApiResponse>(
      'deleteLeagueMessage',
      { leagueId, messageId }
    );
    return result.data;
  }, 'Failed to delete message');
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
 * Every archived season's matchup weeks, as `{ id, ...data }`.
 *
 * Rollover MOVES finished weeks here so the live collection only ever holds the
 * current season (see resetLeaguesForNewSeason — leaving them in place made the
 * generator skip every week of the next season). Ids are `{seasonUid}_week-N`,
 * which is deliberately not `week-N`: every reader that walks the live
 * collection filters on that shape, so history can never be mistaken for
 * current work.
 */
export async function getLeagueMatchupHistory(
  leagueId: string
): Promise<Array<{ id: string } & DocumentData>> {
  const snapshot = await getDocs(collection(db, paths.leagueMatchupHistory(leagueId)));
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
