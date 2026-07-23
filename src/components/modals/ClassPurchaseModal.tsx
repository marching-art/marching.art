// =============================================================================
// CLASS PURCHASE MODAL - CorpsCoin Early Unlock Confirmation
// =============================================================================
// Allows directors to spend CorpsCoin to unlock a class before reaching the XP level

import React, { useState, useRef } from 'react';
import { Coins, ShoppingCart, X, AlertTriangle, Loader2, Calendar, Clock } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  weeksRemaining: number | null;
  /** Seasons still to complete before the free seasons-completed unlock */
  seasonsUntilUnlock?: number | null;
  isRegistrationLocked: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Keyed by canonical class keys (aClass/openClass/worldClass), the scheme
// used by CORPS_CLASS_ORDER, unlockedClasses, and the dashboard constants.
const CLASS_DESCRIPTIONS: Record<string, string> = {
  aClass: 'Intermediate level corps with higher draft budgets and more competitive shows',
  openClass: 'Advanced level corps with expanded opportunities and prestigious competitions',
  worldClass: 'Elite level corps competing at the highest tier of drum corps activity',
};

const CLASS_BUDGETS: Record<string, string> = {
  aClass: '60',
  openClass: '120',
  worldClass: '150',
};

// Registration lock thresholds (weeks remaining when class locks)
const REGISTRATION_LOCK_WEEKS: Record<string, number> = {
  aClass: 4,
  openClass: 5,
  worldClass: 6,
  soundSport: 0,
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
  weeksRemaining,
  seasonsUntilUnlock,
  isRegistrationLocked,
  onConfirm,
  onClose,
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newBalance = currentBalance - coinCost;
  const isEarlyUnlock = currentLevel < levelRequired;
  const lockWeeks = REGISTRATION_LOCK_WEEKS[classKey] || 0;

  useEscapeKey(onClose);

  const dialogRef = useRef<HTMLDivElement>(null);
  // Trap keyboard focus inside the dialog (WCAG 2.4.3); restores on close
  useFocusTrap(dialogRef);

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
          ref={dialogRef}
          className="w-full max-w-md bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-class-purchase"
              className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {isEarlyUnlock ? 'Early Unlock' : 'Unlock Class'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-white"
              disabled={isPurchasing}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-4 bg-brand/10 border border-brand/30 flex items-center justify-center">
              <Coins className="w-8 h-8 text-brand" />
            </div>

            {/* Class Info Card */}
            <div className="bg-background border border-line p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">{className}</h3>
                <span className="text-xs font-data text-interactive">
                  Draft budget: {CLASS_BUDGETS[classKey] || '—'}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {CLASS_DESCRIPTIONS[classKey] || 'Unlock this class to start a new corps.'}
              </p>
            </div>

            {/* Registration Locked Warning - Most Important */}
            {isRegistrationLocked && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-red-400 font-bold uppercase mb-1">
                      Registration Closed for This Season
                    </p>
                    <p className="text-xs text-red-300/80">
                      {className} registration locks with {lockWeeks} weeks remaining.
                      {weeksRemaining !== null && (
                        <>
                          {' '}
                          Only {weeksRemaining} week{weeksRemaining !== 1 ? 's' : ''} left this
                          season.
                        </>
                      )}
                    </p>
                    <p className="text-xs text-red-300/80 mt-1">
                      You can still unlock this class, but you won't be able to register a corps
                      until next season.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Early Unlock Warning */}
            {isEarlyUnlock && !isRegistrationLocked && (
              <div className="bg-warning/10 border border-warning/30 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-warning font-bold uppercase mb-1">Skip the Earn</p>
                    <p className="text-xs text-warning/80">
                      You're unlocking this class before earning it. You can also earn it free by
                      reaching Level {levelRequired}
                      {seasonsUntilUnlock != null && seasonsUntilUnlock > 0
                        ? ` — or by completing ${seasonsUntilUnlock} more season${seasonsUntilUnlock !== 1 ? 's' : ''}`
                        : ''}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Seasons-completed unlock info */}
            {seasonsUntilUnlock != null &&
              seasonsUntilUnlock > 0 &&
              !isEarlyUnlock &&
              !isRegistrationLocked && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-cyan-300/80">
                      This class unlocks free when you complete {seasonsUntilUnlock} more season
                      {seasonsUntilUnlock !== 1 ? 's' : ''} (compete in at least one show per
                      season).
                    </p>
                  </div>
                </div>
              )}

            {/* Cost Breakdown */}
            <div className="bg-background border border-line p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted">Cost</span>
                <span className="text-sm font-bold text-brand flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  {coinCost.toLocaleString()} CC
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted">Your Balance</span>
                <span className="text-sm font-data text-white">
                  {currentBalance.toLocaleString()} CC
                </span>
              </div>
              <div className="border-t border-line pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">After Purchase</span>
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
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isPurchasing}
              className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPurchasing}
              className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50 flex items-center gap-2"
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
