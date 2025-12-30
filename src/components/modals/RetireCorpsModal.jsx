// =============================================================================
// RETIRE CORPS MODAL - ESPN DATA STYLE
// =============================================================================

import React from 'react';
import { Archive, X } from 'lucide-react';
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
          className="w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2 id="modal-title-retire-corps" className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Retire Corps
            </h2>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
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
              <p className="text-sm text-gray-300 mb-2">
                You are about to retire:
              </p>
              <p className="text-lg font-bold text-white">{corpsName}</p>
              <p className="text-xs text-gray-500">{CLASS_NAMES[corpsClass] || corpsClass}</p>
            </div>

            {/* Info */}
            <div className="bg-[#0057B8]/10 border border-[#0057B8]/30 p-3 mb-4">
              <p className="text-xs text-[#0057B8] mb-2 font-bold uppercase">
                What happens next
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• All season history preserved</li>
                <li>• Lifetime stats maintained</li>
                <li>• Can be brought out of retirement anytime</li>
                <li>• Current season data will be reset</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={retiring}
              className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
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
              ) : 'Retire'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default RetireCorpsModal;
