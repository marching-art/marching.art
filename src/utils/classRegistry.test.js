import { describe, it, expect } from 'vitest';
import { classHasLineup, classIdOf, POINT_CAPS, ENABLED_CLASSES } from './classRegistry';

describe('classIdOf', () => {
  it('accepts registry ids, aliases and display names', () => {
    expect(classIdOf('openClass')).toBe('openClass');
    expect(classIdOf('open')).toBe('openClass');
    expect(classIdOf('Open Class')).toBe('openClass');
    expect(classIdOf('A Class')).toBe('aClass');
    expect(classIdOf('World Class')).toBe('worldClass');
    expect(classIdOf('SoundSport')).toBe('soundSport');
    expect(classIdOf('Drum Corps')).toBeNull();
    expect(classIdOf(null)).toBeNull();
  });
});

describe('classHasLineup', () => {
  it('is true for every fantasy class', () => {
    for (const classId of ['worldClass', 'openClass', 'aClass', 'soundSport']) {
      expect(classHasLineup(classId), classId).toBe(true);
    }
  });

  it('is false for Podium, which drafts nothing', () => {
    // Podium is a director simulation with a rehearsal model; opening the
    // caption editor onto it would render against an undefined point cap.
    expect(classHasLineup('podiumClass')).toBe(false);
  });

  it('accepts legacy short aliases', () => {
    expect(classHasLineup('world')).toBe(true);
    expect(classHasLineup('open')).toBe(true);
    expect(classHasLineup('podium')).toBe(false);
  });

  it('is false for anything that is not a class', () => {
    expect(classHasLineup('nonsense')).toBe(false);
    expect(classHasLineup('')).toBe(false);
  });

  it('agrees with the point-cap table it guards', () => {
    // POINT_CAPS is built from the same capability flag; a class with a
    // lineup must have a budget to draft against, and vice versa.
    for (const classId of ENABLED_CLASSES) {
      expect(classHasLineup(classId), classId).toBe(classId in POINT_CAPS);
    }
  });
});
