// =============================================================================
// STREAK MODAL - streak status, next milestone, and streak freeze purchase
// =============================================================================
// Backed by the getStreakStatus / purchaseStreakFreeze callables (dailyOps.js).

import React, { useEffect, useState, useCallback } from 'react';
import { Flame, Snowflake, ShieldCheck, AlertTriangle, Coins, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getStreakStatus, purchaseStreakFreeze } from '../../api/functions';

const StreakModal = ({ onClose, corpsCoin = 0 }) => {
  useEscapeKey(onClose);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getStreakStatus();
      setStatus(result.data);
    } catch {
      toast.error('Could not load streak status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handlePurchaseFreeze = async () => {
    setPurchasing(true);
    try {
      const result = await purchaseStreakFreeze();
      toast.success(result.data.message || 'Streak freeze activated!');
      await loadStatus();
    } catch (error) {
      toast.error(error.message || 'Failed to purchase streak freeze');
    } finally {
      setPurchasing(false);
    }
  };

  const streak = status?.streak ?? 0;
  const freezeCost = status?.freezeCost ?? 300;
  const canAfford = corpsCoin >= freezeCost;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-streak"
      >
        <div
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2
                id="modal-title-streak"
                className="text-xs font-bold uppercase tracking-wider text-gray-300"
              >
                Login Streak
              </h2>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted">Loading streak...</div>
            ) : (
              <>
                {/* Current streak */}
                <div className="flex items-center justify-center gap-3 py-2">
                  <Flame
                    className={`w-10 h-10 ${streak >= 30 ? 'text-red-500' : streak >= 7 ? 'text-orange-400' : 'text-orange-500'}`}
                  />
                  <div>
                    <p className="text-3xl font-bold text-white font-data tabular-nums">{streak}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">
                      day{streak === 1 ? '' : 's'} in a row
                    </p>
                  </div>
                </div>

                {/* At-risk warning */}
                {status?.isAtRisk && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">
                      Your streak is at risk! Log in within{' '}
                      {status.hoursUntilAtRisk != null
                        ? `${Math.max(1, Math.round(status.hoursUntilAtRisk))} hour${Math.round(status.hoursUntilAtRisk) === 1 ? '' : 's'}`
                        : 'the next few hours'}{' '}
                      tomorrow — or protect it with a freeze.
                    </p>
                  </div>
                )}

                {/* Next milestone */}
                {status?.nextMilestone && (
                  <div className="p-3 bg-[#0a0a0a] border border-[#333]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Next Milestone
                    </p>
                    <p className="text-sm text-white font-bold">
                      {status.nextMilestone.rewards.title}{' '}
                      <span className="text-muted font-normal">
                        — {status.nextMilestone.daysRemaining} day
                        {status.nextMilestone.daysRemaining === 1 ? '' : 's'} away
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      +{status.nextMilestone.rewards.xp} XP · +{status.nextMilestone.rewards.coin}{' '}
                      CC
                      {status.nextMilestone.rewards.freeFreeze ? ' · Free Streak Freeze' : ''}
                    </p>
                  </div>
                )}

                {/* Freeze status / purchase */}
                <div className="p-3 bg-[#0a0a0a] border border-[#333]">
                  <div className="flex items-center gap-2 mb-2">
                    <Snowflake className="w-4 h-4 text-cyan-400" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Streak Freeze
                    </p>
                  </div>

                  {status?.hasActiveFreeze ? (
                    <div className="flex items-center gap-2 text-xs text-cyan-300">
                      <ShieldCheck className="w-4 h-4" />
                      Freeze active — your streak is protected until{' '}
                      {new Date(status.freezeExpiresAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 mb-3">
                        Protects your streak for 24 hours if you miss a day. One freeze per 7 days.
                      </p>
                      {status?.canPurchaseFreeze ? (
                        <button
                          onClick={handlePurchaseFreeze}
                          disabled={purchasing || !canAfford}
                          className={`w-full h-9 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                            canAfford
                              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                              : 'bg-[#222] text-muted cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-4 h-4" />
                          {purchasing
                            ? 'Activating...'
                            : canAfford
                              ? `Buy Freeze — ${freezeCost} CC`
                              : `Need ${freezeCost} CC (you have ${corpsCoin.toLocaleString()})`}
                        </button>
                      ) : (
                        <p className="text-xs text-muted">
                          On cooldown — available in {status?.freezeCooldownDays} day
                          {status?.freezeCooldownDays === 1 ? '' : 's'}.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default StreakModal;
