import { describe, it, expect } from 'vitest';
import {
  isPodiumAutoAnchor,
  multiNightNights,
  podiumAttendsShow,
  podiumAutoAttendsDay,
  podiumAutoNightFor,
} from './podiumAttendance';

const easternNight = (day: number) => ({
  day,
  eventName: 'marching.art Eastern Classic',
  eventTier: 'regional',
  multiNight: { nights: [41, 42] },
});

const poolShow = (day: number, eventName = 'Summer Music Games') => ({
  day,
  eventName,
  eligibleClasses: ['worldClass', 'openClass', 'aClass', 'soundSport'],
});

describe('isPodiumAutoAnchor', () => {
  it('recognizes the majors by tier or by name, and the championship rounds', () => {
    expect(isPodiumAutoAnchor(easternNight(41))).toBe(true);
    expect(isPodiumAutoAnchor({ day: 28, eventName: 'DCI Southwestern Championship' })).toBe(true);
    expect(
      isPodiumAutoAnchor({ day: 47, eventName: 'World Championship Prelims', type: 'championship' })
    ).toBe(true);
    expect(isPodiumAutoAnchor({ day: 47, eventName: 'Prelims', isChampionship: true })).toBe(true);
  });

  it('never anchors a pool show or the SoundSport-only festival', () => {
    expect(isPodiumAutoAnchor(poolShow(28))).toBe(false);
    expect(
      isPodiumAutoAnchor({
        day: 49,
        eventName: 'SoundSport Festival',
        eligibleClasses: ['soundSport'],
      })
    ).toBe(false);
  });
});

describe('multiNightNights', () => {
  it('returns the nights of a two-night event and nothing for a single show', () => {
    expect(multiNightNights(easternNight(42))).toEqual([41, 42]);
    expect(multiNightNights(poolShow(10))).toEqual([]);
    expect(multiNightNights({ day: 10, multiNight: { nights: [10] } })).toEqual([]);
    expect(multiNightNights(null)).toEqual([]);
  });
});

describe('podiumAutoNightFor', () => {
  it('resolves the performing night from either night of a two-night event', () => {
    const autoDays = new Set([28, 35, 42]);
    expect(podiumAutoNightFor(autoDays, easternNight(41))).toBe(42);
    expect(podiumAutoNightFor(autoDays, easternNight(42))).toBe(42);
    expect(podiumAutoNightFor([28, 35, 41], easternNight(42))).toBe(41);
  });

  it('is the show day itself for a single-night auto day, and null otherwise', () => {
    expect(podiumAutoNightFor(new Set([28]), { day: 28, eventName: 'Southwestern' })).toBe(28);
    expect(podiumAutoNightFor(new Set([28]), poolShow(29))).toBeNull();
    expect(podiumAutoNightFor(null, easternNight(41))).toBeNull();
  });
});

describe('podiumAttendsShow', () => {
  const attendance = {
    events: new Set(['Summer Music Games']),
    autoDays: new Set([28, 35, 42, 47, 48, 49]),
  };

  it('matches a self-pick by event name only — never every show that night', () => {
    expect(podiumAttendsShow(attendance, poolShow(10))).toBe(true);
    expect(podiumAttendsShow(attendance, poolShow(10, 'Drums Along the Rockies'))).toBe(false);
  });

  it('badges BOTH Eastern Classic nights when the corps performs on either', () => {
    // Assigned night 42 — the registration still covers Friday (41).
    expect(podiumAttendsShow(attendance, easternNight(41))).toBe(true);
    expect(podiumAttendsShow(attendance, easternNight(42))).toBe(true);
    // Assigned night 41 — Saturday (42) is covered too.
    const friday = { ...attendance, autoDays: new Set([28, 35, 41]) };
    expect(podiumAttendsShow(friday, easternNight(41))).toBe(true);
    expect(podiumAttendsShow(friday, easternNight(42))).toBe(true);
  });

  it('does not badge a pool show that merely shares an auto day', () => {
    expect(podiumAttendsShow(attendance, poolShow(28, 'Some Pool Show'))).toBe(false);
    expect(podiumAutoAttendsDay(attendance, poolShow(28, 'Some Pool Show'))).toBe(true);
    expect(
      podiumAttendsShow(attendance, { ...poolShow(28, 'Some Pool Show'), eventTier: 'regional' })
    ).toBe(true);
  });

  it('is false without attendance or without a show', () => {
    expect(podiumAttendsShow(null, easternNight(41))).toBe(false);
    expect(podiumAttendsShow(attendance, null)).toBe(false);
    expect(podiumAttendsShow({ events: new Set(), autoDays: new Set() }, easternNight(41))).toBe(
      false
    );
  });
});
