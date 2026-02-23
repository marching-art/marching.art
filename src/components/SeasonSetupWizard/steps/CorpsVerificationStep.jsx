// CorpsVerificationStep - Manage existing corps decisions
import React from 'react';
import { m } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Trophy, Play, Archive,
  Plus, RotateCcw, Unlock, SkipForward, ArrowRightLeft
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

  // Available classes to move an existing corps to (any other unlocked class)
  const getAvailableMoveTargets = (currentClassId) => {
    return ALL_CLASSES.filter(c =>
      c !== currentClassId &&
      unlockedClasses.includes(c)
    );
  };

  // Compute which classes are being displaced by move chains
  const getDisplacedClasses = () => {
    const displaced = new Set();
    const walkChain = (targetClass, displacement) => {
      if (!targetClass || !existingCorps[targetClass]?.corpsName) return;
      displaced.add(targetClass);
      if (displacement?.action === 'move' && displacement.targetClass) {
        walkChain(displacement.targetClass, displacement.displacement);
      }
    };
    Object.entries(corpsDecisions).forEach(([classId, action]) => {
      if (action === 'move' && newCorpsData[classId]?.targetClass) {
        walkChain(newCorpsData[classId].targetClass, newCorpsData[classId].displacement);
      }
    });
    return displaced;
  };

  const displacedClasses = getDisplacedClasses();

  // Validate that all displacement chains are complete
  const isChainComplete = (displacedClass, displacement) => {
    if (!existingCorps[displacedClass]?.corpsName) return true;
    if (!displacement || !displacement.action) return false;
    if (displacement.action === 'retire') return true;
    if (displacement.action === 'move') {
      if (!displacement.targetClass) return false;
      if (existingCorps[displacement.targetClass]?.corpsName) {
        return isChainComplete(displacement.targetClass, displacement.displacement);
      }
      return true;
    }
    return false;
  };

  const allDisplacementsResolved = (() => {
    for (const [classId, action] of Object.entries(corpsDecisions)) {
      if (action === 'move') {
        const data = newCorpsData[classId];
        if (!data?.targetClass) continue;
        if (existingCorps[data.targetClass]?.corpsName) {
          if (!isChainComplete(data.targetClass, data.displacement)) return false;
        }
      }
    }
    return true;
  })();

  // Render a displacement decision panel (recursive for chains)
  const renderDisplacementPanel = (displacedClassId, displacement, onDisplacementChange, usedClasses, depth = 0) => {
    const displacedCorps = existingCorps[displacedClassId];
    if (!displacedCorps?.corpsName) return null;

    const moveTargets = ALL_CLASSES.filter(c =>
      !usedClasses.has(c) && unlockedClasses.includes(c)
    );

    return (
      <div className={`mt-2 p-3 border rounded-sm ${depth === 0 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-orange-500/10 border-orange-500/30'}`}>
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className="w-3 h-3 text-orange-400 flex-shrink-0" />
          <p className="text-xs font-bold text-orange-400">
            "{displacedCorps.corpsName}" ({getCorpsClassName(displacedClassId)}) needs a new home
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onDisplacementChange({ action: 'retire' })}
            className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
              displacement?.action === 'retire'
                ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-400'
                : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
            }`}
          >
            <Archive className="w-3 h-3" />
            Retire
          </button>
          {moveTargets.length > 0 && (
            <button
              type="button"
              onClick={() => onDisplacementChange({ action: 'move' })}
              className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                displacement?.action === 'move'
                  ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                  : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3" />
              Move
            </button>
          )}
        </div>

        {displacement?.action === 'move' && moveTargets.length > 0 && (
          <div className="mt-2">
            <select
              className="select select-sm w-full"
              value={displacement.targetClass || ''}
              onChange={(e) => onDisplacementChange({ action: 'move', targetClass: e.target.value })}
            >
              <option value="">Select target class...</option>
              {moveTargets.map((targetId) => (
                <option key={targetId} value={targetId}>
                  {getCorpsClassName(targetId)}{existingCorps[targetId]?.corpsName ? ` (has ${existingCorps[targetId].corpsName})` : ''}
                </option>
              ))}
            </select>

            {/* Recursive displacement if target is occupied */}
            {displacement.targetClass && existingCorps[displacement.targetClass]?.corpsName &&
              renderDisplacementPanel(
                displacement.targetClass,
                displacement.displacement,
                (nestedDisplacement) => onDisplacementChange({
                  ...displacement,
                  displacement: nestedDisplacement
                }),
                new Set([...usedClasses, displacement.targetClass]),
                depth + 1
              )
            }
          </div>
        )}
      </div>
    );
  };

  const renderCorpsCard = (classId, corps, isExisting = true) => {
    const decision = corpsDecisions[classId] || (isExisting ? 'continue' : undefined);
    const classRetired = retiredByClass[classId] || [];
    const moveTargets = isExisting ? getAvailableMoveTargets(classId) : [];
    const isDisplaced = displacedClasses.has(classId);

    return (
      <div key={classId} className={`glass rounded-sm p-4 ${isDisplaced ? 'border-orange-500/30 opacity-60' : ''}`}>
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

        {/* Displaced indicator */}
        {isExisting && isDisplaced ? (
          <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-sm">
            <p className="text-xs text-orange-400 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3 h-3 flex-shrink-0" />
              Being displaced by a move — managed in the move section above
            </p>
          </div>
        ) : (
        <>
        <div className={`grid ${isExisting ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'} gap-2`}>
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
                onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'skip' })}
                className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  decision === 'skip'
                    ? 'bg-gray-500/20 border-2 border-gray-500 text-cream-300'
                    : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
                }`}
              >
                <SkipForward className="w-4 h-4" />
                Skip
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
          {isExisting && moveTargets.length > 0 && (
            <button
              onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'move' })}
              className={`p-2 rounded-sm text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                decision === 'move'
                  ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                  : 'bg-charcoal-800 border-2 border-transparent text-cream-300 hover:border-cream-500/30'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Move
            </button>
          )}
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

        {/* Skip info message */}
        {isExisting && decision === 'skip' && (
          <div className="mt-3 pt-3 border-t border-cream-500/10">
            <p className="text-xs text-cream-500/60">
              This corps will sit out this season. You can re-activate it next season.
            </p>
          </div>
        )}

        {/* Move class selection with displacement chain */}
        {isExisting && decision === 'move' && moveTargets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cream-500/10">
            <label className="block text-[10px] font-semibold text-cream-500/60 uppercase tracking-wider mb-2">
              Move to Class
            </label>
            <select
              className="select select-sm w-full"
              value={newCorpsData[classId]?.targetClass || ''}
              onChange={(e) => setNewCorpsData({
                ...newCorpsData,
                [classId]: { targetClass: e.target.value }
              })}
            >
              <option value="">Select target class...</option>
              {moveTargets.map((targetClassId) => (
                <option key={targetClassId} value={targetClassId}>
                  {getCorpsClassName(targetClassId)}{existingCorps[targetClassId]?.corpsName ? ` (has ${existingCorps[targetClassId].corpsName})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-cream-500/60 mt-2">
              Corps identity will be preserved. Season data (lineup, scores) will be reset.
            </p>

            {/* Displacement chain handling */}
            {newCorpsData[classId]?.targetClass && existingCorps[newCorpsData[classId].targetClass]?.corpsName &&
              renderDisplacementPanel(
                newCorpsData[classId].targetClass,
                newCorpsData[classId].displacement,
                (displacement) => setNewCorpsData({
                  ...newCorpsData,
                  [classId]: { ...newCorpsData[classId], displacement }
                }),
                new Set([classId, newCorpsData[classId].targetClass])
              )
            }
          </div>
        )}

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

        {/* End of displaced ternary */}
        </>
        )}
      </div>
    );
  };

  return (
    <m.div
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
      <div className="flex gap-2 md:gap-3 mt-6 items-center">
        <button
          onClick={onBack}
          className="btn-ghost text-xs md:text-sm px-2 md:px-4"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Back
        </button>
        {!allDisplacementsResolved && (
          <p className="text-[10px] text-orange-400 flex-shrink-0">
            Resolve displaced corps first
          </p>
        )}
        <button
          onClick={onContinue}
          disabled={processing || !allDisplacementsResolved}
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
    </m.div>
  );
};

export default CorpsVerificationStep;
