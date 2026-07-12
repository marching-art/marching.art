// =============================================================================
// SEASON RECAP MODAL - end-of-season results and payout ceremony
// =============================================================================
// Shown once when profile.pendingSeasonRecap exists (written by the season
// rollover in functions/src/helpers/season.js). Dismissing clears the field.

import React, { useEffect } from 'react';
import { Trophy, Medal, Coins, Star, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { CLASS_DISPLAY_NAMES } from '../Dashboard/sections/constants';
import { formatSeasonName } from '../../utils/season';

const placementLabel = (placement) => {
  if (!placement) return '—';
  if (placement === 1) return '🥇 1st';
  if (placement === 2) return '🥈 2nd';
  if (placement === 3) return '🥉 3rd';
  return `${placement}th`;
};

const SeasonRecapModal = ({ recap, onClose }) => {
  useEscapeKey(onClose);

  // Celebrate the payday — same confetti library the onboarding celebration uses
  useEffect(() => {
    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const results = recap?.results || [];

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-season-recap"
      >
        <div
          className="w-full max-w-lg max-h-[85dvh] bg-[#1a1a1a] border border-yellow-500/30 rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div>
                <h2
                  id="modal-title-season-recap"
                  className="text-xs font-bold uppercase tracking-wider text-gray-300"
                >
                  Season Complete
                </h2>
                <p className="text-[10px] text-muted">
                  {formatSeasonName(recap?.seasonName) || recap?.seasonName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {results.map((result) => (
              <div
                key={result.corpsClass}
                className="p-3 bg-[#0a0a0a] border border-[#333] flex items-center gap-3"
              >
                <Medal className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {result.corpsName || 'Your Corps'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {CLASS_DISPLAY_NAMES[result.corpsClass] || result.corpsClass}
                  </p>
                  {result.newBestSeason && (
                    <p className="text-[10px] font-bold text-emerald-400">
                      🎉 New personal best season!
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white font-data">
                    {placementLabel(result.placement)}
                    {result.totalInClass ? (
                      <span className="text-muted font-normal"> of {result.totalInClass}</span>
                    ) : null}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {result.coinBonus > 0 && (
                      <span className="text-xs text-yellow-500 font-data">
                        +{result.coinBonus} CC
                      </span>
                    )}
                    {result.xpBonus > 0 && (
                      <span className="text-xs text-purple-400 font-data">
                        +{result.xpBonus} XP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-500">
                  Season Rewards
                </p>
              </div>
              <div className="flex items-center gap-3">
                {recap?.totalCoin > 0 && (
                  <span className="flex items-center gap-1 text-sm font-bold text-yellow-500 font-data">
                    <Coins className="w-4 h-4" />+{recap.totalCoin.toLocaleString()}
                  </span>
                )}
                {recap?.totalXP > 0 && (
                  <span className="text-sm font-bold text-purple-400 font-data">
                    +{recap.totalXP.toLocaleString()} XP
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
            >
              On to the Next Season
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default SeasonRecapModal;
