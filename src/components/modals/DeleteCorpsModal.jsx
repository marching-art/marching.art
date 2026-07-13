// =============================================================================
// DELETE CORPS MODAL - DATA-TERMINAL STYLE
// =============================================================================

import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

const DeleteCorpsModal = ({ onClose, onConfirm, corpsName, corpsClass }) => {
  // Close on Escape key
  useEscapeKey(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-delete-corps"
      >
        <div
          className="w-full max-w-sm bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-delete-corps"
              className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Confirm Delete
            </h2>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Icon */}
            <div className="w-12 h-12 mx-auto mb-4 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>

            {/* Message */}
            <div className="text-center mb-4">
              <p className="text-sm text-secondary mb-2">You are about to delete:</p>
              <p className="text-lg font-bold text-white">{corpsName}</p>
              <p className="text-xs text-muted">{CLASS_NAMES[corpsClass] || corpsClass}</p>
            </div>

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4">
              <p className="text-xs text-red-400 mb-2 font-bold uppercase">This cannot be undone</p>
              <ul className="text-xs text-red-300/80 space-y-1">
                <li>• Caption lineup</li>
                <li>• Show selections</li>
                <li>• Performance history</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="h-9 px-4 bg-red-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default DeleteCorpsModal;
