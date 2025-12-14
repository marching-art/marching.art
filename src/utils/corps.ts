// Corps utility functions
// Consolidated from multiple locations to prevent duplication

import type { CorpsClass } from '../types';

// =============================================================================
// CLASS NAME MAPPING
// =============================================================================

// Supports both canonical names (open, world) and legacy names (openClass, worldClass)
const CLASS_NAMES: Record<string, string> = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class',
  // Legacy keys for backward compatibility
  openClass: 'Open Class',
  worldClass: 'World Class',
};

// =============================================================================
// CLASS COLORS
// =============================================================================

const CLASS_COLORS: Record<string, string> = {
  soundSport: 'text-green-500 bg-green-500/10 border-green-500/30',
  aClass: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  open: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  world: 'text-gold-500 bg-gold-500/10 border-gold-500/30',
  // Legacy keys for backward compatibility
  openClass: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  worldClass: 'text-gold-500 bg-gold-500/10 border-gold-500/30',
};

const DEFAULT_COLOR = 'text-cream-500 bg-cream-500/10 border-cream-500/30';

// =============================================================================
// CLASS STYLES (extended styling)
// =============================================================================

interface CorpsClassStyles {
  text: string;
  bg: string;
  border: string;
  gradient: string;
}

const CLASS_STYLES: Record<string, CorpsClassStyles> = {
  soundSport: {
    text: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    gradient: 'from-green-500 to-green-600',
  },
  aClass: {
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500 to-blue-600',
  },
  open: {
    text: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    gradient: 'from-purple-500 to-purple-600',
  },
  world: {
    text: 'text-gold-500',
    bg: 'bg-gold-500/10',
    border: 'border-gold-500/30',
    gradient: 'from-gold-500 to-gold-600',
  },
  // Legacy keys
  openClass: {
    text: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    gradient: 'from-purple-500 to-purple-600',
  },
  worldClass: {
    text: 'text-gold-500',
    bg: 'bg-gold-500/10',
    border: 'border-gold-500/30',
    gradient: 'from-gold-500 to-gold-600',
  },
};

const DEFAULT_STYLES: CorpsClassStyles = {
  text: 'text-cream-500',
  bg: 'bg-cream-500/10',
  border: 'border-cream-500/30',
  gradient: 'from-cream-500 to-cream-600',
};

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Get display name for a corps class
 * @param classId - The class identifier (e.g., 'soundSport', 'open', 'world')
 * @returns Human-readable class name (e.g., 'SoundSport', 'Open Class')
 */
export function getCorpsClassName(classId: CorpsClass | string): string {
  return CLASS_NAMES[classId] || classId;
}

/**
 * Get Tailwind CSS color classes for a corps class
 * Returns combined text, bg, and border classes
 * @param classId - The class identifier
 * @returns Tailwind CSS class string
 */
export function getCorpsClassColor(classId: CorpsClass | string): string {
  return CLASS_COLORS[classId] || DEFAULT_COLOR;
}

/**
 * Get detailed style object for a corps class
 * Useful when you need individual style components
 * @param classId - The class identifier
 * @returns Object with text, bg, border, and gradient classes
 */
export function getCorpsClassStyles(classId: CorpsClass | string): CorpsClassStyles {
  return CLASS_STYLES[classId] || DEFAULT_STYLES;
}

// Re-export type for convenience
export type { CorpsClassStyles };
