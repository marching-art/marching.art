// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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

import { Award, Trophy, Target, Users, Flame, Star, Crown, Medal } from 'lucide-react';
import { REQUIRED_CAPTIONS } from '../utils/captionPricing';
import { isCorpsClassUnlocked } from '../utils/corps';

const ROSTER_SIZE = REQUIRED_CAPTIONS.length;

/** CorpsCoin paid when an achievement is first earned, by rarity (mirrors server). */
export const RARITY_CC = { common: 25, rare: 50, epic: 100, legendary: 250 };

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
    id: 'league',
    label: 'Leagues',
    hint: 'Join a league and win weekly head-to-head matchups against other directors.',
  },
  {
    id: 'dynasty',
    label: 'Championships',
    hint: 'Medal at regionals and win Finals titles. The rarest hardware in the game — the reward for a full competitive season done right.',
  },
];

// ---------------------------------------------------------------------------
// The catalog. `progress(state)` returns { current, goal }; the entry is
// complete when current >= goal (or when the server has already awarded it).
// ---------------------------------------------------------------------------
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
  {
    id: 'level_15',
    title: 'Icon',
    description: 'Reach XP Level 15',
    icon: Crown,
    category: 'progression',
    rarity: 'epic',
    ccReward: RARITY_CC.epic,
    progress: (s) => ({ current: Math.min(s.level, 15), goal: 15 }),
  },
  {
    id: 'level_20',
    title: 'Hall of Famer',
    description: 'Reach XP Level 20',
    icon: Crown,
    category: 'progression',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.level, 20), goal: 20 }),
  },
  {
    id: 'level_25',
    title: 'Immortal',
    description: 'Reach XP Level 25',
    icon: Crown,
    category: 'progression',
    rarity: 'legendary',
    ccReward: RARITY_CC.legendary,
    progress: (s) => ({ current: Math.min(s.level, 25), goal: 25 }),
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
];

/**
 * Build the state snapshot the catalog's progress() predicates read from.
 * Mirrors buildAchievementState in functions/src/helpers/achievements.js so
 * client-computed progress matches the server's award logic.
 *
 * @param {Object} profile - the director profile document
 * @param {Object} [corps] - the corps map (store keeps it split out from
 *   profile; falls back to profile.corps)
 */
export function buildAchievementState(profile, corps) {
  const p = profile || {};
  const c = corps || p.corps || {};
  const corpsList = Object.values(c).filter(Boolean);

  const lineupSizes = corpsList.map((x) => Object.keys(x?.lineup || {}).length);
  const maxLineup = lineupSizes.length ? Math.max(...lineupSizes) : 0;

  const classRanks = {};
  Object.entries(p.classRanks || {}).forEach(([cls, snapshot]) => {
    if (snapshot && typeof snapshot.rank === 'number') classRanks[cls] = snapshot.rank;
  });

  const trophies = p.trophies || {};
  const currentSeasonShows = corpsList.reduce(
    (sum, x) => sum + Object.keys(x?.selectedShows || {}).length,
    0
  );

  return {
    streak: p.engagement?.loginStreak ?? 0,
    level: p.xpLevel ?? 1,
    unlockedClasses: p.unlockedClasses ?? ['soundSport'],
    maxLineup,
    totalShows: p.lifetimeStats?.totalShows || 0,
    currentSeasonShows,
    totalSeasons: p.lifetimeStats?.totalSeasons || 0,
    leagueWins: p.stats?.leagueWins || p.lifetimeStats?.leagueChampionships || 0,
    inLeague: (p.leagueIds || []).length > 0,
    classRanks,
    regionalTrophies: (trophies.regionals || []).length,
    classChampionships: (trophies.classChampionships || []).length,
    championships: (trophies.championships || []).length,
  };
}

/**
 * Evaluate the whole catalog against a profile. Earned state comes from
 * profile.achievements (server-authoritative) and wins over local progress.
 *
 * @returns {Array} each achievement plus { current, goal, pct, earned, earnedAt }
 */
export function evaluateAchievements(profile, corps) {
  const state = buildAchievementState(profile, corps);
  const earnedById = new Map((profile?.achievements || []).map((a) => [a.id, a]));

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
