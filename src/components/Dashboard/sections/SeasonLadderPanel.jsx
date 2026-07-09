// SeasonLadderPanel - free seasonal reward ladder
// Progress = XP earned this season (profile.xp - profile.xpAtSeasonStart,
// baseline stamped at rollover / first daily claim). Tier claims are
// validated server-side by claimLadderTier; claimed tiers live in the
// server-only profile.seasonLadder field. Tier table mirrors
// functions/src/helpers/seasonLadder.js — keep in sync.

import React, { memo, useMemo, useState } from 'react';
import { TrendingUp, Gift, Lock, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { claimLadderTier } from '../../../api/functions';
import { showCoinGain } from '../../xpFeedbackTrigger';

const TIERS = [
  { tier: 1, xp: 150, coin: 50 },
  { tier: 2, xp: 300, coin: 50 },
  { tier: 3, xp: 500, coin: 75 },
  { tier: 4, xp: 750, coin: 75 },
  { tier: 5, xp: 1000, coin: 100 },
  { tier: 6, xp: 1300, coin: 100 },
  { tier: 7, xp: 1600, coin: 125 },
  { tier: 8, xp: 2000, coin: 150 },
  { tier: 9, xp: 2400, coin: 175 },
  { tier: 10, xp: 2800, coin: 200 },
  { tier: 11, xp: 3200, coin: 250 },
  { tier: 12, xp: 3600, coin: 300, exclusive: 'Laureate title' },
];

const SeasonLadderPanel = memo(({ profile, seasonUid }) => {
  const [claiming, setClaiming] = useState(null);

  // The baseline is stamped server-side by the first daily XP event (login,
  // challenge, prediction) or at season rollover. Until then season XP can't
  // be computed — say so instead of showing a misleading 0.
  const baselineStamped = typeof profile?.xpAtSeasonStart === 'number';
  const seasonXP = useMemo(() => {
    if (typeof profile?.xpAtSeasonStart !== 'number') return 0;
    return Math.max(0, (profile.xp || 0) - profile.xpAtSeasonStart);
  }, [profile?.xp, profile?.xpAtSeasonStart]);

  // Claims from a previous season don't count against this one
  const claimed = useMemo(() => {
    const state = profile?.seasonLadder;
    if (!state || (seasonUid && state.seasonUid !== seasonUid)) return [];
    return state.claimed || [];
  }, [profile?.seasonLadder, seasonUid]);

  const claimable = TIERS.filter((t) => seasonXP >= t.xp && !claimed.includes(t.tier));
  const nextTier = TIERS.find((t) => seasonXP < t.xp) || null;
  const maxXP = TIERS[TIERS.length - 1].xp;

  if (!profile) return null;

  const handleClaim = async (tier) => {
    setClaiming(tier.tier);
    try {
      const result = await claimLadderTier({ tier: tier.tier });
      if (result.data.success && !result.data.alreadyClaimed) {
        const extra = result.data.grantItem ? ' + Laureate title unlocked!' : '';
        toast.success(`Tier ${tier.tier} claimed — +${result.data.coinAwarded} CC${extra}`);
        if (result.data.coinAwarded > 0) showCoinGain(result.data.coinAwarded, `Ladder Tier ${tier.tier}`);
      }
    } catch (error) {
      toast.error(error.message || 'Could not claim tier');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          Season Ladder
        </h3>
        <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
          {claimed.length}/{TIERS.length} tiers
        </span>
      </div>

      {/* Season XP progress */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">Season XP</span>
          <span className="text-[10px] font-bold text-emerald-400 font-data tabular-nums">
            {seasonXP.toLocaleString()}
            {nextTier ? ` / ${nextTier.xp.toLocaleString()}` : ' — maxed!'}
          </span>
        </div>
        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, (seasonXP / maxXP) * 100)}%` }}
          />
        </div>
      </div>

      {/* Claimable tiers */}
      {claimable.length > 0 && (
        <div className="px-4 py-3 space-y-1.5">
          {claimable.map((tier) => (
            <button
              key={tier.tier}
              onClick={() => handleClaim(tier)}
              disabled={claiming === tier.tier}
              className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600/20 transition-colors press-feedback"
            >
              <Gift className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-white flex-1 text-left">
                Tier {tier.tier} ready
                {tier.exclusive ? ` — includes the ${tier.exclusive}!` : ''}
              </span>
              <span className="text-[10px] font-bold text-yellow-500 font-data whitespace-nowrap">
                {claiming === tier.tier ? '...' : `+${tier.coin} CC`}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Baseline not stamped yet — tracking begins with the next XP event */}
      {!baselineStamped && (
        <div className="px-4 py-3 text-[10px] text-gray-500">
          Season XP starts counting with your next check-in, challenge, or prediction — all the XP
          you earn from then on climbs the ladder.
        </div>
      )}

      {/* Next tier preview */}
      {baselineStamped && nextTier && claimable.length === 0 && (
        <div className="px-4 py-3 flex items-center gap-2 text-[10px] text-gray-500">
          <Lock className="w-3 h-3" />
          Tier {nextTier.tier}: {(nextTier.xp - seasonXP).toLocaleString()} XP away — +
          {nextTier.coin} CC{nextTier.exclusive ? ` + ${nextTier.exclusive}` : ''}
        </div>
      )}

      {/* Ladder complete */}
      {!nextTier && claimable.length === 0 && (
        <div className="px-4 py-3 flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold">
          <Award className="w-4 h-4" />
          Ladder complete — see you next season!
        </div>
      )}
    </div>
  );
});

SeasonLadderPanel.displayName = 'SeasonLadderPanel';

export default SeasonLadderPanel;
