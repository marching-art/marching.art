// Step 0 of the season setup wizard: returning-user corps verification
// (continue / retire / unretire / move / new / skip per class). Extracted
// verbatim from SeasonSetupWizard.jsx.

import React from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trophy,
  Unlock,
} from 'lucide-react';
import { sortCorpsEntriesByClass } from '../../utils/corps';
import { POINT_LIMITS, getCorpsClassName } from './constants';

const CorpsVerificationStep = ({
  existingCorps,
  corpsDecisions,
  setCorpsDecisions,
  newCorpsData,
  setNewCorpsData,
  retiredByClass,
  eligibleNewClasses,
  getAvailableMoveTargets,
  processing,
  handleCorpsVerificationContinue,
}) => {
  return (
    <>
      <div className="bg-surface-card border border-line rounded-none">
        <div className="bg-surface-raised px-4 py-3 border-b border-line">
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
            Step 1: Manage Your Corps
          </h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted mb-4">
            Welcome back! Review your corps from last season and decide how to proceed.
          </p>

          {/* Existing Corps - sorted by class order (World → Open → A → SoundSport) */}
          {sortCorpsEntriesByClass(
            Object.entries(existingCorps).filter(([_, corps]) => corps?.corpsName)
          ).map(([classId, corps]) => {
            const decision = corpsDecisions[classId] || 'continue';
            const classRetired = retiredByClass[classId] || [];

            return (
              <div key={classId} className="bg-background border border-line p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-interactive uppercase tracking-wider block mb-1">
                      {getCorpsClassName(classId)}
                    </span>
                    <h4 className="text-sm font-bold text-white">{corps.corpsName}</h4>
                    <p className="text-xs text-muted">{corps.location}</p>
                  </div>
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'continue' })}
                    className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      decision === 'continue'
                        ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                        : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    Continue
                  </button>
                  <button
                    onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'skip' })}
                    className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      decision === 'skip'
                        ? 'bg-charcoal-500/20 border-2 border-charcoal-500 text-secondary'
                        : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                    }`}
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip
                  </button>
                  <button
                    onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'new' })}
                    className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      decision === 'new'
                        ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                        : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Start New
                  </button>
                  {getAvailableMoveTargets(classId).length > 0 && (
                    <button
                      onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'move' })}
                      className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        decision === 'move'
                          ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                          : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                      }`}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Move
                    </button>
                  )}
                  {classRetired.length > 0 && (
                    <button
                      onClick={() =>
                        setCorpsDecisions({ ...corpsDecisions, [classId]: 'unretire' })
                      }
                      className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        decision === 'unretire'
                          ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400'
                          : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Revive
                    </button>
                  )}
                </div>

                {/* Skip info message */}
                {decision === 'skip' && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <p className="text-xs text-muted">
                      This corps will sit out this season. You can re-activate it next season.
                    </p>
                  </div>
                )}

                {/* Move class selection */}
                {decision === 'move' && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                      Move to Class
                    </label>
                    <select
                      className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
                      value={newCorpsData[classId]?.targetClass || ''}
                      onChange={(e) =>
                        setNewCorpsData({
                          ...newCorpsData,
                          [classId]: { targetClass: e.target.value },
                        })
                      }
                    >
                      <option value="">Select target class...</option>
                      {getAvailableMoveTargets(classId).map((targetClassId) => (
                        <option key={targetClassId} value={targetClassId}>
                          {getCorpsClassName(targetClassId)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted mt-2">
                      Corps identity will be preserved. Season data (lineup, scores) will be reset.
                    </p>
                  </div>
                )}

                {/* New corps form when "Start New" is selected */}
                {decision === 'new' && (
                  <div className="mt-3 pt-3 border-t border-line space-y-2">
                    <input
                      type="text"
                      placeholder="New Corps Name"
                      value={newCorpsData[classId]?.corpsName || ''}
                      onChange={(e) =>
                        setNewCorpsData({
                          ...newCorpsData,
                          [classId]: { ...newCorpsData[classId], corpsName: e.target.value },
                        })
                      }
                      className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
                    />
                    <input
                      type="text"
                      placeholder="Location"
                      value={newCorpsData[classId]?.location || ''}
                      onChange={(e) =>
                        setNewCorpsData({
                          ...newCorpsData,
                          [classId]: { ...newCorpsData[classId], location: e.target.value },
                        })
                      }
                      className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
                    />
                  </div>
                )}

                {/* Unretire selection */}
                {decision === 'unretire' && classRetired.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <select
                      className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
                      value={newCorpsData[classId]?.retiredIndex ?? ''}
                      onChange={(e) =>
                        setNewCorpsData({
                          ...newCorpsData,
                          [classId]: { retiredIndex: parseInt(e.target.value) },
                        })
                      }
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
          })}

          {/* Eligible new classes (optional expansion) */}
          {eligibleNewClasses.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-blue-500" />
                Expand to New Classes (Optional)
              </h3>
              {eligibleNewClasses.map((classId) => {
                const decision = corpsDecisions[classId];
                const classRetired = retiredByClass[classId] || [];

                return (
                  <div key={classId} className="bg-background border border-line p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                          {getCorpsClassName(classId)}
                        </span>
                        <p className="text-xs text-muted">{POINT_LIMITS[classId]} point budget</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          const updated = { ...corpsDecisions };
                          delete updated[classId];
                          setCorpsDecisions(updated);
                        }}
                        className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                          !decision
                            ? 'bg-surface-card border-2 border-charcoal-500 text-secondary'
                            : 'bg-surface-card border-2 border-transparent text-muted hover:border-charcoal-500'
                        }`}
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'new' })}
                        className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                          decision === 'new'
                            ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                            : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        Register
                      </button>
                      {classRetired.length > 0 && (
                        <button
                          onClick={() =>
                            setCorpsDecisions({ ...corpsDecisions, [classId]: 'unretire' })
                          }
                          className={`p-2 rounded-none text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                            decision === 'unretire'
                              ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400'
                              : 'bg-surface-card border-2 border-transparent text-secondary hover:border-charcoal-500'
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Revive
                        </button>
                      )}
                    </div>

                    {/* New corps form */}
                    {decision === 'new' && (
                      <div className="mt-3 pt-3 border-t border-line space-y-2">
                        <input
                          type="text"
                          placeholder="Corps Name"
                          value={newCorpsData[classId]?.corpsName || ''}
                          onChange={(e) =>
                            setNewCorpsData({
                              ...newCorpsData,
                              [classId]: { ...newCorpsData[classId], corpsName: e.target.value },
                            })
                          }
                          className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
                        />
                        <input
                          type="text"
                          placeholder="Location"
                          value={newCorpsData[classId]?.location || ''}
                          onChange={(e) =>
                            setNewCorpsData({
                              ...newCorpsData,
                              [classId]: { ...newCorpsData[classId], location: e.target.value },
                            })
                          }
                          className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
                        />
                      </div>
                    )}

                    {/* Unretire selection */}
                    {decision === 'unretire' && classRetired.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-line">
                        <select
                          className="w-full h-9 px-3 bg-surface-card border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
                          value={newCorpsData[classId]?.retiredIndex ?? ''}
                          onChange={(e) =>
                            setNewCorpsData({
                              ...newCorpsData,
                              [classId]: { retiredIndex: parseInt(e.target.value) },
                            })
                          }
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
              })}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-line flex justify-end">
          <button
            onClick={handleCorpsVerificationContinue}
            disabled={processing}
            className="h-10 px-6 bg-interactive text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-interactive-hover"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-none animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default CorpsVerificationStep;
