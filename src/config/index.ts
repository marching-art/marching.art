// =============================================================================
// APPLICATION CONFIGURATION
// =============================================================================
// Centralized configuration that can be overridden via environment variables.
// This eliminates hardcoded values and makes the app more configurable.
//
// Environment Variables (set in .env or deployment):
// - VITE_ADMIN_UID: Override default admin user ID
// - VITE_DATA_NAMESPACE: Override default data namespace
// - VITE_APP_NAME: Override app name
// - VITE_SUPPORT_EMAIL: Support email address
// - VITE_FIREBASE_* : Firebase configuration

// =============================================================================
// APP CONFIGURATION
// =============================================================================

export const APP_CONFIG = {
  /** Application name */
  name: import.meta.env.VITE_APP_NAME || 'marching.art',

  /** Application tagline */
  tagline: 'The Ultimate Fantasy Drum Corps Game',

  /** Support email */
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@marching.art',

  /** Current year for copyright */
  copyrightYear: new Date().getFullYear(),
} as const;

// =============================================================================
// DATA CONFIGURATION
// =============================================================================

export const DATA_CONFIG = {
  /** Firestore data namespace/artifact path */
  namespace: import.meta.env.VITE_DATA_NAMESPACE || 'marching-art',

  /** Artifacts base path in Firestore */
  artifactsPath: `artifacts/${import.meta.env.VITE_DATA_NAMESPACE || 'marching-art'}`,
} as const;

// =============================================================================
// AUTH CONFIGURATION
// =============================================================================

export const AUTH_CONFIG = {
  /**
   * Admin user ID(s)
   * Can be a single UID or comma-separated list
   * Falls back to hardcoded value if not set (for backwards compatibility)
   */
  adminUids: (import.meta.env.VITE_ADMIN_UIDS || 'o8vfRCOevjTKBY0k2dISlpiYiIH2')
    .split(',')
    .map((uid: string) => uid.trim()),

  /** Check if a UID is an admin */
  isAdminUid: (uid: string): boolean => {
    return AUTH_CONFIG.adminUids.includes(uid);
  },
} as const;

// =============================================================================
// FIREBASE CONFIGURATION
// =============================================================================

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'marching-art.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'marching-art',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'marching-art.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '278086562126',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:278086562126:web:f7737ee897774c3d9a6e1f',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-H0KE8GJS7M',
} as const;

// =============================================================================
// GAME CONFIGURATION
// =============================================================================

export const GAME_CONFIG = {
  /** Corps classes in order of progression */
  corpsClasses: ['soundSport', 'aClass', 'open', 'world'] as const,

  /** Class display names */
  classNames: {
    soundSport: 'SoundSport',
    aClass: 'A Class',
    open: 'Open Class',
    world: 'World Class',
  } as const,

  /** Class colors for UI */
  classColors: {
    soundSport: 'green',
    aClass: 'blue',
    open: 'purple',
    world: 'gold',
  } as const,

  /** Captions in judging order */
  captions: ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'] as const,

  /** Caption display names */
  captionNames: {
    GE1: 'General Effect 1',
    GE2: 'General Effect 2',
    VP: 'Visual Proficiency',
    VA: 'Visual Analysis',
    CG: 'Color Guard',
    B: 'Brass',
    MA: 'Music Analysis',
    P: 'Percussion',
  } as const,

  /** Initial corps coin for new users */
  initialCorpsCoin: 1000,

  /** Initial XP level */
  initialXpLevel: 1,

  /** Default unlocked classes for new users */
  defaultUnlockedClasses: ['soundSport'] as const,

  /** Season configuration */
  season: {
    /** Total weeks in a season */
    totalWeeks: 7,

    /** Game day reset hour (2 AM) */
    resetHour: 2,

    /** Shows per week */
    showsPerWeek: 4,
  },

  /** XP level thresholds */
  xpLevels: [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    1000,   // Level 5
    2000,   // Level 6
    3500,   // Level 7
    5000,   // Level 8
    7500,   // Level 9
    10000,  // Level 10
    15000,  // Level 11+
  ],
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
  /** Enable battle pass system */
  battlePass: import.meta.env.VITE_FEATURE_BATTLE_PASS !== 'false',

  /** Enable staff marketplace */
  staffMarketplace: import.meta.env.VITE_FEATURE_STAFF_MARKETPLACE !== 'false',

  /** Enable leagues */
  leagues: import.meta.env.VITE_FEATURE_LEAGUES !== 'false',

  /** Enable PWA install prompt */
  pwaPrompt: import.meta.env.VITE_FEATURE_PWA_PROMPT !== 'false',

  /** Enable tutorial for new users */
  tutorial: import.meta.env.VITE_FEATURE_TUTORIAL !== 'false',

  /** Enable analytics */
  analytics: import.meta.env.VITE_FEATURE_ANALYTICS !== 'false',
} as const;

// =============================================================================
// DEVELOPMENT CONFIGURATION
// =============================================================================

export const DEV_CONFIG = {
  /** Use Firebase emulators */
  useEmulators: import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true',

  /** Emulator ports */
  emulators: {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    storage: 9199,
  },

  /** Enable verbose logging */
  verboseLogging: import.meta.env.DEV && import.meta.env.VITE_VERBOSE_LOGGING === 'true',
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CorpsClass = typeof GAME_CONFIG.corpsClasses[number];
export type Caption = typeof GAME_CONFIG.captions[number];
