import { describe, expect, it } from 'vitest';
import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  figureToPngDataUrl,
  figureToSvgMarkup,
} from './uniformPreview';
import { UNIFORM_PRESETS } from '../data/uniformCatalog';

describe('figureToSvgMarkup', () => {
  it('emits a standalone SVG with concrete pixel dimensions for every preset', () => {
    for (const preset of UNIFORM_PRESETS) {
      const markup = figureToSvgMarkup(preset.figure, preset.label);
      expect(markup.startsWith('<svg')).toBe(true);
      expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(markup).toContain(`width="${PREVIEW_WIDTH}"`);
      expect(markup).toContain(`height="${PREVIEW_HEIGHT}"`);
      expect(markup).toContain('viewBox="0 -84 240 560"');
      // Style-attribute-only: nothing that would need page CSS to resolve.
      expect(markup).not.toContain('class="');
      expect(markup).not.toContain('var(--');
    }
  });
});

describe('figureToPngDataUrl', () => {
  it('never throws — resolves null (or a PNG) even where the browser cannot rasterize', async () => {
    // jsdom has no image decoding or canvas: the <img> never fires, and the
    // internal timeout is what settles the promise. The equip path must
    // survive exactly that.
    const result = await figureToPngDataUrl(UNIFORM_PRESETS[0].figure);
    expect(result === null || result.startsWith('data:image/png;base64,')).toBe(true);
  }, 15_000);
});
