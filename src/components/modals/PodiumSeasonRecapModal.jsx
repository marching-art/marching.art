// =============================================================================
// PODIUM SEASON RECAP MODAL — the director-sim end-of-season ceremony
// =============================================================================
// The Podium parallel to SeasonRecapModal. Shown once when
// profile.pendingPodiumRecap exists (written at the season boundary by
// functions/src/helpers/podium/career.writePendingPodiumRecap). Deliberately
// light: how the corps finished and any Corps Budget refunded — then the CTA
// routes into the full between-seasons assessment (design §5.13) on the Podium
// tab, where the class/status movement and the continue/retire/start-new
// decision live. Dismissing clears the field either way.

import React, { useEffect, useRef } from 'react';
import { Medal, Coins, Award, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { CLASS_DISPLAY_NAMES } from '../Dashboard/sections/constants';

/** @param {number|null|undefined} placement */
const placementLabel = (placement) => {
  if (!placement) return '—';
  if (placement === 1) return '🥇 1st';
  if (placement === 2) return '🥈 2nd';
  if (placement === 3) return '🥉 3rd';
  return `${placement}th`;
};

/** @param {Record<string, number>|null|undefined} medals */
const medalCount = (medals) =>
  Object.values(medals || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);

/**
 * @param {{
 *   recap?: any,
 *   onClose: () => void,
 *   onSetUpNextSeason: () => void,
 * }} props
 */
const PodiumSeasonRecapModal = ({ recap, onClose, onSetUpNextSeason }) => {
  useEscapeKey(onClose);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  // Same confetti payday as the fantasy recap — a finished season is a moment.
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

  const medals = medalCount(recap?.medals);
  const divisionLabel = CLASS_DISPLAY_NAMES[recap?.division] || 'A Class';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-podium-recap"
      >
        <div
          ref={dialogRef}
          className="w-full max-w-md max-h-[85dvh] bg-surface-card border border-brand/30 rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex items-center gap-3">
              <Medal className="w-5 h-5 text-brand" />
              <div>
                <h2
                  id="modal-title-podium-recap"
                  className="text-xs font-bold uppercase tracking-wider text-secondary"
                >
                  Podium Season Complete
                </h2>
                <p className="text-[10px] text-muted">{divisionLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="p-1 text-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            <div className="text-center">
              <p className="text-sm font-bold text-white truncate">
                {recap?.corpsName || 'Your Corps'}
              </p>
              <p className="text-3xl font-bold text-brand font-data mt-1">
                {placementLabel(recap?.placement)}
              </p>
              {recap?.placementOf ? (
                <p className="text-[11px] uppercase tracking-wider text-muted">
                  of {recap.placementOf} in {divisionLabel}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {typeof recap?.finalScore === 'number' && (
                <div className="p-3 bg-background border border-line text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Finals Score</p>
                  <p className="text-lg font-bold text-white font-data">
                    {recap.finalScore.toFixed(3)}
                  </p>
                </div>
              )}
              {medals > 0 && (
                <div className="p-3 bg-background border border-line text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Medals</p>
                  <p className="flex items-center justify-center gap-1 text-lg font-bold text-white font-data">
                    <Award className="w-4 h-4 text-brand" />
                    {medals}
                  </p>
                </div>
              )}
            </div>

            {recap?.budgetRefund > 0 && (
              <div className="p-3 bg-brand/10 border border-brand/30 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">
                  Corps Budget Refunded
                </p>
                <span className="flex items-center gap-1 text-sm font-bold text-brand font-data">
                  <Coins className="w-4 h-4" />+{recap.budgetRefund.toLocaleString()}
                </span>
              </div>
            )}

            <p className="text-[11px] text-muted text-center leading-snug">
              Your full season assessment — the class and status you earned, and next season&apos;s
              setup — is waiting on the Podium tab.
            </p>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 text-muted hover:text-white text-sm font-semibold"
            >
              Later
            </button>
            <button
              onClick={onSetUpNextSeason}
              className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover"
            >
              Set Up Next Season
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default PodiumSeasonRecapModal;
