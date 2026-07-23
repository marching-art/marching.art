// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// The daily-login payoff surfacing: claimDailyLogin's response used to be
// discarded entirely, so these tests pin that every reward in the response
// becomes a visible event (XP/coin pills, milestone celebration, level-up).
import { describe, it, expect, beforeEach } from 'vitest';
import { surfaceDailyLoginPayoff } from './dailyLoginPayoff';

const captureEvents = () => {
  const events = { 'xp-feedback': [], celebration: [], 'level-up': [] };
  for (const name of Object.keys(events)) {
    window.addEventListener(name, (e) => events[name].push(e.detail));
  }
  return events;
};

describe('surfaceDailyLoginPayoff', () => {
  let events;
  beforeEach(() => {
    events = captureEvents();
  });

  it('fires XP and coin pills for a fresh claim', () => {
    surfaceDailyLoginPayoff({
      success: true,
      loginStreak: 4,
      xpAwarded: 25,
      coinAwarded: 100,
    });

    expect(events['xp-feedback']).toHaveLength(2);
    expect(events['xp-feedback'][0]).toMatchObject({ amount: 25, type: 'xp' });
    expect(events['xp-feedback'][0].message).toContain('4 day streak');
    expect(events['xp-feedback'][1]).toMatchObject({ amount: 100, type: 'coin' });
  });

  it('celebrates streak milestones', () => {
    surfaceDailyLoginPayoff({
      success: true,
      loginStreak: 7,
      xpAwarded: 125,
      coinAwarded: 100,
      milestoneReached: { days: 7, title: 'Week Warrior!', xp: 100, coin: 100 },
    });

    expect(events.celebration).toHaveLength(1);
    expect(events.celebration[0].message).toContain('Week Warrior!');
  });

  it('fires the full-screen level-up with any class unlock attached', () => {
    surfaceDailyLoginPayoff({
      success: true,
      loginStreak: 2,
      xpAwarded: 25,
      levelsGained: 1,
      newLevel: 3,
      classUnlocked: 'A Class',
    });

    expect(events['level-up']).toHaveLength(1);
    expect(events['level-up'][0]).toMatchObject({ newLevel: 3, classUnlocked: 'A Class' });
  });

  it('stays silent for already-claimed days and failures', () => {
    surfaceDailyLoginPayoff({ success: true, alreadyClaimed: true, loginStreak: 4 });
    surfaceDailyLoginPayoff(undefined);
    surfaceDailyLoginPayoff({ success: false });

    expect(events['xp-feedback']).toHaveLength(0);
    expect(events.celebration).toHaveLength(0);
    expect(events['level-up']).toHaveLength(0);
  });
});
