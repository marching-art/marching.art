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
// Values come from the class-capability registry (Phase 1.1).
export {
  UNLOCK_LEVELS_GATED as CLASS_UNLOCK_LEVELS,
  UNLOCK_COSTS as CLASS_UNLOCK_COSTS,
} from '../../../utils/classRegistry';
export const CLASS_DISPLAY_NAMES = CORPS_CLASS_LABELS;

// SoundSport medal rating thresholds. The tier boundaries are canonical in
// src/utils/scoresUtils.ts getSoundSportRating (Gold ≥85 / Silver ≥75 /
// Bronze ≥65, owner-confirmed) — this table only adds the dashboard's chip
// styling. A test in scoresUtils.test.ts pins the two tables together; this
// copy once drifted (Gold 90 / Bronze 60), showing different medals for the
// same score on different pages.
export const SOUNDSPORT_RATING_THRESHOLDS = [
  { rating: 'Gold', min: 85, color: 'bg-yellow-500', textColor: 'text-black' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black' },
  { rating: 'Bronze', min: 65, color: 'bg-orange-300', textColor: 'text-black' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black' },
];

export const getSoundSportRating = (score) => {
  for (const threshold of SOUNDSPORT_RATING_THRESHOLDS) {
    if (score >= threshold.min) return threshold;
  }
  return SOUNDSPORT_RATING_THRESHOLDS[SOUNDSPORT_RATING_THRESHOLDS.length - 1];
};
