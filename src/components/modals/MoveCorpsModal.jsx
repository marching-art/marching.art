// =============================================================================
// MOVE CORPS MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState } from 'react';
import { Lock, Check, X } from 'lucide-react';
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

const MoveCorpsModal = ({ onClose, onMove, currentClass, corpsName, unlockedClasses, existingCorps, transferring }) => {
  const [selectedClass, setSelectedClass] = useState('');

  // Close on Escape key
  useEscapeKey(onClose);

  const availableClasses = AVAILABLE_CLASSES.filter(cls =>
    cls.id !== currentClass &&
    unlockedClasses.includes(cls.id) &&
    !existingCorps[cls.id]
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
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2 id="modal-title-move-corps" className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Transfer Corps
            </h2>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Corps Info */}
            <div className="bg-[#0a0a0a] border border-[#333] p-3 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Moving:</p>
              <p className="text-sm font-bold text-white">{corpsName}</p>
              <p className="text-xs text-gray-500 mt-1">
                From: <span className="text-gray-300">{CLASS_NAMES[currentClass]}</span>
              </p>
            </div>

            {availableClasses.length === 0 ? (
              <div className="text-center py-6">
                <Lock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-2">No classes available</p>
                <p className="text-xs text-gray-600">
                  Either you haven't unlocked other classes, or you already have a corps in each available class.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Select Target Class
                  </label>
                  <div className="border border-[#333] divide-y divide-[#333]">
                    {availableClasses.map((cls) => {
                      const isSelected = selectedClass === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => setSelectedClass(cls.id)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5
                            ${isSelected ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''}
                          `}
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{cls.name}</p>
                            <p className="text-xs text-gray-500">{cls.level}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#0057B8]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 mt-4">
                  <p className="text-xs text-yellow-400">
                    <strong>Note:</strong> Your corps name and identity will be preserved, but season-specific data (lineup, show selections, scores) will be reset. Each corps can only transfer once per season.
                  </p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#333]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedClass || transferring}
                    className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed"
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
