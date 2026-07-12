// Static onboarding data: caption definitions, category colors, the
// SoundSport point budget, wizard steps, and welcome-step feature blurbs.
// Extracted verbatim from Onboarding.jsx.

import { Star, Flag, Music, Target, Users, Trophy } from 'lucide-react';
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

export const STEPS = [
  { number: 1, title: 'Welcome', icon: Star },
  { number: 2, title: 'Create Corps', icon: Flag },
  { number: 3, title: 'Build Lineup', icon: Music },
];

// Game features for the welcome step
export const GAME_FEATURES = [
  {
    icon: Target,
    title: 'Draft Your Lineup',
    description: 'Pick historical corps performances for each scoring caption',
  },
  {
    icon: Users,
    title: 'Compete in Leagues',
    description: 'Join leagues with friends and compete for bragging rights',
  },
  {
    icon: Trophy,
    title: 'Climb the Ranks',
    description: 'Earn points based on real DCI scores and top the leaderboards',
  },
];
