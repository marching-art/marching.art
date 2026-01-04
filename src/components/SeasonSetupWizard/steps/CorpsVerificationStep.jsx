// CorpsVerificationStep - Manage existing corps decisions
import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Trophy, Play, Archive,
  Plus, RotateCcw, Unlock
} from 'lucide-react';
import { ALL_CLASSES, POINT_LIMITS, getCorpsClassName } from '../constants';

const CorpsVerificationStep = ({
  existingCorps,
  retiredCorps,
  unlockedClasses,
  corpsDecisions,
  setCorpsDecisions,
  newCorpsData,
  setNewCorpsData,
  onBack,
  onContinue,
  processing
}) => {
  const existingCorpsClasses = ALL_CLASSES.filter(c => existingCorps[c]?.corpsName);
  const eligibleNewClasses = ALL_CLASSES.filter(c =>
    unlockedClasses.includes(c) && !existingCorps[c]?.corpsName
  );

  // Group retired corps by class
  const retiredByClass = {};
  retiredCorps.forEach((rc, idx) => {
    if (!retiredByClass[rc.corpsClass]) retiredByClass[rc.corpsClass] = [];
    retiredByClass[rc.corpsClass].push({ ...rc, index: idx });
  });

  const renderCorpsCard = (classId, corps, isExisting = true) => {
    const decision = corpsDecisions[classId] || (isExisting ? 'continue' : undefined);
    const classRetired = retiredByClass[classId] || [];

    return (
      <div key={classId} className="glass rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className={`badge ${isExisting ? 'badge-primary' : 'badge-ghost'} text-xs mb-1`}>
              {getCorpsClassName(classId)}
            </span>
            {isExisting ? (
              <>
                <h4 className="font-semibold text-cream-100">{corps.corpsName}</h4>
                <p className="text-xs text-cream-500/60">{corps.location}</p>
                {corps.seasonHistory?.length > 0 && (
                  <p className="text-xs text-gold-500 mt-1">
                    {corps.seasonHistory.length} seasons competed
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-cream-500/60 mt-1">
                {POINT_LIMITS[classId]} point budget
              </p>
            )}
          </div>
        </div>

        <div className={`grid ${isExisting ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2`}>
          {isExisting ? (
            <>
              <button
                onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'continue' })}
                className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  decision === 'continue'
                    ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                    : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
                }`}
              >
                <Play className="w-4 h-4" />
                Continue
              </button>
              <button
                onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'retire' })}
                className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  decision === 'retire'
                    ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-400'
                    : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
                }`}
              >
                <Archive className="w-4 h-4" />
                Retire
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                const updated = { ...corpsDecisions };
                delete updated[classId];
                setCorpsDecisions(updated);
              }}
              className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                !decision
                  ? 'bg-charcoal-700 border-2 border-cream-500/30 text-cream-300'
                  : 'bg-charcoal-800 border-2 border-transparent text-cream-500/60 hover:border-cream-500/30'
              }`}
            >
              Skip
            </button>
          )}
          <button
            onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'new' })}
            className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
              decision === 'new'
                ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
            }`}
          >
            <Plus className="w-4 h-4" />
            {isExisting ? 'Start New' : 'Register'}
          </button>
          {classRetired.length > 0 && (
            <button
              onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'unretire' })}
              className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                decision === 'unretire'
                  ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400'
                  : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Unretire
            </button>
          )}
        </div>

        {/* New corps form */}
        {decision === 'new' && (
          <div className="mt-3 pt-3 border-t border-cream-500/10 space-y-2">
            <input
              type="text"
              placeholder={isExisting ? 'New Corps Name' : 'Corps Name'}
              value={newCorpsData[classId]?.corpsName || ''}
              onChange={(e) => setNewCorpsData({
                ...newCorpsData,
                [classId]: { ...newCorpsData[classId], corpsName: e.target.value }
              })}
              className="input input-sm w-full"
            />
            <input
              type="text"
              placeholder="Location"
              value={newCorpsData[classId]?.location || ''}
              onChange={(e) => setNewCorpsData({
                ...newCorpsData,
                [classId]: { ...newCorpsData[classId], location: e.target.value }
              })}
              className="input input-sm w-full"
            />
          </div>
        )}

        {/* Unretire selection */}
        {decision === 'unretire' && classRetired.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cream-500/10">
            <select
              className="select select-sm w-full"
              value={newCorpsData[classId]?.retiredIndex ?? ''}
              onChange={(e) => setNewCorpsData({
                ...newCorpsData,
                [classId]: { retiredIndex: parseInt(e.target.value) }
              })}
            >
              <option value="">Select corps to unretire...</option>
              {classRetired.map((rc) => (
                <option key={rc.index} value={rc.index}>
                  {rc.corpsName} ({rc.totalSeasons} seasons)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-4xl mx-auto px-2"
    >
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-gradient mb-1 md:mb-2">
          Manage Your Corps
        </h2>
        <p className="text-sm md:text-base text-cream-300">
          Review your corps from last season and decide how to proceed.
        </p>
      </div>

      {/* Existing Corps */}
      {existingCorpsClasses.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold-500" />
            Your Existing Corps
          </h3>
          <div className="space-y-3">
            {existingCorpsClasses.map(classId =>
              renderCorpsCard(classId, existingCorps[classId], true)
            )}
          </div>
        </div>
      )}

      {/* Eligible new classes */}
      {eligibleNewClasses.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-blue-500" />
            Expand to New Classes
          </h3>
          <div className="space-y-3">
            {eligibleNewClasses.map(classId =>
              renderCorpsCard(classId, null, false)
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 md:gap-3 mt-6">
        <button
          onClick={onBack}
          className="btn-ghost text-xs md:text-sm px-2 md:px-4"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={processing}
          className="btn-primary flex-1 text-xs md:text-sm py-2 md:py-3"
        >
          {processing ? (
            <>
              <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-sm mr-2" />
              Processing...
            </>
          ) : (
            <>
              Continue to Lineup Setup
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default CorpsVerificationStep;
