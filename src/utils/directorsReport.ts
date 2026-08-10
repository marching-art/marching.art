// =============================================================================
// DIRECTOR'S REPORT — the day's set
// =============================================================================
// One computation of "what is on today's list and how much of it is done",
// shared by the Director's Report card (which renders the list) and the Next
// Action resolver (which only needs the count). It used to live inline in
// DirectorsReport.jsx; two copies of this arithmetic would drift the moment
// either the challenge rotation or the prediction catalog changed.
//
// Everything here is derived from server-authoritative profile state — the
// challenge/prediction buckets are written by the callables that award them,
// so this reads what the server already decided rather than guessing.

import { getGameDay, getAvailableChallengesForGameDay } from './dailyChallenges';
import { buildQuestions } from './dailyPredictions';

/**
 * The two Podium facts the profile alone can't answer, because Podium keeps
 * its show picks and (as a string, not a `{theme}`) its concept in a
 * server-only subcollection. Sourced from usePodium at the dashboard level and
 * passed in; null when the director has no Podium corps.
 */
export interface PodiumChallengeFacts {
  hasShows: boolean;
  hasConcept: boolean;
}

/**
 * The per-day league-pool fact the join-league-pool challenge needs: has the
 * director entered today's prediction pool in any of their leagues? Read off
 * the leagues' pool docs (useLeaguePoolFacts) and passed in, because pool
 * entries live off the profile.
 */
export interface LeaguePoolChallengeFacts {
  hasEntered: boolean;
}

/** One of the day's three rotating challenges. */
export interface DailyChallenge {
  id: string;
  label: string;
  xp: number;
  link?: string | null;
  action?: string;
  [key: string]: unknown;
}

/** One of the day's prediction questions. */
export interface PredictionQuestion {
  id: string;
  text: string;
  options: string[];
  xp: number;
  threshold: number;
}

/** The profile fields the day's set is derived from. */
export interface DirectorsReportProfile {
  engagement?: { lastLogin?: unknown; loginStreak?: number } | null;
  challenges?: Record<string, Array<{ id: string; completed?: boolean }>> | null;
  predictions?: Record<
    string,
    { resolved?: boolean; picks?: Record<string, unknown>; corpsClass?: string | null }
  > | null;
  // Read by the challenge-availability predicates (check-lineup needs a
  // lineup-bearing corps; the show/concept checks read the corps map).
  corps?: Record<string, { corpsName?: string; [key: string]: unknown } | null> | null;
  // Read by join-league-pool's availability (dropped for a director with no
  // league).
  leagueIds?: string[] | null;
}

/** A scored result feeding the prediction catalog. */
export interface RecentResult {
  score?: number;
  placement?: number;
  eventName?: string;
}

export interface DirectorsReportState {
  /** ET game day string (rolls at 2 AM ET, with the score drop). */
  gameDay: string;
  loginDone: boolean;
  streak: number;
  /** Today's rotation, with make-prediction dropped when unavailable. */
  challenges: DailyChallenge[];
  challengesDone: number;
  questions: PredictionQuestion[];
  predictionsDone: number;
  /**
   * False when the director has fewer than two scored results, so the game
   * cannot pose a prediction question today. The make-prediction challenge is
   * dropped in that case — otherwise the row points at a panel that does not
   * exist and the day's set can never reach completion. The server excuses
   * the day the same way when counting the weekly arc.
   */
  predictionAvailable: boolean;
  doneCount: number;
  totalCount: number;
  allDone: boolean;
}

/** Firestore Timestamp | Date | null -> Date | null. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = (value as { toDate: () => Date }).toDate;
    if (typeof maybe === 'function') return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return null;
}

/**
 * Compute today's set for one corps class.
 *
 * The set is: the daily login (auto-claimed on app load, counted so the +25 XP
 * reads as done work), today's challenge rotation, and today's prediction
 * questions. Ladder claims are deliberately NOT part of the count — they are
 * a bonus that happens to be ready, not work the director owes today.
 */
export function computeDirectorsReport(options: {
  profile: DirectorsReportProfile | null;
  recentResults: RecentResult[];
  corpsClass: string | null;
  /** Podium show/concept facts, or null for a director with no Podium corps. */
  podium?: PodiumChallengeFacts | null;
  /** Today's league-pool entry fact, or null for a director with no league. */
  leaguePool?: LeaguePoolChallengeFacts | null;
  now?: Date;
}): DirectorsReportState {
  const { profile, recentResults, corpsClass, podium = null, leaguePool = null, now } = options;
  const gameDay = now ? getGameDay(now) : getGameDay();

  const lastLogin = toDate(profile?.engagement?.lastLogin);
  const loginDone = !!lastLogin && getGameDay(lastLogin) === gameDay;
  const streak = profile?.engagement?.loginStreak || 0;

  // Predictions are a once-per-day activity, not once-per-corps. The server
  // ties each day's prediction bucket to the FIRST class that answers
  // (`bucket.corpsClass`, submitPrediction) and won't let a second class open
  // its own set that day. So the day's prediction work belongs to whichever
  // class owns the bucket — read it before building the active class's set.
  const predictionBucket = profile?.predictions?.[gameDay] || {};
  const predictionBucketClass = predictionBucket.corpsClass ?? null;

  // The active class only owes prediction work when it owns today's bucket, or
  // when no one has started predictions yet. If another class already claimed
  // the day's predictions, this class has none of its own to make — surfacing
  // its (differently-counted) questions here would leave the daily set short of
  // its total and nag "finish today's report" for work the game won't let the
  // director do on this tab.
  const activeClassOwnsPredictions =
    predictionBucketClass === null || predictionBucketClass === corpsClass;

  const questions: PredictionQuestion[] = activeClassOwnsPredictions
    ? buildQuestions(recentResults || [], corpsClass)
    : [];
  const predictionAvailable = questions.length > 0;

  // Same filter the server applies to the required set: drop challenges this
  // director genuinely can't satisfy today (make-prediction with no questions,
  // check-lineup for a Podium-only director) so the count stays winnable.
  const context = { predictionAvailable, podium, leaguePool };
  const challenges: DailyChallenge[] = getAvailableChallengesForGameDay(gameDay, profile, context);

  const bucket = profile?.challenges?.[gameDay] || [];
  const completedIds = new Set(bucket.filter((c) => c.completed).map((c) => c.id));
  const challengesDone = challenges.filter((c) => completedIds.has(c.id)).length;

  const predictionsDone = predictionBucket.resolved
    ? questions.length
    : Math.min(Object.keys(predictionBucket.picks || {}).length, questions.length);

  const doneCount = (loginDone ? 1 : 0) + challengesDone + predictionsDone;
  const totalCount = 1 + challenges.length + questions.length;

  return {
    gameDay,
    loginDone,
    streak,
    challenges,
    challengesDone,
    questions,
    predictionsDone,
    predictionAvailable,
    doneCount,
    totalCount,
    allDone: totalCount > 0 && doneCount >= totalCount,
  };
}

export default computeDirectorsReport;
