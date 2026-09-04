import { describe, expect, it } from 'vitest';
import { PODIUM_MEDAL_MIN_FIELD_SIZE, podiumMedalForPlace } from './podiumMedals';

describe('podiumMedalForPlace', () => {
  it('medals the top three of a full-size division field', () => {
    const n = PODIUM_MEDAL_MIN_FIELD_SIZE;
    expect(podiumMedalForPlace(1, n)).toBe('gold');
    expect(podiumMedalForPlace(2, n)).toBe('silver');
    expect(podiumMedalForPlace(3, n)).toBe('bronze');
    expect(podiumMedalForPlace(4, n)).toBeNull();
  });

  it('never medals a field under the minimum — a 1/3 is a win, not a podium', () => {
    expect(podiumMedalForPlace(1, PODIUM_MEDAL_MIN_FIELD_SIZE - 1)).toBeNull();
    expect(podiumMedalForPlace(1, 1)).toBeNull();
    expect(podiumMedalForPlace(2, 3)).toBeNull();
  });

  it('returns null for a missing or malformed placement', () => {
    expect(podiumMedalForPlace(null, 10)).toBeNull();
    expect(podiumMedalForPlace(undefined, 10)).toBeNull();
    expect(podiumMedalForPlace(0, 10)).toBeNull();
    expect(podiumMedalForPlace(1.5, 10)).toBeNull();
    expect(podiumMedalForPlace(1, null)).toBeNull();
  });
});

describe('PODIUM_MEDAL_MIN_FIELD_SIZE', () => {
  it('mirrors the server balance config', async () => {
    const cfg = await import('../../functions/src/helpers/podium/balanceConfig.json');
    expect(PODIUM_MEDAL_MIN_FIELD_SIZE).toBe(cfg.default.medals.minFieldSize);
  });
});
