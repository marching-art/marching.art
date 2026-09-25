import { describe, it, expect } from 'vitest';
import {
  classHasLineup,
  classIdOf,
  POINT_CAPS,
  POINT_CAP_RAMPS,
  ENABLED_CLASSES,
  pointCapForWeek,
  pointCapSchedule,
  openingPointCap,
  formatPointCapRange,
} from './classRegistry';

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

describe('pointCapForWeek — the weekly budget ramp', () => {
  it('World Class opens at 145 and climbs a point a week to 150', () => {
    expect(pointCapSchedule('worldClass')?.map((r) => r.cap)).toEqual([
      145, 145, 146, 147, 148, 149, 150,
    ]);
  });

  it('every lineup class ramps 5 below its full cap', () => {
    for (const classId of Object.keys(POINT_CAPS)) {
      expect(POINT_CAP_RAMPS[classId], classId).toBe(5);
      expect(openingPointCap(classId), classId).toBe(Number(POINT_CAPS[classId]) - 5);
      expect(pointCapForWeek(classId, 7), classId).toBe(POINT_CAPS[classId]);
    }
  });

  it('treats an unknown or un-hydrated week as the opening budget', () => {
    expect(pointCapForWeek('worldClass', null)).toBe(145);
    expect(pointCapForWeek('worldClass', 0)).toBe(145);
    expect(pointCapForWeek('worldClass', undefined)).toBe(145);
  });

  it('never exceeds the full cap and resolves aliases', () => {
    expect(pointCapForWeek('worldClass', 12)).toBe(150);
    expect(pointCapForWeek('open', 5)).toBe(118);
    expect(pointCapForWeek('aClass', 3)).toBe(56);
  });

  it('formats the budget as a range for the class tables', () => {
    expect(formatPointCapRange('worldClass')).toBe('145\u2013150');
    expect(formatPointCapRange('soundSport')).toBe('85\u201390');
    expect(formatPointCapRange('podiumClass')).toBe('');
  });

  it('has no cap for a class without a lineup', () => {
    expect(pointCapForWeek('podiumClass', 3)).toBeNull();
    expect(pointCapSchedule('podiumClass')).toBeNull();
    expect(openingPointCap('podiumClass')).toBeNull();
  });
});
