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
    xp: '10 XP each',
    cadence: 'Three rotating decisions per day; full set on 5 days a week pays a bonus',
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

/**
 * The progression hierarchy — one primary number and distinct secondaries,
 * each measuring a different axis with a stated meaning and a way to raise
 * it. This is the answer to "what do all these numbers mean?": four axes,
 * no overlapping aggregates (the old Influence/Rating blends are retired).
 */
export const PROGRESSION_AXES = [
  {
    id: 'journey',
    label: 'Your journey — Level & Title',
    meaning: `Experience over time. Every ${XP_PER_LEVEL.toLocaleString()} XP is a level; levels carry titles (Rookie → Eternal) and unlock classes early.`,
    raise: 'Everything pays XP — logins, shows, challenges, predictions, league wins, seasons. See the sources below.',
  },
  {
    id: 'standing',
    label: 'Your standing — Class · Rank',
    meaning:
      'How good you are right now: your flagship corps’ live rank in its class (e.g. "World Class · #14"), recomputed after every night’s scores from your most recent daily total. SoundSport shows a medal rating instead — it never ranks.',
    raise: 'Score higher: field a stronger lineup, register for more shows, and outperform the corps above you.',
  },
  {
    id: 'legacy',
    label: 'Your legacy — Trophies, Records & Mastery',
    meaning:
      'What you’ve permanently earned: championships and medals in the Trophy Case, Records Book entries, caption mastery tiers, Hall of Champions banners. Concrete and forever — no aggregate needed.',
    raise: 'Win things. Finish seasons, take finals medals, push caption points past mastery thresholds.',
  },
  {
    id: 'context',
    label: 'Context — Streak & Seasons',
    meaning: 'How consistently and how long you’ve played. Not a score — just the story so far.',
    raise: 'Show up daily (streak) and complete seasons.',
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
