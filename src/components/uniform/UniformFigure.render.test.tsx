import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import UniformFigure from './UniformFigure';
import type { FigureConfig } from '../../types/uniform';

// The figure renderer is fed straight from stored designs (wardrobe thumbnails,
// equipped snapshots) and from the live draft mid-edit — none of it re-validated
// on the client. It must therefore render ANY shape without throwing: a thrown
// render bubbles to the page-level ErrorBoundary and takes down the whole Studio
// (the "Studio Error" a director hit while saving an asymmetric-limb design).
const render = (figure: unknown) =>
  renderToStaticMarkup(
    React.createElement(UniformFigure, { figure: figure as FigureConfig, label: 'x' })
  );

describe('UniformFigure never throws on stored/draft data', () => {
  const cases: Record<string, unknown> = {
    'only one arm authored (unlinked per-side edit)': {
      skin: '#c9a074',
      armL: { type: 'bare' },
    },
    'only one leg authored': {
      skin: '#c9a074',
      legR: { color: '#17161c', flare: true },
    },
    'one arm + a fill referencing a gradient': {
      skin: '#c9a074',
      grads: {
        fadeL: [
          { o: '0', c: '#ffffff' },
          { o: '1', c: '#000000' },
        ],
      },
      armL: { type: 'sleeve', fill: 'url:fadeL' },
    },
    'null gradient stops': {
      skin: '#c9a074',
      grads: { fadeL: null },
      armL: { type: 'sleeve', fill: 'url:fadeL' },
    },
    'empty figure': {},
    'missing skin': { jacket: '#6d1a26' },
  };

  for (const [name, figure] of Object.entries(cases)) {
    it(name, () => {
      expect(() => render(figure)).not.toThrow();
    });
  }
});
