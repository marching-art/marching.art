/**
 * GuestLineupPicker - Lightweight caption draft modal for Guest Preview Mode
 *
 * Lets unauthenticated visitors actually draft a lineup from the real season
 * corps list, under the same 90-point starter budget onboarding uses, so the
 * draft imports cleanly when they sign up. Mirrors the selection rules of
 * OnboardingParts' GuidedCaptionSelection: no duplicate corps, no picks that
 * exceed the remaining budget.
 */

import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles } from 'lucide-react';

const STARTER_BUDGET = 90; // SOUNDSPORT_POINT_LIMIT — the budget onboarding drafts under

const GuestLineupPicker = ({
  isOpen,
  caption,
  availableCorps,
  lineup,
  onSelect,
  onClose,
  onComplete,
}) => {
  if (!caption) return null;

  const usedPoints = Object.values(lineup || {}).reduce((sum, val) => {
    if (!val) return sum;
    return sum + (parseInt(val.split('|')[2]) || 0);
  }, 0);
  const currentValue = lineup?.[caption.id];
  const currentPoints = currentValue ? parseInt(currentValue.split('|')[2]) || 0 : 0;
  // Replacing the current pick refunds its cost
  const remainingPoints = STARTER_BUDGET - usedPoints + currentPoints;

  const isCorpsUsed = (corpsName) =>
    Object.entries(lineup || {}).some(
      ([capId, val]) => capId !== caption.id && val && val.startsWith(corpsName + '|')
    );

  const sortedCorps = [...availableCorps].sort((a, b) => b.points - a.points);

  const handlePick = (corps) => {
    onSelect(caption.id, `${corps.corpsName}|${corps.sourceYear}|${corps.points}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-surface-card border border-line rounded-none w-full max-w-md max-h-[85dvh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-picker-title"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-surface-raised border-b border-line flex items-center justify-between flex-shrink-0">
              <div>
                <h2
                  id="guest-picker-title"
                  className="text-xs font-bold uppercase tracking-wider text-secondary"
                >
                  Draft {caption.fullName}
                </h2>
                <p className="text-[11px] text-muted mt-0.5">
                  Budget:{' '}
                  <span
                    className={`font-bold font-data tabular-nums ${
                      remainingPoints < 10 ? 'text-warning' : 'text-green-400'
                    }`}
                  >
                    {remainingPoints}
                  </span>{' '}
                  of {STARTER_BUDGET} remaining
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-white min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps list */}
            <div className="flex-1 overflow-y-auto divide-y divide-line/50">
              {sortedCorps.map((corps, idx) => {
                const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                const isSelected = currentValue === value;
                const isUsed = isCorpsUsed(corps.corpsName);
                const overBudget = !isSelected && corps.points > remainingPoints;
                const disabled = isUsed || overBudget;

                return (
                  <button
                    key={idx}
                    onClick={() => !disabled && handlePick(corps)}
                    disabled={disabled}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-interactive/10 border-l-2 border-l-interactive'
                        : disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected && <Check className="w-4 h-4 text-interactive flex-shrink-0" />}
                      <span className="text-sm text-white font-medium truncate">
                        {corps.corpsName}
                      </span>
                      <span className="text-[10px] text-muted">
                        '{corps.sourceYear != null ? String(corps.sourceYear).slice(-2) : ''}
                      </span>
                      {isUsed && <span className="text-[10px] text-muted/70">(used)</span>}
                    </div>
                    <span
                      className={`text-xs font-bold font-data px-2 py-1 rounded-none ${
                        overBudget
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-surface-raised text-secondary'
                      }`}
                    >
                      Cost {corps.points}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-surface-sunken border-t border-line flex-shrink-0">
              <p className="text-[11px] text-muted flex items-center gap-1.5 justify-center">
                <Sparkles className="w-3 h-3 text-interactive" aria-hidden="true" />
                Your draft carries over when you create your free account
              </p>
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="mt-2 w-full h-10 border border-line text-muted text-xs font-bold uppercase tracking-wider hover:border-line-strong hover:text-white rounded-none"
                >
                  Done Drafting
                </button>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default GuestLineupPicker;
