// SeasonSetupWizard constants and configuration

// Valid classes in hierarchy order (World → Open → A → SoundSport)
export const ALL_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Registration lock levels by class
export const REGISTRATION_LOCKS = {
  worldClass: 6,
  openClass: 5,
  aClass: 4,
  soundSport: 0
};

// Point limits by class
export const POINT_LIMITS = {
  soundSport: 90,
  aClass: 60,
  openClass: 120,
  worldClass: 150
};

// Class display names
export const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class'
};

// Caption definitions for lineup selection
export const CAPTIONS = [
  { id: 'GE1', name: 'General Effect 1', category: 'General Effect', color: 'gold', description: 'Overall impact and artistry' },
  { id: 'GE2', name: 'General Effect 2', category: 'General Effect', color: 'gold', description: 'Visual and musical excellence' },
  { id: 'VP', name: 'Visual Proficiency', category: 'Visual', color: 'blue', description: 'Marching technique and execution' },
  { id: 'VA', name: 'Visual Analysis', category: 'Visual', color: 'blue', description: 'Design and composition' },
  { id: 'CG', name: 'Color Guard', category: 'Visual', color: 'blue', description: 'Equipment work and artistry' },
  { id: 'B', name: 'Brass', category: 'Music', color: 'purple', description: 'Horn line performance' },
  { id: 'MA', name: 'Music Analysis', category: 'Music', color: 'purple', description: 'Musical composition and design' },
  { id: 'P', name: 'Percussion', category: 'Music', color: 'purple', description: 'Battery and front ensemble' }
];

// Caption categories
export const CAPTION_CATEGORIES = ['General Effect', 'Visual', 'Music'];

// Get display name for a class
export const getCorpsClassName = (classId) => CLASS_NAMES[classId] || classId;

// Format season name for display
export const formatSeasonName = (name) => {
  if (!name) return 'New Season';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
