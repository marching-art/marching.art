// =============================================================================
// HEADING — the canonical type scale
// =============================================================================
// One place that defines every heading recipe, so sizes/weights/tracking/case
// stop being improvised per module (docs/VISUAL_IDENTITY_UNIFICATION.md Step 4).
//
// Typeface: Inter throughout — a single grotesque used at varied weights, the
// Swiss/architect posture that pairs with the sharp corners and flat surfaces.
// (The Tailwind `display` family is Inter; there is no separate display face.)
//
// The four levels map to how the app actually communicates hierarchy:
//   display — hero / page headline (large, tight)
//   title   — card / panel / modal title (medium)
//   section — the ubiquitous data-terminal section label (small, UPPERCASE)
//   eyebrow — micro label above content (tiny, UPPERCASE, muted)

import React from 'react';

export type HeadingLevel = 'display' | 'title' | 'section' | 'eyebrow';

// The recipes ARE the scale. Import `headingRecipes` anywhere you need the
// exact classes without the component (e.g. inside another primitive).
export const headingRecipes: Record<HeadingLevel, string> = {
  display: 'text-2xl sm:text-3xl font-bold tracking-tight text-main',
  title: 'text-lg font-bold tracking-tight text-main',
  section: 'text-sm font-bold uppercase tracking-wider text-main',
  eyebrow: 'text-xs font-bold uppercase tracking-wider text-muted',
};

const defaultTag: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'p'> = {
  display: 'h1',
  title: 'h2',
  section: 'h3',
  eyebrow: 'p',
};

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Which rung of the scale to render. */
  level?: HeadingLevel;
  /** Override the rendered element (semantics) without changing the look. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  children: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 'section',
  as,
  className = '',
  children,
  ...props
}) => {
  const Tag = (as || defaultTag[level]) as React.ElementType;
  return (
    <Tag className={`${headingRecipes[level]} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
};

export default Heading;
