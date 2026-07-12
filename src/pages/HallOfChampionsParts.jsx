// Presentational pieces extracted from HallOfChampions.jsx (max-lines
// guardrail): the SoundSport blue-ribbon icon and the champion's
// hang-a-banner purchase modal. No data fetching lives here.

import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Flag, Coins, X, Trophy } from 'lucide-react';
import Portal from '../components/Portal';
import { HALL_BANNER_PRICE, HALL_BANNER_MAX_LENGTH } from '../utils/prestige';

/** Empty state for a division with no crowned seasons yet. */
export const NoChampionsPanel = ({ label }) => (
  <div className="bg-[#1a1a1a] border border-[#333] p-10 text-center max-w-md mx-auto my-8">
    <div className="w-14 h-14 mx-auto mb-4 border border-[#333] flex items-center justify-center">
      <Trophy className="w-7 h-7 text-muted" />
    </div>
    <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2">
      No {label} Champions Yet
    </h3>
    <p className="text-sm text-gray-400 leading-relaxed">
      Once a season concludes, its champions will be inducted here.
    </p>
  </div>
);

// Blue Ribbon icon for SoundSport "Best in Show" recognition (matches the
// award used on the Scores page). Local copy avoids importing the heavy
// ScoresParts page module.
export const BlueRibbonIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="9" r="7" fill="#0057B8" stroke="#003d82" strokeWidth="1" />
    <circle cx="12" cy="9" r="4" fill="#0066d6" />
    <path
      d="M12 5.5l1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.1l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.5z"
      fill="#FFD700"
    />
    <path d="M8 15l-2 7 4-2.5V15H8z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
    <path d="M16 15l2 7-4-2.5V15h2z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
  </svg>
);

/**
 * The champion-only banner purchase modal (10,000 CC, one per championship).
 * Fully controlled: open/message/purchasing state and the confirm handler
 * live in HallOfChampions, which owns the callable + local-state patch.
 */
export const BannerModal = ({ open, message, purchasing, onMessageChange, onClose, onConfirm }) => (
  <AnimatePresence>
    {open && (
      <Portal>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => !purchasing && onClose()}
        >
          <m.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="bg-[#1a1a1a] border border-[#333] rounded-none max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-4 h-4 text-yellow-500" />
                Hang Your Banner
              </h3>
              <button
                onClick={onClose}
                disabled={purchasing}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">
                Your message hangs on this championship plaque permanently, visible to every
                director who visits the Hall. One banner per championship — choose your words.
              </p>
              <textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                maxLength={HALL_BANNER_MAX_LENGTH}
                rows={2}
                placeholder="e.g. Forged in the summer of 2026."
                className="w-full bg-[#111] border border-[#333] rounded-none px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
              />
              <div className="flex items-center justify-between mt-1 mb-4">
                <span className="text-[10px] text-muted font-data tabular-nums">
                  {message.length}/{HALL_BANNER_MAX_LENGTH}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400 font-data tabular-nums">
                  <Coins className="w-3 h-3 text-yellow-500" />
                  {HALL_BANNER_PRICE.toLocaleString()} CorpsCoin
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={purchasing}
                  className="flex-1 py-2.5 px-4 bg-[#222] hover:bg-[#333] border border-[#333] text-white text-xs font-bold uppercase tracking-wider rounded-none transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={purchasing || !message.trim()}
                  className="flex-1 py-2.5 px-4 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {purchasing ? 'Hanging…' : 'Hang Banner'}
                </button>
              </div>
            </div>
          </m.div>
        </m.div>
      </Portal>
    )}
  </AnimatePresence>
);
