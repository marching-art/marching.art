// DirectorsReport — the unified "what do I do right now?" card at the top of
// Zone B (DASHBOARD_UNIFICATION.md Part 3, Zone B; LIFELONG roadmap Step 3).
//
// Before this card, the daily loop was scattered: login feedback in the HUD,
// challenges in the sidebar, predictions in the main column — the returning
// player assembled their own to-do list by scanning the whole page. This one
// surface shows the entire daily set with a single `Today · X of Y` count:
//   • daily login (auto-claims on load; shown so the +25 XP is visible work)
//   • the three daily challenges (embedded, server-authoritative)
//   • today's predictions (embedded; placement-only set for SoundSport)
//   • any Season Ladder tier ready to claim (the "pending claim" row)

import React, { memo, useMemo, useState } from 'react';
import { ClipboardList, Check, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProfileStore } from '../../../store/profileStore';
import { getGameDay, getChallengesForGameDay } from '../../../utils/dailyChallenges';
import { buildQuestions } from '../../../utils/dailyPredictions';
import { claimLadderTier } from '../../../api/functions';
import { showCoinGain } from '../../xpFeedbackTrigger';
import DailyChallenges from './DailyChallenges';
import PredictionGamePanel from './PredictionGamePanel';
import { TIERS as LADDER_TIERS } from './seasonLadderTiers';

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const DirectorsReport = memo(
  ({ recentResults, corpsClass, seasonUid, onLineupClick, onConceptClick }) => {
    const profile = useProfileStore((state) => state.profile);
    const [claimingTier, setClaimingTier] = useState(null);

    const gameDay = getGameDay();

    // --- Login row: claimed automatically on app load (claimDailyLogin) ---
    const lastLogin = toDate(profile?.engagement?.lastLogin);
    const loginDone = !!lastLogin && getGameDay(lastLogin) === gameDay;
    const streak = profile?.engagement?.loginStreak || 0;

    // --- Predictions: picked or resolved both count as "done for today" ---
    const questions = useMemo(
      () => buildQuestions(recentResults, corpsClass),
      [recentResults, corpsClass]
    );
    // No questions (fewer than two scored results) means make-prediction is
    // genuinely impossible today — drop it from the set instead of pinning
    // "Today · N of M" below M forever (the server excuses it the same way
    // when counting weekly-arc days).
    const predictionAvailable = questions.length > 0;

    // --- Challenges: same server-authoritative state DailyChallenges renders ---
    const challenges = useMemo(
      () =>
        getChallengesForGameDay(gameDay).filter(
          (c) => c.id !== 'make-prediction' || predictionAvailable
        ),
      [gameDay, predictionAvailable]
    );
    const challengesDone = useMemo(() => {
      const bucket = profile?.challenges?.[gameDay] || [];
      const ids = new Set(bucket.filter((c) => c.completed).map((c) => c.id));
      return challenges.filter((c) => ids.has(c.id)).length;
    }, [profile?.challenges, gameDay, challenges]);
    const predictionBucket = profile?.predictions?.[gameDay] || {};
    const predictionsDone = predictionBucket.resolved
      ? questions.length
      : Math.min(Object.keys(predictionBucket.picks || {}).length, questions.length);

    // --- Pending Season Ladder claims (bonus row, not counted in the set) ---
    const seasonXP =
      typeof profile?.xpAtSeasonStart === 'number'
        ? Math.max(0, (profile.xp || 0) - profile.xpAtSeasonStart)
        : 0;
    const claimedTiers = useMemo(() => {
      const state = profile?.seasonLadder;
      if (!state || (seasonUid && state.seasonUid !== seasonUid)) return [];
      return state.claimed || [];
    }, [profile?.seasonLadder, seasonUid]);
    const claimableTiers = LADDER_TIERS.filter(
      (t) => seasonXP >= t.xp && !claimedTiers.includes(t.tier)
    );

    const doneCount = (loginDone ? 1 : 0) + challengesDone + predictionsDone;
    const totalCount = 1 + challenges.length + questions.length;
    const allDone = totalCount > 0 && doneCount >= totalCount;

    const handleClaimTier = async (tier) => {
      setClaimingTier(tier.tier);
      try {
        const result = await claimLadderTier({ tier: tier.tier });
        if (result.data.success && !result.data.alreadyClaimed) {
          const extra = result.data.grantItem ? ' + Laureate title unlocked!' : '';
          toast.success(`Tier ${tier.tier} claimed — +${result.data.coinAwarded} CC${extra}`);
          if (result.data.coinAwarded > 0) {
            showCoinGain(result.data.coinAwarded, `Ladder Tier ${tier.tier}`);
          }
        }
      } catch (error) {
        toast.error(error.message || 'Could not claim tier');
      } finally {
        setClaimingTier(null);
      }
    };

    if (!profile) return null;

    return (
      /* Focal card: while the day still has open items this is the primary
         action on the dashboard, so it carries the ESPN-blue accent frame that
         lifts it above the flat #333 sibling panels. Once everything is done
         it recedes to the neutral chrome — the eye should move on. Border-only
         accent keeps it within the no-glow/no-gradient design laws. */
      <div
        className={`bg-[#1a1a1a] overflow-hidden border transition-colors duration-500 ${
          allDone ? 'border-[#333]' : 'border-[#0057B8]'
        }`}
      >
        {/* Report header — the one count that answers "am I done today?" */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-500 ${
            allDone ? 'bg-[#222] border-[#333]' : 'bg-[#0057B8]/15 border-[#0057B8]/40'
          }`}
        >
          <h3
            className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${
              allDone ? 'text-gray-300' : 'text-white'
            }`}
          >
            <ClipboardList
              className={`w-3.5 h-3.5 ${allDone ? 'text-[#0057B8]' : 'text-white'}`}
            />
            Director&apos;s Report
          </h3>
          <span
            className={`text-[10px] font-bold font-data tabular-nums ${allDone ? 'text-green-400' : 'text-gray-400'}`}
          >
            Today · {doneCount} of {totalCount} done
          </span>
        </div>
        <div className="h-1 bg-[#222]">
          <div
            className={`h-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-[#0057B8]'}`}
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {/* Daily login — auto-claimed on load; surfaced so the day's most
          reliable reward reads as done work, with the streak attached */}
        <div className="px-4 py-3 border-b border-[#222] flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              loginDone ? 'bg-green-500' : 'border border-[#444]'
            }`}
          >
            {loginDone && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className={`text-sm flex-1 ${loginDone ? 'text-muted' : 'text-white'}`}>
            Daily login{streak > 1 ? ` — ${streak} day streak` : ''}
          </span>
          <span className="text-[10px] font-bold text-purple-400 font-data">+25 XP</span>
        </div>

        {/* Daily challenges (embedded — no double card chrome) */}
        <DailyChallenges
          embedded
          onLineupClick={onLineupClick}
          onConceptClick={onConceptClick}
          predictionAvailable={predictionAvailable}
        />

        {/* Predictions (embedded); SoundSport gets the placement-only set */}
        <PredictionGamePanel embedded recentResults={recentResults} corpsClass={corpsClass} />

        {/* Pending ladder claim — a reward already earned should never sit
          unnoticed in another card */}
        {claimableTiers.length > 0 && (
          <div className="px-4 py-3 border-t border-[#222] bg-emerald-500/5 flex items-center gap-3">
            <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-300 flex-1">
              Season Ladder Tier {claimableTiers[0].tier} ready
              {claimableTiers.length > 1 ? ` (+${claimableTiers.length - 1} more)` : ''}
            </span>
            <button
              onClick={() => handleClaimTier(claimableTiers[0])}
              disabled={claimingTier !== null}
              className="h-8 px-3 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] text-white transition-colors press-feedback"
            >
              {claimingTier ? '...' : `Claim +${claimableTiers[0].coin} CC`}
            </button>
          </div>
        )}
      </div>
    );
  }
);

DirectorsReport.displayName = 'DirectorsReport';

export default DirectorsReport;
