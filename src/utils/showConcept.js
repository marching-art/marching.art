// Show concept option lists — client mirror of the backend's SHOW_THEMES /
// MUSIC_SOURCES / DRILL_STYLES in functions/src/helpers/showConceptSynergy.js
// (keep values in sync; the server validates saves against its own lists).
// Shared by ShowConceptModal (dashboard) and ShowConceptStep (season setup).

export const SHOW_THEMES = [
  { value: 'classical', label: 'Classical / Orchestral' },
  { value: 'jazz', label: 'Jazz / Swing' },
  { value: 'rock', label: 'Rock / Modern' },
  { value: 'latin', label: 'Latin / World' },
  { value: 'cinematic', label: 'Cinematic / Film' },
  { value: 'abstract', label: 'Abstract / Conceptual' },
  { value: 'patriotic', label: 'Patriotic / Americana' },
  { value: 'electronic', label: 'Electronic / Synthesized' },
  { value: 'broadway', label: 'Broadway / Musical Theater' },
];

export const MUSIC_SOURCES = [
  { value: 'original', label: 'Original Composition' },
  { value: 'arranged', label: 'Arranged Classical' },
  { value: 'popular', label: 'Popular Music' },
  { value: 'film', label: 'Film Score' },
  { value: 'mixed', label: 'Mixed / Eclectic' },
];

export const DRILL_STYLES = [
  { value: 'traditional', label: 'Traditional / Symmetrical' },
  { value: 'asymmetrical', label: 'Asymmetrical / Modern' },
  { value: 'curvilinear', label: 'Curvilinear / Flowing' },
  { value: 'angular', label: 'Angular / Geometric' },
  { value: 'scatter', label: 'Scatter / Organic' },
  { value: 'dance', label: 'Dance / Movement-Heavy' },
];

/** Structured concept (legacy free-text strings don't count) */
export function isStructuredConcept(showConcept) {
  return !!(showConcept && typeof showConcept === 'object' && showConcept.theme);
}

/** "Cinematic / Film · Film Score · Curvilinear / Flowing" (null if unset) */
export function describeConceptStyle(showConcept) {
  if (!isStructuredConcept(showConcept)) return null;
  const parts = [
    SHOW_THEMES.find((t) => t.value === showConcept.theme)?.label,
    MUSIC_SOURCES.find((s) => s.value === showConcept.musicSource)?.label,
    DRILL_STYLES.find((d) => d.value === showConcept.drillStyle)?.label,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Show title from a structured concept (null for legacy strings / unset) */
export function getConceptTitle(showConcept) {
  if (!isStructuredConcept(showConcept)) return null;
  const name = showConcept.showName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}
