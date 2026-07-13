// Types and option constants for the uniform design modal. Extracted
// verbatim from UniformDesignModal.tsx.

import type { CorpsUniformDesign, CorpsClass } from '../../types';

// =============================================================================
// TYPES
// =============================================================================

export interface CorpsOption {
  classKey: CorpsClass;
  corpsName: string;
  uniformDesign?: CorpsUniformDesign;
}

export interface UniformDesignModalProps {
  onClose: () => void;
  onSubmit: (
    design: CorpsUniformDesign,
    corpsClass: CorpsClass,
    copyToClasses?: CorpsClass[]
  ) => Promise<void>;
  currentDesign?: CorpsUniformDesign;
  corpsName: string;
  // New props for multi-corps support
  allCorps?: CorpsOption[];
  initialCorpsClass?: CorpsClass;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Covers both canonical ('worldClass'/'openClass') and legacy short
// ('world'/'open') class keys so corps resolve regardless of spelling.
export const CLASS_DISPLAY: Record<CorpsClass, { name: string; color: string }> = {
  world: { name: 'World Class', color: 'text-purple-400' },
  open: { name: 'Open Class', color: 'text-blue-400' },
  worldClass: { name: 'World Class', color: 'text-purple-400' },
  openClass: { name: 'Open Class', color: 'text-blue-400' },
  aClass: { name: 'A Class', color: 'text-green-400' },
  soundSport: { name: 'SoundSport', color: 'text-orange-400' },
  podiumClass: { name: 'Podium Class', color: 'text-brand' },
};

export const UNIFORM_STYLES = [
  {
    value: 'traditional',
    label: 'Traditional',
    description: 'Classic military-inspired with structured lines',
  },
  {
    value: 'contemporary',
    label: 'Contemporary',
    description: 'Modern design with clean aesthetics',
  },
  {
    value: 'theatrical',
    label: 'Theatrical',
    description: 'Dramatic costumes with show-themed elements',
  },
  { value: 'athletic', label: 'Athletic', description: 'Streamlined performance wear' },
  { value: 'avant-garde', label: 'Avant-Garde', description: 'Experimental and boundary-pushing' },
] as const;

export const HELMET_STYLES = [
  { value: 'shako', label: 'Shako', description: 'Tall cylindrical military cap with plume' },
  { value: 'aussie', label: 'Aussie', description: 'Wide-brimmed campaign hat' },
  { value: 'modern', label: 'Modern', description: 'Streamlined contemporary headwear' },
  { value: 'themed', label: 'Themed', description: 'Show-specific custom design' },
  { value: 'none', label: 'None', description: 'No headwear' },
] as const;

export const VENUE_OPTIONS = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'both', label: 'Both' },
] as const;

export const AVATAR_STYLES = [
  { value: 'logo', label: 'Team Logo', description: 'Emblem/badge style avatar' },
  { value: 'performer', label: 'Performer', description: 'Section member portrait' },
] as const;

export const AVATAR_SECTIONS = [
  { value: 'drumMajor', label: 'Drum Major', description: 'Leader with mace/baton' },
  { value: 'hornline', label: 'Hornline', description: 'Brass player with horn' },
  { value: 'drumline', label: 'Drumline', description: 'Percussionist with drums' },
  { value: 'colorGuard', label: 'Color Guard', description: 'Guard with flag/rifle' },
] as const;

export const COLOR_SUGGESTIONS = [
  'crimson red',
  'midnight blue',
  'emerald green',
  'royal purple',
  'burnt orange',
  'deep navy',
  'forest green',
  'burgundy',
  'charcoal gray',
  'pearl white',
  'gold',
  'silver',
  'bronze',
  'copper',
  'platinum',
  'obsidian black',
  'arctic white',
  'sunset orange',
  'ocean teal',
  'storm gray',
];
