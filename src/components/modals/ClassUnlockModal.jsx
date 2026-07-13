// =============================================================================
// CLASS UNLOCK MODAL - DATA-TERMINAL STYLE
// =============================================================================

import React, { useEffect } from 'react';
import { Unlock, Plus } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASS_INFO = {
  aClass: {
    name: 'A Class',
    description: 'Intermediate level corps with higher point limits and more competitive shows',
    budget: '60 pts',
    xpRequired: '3,000 XP',
  },
  openClass: {
    name: 'Open Class',
    description: 'Advanced level corps with expanded opportunities and prestigious competitions',
    budget: '120 pts',
    xpRequired: '5,000 XP',
  },
  worldClass: {
    name: 'World Class',
    description: 'Elite level corps competing at the highest tier of drum corps activity',
    budget: '150 pts',
    xpRequired: '10,000 XP',
  },
};

const ClassUnlockModal = ({ unlockedClass, onSetup, onDecline }) => {
  const classInfo = CLASS_INFO[unlockedClass] || CLASS_INFO.aClass;

  // Close on Escape key
  useEscapeKey(onDecline);

  // A class unlock is a major progression moment — celebrate it
  useEffect(() => {
    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-class-unlock"
      >
        <div
          className="w-full max-w-md bg-surface-card border border-line rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="modal-title-class-unlock"
              className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              Class Unlocked
            </h2>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Achievement Badge */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Unlock className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">
                Congratulations
              </p>
              {/* Unlocks come via XP level, account age, or CorpsCoin purchase —
                  don't claim a specific XP total was earned */}
              <p className="text-lg font-bold text-white">Welcome to {classInfo.name}!</p>
            </div>

            {/* Class Info Card */}
            <div className="bg-background border border-line p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">{classInfo.name}</h3>
                <span className="text-xs font-data text-interactive">{classInfo.budget}</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{classInfo.description}</p>
            </div>

            {/* Prompt */}
            <p className="text-center text-sm text-muted mb-4">
              Would you like to register a corps for {classInfo.name} now?
            </p>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
            <button
              onClick={onDecline}
              className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white"
            >
              Maybe Later
            </button>
            <button
              onClick={onSetup}
              className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Register Corps
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ClassUnlockModal;
