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

/** One resolved matchup, as the backend writes it. */
export interface RecordMatchup {
  pair?: [string, string | null];
  winner?: string | null;
  completed?: boolean;
  isBye?: boolean;
  scores?: Record<string, number>;
  normalized?: Record<string, number>;
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
}

export interface MarginRecord {
  winnerUid: string;
  loserUid: string;
  margin: number;
  winnerScore: number;
  loserScore: number;
  week: number;
  corpsClass: string;
}

export interface StreakRecord {
  uid: string;
  length: number;
  type: 'W' | 'L';
  endedWeek: number;
}

export interface LeagueRecords {
  /** Weeks that contributed at least one resolved matchup. */
  weeksCounted: number;
  highestWeek: ScoreRecord | null;
  biggestBlowout: MarginRecord | null;
  closestCall: MarginRecord | null;
  longestWinStreak: StreakRecord | null;
  /** Best single week measured against the director's own class field. */
  bestClassFinish: (ScoreRecord & { percentile: number }) | null;
}

const EMPTY: LeagueRecords = {
  weeksCounted: 0,
  highestWeek: null,
  biggestBlowout: null,
  closestCall: null,
  longestWinStreak: null,
  bestClassFinish: null,
};

interface FlatResult {
  week: number;
  corpsClass: string;
  matchup: RecordMatchup;
}

/** Every resolved head-to-head, in week order. Byes carry no result. */
function flattenResolved(weekDocs: RecordWeekDoc[], corpsClasses: string[]): FlatResult[] {
  const flat: FlatResult[] = [];

  for (const doc of weekDocs) {
    const weekMatch = String(doc.id).match(/^week-(\d+)$/);
    if (!weekMatch) continue;
    const week = parseInt(weekMatch[1], 10);

    for (const corpsClass of corpsClasses) {
      const matchups = (doc[`${corpsClass}Matchups`] || []) as RecordMatchup[];
      for (const matchup of matchups) {
        if (!matchup?.completed || matchup.isBye || !matchup.pair?.[1]) continue;
        flat.push({ week, corpsClass, matchup });
      }
    }
  }

  return flat.sort((a, b) => a.week - b.week);
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

  for (const { week, matchup } of flat) {
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
        best = { uid, length, type: 'W', endedWeek: week };
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

  const weeks = new Set<number>();
  let highestWeek: ScoreRecord | null = null;
  let biggestBlowout: MarginRecord | null = null;
  let closestCall: MarginRecord | null = null;
  let bestClassFinish: (ScoreRecord & { percentile: number }) | null = null;

  for (const { week, corpsClass, matchup } of flat) {
    weeks.add(week);
    const [p1, p2] = matchup.pair as [string, string];
    const s1 = matchup.scores?.[p1] ?? 0;
    const s2 = matchup.scores?.[p2] ?? 0;

    for (const [uid, score] of [
      [p1, s1],
      [p2, s2],
    ] as Array<[string, number]>) {
      if (score > 0 && (!highestWeek || score > highestWeek.score)) {
        highestWeek = { uid, score, week, corpsClass };
      }
      const percentile = matchup.normalized?.[uid];
      if (
        typeof percentile === 'number' &&
        (!bestClassFinish || percentile > bestClassFinish.percentile)
      ) {
        bestClassFinish = { uid, score, week, corpsClass, percentile };
      }
    }

    // A decided matchup only — a tie has no winner to name, and a matchup
    // where nobody competed is a 0-0 that would masquerade as the closest
    // call ever played.
    if (matchup.winner === 'tie' || (s1 === 0 && s2 === 0)) continue;

    const winnerUid = s1 > s2 ? p1 : p2;
    const loserUid = winnerUid === p1 ? p2 : p1;
    const winnerScore = Math.max(s1, s2);
    const loserScore = Math.min(s1, s2);
    const margin = winnerScore - loserScore;
    const entry: MarginRecord = {
      winnerUid,
      loserUid,
      margin,
      winnerScore,
      loserScore,
      week,
      corpsClass,
    };

    if (!biggestBlowout || margin > biggestBlowout.margin) biggestBlowout = entry;
    // A forfeit (opponent scored nothing) is not a close game, and it is not
    // an interesting blowout either — but it IS a real result, so it stays
    // eligible for the blowout and only the closest-call check excludes it.
    if (loserScore > 0 && (!closestCall || margin < closestCall.margin)) closestCall = entry;
  }

  return {
    weeksCounted: weeks.size,
    highestWeek,
    biggestBlowout,
    closestCall,
    longestWinStreak: findLongestWinStreak(flat),
    bestClassFinish,
  };
}
