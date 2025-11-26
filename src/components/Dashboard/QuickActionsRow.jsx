// src/components/Dashboard/QuickActionsRow.jsx
import React from 'react';
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
const CLASS_ORDER = ['world', 'open', 'aClass', 'soundSport'];

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

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Daily Rehearsal */}
        <button
          onClick={handleRehearsal}
          disabled={executionProcessing}
          className={`p-3 rounded-lg border transition-all text-left ${
            canRehearseToday()
              ? 'border-gold-500/50 bg-gold-500/10 hover:border-gold-500 hover:bg-gold-500/20'
              : 'border-green-500/30 bg-green-500/5'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {canRehearseToday() ? (
              <Activity className="w-4 h-4 text-gold-500" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
            <span className="text-xs font-semibold text-cream-100">Rehearsal</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-cream-500/60">
              {canRehearseToday() ? 'Ready!' : 'Done'}
            </span>
            {canRehearseToday() && (
              <span className="text-[10px] text-gold-500 font-semibold">+25 XP</span>
            )}
          </div>
          {executionState?.rehearsalsThisWeek !== undefined && (
            <div className="mt-1.5">
              <div className="h-1 bg-charcoal-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-gold transition-all"
                  style={{ width: `${(executionState.rehearsalsThisWeek / 7) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-cream-500/40">{executionState.rehearsalsThisWeek}/7 this week</span>
            </div>
          )}
        </button>

        {/* Corps Readiness */}
        <button
          onClick={() => onTabChange('execution')}
          className="p-3 rounded-lg border border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Target className={`w-4 h-4 ${
              readinessPercent >= 90 ? 'text-green-400' :
              readinessPercent >= 70 ? 'text-blue-400' : 'text-orange-400'
            }`} />
            <span className="text-xs font-semibold text-cream-100">Readiness</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${
              readinessPercent >= 90 ? 'text-green-400' :
              readinessPercent >= 70 ? 'text-blue-400' : 'text-orange-400'
            }`}>
              {readinessPercent.toFixed(0)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-charcoal-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                readinessPercent >= 90 ? 'bg-green-500' :
                readinessPercent >= 70 ? 'bg-blue-500' : 'bg-orange-500'
              }`}
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
        </button>

        {/* Schedule */}
        <Link
          to="/schedule"
          className="p-3 rounded-lg border border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-cream-100">Week {currentWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-cream-500/60">
              {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0} shows
            </span>
            <ChevronRight className="w-3 h-3 text-cream-500/40" />
          </div>
        </Link>

        {/* Quick Stats (Desktop) / Leaderboard Link (Mobile) */}
        <Link
          to="/leaderboard"
          className="p-3 rounded-lg border border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-4 h-4 text-gold-500" />
            <span className="text-xs font-semibold text-cream-100">Rank</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gold-500">
              {activeCorpsClass === 'soundSport' ? '🎉' : `#${activeCorps?.rank || '-'}`}
            </span>
            {activeCorpsClass !== 'soundSport' && recentScores?.length > 0 && (
              <span className="text-[10px] text-cream-500/40">
                {recentScores[0]?.totalScore?.toFixed(1) || '-'}
              </span>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
};

export default QuickActionsRow;
