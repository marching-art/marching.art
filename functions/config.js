/**
 * marching.art Configuration - COMPLETE VERSION
 * Location: functions/config.js
 * 
 * Centralized configuration for all backend functions
 * Optimized for 10,000+ users with minimal Firebase costs
 */

const functions = require('firebase-functions');

// === CORE CONFIGURATION ===
const DATA_NAMESPACE = 'marching-art';
const ADMIN_USER_ID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

// === GAME CONFIGURATION ===
const GAME_CONFIG = {
  // Required DCI Captions (all 8 must be filled)
  REQUIRED_CAPTIONS: [
    "GE1", "GE2", "Visual Proficiency", "Visual Analysis",
    "Color Guard", "Brass", "Music Analysis", "Percussion"
  ],
  
  // Class-based point limits
  CLASS_POINT_LIMITS: {
    "SoundSport": 90,
    "A Class": 60,
    "Open Class": 120,
    "World Class": 150,
  },
  
  // XP requirements to unlock classes
  CLASS_XP_REQUIREMENTS: {
    "SoundSport": 0,
    "A Class": 500,
    "Open Class": 2000,
    "World Class": 5000,
  },
  
  // Initial resources for new users
  STARTING_CORPSCOIN: 1000,
  STARTING_XP: 0,
  STARTING_LEVEL: 1,
  
  // Corps naming limits
  MAX_CORPS_NAME_LENGTH: 50,
  MAX_ALIAS_LENGTH: 20,
  MAX_BIO_LENGTH: 500,
  
  // Staff limits
  MAX_STAFF_PER_USER: 20,
  STAFF_MARKETPLACE_FEE: 0.05, // 5% transaction fee
};

// === DCI SCORING SYSTEM ===
const DCI_SCORING_SYSTEM = {
  // Caption weights (total = 100 points)
  CAPTION_WEIGHTS: {
    "GE1": 20,  // General Effect 1
    "GE2": 20,  // General Effect 2
    "VP": 10,   // Visual Proficiency
    "VA": 10,   // Visual Analysis
    "CG": 10,   // Color Guard
    "B": 10,    // Brass
    "MA": 10,   // Music Analysis
    "P": 10,    // Percussion
  },
  
  // Category totals
  GE_TOTAL: 40,      // GE1 + GE2
  VISUAL_TOTAL: 30,  // (VP + VA + CG) / 2
  MUSIC_TOTAL: 30,   // (B + MA + P) / 2
  TOTAL_POSSIBLE: 100,
  
  // Caption abbreviations for database storage
  CAPTION_MAP: {
    "GE1": "GE1",
    "GE2": "GE2",
    "Visual Proficiency": "VP",
    "Visual Analysis": "VA",
    "Color Guard": "CG",
    "Brass": "B",
    "Music Analysis": "MA",
    "Percussion": "P"
  }
};

// === XP SYSTEM ===
const XP_CONFIG = {
  // XP earned for various actions
  ACTIONS: {
    FIRST_LOGIN: 50,
    COMPLETE_CORPS_SETUP: 100,
    COMPLETE_FIRST_LINEUP: 150,
    REGISTER_FOR_SHOW: 25,
    COMPLETE_SHOW: 50,
    WIN_SHOW: 100,
    REACH_FINALS: 500,
    WIN_FINALS: 1000,
    JOIN_LEAGUE: 50,
    WIN_LEAGUE_WEEK: 75,
    WIN_LEAGUE_SEASON: 300,
    HIRE_STAFF: 25,
    TRADE_STAFF: 10,
    CUSTOMIZE_UNIFORM: 20,
    INVITE_FRIEND: 100,
    DAILY_LOGIN: 10,
  },
  
  // Level progression (XP needed for each level)
  LEVEL_THRESHOLDS: [
    0, 100, 250, 450, 700, 1000, 1400, 1850, 2350, 2900,
    3500, 4150, 4850, 5600, 6400, 7250, 8150, 9100, 10100, 11150
  ],
};

// === CORPSCOIN ECONOMY ===
const CORPSCOIN_CONFIG = {
  // CorpsCoin earned for placements
  SHOW_REWARDS: {
    1: 500,   // 1st place
    2: 350,   // 2nd place
    3: 250,   // 3rd place
    4: 200,
    5: 175,
    6: 150,
    7: 125,
    8: 100,
    9: 75,
    10: 50,
  },
  
  // Finals rewards (additional)
  FINALS_BONUS: {
    1: 2000,
    2: 1500,
    3: 1200,
    4: 1000,
    5: 800,
    6: 700,
    7: 600,
    8: 500,
    9: 400,
    10: 300,
    11: 250,
    12: 200,
  },
  
  // Daily login rewards
  DAILY_LOGIN_REWARD: 25,
  WEEKLY_LOGIN_BONUS: 100,
  
  // Costs
  STAFF_BASE_COST: 500,
  UNIFORM_CUSTOMIZATION_COST: 200,
  LEAGUE_CREATION_COST: 1000,
};

// === SEASON CONFIGURATION ===
const SEASON_CONFIG = {
  LIVE_SEASON_DAYS: 70,      // 10 weeks (June-August)
  OFF_SEASON_DAYS: 49,        // 7 weeks
  SEASON_START_HOUR: 3,       // 3:00 AM ET
  TOTAL_WEEKS: 10,
  
  // Off-season themes
  SEASON_THEMES: [
    'Overture', 
    'Allegro', 
    'Adagio', 
    'Scherzo', 
    'Crescendo', 
    'Finale'
  ],
  
  // Show types
  SHOW_TYPES: {
    REGIONAL: 'regional',
    PREMIER: 'premier',
    FINALS: 'finals',
  },
};

// === SECURITY CONFIGURATION ===
const SECURITY_CONFIG = {
  // Rate limits (requests per minute)
  RATE_LIMITS: {
    LINEUP_SAVE: 10,
    STAFF_TRADE: 5,
    PROFILE_UPDATE: 10,
    SHOW_REGISTRATION: 20,
  },
  
  // Anti-cheat thresholds
  MAX_DAILY_XP: 5000,
  MAX_DAILY_CORPSCOIN: 10000,
  
  // Session management
  MAX_SESSION_DURATION_HOURS: 24,
};

// === FIREBASE FUNCTION OPTIMIZATION ===
function getFunctionConfig(type = 'default') {
  const configs = {
    // Light operations (< 1 second, < 128MB RAM)
    light: {
      timeoutSeconds: 30,
      memory: '128MB',
    },
    
    // Standard operations (1-5 seconds, 256MB RAM)
    default: {
      timeoutSeconds: 60,
      memory: '256MB',
    },
    
    // Heavy operations (5-30 seconds, 512MB RAM)
    heavy: {
      timeoutSeconds: 120,
      memory: '512MB',
    },
    
    // Scheduled jobs (up to 9 minutes, 1GB RAM)
    scheduled: {
      timeoutSeconds: 540,
      memory: '1GB',
    },
  };
  
  return configs[type] || configs.default;
}

// === DATABASE PATHS ===
const DB_PATHS = {
  // User data
  userProfile: (uid) => `artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`,
  userStaff: (uid, staffId) => `artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`,
  userNotifications: (uid) => `artifacts/${DATA_NAMESPACE}/users/${uid}/notifications`,
  
  // Game data
  seasonData: (seasonId) => `dci_data/${seasonId}`,
  corpsValues: (seasonId) => `dci_data/${seasonId}/corpsValues`,
  historicalScores: (year) => `historical_scores/${year}/data`,
  
  // Leaderboards
  leaderboard: (seasonId) => `leaderboards/${seasonId}/rankings`,
  
  // Staff
  staffDatabase: (staffId) => `staff/${staffId}`,
  staffMarketplace: (listingId) => `staff_marketplace/${listingId}`,
  
  // Leagues
  league: (leagueId) => `leagues/${leagueId}`,
  leagueMatchups: (leagueId, week) => `leagues/${leagueId}/matchups/${week}`,
  
  // Transactions
  corpscoins: (uid, txId) => `corps_coin_transactions/${uid}/transactions/${txId}`,
  xp: (uid, txId) => `xp_transactions/${uid}/transactions/${txId}`,
  
  // Game settings
  gameSettings: () => `game-settings/current`,
  seasonConfig: (seasonId) => `season-config/${seasonId}`,
};

// === EXPORTS ===
module.exports = {
  // Core
  DATA_NAMESPACE,
  ADMIN_USER_ID,
  
  // Game configuration
  GAME_CONFIG,
  DCI_SCORING_SYSTEM,
  XP_CONFIG,
  CORPSCOIN_CONFIG,
  SEASON_CONFIG,
  SECURITY_CONFIG,
  
  // Utilities
  getFunctionConfig,
  DB_PATHS,
  
  // Helper functions
  isAdmin: (uid) => uid === ADMIN_USER_ID,
  
  // Version info
  CONFIG_VERSION: '1.0.0',
  LAST_UPDATED: '2025-01-07',
};