// Static onboarding data: caption definitions, category colors, the
// SoundSport point budget, wizard steps, and welcome-step feature blurbs.
// Extracted verbatim from Onboarding.jsx.

import { Star, Flag, Music, Target, Users, Trophy } from 'lucide-react';

// Caption definitions for the guided selection
export const CAPTIONS = [
  {
    id: 'GE1',
    name: 'GE1',
    fullName: 'General Effect 1',
    category: 'ge',
    description: 'Overall impact and artistry',
  },
  {
    id: 'GE2',
    name: 'GE2',
    fullName: 'General Effect 2',
    category: 'ge',
    description: 'Visual and musical excellence',
  },
  {
    id: 'VP',
    name: 'VP',
    fullName: 'Visual Proficiency',
    category: 'vis',
    description: 'Marching technique',
  },
  {
    id: 'VA',
    name: 'VA',
    fullName: 'Visual Analysis',
    category: 'vis',
    description: 'Design and composition',
  },
  {
    id: 'CG',
    name: 'CG',
    fullName: 'Color Guard',
    category: 'vis',
    description: 'Equipment work and artistry',
  },
  { id: 'B', name: 'B', fullName: 'Brass', category: 'mus', description: 'Horn line performance' },
  {
    id: 'MA',
    name: 'MA',
    fullName: 'Music Analysis',
    category: 'mus',
    description: 'Musical composition',
  },
  {
    id: 'P',
    name: 'P',
    fullName: 'Percussion',
    category: 'mus',
    description: 'Battery and front ensemble',
  },
];

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
