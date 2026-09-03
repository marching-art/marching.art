// =============================================================================
// UNIFORM STUDIO — rasterize a figure for the AI image pipeline
// =============================================================================
// When a design is equipped, the client sends the server a PNG of the exact
// figure the Studio drew. The server re-hosts it on the equipped snapshot
// (`previewUrl`) and every Gemini image call for that corps attaches it as a
// reference image — a picture of the design is the one description that can't
// lose a sash side or a stripe in translation. Like posterExport, this
// serializes the style-attribute-only SVG and draws it through an <img> onto a
// canvas; nothing here is fatal — any failure resolves to null and the equip
// proceeds on prose alone.

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import UniformFigure, { FIGURE_VIEWBOX } from '../components/uniform/UniformFigure';
import type { FigureConfig } from '../types/uniform';

/** Rendered at 2x the 240×560 viewBox: crisp for the model, still tens of KB. */
export const PREVIEW_WIDTH = 480;
export const PREVIEW_HEIGHT = 1120;

/** Neutral mid-gray so both white and black garments read against it. */
const PREVIEW_BACKGROUND = '#d9d9d9';

/** Mirrors MAX_PREVIEW_BYTES in functions/src/helpers/uniformPreview.js. */
const MAX_PREVIEW_BYTES = 400 * 1024;

/** An <img> that never decodes (old Safari, jsdom) must not stall the equip. */
const RASTERIZE_TIMEOUT_MS = 4000;

/** The figure as standalone SVG markup with concrete pixel dimensions. */
export function figureToSvgMarkup(figure: FigureConfig, label = 'uniform preview'): string {
  const markup = renderToStaticMarkup(
    React.createElement(UniformFigure, { figure, label, width: PREVIEW_WIDTH })
  );
  // UniformFigure emits width + viewBox; an <img> also needs an explicit
  // height to size the bitmap. Splice it in once, on the root element.
  return markup.replace(
    `width="${PREVIEW_WIDTH}"`,
    `width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}"`
  );
}

/**
 * Rasterize a figure to a PNG data URL. Resolves null when the browser can't
 * (no DOM, no canvas, a serializer quirk) or the result is implausibly large.
 */
export function figureToPngDataUrl(
  figure: FigureConfig,
  label = 'uniform preview'
): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    let url: string | null = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = (result: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      resolve(result);
    };
    timer = setTimeout(() => done(null), RASTERIZE_TIMEOUT_MS);
    try {
      if (!figure || !FIGURE_VIEWBOX) {
        done(null);
        return;
      }
      const source = figureToSvgMarkup(figure, label);
      url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = PREVIEW_WIDTH;
          canvas.height = PREVIEW_HEIGHT;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            done(null);
            return;
          }
          ctx.fillStyle = PREVIEW_BACKGROUND;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
          done(
            dataUrl.startsWith('data:image/png;base64,') && bytes <= MAX_PREVIEW_BYTES
              ? dataUrl
              : null
          );
        } catch {
          done(null);
        }
      };
      image.onerror = () => done(null);
      image.src = url;
    } catch {
      done(null);
    }
  });
}
