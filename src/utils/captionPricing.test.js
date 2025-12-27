// Tests for captionPricing utility functions
import {
  CLASS_POINT_LIMITS,
  CLASS_UNLOCK_REQUIREMENTS,
  REQUIRED_CAPTIONS,
  calculateLineupValue,
  validateLineup,
  generateLineupHash,
  canRegisterForClass,
  calculateLevel,
  getXPProgress,
  getCaptionChangesAllowed,
  formatCorpsName,
  getClassInfo
} from './captionPricing';

describe('captionPricing constants', () => {
  test('CLASS_POINT_LIMITS has correct values', () => {
    expect(CLASS_POINT_LIMITS.soundSport).toBe(90);
    expect(CLASS_POINT_LIMITS.aClass).toBe(60);
    expect(CLASS_POINT_LIMITS.openClass).toBe(120);
    expect(CLASS_POINT_LIMITS.worldClass).toBe(150);
  });

  test('CLASS_UNLOCK_REQUIREMENTS has correct XP thresholds', () => {
    expect(CLASS_UNLOCK_REQUIREMENTS.soundSport).toBe(0);
    expect(CLASS_UNLOCK_REQUIREMENTS.aClass).toBe(300);
    expect(CLASS_UNLOCK_REQUIREMENTS.openClass).toBe(2000);
    expect(CLASS_UNLOCK_REQUIREMENTS.worldClass).toBe(4000);
  });

  test('REQUIRED_CAPTIONS has all 8 captions', () => {
    expect(REQUIRED_CAPTIONS).toHaveLength(8);
    expect(REQUIRED_CAPTIONS).toContain('GE1');
    expect(REQUIRED_CAPTIONS).toContain('GE2');
    expect(REQUIRED_CAPTIONS).toContain('VP');
    expect(REQUIRED_CAPTIONS).toContain('VA');
    expect(REQUIRED_CAPTIONS).toContain('CG');
    expect(REQUIRED_CAPTIONS).toContain('B');
    expect(REQUIRED_CAPTIONS).toContain('MA');
    expect(REQUIRED_CAPTIONS).toContain('P');
  });
});

describe('calculateLineupValue', () => {
  const mockCorps = [
    { id: 'corps1', value: 10 },
    { id: 'corps2', value: 15 },
    { id: 'corps3', value: 20 },
  ];

  test('returns 0 for null lineup', () => {
    expect(calculateLineupValue(null, mockCorps)).toBe(0);
  });

  test('returns 0 for null corps', () => {
    expect(calculateLineupValue({ GE1: 'corps1' }, null)).toBe(0);
  });

  test('calculates total value correctly', () => {
    const lineup = {
      GE1: 'corps1',
      GE2: 'corps2',
      VP: 'corps3'
    };
    expect(calculateLineupValue(lineup, mockCorps)).toBe(45);
  });

  test('ignores corps IDs not in available list', () => {
    const lineup = {
      GE1: 'corps1',
      GE2: 'unknown'
    };
    expect(calculateLineupValue(lineup, mockCorps)).toBe(10);
  });
});

describe('validateLineup', () => {
  const mockCorps = [
    { id: 'corps1', value: 10 },
    { id: 'corps2', value: 10 },
    { id: 'corps3', value: 10 },
    { id: 'corps4', value: 10 },
    { id: 'corps5', value: 10 },
    { id: 'corps6', value: 10 },
    { id: 'corps7', value: 10 },
    { id: 'corps8', value: 10 },
  ];

  const validLineup = {
    GE1: 'corps1',
    GE2: 'corps2',
    VP: 'corps3',
    VA: 'corps4',
    CG: 'corps5',
    B: 'corps6',
    MA: 'corps7',
    P: 'corps8'
  };

  test('validates a complete lineup within point limit', () => {
    const result = validateLineup(validLineup, 'soundSport', mockCorps);
    expect(result.valid).toBe(true);
    expect(result.totalValue).toBe(80);
  });

  test('fails for incomplete lineup', () => {
    const incompleteLineup = { GE1: 'corps1', GE2: 'corps2' };
    const result = validateLineup(incompleteLineup, 'soundSport', mockCorps);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('8 captions');
  });

  test('fails for duplicate corps selections', () => {
    const duplicateLineup = {
      ...validLineup,
      GE2: 'corps1' // Same as GE1
    };
    const result = validateLineup(duplicateLineup, 'soundSport', mockCorps);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('same corps');
  });

  test('fails for invalid class', () => {
    const result = validateLineup(validLineup, 'invalidClass', mockCorps);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid competition class');
  });

  test('fails when exceeding point limit', () => {
    const expensiveCorps = mockCorps.map(c => ({ ...c, value: 20 }));
    const result = validateLineup(validLineup, 'aClass', expensiveCorps);
    expect(result.valid).toBe(false);
    expect(result.totalValue).toBe(160);
    expect(result.reason).toContain('exceeds');
  });
});

describe('generateLineupHash', () => {
  test('generates consistent hash for same lineup', () => {
    const lineup = { GE1: 'corps1', GE2: 'corps2' };
    const hash1 = generateLineupHash(lineup);
    const hash2 = generateLineupHash(lineup);
    expect(hash1).toBe(hash2);
  });

  test('generates different hash for different lineups', () => {
    const lineup1 = { GE1: 'corps1', GE2: 'corps2' };
    const lineup2 = { GE1: 'corps2', GE2: 'corps1' };
    expect(generateLineupHash(lineup1)).not.toBe(generateLineupHash(lineup2));
  });

  test('handles missing captions with none placeholder', () => {
    const lineup = { GE1: 'corps1' };
    const hash = generateLineupHash(lineup);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });
});

describe('canRegisterForClass', () => {
  test('allows registration when XP requirement met', () => {
    const result = canRegisterForClass(2000, 0, 'openClass', 10);
    expect(result.canRegister).toBe(true);
    expect(result.cost).toBe(0);
  });

  test('denies registration when locked due to timing', () => {
    const result = canRegisterForClass(5000, 5000, 'worldClass', 5);
    expect(result.canRegister).toBe(false);
    expect(result.reason).toContain('closed');
  });

  test('allows unlock with CorpsCoin when XP not met', () => {
    const result = canRegisterForClass(100, 5000, 'worldClass', 10);
    expect(result.canRegister).toBe(true);
    expect(result.cost).toBe(5000);
    expect(result.requiresPayment).toBe(true);
  });

  test('denies when XP and coins insufficient', () => {
    const result = canRegisterForClass(100, 100, 'worldClass', 10);
    expect(result.canRegister).toBe(false);
    expect(result.reason).toContain('4000 XP');
  });

  test('soundSport always available', () => {
    const result = canRegisterForClass(0, 0, 'soundSport', 1);
    expect(result.canRegister).toBe(true);
    expect(result.cost).toBe(0);
  });
});

describe('calculateLevel', () => {
  test('level 1 at 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  test('level 1 at 999 XP', () => {
    expect(calculateLevel(999)).toBe(1);
  });

  test('level 2 at 1000 XP', () => {
    expect(calculateLevel(1000)).toBe(2);
  });

  test('level 10 at 9000 XP', () => {
    expect(calculateLevel(9000)).toBe(10);
  });

  test('level 11 at 10500 XP', () => {
    expect(calculateLevel(10500)).toBe(11);
  });
});

describe('getXPProgress', () => {
  test('returns correct progress at 0 XP', () => {
    const progress = getXPProgress(0);
    expect(progress.current).toBe(0);
    expect(progress.needed).toBe(1000);
    expect(progress.percentage).toBe(0);
    expect(progress.level).toBe(1);
    expect(progress.nextLevel).toBe(2);
  });

  test('returns correct progress at 500 XP', () => {
    const progress = getXPProgress(500);
    expect(progress.current).toBe(500);
    expect(progress.percentage).toBe(50);
    expect(progress.level).toBe(1);
  });

  test('returns correct progress at 2500 XP', () => {
    const progress = getXPProgress(2500);
    expect(progress.current).toBe(500);
    expect(progress.percentage).toBe(50);
    expect(progress.level).toBe(3);
    expect(progress.nextLevel).toBe(4);
  });
});

describe('getCaptionChangesAllowed', () => {
  test('unlimited changes with 5+ weeks remaining', () => {
    expect(getCaptionChangesAllowed(5)).toBe(Infinity);
    expect(getCaptionChangesAllowed(7)).toBe(Infinity);
  });

  test('3 changes with 1-4 weeks remaining', () => {
    expect(getCaptionChangesAllowed(4)).toBe(3);
    expect(getCaptionChangesAllowed(1)).toBe(3);
  });

  test('4 changes in final week', () => {
    expect(getCaptionChangesAllowed(0)).toBe(4);
  });
});

describe('formatCorpsName', () => {
  test('returns empty string for null corps', () => {
    expect(formatCorpsName(null)).toBe('');
  });

  test('formats corps name with year', () => {
    expect(formatCorpsName({ year: 2024, name: 'Blue Devils' })).toBe('2024 Blue Devils');
  });
});

describe('getClassInfo', () => {
  test('returns soundSport info', () => {
    const info = getClassInfo('soundSport');
    expect(info.name).toBe('SoundSport');
    expect(info.pointLimit).toBe(90);
    expect(info.requiredXP).toBe(0);
  });

  test('returns aClass info', () => {
    const info = getClassInfo('aClass');
    expect(info.name).toBe('A Class');
    expect(info.pointLimit).toBe(60);
    expect(info.requiredXP).toBe(300);
  });

  test('returns default soundSport for unknown class', () => {
    const info = getClassInfo('unknownClass');
    expect(info.name).toBe('SoundSport');
  });
});
