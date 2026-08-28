// =============================================================================
// STUDIO SECTIONS — the editor's section registry
// =============================================================================
// Single source of truth for the Studio's addressable sections: the mobile
// tab strip, the editor's section wrappers, and the canvas tap-region overlay
// all key off this list so they can never drift apart. Order here is the
// order sections render in the editor (head → feet, with presets and the
// colorway first — the "start broad, then refine" flow).

export const STUDIO_SECTIONS = [
  { id: 'presets', label: 'Presets' },
  { id: 'colorway', label: 'Colors' },
  { id: 'headwear', label: 'Head' },
  { id: 'torso', label: 'Torso' },
  { id: 'chest', label: 'Chest' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'waist', label: 'Waist' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'feet', label: 'Feet' },
] as const;

export type StudioSectionId = (typeof STUDIO_SECTIONS)[number]['id'];

/** The mobile tab strip appends the wardrobe as a pseudo-section. */
export type StudioTabId = StudioSectionId | 'wardrobe';

/** DOM id for a section wrapper — the tap overlay and tabs scroll to these. */
export function sectionAnchorId(id: string): string {
  return `studio-section-${id}`;
}
