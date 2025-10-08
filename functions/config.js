'use strict';

/**
 * marching.art Configuration
 * Centralized configuration for optimal cost efficiency and scalability to 10,000+ users
 * 
 * Location: functions/config.js
 */

// === CORE CONSTANTS ===
const DATA_NAMESPACE = 'marching-art';
const ADMIN_USER_ID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

// === ENVIRONMENT DETECTION ===
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENVIRONMENT === 'production';
const IS_DEVELOPMENT = ENVIRONMENT === 'development';

// === PERFORMANCE OPTIMIZATION ===
const PERFORMANCE_CONFIG = {
  // Function timeout settings (cost vs reliability balance)
  TIMEOUT_LIGHT: 60,        // 1 min - auth, simple queries
  TIMEOUT_STANDARD: 180,    // 3 min - lineup validation, updates
  TIMEOUT_HEAVY: 540,       // 9 min - bulk processing, season setup
  
  // Memory allocation (critical for cost control)
  MEMORY_LIGHT: '256MB',     // Light operations
  MEMORY_STANDARD: '512MB',  // Standard operations
  MEMORY_HEAVY: '1GB',       // Heavy operations
  
  // Concurrency limits (prevent cost overruns)
  MAX_INSTANCES: IS_PRODUCTION ? 100 : 10,
  MIN_INSTANCES: IS_PRODUCTION ? 2 : 0,
  
  // Rate limiting
  RATE_LIMIT_PER_USER: 100,
  RATE_LIMIT_GLOBAL: 10000
};

// === GAME MECHANICS ===
const GAME_CONFIG = {
  // Season structure
  LIVE_SEASON_WEEKS: 10,
  OFF_SEASON_WEEKS: 7,
  TOTAL_ANNUAL_CYCLES: 6,
  
  // Corps and competition settings
  MAX_CORPS_PER_SEASON: 25,
  MAX_COMPETITIONS_PER_WEEK: 4,
  REQUIRED_CAPTIONS: ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'],
  
  // Class point limits
  CLASS_POINT_LIMITS: {
    'SoundSport': 90,
    'A Class': 60,
    'Open Class': 120,
    'World Class': 150
  },
  
  // XP thresholds
  XP_THRESHOLDS: {
    'A Class': 500,
    'Open Class': 2000,
    'World Class': 5000
  },
  
  // Currency rewards
  CORPS_COIN_REWARDS: {
    'SoundSport': 0,
    'A Class': 25,
    'Open Class': 50,
    'World Class': 100
  },
  
  // Scoring parameters
  MIN_SCORE: 60.0,
  MAX_SCORE: 100.0,
  SCORE_VARIANCE: 0.04,
  
  // Staff system
  STAFF_BONUS_CAP: 0.3,
  STAFF_EXPERIENCE_MULTIPLIER: 0.025
};

// === DCI SCORING SYSTEM ===
const DCI_SCORING_SYSTEM = {
  CAPTIONS: {
    GE1: { maxScore: 20, weight: 1.0 },
    GE2: { maxScore: 20, weight: 1.0 },
    VP: { maxScore: 20, weight: 0.5 },
    VA: { maxScore: 20, weight: 0.5 },
    CG: { maxScore: 20, weight: 0.5 },
    B: { maxScore: 20, weight: 0.5 },
    MA: { maxScore: 20, weight: 0.5 },
    P: { maxScore: 20, weight: 0.5 }
  },
  MAX_TOTAL: 100
};

// === XP & CORPSCOIN CONFIGURATION ===
const XP_CONFIG = {
  LINEUP_SAVE: 10,
  SHOW_PARTICIPATION: 25,
  WEEKLY_COMPLETION: 50,
  SEASON_COMPLETION: 200,
  STAFF_PURCHASE: 5,
  MARKETPLACE_SALE: 15
};

const CORPSCOIN_CONFIG = {
  STARTING_AMOUNT: 1000,
  WEEKLY_BONUS: 50,
  SEASON_COMPLETION_BONUS: 500,
  STAFF_RESALE_FEE: 0.1 // 10% marketplace fee
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
    FINALS: 'finals'
  }
};

// === SECURITY CONFIGURATION ===
const SECURITY_CONFIG = {
  // Rate limits (requests per minute)
  RATE_LIMITS: {
    LINEUP_SAVE: 10,
    STAFF_TRADE: 5,
    PROFILE_UPDATE: 10,
    SHOW_REGISTRATION: 20
  },
  
  // Anti-cheat thresholds
  MAX_DAILY_XP: 5000,
  MAX_DAILY_CORPSCOIN: 10000,
  
  // Session management
  MAX_SESSION_DURATION_HOURS: 24
};

// === DATABASE PATHS ===
const DB_PATHS = {
  // User data
  userProfile: (uid) => `artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`,
  userStaff: (uid, staffId) => `artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`,
  userNotifications: (uid) => `artifacts/${DATA_NAMESPACE}/users/${uid}/notifications`,
  userCorps: (uid, corpsId) => `artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`,
  
  // Game data
  seasonData: (seasonId) => `dci-data/${seasonId}`,
  historicalScores: (year) => `historical_scores/${year}`,
  
  // Leaderboards
  leaderboard: (seasonId) => `leaderboards/${seasonId}`,
  
  // Staff
  staffDatabase: (staffId) => `staff/${staffId}`,
  staffMarketplace: (listingId) => `staff_marketplace/${listingId}`,
  
  // Leagues
  league: (leagueId) => `leagues/${leagueId}`,
  leagueMatchups: (leagueId, week) => `leagues/${leagueId}/matchups/${week}`,
  
  // Transactions
  corpscoinTx: (uid, txId) => `corps_coin_transactions/${uid}/transactions/${txId}`,
  xpTx: (uid, txId) => `xp_transactions/${uid}/transactions/${txId}`,
  
  // Game settings
  gameSettings: () => `game-settings/current`,
  seasonConfig: (seasonId) => `season-config/${seasonId}`,
  
  // Schedules
  schedule: (seasonId) => `schedules/${seasonId}`,
  
  // Finals rankings
  finalRankings: (year) => `final_rankings/${year}`,
  
  // Seasonal scores
  seasonalScores: (seasonId) => `seasonal_scores/${seasonId}`,
  
  // Fantasy recaps
  fantasyRecaps: (seasonId) => `fantasy_recaps/${seasonId}`
};

// === UTILITY FUNCTIONS ===

/**
 * Get function configuration based on operation type
 */
const getFunctionConfig = (type = 'standard') => {
  const configs = {
    light: {
      timeoutSeconds: PERFORMANCE_CONFIG.TIMEOUT_LIGHT,
      memory: PERFORMANCE_CONFIG.MEMORY_LIGHT,
      maxInstances: Math.floor(PERFORMANCE_CONFIG.MAX_INSTANCES * 0.3)
    },
    standard: {
      timeoutSeconds: PERFORMANCE_CONFIG.TIMEOUT_STANDARD,
      memory: PERFORMANCE_CONFIG.MEMORY_STANDARD,
      maxInstances: PERFORMANCE_CONFIG.MAX_INSTANCES
    },
    heavy: {
      timeoutSeconds: PERFORMANCE_CONFIG.TIMEOUT_HEAVY,
      memory: PERFORMANCE_CONFIG.MEMORY_HEAVY,
      maxInstances: Math.floor(PERFORMANCE_CONFIG.MAX_INSTANCES * 0.2)
    }
  };
  
  return configs[type] || configs.standard;
};

/**
 * Calculate DCI total score using official methodology
 */
const calculateDCITotalScore = (captionScores) => {
  // General Effect: GE1 + GE2 (direct sum = 40 points max)
  const generalEffect = (captionScores.GE1 || 0) + (captionScores.GE2 || 0);
  
  // Visual Total: (VP + VA + CG) / 2 (30 points max)
  const visualTotal = ((captionScores.VP || 0) + (captionScores.VA || 0) + (captionScores.CG || 0)) / 2;
  
  // Music Total: (B + MA + P) / 2 (30 points max)
  const musicTotal = ((captionScores.B || 0) + (captionScores.MA || 0) + (captionScores.P || 0)) / 2;
  
  // Total DCI score (100 points max)
  return generalEffect + visualTotal + musicTotal;
};

/**
 * Validate environment configuration
 */
const validateConfig = () => {
  const requiredEnvVars = ['NODE_ENV'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate configuration consistency
  if (PERFORMANCE_CONFIG.MAX_INSTANCES < PERFORMANCE_CONFIG.MIN_INSTANCES) {
    throw new Error('MAX_INSTANCES must be greater than MIN_INSTANCES');
  }
  
  return true;
};

/**
 * Check if user is admin
 */
const isAdmin = (uid) => {
  return uid === ADMIN_USER_ID;
};

/**
 * Get environment info
 */
const getEnvironment = () => {
  return ENVIRONMENT;
};

// Run validation on import
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
}

// === EXPORTS ===
module.exports = {
  // Core constants
  DATA_NAMESPACE,
  ADMIN_USER_ID,
  
  // Environment flags
  ENVIRONMENT,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  
  // Configuration objects
  PERFORMANCE_CONFIG,
  GAME_CONFIG,
  DCI_SCORING_SYSTEM,
  XP_CONFIG,
  CORPSCOIN_CONFIG,
  SEASON_CONFIG,
  SECURITY_CONFIG,
  DB_PATHS,
  
  // Utility functions
  getFunctionConfig,
  calculateDCITotalScore,
  validateConfig,
  isAdmin,
  getEnvironment,
  
  // Convenience getters
  isProduction: () => IS_PRODUCTION,
  isDevelopment: () => IS_DEVELOPMENT,
  getNamespace: () => DATA_NAMESPACE,
  getAdminUserId: () => ADMIN_USER_ID,
  
  // Version info
  CONFIG_VERSION: '1.0.0',
  LAST_UPDATED: '2025-01-08'
};