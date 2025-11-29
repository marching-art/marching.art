// Tests for SeasonSetupWizard constants
import {
  ALL_CLASSES,
  REGISTRATION_LOCKS,
  POINT_LIMITS,
  CLASS_NAMES,
  CAPTIONS,
  CAPTION_CATEGORIES,
  getCorpsClassName,
  formatSeasonName
} from './constants';

describe('SeasonSetupWizard constants', () => {
  describe('ALL_CLASSES', () => {
    test('contains all 4 classes in hierarchy order', () => {
      expect(ALL_CLASSES).toHaveLength(4);
      expect(ALL_CLASSES[0]).toBe('worldClass');
      expect(ALL_CLASSES[1]).toBe('openClass');
      expect(ALL_CLASSES[2]).toBe('aClass');
      expect(ALL_CLASSES[3]).toBe('soundSport');
    });
  });

  describe('REGISTRATION_LOCKS', () => {
    test('has correct lock values', () => {
      expect(REGISTRATION_LOCKS.worldClass).toBe(6);
      expect(REGISTRATION_LOCKS.openClass).toBe(5);
      expect(REGISTRATION_LOCKS.aClass).toBe(4);
      expect(REGISTRATION_LOCKS.soundSport).toBe(0);
    });
  });

  describe('POINT_LIMITS', () => {
    test('has correct point limits', () => {
      expect(POINT_LIMITS.soundSport).toBe(90);
      expect(POINT_LIMITS.aClass).toBe(60);
      expect(POINT_LIMITS.openClass).toBe(120);
      expect(POINT_LIMITS.worldClass).toBe(150);
    });
  });

  describe('CLASS_NAMES', () => {
    test('has correct display names', () => {
      expect(CLASS_NAMES.soundSport).toBe('SoundSport');
      expect(CLASS_NAMES.aClass).toBe('A Class');
      expect(CLASS_NAMES.openClass).toBe('Open Class');
      expect(CLASS_NAMES.worldClass).toBe('World Class');
    });
  });

  describe('CAPTIONS', () => {
    test('contains all 8 captions', () => {
      expect(CAPTIONS).toHaveLength(8);
    });

    test('each caption has required properties', () => {
      CAPTIONS.forEach(caption => {
        expect(caption).toHaveProperty('id');
        expect(caption).toHaveProperty('name');
        expect(caption).toHaveProperty('category');
        expect(caption).toHaveProperty('color');
        expect(caption).toHaveProperty('description');
      });
    });

    test('has correct caption IDs', () => {
      const ids = CAPTIONS.map(c => c.id);
      expect(ids).toContain('GE1');
      expect(ids).toContain('GE2');
      expect(ids).toContain('VP');
      expect(ids).toContain('VA');
      expect(ids).toContain('CG');
      expect(ids).toContain('B');
      expect(ids).toContain('MA');
      expect(ids).toContain('P');
    });

    test('has captions in all categories', () => {
      const categories = CAPTIONS.map(c => c.category);
      expect(categories).toContain('General Effect');
      expect(categories).toContain('Visual');
      expect(categories).toContain('Music');
    });
  });

  describe('CAPTION_CATEGORIES', () => {
    test('contains all 3 categories', () => {
      expect(CAPTION_CATEGORIES).toHaveLength(3);
      expect(CAPTION_CATEGORIES).toContain('General Effect');
      expect(CAPTION_CATEGORIES).toContain('Visual');
      expect(CAPTION_CATEGORIES).toContain('Music');
    });
  });
});

describe('getCorpsClassName', () => {
  test('returns correct display name for valid class', () => {
    expect(getCorpsClassName('worldClass')).toBe('World Class');
    expect(getCorpsClassName('openClass')).toBe('Open Class');
    expect(getCorpsClassName('aClass')).toBe('A Class');
    expect(getCorpsClassName('soundSport')).toBe('SoundSport');
  });

  test('returns classId for unknown class', () => {
    expect(getCorpsClassName('unknownClass')).toBe('unknownClass');
  });

  test('handles undefined', () => {
    expect(getCorpsClassName(undefined)).toBe(undefined);
  });
});

describe('formatSeasonName', () => {
  test('returns "New Season" for null/undefined', () => {
    expect(formatSeasonName(null)).toBe('New Season');
    expect(formatSeasonName(undefined)).toBe('New Season');
    expect(formatSeasonName('')).toBe('New Season');
  });

  test('replaces underscores with spaces', () => {
    expect(formatSeasonName('summer_2024')).toBe('Summer 2024');
  });

  test('capitalizes first letter of each word', () => {
    expect(formatSeasonName('winter season')).toBe('Winter Season');
    expect(formatSeasonName('off_season_2024')).toBe('Off Season 2024');
  });

  test('handles already capitalized names', () => {
    expect(formatSeasonName('Summer 2024')).toBe('Summer 2024');
  });
});
