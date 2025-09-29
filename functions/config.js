/**
 * marching.art Configuration
 * Centralized configuration for optimal cost efficiency and scalability to 10,000+ users
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
  TIMEOUT_LIGHT: 60,        // 1 min - auth, simple queries ($0.000000231/100ms)
  TIMEOUT_STANDARD: 180,    // 3 min - lineup validation, updates
  TIMEOUT_HEAVY: 540,       // 9 min - bulk processing, season setup
  
  // Memory allocation (critical for cost control)
  MEMORY_LIGHT: '256MB',     // Light operations - saves 50% on costs
  MEMORY_STANDARD: '512MB',  // Standard operations - best performance/cost ratio
  MEMORY_HEAVY: '1GB',       // Heavy operations - only when needed
  
  // Concurrency limits (prevent cost overruns)
  MAX_INSTANCES: IS_PRODUCTION ? 100 : 10,
  MIN_INSTANCES: IS_PRODUCTION ? 2 : 0,
  
  // Rate limiting (abuse prevention)
  RATE_LIMIT_PER_USER: 100,    // Requests per user per hour
  RATE_LIMIT_GLOBAL: 10000     // Total requests per hour
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
  
  // Class progression system
  CLASS_POINT_LIMITS: {
    'SoundSport': 90,
    'A Class': 60,
    'Open Class': 120,
    'World Class': 150
  },
  
  // XP progression thresholds
  XP_THRESHOLDS: {
    'A Class': 500,        // Complete first season activities
    'Open Class': 2000,    // Demonstrate consistent engagement
    'World Class': 5000    // Master competitive excellence
  },
  
  // Currency rewards by class
  CORPS_COIN_REWARDS: {
    'SoundSport': 0,
    'A Class': 25,
    'Open Class': 50,
    'World Class': 100
  },
  
  // Scoring parameters
  MIN_SCORE: 60.0,
  MAX_SCORE: 100.0,
  SCORE_VARIANCE: 0.04,    // ±4% random variance
  
  // Staff system
  STAFF_BONUS_CAP: 0.3,    // Maximum staff bonus points
  STAFF_EXPERIENCE_MULTIPLIER: 0.025
};

// === DCI SCORING SYSTEM ===
const DCI_SCORING_SYSTEM = {
  // Caption weights (exact DCI methodology)
  CAPTIONS: {
    // General Effect: 40 points total (GE1 + GE2)
    GE1: { weight: 20, max: 20 },
    GE2: { weight: 20, max: 20 },
    
    // Visual Total: 30 points ((VP + VA + CG) / 2)
    VP: { weight: 20, max: 20, divisor: 2 },  // Visual Proficiency
    VA: { weight: 20, max: 20, divisor: 2 },  // Visual Analysis
    CG: { weight: 20, max: 20, divisor: 2 },  // Color Guard
    
    // Music Total: 30 points ((B + MA + P) / 2)
    B: { weight: 20, max: 20, divisor: 2 },   // Brass
    MA: { weight: 20, max: 20, divisor: 2 },  // Music Analysis
    P: { weight: 20, max: 20, divisor: 2 }    // Percussion
  },
  
  // Class multipliers for scoring
  CLASS_MULTIPLIERS: {
    'World Class': 1.0,
    'Open Class': 0.95,
    'A Class': 0.90,
    'SoundSport': 0.85
  }
};

// === DATABASE OPTIMIZATION ===
const DATABASE_CONFIG = {
  // Batch operation limits (cost efficiency)
  MAX_BATCH_SIZE: 500,
  MAX_PARALLEL_WRITES: 10,
  
  // Query optimization (performance)
  MAX_QUERY_RESULTS: 1000,
  PAGINATION_SIZE: 50,
  
  // Cache settings (reduce reads)
  CACHE_TTL: 300,              // 5 minutes default
  LONG_CACHE_TTL: 3600,        // 1 hour for static data
  SEASON_CACHE_TTL: 86400,     // 24 hours for season data
  
  // Connection optimization
  MAX_CONNECTIONS: 10,
  CONNECTION_TIMEOUT: 30000
};

// === SECURITY CONFIGURATION ===
const SECURITY_CONFIG = {
  // Input validation limits
  MAX_STRING_LENGTH: 500,
  MAX_DISPLAY_NAME: 30,
  MAX_BIO_LENGTH: 500,
  MAX_LOCATION_LENGTH: 50,
  MAX_CORPS_NAME_LENGTH: 50,
  MAX_SHOW_CONCEPT_LENGTH: 500,
  
  // Rate limiting windows
  RATE_LIMIT_WINDOW: 3600000,      // 1 hour in milliseconds
  MAX_REQUESTS_PER_WINDOW: 1000,
  
  // Admin required functions
  ADMIN_REQUIRED_FUNCTIONS: [
    'initializeSeason',
    'processScoresManually',
    'initializeStaff',
    'updateGameSettings',
    'addStaffMember',
    'getStaffStatistics'
  ]
};

// === SCHEDULE CONFIGURATION ===
const SCHEDULE_CONFIG = {
  // Automated function timing (UTC)
  SCORE_PROCESSING_TIME: '0 2 * * *',    // 2:00 AM daily
  SEASON_CHECK_TIME: '0 3 * * *',        // 3:00 AM daily
  WEEKLY_CLEANUP_TIME: '0 4 * * 0',      // 4:00 AM Sundays
  
  // Competition schedule
  COMPETITION_SCHEDULE: [
    { week: 1, shows: ['Regional Kickoff', 'Southern Classic', 'Northern Opener'] },
    { week: 2, shows: ['Midwest Championships', 'East Coast Challenge', 'West Coast Showdown'] },
    { week: 3, shows: ['Memorial Day Classic', 'Patriot Games', 'Liberty Bell'] },
    { week: 4, shows: ['Southwestern Championship', 'Season Reset Selection', 'Eastern Classic'] },
    { week: 5, shows: ['Regional Prelims', 'State Championships', 'District Finals'] },
    { week: 6, shows: ['Open & A Class Prelims', 'World Championships Prelims'] },
    { week: 7, shows: ['World Championships Semifinals', 'SoundSport International'] },
    { week: 8, shows: ['World Championships Finals'] }
  ]
};

// === LOGGING & MONITORING ===
const MONITORING_CONFIG = {
  // Log levels by environment
  LOG_LEVEL: IS_PRODUCTION ? 'info' : 'debug',
  
  // Performance monitoring
  SLOW_QUERY_THRESHOLD: 1000,      // 1 second
  ERROR_ALERT_THRESHOLD: 10,       // Alert after 10 errors
  
  // Metrics collection
  COLLECT_PERFORMANCE_METRICS: IS_PRODUCTION,
  METRICS_SAMPLE_RATE: 0.1,        // Sample 10% of requests
  
  // Sensitive data fields (exclude from logs)
  SENSITIVE_FIELDS: ['email', 'privateData', 'auth', 'corpsCoin']
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

// Run validation on import
validateConfig();

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
  DATABASE_CONFIG,
  SECURITY_CONFIG,
  SCHEDULE_CONFIG,
  MONITORING_CONFIG,
  
  // Utility functions
  getFunctionConfig,
  calculateDCITotalScore,
  validateConfig,
  
  // Convenience getters
  isProduction: () => IS_PRODUCTION,
  isDevelopment: () => IS_DEVELOPMENT,
  getNamespace: () => DATA_NAMESPACE,
  getAdminUserId: () => ADMIN_USER_ID
};