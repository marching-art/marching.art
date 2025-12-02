// src/components/Dashboard/CommandCenter.jsx
import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Target, Heart, Wrench, Users, Play, Check, ChevronDown, ChevronUp,
  Zap, Calendar, Trophy, Music, TrendingUp, Sparkles
} from 'lucide-react';

/**
 * CommandCenter - Unified corps management dashboard
 * Consolidates corps performance, health metrics, and primary actions
 * Eliminates redundancy by being the SINGLE source of corps status info
 */
const CommandCenter = ({
  profile,
  activeCorps,
  activeCorpsClass,
  executionState,
  canRehearseToday,
  onRehearsal,
  rehearsalProcessing,
  currentWeek,
  corps,
  hasMultipleCorps,
  onCorpsSwitch,
  getCorpsClassName,
  assignedStaff = []
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!activeCorps) return null;

  // Calculate metrics
  const readiness = executionState?.readiness ?? 0.75;
  const morale = executionState?.morale ?? 0.80;
  const equipment = executionState?.equipment || {};

  // Calculate average equipment condition
  const equipmentValues = Object.entries(equipment)
    .filter(([k, v]) => typeof v === 'number' && !k.includes('Max'))
    .map(([, v]) => v);
  const avgEquipment = equipmentValues.length > 0
    ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
    : 0.90;

  // Staff bonus from assigned staff (max 5%)
  const staffBonus = Math.min(assignedStaff.length * 0.01, 0.05);

  // Calculate multiplier: (readiness * 40%) + (morale * 30%) + (equipment * 30%) + staffBonus
  const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);
  const multiplier = Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));

  // Get multiplier status
  const getMultiplierStatus = () => {
    if (multiplier >= 1.05) return { color: 'text-green-500', bg: 'bg-green-500', label: 'Excellent', gradient: 'from-green-500 to-emerald-600' };
    if (multiplier >= 0.95) return { color: 'text-blue-500', bg: 'bg-blue-500', label: 'Good', gradient: 'from-blue-500 to-cyan-600' };
    if (multiplier >= 0.85) return { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Fair', gradient: 'from-yellow-500 to-orange-500' };
    return { color: 'text-red-500', bg: 'bg-red-500', label: 'Needs Work', gradient: 'from-red-500 to-orange-600' };
  };

  const multiplierStatus = getMultiplierStatus();
  const rehearsalsThisWeek = executionState?.rehearsalsThisWeek ?? 0;
  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;

  // Class order for sorting
  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-premium rounded-2xl overflow-hidden"
    >
      {/* Corps Selector Header */}
      {hasMultipleCorps && (
        <div className="px-4 py-3 border-b border-cream-500/10 bg-charcoal-900/30">
          <div className="flex items-center gap-3">
            <Music className="w-4 h-4 text-gold-500" />
            <div className="flex-1 flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {Object.entries(corps)
                .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                .map(([classId, corpsData]) => (
                  <button
                    key={classId}
                    onClick={() => onCorpsSwitch(classId)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeCorpsClass === classId
                        ? 'bg-gold-500 text-charcoal-900'
                        : 'bg-charcoal-800/60 text-cream-500/70 hover:text-cream-100 hover:bg-charcoal-700'
                    }`}
                  >
                    {corpsData.corpsName || corpsData.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Command Center Content */}
      <div className="p-4 sm:p-5">
        {/* Corps Name & Primary Metrics Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          {/* Corps Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl sm:text-2xl font-bold text-cream-100 truncate">
                {activeCorps.corpsName || activeCorps.name}
              </h2>
              {activeCorpsClass !== 'soundSport' && activeCorps.rank && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-500 text-xs font-semibold">
                  <Trophy className="w-3 h-3" />
                  #{activeCorps.rank}
                </span>
              )}
            </div>
            <p className="text-sm text-cream-500/60">
              {getCorpsClassName(activeCorpsClass)} • Week {currentWeek}
            </p>
          </div>

          {/* Performance Multiplier Badge */}
          <div className="flex-shrink-0 text-center sm:text-right">
            <div className={`text-4xl sm:text-5xl font-bold ${multiplierStatus.color}`}>
              {multiplier.toFixed(2)}x
            </div>
            <div className={`text-xs font-semibold ${multiplierStatus.color} flex items-center justify-center sm:justify-end gap-1`}>
              <TrendingUp className="w-3 h-3" />
              {multiplierStatus.label}
            </div>
          </div>
        </div>

        {/* Performance Bar */}
        <div className="mb-5">
          <div className="w-full h-3 bg-charcoal-800 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((multiplier - 0.70) / 0.40) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full bg-gradient-to-r ${multiplierStatus.gradient}`}
            />
            {/* 1.0x marker */}
            <div className="absolute top-0 bottom-0 left-[75%] w-px bg-cream-500/30" />
          </div>
          <div className="flex justify-between text-[10px] text-cream-500/40 mt-1 px-0.5">
            <span>0.70x</span>
            <span>1.00x</span>
            <span>1.10x</span>
          </div>
        </div>

        {/* Health Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <HealthMetric
            icon={Target}
            label="Readiness"
            value={readiness}
            description="Corps preparation level"
          />
          <HealthMetric
            icon={Heart}
            label="Morale"
            value={morale}
            description="Member satisfaction"
          />
          <HealthMetric
            icon={Wrench}
            label="Equipment"
            value={avgEquipment}
            description="Gear condition"
          />
        </div>

        {/* Expandable Breakdown */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-cream-500/60 hover:text-cream-400 transition-colors border-t border-cream-500/10"
        >
          {showBreakdown ? 'Hide Breakdown' : 'View Multiplier Breakdown'}
          {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 text-xs">
                <div className="text-cream-500/50 mb-2 text-center">
                  (Readiness × 40%) + (Morale × 30%) + (Equipment × 30%) + Staff Bonus
                </div>
                <BreakdownRow label="Readiness" value={readiness} weight={40} />
                <BreakdownRow label="Morale" value={morale} weight={30} />
                <BreakdownRow label="Equipment" value={avgEquipment} weight={30} />
                <div className="flex justify-between items-center pt-2 border-t border-cream-500/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="text-cream-500/60">Staff Bonus ({assignedStaff.length} assigned)</span>
                  </div>
                  <span className={staffBonus > 0 ? 'text-blue-400 font-semibold' : 'text-cream-500/40'}>
                    +{(staffBonus * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-cream-500/20 font-semibold">
                  <span className="text-cream-300">Total Multiplier</span>
                  <span className={multiplierStatus.color}>{multiplier.toFixed(2)}x</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions Footer */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Rehearsal Button */}
        <button
          onClick={onRehearsal}
          disabled={!canRehearseToday || rehearsalProcessing}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
            canRehearseToday
              ? 'bg-gold-500 text-charcoal-900 hover:bg-gold-400'
              : 'bg-green-500/20 text-green-500 cursor-default'
          }`}
        >
          {rehearsalProcessing ? (
            <div className="w-5 h-5 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
          ) : canRehearseToday ? (
            <>
              <Play className="w-4 h-4" />
              <span>Rehearse</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Done</span>
            </>
          )}
        </button>

        {/* Rehearsal Progress */}
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-charcoal-800/50">
          <div className="text-lg font-bold text-blue-400">{rehearsalsThisWeek}/7</div>
          <div className="text-[10px] text-cream-500/60">This Week</div>
        </div>

        {/* Shows This Week */}
        <Link
          to="/schedule"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-charcoal-800/50 hover:bg-charcoal-700/50 transition-colors"
        >
          <div className="text-lg font-bold text-purple-400">{showsThisWeek}</div>
          <div className="text-[10px] text-cream-500/60">Shows</div>
        </Link>

        {/* Score/Rank */}
        {activeCorpsClass !== 'soundSport' ? (
          <Link
            to="/scores"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-charcoal-800/50 hover:bg-charcoal-700/50 transition-colors"
          >
            <div className="text-lg font-bold text-gold-500">
              {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
            </div>
            <div className="text-[10px] text-cream-500/60">Score</div>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-charcoal-800/50">
            <Sparkles className="w-5 h-5 text-gold-500" />
            <div className="text-[10px] text-cream-500/60">For Fun!</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Health Metric Component
const HealthMetric = memo(({ icon: Icon, label, value, description }) => {
  const percentage = Math.round(value * 100);

  const getColor = () => {
    if (percentage >= 85) return { text: 'text-green-400', bg: 'bg-green-500', border: 'border-green-500/30' };
    if (percentage >= 70) return { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30' };
    return { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30' };
  };

  const colors = getColor();

  return (
    <div className={`p-3 rounded-xl bg-charcoal-800/40 border ${colors.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colors.text}`} />
        <span className="text-xs font-medium text-cream-300">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colors.text}`}>
        {percentage}%
      </div>
      <div className="mt-2 h-1.5 bg-charcoal-900 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`h-full ${colors.bg} rounded-full`}
        />
      </div>
    </div>
  );
});

HealthMetric.displayName = 'HealthMetric';

// Breakdown Row Component
const BreakdownRow = memo(({ label, value, weight }) => {
  const percentage = Math.round(value * 100);
  const contribution = (value * weight / 100).toFixed(1);
  const isAtMax = value >= 0.99;
  const deficit = isAtMax ? 0 : ((1 - value) * weight).toFixed(1);

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-cream-500/60">{label}</span>
        <span className="text-cream-500/40">({percentage}% × {weight}%)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={isAtMax ? 'text-green-400 font-semibold' : percentage >= 85 ? 'text-yellow-400' : 'text-red-400'}>
          {contribution}%
        </span>
        {!isAtMax && deficit > 0 && (
          <span className="text-red-400/50 text-[10px]">
            (-{deficit}%)
          </span>
        )}
      </div>
    </div>
  );
});

BreakdownRow.displayName = 'BreakdownRow';

export default memo(CommandCenter);
