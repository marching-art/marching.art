// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// DirectorsReport — the unified "what do I do right now?" card at the top of
// Zone B (GAMIFICATION.md).
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
import { computeDirectorsReport } from '../../../utils/directorsReport';
import { getGameDay } from '../../../utils/dailyChallenges';
import { useNow } from '../../../hooks/useNow';
import { claimLadderTier } from '../../../api/functions';
import { showCoinGain } from '../../xpFeedbackTrigger';
import DailyChallenges from './DailyChallenges';
import PredictionGamePanel from './PredictionGamePanel';
import { getClaimableLadderTiers } from './seasonLadderTiers';

const DirectorsReport = memo(
  ({
    recentResults,
    corpsClass,
    seasonUid,
    podium = null,
    leaguePool = null,
    onLineupClick,
    onConceptClick,
  }) => {
    const profile = useProfileStore((state) => state.profile);
    const [claimingTier, setClaimingTier] = useState(null);

    // A minute-resolution clock so the report actually rolls over on the game-day
    // boundary (2 AM ET). Without a ticking `now`, getGameDay() was only
    // re-evaluated when the profile changed — an open tab kept showing
    // yesterday's completed set until some unrelated write forced a re-render,
    // which is when the challenge auto-claim (and its "+XP" toast) fired at a
    // random evening hour instead of at the actual rollover.
    const now = useNow(60000);
    const gameDay = getGameDay(now);

    // The day's set — login + challenge rotation + predictions — computed by
    // the shared resolver so this card and the mobile Next Action hero can
    // never disagree about "Today · X of Y". `podium` carries the show/concept
    // facts that keep a Podium-only director's set winnable. Passing `now`
    // through is what makes the set roll over on the 2 AM ET boundary; the
    // per-minute recompute is trivial for a single card.
    const { loginDone, streak, predictionAvailable, doneCount, totalCount, allDone } = useMemo(
      () => computeDirectorsReport({ profile, recentResults, corpsClass, podium, leaguePool, now }),
      [profile, recentResults, corpsClass, podium, leaguePool, now]
    );

    // --- Pending Season Ladder claims (bonus row, not counted in the set) ---
    const claimableTiers = useMemo(
      () => getClaimableLadderTiers(profile, seasonUid),
      [profile, seasonUid]
    );

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
         action on the dashboard, so it carries the azure accent frame that
         lifts it above the flat #333 sibling panels. Once everything is done
         it recedes to the neutral chrome — the eye should move on. Border-only
         accent keeps it within the no-glow/no-gradient design laws. */
      <div
        id="directors-report"
        // scroll-mt clears the fixed shell chrome (top nav + ticker) plus the
        // sticky ControlBar when the Next Action hero scrolls the page here.
        className={`bg-surface-card overflow-hidden border transition-colors duration-500 scroll-mt-24 ${
          allDone ? 'border-line' : 'border-interactive'
        }`}
      >
        {/* Report header — the one count that answers "am I done today?" */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-500 ${
            allDone ? 'bg-surface-raised border-line' : 'bg-interactive/15 border-interactive/40'
          }`}
        >
          <h3
            className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${
              allDone ? 'text-secondary' : 'text-white'
            }`}
          >
            <ClipboardList
              className={`w-3.5 h-3.5 ${allDone ? 'text-interactive' : 'text-white'}`}
            />
            Director&apos;s Report
          </h3>
          <span
            className={`text-[10px] font-bold font-data tabular-nums ${allDone ? 'text-green-400' : 'text-muted'}`}
          >
            Today · {doneCount} of {totalCount} done
          </span>
        </div>
        <div className="h-1 bg-surface-raised">
          <div
            className={`h-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-interactive'}`}
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {/* Daily login — auto-claimed on load; surfaced so the day's most
          reliable reward reads as done work, with the streak attached */}
        <div className="px-4 py-3 border-b border-line-subtle flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              loginDone ? 'bg-green-500' : 'border border-line-strong'
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
          gameDay={gameDay}
          onLineupClick={onLineupClick}
          onConceptClick={onConceptClick}
          predictionAvailable={predictionAvailable}
          podium={podium}
          leaguePool={leaguePool}
        />

        {/* Predictions (embedded); SoundSport gets the placement-only set */}
        <PredictionGamePanel embedded recentResults={recentResults} corpsClass={corpsClass} />

        {/* Pending ladder claim — a reward already earned should never sit
          unnoticed in another card */}
        {claimableTiers.length > 0 && (
          <div className="px-4 py-3 border-t border-line-subtle bg-emerald-500/5 flex items-center gap-3">
            <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-300 flex-1">
              Season Ladder Tier {claimableTiers[0].tier} ready
              {claimableTiers.length > 1 ? ` (+${claimableTiers.length - 1} more)` : ''}
            </span>
            <button
              onClick={() => handleClaimTier(claimableTiers[0])}
              disabled={claimingTier !== null}
              className="h-8 px-3 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:bg-line text-white transition-colors press-feedback"
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
