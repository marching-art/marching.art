/**
 * Demo Corps Data - Sample corps for Guest Preview Mode
 *
 * This provides realistic sample data for unauthenticated users to experience
 * the dashboard before registering. The demo corps is a fully-populated
 * World Class corps with real-looking scores and lineup data.
 */

// =============================================================================
// DEMO CORPS CONFIGURATION
// =============================================================================

export const DEMO_CORPS = {
  corpsName: 'The Ambassadors',
  location: 'Houston, TX',
  description: 'A legacy corps built on precision and power',
  corpsClass: 'world',
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

  // Season stats (impressive but realistic)
  totalSeasonScore: 847.65,
  showsAttended: 12,
  seasonHighScore: 92.45,
  lastRehearsalDate: new Date().toISOString().split('T')[0],
  rehearsalsToday: 0,

  // Demo lineup with historical DCI caption selections
  // Format: "Corps Name|Year" (matches real lineup slot format)
  lineup: {
    GE1: 'Blue Devils|2014',
    GE2: 'Carolina Crown|2013',
    VP: 'Santa Clara Vanguard|2018',
    VA: 'Bluecoats|2019',
    CG: 'Carolina Crown|2015',
    B: 'The Cavaliers|2002',
    MA: 'Blue Devils|2017',
    P: 'Santa Clara Vanguard|2022',
  },

  // Show selections for demo
  selectedShows: {
    '1': ['show_001', 'show_002'],
    '2': ['show_003', 'show_004'],
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

  // Unlocks (all classes unlocked for demo)
  unlockedClasses: ['soundSport', 'aClass', 'open', 'world'],

  // Corps data
  corps: {
    soundSport: undefined,
    aClass: undefined,
    open: undefined,
    world: DEMO_CORPS,
  },

  // Stats
  stats: {
    seasonsPlayed: 3,
    championships: 0,
    topTenFinishes: 2,
    leagueWins: 1,
  },

  // Lifetime stats
  lifetimeStats: {
    totalPoints: 12450,
    totalSeasons: 3,
    totalShows: 36,
    bestSeasonScore: 892.15,
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
        description: 'Earned 72.45 pts at San Antonio Regional',
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

export const DEMO_SEASON = {
  seasonUid: 'demo_season_2025',
  seasonType: 'live',
  seasonNumber: 1,
  year: 2025,
  currentWeek: 8,
  currentDay: 52,
  totalWeeks: 12,
  registrationOpen: true,
  schedule: {
    startDate: { seconds: Date.now() / 1000 - 52 * 86400, nanoseconds: 0 },
    endDate: { seconds: Date.now() / 1000 + 28 * 86400, nanoseconds: 0 },
    weeksRemaining: 4,
  },
};

// =============================================================================
// DEMO CORPS STATS (for display in dashboard panels)
// =============================================================================

export const DEMO_CORPS_STATS = {
  totalScore: 847.65,
  showCount: 12,
  geScore: 18.25,
  visualScore: 17.80,
  musicScore: 18.15,
  placement: 4,
  weeklyChange: '+2.35',
  trend: 'up',
};

// =============================================================================
// DEMO RECENT SCORES (for standings panel)
// =============================================================================

export const DEMO_RECENT_SCORES = [
  {
    showId: 'show_012',
    showName: 'San Antonio Regional',
    date: new Date(Date.now() - 86400000).toISOString(),
    score: 92.45,
    placement: 3,
    captions: { GE1: 18.5, GE2: 18.3, VP: 17.9, VA: 18.1, CG: 17.8, B: 18.2, MA: 18.4, P: 18.25 },
  },
  {
    showId: 'show_011',
    showName: 'Houston Classic',
    date: new Date(Date.now() - 7 * 86400000).toISOString(),
    score: 91.20,
    placement: 4,
    captions: { GE1: 18.2, GE2: 18.1, VP: 17.7, VA: 17.9, CG: 17.6, B: 18.0, MA: 18.2, P: 18.1 },
  },
  {
    showId: 'show_010',
    showName: 'Austin Showcase',
    date: new Date(Date.now() - 14 * 86400000).toISOString(),
    score: 89.85,
    placement: 5,
    captions: { GE1: 17.9, GE2: 17.8, VP: 17.5, VA: 17.7, CG: 17.4, B: 17.8, MA: 18.0, P: 17.85 },
  },
];

// =============================================================================
// DEMO SCHEDULE (upcoming shows)
// =============================================================================

export const DEMO_UPCOMING_SHOWS = [
  {
    showId: 'upcoming_001',
    eventName: 'Dallas Championship',
    location: 'Dallas, TX',
    date: new Date(Date.now() + 3 * 86400000).toISOString(),
    classes: ['world', 'open'],
    isSelected: true,
  },
  {
    showId: 'upcoming_002',
    eventName: 'Southwest Regional',
    location: 'Phoenix, AZ',
    date: new Date(Date.now() + 10 * 86400000).toISOString(),
    classes: ['world', 'open', 'aClass'],
    isSelected: false,
  },
  {
    showId: 'upcoming_003',
    eventName: 'DCI Southwestern Championship',
    location: 'San Antonio, TX',
    date: new Date(Date.now() + 17 * 86400000).toISOString(),
    classes: ['world'],
    isFinals: false,
    isSelected: false,
  },
];

// =============================================================================
// DEMO LEADERBOARD POSITION
// =============================================================================

export const DEMO_LEADERBOARD_POSITION = {
  rank: 47,
  totalUsers: 2847,
  percentile: 98.3,
  pointsBehindNext: 12.5,
  pointsAheadPrevious: 8.2,
};
