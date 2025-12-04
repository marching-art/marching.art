// src/components/Dashboard/QuickActionsRow.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity, Check, Target, Calendar, ChevronRight,
  Music, Users, Trophy, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Compact quick actions row for the dashboard.
 * Displays key actions (rehearsal, readiness, schedule) in a single row.
 */
// Class order for sorting: World, Open, A, SoundSport
const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

const QuickActionsRow = ({
  activeCorps,
  activeCorpsClass,
  executionState,
  executionProcessing,
  canRehearseToday,
  rehearse,
  currentWeek,
  onTabChange,
  hasMultipleCorps,
  corps,
  onCorpsSwitch,
  getCorpsClassName,
  getCorpsClassColor,
  recentScores
}) => {
  if (!activeCorps) return null;

  const handleRehearsal = async () => {
    if (canRehearseToday()) {
      const result = await rehearse();
      if (result.success) {
        toast.success(`Rehearsal complete! +${result.data?.xpGained || 25} XP`);
      }
    } else {
      toast('Rehearsal already completed today!', { icon: '✓' });
    }
  };

  const readiness = executionState?.readiness || 0.75;
  const readinessPercent = readiness * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-xl p-3"
    >
      {/* Corps Switcher (if multiple corps) */}
      {hasMultipleCorps && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-cream-500/10">
          <Music className="w-4 h-4 text-gold-500" />
          <span className="text-sm text-cream-500/60">Active:</span>
          <div className="flex-1 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {Object.entries(corps)
              .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
              .map(([classId, corpsData]) => (
              <button
                key={classId}
                onClick={() => onCorpsSwitch(classId)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCorpsClass === classId
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
                }`}
              >
                {corpsData.corpsName || corpsData.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions Grid - Dark glass tiles with neon icons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Daily Rehearsal */}
        <button
          onClick={handleRehearsal}
          disabled={executionProcessing}
          className={`action-tile text-left ${
            canRehearseToday()
              ? '!border-yellow-500/30'
              : '!border-green-500/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              canRehearseToday() ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-green-500/20 border border-green-500/30'
            }`}>
              {canRehearseToday() ? (
                <Activity className="w-4 h-4 icon-neon-gold" />
              ) : (
                <Check className="w-4 h-4 text-green-400" />
              )}
            </div>
            <span className="text-xs font-semibold text-yellow-50">Rehearsal</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-yellow-50/50">
              {canRehearseToday() ? 'Ready!' : 'Done'}
            </span>
            {canRehearseToday() && (
              <span className="text-[10px] text-yellow-400 font-semibold">+25 XP</span>
            )}
          </div>
          {executionState?.rehearsalsThisWeek !== undefined && (
            <div>
              <div className="progress-glow !h-1.5">
                <div
                  className="progress-glow-fill"
                  style={{ width: `${(executionState.rehearsalsThisWeek / 7) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-yellow-50/40 mt-1 block">{executionState.rehearsalsThisWeek}/7 this week</span>
            </div>
          )}
        </button>

        {/* Corps Readiness */}
        <button
          onClick={() => onTabChange('execution')}
          className="action-tile text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
              <Target className="w-4 h-4 icon-neon-gold" />
            </div>
            <span className="text-xs font-semibold text-yellow-50">Readiness</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-lg font-bold ${
              readinessPercent >= 90 ? 'text-green-400' :
              readinessPercent >= 70 ? 'text-blue-400' : 'text-orange-400'
            }`}>
              {readinessPercent.toFixed(0)}%
            </span>
          </div>
          <div className="progress-glow !h-1.5">
            <div
              className={`progress-glow-fill ${
                readinessPercent >= 90 ? 'status-excellent' :
                readinessPercent >= 70 ? 'status-good' : 'status-warning'
              }`}
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
        </button>

        {/* Schedule */}
        <Link
          to="/schedule"
          className="action-tile text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 icon-neon-gold" />
            </div>
            <span className="text-xs font-semibold text-yellow-50">Week {currentWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-yellow-50/50">
              {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0} shows
            </span>
            <ChevronRight className="w-4 h-4 text-yellow-50/40" />
          </div>
        </Link>

        {/* Leaderboard / Rank */}
        <Link
          to="/leaderboard"
          className="action-tile text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 icon-neon-gold" />
            </div>
            <span className="text-xs font-semibold text-yellow-50">Rank</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold score-glow">
              {activeCorpsClass === 'soundSport' ? '🎉' : `#${activeCorps?.rank || '-'}`}
            </span>
            {activeCorpsClass !== 'soundSport' && recentScores?.length > 0 && (
              <span className="text-[10px] text-yellow-50/40">
                {recentScores[0]?.totalScore?.toFixed(1) || '-'}
              </span>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
};

export default memo(QuickActionsRow);
