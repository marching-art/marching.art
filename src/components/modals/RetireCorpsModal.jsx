// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// RETIRE CORPS MODAL - DATA-TERMINAL STYLE
// =============================================================================

import React from 'react';
import { Archive, X, AlertTriangle } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

const RetireCorpsModal = ({
  onClose,
  onConfirm,
  corpsName,
  corpsClass,
  retiring,
  hasPendingWork = false,
}) => {
  // Close on Escape key
  useEscapeKey(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-retire-corps"
      >
        <div
          className="w-full max-w-sm bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-retire-corps"
              className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              Retire Corps
            </h2>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Icon */}
            <div className="w-12 h-12 mx-auto mb-4 bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Archive className="w-6 h-6 text-orange-500" />
            </div>

            {/* Message */}
            <div className="text-center mb-4">
              <p className="text-sm text-secondary mb-2">You are about to retire:</p>
              <p className="text-lg font-bold text-white">{corpsName}</p>
              <p className="text-xs text-muted">{CLASS_NAMES[corpsClass] || corpsClass}</p>
            </div>

            {/* Info */}
            <div className="bg-interactive/10 border border-interactive/30 p-3 mb-4">
              <p className="text-xs text-interactive mb-2 font-bold uppercase">What happens next</p>
              <ul className="text-xs text-muted space-y-1">
                <li>• All season history preserved</li>
                <li>• Lifetime stats maintained</li>
                <li>• Can be brought out of retirement anytime</li>
              </ul>
            </div>

            {hasPendingWork && (
              <div className="bg-orange-500/10 border border-orange-500/30 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-orange-400 font-bold uppercase mb-1">
                      Your caption lineup and show schedule will be cleared
                    </p>
                    <p className="text-xs text-orange-300/80">
                      You haven't competed yet this season, so retiring is still allowed — but any
                      captions you've picked and shows you've scheduled for this corps will be wiped
                      and need to be reselected.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={retiring}
              className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={retiring}
              className="h-9 px-4 bg-orange-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2"
            >
              {retiring ? (
                <>
                  <Archive className="w-4 h-4 animate-pulse" />
                  Retiring...
                </>
              ) : (
                'Retire'
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default RetireCorpsModal;
