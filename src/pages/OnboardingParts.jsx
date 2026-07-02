// Onboarding step-3 guided caption-selection component. Extracted verbatim
// from Onboarding.jsx; the caption/color/budget constants it renders live in
// onboardingConstants.js.

import React from 'react';
import { m } from 'framer-motion';
import { Check, HelpCircle } from 'lucide-react';
import { CAPTIONS, CATEGORY_COLORS, SOUNDSPORT_POINT_LIMIT } from './onboardingConstants';

// Guided Caption Selection Component
export const GuidedCaptionSelection = ({ availableCorps, lineup, setLineup, currentCaptionIndex, setCurrentCaptionIndex }) => {
  const currentCaption = CAPTIONS[currentCaptionIndex];
  const categoryInfo = CATEGORY_COLORS[currentCaption.category];

  // Calculate current points used
  const usedPoints = Object.values(lineup).reduce((sum, val) => {
    if (!val) return sum;
    const parts = val.split('|');
    return sum + (parseInt(parts[2]) || 0);
  }, 0);

  const remainingPoints = SOUNDSPORT_POINT_LIMIT - usedPoints;

  // Get corps for selection, sorted by points
  const sortedCorps = [...availableCorps].sort((a, b) => b.points - a.points);

  // Check if a corps is already selected in another caption
  const isCorpsUsed = (corpsName) => {
    return Object.values(lineup).some(val => val && val.startsWith(corpsName + '|'));
  };

  const handleSelect = (corps) => {
    const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
    setLineup(prev => ({ ...prev, [currentCaption.id]: value }));

    // Auto-advance to next caption
    if (currentCaptionIndex < CAPTIONS.length - 1) {
      setTimeout(() => setCurrentCaptionIndex(prev => prev + 1), 300);
    }
  };

  const handleDeselect = () => {
    setLineup(prev => {
      const newLineup = { ...prev };
      delete newLineup[currentCaption.id];
      return newLineup;
    });
  };

  const selectedValue = lineup[currentCaption.id];
  const selectedCorps = selectedValue ? {
    name: selectedValue.split('|')[0],
    year: selectedValue.split('|')[1],
    points: parseInt(selectedValue.split('|')[2]) || 0
  } : null;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Caption {currentCaptionIndex + 1} of 8</span>
        <span className={`text-sm font-bold ${remainingPoints < 10 ? 'text-yellow-400' : 'text-green-400'}`}>
          {remainingPoints} pts remaining
        </span>
      </div>

      {/* Caption dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {CAPTIONS.map((cap, idx) => {
          const isSelected = lineup[cap.id];
          const isCurrent = idx === currentCaptionIndex;
          const catColors = CATEGORY_COLORS[cap.category];

          return (
            <button
              key={cap.id}
              onClick={() => setCurrentCaptionIndex(idx)}
              className={`w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold transition-all ${
                isCurrent
                  ? `${catColors.bg} ${catColors.border} border-2 ${catColors.text}`
                  : isSelected
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-charcoal-800 border border-charcoal-700 text-gray-500'
              }`}
            >
              {isSelected && !isCurrent ? <Check className="w-4 h-4" /> : cap.id}
            </button>
          );
        })}
      </div>

      {/* Current caption info */}
      <div className={`p-4 rounded-sm ${categoryInfo.bg} ${categoryInfo.border} border`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${categoryInfo.bg}`}>
            <span className={`font-bold ${categoryInfo.text}`}>{currentCaption.id}</span>
          </div>
          <div>
            <h4 className={`font-bold ${categoryInfo.text}`}>{currentCaption.fullName}</h4>
            <p className="text-xs text-gray-400">{currentCaption.description}</p>
          </div>
        </div>

        {selectedCorps && (
          <div className="mt-3 flex items-center justify-between p-2 bg-charcoal-900/50 rounded-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-white font-semibold">{selectedCorps.name}</span>
              <span className="text-xs text-gray-500">'{selectedCorps.year != null ? String(selectedCorps.year).slice(-2) : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-yellow-400">{selectedCorps.points} pts</span>
              <button
                onClick={handleDeselect}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Corps selection grid */}
      {!selectedCorps && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sortedCorps.map((corps, idx) => {
            const isUsed = isCorpsUsed(corps.corpsName);
            const wouldExceedBudget = corps.points > remainingPoints;
            const disabled = isUsed || wouldExceedBudget;

            return (
              <m.button
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => !disabled && handleSelect(corps)}
                disabled={disabled}
                className={`w-full flex items-center justify-between p-3 rounded-sm transition-all ${
                  disabled
                    ? 'bg-charcoal-900/30 border border-charcoal-800 opacity-50 cursor-not-allowed'
                    : `bg-charcoal-800 border border-charcoal-700 hover:border-[#0057B8]/50 cursor-pointer`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{corps.corpsName}</span>
                  <span className="text-xs text-gray-500">'{corps.sourceYear != null ? String(corps.sourceYear).slice(-2) : ''}</span>
                  {isUsed && <span className="text-xs text-gray-500/60">(already used)</span>}
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${
                  wouldExceedBudget ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {corps.points} pts
                </div>
              </m.button>
            );
          })}
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs text-gray-500 text-center">
        <HelpCircle className="w-3 h-3 inline mr-1" />
        Pick the historical corps you think will score best in this caption
      </p>
    </div>
  );
};
