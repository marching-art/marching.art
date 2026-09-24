// The World Championship rounds are one field. These pin the round table the
// sheets read and the guard that keeps an unrelated show on a World day split
// by class. The server twin (functions/src/helpers/worldChampionship.js) is
// pinned equal by its own test.
import { describe, it, expect } from 'vitest';
import {
  WORLD_CHAMPIONSHIP_DAYS,
  WORLD_FIELD_KEY,
  isWorldChampionshipRound,
  worldChampionshipRound,
  worldChampionshipTitle,
} from './worldChampionship';
import { sectionsForNight } from '../components/scores/sheetTokens';

describe('worldChampionshipRound', () => {
  it('names the three World nights and nothing else', () => {
    expect(WORLD_CHAMPIONSHIP_DAYS).toEqual([47, 48, 49]);
    expect(worldChampionshipRound(47)?.participants).toBe('World Prelims Performers');
    expect(worldChampionshipRound(48)?.participants).toBe('World Semifinalists');
    expect(worldChampionshipRound(49)?.participants).toBe('World Finalists');
    expect(worldChampionshipRound(49)?.winner).toBe('World Champion');
    expect(worldChampionshipRound(48)?.winner).toBeNull();
    // The Open & A nights are two separate competitions and stay split by class.
    expect(worldChampionshipRound(45)).toBeNull();
    expect(worldChampionshipRound(46)).toBeNull();
    expect(worldChampionshipRound(null)).toBeNull();
  });

  it('requires the event, when named, to be the World Championship show', () => {
    expect(isWorldChampionshipRound(47, 'marching.art World Championship Prelims')).toBe(true);
    expect(isWorldChampionshipRound(49, null)).toBe(true);
    expect(isWorldChampionshipRound(47, 'Drums Along the Rockies')).toBe(false);
  });

  it('gives a placement its title', () => {
    expect(worldChampionshipTitle(49, 1)).toBe('World Champion');
    expect(worldChampionshipTitle(49, 12)).toBe('World Finalist');
    expect(worldChampionshipTitle(48, 1)).toBe('World Semifinalist');
    expect(worldChampionshipTitle(20, 1)).toBeNull();
  });
});

describe('sectionsForNight', () => {
  const rows = [
    { uid: 'w1', corpsClass: 'worldClass', score: 95 },
    { uid: 'o1', corpsClass: 'openClass', score: 94 },
    { uid: 'a1', corpsClass: 'aClass', score: 90 },
    { uid: 'w2', corpsClass: 'worldClass', score: 89 },
  ];
  const classOf = (row: { corpsClass: string }) => row.corpsClass;

  it('keeps a World Championship night as one field in score order', () => {
    const sections = sectionsForNight(rows, { day: 48 }, classOf);
    expect(sections).toHaveLength(1);
    expect(sections[0].cls).toBe(WORLD_FIELD_KEY);
    expect(sections[0].label).toBe('World Semifinalists');
    expect(sections[0].world?.round).toBe('Semifinals');
    expect(sections[0].rows.map((r) => r.uid)).toEqual(['w1', 'o1', 'a1', 'w2']);
  });

  it('sections every other night by class, World → Open → A', () => {
    const sections = sectionsForNight(rows, { day: 46 }, classOf);
    expect(sections.map((s) => [s.label, s.rows.length, s.world])).toEqual([
      ['World Class', 2, null],
      ['Open Class', 1, null],
      ['A Class', 1, null],
    ]);
  });

  it('keeps an unrelated show on a World day split by class', () => {
    const sections = sectionsForNight(rows, { day: 47, eventName: 'Drums on the Ohio' }, classOf);
    expect(sections).toHaveLength(3);
  });

  it('returns no section for an empty World field', () => {
    expect(sectionsForNight([], { day: 49 }, classOf)).toEqual([]);
  });
});
