// src/utils/leagueStats.ts
// Pure league-table math for the league detail view.
//
// These functions used to live inline inside LeagueDetailView's data effect,
// which meant every fetch (and every retry) walked the entire season recap
// archive on the main thread while React was mid-commit. Pulled out here they
// are ordinary pure functions: memoizable by the component, and testable
// without a Firestore mock.
//
// The semantics are deliberately preserved exactly as the component had them,
// including the quirks called out in the comments below.

/** A day recap, narrowed to the fields the league table actually reads. */
export interface LeagueRecapDay {
  offSeasonDay: number;
  shows?: Array<{
    results?: Array<{
      uid: string;
      totalScore?: number;
      corpsClass?: string;
    }>;
  }>;
}

/** One head-to-head pairing within a week. */
export interface LeagueMatchup {
  user1: string;
  user2: string;
  winner?: string | null;
  completed?: boolean;
  scores?: Record<string, number>;
  corpsClass?: string;
}

/** A raw `leagues/{id}/matchups/week-N` document as read from Firestore. */
export interface LeagueMatchupDoc {
  id: string;
  [key: string]: unknown;
}

/** Total fantasy score per member, per week. */
export type WeeklyResults = Record<number, Record<string, number>>;

/**
 * Per-class score per member, per week.
 *
 * Matchups are segregated by corps class, so comparing them on a member's
 * COMBINED weekly total is wrong: a director fielding World Class and
 * SoundSport had their sum judged in whichever of their two matchups happened
 * to flatten first, and their second matchup was invisible to the table.
 */
export type WeeklyClassResults = Record<number, Record<string, Record<string, number>>>;

/** Matchups grouped by week number. */
export type MatchupsByWeek = Record<number, LeagueMatchup[]>;

/** A member's row in the computed league standings. */
export interface LeagueMemberStanding {
  uid: string;
  wins: number;
  losses: number;
  totalPoints: number;
  weeklyScores: Record<string, number>;
  streak: number;
  streakType: 'W' | 'L' | null;
  trend: 'up' | 'down' | 'same';
  currentRank?: number;
}

/** Everything the league detail view derives from recaps + matchup docs. */
export interface LeagueTables {
  weeklyResults: WeeklyResults;
  weeklyMatchups: MatchupsByWeek;
  standings: LeagueMemberStanding[];
}

/**
 * Matchup docs store one array per corps class. Order matters: it fixes the
 * order pairings land in the flattened per-week array, which is what
 * `.find()`-based opponent lookups below resolve against.
 */
export const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'] as const;

/**
 * Fallback round-robin generation, used only when a league has no matchup
 * documents at all (leagues created before the backend generated them).
 *
 * Note the rotation is the original's: with fewer than two members
 * `Math.floor(n / 2)` is 0, the modulo yields NaN, and every week comes back
 * empty. That is the historical behaviour and the tests pin it.
 */
export function generateRoundRobinMatchups(members: string[], maxWeek: number): MatchupsByWeek {
  const matchups: MatchupsByWeek = {};
  const n = members.length;

  for (let week = 1; week <= maxWeek; week++) {
    matchups[week] = [];
    const offset = (week - 1) % Math.floor(n / 2);
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const idx1 = (i + offset) % n;
      const idx2 = (n - 1 - i + offset) % n;
      if (idx1 !== idx2 && members[idx1] && members[idx2]) {
        matchups[week].push({ user1: members[idx1], user2: members[idx2] });
      }
    }
  }
  return matchups;
}

/**
 * Sum each member's show scores into per-week totals.
 *
 * A week is `ceil(offSeasonDay / 7)`, matching the scorer. Non-members are
 * dropped; a member who competed in several shows in a week has them added
 * together.
 */
export function buildWeeklyResults(recaps: LeagueRecapDay[], memberIds: string[]): WeeklyResults {
  const memberUids = new Set(memberIds);
  const weeklyResults: WeeklyResults = {};

  recaps.forEach((dayRecap) => {
    const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
    if (!weeklyResults[weekNum]) weeklyResults[weekNum] = {};

    dayRecap.shows?.forEach((show) => {
      show.results?.forEach((result) => {
        if (memberUids.has(result.uid)) {
          if (!weeklyResults[weekNum][result.uid]) {
            weeklyResults[weekNum][result.uid] = 0;
          }
          weeklyResults[weekNum][result.uid] += result.totalScore || 0;
        }
      });
    });
  });

  return weeklyResults;
}

/**
 * The same fold, kept per corps class, so a class-scoped matchup can be scored
 * against the class it was actually contested in. Results with no corpsClass
 * (legacy recaps) land under UNKNOWN_CLASS and are still reachable.
 */
export const UNKNOWN_CLASS = 'unknown';

export function buildWeeklyClassResults(
  recaps: LeagueRecapDay[],
  memberIds: string[]
): WeeklyClassResults {
  const memberUids = new Set(memberIds);
  const byWeek: WeeklyClassResults = {};

  recaps.forEach((dayRecap) => {
    const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
    if (!byWeek[weekNum]) byWeek[weekNum] = {};

    dayRecap.shows?.forEach((show) => {
      show.results?.forEach((result) => {
        if (!memberUids.has(result.uid)) return;
        const corpsClass = result.corpsClass || UNKNOWN_CLASS;
        if (!byWeek[weekNum][result.uid]) byWeek[weekNum][result.uid] = {};
        byWeek[weekNum][result.uid][corpsClass] =
          (byWeek[weekNum][result.uid][corpsClass] || 0) + (result.totalScore || 0);
      });
    });
  });

  return byWeek;
}

/**
 * A member's score for one matchup: the class it was contested in when that is
 * known on both sides, otherwise their whole week. Falling back to the total
 * keeps legacy recaps (which carry no corpsClass) behaving as they always did.
 */
function scoreForMatchup(
  matchup: LeagueMatchup,
  weeklyResults: WeeklyResults,
  classResults: WeeklyClassResults | undefined,
  weekNum: number,
  uid: string
): number {
  const corpsClass = matchup.corpsClass;
  const perClass = corpsClass ? classResults?.[weekNum]?.[uid] : undefined;
  if (perClass) {
    const classScore = perClass[corpsClass as string];
    if (classScore !== undefined) return classScore;
    // No result in this class, but classified results exist for this member —
    // they competed elsewhere and sat this class out, which is a 0, not their
    // combined total. Recaps with no corpsClass at all (legacy days) carry only
    // UNKNOWN_CLASS and fall through to the weekly total instead.
    const hasClassifiedResults = Object.keys(perClass).some((key) => key !== UNKNOWN_CLASS);
    if (hasClassifiedResults) return 0;
  }
  return weeklyResults[weekNum]?.[uid] || 0;
}

/**
 * Flatten the per-class matchup documents into a week -> pairings map, falling
 * back to client-side round-robin generation when the league has no matchup
 * documents (backwards compatibility for pre-generation leagues).
 *
 * Documents whose id is not `week-{n}` are ignored.
 */
export function buildMatchupsByWeek(
  matchupDocs: LeagueMatchupDoc[],
  members: string[],
  maxWeek: number
): MatchupsByWeek {
  const matchupsPerWeek: MatchupsByWeek = {};

  matchupDocs.forEach((matchupData) => {
    const weekMatch = matchupData.id.match(/^week-(\d+)$/);
    if (!weekMatch) return;

    const weekNum = parseInt(weekMatch[1]);
    matchupsPerWeek[weekNum] = [];

    for (const corpsClass of CORPS_CLASSES) {
      const classMatchups = (matchupData[`${corpsClass}Matchups`] || []) as Array<{
        pair?: [string, string];
        winner?: string | null;
        completed?: boolean;
        scores?: Record<string, number>;
      }>;
      classMatchups.forEach((matchup) => {
        if (matchup.pair && matchup.pair[0] && matchup.pair[1]) {
          matchupsPerWeek[weekNum].push({
            user1: matchup.pair[0],
            user2: matchup.pair[1],
            winner: matchup.winner,
            completed: matchup.completed,
            scores: matchup.scores,
            corpsClass,
          });
        }
      });
    }
  });

  if (Object.keys(matchupsPerWeek).length === 0) {
    Object.assign(matchupsPerWeek, generateRoundRobinMatchups(members, maxWeek));
  }

  return matchupsPerWeek;
}

/**
 * Every pairing a member appears in for a week.
 *
 * This used to be a `.find()` returning the FIRST one, so a director fielding
 * two classes had their second matchup silently excluded from streaks and
 * trend — it existed in the table but not in any of the numbers derived from it.
 */
function findMatchupsForUser(
  matchupsByWeek: MatchupsByWeek,
  weekNum: number,
  uid: string
): LeagueMatchup[] {
  const matchups = matchupsByWeek[weekNum] || [];
  return matchups.filter((m) => m.user1 === uid || m.user2 === uid);
}

/** A member's score and their opponent's, for one matchup. */
function headToHeadScores(
  matchup: LeagueMatchup,
  weeklyResults: WeeklyResults,
  weekNum: number,
  uid: string,
  classResults?: WeeklyClassResults
): { myScore: number; oppScore: number } {
  const oppUid = matchup.user1 === uid ? matchup.user2 : matchup.user1;
  return {
    myScore: scoreForMatchup(matchup, weeklyResults, classResults, weekNum, uid),
    oppScore: scoreForMatchup(matchup, weeklyResults, classResults, weekNum, oppUid),
  };
}

/**
 * Build the ranked standings table from weekly scores and pairings.
 *
 * Ordering is wins first, total points as the tiebreak. `currentRank` is the
 * 1-based position in that order, and `trend` reflects the member's record
 * over their three most recent scored weeks.
 *
 * Two behaviours worth keeping in mind, both inherited and both pinned by
 * tests: a tie counts as neither a win nor a loss for the W/L columns, but the
 * streak walk treats "did not win" as a loss, so a drawn week extends an L
 * streak.
 */
export function computeMemberStandings(
  members: string[],
  weeklyResults: WeeklyResults,
  matchupsByWeek: MatchupsByWeek,
  classResults?: WeeklyClassResults
): LeagueMemberStanding[] {
  const memberStats: Record<string, LeagueMemberStanding> = {};

  members.forEach((uid) => {
    memberStats[uid] = {
      uid,
      wins: 0,
      losses: 0,
      totalPoints: 0,
      weeklyScores: {},
      streak: 0,
      streakType: null,
      trend: 'same',
    };
  });

  Object.entries(weeklyResults).forEach(([weekNum, scores]) => {
    const weekMatchups = matchupsByWeek[parseInt(weekNum)] || [];

    weekMatchups.forEach((matchup) => {
      // Scored in the class the matchup was contested in, not on the member's
      // combined weekly total across every class they field.
      const score1 = scoreForMatchup(
        matchup,
        weeklyResults,
        classResults,
        parseInt(weekNum),
        matchup.user1
      );
      const score2 = scoreForMatchup(
        matchup,
        weeklyResults,
        classResults,
        parseInt(weekNum),
        matchup.user2
      );

      if (memberStats[matchup.user1]) {
        memberStats[matchup.user1].weeklyScores[weekNum] = scores[matchup.user1] || score1;
      }
      if (memberStats[matchup.user2]) {
        memberStats[matchup.user2].weeklyScores[weekNum] = scores[matchup.user2] || score2;
      }

      if (score1 > score2) {
        if (memberStats[matchup.user1]) memberStats[matchup.user1].wins++;
        if (memberStats[matchup.user2]) memberStats[matchup.user2].losses++;
      } else if (score2 > score1) {
        if (memberStats[matchup.user2]) memberStats[matchup.user2].wins++;
        if (memberStats[matchup.user1]) memberStats[matchup.user1].losses++;
      }
    });

    Object.entries(scores).forEach(([uid, score]) => {
      if (memberStats[uid]) {
        memberStats[uid].totalPoints += score;
      }
    });
  });

  // Streaks: walk backwards from the most recent scored week until the result
  // flips. Weeks the member has no pairing in are skipped, not break points.
  Object.values(memberStats).forEach((stats) => {
    let streak = 0;
    let streakType: 'W' | 'L' | null = null;
    const weeks = Object.keys(stats.weeklyScores).sort((a, b) => parseInt(b) - parseInt(a));

    let broken = false;
    for (const weekNum of weeks) {
      if (broken) break;
      const weekMatchups = findMatchupsForUser(matchupsByWeek, parseInt(weekNum), stats.uid);
      for (const matchup of weekMatchups) {
        const { myScore, oppScore } = headToHeadScores(
          matchup,
          weeklyResults,
          parseInt(weekNum),
          stats.uid,
          classResults
        );
        const currentType: 'W' | 'L' = myScore > oppScore ? 'W' : 'L';

        if (streakType === null) {
          streakType = currentType;
          streak = 1;
        } else if (streakType === currentType) {
          streak++;
        } else {
          broken = true;
          break;
        }
      }
    }

    stats.streak = streak;
    stats.streakType = streakType;
  });

  const sortedStandings = Object.values(memberStats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.totalPoints - a.totalPoints;
  });

  sortedStandings.forEach((stats, idx) => {
    stats.currentRank = idx + 1;

    const recentWeeks = Object.keys(stats.weeklyScores)
      .map(Number)
      .sort((a, b) => b - a)
      .slice(0, 3);

    let recentWins = 0;
    let recentLosses = 0;

    for (const weekNum of recentWeeks) {
      for (const matchup of findMatchupsForUser(matchupsByWeek, weekNum, stats.uid)) {
        const { myScore, oppScore } = headToHeadScores(
          matchup,
          weeklyResults,
          weekNum,
          stats.uid,
          classResults
        );
        if (myScore > oppScore) {
          recentWins++;
        } else if (oppScore > myScore) {
          recentLosses++;
        }
      }
    }

    if (recentWins > recentLosses) {
      stats.trend = 'up';
    } else if (recentLosses > recentWins) {
      stats.trend = 'down';
    } else {
      stats.trend = 'same';
    }
  });

  return sortedStandings;
}

/**
 * Derive everything the league detail view needs from a season's recaps and a
 * league's matchup documents.
 *
 * Returns `null` when there are no recaps — the view then keeps its empty
 * defaults and, notably, does NOT surface matchups either. That is the
 * original behaviour: a league whose season has not scored yet shows no
 * schedule, and the caller distinguishes "nothing computed" from "computed to
 * empty" by the null.
 */
export function computeLeagueTables(input: {
  recaps: LeagueRecapDay[];
  matchupDocs: LeagueMatchupDoc[];
  members: string[];
  currentWeek: number;
}): LeagueTables | null {
  const { recaps, matchupDocs, members, currentWeek } = input;
  if (!recaps.length) return null;

  const weeklyResults = buildWeeklyResults(recaps, members);
  const weeklyClassResults = buildWeeklyClassResults(recaps, members);
  const weeklyMatchups = buildMatchupsByWeek(matchupDocs, members, currentWeek);
  const standings = computeMemberStandings(
    members,
    weeklyResults,
    weeklyMatchups,
    weeklyClassResults
  );

  return { weeklyResults, weeklyMatchups, standings };
}
