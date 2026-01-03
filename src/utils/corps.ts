// Corps utility functions
// Consolidated from multiple locations to prevent duplication

import type { CorpsClass } from '../types';

// =============================================================================
// CORPS CLASS ORDERING
// =============================================================================

/**
 * Canonical ordering of corps classes from highest tier to lowest.
 * This order is used consistently across the site wherever corps are displayed.
 * Order: World → Open → A → SoundSport
 */
export const CORPS_CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'] as const;

/**
 * Map of corps class to sort index for efficient sorting.
 * Lower index = higher tier class.
 */
export const CORPS_CLASS_ORDER_MAP: Record<string, number> = {
  worldClass: 0,
  openClass: 1,
  aClass: 2,
  soundSport: 3,
  // Legacy/alternate keys for compatibility
  world: 0,
  open: 1,
};

/**
 * Get the sort index for a corps class.
 * Returns 99 for unknown classes to sort them at the end.
 * @param classId - The class identifier
 * @returns Sort index (0 = highest tier)
 */
export function getCorpsClassOrderIndex(classId: string): number {
  return CORPS_CLASS_ORDER_MAP[classId] ?? 99;
}

/**
 * Compare function for sorting corps classes by tier (highest first).
 * Use with Array.sort(): classes.sort(compareCorpsClasses)
 * @param a - First class identifier
 * @param b - Second class identifier
 * @returns Negative if a should come first, positive if b should come first
 */
export function compareCorpsClasses(a: string, b: string): number {
  return getCorpsClassOrderIndex(a) - getCorpsClassOrderIndex(b);
}

/**
 * Sort an array of corps entries by class order.
 * @param entries - Array of [classId, corpsData] tuples
 * @returns Sorted array with highest tier classes first
 */
export function sortCorpsEntriesByClass<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort((a, b) => compareCorpsClasses(a[0], b[0]));
}

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
