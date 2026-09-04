// Pure recap folding for MatchupDetailView: turns the season's fantasy_recaps
// into the week's per-side totals, show lists, caption breakdowns, the battle
// scoreboard, and the head-to-head history. No React in here so the view
// stays under the file-length gate and this logic stays unit-testable.

import type { CaptionsBlock } from '../../utils/captionWars';
import type { CaptionGroupScores, ExtendedHeadToHead, MatchupBattleBreakdown } from '../../types';
import type { SideBreakdown } from './MatchupDetailParts';
import {
  calculateMatchupBattles,
  calculateHeadToHead,
  createWeeklyPerformance,
} from '../../utils/matchupScoring';

/**
 * The three caption groups a show result actually carries.
 *
 * The view used to manufacture all eight lineup captions by dividing each
 * group evenly — `GE1 = GE2 = geScore / 2` — and render them as judged numbers.
 * They were never real: both directors got the same even split, so GE1 and GE2
 * always had the identical winner, as did the three visual and the three music
 * captions. The eight are deliberately unrecorded per show, because publishing
 * them would let an opponent read a director's lineup straight off the recap
 * (docs/CAPTION_WARS_SPEC.md §7), so the fix is to show the three that exist.
 */
/** One scored day, as fantasy_recaps writes it. */
export interface DayRecap {
  offSeasonDay: number;
  shows?: Array<{
    showId?: string;
    eventName?: string;
    results?: Array<{
      uid: string;
      corpsClass?: string;
      totalScore?: number;
      geScore?: number;
      visualScore?: number;
      musicScore?: number;
      placement?: number;
    }>;
  }>;
}

type DayShow = NonNullable<DayRecap['shows']>[number];
type DayResult = NonNullable<DayShow['results']>[number];

/** One show as createWeeklyPerformance consumes it. */
export interface ShowEntry {
  showId: string;
  showName: string;
  score: number;
  placement?: number;
  captions?: CaptionGroupScores;
}

export interface DetailMatchup {
  user1: string;
  user2: string;
  week?: number;
  status?: string;
  corpsClass?: string;
  captions?: CaptionsBlock;
  /** Cross-class matchup: each side plays in its own class and the week is
   *  decided on class percentile, not raw totals. Passed through from the
   *  stored matchup so this view can never contradict the settled result. */
  crossClass?: boolean;
  classes?: Record<string, string>;
  normalized?: Record<string, number>;
  /** Each side's per-show average across the week — the number the default
   *  format decided on (functions/src/helpers/leagueScoring.js). */
  averages?: Record<string, number>;
  /** Each side's best single show, on a league running One-Night Slate. */
  best?: Record<string, { score?: number; showName?: string | null } | undefined>;
  winner?: string | null;
  completed?: boolean;
}

/** True when this recap result row belongs to `uid` for THIS matchup. On a
 *  cross-class matchup each side is scored in its own class, so a director
 *  fielding several classes must not have their other corps' shows summed in. */
export const resultCountsFor = (
  matchup: DetailMatchup,
  result: { uid?: string; corpsClass?: string },
  uid: string
) =>
  result.uid === uid &&
  (!matchup.classes?.[uid] || !result.corpsClass || result.corpsClass === matchup.classes[uid]);

/** 1 -> "1st", 42 -> "42nd", 100 -> "100th". */
export const ordinal = (n: number) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
};

const captionGroupScores = (result: {
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
}) => ({
  ge: result.geScore || 0,
  visual: result.visualScore || 0,
  music: result.musicScore || 0,
});

const emptyBreakdown = (): SideBreakdown => ({
  shows: [],
  geTotal: 0,
  visualTotal: 0,
  musicTotal: 0,
});

const toShowEntry = (show: DayShow, result: DayResult): ShowEntry => ({
  showId: show.showId || show.eventName || '',
  showName: show.eventName || '',
  score: result.totalScore || 0,
  placement: result.placement,
  captions: captionGroupScores(result),
});

/** The recap week a scored day belongs to (7 days per league week). */
const weekOf = (dayRecap: DayRecap) => Math.ceil(dayRecap.offSeasonDay / 7);

/** Visit every result row of every show scored in `week`. */
const eachResult = (
  recaps: DayRecap[],
  week: number,
  visit: (show: DayShow, result: DayResult) => void
) => {
  recaps.forEach((dayRecap) => {
    if (weekOf(dayRecap) !== week) return;
    dayRecap.shows?.forEach((show) => {
      show.results?.forEach((result) => visit(show, result));
    });
  });
};

/** Both sides' shows in `week`, plus each side's previous-week total (the
 *  momentum input createWeeklyPerformance reads). */
const collectWeek = (recaps: DayRecap[], matchup: DetailMatchup, week: number) => {
  const shows: Record<'user1' | 'user2', ShowEntry[]> = { user1: [], user2: [] };
  const prev = { user1: 0, user2: 0 };
  eachResult(recaps, week, (show, result) => {
    if (resultCountsFor(matchup, result, matchup.user1)) {
      shows.user1.push(toShowEntry(show, result));
    }
    if (resultCountsFor(matchup, result, matchup.user2)) {
      shows.user2.push(toShowEntry(show, result));
    }
  });
  eachResult(recaps, week - 1, (_show, result) => {
    if (resultCountsFor(matchup, result, matchup.user1)) prev.user1 += result.totalScore || 0;
    if (resultCountsFor(matchup, result, matchup.user2)) prev.user2 += result.totalScore || 0;
  });
  return { shows, prev };
};

const battlesFor = (
  matchup: DetailMatchup,
  leagueId: string | undefined,
  week: number,
  shows: Record<'user1' | 'user2', ShowEntry[]>,
  prev: { user1: number; user2: number }
): MatchupBattleBreakdown | null => {
  if (shows.user1.length === 0 && shows.user2.length === 0) return null;
  const perf1 = createWeeklyPerformance(
    matchup.user1,
    week,
    shows.user1,
    prev.user1 > 0 ? prev.user1 : undefined
  );
  const perf2 = createWeeklyPerformance(
    matchup.user2,
    week,
    shows.user2,
    prev.user2 > 0 ? prev.user2 : undefined
  );
  return calculateMatchupBattles(
    `${leagueId || 'league'}-w${week}`,
    week,
    matchup.user1,
    matchup.user2,
    perf1,
    perf2
  );
};

export interface FoldedMatchupRecaps {
  /** Each side's weekly total (the record book's number). */
  scores: { user1: number; user2: number };
  /** Shows attended this week per side; the week is decided on the per-show
   *  average (leagueScoring.js), so the header leads with it. */
  showCounts: { user1: number; user2: number };
  breakdown: { user1: SideBreakdown; user2: SideBreakdown };
  /** Battle points compare raw caption numbers, which mean nothing between
   *  different classes — a cross-class matchup gets no scoreboard. */
  battleBreakdown: MatchupBattleBreakdown | null;
  /** Head-to-head history across every earlier week both sides scored. */
  headToHead: ExtendedHeadToHead | null;
}

/**
 * Fold the season's recaps into everything the matchup detail view renders
 * for `matchup.week`: totals, show counts, caption breakdowns, the battle
 * scoreboard, and the running head-to-head from earlier weeks.
 */
export function foldMatchupRecaps(
  recaps: DayRecap[],
  matchup: DetailMatchup,
  leagueId?: string
): FoldedMatchupRecaps {
  // The matchup always carries a week in practice; this is the one place
  // that has to say so for the arithmetic below.
  const week = matchup.week ?? 0;
  const { shows, prev } = collectWeek(recaps, matchup, week);

  const breakdown = { user1: emptyBreakdown(), user2: emptyBreakdown() };
  const scores = { user1: 0, user2: 0 };
  eachResult(recaps, week, (show, result) => {
    (['user1', 'user2'] as const).forEach((side) => {
      if (!resultCountsFor(matchup, result, matchup[side])) return;
      scores[side] += result.totalScore || 0;
      breakdown[side].shows.push({
        eventName: show.eventName,
        score: result.totalScore || 0,
        geScore: result.geScore || 0,
        visualScore: result.visualScore || 0,
        musicScore: result.musicScore || 0,
      });
      breakdown[side].geTotal += result.geScore || 0;
      breakdown[side].visualTotal += result.visualScore || 0;
      breakdown[side].musicTotal += result.musicScore || 0;
    });
  });

  const battleBreakdown = matchup.crossClass
    ? null
    : battlesFor(matchup, leagueId, week, shows, prev);

  const pastBreakdowns: MatchupBattleBreakdown[] = [];
  for (let pastWeek = 1; pastWeek < week; pastWeek++) {
    const past = collectWeek(recaps, matchup, pastWeek);
    const weekBreakdown = battlesFor(matchup, leagueId, pastWeek, past.shows, past.prev);
    if (weekBreakdown) pastBreakdowns.push(weekBreakdown);
  }
  const headToHead =
    pastBreakdowns.length > 0
      ? calculateHeadToHead(matchup.user1, matchup.user2, pastBreakdowns)
      : null;

  return {
    scores,
    showCounts: { user1: shows.user1.length, user2: shows.user2.length },
    breakdown,
    battleBreakdown,
    headToHead,
  };
}
