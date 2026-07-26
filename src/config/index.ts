// =============================================================================
// APPLICATION CONFIGURATION
// =============================================================================
// Centralized configuration that can be overridden via environment variables.
// This eliminates hardcoded values and makes the app more configurable.
//
// Environment Variables (set in .env or deployment):
// - VITE_DATA_NAMESPACE: Override default data namespace
// - VITE_APP_NAME: Override app name
// - VITE_SUPPORT_EMAIL: Support email address
// - VITE_FIREBASE_* : Firebase configuration

import { CAPTION_IDS, CAPTION_NAMES } from '../data/captions';

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================
// Production builds fail fast on a missing Firebase config; dev builds log a
// clear error instead (no throw, so the dev server still boots) — otherwise a
// blank .env.local surfaces only as cryptic Firebase "invalid-api-key" errors.

{
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const;

  const missingVars = requiredEnvVars.filter((varName) => !import.meta.env[varName]);

  if (missingVars.length > 0) {
    if (import.meta.env.MODE === 'production') {
      throw new Error(
        `Missing required environment variables in production: ${missingVars.join(', ')}`
      );
    }
    console.error(
      `[config] Missing required Firebase environment variables: ${missingVars.join(', ')}.\n` +
        'Firebase will not initialize correctly. Copy .env.local.example to ' +
        '.env.local and fill in your Firebase web-app config.'
    );
  }
}

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

// NOTE: admin status is intentionally NOT configured client-side. It is
// determined solely by the server-set `admin` custom claim on the auth token
// (see authApi.isAdmin in src/api/client.ts). A client-visible UID list was
// both an information leak and a spoofable signal.

// =============================================================================
// FIREBASE CONFIGURATION
// =============================================================================

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const;

// App Check (reCAPTCHA v3/Enterprise) attestation. Entirely opt-in: App Check
// initializes ONLY when a site key is provided, so builds without the key
// behave exactly as before. This enables a safe, monitor-only rollout — ship
// the key, watch the App Check metrics in the Firebase console, and flip
// enforcement on the backend only once legitimate traffic is verified.
// VITE_APPCHECK_DEBUG_TOKEN registers a debug token for local/emulator dev.
export const APP_CHECK_CONFIG = {
  recaptchaSiteKey: import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY || '',
  debugToken: import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || '',
  get enabled(): boolean {
    return this.recaptchaSiteKey.length > 0;
  },
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

  /** Captions in judging order (canonical source: data/captions.ts) */
  captions: CAPTION_IDS,

  /** Caption display names (canonical source: data/captions.ts) */
  captionNames: CAPTION_NAMES,

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

    /** Shows per week (regular weeks) */
    showsPerWeek: 4,

    /** Shows per week (final week) - allows more registrations during championship week */
    finalWeekShows: 7,
  },

  /** XP level thresholds */
  xpLevels: [
    0, // Level 1
    100, // Level 2
    250, // Level 3
    500, // Level 4
    1000, // Level 5
    2000, // Level 6
    3500, // Level 7
    5000, // Level 8
    7500, // Level 9
    10000, // Level 10
    15000, // Level 11+
  ],
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
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

export type CorpsClass = (typeof GAME_CONFIG.corpsClasses)[number];
export type Caption = (typeof GAME_CONFIG.captions)[number];
