// Dashboard section shared constants
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and enable code-splitting

export const CLASS_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

export const CLASS_SHORT_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'Class A',
  soundSport: 'SoundSport',
};

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

export const CLASS_UNLOCK_LEVELS = { aClass: 3, open: 5, world: 10 };
export const CLASS_UNLOCK_COSTS = { aClass: 1000, open: 2500, world: 5000 };
export const CLASS_DISPLAY_NAMES = { aClass: 'A Class', open: 'Open Class', world: 'World Class' };

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
