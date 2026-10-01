// Shared client-side achievements catalog.
//
// This mirrors the server-side source of truth in
// functions/src/helpers/achievements.js — the SAME ids, titles, descriptions,
// rarity, and reward values — but adds a client `progress(state)` for each
// entry so the UI can draw progress bars and show locked/in-progress/earned
// state without a round-trip.
//
// Awards are still granted server-side (the daily sweep in claimDailyLogin);
// `progress()` here is display-only. Earned state is read from
// profile.achievements (server-authoritative) and takes precedence over the
// locally-computed progress. Keep this file in sync with the server catalog
// when achievements are added or changed.

import {
  Award,
  Trophy,
  Target,
  Users,
  Flame,
  Star,
  Crown,
  Medal,
  TrendingUp,
  Layers,
  MapPin,
  Mic,
} from 'lucide-react';
import { REQUIRED_CAPTIONS } from '../utils/captionPricing';
import { isCorpsClassUnlocked } from '../utils/corps';

const ROSTER_SIZE = REQUIRED_CAPTIONS.length;

/**
 * The snapshot every `progress()` predicate reads (see buildAchievementState).
 * @typedef {{
 *   streak: number,
 *   level: number,
 *   unlockedClasses: string[],
 *   maxLineup: number,
 *   totalShows: number,
 *   currentSeasonShows: number,
 *   totalSeasons: number,
 *   leagueWins: number,
 *   inLeague: boolean,
 *   classRanks: Record<string, number>,
 *   regionalTrophies: number,
 *   classChampionships: number,
 *   championships: number,
 *   podiumSeasons: number,
 *   podiumDivision: string | null,
 *   bestSeasonPlacement: number | null,
 *   climbedPlacement: boolean,
 *   maxSeasonShows: number,
 *   maxClassesInSeason: number,
 * }} AchievementState
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   icon: import('lucide-react').LucideIcon,
 *   category: string,
 *   rarity: 'common' | 'rare' | 'epic' | 'legendary',
 *   ccReward: number,
 *   progress: (s: AchievementState) => { current: number, goal: number },
 * }} AchievementDef
 */

/**
 * The profile document as the catalog reads it — a loose Firestore record;
 * buildAchievementState defaults every field it touches.
 * @typedef {Record<string, any> | null | undefined} AchievementProfile
 */

/** CorpsCoin paid when an achievement is first earned, by rarity (mirrors server). */
export const RARITY_CC = { common: 25, rare: 50, epic: 100, legendary: 250 };

/** Season Performance thresholds (mirrors SEASON_PERFORMANCE on the server). */
export const SEASON_PERFORMANCE = {
  contenderCut: 25,
  finalistCut: 12,
  medalCut: 3,
  fullTourShows: 25,
  multiClassCount: 3,
};

// ---------------------------------------------------------------------------
// Categories — ordered, each with a short "how you advance" hint so players
// understand the path and rough pacing (the #1 question from the community).
// ---------------------------------------------------------------------------
export const ACHIEVEMENT_CATEGORIES = [
  {
    id: 'streak',
    label: 'Login Streaks',
    hint: 'Log in once a day to build your streak. Miss a day and it resets — the long tiers reward months of consistency, not a single burst.',
  },
  {
    id: 'progression',
    label: 'Director Level',
    hint: 'Earn XP from daily logins, scores, and challenges (~1,000 XP per level). Levels unlock new classes and prestige titles.',
  },
  {
    id: 'unlock',
    label: 'Class Access',
    hint: 'Unlock A, Open, and World Class by reaching XP levels (3 / 5 / 10) or by completing seasons (1 / 2 / 3). Active players reach World Class in roughly 4–5 months.',
  },
  {
    id: 'career',
    label: 'Career Milestones',
    hint: 'Fill your lineup, compete in shows, and finish seasons. These build up every season you play — the marathon of a director career.',
  },
  {
    id: 'season',
    label: 'Season Performance',
    hint: 'Rewards for how a season went — where you finished, how much you toured, how many classes you fielded, and whether you climbed. They land on your first login after a season wraps.',
  },
  {
    id: 'league',
    label: 'Leagues',
    hint: 'Join a league and win weekly head-to-head matchups against other directors.',
  },
  {
    id: 'dynasty',
    label: 'Championships',
    hint: 'Medal at regionals and win Finals titles. The rarest hardware in the game — the reward for a full competitive season done right.',
  },
  {
    id: 'podium',
    label: 'Podium Class',
    hint: 'Direct a corps in Podium Class, the director sim. Finish a season, then climb its divisions to Open and World Class.',
  },
];

/**
 * Earned achievements that live outside the catalog: per-league championship
 * titles (one per league and season) and awards from retired catalog
 * versions. They are real and stay on the profile, but have no denominator,
 * so every surface counts them as "honors" alongside the catalog's X/Y.
 */
export const HONORS_LABEL = 'Special Honors';

// ---------------------------------------------------------------------------
// The catalog. `progress(state)` returns { current, goal }; the entry is
// complete when current >= goal (or when the server has already awarded it).
// ---------------------------------------------------------------------------
/** @type {AchievementDef[]} */
export const ACHIEVEMENTS = [
  // --- Login streaks -------------------------------------------------------
  {
    id: 'streak_3',
    title: '3 Day Streak',
    description: 'Log in 3 days in a row',
    icon: Flame,
    category: 'streak',
    rarity: 'common',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 3), goal: 3 }),
  },
  {
    id: 'streak_7',
    title: '7 Day Streak',
    description: 'Log in 7 days in a row',
    icon: Flame,
    category: 'streak',
    rarity: 'rare',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 7), goal: 7 }),
  },
  {
    id: 'streak_14',
    title: '14 Day Streak',
    description: 'Log in 14 days in a row',
    icon: Flame,
    category: 'streak',
    rarity: 'epic',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 14), goal: 14 }),
  },
  {
    id: 'streak_30',
    title: '30 Day Streak',
    description: 'Log in 30 days in a row',
    icon: Flame,
    category: 'streak',
    rarity: 'legendary',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 30), goal: 30 }),
  },
  {
    id: 'streak_60',
    title: '60 Day Streak',
    description: 'Log in 60 days in a row',
    icon: Flame,
    category: 'streak',
    rarity: 'legendary',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 60), goal: 60 }),
  },
  {
    id: 'streak_100',
    title: '100 Day Streak',
    description: 'Log in 100 days in a row',
    icon: Crown,
    category: 'streak',
    rarity: 'legendary',
    ccReward: 0,
    progress: (s) => ({ current: Math.min(s.streak, 100), goal: 100 }),
  },

  // --- Director level ------------------------------------------------------
  {
    id: 'level_3',
    title: 'Rank Up',
    description: 'Reach XP Level 3',
    icon: Award,
    category: 'progression',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.level, 3), goal: 3 }),
  },
  {
    id: 'level_5',
    title: 'Veteran',
    description: 'Reach XP Level 5',
    icon: Award,
    category: 'progression',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: Math.min(s.level, 5), goal: 5 }),
  },
  {
    id: 'level_10',
    title: 'Elite Director',
    description: 'Reach XP Level 10',
    icon: Crown,
    category: 'progression',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: Math.min(s.level, 10), goal: 10 }),
  },
  // Prestige tiers need completed seasons as well as the level (mirrors the
  // server catalog + getLevelTitle). Seasons are the binding constraint — a
  // dedicated player clears the level long before the seasons — so the progress
  // bar tracks seasons, the work that actually remains.
  {
    id: 'level_15',
    title: 'Icon',
    description: 'Reach Level 15 and complete 4 seasons',
    icon: Crown,
    category: 'progression',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 4), goal: 4 }),
  },
  {
    id: 'level_20',
    title: 'Hall of Famer',
    description: 'Reach Level 20 and complete 9 seasons',
    icon: Crown,
    category: 'progression',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 9), goal: 9 }),
  },
  {
    id: 'level_25',
    title: 'Immortal',
    description: 'Reach Level 25 and complete 16 seasons',
    icon: Crown,
    category: 'progression',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 16), goal: 16 }),
  },

  // --- Class access --------------------------------------------------------
  {
    id: 'unlock_aClass',
    title: 'A Class Access',
    description: 'Unlock A Class competition',
    icon: Trophy,
    category: 'unlock',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({
      current: isCorpsClassUnlocked(s.unlockedClasses, 'aClass') ? 1 : 0,
      goal: 1,
    }),
  },
  {
    id: 'unlock_openClass',
    title: 'Open Class Access',
    description: 'Unlock Open Class competition',
    icon: Trophy,
    category: 'unlock',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({
      current: isCorpsClassUnlocked(s.unlockedClasses, 'openClass') ? 1 : 0,
      goal: 1,
    }),
  },
  {
    id: 'unlock_worldClass',
    title: 'World Class Access',
    description: 'Unlock World Class competition',
    icon: Trophy,
    category: 'unlock',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({
      current: isCorpsClassUnlocked(s.unlockedClasses, 'worldClass') ? 1 : 0,
      goal: 1,
    }),
  },

  // --- Career milestones ---------------------------------------------------
  {
    id: 'first_lineup',
    title: 'Full Roster',
    description: `Fill all ${ROSTER_SIZE} caption slots`,
    icon: Target,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.maxLineup, ROSTER_SIZE), goal: ROSTER_SIZE }),
  },
  {
    id: 'first_show',
    title: 'First Blood',
    description: 'Receive your first score',
    icon: Star,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: s.totalShows + s.currentSeasonShows >= 1 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'shows_10',
    title: 'Road Warrior',
    description: 'Compete in 10 career shows',
    icon: Star,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.totalShows + s.currentSeasonShows, 10), goal: 10 }),
  },
  {
    id: 'shows_50',
    title: 'Tour Veteran',
    description: 'Compete in 50 career shows',
    icon: Star,
    category: 'career',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: Math.min(s.totalShows, 50), goal: 50 }),
  },
  {
    id: 'shows_100',
    title: 'Century Tour',
    description: 'Compete in 100 career shows',
    icon: Medal,
    category: 'career',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: Math.min(s.totalShows, 100), goal: 100 }),
  },
  {
    id: 'seasons_1',
    title: 'Season One',
    description: 'Complete your first season',
    icon: Medal,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 1), goal: 1 }),
  },
  {
    id: 'seasons_2',
    title: 'Sophomore Season',
    description: 'Complete 2 seasons',
    icon: Medal,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 2), goal: 2 }),
  },
  {
    id: 'seasons_3',
    title: 'Hat Trick',
    description: 'Complete 3 seasons',
    icon: Medal,
    category: 'career',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 3), goal: 3 }),
  },
  {
    id: 'seasons_5',
    title: 'Five Year Plan',
    description: 'Complete 5 seasons',
    icon: Medal,
    category: 'career',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 5), goal: 5 }),
  },
  {
    id: 'seasons_10',
    title: 'Decade of Drums',
    description: 'Complete 10 seasons',
    icon: Crown,
    category: 'career',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.totalSeasons, 10), goal: 10 }),
  },

  // --- Season performance --------------------------------------------------
  // Read from archived season results, so progress moves when a season wraps.
  {
    id: 'season_top_25',
    title: 'Contender',
    description: `Finish a season in the top ${SEASON_PERFORMANCE.contenderCut} of a competitive class`,
    icon: Star,
    category: 'season',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({
      current:
        s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.contenderCut
          ? 1
          : 0,
      goal: 1,
    }),
  },
  {
    id: 'season_top_12',
    title: 'Finalist',
    description: `Finish a season in the top ${SEASON_PERFORMANCE.finalistCut} of a competitive class`,
    icon: Medal,
    category: 'season',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({
      current:
        s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.finalistCut
          ? 1
          : 0,
      goal: 1,
    }),
  },
  {
    id: 'season_top_3',
    title: 'Medal Stand',
    description: `Finish a season in the top ${SEASON_PERFORMANCE.medalCut} of a competitive class`,
    icon: Trophy,
    category: 'season',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({
      current:
        s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.medalCut
          ? 1
          : 0,
      goal: 1,
    }),
  },
  {
    id: 'season_climber',
    title: 'On the Rise',
    description: 'Finish higher in a class than your previous season there',
    icon: TrendingUp,
    category: 'season',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: s.climbedPlacement ? 1 : 0, goal: 1 }),
  },
  {
    id: 'season_full_tour',
    title: 'Full Tour',
    description: `Compete in ${SEASON_PERFORMANCE.fullTourShows} shows in a single season`,
    icon: MapPin,
    category: 'season',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({
      current: Math.min(s.maxSeasonShows, SEASON_PERFORMANCE.fullTourShows),
      goal: SEASON_PERFORMANCE.fullTourShows,
    }),
  },
  {
    id: 'season_multi_class',
    title: 'Triple Threat',
    description: `Compete in ${SEASON_PERFORMANCE.multiClassCount} classes in the same season`,
    icon: Layers,
    category: 'season',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({
      current: Math.min(s.maxClassesInSeason, SEASON_PERFORMANCE.multiClassCount),
      goal: SEASON_PERFORMANCE.multiClassCount,
    }),
  },

  // --- Leagues -------------------------------------------------------------
  {
    id: 'league_join',
    title: 'League Player',
    description: 'Join a league',
    icon: Users,
    category: 'league',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: s.inLeague ? 1 : 0, goal: 1 }),
  },
  {
    id: 'league_win_1',
    title: 'Matchup Victor',
    description: 'Win a weekly league matchup',
    icon: Trophy,
    category: 'league',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.leagueWins, 1), goal: 1 }),
  },
  {
    id: 'league_wins_10',
    title: 'League Force',
    description: 'Win 10 weekly league matchups',
    icon: Trophy,
    category: 'league',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: Math.min(s.leagueWins, 10), goal: 10 }),
  },

  // --- Championships (dynasty) ---------------------------------------------
  {
    id: 'regional_medalist',
    title: 'Regional Medalist',
    description: 'Medal at a regional',
    icon: Medal,
    category: 'dynasty',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: s.regionalTrophies >= 1 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'class_champion',
    title: 'Class Champion',
    description: 'Win an Open or A Class Finals title',
    icon: Trophy,
    category: 'dynasty',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: s.classChampionships >= 1 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'world_champion',
    title: 'Ring Bearer',
    description: 'Win a Championship Finals title',
    icon: Crown,
    category: 'dynasty',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: s.championships >= 1 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'dynasty',
    title: 'Dynasty',
    description: 'Win multiple Championship Finals titles',
    icon: Crown,
    category: 'dynasty',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.championships, 2), goal: 2 }),
  },

  // --- Top-10 standing (per class) — earned by daily rivals job -------------
  {
    id: 'top_10_aClass',
    title: 'Top 10 (A Class)',
    description: 'Reach top 10 in A Class',
    icon: Trophy,
    category: 'dynasty',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: (s.classRanks.aClass || Infinity) <= 10 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'top_10_openClass',
    title: 'Top 10 (Open Class)',
    description: 'Reach top 10 in Open Class',
    icon: Trophy,
    category: 'dynasty',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: (s.classRanks.openClass || Infinity) <= 10 ? 1 : 0, goal: 1 }),
  },
  {
    id: 'top_10_worldClass',
    title: 'Top 10 (World Class)',
    description: 'Reach top 10 in World Class',
    icon: Trophy,
    category: 'dynasty',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({ current: (s.classRanks.worldClass || Infinity) <= 10 ? 1 : 0, goal: 1 }),
  },

  // --- Podium Class (director sim) -----------------------------------------
  {
    id: 'podium_debut',
    title: 'Podium Debut',
    description: 'Complete your first Podium season',
    icon: Mic,
    category: 'podium',
    rarity: 'common',
    ccReward: RARITY_CC.common,
    progress: (s) => ({ current: Math.min(s.podiumSeasons, 1), goal: 1 }),
  },
  {
    id: 'podium_open',
    title: 'Open Class Director',
    description: 'Climb to Open Class in Podium',
    icon: Trophy,
    category: 'podium',
    rarity: 'rare',
    ccReward: RARITY_CC.rare,
    progress: (s) => ({
      current: s.podiumDivision === 'openClass' || s.podiumDivision === 'worldClass' ? 1 : 0,
      goal: 1,
    }),
  },
  {
    id: 'podium_world',
    title: 'World Class Director',
    description: 'Climb to World Class in Podium',
    icon: Crown,
    category: 'podium',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: s.podiumDivision === 'worldClass' ? 1 : 0, goal: 1 }),
  },
];

const CATALOG_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

/**
 * @typedef {{
 *   classKey: string | null,
 *   seasonId: string | null,
 *   placement: number | null,
 *   shows: number,
 * }} SeasonRow
 */

/**
 * Every archived season row, grouped per corps history in archive order.
 * Mirrors seasonHistories in functions/src/helpers/achievements.js.
 *
 * @param {Record<string, any>} corps
 * @param {Array<Record<string, any>>} retiredCorps
 * @returns {SeasonRow[][]}
 */
function seasonHistories(corps, retiredCorps) {
  /** @type {SeasonRow[][]} */
  const lists = [];
  /** @param {unknown} rows @param {string | null | undefined} fallbackClass */
  const add = (rows, fallbackClass) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    lists.push(
      rows.filter(Boolean).map((row) => ({
        classKey: row.corpsClass || fallbackClass || null,
        seasonId: row.seasonId || null,
        placement: Number.isInteger(row.placement) && row.placement >= 1 ? row.placement : null,
        shows: Number(row.showsAttended) || 0,
      }))
    );
  };
  Object.entries(corps).forEach(([slot, c]) => {
    if (c) add(c.seasonHistory, slot);
  });
  retiredCorps.forEach((r) => {
    if (r) add(r.seasonHistory, r.corpsClass);
  });
  return lists;
}

/**
 * Season-performance snapshot (mirrors seasonPerformance on the server): best
 * ranked-class finish, a season-over-season climb in one class, the most shows
 * one corps played in one season, and the most fantasy classes in one season.
 *
 * @param {Record<string, any>} corps
 * @param {Array<Record<string, any>>} retiredCorps
 */
export function seasonPerformance(corps, retiredCorps = []) {
  /** @type {number | null} */
  let bestSeasonPlacement = null;
  let climbedPlacement = false;
  let maxSeasonShows = 0;
  /** @type {Map<string, Set<string>>} */
  const classesBySeason = new Map();

  for (const rows of seasonHistories(corps, retiredCorps)) {
    /** @type {Map<string | null, number>} */
    const lastPlacementByClass = new Map();
    for (const row of rows) {
      maxSeasonShows = Math.max(maxSeasonShows, row.shows);
      if (row.seasonId && row.shows > 0 && row.classKey && row.classKey !== 'podiumClass') {
        const classes = classesBySeason.get(row.seasonId) ?? new Set();
        classes.add(row.classKey);
        classesBySeason.set(row.seasonId, classes);
      }
      if (row.placement == null || row.classKey === 'soundSport') continue;
      if (bestSeasonPlacement == null || row.placement < bestSeasonPlacement) {
        bestSeasonPlacement = row.placement;
      }
      const previous = lastPlacementByClass.get(row.classKey);
      if (previous != null && row.placement < previous) climbedPlacement = true;
      lastPlacementByClass.set(row.classKey, row.placement);
    }
  }

  let maxClassesInSeason = 0;
  classesBySeason.forEach((classes) => {
    maxClassesInSeason = Math.max(maxClassesInSeason, classes.size);
  });
  return { bestSeasonPlacement, climbedPlacement, maxSeasonShows, maxClassesInSeason };
}

/**
 * Podium seasons played and shows attended, from the public résumé
 * (mirrors podiumSeasonsPlayed / podiumShowsAttended on the server).
 *
 * @param {Record<string, any>} corps
 */
function podiumCareer(corps) {
  /** @type {Array<Record<string, any>>} */
  const rows = corps.podiumClass?.seasonHistory || [];
  const seasonIds = new Set();
  let shows = 0;
  for (const row of rows) {
    if (!row) continue;
    if (row.seasonId && row.finalScore != null) seasonIds.add(row.seasonId);
    shows += row.showsAttended || 0;
  }
  return { seasons: seasonIds.size, shows };
}

/**
 * Build the state snapshot the catalog's progress() predicates read from.
 * Mirrors buildAchievementState in functions/src/helpers/achievements.js so
 * client-computed progress matches the server's award logic.
 *
 * @param {AchievementProfile} profile - the director profile document
 * @param {Record<string, any> | null} [corps] - the corps map (store keeps it
 *   split out from profile; falls back to profile.corps)
 * @returns {AchievementState}
 */
export function buildAchievementState(profile, corps) {
  const p = profile || {};
  const c = corps || p.corps || {};
  const corpsList = Object.values(c).filter(Boolean);

  const lineupSizes = corpsList.map((x) => Object.keys(x?.lineup || {}).length);
  const maxLineup = lineupSizes.length ? Math.max(...lineupSizes) : 0;

  /** @type {Record<string, number>} */
  const classRanks = {};
  Object.entries(p.classRanks || {}).forEach(([cls, snapshot]) => {
    if (snapshot && typeof snapshot.rank === 'number') classRanks[cls] = snapshot.rank;
  });

  const trophies = p.trophies || {};
  const currentSeasonShows = corpsList.reduce(
    (sum, x) => sum + Object.keys(x?.selectedShows || {}).length,
    0
  );
  // Podium is a separate game: its shows add to the career count, its seasons
  // overlap the fantasy count (one calendar season), so they union via max.
  const podium = podiumCareer(c);

  return {
    streak: p.engagement?.loginStreak ?? 0,
    level: p.xpLevel ?? 1,
    unlockedClasses: p.unlockedClasses ?? ['soundSport'],
    maxLineup,
    totalShows: (p.lifetimeStats?.totalShows || 0) + podium.shows,
    currentSeasonShows,
    totalSeasons: Math.max(p.lifetimeStats?.totalSeasons || 0, podium.seasons),
    leagueWins: p.stats?.leagueWins || p.lifetimeStats?.leagueChampionships || 0,
    inLeague: (p.leagueIds || []).length > 0,
    classRanks,
    regionalTrophies: (trophies.regionals || []).length,
    classChampionships: (trophies.classChampionships || []).length,
    championships: (trophies.championships || []).length,
    podiumSeasons: podium.seasons,
    podiumDivision: c.podiumClass?.division || null,
    ...seasonPerformance(c, Array.isArray(p.retiredCorps) ? p.retiredCorps : []),
  };
}

/**
 * Evaluate the whole catalog against a profile. Earned state comes from
 * profile.achievements (server-authoritative) and wins over local progress.
 *
 * @param {AchievementProfile} profile
 * @param {Record<string, any> | null} [corps]
 * @returns {Array<AchievementDef & {
 *   current: number, goal: number, pct: number, earned: boolean, earnedAt: unknown,
 * }>} each achievement plus its progress and earned state
 */
export function evaluateAchievements(profile, corps) {
  const state = buildAchievementState(profile, corps);
  /** @type {Map<string, { id: string, earnedAt?: unknown }>} */
  const earnedById = new Map(
    (profile?.achievements || []).map((/** @type {{ id: string }} */ a) => [a.id, a])
  );

  return ACHIEVEMENTS.map((a) => {
    const earnedEntry = earnedById.get(a.id);
    const { current, goal } = a.progress(state);
    if (earnedEntry) {
      return { ...a, current: goal, goal, pct: 100, earned: true, earnedAt: earnedEntry.earnedAt };
    }
    const pct = goal === 0 ? 100 : Math.min(Math.round((current / goal) * 100), 100);
    return { ...a, current, goal, pct, earned: pct >= 100, earnedAt: null };
  });
}

/**
 * A stored achievement entry as the profile holds it. Legacy rows may carry
 * `name` instead of `title`.
 * @typedef {{ id: string, title?: string, name?: string, description?: string,
 *   rarity?: string, ccReward?: number, earnedAt?: unknown }} StoredAchievement
 */

/**
 * The profile's stored achievements with duplicate ids collapsed (older
 * writers could arrayUnion the same id twice with different timestamps) and
 * a display title on every row (legacy rows stored `name` instead of `title`).
 * Returns a fresh array in stored (oldest-first) order.
 *
 * @param {AchievementProfile} profile
 * @returns {Array<StoredAchievement & { title: string }>}
 */
export function uniqueStoredAchievements(profile) {
  /** @type {StoredAchievement[]} */
  const list = Array.isArray(profile?.achievements) ? profile.achievements : [];
  const seen = new Set();
  return list
    .filter((a) => {
      if (!a || !a.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .map((a) => ({ ...a, title: a.title || a.name || 'Special Honor' }));
}

/**
 * The one achievement tally every surface shows (profile, /achievements,
 * dashboard), so they can never disagree: catalog earned / catalog total,
 * plus honors — earned entries outside the catalog (league titles, retired
 * awards) that have no denominator.
 *
 * @param {AchievementProfile} profile
 * @param {Record<string, any> | null} [corps]
 */
export function summarizeAchievements(profile, corps) {
  const evaluated = evaluateAchievements(profile, corps);
  const earned = evaluated.filter((a) => a.earned);
  const honors = uniqueStoredAchievements(profile).filter((a) => !CATALOG_IDS.has(a.id));
  const ccEarned =
    earned.reduce((sum, a) => sum + (a.ccReward || 0), 0) +
    honors.reduce((sum, a) => sum + (Number(a.ccReward) || 0), 0);
  return {
    evaluated,
    earnedCount: earned.length,
    totalCount: ACHIEVEMENTS.length,
    honors,
    ccEarned,
  };
}

/**
 * The tally as compact text — `26/41 · +2` with a spelled-out tooltip — for
 * surfaces with no room for the full header.
 *
 * @param {{ earnedCount: number, totalCount: number, honors: unknown[] }} summary
 */
export function formatAchievementTally({ earnedCount, totalCount, honors }) {
  const n = honors.length;
  const honorsText = n > 0 ? `, plus ${n} special ${n === 1 ? 'honor' : 'honors'}` : '';
  return {
    short: `${earnedCount}/${totalCount}${n > 0 ? ` · +${n}` : ''}`,
    long: `${earnedCount} of ${totalCount} achievements${honorsText}`,
  };
}
