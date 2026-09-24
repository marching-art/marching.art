import { describe, it, expect } from 'vitest';
import {
  CHAMPIONSHIP_EVENTS,
  MAJOR_EVENTS,
  championshipEventFor,
  displayEventName,
  majorEventFor,
} from './eventNames';

describe('displayEventName — Championship Week (days 45-49)', () => {
  it('renders the hard-coded round name whatever title the season row carries', () => {
    // A season minted from a 2000s archive year: day 47 stored the archive title.
    expect(
      displayEventName({
        day: 47,
        eventName: 'DCI Division I World Championship Quarterfinals',
        type: 'championship',
      })
    ).toBe('marching.art World Championship Prelims');
    expect(
      displayEventName({ day: 48, eventName: 'DCI World Class World Championship Semi-Finals' })
    ).toBe('marching.art World Championship Semifinals');
    expect(displayEventName({ day: 49, eventName: 'DCI World Championship Finals' })).toBe(
      'marching.art World Championship Finals'
    );
  });

  it('keeps the SoundSport festival apart from Finals on day 49', () => {
    expect(
      displayEventName({
        day: 49,
        eventName: 'SoundSport Festival',
        allowedClasses: ['soundSport'],
      })
    ).toBe('SoundSport International Music & Food Festival');
    expect(
      displayEventName({ day: 49, eventName: 'Some Finals', allowedClasses: ['World Class'] })
    ).toBe('marching.art World Championship Finals');
    expect(
      championshipEventFor({ day: 49, eventName: 'SoundSport International Music & Food Festival' })
        ?.eligibleClasses
    ).toEqual(['soundSport']);
  });

  it('names days 45 and 46 from the constants', () => {
    expect(displayEventName({ day: 45, eventName: 'Open and A Class Prelims' })).toBe(
      'Open and A Class Prelims'
    );
    expect(
      displayEventName({ day: 46, eventName: 'Open & A Class Finals', isChampionship: true })
    ).toBe('Open and A Class Finals');
  });

  it('leaves an unrelated show on a championship day alone (live-season scrape)', () => {
    expect(displayEventName({ day: 47, eventName: 'DCI Kalamazoo', type: 'regular' })).toBe(
      'marching.art Kalamazoo'
    );
    expect(championshipEventFor({ day: 47, eventName: 'DCI Kalamazoo' })).toBeNull();
  });

  it('covers every championship day exactly once, twice on Finals night', () => {
    expect(CHAMPIONSHIP_EVENTS.map((e) => e.day)).toEqual([45, 46, 47, 48, 49, 49]);
  });
});

describe('displayEventName — the majors (days 28, 35, 41-42)', () => {
  it('renders the hard-coded major name by tier or by name', () => {
    expect(
      displayEventName({
        day: 28,
        eventName: 'DCI Southwestern Championship',
        eventTier: 'regional',
      })
    ).toBe('marching.art Southwestern Championship');
    expect(displayEventName({ day: 35, eventName: 'DCI Southeastern Championship' })).toBe(
      'marching.art Southeastern Championship'
    );
    expect(displayEventName({ day: 42, eventName: 'DCI Eastern Classic' })).toBe(
      'marching.art Eastern Classic'
    );
    expect(majorEventFor({ day: 41, eventName: 'x', eventTier: 'regional' })?.nights).toEqual([
      41, 42,
    ]);
  });

  it('does not rename a regular show that merely shares the day', () => {
    expect(displayEventName({ day: 28, eventName: 'DCI San Antonio' })).toBe(
      'marching.art San Antonio'
    );
    expect(majorEventFor({ day: 28, eventName: 'DCI San Antonio' })).toBeNull();
    expect(Object.keys(MAJOR_EVENTS).map(Number)).toEqual([28, 35, 41, 42]);
  });
});

describe('displayEventName — everything else', () => {
  it('brand-swaps a regular show and tolerates missing input', () => {
    expect(displayEventName({ day: 12, eventName: 'DCI Denver' })).toBe('marching.art Denver');
    expect(displayEventName({ day: 12, name: 'Drums Along the Rockies' })).toBe(
      'Drums Along the Rockies'
    );
    expect(displayEventName(null)).toBe('');
    expect(displayEventName({})).toBe('');
  });
});
