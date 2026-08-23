// Static onboarding data: caption definitions, category colors, the
// SoundSport point budget, wizard steps, and welcome-step feature blurbs.
// Extracted verbatim from Onboarding.jsx.

import { Star, Flag, Music, Target, Users, Trophy, Medal, Layers } from 'lucide-react';
import { CAPTIONS as CAPTION_DEFS } from '../data/captions';

// Caption definitions for the guided selection
// Structural fields (id, fullName, group) come from the canonical caption
// source; the onboarding-specific one-line descriptions stay here. `name` is
// the caption id (compact draft slots).
const ONBOARDING_CAPTION_DESCRIPTIONS = {
  GE1: 'Overall impact and artistry',
  GE2: 'Visual and musical excellence',
  VP: 'Marching technique',
  VA: 'Design and composition',
  CG: 'Equipment work and artistry',
  B: 'Horn line performance',
  MA: 'Musical composition',
  P: 'Battery and front ensemble',
};

export const CAPTIONS = CAPTION_DEFS.map((c) => ({
  id: c.id,
  name: c.id,
  fullName: c.fullName,
  category: c.group,
  description: ONBOARDING_CAPTION_DESCRIPTIONS[c.id],
}));

export const CATEGORY_COLORS = {
  ge: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    label: 'General Effect',
  },
  vis: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    label: 'Visual',
  },
  mus: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    label: 'Music',
  },
};

// Point limit for SoundSport
export const SOUNDSPORT_POINT_LIMIT = 90;

// -----------------------------------------------------------------------------
// Dual-game onboarding
// -----------------------------------------------------------------------------
// marching.art is two games in one. Rather than steer every new director into
// SoundSport, onboarding offers the choice up front. Each mode metadata block
// drives one selectable card on the "Choose your game" step and, downstream,
// which branch of the wizard runs.

export const GAME_MODE_PODIUM = 'podium';
export const GAME_MODE_SOUNDSPORT = 'soundSport';

export const GAME_MODES = [
  {
    id: GAME_MODE_PODIUM,
    label: 'Podium Division',
    tagline: 'Run your own corps',
    icon: Medal,
    // Gold — the same accent the /podium recruiting page uses for this class.
    accent: 'podium',
    description:
      'A full season simulation. Found a corps, run daily rehearsals, route a tour, and climb to Champion Status.',
    bullets: [
      'Make the daily director calls',
      'Manage condition, staff, and budget',
      'Score against real DCI history',
    ],
    // Onboarding hands off to the four-step founding flow on the dashboard.
    cta: 'Take the podium',
  },
  {
    id: GAME_MODE_SOUNDSPORT,
    label: 'Fantasy Division',
    tagline: 'Draft a fantasy lineup',
    icon: Target,
    accent: 'interactive',
    description:
      'Fantasy drum corps. Draft historical performances for eight captions and earn points from real show scores. You start in the SoundSport class.',
    bullets: [
      'Pick 8 captions from DCI history',
      'Compete in leagues with friends',
      'Climb the global leaderboard',
    ],
    cta: 'Draft my lineup',
  },
];

// Per-step chrome (title + progress icon) for the wizard. The visible sequence
// is assembled at runtime from these by getStepSequence — it depends on whether
// Podium is enabled and which game the director picked.
export const STEP_META = {
  welcome: { id: 'welcome', title: 'Welcome', icon: Star },
  choose: { id: 'choose', title: 'Choose Game', icon: Layers },
  corps: { id: 'corps', title: 'Create Corps', icon: Flag },
  lineup: { id: 'lineup', title: 'Build Lineup', icon: Music },
  found: { id: 'found', title: 'Found Corps', icon: Medal },
};

/**
 * The ordered list of step ids the wizard shows.
 *
 * - Podium disabled: the legacy SoundSport-only flow (no choice offered).
 * - Podium enabled, no choice yet: welcome → choose.
 * - SoundSport chosen: welcome → choose → create corps → build lineup.
 * - Podium chosen: welcome → choose → found (a handoff; the four-step founding
 *   flow itself lives on the dashboard).
 *
 * @param {boolean} podiumEnabled
 * @param {string|null} gameMode
 * @returns {Array<{id: string, title: string, icon: any}>}
 */
export function getStepSequence(podiumEnabled, gameMode) {
  if (!podiumEnabled) {
    return [STEP_META.welcome, STEP_META.corps, STEP_META.lineup];
  }
  if (gameMode === GAME_MODE_SOUNDSPORT) {
    return [STEP_META.welcome, STEP_META.choose, STEP_META.corps, STEP_META.lineup];
  }
  if (gameMode === GAME_MODE_PODIUM) {
    return [STEP_META.welcome, STEP_META.choose, STEP_META.found];
  }
  return [STEP_META.welcome, STEP_META.choose];
}

// Kept for backward compatibility (the legacy SoundSport-only sequence).
export const STEPS = [
  { number: 1, title: 'Welcome', icon: Star },
  { number: 2, title: 'Create Corps', icon: Flag },
  { number: 3, title: 'Build Lineup', icon: Music },
];

// Game features for the welcome step. Kept game-neutral now that the welcome
// screen introduces a platform with two games rather than SoundSport alone —
// the specifics of each game live on the "Choose your game" step.
export const GAME_FEATURES = [
  {
    icon: Layers,
    title: 'Two divisions, one account',
    description: 'Run a corps in the Podium Division or draft a fantasy lineup in the Fantasy Division',
  },
  {
    icon: Users,
    title: 'Compete with fans worldwide',
    description: 'Join leagues, chase rivals, and top the leaderboards',
  },
  {
    icon: Trophy,
    title: 'Powered by real DCI history',
    description: 'Every score traces back to actual drum corps results',
  },
];
