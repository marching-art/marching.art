// Corps class ordering + unlock helpers. Pins the profile-portfolio behavior:
// Podium is listed alongside the fantasy classes on profile surfaces and is
// always available (no unlock gate — the SoundSport model), while the canonical
// CORPS_CLASS_ORDER (dashboard tabs, scoring) deliberately excludes it.
import { describe, it, expect } from 'vitest';
import {
  CORPS_CLASS_ORDER,
  PROFILE_CORPS_CLASS_ORDER,
  hasCompletedSeason,
  isCorpsClassUnlocked,
  resolveCorpsForClass,
} from './corps';

describe('PROFILE_CORPS_CLASS_ORDER', () => {
  it('appends Podium to the canonical order without mutating it', () => {
    expect(CORPS_CLASS_ORDER).not.toContain('podiumClass');
    expect(PROFILE_CORPS_CLASS_ORDER).toEqual([...CORPS_CLASS_ORDER, 'podiumClass']);
  });
});

describe('isCorpsClassUnlocked', () => {
  it('treats Podium as always unlocked regardless of unlockedClasses', () => {
    expect(isCorpsClassUnlocked(['soundSport'], 'podiumClass')).toBe(true);
    expect(isCorpsClassUnlocked([], 'podiumClass')).toBe(true);
    expect(isCorpsClassUnlocked(null, 'podiumClass')).toBe(true);
    expect(isCorpsClassUnlocked(undefined, 'podiumClass')).toBe(true);
  });

  it('still gates the fantasy classes on unlockedClasses', () => {
    expect(isCorpsClassUnlocked(['soundSport'], 'worldClass')).toBe(false);
    expect(isCorpsClassUnlocked(['worldClass'], 'worldClass')).toBe(true);
    // Legacy short key still resolves against the canonical key.
    expect(isCorpsClassUnlocked(['world'], 'worldClass')).toBe(true);
  });
});

describe('resolveCorpsForClass', () => {
  it('resolves a Podium corps record by its canonical key', () => {
    const corps = { podiumClass: { corpsName: 'Rohn Regiment' } };
    expect(resolveCorpsForClass(corps, 'podiumClass')).toEqual({ corpsName: 'Rohn Regiment' });
  });
});

describe('hasCompletedSeason', () => {
  it('is false for a missing profile or a corps-less profile', () => {
    expect(hasCompletedSeason(null)).toBe(false);
    expect(hasCompletedSeason(undefined)).toBe(false);
    expect(hasCompletedSeason({})).toBe(false);
    expect(hasCompletedSeason({ corps: null })).toBe(false);
    expect(hasCompletedSeason({ corps: {} })).toBe(false);
  });

  it('is false while every corps is still in its first season', () => {
    expect(
      hasCompletedSeason({ corps: { worldClass: { corpsName: 'Fresh', seasonHistory: [] } } })
    ).toBe(false);
    // A null corps slot must not throw.
    expect(hasCompletedSeason({ corps: { worldClass: null } })).toBe(false);
  });

  it('is true once any corps has an archived season', () => {
    expect(
      hasCompletedSeason({
        corps: {
          soundSport: { seasonHistory: [] },
          worldClass: { seasonHistory: [{ seasonName: '2025' }] },
        },
      })
    ).toBe(true);
  });
});

// Score-sheet "your corps" highlighting: a director fields up to five ensembles
// (four fantasy classes + Podium) and every one of them must light up.
import { buildViewerCorpsMatcher, isViewerCorps } from './corps';

describe('buildViewerCorpsMatcher / isViewerCorps', () => {
  const corps = {
    worldClass: { corpsName: 'Blue Stars Fantasy', lineup: {} },
    openClass: { corpsName: 'Open Ensemble' },
    aClass: { corpsName: 'A Team' },
    soundSport: { name: 'Legacy Named Corps' }, // legacy `name` field
    podiumClass: { corpsName: 'Podium Corps' },
    stale: null,
  };

  it('collects every corps name across all classes, including Podium and legacy `name`', () => {
    const m = buildViewerCorpsMatcher(corps, 'me');
    expect(m).not.toBeNull();
    expect([...m!.names].sort()).toEqual(
      ['a team', 'blue stars fantasy', 'legacy named corps', 'open ensemble', 'podium corps'].sort()
    );
    expect(m!.uid).toBe('me');
  });

  it('returns null when there is nothing to match on', () => {
    expect(buildViewerCorpsMatcher(null, null)).toBeNull();
    expect(buildViewerCorpsMatcher({}, undefined)).toBeNull();
    expect(buildViewerCorpsMatcher(null, 'me')).not.toBeNull();
  });

  it('highlights rows from every class the viewer fields (case-insensitive by name)', () => {
    const m = buildViewerCorpsMatcher(corps, null);
    expect(isViewerCorps({ corpsName: 'blue stars fantasy' }, m)).toBe(true);
    expect(isViewerCorps({ corpsName: 'OPEN ENSEMBLE' }, m)).toBe(true);
    expect(isViewerCorps({ corps: 'A Team' }, m)).toBe(true);
    expect(isViewerCorps({ corpsName: 'Legacy Named Corps' }, m)).toBe(true);
    expect(isViewerCorps({ corpsName: 'Podium Corps' }, m)).toBe(true);
    expect(isViewerCorps({ corpsName: 'Someone Else' }, m)).toBe(false);
  });

  it('prefers the uid when both sides carry one, so a shared name is not a false positive', () => {
    const m = buildViewerCorpsMatcher(corps, 'me');
    expect(isViewerCorps({ uid: 'me', corpsName: 'Renamed Since' }, m)).toBe(true);
    expect(isViewerCorps({ uid: 'other', corpsName: 'Blue Stars Fantasy' }, m)).toBe(false);
    // Rows without a uid (older archives) still match by name.
    expect(isViewerCorps({ corpsName: 'Blue Stars Fantasy' }, m)).toBe(true);
  });

  it('is safe with missing inputs', () => {
    expect(isViewerCorps(null, buildViewerCorpsMatcher(corps, 'me'))).toBe(false);
    expect(isViewerCorps({ corpsName: 'A Team' }, null)).toBe(false);
    expect(isViewerCorps({}, buildViewerCorpsMatcher(corps, 'me'))).toBe(false);
  });
});
