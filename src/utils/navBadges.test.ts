import { describe, it, expect } from 'vitest';
import { deriveNavBadges } from './navBadges';

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

const READY = {
  lineup: { ...FULL_LINEUP },
  selectedShows: { week3: [{ eventName: 'Show A' }] },
};

describe('deriveNavBadges — lineup', () => {
  it('badges a corps short of a full lineup', () => {
    const badges = deriveNavBadges({ worldClass: { lineup: { GE1: 'a|2014' } } }, 17, 3);
    expect(badges.lineup).toBe(true);
  });

  it('stays clear when every corps is full', () => {
    expect(deriveNavBadges({ worldClass: READY }, 17, 3).lineup).toBe(false);
  });

  it('badges when any one corps in the portfolio is short', () => {
    const badges = deriveNavBadges(
      { worldClass: READY, soundSport: { ...READY, lineup: { GE1: 'a|2014' } } },
      17,
      3
    );
    expect(badges.lineup).toBe(true);
  });

  it('does not count an empty-string slot as filled', () => {
    const badges = deriveNavBadges(
      { worldClass: { ...READY, lineup: { ...FULL_LINEUP, P: '' } } },
      17,
      3
    );
    expect(badges.lineup).toBe(true);
  });

  it('ignores Podium, which has no caption lineup at all', () => {
    const badges = deriveNavBadges({ podiumClass: { lineup: {}, selectedShows: {} } }, 17, 3);
    expect(badges.lineup).toBe(false);
    expect(badges.schedule).toBe(false);
  });

  it('says nothing for a director with no corps', () => {
    expect(deriveNavBadges({}, 17, 3)).toEqual({ lineup: false, schedule: false });
    expect(deriveNavBadges(null, 17, 3)).toEqual({ lineup: false, schedule: false });
  });

  it('ignores null corps slots', () => {
    expect(deriveNavBadges({ worldClass: null }, 17, 3)).toEqual({
      lineup: false,
      schedule: false,
    });
  });
});

describe('deriveNavBadges — schedule', () => {
  it('badges an unregistered week', () => {
    expect(deriveNavBadges({ worldClass: { ...READY, selectedShows: {} } }, 17, 3).schedule).toBe(
      true
    );
  });

  it('stays clear once the week has a show', () => {
    expect(deriveNavBadges({ worldClass: READY }, 17, 3).schedule).toBe(false);
  });

  it('judges the current week, not another one', () => {
    const badges = deriveNavBadges(
      { worldClass: { ...READY, selectedShows: { week2: [{ eventName: 'Old' }] } } },
      17,
      3
    );
    expect(badges.schedule).toBe(true);
  });

  it('treats an empty week array as unregistered', () => {
    const badges = deriveNavBadges(
      { worldClass: { ...READY, selectedShows: { week3: [] } } },
      17,
      3
    );
    expect(badges.schedule).toBe(true);
  });

  it('stays silent in Championship Week, which auto-enrolls', () => {
    // Days 45-49 need no registration, so the dot would point at a page that
    // cannot help.
    const badges = deriveNavBadges({ worldClass: { ...READY, selectedShows: {} } }, 47, 7);
    expect(badges.schedule).toBe(false);
  });

  it('still badges Days 43-44, the last registrable days of Week 7', () => {
    const badges = deriveNavBadges({ worldClass: { ...READY, selectedShows: {} } }, 43, 7);
    expect(badges.schedule).toBe(true);
  });

  it('says nothing before the season store hydrates the week', () => {
    const badges = deriveNavBadges({ worldClass: { ...READY, selectedShows: {} } }, null, null);
    expect(badges.schedule).toBe(false);
  });
});
