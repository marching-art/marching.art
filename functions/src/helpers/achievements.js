/**
 * Achievements Catalog & Sweep
 *
 * Single server-side source of truth for profile achievements. Awards happen
 * in one place: the daily sweep inside claimDailyLogin (dailyOps.js), which
 * compares the catalog against the profile's current state and adds anything
 * newly earned — so existing directors are backfilled automatically on their
 * next login, and achievements can never diverge from server state the way
 * the old client-side writers could.
 *
 * Achievement shape matches what the profile/AchievementModal already render:
 * { id, title, description, icon, earnedAt, rarity }
 *
 * ccReward is paid once, when the achievement is first added. Streak-tier
 * achievements carry no ccReward because STREAK_MILESTONES
 * (helpers/engagementRewards.js) already pays coin at the moment the
 * milestone is hit.
 */

/**
 * A profile/data document as the sweep reads it — a loose Firestore record;
 * every field touched is defaulted.
 * @typedef {Record<string, any>} ProfileData
 */

/**
 * Post-update values claimDailyLogin passes in before they're written.
 * @typedef {{
 *   streak?: number,
 *   level?: number,
 *   unlockedClasses?: string[],
 *   totalSeasons?: number,
 *   classUnlockPaths?: Record<string, string>,
 * }} StateOverrides
 */

/**
 * One archived season row, normalized for the season-performance checks.
 * @typedef {{classKey: string|null, seasonId: string|null, placement: number|null, shows: number}} SeasonRow
 */

/** CorpsCoin paid when an achievement is first earned, by rarity */
const RARITY_CC = { common: 25, rare: 50, epic: 100, legendary: 250 };

// Season Performance thresholds (mirrored in src/data/achievementsCatalog.js).
// A season is 7 weeks: 4 shows a week for six weeks plus up to 7 in finals
// week (helpers/showSelection.getMaxShowsForWeek) — 31 at most, so a Full
// Tour means near-perfect attendance. 12 is the DCI Finals field.
const SEASON_PERFORMANCE = {
  contenderCut: 25,
  finalistCut: 12,
  medalCut: 3,
  fullTourShows: 25,
  multiClassCount: 3,
};

/**
 * Catalog entries. `earned(state)` receives the buildAchievementState snapshot:
 * { streak, level, unlockedClasses, hasFullLineup, totalShows, totalSeasons,
 *   leagueWins, classRanks, trophies counts, podium fields, and the
 *   seasonPerformance results }
 */
/**
 * @typedef {ReturnType<typeof buildAchievementState>} AchievementState
 * @typedef {{
 *   id: string, title: string, description: string, icon: string,
 *   rarity: 'common' | 'rare' | 'epic' | 'legendary', ccReward: number,
 *   earned: (s: AchievementState) => boolean,
 * }} CatalogEntry
 */

/** @type {CatalogEntry[]} */
const ACHIEVEMENT_CATALOG = [
  // --- Streak tiers (coin paid via STREAK_MILESTONES, not here) ---
  { id: 'streak_3', title: '3 Day Streak!', description: 'Logged in 3 days in a row', icon: 'flame', rarity: 'common', ccReward: 0, earned: (s) => s.streak >= 3 },
  { id: 'streak_7', title: '7 Day Streak!', description: 'Logged in 7 days in a row', icon: 'flame', rarity: 'rare', ccReward: 0, earned: (s) => s.streak >= 7 },
  { id: 'streak_14', title: '14 Day Streak!', description: 'Logged in 14 days in a row', icon: 'flame', rarity: 'epic', ccReward: 0, earned: (s) => s.streak >= 14 },
  { id: 'streak_30', title: '30 Day Streak!', description: 'Logged in 30 days in a row', icon: 'flame', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 30 },
  { id: 'streak_60', title: '60 Day Streak!', description: 'Logged in 60 days in a row', icon: 'flame', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 60 },
  { id: 'streak_100', title: '100 Day Streak!', description: 'Logged in 100 days in a row', icon: 'crown', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 100 },

  // --- Level progression ---
  { id: 'level_3', title: 'Rank Up', description: 'Reached XP Level 3', icon: 'award', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.level >= 3 },
  { id: 'level_5', title: 'Veteran', description: 'Reached XP Level 5', icon: 'award', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.level >= 5 },
  { id: 'level_10', title: 'Elite Director', description: 'Reached XP Level 10', icon: 'crown', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.level >= 10 },
  // Prestige tiers are lifetime titles: gated on completed seasons as well as
  // XP level, matching getLevelTitle's EXTENDED_TITLE_TIERS so the badge and the
  // profile title agree. (Already-earned badges are never revoked — the sweep
  // only adds — so this raises the bar for new earners, not past ones.)
  { id: 'level_15', title: 'Icon', description: 'Reached XP Level 15 and completed 4 seasons', icon: 'crown', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.level >= 15 && s.totalSeasons >= 4 },
  { id: 'level_20', title: 'Hall of Famer', description: 'Reached XP Level 20 and completed 9 seasons', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.level >= 20 && s.totalSeasons >= 9 },
  { id: 'level_25', title: 'Immortal', description: 'Reached XP Level 25 and completed 16 seasons', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.level >= 25 && s.totalSeasons >= 16 },

  // --- Class unlocks ---
  { id: 'unlock_aClass', title: 'A Class Access', description: 'Unlocked A Class competition', icon: 'trophy', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.unlockedClasses.includes('aClass') },
  { id: 'unlock_openClass', title: 'Open Class Access', description: 'Unlocked Open Class competition', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.unlockedClasses.includes('openClass') },
  { id: 'unlock_worldClass', title: 'World Class Access', description: 'Unlocked World Class competition', icon: 'trophy', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.unlockedClasses.includes('worldClass') },

  // --- Career milestones ---
  { id: 'first_lineup', title: 'Full Roster', description: 'Filled all 8 caption slots', icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.hasFullLineup },
  // currentSeasonShows covers the live season — lifetimeStats.totalShows only
  // updates at archival, and "first score" shouldn't wait months to land.
  { id: 'first_show', title: 'First Blood', description: 'Received your first score', icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalShows >= 1 || s.currentSeasonShows >= 1 },
  { id: 'shows_10', title: 'Road Warrior', description: 'Competed in 10 career shows', icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalShows + s.currentSeasonShows >= 10 },
  { id: 'shows_50', title: 'Tour Veteran', description: 'Competed in 50 career shows', icon: 'star', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.totalShows >= 50 },
  { id: 'shows_100', title: 'Century Tour', description: 'Competed in 100 career shows', icon: 'medal', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.totalShows >= 100 },
  { id: 'seasons_1', title: 'Season One', description: 'Completed your first season', icon: 'medal', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalSeasons >= 1 },
  { id: 'seasons_2', title: 'Sophomore Season', description: 'Completed 2 seasons', icon: 'medal', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalSeasons >= 2 },
  { id: 'seasons_3', title: 'Hat Trick', description: 'Completed 3 seasons', icon: 'medal', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalSeasons >= 3 },
  { id: 'seasons_5', title: 'Five Year Plan', description: 'Completed 5 seasons', icon: 'medal', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.totalSeasons >= 5 },
  { id: 'seasons_10', title: 'Decade of Drums', description: 'Completed 10 seasons', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.totalSeasons >= 10 },

  // --- Season performance (archived seasonHistory rows; see seasonPerformance) ---
  // How well a season went, not just that it happened: where it finished, how
  // much the corps toured, breadth across classes, and season-over-season
  // improvement. Every input is an archived résumé row, so these land on the
  // first daily login after rollover and backfill for veterans automatically.
  { id: 'season_top_25', title: 'Contender', description: `Finished a season in the top ${SEASON_PERFORMANCE.contenderCut} of a competitive class`, icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.contenderCut },
  { id: 'season_top_12', title: 'Finalist', description: `Finished a season in the top ${SEASON_PERFORMANCE.finalistCut} of a competitive class`, icon: 'medal', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.finalistCut },
  { id: 'season_top_3', title: 'Medal Stand', description: `Finished a season in the top ${SEASON_PERFORMANCE.medalCut} of a competitive class`, icon: 'trophy', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.bestSeasonPlacement != null && s.bestSeasonPlacement <= SEASON_PERFORMANCE.medalCut },
  { id: 'season_climber', title: 'On the Rise', description: 'Finished higher in a class than your previous season there', icon: 'award', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.climbedPlacement },
  { id: 'season_full_tour', title: 'Full Tour', description: `Competed in ${SEASON_PERFORMANCE.fullTourShows} shows in a single season`, icon: 'star', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.maxSeasonShows >= SEASON_PERFORMANCE.fullTourShows },
  { id: 'season_multi_class', title: 'Triple Threat', description: `Competed in ${SEASON_PERFORMANCE.multiClassCount} classes in the same season`, icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.maxClassesInSeason >= SEASON_PERFORMANCE.multiClassCount },

  // --- League ---
  { id: 'league_join', title: 'League Player', description: 'Joined a league', icon: 'award', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.inLeague },
  { id: 'league_win_1', title: 'Matchup Victor', description: 'Won a weekly league matchup', icon: 'trophy', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.leagueWins >= 1 },
  { id: 'league_wins_10', title: 'League Force', description: 'Won 10 weekly league matchups', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.leagueWins >= 10 },

  // --- Dynasty (trophy case; trophies.* arrays written by nightly scoring) ---
  { id: 'regional_medalist', title: 'Regional Medalist', description: 'Medaled at a regional', icon: 'medal', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.regionalTrophies >= 1 },
  { id: 'class_champion', title: 'Class Champion', description: 'Won an Open or A Class Finals title', icon: 'trophy', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.classChampionships >= 1 },
  { id: 'world_champion', title: 'Ring Bearer', description: 'Won a Championship Finals title', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.championships >= 1 },
  { id: 'dynasty', title: 'Dynasty', description: 'Won multiple Championship Finals titles', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.championships >= 2 },

  // --- Top-10 standing (per class; classRanks written daily by the rivals job) ---
  { id: 'top_10_aClass', title: 'Top 10 Finish!', description: 'Reached top 10 in A Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.aClass || Infinity) <= 10 },
  { id: 'top_10_openClass', title: 'Top 10 Finish!', description: 'Reached top 10 in Open Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.openClass || Infinity) <= 10 },
  { id: 'top_10_worldClass', title: 'Top 10 Finish!', description: 'Reached top 10 in World Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.worldClass || Infinity) <= 10 },

  // --- Podium Class (director sim) ---
  // Podium is a separate game with no drafted lineup, so the fantasy-shaped
  // milestones above (first_lineup, top_10_*) can't fire for a Podium-only
  // director. These read the Podium display copy the nightly processor and the
  // season boundary write onto the profile (corps.podiumClass.seasonHistory and
  // .division), so the daily sweep can award them with no extra reads. The
  // shared career lines (streaks, XP levels, seasons_*, shows_*, championships,
  // regionals, leagues) already reach Podium directors: XP and trophies are
  // written in the fantasy shape, and buildAchievementState folds Podium seasons
  // and shows into totalSeasons/totalShows below.
  { id: 'podium_debut', title: 'Podium Debut', description: 'Completed your first Podium season', icon: 'medal', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.podiumSeasons >= 1 },
  { id: 'podium_open', title: 'Open Class Director', description: 'Climbed to Open Class in Podium', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.podiumDivision === 'openClass' || s.podiumDivision === 'worldClass' },
  { id: 'podium_world', title: 'World Class Director', description: 'Climbed to World Class in Podium', icon: 'crown', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.podiumDivision === 'worldClass' },
];

/**
 * Distinct Podium seasons this director actually competed in, from the public
 * résumé the boundary sweep writes (corps.podiumClass.seasonHistory). A row is
 * only written once a corps has performed (finalScore set), and it is upserted
 * per seasonId, so counting distinct scored rows is idempotent and mirrors the
 * fantasy "competed in ≥1 show" bar for a completed season.
 */
/** @param {ProfileData} profileData */
function podiumSeasonsPlayed(profileData) {
  const rows = profileData.corps?.podiumClass?.seasonHistory || [];
  const seasonIds = new Set();
  for (const row of rows) {
    if (row && row.seasonId && row.finalScore != null) seasonIds.add(row.seasonId);
  }
  return seasonIds.size;
}

/**
 * Podium shows attended across archived seasons (résumé rows carry the count).
 * @param {ProfileData} profileData
 */
function podiumShowsAttended(profileData) {
  const rows = profileData.corps?.podiumClass?.seasonHistory || [];
  return rows.reduce(
    (/** @type {number} */ sum, /** @type {any} */ row) =>
      sum + (row && row.showsAttended ? row.showsAttended : 0),
    0
  );
}

/**
 * Every archived season row on the profile, grouped per corps history in
 * archive (chronological) order. Active corps carry their résumé on
 * corps.{class}.seasonHistory; a retired corps keeps its own on the
 * retiredCorps record. A row's class is the class it was COMPETED in
 * (row.corpsClass), falling back to the slot it sits in for older rows.
 *
 * @param {ProfileData} profileData
 * @returns {SeasonRow[][]}
 */
function seasonHistories(profileData) {
  /** @type {SeasonRow[][]} */
  const lists = [];
  /** @param {unknown} rows @param {string|null|undefined} fallbackClass */
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
  for (const [slot, corps] of Object.entries(profileData.corps || {})) {
    if (corps) add(corps.seasonHistory, slot);
  }
  for (const retired of profileData.retiredCorps || []) {
    if (retired) add(retired.seasonHistory, retired.corpsClass);
  }
  return lists;
}

/**
 * Season-performance snapshot for the Season Performance achievements:
 *  - bestSeasonPlacement: best final placement in a ranked class (SoundSport
 *    is ratings-only, so it never counts), or null when never placed;
 *  - climbedPlacement: some corps finished higher in a class than its
 *    previous archived season in that same class;
 *  - maxSeasonShows: most shows one corps competed in during one season;
 *  - maxClassesInSeason: most fantasy classes competed in during one season
 *    (Podium is a separate game, so it doesn't add a class).
 * Existence/max only — never sums — so a corps whose history appears on
 * both an active slot and a retired record can't over-credit anything.
 */
/** @param {ProfileData} profileData */
function seasonPerformance(profileData) {
  /** @type {number|null} */
  let bestSeasonPlacement = null;
  let climbedPlacement = false;
  let maxSeasonShows = 0;
  /** @type {Map<string, Set<string>>} */
  const classesBySeason = new Map();

  for (const rows of seasonHistories(profileData)) {
    /** @type {Map<string|null, number>} */
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
  for (const classes of classesBySeason.values()) {
    maxClassesInSeason = Math.max(maxClassesInSeason, classes.size);
  }
  return { bestSeasonPlacement, climbedPlacement, maxSeasonShows, maxClassesInSeason };
}

/**
 * The director's true distinct seasons played, as a monotonic lower bound:
 * the larger of the stored fantasy counter and the Podium seasons played.
 * Podium and fantasy seasons OVERLAP (one calendar season, two games), so they
 * can't be summed — max() is the safe union floor. It never exceeds the real
 * total and never lowers the stored value, so persisting it (dailyOps) can lift
 * a Podium-only director's prestige-title / season-achievement gates without
 * ever over-crediting a both-games director or handing out a free class unlock.
 */
/** @param {ProfileData} profileData */
function reconciledTotalSeasons(profileData) {
  return Math.max(profileData.lifetimeStats?.totalSeasons || 0, podiumSeasonsPlayed(profileData));
}

/**
 * Build the state snapshot the catalog predicates evaluate against.
 * `overrides` lets claimDailyLogin pass post-update values (new streak/level/
 * unlockedClasses/totalSeasons) that aren't in profileData yet during its
 * transaction.
 */
/**
 * @param {ProfileData} profileData
 * @param {StateOverrides} [overrides]
 */
function buildAchievementState(profileData, overrides = {}) {
  const corps = profileData.corps || {};
  const hasFullLineup = Object.values(corps).some(
    (c) => c && c.lineup && Object.keys(c.lineup).length === 8
  );
  /** @type {Record<string, number>} */
  const classRanks = {};
  Object.entries(profileData.classRanks || {}).forEach(([cls, snapshot]) => {
    if (snapshot && typeof snapshot.rank === 'number') classRanks[cls] = snapshot.rank;
  });
  const trophies = profileData.trophies || {};
  // Live-season shows: selectedShows week-count per corps, the same
  // "showsAttended" notion season archival folds into lifetimeStats.
  const currentSeasonShows = Object.values(corps).reduce(
    (sum, c) => sum + Object.keys(c?.selectedShows || {}).length,
    0
  );
  // Podium is a different game, so its seasons and shows must fold into the
  // shared career milestones. Seasons overlap the fantasy count (one calendar
  // season), so union via max; shows are disjoint events (a Podium corps
  // competes on its own nights), so they add.
  const podiumSeasons = podiumSeasonsPlayed(profileData);
  const podiumShows = podiumShowsAttended(profileData);
  const storedSeasons = overrides.totalSeasons ?? profileData.lifetimeStats?.totalSeasons ?? 0;

  return {
    streak: overrides.streak ?? profileData.engagement?.loginStreak ?? 0,
    level: overrides.level ?? profileData.xpLevel ?? 1,
    unlockedClasses: overrides.unlockedClasses ?? profileData.unlockedClasses ?? ['soundSport'],
    hasFullLineup,
    totalShows: (profileData.lifetimeStats?.totalShows || 0) + podiumShows,
    currentSeasonShows,
    totalSeasons: Math.max(storedSeasons, podiumSeasons),
    leagueWins: profileData.stats?.leagueWins || 0,
    inLeague: (profileData.leagueIds || []).length > 0,
    classRanks,
    regionalTrophies: (trophies.regionals || []).length,
    classChampionships: (trophies.classChampionships || []).length,
    championships: (trophies.championships || []).length,
    // Podium display copy the boundary sweep writes onto the profile.
    podiumSeasons,
    podiumDivision: corps.podiumClass?.division || null,
    // Archived-season results: bestSeasonPlacement, climbedPlacement,
    // maxSeasonShows, maxClassesInSeason.
    ...seasonPerformance(profileData),
  };
}

/**
 * Return catalog achievements the profile has newly earned (not yet in
 * profileData.achievements), as ready-to-store objects.
 */
/**
 * @param {ProfileData} profileData
 * @param {StateOverrides} [overrides]
 */
function sweepProfileAchievements(profileData, overrides = {}) {
  const state = buildAchievementState(profileData, overrides);
  const existingIds = new Set(
    (profileData.achievements || []).map((/** @type {{id: string}} */ a) => a.id)
  );
  const earnedAt = new Date().toISOString();

  return ACHIEVEMENT_CATALOG.filter((a) => !existingIds.has(a.id) && a.earned(state)).map(
    (a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity,
      ccReward: a.ccReward,
      earnedAt,
    })
  );
}

/**
 * State-driven cosmetic grants, applied by the daily sweep in claimDailyLogin
 * alongside achievements. Idempotent via cosmetics.owned.
 *
 * Currently one grant: the 'Earned, Not Given' title for unlocking any
 * competition class EARLY via XP level (classUnlockPaths.* === 'xp') — the
 * recognition-asymmetry mark seasons/coin/backstop unlocks never get.
 *
 * @param {ProfileData} profileData - profile snapshot
 * @param {StateOverrides} [overrides] - { classUnlockPaths } computed post-update
 *   during the caller's transaction
 * @returns {string[]} shop item ids to arrayUnion into cosmetics.owned
 */
function sweepCosmeticGrants(profileData, overrides = {}) {
  const owned = new Set(profileData.cosmetics?.owned || []);
  const unlockPaths = overrides.classUnlockPaths ?? profileData.classUnlockPaths ?? {};
  const grants = [];
  if (
    Object.values(unlockPaths).some((path) => path === 'xp') &&
    !owned.has('title_earned_not_given')
  ) {
    grants.push('title_earned_not_given');
  }
  return grants;
}

module.exports = {
  ACHIEVEMENT_CATALOG,
  RARITY_CC,
  SEASON_PERFORMANCE,
  buildAchievementState,
  seasonPerformance,
  sweepProfileAchievements,
  sweepCosmeticGrants,
  podiumSeasonsPlayed,
  podiumShowsAttended,
  reconciledTotalSeasons,
};
