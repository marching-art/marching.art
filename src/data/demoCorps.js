/**
 * Demo Corps Data - Sample corps for Guest Preview Mode
 *
 * Provides realistic sample data for unauthenticated visitors to experience the
 * dashboard before registering. The demo mirrors what a brand-new director
 * actually gets: a SoundSport corps. SoundSport is the only class unlocked by
 * default (A Class needs Level 3, Open Class Level 5, World Class Level 10), it
 * drafts under a 90-point budget, and it is a ratings-only format — shows earn
 * a Gold/Silver/Bronze medal rating and "Best in Show" wins rather than a
 * numeric rank or cumulative season score.
 *
 * Scores here are generated with the SAME formula the backend uses
 * (functions/src/helpers/scoring.js) so the demo never shows numbers the real
 * game could not produce.
 */

// =============================================================================
// SCORING MODEL (mirrors functions/src/helpers/scoring.js)
// =============================================================================
// Each caption is scored out of 20. The show total is:
//   geScore     = GE1 + GE2                  (max 40)
//   visualScore = (VP + VA + CG) / 2         (max 30)
//   musicScore  = (B + MA + P) / 2           (max 30)
//   totalScore  = min(100, ge + visual + music)
// SoundSport shares this math; only its *presentation* (medal ratings) differs.

/** Sum the GE / Visual / Music category totals from a caption map. */
export function computeCategoryTotals(captions) {
  const geScore = (captions.GE1 || 0) + (captions.GE2 || 0);
  const visualScore = ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2;
  const musicScore = ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2;
  return { geScore, visualScore, musicScore };
}

/** Compute the capped show total (<= 100) from a caption map. */
export function computeShowTotal(captions) {
  const { geScore, visualScore, musicScore } = computeCategoryTotals(captions);
  return Math.round(Math.min(100, geScore + visualScore + musicScore) * 100) / 100;
}

// =============================================================================
// DEMO CORPS CONFIGURATION (SoundSport)
// =============================================================================

// Representative recent show, used to derive the corps' category totals and
// medal rating. Every caption is a plausible <=20 value for a strong SoundSport
// corps.
const DEMO_LATEST_CAPTIONS = {
  GE1: 18.4,
  GE2: 18.5,
  VP: 18.1,
  VA: 18.2,
  CG: 18.0,
  B: 18.3,
  MA: 18.4,
  P: 18.2,
};

const DEMO_LATEST_TOTAL = computeShowTotal(DEMO_LATEST_CAPTIONS); // 91.5 -> Gold

export const DEMO_CORPS = {
  corpsName: 'River City Regiment',
  location: 'Austin, TX',
  description: 'A community-built SoundSport corps chasing its first gold rating',
  corpsClass: 'soundSport',
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },

  // Uniform Design (for display)
  uniformDesign: {
    primaryColor: 'midnight blue',
    secondaryColor: 'gold',
    accentColor: 'silver trim',
    style: 'contemporary',
    helmetStyle: 'shako',
    plumeDescription: 'tall gold horsehair plume',
    mascotOrEmblem: 'ambassador shield with crossed horns',
    performanceStyle: 'powerful and precise',
  },

  // SoundSport is ratings-only: the medal rating comes from the best show score,
  // and Best in Show counts shows won outright. There is no numeric rank or
  // cumulative "season score" for SoundSport.
  seasonHighScore: DEMO_LATEST_TOTAL,
  showsAttended: 6,
  bestInShowCount: 2,
  lastRehearsalDate: new Date().toISOString().split('T')[0],
  rehearsalsToday: 0,

  // Demo lineup: 8 captions drafted from value-priced historical corps, the way
  // a SoundSport roster is built inside the 90-point budget. Format is
  // "Corps Name|Year" to match the real active-lineup slot format.
  lineup: {
    GE1: 'Blue Stars|2017',
    GE2: 'The Academy|2019',
    VP: 'Mandarins|2022',
    VA: 'Colts|2018',
    CG: 'Spirit of Atlanta|2019',
    B: 'Boston Crusaders|2016',
    MA: 'Blue Knights|2019',
    P: 'Pacific Crest|2018',
  },

  // Per-corps show concept (drives the nightly show-design CorpsCoin bonus).
  // Structured shape: { showName, theme, musicSource, drillStyle }.
  showConcept: {
    showName: 'Rivers of Sound',
    theme: 'cinematic',
    musicSource: 'film',
    drillStyle: 'curvilinear',
  },

  // Registered shows, keyed by `week{n}` to match the real schedule structure
  // (see docs/SCHEDULE_SYSTEM.md). Directors pick up to 4 shows per week.
  selectedShows: {
    week4: [
      {
        eventName: 'Heartland Classic',
        date: 'July 1, 2026',
        location: 'Des Moines, IA',
        day: 24,
      },
    ],
    week5: [
      {
        eventName: 'Rocky Mountain Invitational',
        date: 'July 8, 2026',
        location: 'Denver, CO',
        day: 31,
      },
    ],
  },
};

// =============================================================================
// DEMO PROFILE DATA
// =============================================================================

export const DEMO_PROFILE = {
  uid: 'demo_user',
  username: 'demo_director',
  displayName: 'Demo Director',
  email: 'demo@example.com',

  // XP & Progression
  xp: 4250,
  xpLevel: 8,
  userTitle: 'Rising Star',

  // Currency
  corpsCoin: 1200,

  // Level 8 unlocks SoundSport, A Class (L3), and Open Class (L5). World Class
  // stays locked until Level 10. Keys are canonical (matches profile.corps and
  // CORPS_CLASS_ORDER).
  unlockedClasses: ['soundSport', 'aClass', 'openClass'],

  // Corps data keyed by canonical class ids. The director is competing their
  // SoundSport corps; higher-class slots are still open.
  corps: {
    soundSport: DEMO_CORPS,
    aClass: undefined,
    openClass: undefined,
    worldClass: undefined,
  },

  // Stats
  stats: {
    seasonsPlayed: 3,
    goldRatings: 4,
    bestInShowWins: 5,
    leagueWins: 1,
  },

  // Lifetime stats
  lifetimeStats: {
    totalSeasons: 3,
    totalShows: 36,
    goldRatings: 4,
    bestInShowWins: 5,
    leagueChampionships: 1,
    totalCorpsRetired: 2,
  },

  // Engagement (sample data)
  engagement: {
    loginStreak: 5,
    lastLogin: new Date().toISOString(),
    totalLogins: 47,
    recentActivity: [
      {
        type: 'show_result',
        description: 'Earned a Gold rating at Rocky Mountain Invitational',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        xp: 25,
      },
      {
        type: 'rehearsal',
        description: 'Completed daily rehearsal',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        xp: 10,
      },
    ],
  },

  // Sample achievements
  achievements: [
    {
      id: 'first_corps',
      title: 'First Steps',
      description: 'Registered your first corps',
      icon: 'trophy',
      rarity: 'common',
      earnedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'winning_streak',
      title: 'On Fire',
      description: 'Won 3 league matchups in a row',
      icon: 'flame',
      rarity: 'rare',
      earnedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ],
};

// =============================================================================
// DEMO SEASON DATA
// =============================================================================
// The off-season runs a 49-day / 7-week fantasy calendar built from historical
// DCI data (see docs/SCHEDULE_SYSTEM.md). getSeasonProgress() caps the day at 49 and
// the week at 7, so those bounds must hold here too.

export const DEMO_SEASON = {
  seasonUid: 'adagio_2025-26',
  name: 'adagio_2025-26',
  status: 'off-season',
  seasonType: 'off-season',
  seasonNumber: 1,
  year: 2026,
  currentDay: 31,
  currentWeek: 5, // ceil(31 / 7)
  totalDays: 49,
  totalWeeks: 7,
  currentPointCap: 150, // season-wide cap; per-class caps (SoundSport 90) apply within
  registrationOpen: true,
  schedule: {
    startDate: { seconds: Date.now() / 1000 - 30 * 86400, nanoseconds: 0 },
    endDate: { seconds: Date.now() / 1000 + 18 * 86400, nanoseconds: 0 },
    weeksRemaining: 3,
  },
};

// =============================================================================
// DEMO CORPS STATS (category totals for the most recent show)
// =============================================================================
// geScore is the GE1+GE2 total (max 40); visual/music are the halved category
// totals (max 30 each) — matching the backend's scoring output shape.

export const DEMO_CORPS_STATS = {
  totalScore: DEMO_LATEST_TOTAL,
  showCount: 6,
  ...computeCategoryTotals(DEMO_LATEST_CAPTIONS),
  bestInShowCount: 2,
  rating: 'Gold',
  trend: 'up',
};

// =============================================================================
// DEMO RECENT SCORES (SoundSport — presented as medal ratings)
// =============================================================================
// Totals are derived from the caption maps with computeShowTotal so they match
// the real scoring formula (and the medal thresholds) exactly.

export const DEMO_RECENT_SCORES = [
  {
    showId: 'show_031',
    showName: 'Rocky Mountain Invitational',
    date: new Date(Date.now() - 86400000).toISOString(),
    day: 31,
    captions: DEMO_LATEST_CAPTIONS,
  },
  {
    showId: 'show_024',
    showName: 'Heartland Classic',
    date: new Date(Date.now() - 7 * 86400000).toISOString(),
    day: 24,
    captions: { GE1: 18.1, GE2: 18.2, VP: 17.8, VA: 17.9, CG: 17.7, B: 18.0, MA: 18.1, P: 17.9 },
  },
  {
    showId: 'show_017',
    showName: 'Prairie State Preview',
    date: new Date(Date.now() - 14 * 86400000).toISOString(),
    day: 17,
    captions: { GE1: 17.9, GE2: 18.0, VP: 17.6, VA: 17.7, CG: 17.5, B: 17.8, MA: 17.9, P: 17.7 },
  },
].map((show) => ({ ...show, score: computeShowTotal(show.captions) }));

// =============================================================================
// DEMO RIVALS (closest competitors — populated daily by scheduledRivalsUpdate)
// =============================================================================
// SoundSport rivals are compared by medal tier (ratings-only), matching the
// real RivalsPanel's SoundSport branch. userMedalRank is the demo director's
// standing so the panel can render the relative arrow.

export const DEMO_RIVALS = [
  {
    uid: 'demo_rival_1',
    corpsName: 'Lone Star Cadets',
    username: 'txdirector',
    corpsClass: 'soundSport',
    medal: 'Gold',
    medalRank: 1,
    userMedalRank: 2,
  },
  {
    uid: 'demo_rival_2',
    corpsName: 'Gulf Coast Sound',
    username: 'coastdrums',
    corpsClass: 'soundSport',
    medal: 'Gold',
    medalRank: 3,
    userMedalRank: 2,
  },
  {
    uid: 'demo_rival_3',
    corpsName: 'Hill Country Brass',
    username: 'hcbrass',
    corpsClass: 'soundSport',
    medal: 'Silver',
    medalRank: 5,
    userMedalRank: 2,
  },
];

// =============================================================================
// DEMO SCHEDULE (upcoming shows)
// =============================================================================
// SoundSport corps compete at regular off-season shows and are auto-enrolled in
// the SoundSport International Music & Food Festival on Day 49 (see
// docs/SCHEDULE_SYSTEM.md).

export const DEMO_UPCOMING_SHOWS = [
  {
    showId: 'upcoming_036',
    eventName: 'Great Plains SoundSport Showcase',
    location: 'Kansas City, MO',
    date: new Date(Date.now() + 5 * 86400000).toISOString(),
    day: 36,
    classes: ['soundSport', 'aClass', 'openClass', 'worldClass'],
    isSelected: true,
  },
  {
    showId: 'upcoming_043',
    eventName: 'Prairie Capital Invitational',
    location: 'Springfield, IL',
    date: new Date(Date.now() + 12 * 86400000).toISOString(),
    day: 43,
    classes: ['soundSport', 'aClass', 'openClass'],
    isSelected: false,
  },
  {
    showId: 'upcoming_049',
    eventName: 'SoundSport International Music & Food Festival',
    location: 'Indianapolis, IN',
    date: new Date(Date.now() + 18 * 86400000).toISOString(),
    day: 49,
    classes: ['soundSport'],
    isChampionship: true,
    isSelected: false,
  },
];
