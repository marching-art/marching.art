// src/utils/leagueCareer.ts
// What a director has actually done in this league, and what the league looks
// like across every season it has played.
//
// A league that has run for several seasons has two stories nothing told. The
// first is personal: your record here, season by season, and how you have
// fared against each of the people you keep drawing. The second is collective:
// the all-time table, who has the titles, who has simply been here longest.
//
// Both are derived from the matchup documents the Record Book already loads —
// the live `matchups/week-N` collection plus `matchupHistory/{seasonUid}_week-N`,
// which rollover moves there. No new documents, no backfill, and the same
// parsing and ordering rules as the Record Book (leagueRecords.ts), so the two
// can never disagree about what a week is or when it happened.

import { flattenResolved, type RecordWeekDoc } from './leagueRecords';

/** One season of one director's league career. */
export interface CareerSeason {
  /** Null for the season currently being played. */
  seasonUid: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** Titles won in this season — a director can field more than one class. */
  titles: number;
}

/** A director's record against one specific opponent. */
export interface HeadToHead {
  opponentUid: string;
  wins: number;
  losses: number;
  ties: number;
  meetings: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Most recent week they met, for ordering "who you keep drawing". */
  lastMetWeek: number;
  lastMetSeasonUid: string | null;
}

export interface LeagueCareer {
  uid: string;
  wins: number;
  losses: number;
  ties: number;
  /** Ties count as half, matching the standings comparator. */
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  byes: number;
  seasonsPlayed: number;
  titles: number;
  /** Oldest season first. */
  seasons: CareerSeason[];
  /** Most-played opponent first. */
  opponents: HeadToHead[];
  bestWeek: { score: number; week: number; seasonUid: string | null } | null;
}

/** One row of the all-time table. */
export interface AllTimeRow extends LeagueCareer {
  displayRank: number;
}

/** The champion entries a league stores, as much of them as this file reads. */
export interface CareerChampion {
  seasonId?: string;
  winnerId?: string;
}

const emptyCareer = (uid: string): LeagueCareer => ({
  uid,
  wins: 0,
  losses: 0,
  ties: 0,
  winPercentage: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  byes: 0,
  seasonsPlayed: 0,
  titles: 0,
  seasons: [],
  opponents: [],
  bestWeek: null,
});

/**
 * Ties as half a win — the same convention as the standings comparator
 * (functions/src/helpers/leagueStandings.js winPercentage), so a director's
 * career percentage and their live one mean the same thing.
 */
function winPercentage(wins: number, losses: number, ties: number): number {
  const played = wins + losses + ties;
  return played === 0 ? 0 : (wins + ties / 2) / played;
}

/** Season key that keeps the live season distinct from every archived one. */
const seasonKey = (seasonUid: string | null) => seasonUid ?? '￿';

/**
 * Everyone's career in this league, keyed by uid.
 *
 * @param weekDocs Live and archived matchup weeks, in any order.
 * @param corpsClasses Classes to scan, registry-derived by the caller.
 * @param champions The league's `champions[]`, for the title counts.
 */
export function computeLeagueCareers(
  weekDocs: RecordWeekDoc[],
  corpsClasses: string[],
  champions: CareerChampion[] = []
): Map<string, LeagueCareer> {
  // Byes included: the standings table beside this counts a bye as a win, and
  // two tables disagreeing about someone's record is worse than either rule.
  const flat = flattenResolved(weekDocs, corpsClasses, { includeByes: true });
  const careers = new Map<string, LeagueCareer>();
  const seasonsByUid = new Map<string, Map<string, CareerSeason>>();
  const h2hByUid = new Map<string, Map<string, HeadToHead>>();

  const careerFor = (uid: string) => {
    if (!careers.has(uid)) careers.set(uid, emptyCareer(uid));
    return careers.get(uid)!;
  };

  const seasonFor = (uid: string, seasonUid: string | null) => {
    if (!seasonsByUid.has(uid)) seasonsByUid.set(uid, new Map());
    const bySeason = seasonsByUid.get(uid)!;
    const key = seasonKey(seasonUid);
    if (!bySeason.has(key)) {
      bySeason.set(key, { seasonUid, wins: 0, losses: 0, ties: 0, pointsFor: 0, titles: 0 });
    }
    return bySeason.get(key)!;
  };

  const h2hFor = (uid: string, opponentUid: string) => {
    if (!h2hByUid.has(uid)) h2hByUid.set(uid, new Map());
    const byOpponent = h2hByUid.get(uid)!;
    if (!byOpponent.has(opponentUid)) {
      byOpponent.set(opponentUid, {
        opponentUid,
        wins: 0,
        losses: 0,
        ties: 0,
        meetings: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        lastMetWeek: 0,
        lastMetSeasonUid: null,
      });
    }
    return byOpponent.get(opponentUid)!;
  };

  for (const { week, seasonUid, matchup } of flat) {
    const [p1, p2] = matchup.pair as [string, string | null];

    if (!p2 || matchup.isBye) {
      const career = careerFor(p1);
      career.byes += 1;
      career.wins += 1;
      seasonFor(p1, seasonUid).wins += 1;
      continue;
    }

    for (const [uid, opponentUid] of [
      [p1, p2],
      [p2, p1],
    ] as Array<[string, string]>) {
      const career = careerFor(uid);
      const season = seasonFor(uid, seasonUid);
      const h2h = h2hFor(uid, opponentUid);

      const scored = matchup.scores?.[uid] ?? 0;
      const conceded = matchup.scores?.[opponentUid] ?? 0;

      career.pointsFor += scored;
      career.pointsAgainst += conceded;
      season.pointsFor += scored;
      h2h.pointsFor += scored;
      h2h.pointsAgainst += conceded;
      h2h.meetings += 1;

      // Later weeks overwrite: `flattenResolved` returns them in the order they
      // were played, across the rollover.
      h2h.lastMetWeek = week;
      h2h.lastMetSeasonUid = seasonUid;

      if (matchup.winner === uid) {
        career.wins += 1;
        season.wins += 1;
        h2h.wins += 1;
      } else if (matchup.winner === 'tie' || !matchup.winner) {
        career.ties += 1;
        season.ties += 1;
        h2h.ties += 1;
      } else {
        career.losses += 1;
        season.losses += 1;
        h2h.losses += 1;
      }

      if (scored > 0 && (!career.bestWeek || scored > career.bestWeek.score)) {
        career.bestWeek = { score: scored, week, seasonUid };
      }
    }
  }

  // Titles, from the league's own record of who won what.
  for (const champion of champions) {
    if (!champion?.winnerId) continue;
    const career = careerFor(champion.winnerId);
    career.titles += 1;
    // Only attributable to a season the director actually has rows for; a
    // champions[] entry for a season with no surviving matchup documents still
    // counts toward the career total above.
    const bySeason = seasonsByUid.get(champion.winnerId);
    const season = bySeason?.get(seasonKey(champion.seasonId ?? null));
    if (season) season.titles += 1;
  }

  for (const [uid, career] of careers) {
    const seasons = [...(seasonsByUid.get(uid)?.values() ?? [])].sort((a, b) =>
      seasonKey(a.seasonUid) < seasonKey(b.seasonUid) ? -1 : 1
    );
    career.seasons = seasons;
    career.seasonsPlayed = seasons.length;
    career.winPercentage = winPercentage(career.wins, career.losses, career.ties);
    career.opponents = [...(h2hByUid.get(uid)?.values() ?? [])].sort(
      (a, b) => b.meetings - a.meetings || b.lastMetWeek - a.lastMetWeek
    );
  }

  return careers;
}

/**
 * One director's career, or an empty one if they have never played a resolved
 * week here. An empty career is a real answer for a member who just joined.
 */
export function computeMemberCareer(
  weekDocs: RecordWeekDoc[],
  corpsClasses: string[],
  uid: string,
  champions: CareerChampion[] = []
): LeagueCareer {
  return computeLeagueCareers(weekDocs, corpsClasses, champions).get(uid) || emptyCareer(uid);
}

/**
 * The all-time table.
 *
 * Titles first, because that is what a league argues about, then win
 * percentage, then wins, then seasons played — so a director with one title
 * from one season does not outrank a two-time champion, and two directors with
 * no titles are separated by how they played rather than by how long they
 * stayed.
 *
 * Rows are limited to the roster when one is given, so a table shown beside the
 * member list does not name people who left. Pass no roster to see everyone who
 * ever played, which is what a Hall of Fame wants.
 */
export function computeAllTimeTable(
  weekDocs: RecordWeekDoc[],
  corpsClasses: string[],
  champions: CareerChampion[] = [],
  members?: string[] | null
): AllTimeRow[] {
  const careers = computeLeagueCareers(weekDocs, corpsClasses, champions);
  const roster = members ? new Set(members) : null;

  return [...careers.values()]
    .filter((career) => !roster || roster.has(career.uid))
    .sort(
      (a, b) =>
        b.titles - a.titles ||
        b.winPercentage - a.winPercentage ||
        b.wins - a.wins ||
        b.seasonsPlayed - a.seasonsPlayed ||
        a.uid.localeCompare(b.uid)
    )
    .map((career, index) => ({ ...career, displayRank: index + 1 }));
}

/** `12-4-1`, or `12-4` when there are no ties to report. */
export function formatRecord(record: { wins: number; losses: number; ties: number }): string {
  return record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}
