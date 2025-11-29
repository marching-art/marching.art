// LineupSetupStep - Caption/lineup selection for corps
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { CAPTIONS, CAPTION_CATEGORIES, POINT_LIMITS, getCorpsClassName } from '../constants';

const LineupSetupStep = ({
  currentCorpsClass,
  currentCorpsIndex,
  totalCorps,
  currentCorpsData,
  selections,
  availableCorps,
  loading,
  saving,
  onSelectionChange,
  onBack,
  onSave
}) => {
  const pointLimit = POINT_LIMITS[currentCorpsClass] || 90;

  // Calculate total points
  const totalPoints = Object.values(selections).reduce((total, selection) => {
    if (!selection) return total;
    const parts = selection.split('|');
    return total + (parseInt(parts[2]) || 0);
  }, 0);

  const remainingPoints = pointLimit - totalPoints;
  const isOverLimit = totalPoints > pointLimit;
  const isLineupComplete = Object.keys(selections).length === 8;

  const getSelectedCorps = (captionId) => {
    const selection = selections[captionId];
    if (!selection) return null;
    const parts = selection.split('|');
    return { name: parts[0], year: parts[1], points: parseInt(parts[2]) || 0 };
  };

  const handleSelectionChange = (captionId, corpsData) => {
    if (!corpsData) {
      onSelectionChange(captionId, null);
    } else {
      onSelectionChange(captionId, `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-5xl mx-auto px-2"
    >
      {/* Progress indicator */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs md:text-sm text-cream-500/60">
            Corps {currentCorpsIndex + 1} of {totalCorps}
          </span>
          <span className="text-xs md:text-sm font-semibold text-gold-500">
            {getCorpsClassName(currentCorpsClass)}
          </span>
        </div>
        <div className="h-1.5 md:h-2 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentCorpsIndex + 0.5) / totalCorps) * 100}%` }}
            className="h-full bg-gradient-gold"
          />
        </div>
      </div>

      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-gradient mb-1 md:mb-2">
          Build Your {getCorpsClassName(currentCorpsClass)} Lineup
        </h2>
        <p className="text-sm md:text-base text-cream-300">
          Select one corps for each caption within your {pointLimit}-point budget.
        </p>
        {currentCorpsData && (
          <p className="text-xs md:text-sm text-cream-500/60 mt-1 truncate">
            Corps: {currentCorpsData.corpsName} from {currentCorpsData.location}
          </p>
        )}
      </div>

      {/* Point Budget */}
      <div className="mb-4 md:mb-6 p-3 md:p-4 bg-charcoal-900/50 rounded-xl border border-cream-500/10">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <div>
            <h3 className="text-sm md:text-lg font-semibold text-cream-100">Point Budget</h3>
            <p className="text-xs md:text-sm text-cream-500/60">{pointLimit} points available</p>
          </div>
          <div className={`text-xl md:text-3xl font-bold ${
            isOverLimit ? 'text-red-500' :
            remainingPoints < 10 ? 'text-yellow-500' :
            'text-gold-500'
          }`}>
            {totalPoints} / {pointLimit}
          </div>
        </div>
        <div className="h-2 md:h-3 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }}
            className={`h-full ${
              isOverLimit ? 'bg-red-500' :
              remainingPoints < 10 ? 'bg-yellow-500' :
              'bg-gradient-gold'
            }`}
          />
        </div>
        {isOverLimit && (
          <p className="mt-2 text-xs md:text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 md:w-4 md:h-4" />
            Over budget! Remove some high-point corps.
          </p>
        )}
      </div>

      {/* Caption Selection */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-cream-500/60">Loading available corps...</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 relative">
          {CAPTION_CATEGORIES.map((category) => {
            const categoryCaptions = CAPTIONS.filter(c => c.category === category);
            const categoryColor = category === 'General Effect' ? 'gold' : category === 'Visual' ? 'blue' : 'purple';

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-charcoal-900 z-10 py-2 -mx-2 px-2">
                  <div className={`w-1 h-5 rounded flex-shrink-0 ${
                    categoryColor === 'gold' ? 'bg-gold-500' :
                    categoryColor === 'blue' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`} />
                  <h3 className="font-semibold text-cream-100 text-sm">{category}</h3>
                </div>

                {categoryCaptions.map((caption) => {
                  const selected = getSelectedCorps(caption.id);

                  return (
                    <div
                      key={caption.id}
                      className={`p-3 rounded-lg border transition-all ${
                        selected
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-cream-500/10 bg-charcoal-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {selected ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-cream-500/30 flex-shrink-0" />
                          )}
                          <span className="font-medium text-cream-100 text-sm truncate">{caption.name}</span>
                          <span className="text-xs text-cream-500/60 flex-shrink-0">({caption.id})</span>
                        </div>
                        {selected && (
                          <span className="text-gold-500 font-bold text-sm flex-shrink-0">{selected.points} pts</span>
                        )}
                      </div>

                      <select
                        className="select w-full text-sm"
                        value={selections[caption.id] || ''}
                        onChange={(e) => {
                          if (!e.target.value) {
                            handleSelectionChange(caption.id, null);
                          } else {
                            const corps = availableCorps.find(c =>
                              `${c.corpsName}|${c.sourceYear}|${c.points}` === e.target.value
                            );
                            if (corps) handleSelectionChange(caption.id, corps);
                          }
                        }}
                      >
                        <option value="">Select {caption.name}...</option>
                        {availableCorps.map((corps, idx) => {
                          const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                          const isCurrentSelection = selections[caption.id] === value;
                          const wouldExceed = !isCurrentSelection &&
                            (totalPoints - (selected?.points || 0) + corps.points > pointLimit);

                          return (
                            <option key={idx} value={value} disabled={wouldExceed}>
                              {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                              {wouldExceed ? ' [Exceeds limit]' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 md:gap-3">
        <button
          onClick={onBack}
          className="btn-ghost text-xs md:text-sm px-2 md:px-4"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Back
        </button>
        <button
          onClick={onSave}
          disabled={!isLineupComplete || isOverLimit || saving}
          className="btn-primary flex-1 text-xs md:text-sm py-2 md:py-3"
        >
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
              Saving...
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Save Lineup & Select Shows</span>
              <span className="sm:hidden">Save & Continue</span>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default LineupSetupStep;
