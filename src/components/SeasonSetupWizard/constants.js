// SeasonSetupWizard constants and configuration

// Import consolidated utility functions
import { getCorpsClassName } from '../../utils/corps';
import { formatSeasonName } from '../../utils/season';
import { CAPTIONS as CAPTION_DEFS } from '../../data/captions';

// Re-export for backwards compatibility
export { getCorpsClassName, formatSeasonName };

// Valid classes in hierarchy order (World → Open → A → SoundSport)
export const ALL_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Registration lock levels by class
export const REGISTRATION_LOCKS = {
  worldClass: 6,
  openClass: 5,
  aClass: 4,
  soundSport: 0,
};

// Point limits by class — sourced from the canonical class-capability registry
// (utils/classRegistry) rather than re-declared here, so the wizard's budgets
// can never drift from the rest of the app or the backend registry JSON.
export { POINT_CAPS as POINT_LIMITS } from '../../utils/classRegistry';

// Class display names
export const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

// Caption definitions for lineup selection
// Wizard view of the canonical captions (data/captions.ts): id + full name +
// group label, with a wizard-specific color per group and its own descriptions.
const WIZARD_GROUP_COLORS = { ge: 'gold', vis: 'blue', mus: 'purple' };
const WIZARD_CAPTION_DESCRIPTIONS = {
  GE1: 'Overall impact and artistry',
  GE2: 'Visual and musical excellence',
  VP: 'Marching technique and execution',
  VA: 'Design and composition',
  CG: 'Equipment work and artistry',
  B: 'Horn line performance',
  MA: 'Musical composition and design',
  P: 'Battery and front ensemble',
};

export const CAPTIONS = CAPTION_DEFS.map((c) => ({
  id: c.id,
  name: c.fullName,
  category: c.groupLabel,
  color: WIZARD_GROUP_COLORS[c.group],
  description: WIZARD_CAPTION_DESCRIPTIONS[c.id],
}));

// Caption categories
export const CAPTION_CATEGORIES = ['General Effect', 'Visual', 'Music'];
