// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Surfaces the daily-login payoff. claimDailyLogin has always returned the
// day's rewards (xp, streak, milestone, level-ups) — but App.jsx discarded
// the response, so the game's most reliable daily reward beat happened in
// total silence. This module turns that response into the feedback the
// player actually sees: the floating +XP/+CC pills, a milestone celebration,
// and the full-screen level-up moment.
//
// Kept as a pure-ish module (DOM events only, no React) so it can be unit
// tested and called from the App-level effect.

import { showXPGain, showCoinGain } from '../components/xpFeedbackTrigger';
import { triggerLevelUp } from '../components/levelUpTrigger';

const celebrate = (message, type = 'default') => {
  window.dispatchEvent(new CustomEvent('celebration', { detail: { message, type } }));
};

/**
 * Surface the rewards from a claimDailyLogin response.
 * Safe no-op for already-claimed days and missing/failed responses.
 *
 * @param {Object|undefined} result - claimDailyLogin response data.
 */
export function surfaceDailyLoginPayoff(result) {
  if (!result?.success || result.alreadyClaimed) return;
  if (typeof window === 'undefined') return;

  // Floating pills: the daily XP and any coin (milestone CC, level-up
  // stipend, achievement CC) that landed with the claim.
  if (result.xpAwarded > 0) {
    const streakNote = result.loginStreak > 1 ? `${result.loginStreak} day streak` : 'Daily login';
    showXPGain(result.xpAwarded, streakNote);
  }
  if (result.coinAwarded > 0) {
    showCoinGain(result.coinAwarded);
  }

  // Streak milestone: a real moment ("Week Warrior!"), not just a pill.
  if (result.milestoneReached) {
    const m = result.milestoneReached;
    celebrate(`${m.title}${m.freeFreeze ? ' — free Streak Freeze earned!' : ''}`, 'achievement');
  }

  // Level-up: fire the mounted-but-never-triggered full-screen moment.
  // classUnlocked rides along so a level that unlocks a class says so.
  if (result.levelsGained > 0 && result.newLevel) {
    triggerLevelUp(result.newLevel, result.classUnlocked || undefined);
  }
}
