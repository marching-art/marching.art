// The single authoritative "How Progression Works" data — every number here
// comes from (or is pinned by test to) the constants the game actually pays
// with, so this guide can never drift from the code. A player asked, almost
// verbatim: "I can't work out how director leveling actually works… a pinned
// 'how progression works' post would help." This is that post's data source.
//
// Server sources of truth:
// - functions/src/helpers/xpCalculations.js  (XP_SOURCES, XP_CONFIG, titles)
// - functions/src/helpers/engagementRewards.js (streak milestones, stipend)
// - functions/src/helpers/dailyChallenges.js  (challenge XP)
// - functions/src/helpers/dailyPredictions.js (prediction XP/CC)
// The mirror-equality test (progressionGuide.test.js) imports those modules
// directly and fails the build if any value here goes stale.

import { XP_SOURCES, CLASS_UNLOCK_COSTS } from '../utils/captionPricing';

export const XP_PER_LEVEL = 1000;

/** Level → title ladder (mirrors getLevelTitle; extended tiers past 10). */
export const LEVEL_TITLES = {
  1: 'Rookie',
  2: 'Trainee',
  3: 'Assistant',
  4: 'Coordinator',
  5: 'Instructor',
  6: 'Caption Head',
  7: 'Program Director',
  8: 'Director',
  9: 'Executive Director',
  10: 'Legend',
  15: 'Icon',
  20: 'Hall of Famer',
  25: 'Immortal',
  30: 'Eternal',
};

/** Class-unlock requirements — every path (PROGRESSION_ECONOMY_REDESIGN.md
 *  Decision 1: unlocks are earned by completing seasons, unlocked early by
 *  XP level, or skipped with CorpsCoin; the old calendar path is gone). */
export const CLASS_UNLOCK_PATHS = {
  aClass: { level: 3, seasons: 1, coin: CLASS_UNLOCK_COSTS.aClass },
  openClass: { level: 5, seasons: 2, coin: CLASS_UNLOCK_COSTS.openClass },
  worldClass: { level: 10, seasons: 3, coin: CLASS_UNLOCK_COSTS.worldClass },
};

/**
 * Every live XP source, with amounts and when it pays. Rendered by the
 * "XP & Leveling" guide section.
 */
export const XP_SOURCE_GUIDE = [
  {
    id: 'dailyLogin',
    label: 'Daily login',
    xp: XP_SOURCES.dailyLogin,
    cadence: 'Automatic, once per day',
  },
  {
    id: 'showParticipation',
    label: 'Compete in a show',
    xp: XP_SOURCES.showParticipation,
    cadence: 'Per show your corps performs at (up to 4 a week)',
  },
  {
    id: 'dailyChallenges',
    label: 'Daily challenges',
    xp: '5–10 XP each',
    cadence: 'Three rotating tasks per day',
  },
  {
    id: 'predictions',
    label: 'Daily predictions',
    xp: '15 XP per correct pick',
    cadence: 'Resolve after the nightly scores drop',
  },
  {
    id: 'weeklyParticipation',
    label: 'Weekly show participation',
    xp: XP_SOURCES.weeklyParticipation,
    cadence: 'Compete in at least one show that week, per class',
  },
  {
    id: 'leagueWin',
    label: 'Weekly league matchup win',
    xp: XP_SOURCES.leagueWin,
    cadence: 'Paid when the week closes',
  },
  {
    id: 'streakMilestones',
    label: 'Streak milestones',
    xp: '50–1,000 XP',
    cadence: 'At 3/7/14/30/60/100-day login streaks',
  },
  {
    id: 'seasonCompletion',
    label: 'Season completion',
    xp: `${XP_SOURCES.seasonCompletion.completed}–${XP_SOURCES.seasonCompletion.top10} XP by final rank`,
    cadence: 'When the season archives (must have competed)',
  },
];

/** The three ways a class unlocks, in plain language. */
export const UNLOCK_PATH_GUIDE = [
  {
    id: 'seasons',
    label: 'Earn it by playing',
    detail: `Complete ${CLASS_UNLOCK_PATHS.aClass.seasons} season (A Class), ${CLASS_UNLOCK_PATHS.openClass.seasons} seasons (Open), or ${CLASS_UNLOCK_PATHS.worldClass.seasons} seasons (World) — a season counts when you competed in at least one show`,
  },
  {
    id: 'level',
    label: 'Earn it early with XP',
    detail: `Reach Level ${CLASS_UNLOCK_PATHS.aClass.level} (A Class), ${CLASS_UNLOCK_PATHS.openClass.level} (Open), or ${CLASS_UNLOCK_PATHS.worldClass.level} (World) before the seasons do it for you`,
  },
  {
    id: 'coin',
    label: 'Skip with CorpsCoin',
    detail: `${CLASS_UNLOCK_PATHS.aClass.coin.toLocaleString()} / ${CLASS_UNLOCK_PATHS.openClass.coin.toLocaleString()} / ${CLASS_UNLOCK_PATHS.worldClass.coin.toLocaleString()} CC — the welcome grant covers A Class on day one`,
  },
];
