/**
 * marching.art Configuration
 * Centralized configuration for all backend functions
 * 
 * Location: functions/config.js
 */

'use strict';

// === CORE CONFIGURATION ===
const DATA_NAMESPACE = 'marching-art';
const ADMIN_USER_ID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

// === ENVIRONMENT DETECTION ===
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// === FUNCTION RESOURCE CONFIGURATION ===
// Different tiers for different function types
const FUNCTION_CONFIGS = {
  light: {
    timeoutSeconds: 60,
    memory: '256MB',
    maxInstances: IS_PRODUCTION ? 100 : 10,
    minInstances: IS_PRODUCTION ? 2 : 0
  },
  medium: {
    timeoutSeconds: 120,
    memory: '512MB',
    maxInstances: IS_PRODUCTION ? 50 : 5,
    minInstances: IS_PRODUCTION ? 1 : 0
  },
  heavy: {
    timeoutSeconds: 540,
    memory: '1GB',
    maxInstances: IS_PRODUCTION ? 20 : 2,
    minInstances: IS_PRODUCTION ? 1 : 0
  },
  scheduled: {
    timeoutSeconds: 540,
    memory: '2GB',
    maxInstances: 1,
    minInstances: 0
  }
};

const getFunctionConfig = (type = 'light') => {
  return FUNCTION_CONFIGS[type] || FUNCTION_CONFIGS.light;
};

// === GAME MECHANICS ===
const GAME_CONFIG = {
  // Season structure
  LIVE_SEASON_WEEKS: 10,
  OFF_SEASON_WEEKS: 7,
  TOTAL_ANNUAL_CYCLES: 6,
  
  // Corps and competition settings
  MAX_CORPS_PER_SEASON: 25,
  MAX_CORPS_PER_USER: 4,
  MAX_CORPS_PER_CLASS: 1, // One corps per class per user
  MAX_COMPETITIONS_PER_WEEK: 4,
  REQUIRED_CAPTIONS: ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'],
  
  // Class point limits
  CLASS_POINT_LIMITS: {
    'SoundSport': 90,
    'A Class': 60,
    'Open Class': 120,
    'World Class': 150
  },
  
  // XP thresholds for class unlocks
  XP_THRESHOLDS: {
    'SoundSport': 0,
    'A Class': 500,
    'Open Class': 2000,
    'World Class': 5000
  },
  
  // Currency rewards per show by class
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
  STAFF_EXPERIENCE_MULTIPLIER: 0.025,
  STAFF_MARKETPLACE_FEE: 0.1 // 10% fee on marketplace sales
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
  MAX_TOTAL: 100,
  
  // Score calculation weights
  GE_WEIGHT: 0.4,      // 40 points
  VISUAL_WEIGHT: 0.3,  // 30 points
  MUSIC_WEIGHT: 0.3    // 30 points
};

// === XP & CORPSCOIN CONFIGURATION ===
const XP_CONFIG = {
  // Activity rewards
  CORPS_CREATION: 25,
  LINEUP_SAVE: 10,
  SHOW_REGISTRATION: 10,
  SHOW_PARTICIPATION: 25,
  WEEKLY_COMPLETION: 50,
  SEASON_COMPLETION: 200,
  
  // Staff and marketplace
  STAFF_PURCHASE: 5,
  MARKETPLACE_SALE: 15,
  
  // Social
  LEAGUE_JOIN: 20,
  LEAGUE_MESSAGE: 2,
  COMMENT_POST: 5,
  
  // Achievements
  FIRST_WIN: 50,
  PERFECT_LINEUP: 30,
  STAFF_COLLECTION: 100
};

const CORPSCOIN_CONFIG = {
  STARTING_AMOUNT: 1000,
  WEEKLY_BONUS: 50,
  SEASON_COMPLETION_BONUS: 500,
  STAFF_RESALE_FEE: 0.1, // 10% marketplace fee
  
  // Bonus multipliers
  CLASS_MULTIPLIERS: {
    'SoundSport': 0,
    'A Class': 1.0,
    'Open Class': 1.5,
    'World Class': 2.0
  }
};

// === SEASON CONFIGURATION ===
const SEASON_CONFIG = {
  REGISTRATION_WINDOWS: {
    'SoundSport': { openWeek: 1, closeWeek: 10 },
    'A Class': { openWeek: 1, closeWeek: 6 },
    'Open Class': { openWeek: 1, closeWeek: 5 },
    'World Class': { openWeek: 1, closeWeek: 4 }
  },
  
  // Caption change limits
  CAPTION_CHANGE_LIMITS: {
    unlimited: 5, // Weeks remaining when unlimited changes allowed
    limited: 1,   // Weeks remaining when limited to 3 per week
    finals: 0     // Finals week - 2 changes between quarters/semis, 2 between semis/finals
  },
  
  // Show schedule
  SHOWS_PER_WEEK: {
    regular: 4,
    finals: 'unlimited'
  }
};

// === UNIFORM SYSTEM ===
const UNIFORM_CONFIG = {
  FEATURE_REQUIREMENTS: {
    // Accessories
    gauntlets: { xp: 500, corpsCoin: 50 },
    epaulets: { xp: 750, corpsCoin: 100 },
    overlay: { xp: 1000, corpsCoin: 150 },
    sash: { xp: 1500, corpsCoin: 220 },
    capelets: { xp: 2500, corpsCoin: 400 },
    
    // Embellishments
    piping: { xp: 1200, corpsCoin: 180 },
    braiding: { xp: 1800, corpsCoin: 250 },
    embroidery: { xp: 3500, corpsCoin: 600 },
    appliques: { xp: 4000, corpsCoin: 750 },
    
    // Materials
    premiumFabric: { xp: 3000, corpsCoin: 500 },
    metallic: { xp: 2000, corpsCoin: 300 },
    textureRibbed: { xp: 2500, corpsCoin: 400 },
    
    // Special
    ledLighting: { xp: 5000, corpsCoin: 1000 }
  },
  
  DEFAULT_COLORS: {
    jacket: '#8B4513',
    trim: '#F7941D',
    pants: '#000000',
    stripe: '#F7941D',
    shako: '#8B4513',
    plume: '#F7941D'
  }
};

// === STAFF SYSTEM ===
const STAFF_CONFIG = {
  PRICE_CALCULATION: {
    BASE_PRICE: 100,
    YEAR_MULTIPLIER: 50, // Price increases by this much per year since induction
    MAX_YEAR: 2024,
    MIN_YEAR: 1985
  },
  
  CAPTION_BONUS: {
    BASE: 0.05,      // 5% base bonus
    PER_EXPERIENCE: 0.01, // Additional 1% per experience level
    MAX_BONUS: 0.30  // Maximum 30% bonus
  },
  
  EXPERIENCE_GAIN: {
    PER_SHOW: 1,
    PER_WIN: 2,
    PER_SEASON: 5
  }
};

// === LEAGUE SYSTEM ===
const LEAGUE_CONFIG = {
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 12,
  DEFAULT_WEEKS: 10,
  
  SCORING_MODES: {
    total: 'Total Score',
    head_to_head: 'Head to Head',
    rotisserie: 'Rotisserie'
  },
  
  PRIVACY_MODES: {
    public: 'Public',
    private: 'Private',
    invite_only: 'Invite Only'
  }
};

// === RATE LIMITING ===
const RATE_LIMITS = {
  // Per user limits
  LINEUP_SAVES_PER_HOUR: 20,
  SHOW_REGISTRATIONS_PER_HOUR: 10,
  STAFF_PURCHASES_PER_HOUR: 10,
  MARKETPLACE_LISTINGS_PER_DAY: 20,
  
  // Global limits
  FUNCTION_CALLS_PER_MINUTE: 1000,
  DATABASE_WRITES_PER_MINUTE: 500
};

// === VALIDATION RULES ===
const VALIDATION = {
  CORPS_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-'\.]+$/
  },
  
  ALIAS: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9\s\-']+$/
  },
  
  BIOGRAPHY: {
    MAX_LENGTH: 500
  },
  
  SHOW_CONCEPT: {
    MAX_LENGTH: 500
  },
  
  LOCATION: {
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s,\-\.]+$/
  }
};

// === ERROR MESSAGES ===
const ERROR_MESSAGES = {
  UNAUTHENTICATED: 'You must be logged in to perform this action',
  UNAUTHORIZED: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  INVALID_INPUT: 'Invalid input provided',
  CORPS_LIMIT_REACHED: 'You have reached the maximum number of corps (4)',
  CLASS_ALREADY_EXISTS: 'You already have a corps in this class',
  CLASS_LOCKED: 'This class is not yet unlocked. Earn more XP!',
  INSUFFICIENT_FUNDS: 'Insufficient CorpsCoin',
  INVALID_CORPS_CLASS: 'Invalid corps class specified',
  LINEUP_INVALID: 'Lineup validation failed',
  SHOW_PAST: 'Cannot register for shows that have already occurred',
  ALREADY_REGISTERED: 'Already registered for this show'
};

// === SUCCESS MESSAGES ===
const SUCCESS_MESSAGES = {
  CORPS_CREATED: 'Corps created successfully!',
  CORPS_UPDATED: 'Corps updated successfully!',
  CORPS_RETIRED: 'Corps retired successfully',
  LINEUP_SAVED: 'Lineup saved successfully!',
  STAFF_PURCHASED: 'Staff member purchased successfully!',
  STAFF_ASSIGNED: 'Staff member assigned to caption',
  STAFF_UNASSIGNED: 'Staff member unassigned from caption',
  SHOW_REGISTERED: 'Successfully registered for show!',
  SHOW_UNREGISTERED: 'Successfully unregistered from show',
  UNIFORM_SAVED: 'Uniform saved successfully!',
  FEATURE_PURCHASED: 'Feature unlocked successfully!'
};

// === ANALYTICS & LOGGING ===
const ANALYTICS_CONFIG = {
  TRACK_EVENTS: IS_PRODUCTION,
  LOG_LEVEL: IS_PRODUCTION ? 'info' : 'debug',
  
  TRACKED_EVENTS: {
    CORPS_CREATED: 'corps_created',
    LINEUP_SAVED: 'lineup_saved',
    SHOW_REGISTERED: 'show_registered',
    STAFF_PURCHASED: 'staff_purchased',
    UNIFORM_UPDATED: 'uniform_updated',
    LEAGUE_JOINED: 'league_joined'
  }
};

// === CACHING ===
const CACHE_CONFIG = {
  TTL: {
    LEADERBOARD: 300,      // 5 minutes
    SCHEDULE: 3600,        // 1 hour
    DCI_DATA: 86400,       // 24 hours
    USER_PROFILE: 60,      // 1 minute
    STAFF_LIST: 3600       // 1 hour
  }
};

// === EXPORTS ===
module.exports = {
  // Core
  DATA_NAMESPACE,
  ADMIN_USER_ID,
  IS_PRODUCTION,
  
  // Functions
  getFunctionConfig,
  FUNCTION_CONFIGS,
  
  // Game mechanics
  GAME_CONFIG,
  DCI_SCORING_SYSTEM,
  SEASON_CONFIG,
  
  // Progression
  XP_CONFIG,
  CORPSCOIN_CONFIG,
  
  // Systems
  UNIFORM_CONFIG,
  STAFF_CONFIG,
  LEAGUE_CONFIG,
  
  // Validation & Security
  VALIDATION,
  RATE_LIMITS,
  
  // Messages
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  
  // Operations
  ANALYTICS_CONFIG,
  CACHE_CONFIG
};