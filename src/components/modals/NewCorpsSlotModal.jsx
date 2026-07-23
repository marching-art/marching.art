// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// NEW CORPS SLOT MODAL
// =============================================================================
// When a director clicks an empty ghost tab for an unlocked class, offer two
// paths: register a brand-new corps, or bring a retired corps from this class
// out of retirement. Only shown when there is at least one retired corps for
// this class — otherwise the caller should open CorpsRegistrationModal directly.

import React, { useRef } from 'react';
import { Plus, RotateCcw, X, Trophy } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

const NewCorpsSlotModal = ({
  onClose,
  onStartNew,
  onUnretire,
  corpsClass,
  retiredCorps = [],
  processing = false,
}) => {
  useEscapeKey(onClose);
  const dialogRef = useRef(null);
  // Trap keyboard focus inside the dialog (WCAG 2.4.3); restores on close
  useFocusTrap(dialogRef);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-new-slot"
      >
        <div
          ref={dialogRef}
          className="w-full max-w-md bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-new-slot"
              className="text-xs font-bold uppercase tracking-wider text-secondary"
            >
              Fill {CLASS_NAMES[corpsClass] || corpsClass} Slot
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-white"
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <button
              type="button"
              onClick={onStartNew}
              disabled={processing}
              className="w-full flex items-start gap-3 p-3 bg-background border border-line hover:border-interactive hover:bg-interactive/5 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 bg-interactive/10 border border-interactive/30 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-interactive" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Start a new corps</p>
                <p className="text-xs text-muted mt-0.5">
                  Register a fresh corps in {CLASS_NAMES[corpsClass] || corpsClass}.
                </p>
              </div>
            </button>

            {retiredCorps.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    Or bring back a retired corps
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>

                <div className="border border-line divide-y divide-line">
                  {retiredCorps.map((entry) => (
                    <button
                      key={entry.retiredIndex}
                      type="button"
                      onClick={() => onUnretire(entry.retiredIndex)}
                      disabled={processing}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                        <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {entry.record.corpsName}
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {entry.record.location || '—'}
                          {entry.record.totalSeasons ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-muted">
                              <Trophy className="w-3 h-3" />
                              {entry.record.totalSeasons} season
                              {entry.record.totalSeasons === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default NewCorpsSlotModal;
