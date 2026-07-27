// src/utils/leagueRecords.ts
// A league's all-time records, derived from its matchup documents.
//
// A league that has run for a while has a history worth arguing about — the
// biggest blowout, the closest call, the longest streak — and all of it was
// already sitting in `matchups/week-N`, unread. The Hall of Champions covers
// who won each season; this covers everything that happened along the way.
//
// Pure and derived: no new documents, no backfill, nothing to keep in sync. It
// re-reads what the weekly resolution already wrote.

import { CAPTION_CATEGORIES, isSweep, type CaptionsBlock } from './captionWars';

/** One resolved matchup, as the backend writes it. */
export interface RecordMatchup {
  pair?: [string, string | null];
  winner?: string | null;
  completed?: boolean;
  isBye?: boolean;
  scores?: Record<string, number>;
  normalized?: Record<string, number>;
  /** Present only on leagues running Caption Wars. */
  captions?: CaptionsBlock;
}

export interface RecordWeekDoc {
  id: string;
  [key: string]: unknown;
}

export interface ScoreRecord {
  uid: string;
  score: number;
  week: number;
  corpsClass: string;
  /** Null when the record was set in the season currently being played. */
  seasonUid?: string | null;
}

export interface MarginRecord {
  winnerUid: string;
  loserUid: string;
  margin: number;
  winnerScore: number;
  loserScore: number;
  week: number;
  corpsClass: string;
  seasonUid?: string | null;
}

export interface StreakRecord {
  uid: string;
  length: number;
  type: 'W' | 'L';
  endedWeek: number;
  seasonUid?: string | null;
}

export interface SweepRecord {
  uid: string;
  count: number;
}

export interface CaptionStreakRecord {
  uid: string;
  /** Which category they kept taking. */
  caption: string;
  label: string;
  length: number;
  endedWeek: number;
  seasonUid?: string | null;
}

export interface LeagueRecords {
  /** Weeks that contributed at least one resolved matchup, across all seasons. */
  weeksCounted: number;
  /** How many distinct seasons the book covers, including the live one. */
  seasonsCounted: number;
  highestWeek: ScoreRecord | null;
  biggestBlowout: MarginRecord | null;
  closestCall: MarginRecord | null;
  longestWinStreak: StreakRecord | null;
  /** Best single week measured against the director's own class field. */
  bestClassFinish: (ScoreRecord & { percentile: number }) | null;
  /** Caption Wars only: most career 3-0 sweeps. */
  mostSweeps: SweepRecord | null;
  /** Caption Wars only: longest run of weeks holding one category. */
  longestCaptionStreak: CaptionStreakRecord | null;
}

const EMPTY: LeagueRecords = {
  weeksCounted: 0,
  seasonsCounted: 0,
  highestWeek: null,
  biggestBlowout: null,
  closestCall: null,
  longestWinStreak: null,
  bestClassFinish: null,
  mostSweeps: null,
  longestCaptionStreak: null,
};

export interface FlatResult {
  week: number;
  corpsClass: string;
  seasonUid: string | null;
  matchup: RecordMatchup;
}

/**
 * Week number and season from a matchup document id.
 *
 * Live weeks are `week-N`. Weeks from finished seasons are
 * `{seasonUid}_week-N` — rollover MOVES them there so the live collection only
 * ever holds the current season (leaving them in place made the generator skip
 * every week of the next season). Both are real history; only the live form
 * counts as current work.
 */
export function parseWeekId(id: string): { week: number; seasonUid: string | null } | null {
  const live = String(id).match(/^week-(\d+)$/);
  if (live) return { week: parseInt(live[1], 10), seasonUid: null };

  const archived = String(id).match(/^(.+)_week-(\d+)$/);
  if (archived) return { week: parseInt(archived[2], 10), seasonUid: archived[1] };

  return null;
}

/**
 * Every resolved head-to-head, oldest first. Byes carry no result.
 *
 * Ordered by season then week: a streak that ran across a rollover has to be
 * walked in the order it was played, and season uids sort chronologically. The
 * live season (no stamp) sorts last, because it is the one still happening.
 */
export function flattenResolved(
  weekDocs: RecordWeekDoc[],
  corpsClasses: string[],
  { includeByes = false }: { includeByes?: boolean } = {}
): FlatResult[] {
  const flat: FlatResult[] = [];

  for (const doc of weekDocs) {
    const parsed = parseWeekId(doc.id);
    if (!parsed) continue;

    for (const corpsClass of corpsClasses) {
      const matchups = (doc[`${corpsClass}Matchups`] || []) as RecordMatchup[];
      for (const matchup of matchups) {
        if (!matchup?.completed) continue;
        // A bye is not a performance, so the record book excludes it — letting
        // a free win set a streak is the unfairness the bye rotation exists to
        // avoid. A CAREER record counts it, because the standings table beside
        // it counts it as a win, and two tables disagreeing about a director's
        // record is worse than either convention.
        const isBye = matchup.isBye || !matchup.pair?.[1];
        if (isBye && !includeByes) continue;
        if (!matchup.pair?.[0]) continue;
        flat.push({ ...parsed, corpsClass, matchup });
      }
    }
  }

  return flat.sort((a, b) => {
    const seasonA = a.seasonUid ?? '\uffff';
    const seasonB = b.seasonUid ?? '\uffff';
    if (seasonA !== seasonB) return seasonA < seasonB ? -1 : 1;
    return a.week - b.week;
  });
}

/**
 * Longest run of consecutive wins by any director.
 *
 * Walks weeks in order per director. A bye is not counted either way: it is not
 * a performance, and letting a free win extend a streak is the same unfairness
 * the bye rotation exists to avoid.
 */
function findLongestWinStreak(flat: FlatResult[]): StreakRecord | null {
  const running = new Map<string, { length: number; type: 'W' | 'L' }>();
  let best: StreakRecord | null = null;

  for (const { week, seasonUid, matchup } of flat) {
    const [p1, p2] = matchup.pair as [string, string];
    for (const uid of [p1, p2]) {
      const won = matchup.winner === uid;
      const drew = matchup.winner === 'tie';
      const type: 'W' | 'L' | null = drew ? null : won ? 'W' : 'L';

      if (type === null) {
        running.delete(uid);
        continue;
      }

      const current = running.get(uid);
      const length = current && current.type === type ? current.length + 1 : 1;
      running.set(uid, { length, type });

      if (type === 'W' && (!best || length > best.length)) {
        best = { uid, length, type: 'W', endedWeek: week, seasonUid };
      }
    }
  }

  return best && best.length > 1 ? best : null;
}

/**
 * Career 3-0 sweeps, on a league running Caption Wars.
 *
 * A sweep is every contested category to one director — the format's version of
 * a statement win, and the thing a director actually brags about.
 */
function findMostSweeps(flat: FlatResult[]): SweepRecord | null {
  const counts = new Map<string, number>();

  for (const { matchup } of flat) {
    if (!matchup.captions) continue;
    const [p1, p2] = matchup.pair as [string, string];
    for (const uid of [p1, p2]) {
      if (isSweep(matchup.captions, uid)) counts.set(uid, (counts.get(uid) || 0) + 1);
    }
  }

  let best: SweepRecord | null = null;
  for (const [uid, count] of counts) {
    if (!best || count > best.count) best = { uid, count };
  }
  return best;
}

/**
 * Longest run of consecutive weeks in which one director took a given category.
 *
 * This is the "nobody beats them in Music" narrative the format exists to
 * create, and it is the one record a best-of-three can produce that a single
 * comparison of totals cannot.
 *
 * A week in which the category went undecided breaks the run rather than
 * extending it, for the same reason a tie breaks a win streak.
 */
function findLongestCaptionStreak(flat: FlatResult[]): CaptionStreakRecord | null {
  const running = new Map<string, number>();
  let best: CaptionStreakRecord | null = null;

  for (const { week, seasonUid, matchup } of flat) {
    if (!matchup.captions) continue;
    const [p1, p2] = matchup.pair as [string, string];

    for (const { key, label } of CAPTION_CATEGORIES) {
      const winner = matchup.captions[key]?.winner;
      for (const uid of [p1, p2]) {
        const runKey = `${uid}:${key}`;
        if (winner !== uid) {
          running.delete(runKey);
          continue;
        }
        const length = (running.get(runKey) || 0) + 1;
        running.set(runKey, length);
        if (!best || length > best.length) {
          best = { uid, caption: key, label, length, endedWeek: week, seasonUid };
        }
      }
    }
  }

  return best && best.length > 1 ? best : null;
}

/**
 * Derive a league's record book.
 *
 * @param weekDocs Raw `week-N` matchup documents.
 * @param corpsClasses Classes to scan, registry-derived by the caller.
 */
export function computeLeagueRecords(
  weekDocs: RecordWeekDoc[],
  corpsClasses: string[]
): LeagueRecords {
  const flat = flattenResolved(weekDocs, corpsClasses);
  if (flat.length === 0) return EMPTY;

  const weeks = new Set<string>();
  const seasons = new Set<string>();
  let highestWeek: ScoreRecord | null = null;
  let biggestBlowout: MarginRecord | null = null;
  let closestCall: MarginRecord | null = null;
  let bestClassFinish: (ScoreRecord & { percentile: number }) | null = null;

  for (const { week, corpsClass, seasonUid, matchup } of flat) {
    // Keyed by season too — week 3 of two different seasons is two weeks.
    weeks.add(`${seasonUid ?? 'live'}:${week}`);
    seasons.add(seasonUid ?? 'live');
    const [p1, p2] = matchup.pair as [string, string];
    const s1 = matchup.scores?.[p1] ?? 0;
    const s2 = matchup.scores?.[p2] ?? 0;

    for (const [uid, score] of [
      [p1, s1],
      [p2, s2],
    ] as Array<[string, number]>) {
      if (score > 0 && (!highestWeek || score > highestWeek.score)) {
        highestWeek = { uid, score, week, corpsClass, seasonUid };
      }
      const percentile = matchup.normalized?.[uid];
      if (
        typeof percentile === 'number' &&
        (!bestClassFinish || percentile > bestClassFinish.percentile)
      ) {
        bestClassFinish = { uid, score, week, corpsClass, percentile, seasonUid };
      }
    }

    // A decided matchup only — a tie has no winner to name, and a matchup
    // where nobody competed is a 0-0 that would masquerade as the closest
    // call ever played.
    if (matchup.winner === 'tie' || (s1 === 0 && s2 === 0)) continue;

    // The STORED winner, not the higher score. Under Caption Wars those can
    // differ: a director who banked their whole week in one caption can post
    // the bigger number and still lose it.
    const winnerUid = matchup.winner === p2 ? p2 : p1;
    const loserUid = winnerUid === p1 ? p2 : p1;
    const winnerScore = matchup.scores?.[winnerUid] ?? 0;
    const loserScore = matchup.scores?.[loserUid] ?? 0;
    const margin = winnerScore - loserScore;
    // An upset on captions has a negative points margin, and neither "won by
    // the most" nor "won by the least" is a true sentence about it. It is a
    // real result and it is still counted as a week; it just is not a
    // points-margin record.
    if (margin < 0) continue;
    const entry: MarginRecord = {
      winnerUid,
      loserUid,
      margin,
      winnerScore,
      loserScore,
      week,
      corpsClass,
      seasonUid,
    };

    if (!biggestBlowout || margin > biggestBlowout.margin) biggestBlowout = entry;
    // A forfeit (opponent scored nothing) is not a close game, and it is not
    // an interesting blowout either — but it IS a real result, so it stays
    // eligible for the blowout and only the closest-call check excludes it.
    if (loserScore > 0 && (!closestCall || margin < closestCall.margin)) closestCall = entry;
  }

  return {
    weeksCounted: weeks.size,
    seasonsCounted: seasons.size,
    highestWeek,
    biggestBlowout,
    closestCall,
    longestWinStreak: findLongestWinStreak(flat),
    bestClassFinish,
    mostSweeps: findMostSweeps(flat),
    longestCaptionStreak: findLongestCaptionStreak(flat),
  };
}
