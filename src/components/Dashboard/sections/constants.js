// Dashboard section shared constants
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and enable code-splitting

import { CORPS_CLASS_LABELS, CORPS_CLASS_SHORT_LABELS } from '../../../utils/corps';

// Class labels come from the single source in utils/corps.ts — do not
// re-declare label maps here ("A Class", never "Class A").
export const CLASS_LABELS = CORPS_CLASS_LABELS;
export const CLASS_SHORT_LABELS = CORPS_CLASS_SHORT_LABELS;

export const CAPTIONS = [
  { id: 'GE1', name: 'GE1', fullName: 'General Effect 1', category: 'ge' },
  { id: 'GE2', name: 'GE2', fullName: 'General Effect 2', category: 'ge' },
  { id: 'VP', name: 'VP', fullName: 'Visual Proficiency', category: 'vis' },
  { id: 'VA', name: 'VA', fullName: 'Visual Analysis', category: 'vis' },
  { id: 'CG', name: 'CG', fullName: 'Color Guard', category: 'vis' },
  { id: 'B', name: 'Brass', fullName: 'Brass', category: 'mus' },
  { id: 'MA', name: 'MA', fullName: 'Music Analysis', category: 'mus' },
  { id: 'P', name: 'Perc', fullName: 'Percussion', category: 'mus' },
];

// Keyed by canonical class keys (aClass/openClass/worldClass — same scheme as
// CORPS_CLASS_ORDER and profile.unlockedClasses). The backend callable
// canonicalizes, so these keys flow through the whole unlock/purchase path.
export const CLASS_UNLOCK_LEVELS = { aClass: 3, openClass: 5, worldClass: 10 };
export const CLASS_UNLOCK_COSTS = { aClass: 1000, openClass: 2500, worldClass: 5000 };
export const CLASS_UNLOCK_WEEKS = { aClass: 5, openClass: 12, worldClass: 19 };
export const CLASS_DISPLAY_NAMES = CORPS_CLASS_LABELS;

// SoundSport medal rating thresholds
export const SOUNDSPORT_RATING_THRESHOLDS = [
  { rating: 'Gold', min: 90, color: 'bg-yellow-500', textColor: 'text-black' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black' },
  { rating: 'Bronze', min: 60, color: 'bg-orange-300', textColor: 'text-black' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black' },
];

export const getSoundSportRating = (score) => {
  for (const threshold of SOUNDSPORT_RATING_THRESHOLDS) {
    if (score >= threshold.min) return threshold;
  }
  return SOUNDSPORT_RATING_THRESHOLDS[SOUNDSPORT_RATING_THRESHOLDS.length - 1];
};
