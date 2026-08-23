// Mirror-equality tests: the client mastery tiers must match the backend
// helper the scoring run banks against (plain CJS, importable by vitest).
import { describe, it, expect } from 'vitest';

import {
  MASTERY_CAPTIONS,
  CAPTION_MASTERY_TIERS,
  getCaptionMastery,
  hasCaptionStats,
} from './captionMastery';

import {
  MASTERY_CAPTIONS as SERVER_CAPTIONS,
  CAPTION_MASTERY_TIERS as SERVER_TIERS,
  getCaptionMastery as serverGetCaptionMastery,
} from '../../functions/src/helpers/captionMastery.js';

describe('caption mastery mirrors the backend', () => {
  it('captions and tier thresholds match exactly', () => {
    expect(MASTERY_CAPTIONS).toEqual(SERVER_CAPTIONS);
    expect(CAPTION_MASTERY_TIERS).toEqual(SERVER_TIERS);
  });

  it('tier resolution agrees with the backend across the whole range', () => {
    for (const points of [0, 250, 500, 999, 1500, 3999, 4000, 9999, 10000, 50000]) {
      const client = getCaptionMastery(points);
      const server = serverGetCaptionMastery(points);
      expect(client.tier?.id ?? null).toBe(server.tier?.id ?? null);
      expect(client.next?.id ?? null).toBe(server.next?.id ?? null);
      expect(client.progress).toBeCloseTo(server.progress, 10);
    }
  });
});

describe('hasCaptionStats', () => {
  it('detects any banked caption points and tolerates missing data', () => {
    expect(hasCaptionStats({ B: 12.5 })).toBe(true);
    expect(hasCaptionStats({})).toBe(false);
    expect(hasCaptionStats(undefined)).toBe(false);
    expect(hasCaptionStats({ B: 0 })).toBe(false);
  });
});
