// src/utils/captionUtils.js
// Centralized caption options and utilities for the staff system

export const CAPTION_OPTIONS = [
  { value: 'all', label: 'All Captions', color: 'bg-gray-500' },
  { value: 'GE1', label: 'General Effect 1', color: 'bg-purple-500', description: 'Directors & Program Coordinators' },
  { value: 'GE2', label: 'General Effect 2', color: 'bg-purple-400', description: 'Judges & Administrators' },
  { value: 'VP', label: 'Visual Performance', color: 'bg-blue-500', description: 'Drill Designers' },
  { value: 'VA', label: 'Visual Analysis', color: 'bg-blue-400', description: 'Visual Analysts' },
  { value: 'CG', label: 'Color Guard', color: 'bg-pink-500', description: 'Guard Designers' },
  { value: 'B', label: 'Brass', color: 'bg-yellow-500', description: 'Brass Arrangers' },
  { value: 'MA', label: 'Music Analysis', color: 'bg-green-500', description: 'Front Ensemble' },
  { value: 'P', label: 'Percussion', color: 'bg-red-500', description: 'Battery Instructors' }
];

// Caption options without the 'all' option (for forms/selects that need specific captions)
export const CAPTION_OPTIONS_NO_ALL = CAPTION_OPTIONS.filter(opt => opt.value !== 'all');

/**
 * Get the Tailwind background color class for a caption
 * @param {string} caption - The caption code (e.g., 'GE1', 'B', 'P')
 * @returns {string} The Tailwind bg-* class
 */
export const getCaptionColor = (caption) => {
  const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
  return option?.color || 'bg-gray-500';
};

/**
 * Get the full label for a caption
 * @param {string} caption - The caption code (e.g., 'GE1', 'B', 'P')
 * @returns {string} The full label (e.g., 'General Effect 1', 'Brass', 'Percussion')
 */
export const getCaptionLabel = (caption) => {
  const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
  return option?.label || caption;
};

/**
 * Get the description for a caption
 * @param {string} caption - The caption code
 * @returns {string} The description
 */
export const getCaptionDescription = (caption) => {
  const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
  return option?.description || '';
};

/**
 * Get the text color class from a background color class
 * @param {string} bgColor - The Tailwind bg-* class
 * @returns {string} The corresponding text-* class
 */
export const getTextColorFromBg = (bgColor) => {
  return bgColor.replace('bg-', 'text-');
};
