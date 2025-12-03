// src/components/Dashboard/CommandCenter.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Target, Heart, Wrench, Users, Play, Check, ChevronRight,
  Trophy, Music, TrendingUp, Sparkles, AlertCircle, Calendar
} from 'lucide-react';
import { Card } from '../ui/Card';

/**
 * CommandCenter - Unified corps management HUD
 *
 * Design Philosophy: "Surface Status, Drill for Detail"
 * - All critical metrics visible at a glance (no tabs!)
 * - Action cards link to modals/pages for deep management
 * - The dashboard is a HUD, not a filing cabinet
 */

// HUD-style animated status bar component with traffic light colors and ruler overlay
const StatusBar = memo(({ label, value, icon: Icon }) => {
  const percentage = Math.round(value * 100);

  // Traffic light colors: Low = Red, Mid = Yellow, High = Blue/Green
  const getTrafficLightColor = (pct) => {
    if (pct >= 85) return { text: 'text-emerald-400', bg: 'bg-emerald-500', label: 'text-emerald-300' };
    if (pct >= 70) return { text: 'text-blue-400', bg: 'bg-blue-500', label: 'text-blue-300' };
    if (pct >= 50) return { text: 'text-yellow-400', bg: 'bg-yellow-500', label: 'text-yellow-300' };
    return { text: 'text-red-400', bg: 'bg-red-500', label: 'text-red-300' };
  };

  const colors = getTrafficLightColor(percentage);

  return (
    <div className="group">
      {/* Label row */}
      <div className="flex justify-between items-center mb-2">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-widest font-bold ${colors.label}`}>
          <Icon size={14} strokeWidth={2.5} />
          {label}
        </div>
      </div>
      {/* HUD-style progress bar with ruler pattern */}
      <div className="relative h-6 w-full bg-charcoal-950 border-2 border-charcoal-700 overflow-hidden" style={{ borderRadius: '2px' }}>
        {/* Ruler pattern overlay */}
        <div className="absolute inset-0 hud-ruler-pattern opacity-30" />
        {/* Progress fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`absolute inset-y-0 left-0 ${colors.bg}`}
          style={{ borderRadius: '1px' }}
        />
        {/* Percentage text inside bar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-black text-sm text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

// Action card component for the right column
const ActionCard = memo(({
  icon: Icon,
  iconColor,
  borderColor,
  title,
  subtitle,
  warning,
  actionLabel,
  actionVariant = 'chevron', // 'button' | 'chevron'
  onAction,
  disabled = false,
  processing = false
}) => {
  const borderColorClass = {
    blue: 'border-l-blue-500',
    orange: 'border-l-orange-500',
    purple: 'border-l-purple-500',
    green: 'border-l-green-500',
    gold: 'border-l-gold-500',
  }[borderColor] || 'border-l-cream-500';

  const iconColorClass = {
    blue: 'text-blue-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    gold: 'text-gold-400',
  }[iconColor] || 'text-cream-400';

  return (
    <Card
      variant="interactive"
      padding="sm"
      className={`flex items-center justify-between border-l-4 ${borderColorClass} ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Icon size={16} className={iconColorClass} />
          <span className="truncate">{title}</span>
        </h3>
        {warning ? (
          <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
            <AlertCircle size={10} />
            {warning}
          </p>
        ) : subtitle ? (
          <p className="text-xs text-cream-500/60 mt-1">{subtitle}</p>
        ) : null}
      </div>

      {actionVariant === 'button' ? (
        <button
          onClick={onAction}
          disabled={disabled || processing}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
            disabled
              ? 'bg-green-500/20 text-green-400 cursor-default'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
          }`}
        >
          {processing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : disabled ? (
            <>
              <Check size={14} />
              Done
            </>
          ) : (
            <>
              <Play size={14} />
              {actionLabel || 'Start'}
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onAction}
          className="text-cream-400 hover:text-white hover:bg-white/5 p-2 rounded-full transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </Card>
  );
});

ActionCard.displayName = 'ActionCard';

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
  assignedStaff = [],
  // New props for unified HUD
  onOpenEquipmentModal,
  onOpenStaffModal,
}) => {
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
    if (multiplier >= 1.05) return { color: 'text-green-400', label: 'Excellent' };
    if (multiplier >= 0.95) return { color: 'text-blue-400', label: 'Good' };
    if (multiplier >= 0.85) return { color: 'text-yellow-400', label: 'Fair' };
    return { color: 'text-red-400', label: 'Needs Work' };
  };

  const multiplierStatus = getMultiplierStatus();
  const rehearsalsThisWeek = executionState?.rehearsalsThisWeek ?? 0;
  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;
  const equipmentNeedsRepair = avgEquipment < 0.85;
  const staffSlotsFilled = assignedStaff.length;
  const maxStaffSlots = 8;

  // Class order for sorting
  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  // Class badge colors
  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900',
    openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white',
    soundSport: 'bg-green-500 text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Corps Selector - Only show if multiple corps */}
      {hasMultipleCorps && (
        <div className="flex items-center gap-3 px-1">
          <Music className="w-4 h-4 text-gold-500 flex-shrink-0" />
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
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
      )}

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT: Hero Card - HUD-style Corps Status (8 cols) */}
        <Card variant="premium" padding="none" className="lg:col-span-8 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-5 pointer-events-none">
            <Trophy size={192} />
          </div>

          {/* HUD HEADER - Full-width Corps Name with distinct background */}
          <div className="hud-header relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`} style={{ borderRadius: '2px' }}>
                {getCorpsClassName(activeCorpsClass)}
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-black text-white dark:text-cream-100 tracking-tight uppercase">
                {activeCorps.corpsName || activeCorps.name}
              </h2>
              {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-gold-500/20 text-gold-400 text-[10px] font-bold" style={{ borderRadius: '2px' }}>
                  <Trophy size={10} />
                  TOP 10
                </span>
              )}
            </div>
            {activeCorps.showConcept && (
              <p className="hidden sm:block text-cream-400 dark:text-cream-500 text-xs">
                <span className="text-gold-500 font-semibold">SHOW:</span> "{activeCorps.showConcept}"
              </p>
            )}
          </div>

          {/* HUD QUADRANT GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 relative z-10">

            {/* QUADRANT 1: Performance Multiplier */}
            <div className="hud-quadrant p-4 sm:p-5 border-b sm:border-b-0 sm:border-r hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-2">
                PERFORMANCE MULTIPLIER
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl sm:text-6xl font-display font-black tabular-nums tracking-tighter ${multiplierStatus.color}`}>
                  {multiplier.toFixed(2)}
                </span>
                <span className={`text-2xl font-display font-bold ${multiplierStatus.color}`}>x</span>
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider ${multiplierStatus.color} flex items-center gap-1 mt-2`}>
                <TrendingUp size={14} strokeWidth={2.5} />
                {multiplierStatus.label}
              </div>
            </div>

            {/* QUADRANT 2: Quick Stats */}
            <div className="hud-quadrant p-4 sm:p-5 border-b hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                WEEKLY STATUS
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-mono font-black text-blue-400">{rehearsalsThisWeek}/7</div>
                  <div className="text-[9px] text-cream-500/60 uppercase tracking-wider font-semibold">Rehearsals</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-mono font-black text-purple-400">{showsThisWeek}</div>
                  <div className="text-[9px] text-cream-500/60 uppercase tracking-wider font-semibold">Shows</div>
                </div>
                {activeCorpsClass !== 'soundSport' && (
                  <div className="text-center">
                    <div className="text-2xl font-mono font-black text-gold-400">
                      {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-[9px] text-cream-500/60 uppercase tracking-wider font-semibold">Score</div>
                  </div>
                )}
              </div>
            </div>

            {/* QUADRANT 3: Health Metrics (spans full width on mobile, left side on desktop) */}
            <div className="hud-quadrant p-4 sm:p-5 sm:col-span-1 border-b sm:border-b-0 sm:border-r hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                CORPS HEALTH METRICS
              </div>
              <div className="space-y-3">
                <StatusBar
                  label="Readiness"
                  value={readiness}
                  icon={Target}
                />
                <StatusBar
                  label="Morale"
                  value={morale}
                  icon={Heart}
                />
                <StatusBar
                  label="Equipment"
                  value={avgEquipment}
                  icon={Wrench}
                />
              </div>
            </div>

            {/* QUADRANT 4: Quick Actions */}
            <div className="hud-quadrant p-4 sm:p-5">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                QUICK ACTIONS
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  to="/schedule"
                  className="flex items-center gap-3 p-3 bg-charcoal-800/50 hover:bg-charcoal-700/50 text-cream-300 hover:text-white transition-colors border border-charcoal-700/50"
                  style={{ borderRadius: '2px' }}
                >
                  <Calendar size={18} />
                  <span className="text-sm font-semibold uppercase tracking-wide">View Schedule</span>
                </Link>
                <Link
                  to="/scores"
                  className="flex items-center gap-3 p-3 bg-charcoal-800/50 hover:bg-charcoal-700/50 text-cream-300 hover:text-white transition-colors border border-charcoal-700/50"
                  style={{ borderRadius: '2px' }}
                >
                  <Trophy size={18} />
                  <span className="text-sm font-semibold uppercase tracking-wide">View Scores</span>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {/* RIGHT: Action Cards Column (4 cols) */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">

          {/* Primary Action: Daily Rehearsal */}
          <ActionCard
            icon={Music}
            iconColor="blue"
            borderColor="blue"
            title="Daily Rehearsal"
            subtitle="+5% Readiness • +50 XP"
            actionVariant="button"
            actionLabel="Start"
            onAction={onRehearsal}
            disabled={!canRehearseToday}
            processing={rehearsalProcessing}
          />

          {/* Equipment Status */}
          <ActionCard
            icon={Wrench}
            iconColor="orange"
            borderColor="orange"
            title="Equipment"
            subtitle={equipmentNeedsRepair ? undefined : `${Math.round(avgEquipment * 100)}% Condition`}
            warning={equipmentNeedsRepair ? 'Repairs needed' : undefined}
            onAction={onOpenEquipmentModal}
          />

          {/* Staff Management */}
          <ActionCard
            icon={Users}
            iconColor="purple"
            borderColor="purple"
            title="Staff Roster"
            subtitle={`${staffSlotsFilled}/${maxStaffSlots} Assigned • +${Math.round(staffBonus * 100)}% Bonus`}
            onAction={onOpenStaffModal}
          />
        </div>
      </div>

      {/* SoundSport Fun Badge */}
      {activeCorpsClass === 'soundSport' && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <Sparkles size={16} />
          <span>SoundSport is non-competitive - just have fun!</span>
        </div>
      )}
    </motion.div>
  );
};

export default memo(CommandCenter);
