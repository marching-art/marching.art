// =============================================================================
// MOVE CORPS MODAL - DATA-TERMINAL STYLE
// =============================================================================

import React, { useState } from 'react';
import { Lock, Check, X, AlertTriangle } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

const AVAILABLE_CLASSES = [
  { id: 'soundSport', name: 'SoundSport', level: 'Entry' },
  { id: 'aClass', name: 'A Class', level: 'Intermediate' },
  { id: 'openClass', name: 'Open Class', level: 'Advanced' },
  { id: 'worldClass', name: 'World Class', level: 'Elite' },
];

const MoveCorpsModal = ({
  onClose,
  onMove,
  currentClass,
  corpsName,
  unlockedClasses,
  existingCorps,
  transferring,
  hasPendingWork = false,
}) => {
  const [selectedClass, setSelectedClass] = useState('');

  // Close on Escape key
  useEscapeKey(onClose);

  const availableClasses = AVAILABLE_CLASSES.filter(
    (cls) => cls.id !== currentClass && unlockedClasses.includes(cls.id) && !existingCorps[cls.id]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass && !transferring) {
      onMove(selectedClass);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-move-corps"
      >
        <div
          className="w-full max-w-md bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-move-corps"
              className="text-xs font-bold uppercase tracking-wider text-secondary"
            >
              Transfer Corps
            </h2>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Corps Info */}
            <div className="bg-background border border-line p-3 mb-4">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Moving:</p>
              <p className="text-sm font-bold text-white">{corpsName}</p>
              <p className="text-xs text-muted mt-1">
                From: <span className="text-secondary">{CLASS_NAMES[currentClass]}</span>
              </p>
            </div>

            {availableClasses.length === 0 ? (
              <div className="text-center py-6">
                <Lock className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted mb-2">No classes available</p>
                <p className="text-xs text-muted">
                  Either you haven't unlocked other classes, or you already have a corps in each
                  available class.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Select Target Class
                  </label>
                  <div className="border border-line divide-y divide-line">
                    {availableClasses.map((cls) => {
                      const isSelected = selectedClass === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => setSelectedClass(cls.id)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5
                            ${isSelected ? 'bg-interactive/10 border-l-2 border-l-interactive' : ''}
                          `}
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{cls.name}</p>
                            <p className="text-xs text-muted">{cls.level}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-interactive" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-warning/10 border border-warning/30 p-3 mt-4">
                  <p className="text-xs text-warning">
                    <strong>Note:</strong> Your corps name, identity, and full season history travel
                    with it — past seasons keep the class they were competed in. Current-season data
                    (lineup, show selections, scores) will be reset. Each corps can only transfer
                    once per season.
                  </p>
                </div>

                {hasPendingWork && (
                  <div className="bg-orange-500/10 border border-orange-500/30 p-3 mt-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-orange-300/90">
                        You've already picked captions or scheduled shows for this corps. Those
                        selections will be cleared on move and will need to be reselected in the new
                        class.
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedClass || transferring}
                    className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transferring ? 'Transferring...' : 'Transfer Corps'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default MoveCorpsModal;
