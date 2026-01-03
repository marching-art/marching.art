// =============================================================================
// CLASS PURCHASE MODAL - CorpsCoin Early Unlock Confirmation
// =============================================================================
// Allows directors to spend CorpsCoin to unlock a class before reaching the XP level

import React, { useState } from 'react';
import { Coins, ShoppingCart, X, AlertTriangle, Loader2, Unlock } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// =============================================================================
// TYPES
// =============================================================================

interface ClassPurchaseModalProps {
  classKey: string;
  className: string;
  coinCost: number;
  currentBalance: number;
  levelRequired: number;
  currentLevel: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_DESCRIPTIONS: Record<string, string> = {
  aClass: 'Intermediate level corps with higher point limits and more competitive shows',
  open: 'Advanced level corps with expanded opportunities and prestigious competitions',
  world: 'Elite level corps competing at the highest tier of drum corps activity',
};

const CLASS_BUDGETS: Record<string, string> = {
  aClass: '60 pts',
  open: '120 pts',
  world: '150 pts',
};

// =============================================================================
// COMPONENT
// =============================================================================

const ClassPurchaseModal: React.FC<ClassPurchaseModalProps> = ({
  classKey,
  className,
  coinCost,
  currentBalance,
  levelRequired,
  currentLevel,
  onConfirm,
  onClose,
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newBalance = currentBalance - coinCost;
  const isEarlyUnlock = currentLevel < levelRequired;

  useEscapeKey(onClose);

  const handleConfirm = async () => {
    setIsPurchasing(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock class');
      setIsPurchasing(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-class-purchase"
      >
        <div
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2
              id="modal-title-class-purchase"
              className="text-xs font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {isEarlyUnlock ? 'Early Unlock' : 'Unlock Class'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-white"
              disabled={isPurchasing}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Coins className="w-8 h-8 text-yellow-500" />
            </div>

            {/* Class Info Card */}
            <div className="bg-[#0a0a0a] border border-[#333] p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">{className}</h3>
                <span className="text-xs font-data text-[#0057B8]">
                  {CLASS_BUDGETS[classKey] || '—'}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {CLASS_DESCRIPTIONS[classKey] || 'Unlock this class to start a new corps.'}
              </p>
            </div>

            {/* Early Unlock Warning */}
            {isEarlyUnlock && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-yellow-400 font-bold uppercase mb-1">
                      Early Unlock
                    </p>
                    <p className="text-xs text-yellow-300/80">
                      You're unlocking this class before reaching Level {levelRequired}.
                      You can also wait and unlock it for free when you level up.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="bg-[#0a0a0a] border border-[#333] p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Cost</span>
                <span className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  {coinCost.toLocaleString()} CC
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Your Balance</span>
                <span className="text-sm font-data text-white">
                  {currentBalance.toLocaleString()} CC
                </span>
              </div>
              <div className="border-t border-[#333] pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">After Purchase</span>
                  <span className="text-sm font-bold font-data text-green-400">
                    {newBalance.toLocaleString()} CC
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isPurchasing}
              className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPurchasing}
              className="h-9 px-4 bg-yellow-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-yellow-500 disabled:opacity-50 flex items-center gap-2"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Purchase
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ClassPurchaseModal;
