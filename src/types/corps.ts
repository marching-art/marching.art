import { Timestamp } from 'firebase/firestore';

import type { EnsembleProfileInfo } from './user';

// =============================================================================
// CORPS TYPES
// =============================================================================

// Canonical keys ('worldClass'/'openClass') are what the data layer actually
// stores (registration, store normalization, season archives). The short keys
// ('world'/'open') are accepted for backward compatibility with older data and
// UI. Helpers in utils/corps.ts normalize between the two. podiumClass is the
// director-simulation class (no fantasy lineup; scores earned, not drafted).
export type CorpsClass =
  | 'soundSport'
  | 'aClass'
  | 'open'
  | 'world'
  | 'openClass'
  | 'worldClass'
  | 'podiumClass';

/**
 * Corps Uniform Design - Director-customizable appearance for fantasy corps
 * Used by AI to generate accurate images for news articles
 */
export interface CorpsUniformDesign {
  // Core Colors
  primaryColor: string; // e.g., "crimson red", "midnight blue", "emerald green"
  secondaryColor: string; // e.g., "gold", "silver", "white"
  accentColor?: string; // e.g., "black trim", "bronze highlights"

  // Uniform Style
  style: 'traditional' | 'contemporary' | 'theatrical' | 'athletic' | 'avant-garde';

  // Helmet/Headwear
  helmetStyle: 'shako' | 'aussie' | 'modern' | 'themed' | 'none';
  plumeDescription?: string; // e.g., "tall white horsehair plume", "flame-shaped red and orange"

  // Section-Specific Details (optional - AI will fill in if blank)
  brassDescription?: string; // e.g., "gold-lacquered with dragon engravings on bells"
  percussionDescription?: string; // e.g., "red drums with gold dragon scale graphics"
  guardDescription?: string; // e.g., "flowing crimson gowns with wing-shaped capes"

  // Corps Identity
  mascotOrEmblem?: string; // e.g., "dragon", "phoenix", "shield with crossed swords"
  themeKeywords?: string[]; // e.g., ["fire", "power", "ancient"], used for AI matching

  // Performance Context
  venuePreference?: 'outdoor' | 'indoor' | 'both';
  performanceStyle?: string; // e.g., "high-energy explosive", "elegant and refined", "mysterious and dark"

  // Additional Visual Notes (free-form for anything not covered above)
  additionalNotes?: string; // e.g., "LED elements in helmet", "capes that detach mid-show"

  // Avatar Generation Options
  avatarStyle?: 'logo' | 'performer'; // logo = team emblem, performer = section member image
  avatarSection?: 'drumMajor' | 'hornline' | 'drumline' | 'colorGuard'; // which section to feature in performer style
}

export interface CorpsData {
  corpsName: string;
  name?: string; // Legacy field
  location: string;
  description?: string;
  corpsClass: CorpsClass;
  createdAt: Timestamp;

  // Ensemble profile info (preserved across seasons)
  ensembleInfo?: EnsembleProfileInfo;

  // Per-season show concept (reset at rollover; saved via saveShowConcept).
  // Legacy profiles may carry a free-text string here — treat as unset.
  showConcept?:
    | { showName?: string | null; theme: string; musicSource: string; drillStyle: string }
    | string;

  // Uniform Design (director-customizable, preserved across seasons)
  uniformDesign?: CorpsUniformDesign;

  // Corps Avatar (AI-generated based on uniform design, preserved across seasons)
  avatarUrl?: string;
  avatarGeneratedAt?: string; // ISO timestamp of when avatar was generated

  // Season stats
  totalSeasonScore: number;
  showsAttended: number;
  seasonHighScore: number;

  // Nightly class standing, written by the scoring run (competitive classes
  // only — SoundSport is ratings-based and never ranked). "#seasonRank of
  // seasonRankOf" is the profile's standing number.
  seasonRank?: number;
  seasonRankOf?: number;

  // Execution state (simplified - just for XP tracking)
  lastRehearsalDate?: string;
  rehearsalsToday: number;

  // Show selections (keyed by week number)
  selectedShows?: Record<string, string[]>;

  // Lineup
  lineup?: Lineup;
}

export interface Lineup {
  [caption: string]: LineupSlot;
}

export interface LineupSlot {
  staffId?: string;
  staffName?: string;
  rating?: number;
}

// =============================================================================
// CAPTION TYPE
// =============================================================================

// Canonical caption union lives in data/captions.ts; re-exported here so the
// existing `Caption` import sites keep working without duplicating the list.
export type { CaptionId as Caption } from '../data/captions';
