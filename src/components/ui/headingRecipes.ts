// =============================================================================
// HEADING RECIPES — the canonical type scale (shared constants)
// =============================================================================
// Split out from Heading.tsx so that Heading.tsx only exports components and
// Fast Refresh keeps working (react-refresh/only-export-components). The recipes
// ARE the scale: import `headingRecipes` anywhere you need the exact classes
// without the component (e.g. inside another primitive like Card or PageHeader).
//
// The four levels map to how the app actually communicates hierarchy:
//   display — hero / page headline (large, tight)
//   title   — card / panel / modal title (medium)
//   section — the ubiquitous data-terminal section label (small, UPPERCASE)
//   eyebrow — micro label above content (tiny, UPPERCASE, muted)

export type HeadingLevel = 'display' | 'title' | 'section' | 'eyebrow';

export const headingRecipes: Record<HeadingLevel, string> = {
  display: 'text-2xl sm:text-3xl font-bold tracking-tight text-main',
  title: 'text-lg font-bold tracking-tight text-main',
  section: 'text-sm font-bold uppercase tracking-wider text-main',
  eyebrow: 'text-xs font-bold uppercase tracking-wider text-muted',
};
