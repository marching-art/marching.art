import { describe, it, expect } from 'vitest';
import { getFantasyLineupClasses } from './podiumLineupSwitch';

const FULL_LINEUP = {
  GE1: 'a|2014',
  GE2: 'b|2013',
  VP: 'c|2018',
  VA: 'd|2016',
  CG: 'e|2005',
  B: 'f|2008',
  MA: 'g|2022',
  P: 'h|2002',
};

describe('getFantasyLineupClasses', () => {
  it('returns nothing when the director has no corps', () => {
    expect(getFantasyLineupClasses(null)).toEqual([]);
    expect(getFantasyLineupClasses({})).toEqual([]);
  });

  it('lists each fantasy class that has a corps, with its name and label', () => {
    const result = getFantasyLineupClasses({
      worldClass: { corpsName: 'Blue Devils', lineup: FULL_LINEUP },
    });
    expect(result).toEqual([
      { classId: 'worldClass', label: 'World Class', corpsName: 'Blue Devils', incomplete: false },
    ]);
  });

  it('flags a lineup short of all 8 captions as incomplete', () => {
    const [entry] = getFantasyLineupClasses({
      openClass: { corpsName: 'Cadets', lineup: { GE1: 'a|2014' } },
    });
    expect(entry.incomplete).toBe(true);
  });

  it('treats a missing lineup as incomplete', () => {
    const [entry] = getFantasyLineupClasses({ aClass: { corpsName: 'Troopers' } });
    expect(entry.incomplete).toBe(true);
  });

  it('leads with incomplete classes, keeping tier order within each group', () => {
    const result = getFantasyLineupClasses({
      worldClass: { corpsName: 'W', lineup: FULL_LINEUP }, // complete
      openClass: { corpsName: 'O', lineup: { GE1: 'a|2014' } }, // incomplete
      aClass: { corpsName: 'A', lineup: FULL_LINEUP }, // complete
    });
    expect(result.map((c) => c.classId)).toEqual(['openClass', 'worldClass', 'aClass']);
  });

  it('excludes the Podium corps — it has no drafted lineup', () => {
    const result = getFantasyLineupClasses({
      podiumClass: { corpsName: 'My Sim Corps' },
      worldClass: { corpsName: 'W', lineup: FULL_LINEUP },
    });
    expect(result.map((c) => c.classId)).toEqual(['worldClass']);
  });

  it('falls back to the class label when a corps has no name', () => {
    const [entry] = getFantasyLineupClasses({ soundSport: { lineup: FULL_LINEUP } });
    expect(entry.corpsName).toBe('SoundSport');
  });
});
