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

import { getGameDay, getChallengesForGameDay } from './dailyChallenges';
import { buildQuestions } from './dailyPredictions';

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
  predictions?: Record<string, { resolved?: boolean; picks?: Record<string, unknown> }> | null;
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
  now?: Date;
}): DirectorsReportState {
  const { profile, recentResults, corpsClass, now } = options;
  const gameDay = now ? getGameDay(now) : getGameDay();

  const lastLogin = toDate(profile?.engagement?.lastLogin);
  const loginDone = !!lastLogin && getGameDay(lastLogin) === gameDay;
  const streak = profile?.engagement?.loginStreak || 0;

  const questions: PredictionQuestion[] = buildQuestions(recentResults || [], corpsClass);
  const predictionAvailable = questions.length > 0;

  const challenges: DailyChallenge[] = getChallengesForGameDay(gameDay).filter(
    (c: DailyChallenge) => c.id !== 'make-prediction' || predictionAvailable
  );

  const bucket = profile?.challenges?.[gameDay] || [];
  const completedIds = new Set(bucket.filter((c) => c.completed).map((c) => c.id));
  const challengesDone = challenges.filter((c) => completedIds.has(c.id)).length;

  const predictionBucket = profile?.predictions?.[gameDay] || {};
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
