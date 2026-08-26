// =============================================================================
// DESIGN NOTES — contextual one-line design principles (docs/UNIFORM_STUDIO.md)
// =============================================================================
// Shown in the Studio as a rotating hint under the editor header, keyed to
// what the director is currently building. Principles are paraphrased from the
// craft's common wisdom and deliberately unattributed — no real designer's
// name is put on words they didn't say.

import type { FigureConfig } from '../types/uniform';

export interface DesignNote {
  /** Which figure state makes this note relevant. */
  applies: (figure: FigureConfig) => boolean;
  text: string;
}

export const DESIGN_NOTES: DesignNote[] = [
  {
    applies: (f) => Boolean(f.plume),
    text: 'The plume is your exclamation point — one clean vertical reads from the top row.',
  },
  {
    applies: (f) => f.chest === 'sash' || f.chest === 'baldric',
    text: 'A diagonal is the fastest line on the field — it makes a still body look like it is moving.',
  },
  {
    applies: (f) => Boolean(f.print),
    text: 'A print is a soloist. Give it one large stage and keep the pieces around it quiet.',
  },
  {
    applies: (f) => Boolean(f.glowArt || f.glow),
    text: 'Glow reads best against near-black. Push the base darker than feels safe indoors.',
  },
  {
    applies: (f) => Boolean(f.torsoSequin || f.sashSequin || f.baldricSequin),
    text: 'Sequins are for the back row: design the sparkle for the press box, not the mirror.',
  },
  {
    applies: (f) => {
      const legs = [f.legL, f.legR];
      return legs.some((l) => l?.flare || l?.tattered);
    },
    text: 'The hem finishes the phrase — a flare says formal, a tatter says the show got dangerous.',
  },
  {
    applies: (f) => Boolean(f.spats),
    text: 'Spats are a metronome: sixty-four pairs of white feet make time visible.',
  },
  {
    applies: (f) => f.hatType === 'aussie',
    text: 'A slouch hat carries a century of swagger — let the badge, not the brim, take the color.',
  },
  {
    applies: (f) => Boolean(f.chestFade || f.grads),
    text: 'A fade should travel with the body: light where the eye starts, deep where the line ends.',
  },
  {
    applies: (f) => f.torsoStyle === 'tunic',
    text: 'Asymmetry needs an anchor — balance a draped shoulder with something crisp at the waist.',
  },
  {
    applies: () => true,
    text: 'From the stands your corps is two inches tall. Design the silhouette first, the details second.',
  },
  {
    applies: () => true,
    text: 'Three colors, disciplined, beat six colors negotiating. Let the accent stay scarce.',
  },
  {
    applies: () => true,
    text: 'Uniforms are worn by every body in the corps — a great line flatters all of them.',
  },
  {
    applies: () => true,
    text: 'Contrast at the ankles and wrists is free choreography: it amplifies every count.',
  },
];

/**
 * Pick a context-appropriate note, deterministically: same figure state, same
 * note (no flicker between renders); different states rotate through the pool.
 */
export function designNoteFor(figure: FigureConfig): string {
  const pool = DESIGN_NOTES.filter((n) => n.applies(figure));
  let hash = 0;
  const key = JSON.stringify(figure);
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length].text;
}
