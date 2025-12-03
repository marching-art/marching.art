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

// Animated status bar component
const StatusBar = memo(({ label, value, icon: Icon, accentColor = 'blue' }) => {
  const percentage = Math.round(value * 100);

  const colorMap = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-500', glow: 'shadow-blue-500/20' },
    red: { text: 'text-rose-400', bg: 'bg-rose-500', glow: 'shadow-rose-500/20' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500', glow: 'shadow-orange-500/20' },
    green: { text: 'text-green-400', bg: 'bg-green-500', glow: 'shadow-green-500/20' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500', glow: 'shadow-purple-500/20' },
  };

  const colors = colorMap[accentColor] || colorMap.blue;

  return (
    <div className="group">
      <div className="flex justify-between items-end mb-1.5">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-wider font-semibold ${colors.text}`}>
          <Icon size={12} />
          {label}
        </div>
        <span className="text-white font-mono text-sm font-bold">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full bg-charcoal-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`h-full ${colors.bg} rounded-full`}
        />
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

        {/* LEFT: Hero Card - Corps Status & Health (8 cols) */}
        <Card variant="premium" padding="none" className="lg:col-span-8 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-5 pointer-events-none">
            <Trophy size={192} />
          </div>

          <div className="p-5 sm:p-6 relative z-10">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              {/* Corps Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                    {getCorpsClassName(activeCorpsClass)}
                  </span>
                  {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-[10px] font-bold">
                      <Trophy size={10} />
                      Top 10
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight mb-1">
                  {activeCorps.corpsName || activeCorps.name}
                </h2>
                {activeCorps.showConcept && (
                  <p className="text-cream-300 text-sm">
                    <span className="text-gold-500">Show:</span> "{activeCorps.showConcept}"
                  </p>
                )}
              </div>

              {/* Performance Multiplier - The "Big Number" */}
              <div className="flex-shrink-0 text-right bg-charcoal-950/40 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] text-cream-500/60 uppercase tracking-widest mb-1">
                  Performance
                </div>
                <div className={`text-4xl sm:text-5xl font-display font-black tabular-nums tracking-tighter ${multiplierStatus.color}`}>
                  {multiplier.toFixed(2)}x
                </div>
                <div className={`text-xs font-semibold ${multiplierStatus.color} flex items-center justify-end gap-1 mt-1`}>
                  <TrendingUp size={12} />
                  {multiplierStatus.label}
                </div>
              </div>
            </div>

            {/* Health Metrics - Always Visible */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <StatusBar
                label="Readiness"
                value={readiness}
                icon={Target}
                accentColor="blue"
              />
              <StatusBar
                label="Morale"
                value={morale}
                icon={Heart}
                accentColor="red"
              />
              <StatusBar
                label="Equipment"
                value={avgEquipment}
                icon={Wrench}
                accentColor="orange"
              />
            </div>

            {/* Quick Stats Row */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-cream-500/10">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{rehearsalsThisWeek}/7</div>
                  <div className="text-[10px] text-cream-500/60 uppercase tracking-wider">This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">{showsThisWeek}</div>
                  <div className="text-[10px] text-cream-500/60 uppercase tracking-wider">Shows</div>
                </div>
                {activeCorpsClass !== 'soundSport' && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-gold-400">
                      {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-[10px] text-cream-500/60 uppercase tracking-wider">Score</div>
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="flex items-center gap-2">
                <Link
                  to="/schedule"
                  className="p-2 rounded-lg bg-charcoal-800/50 hover:bg-charcoal-700/50 text-cream-400 hover:text-white transition-colors"
                  title="View Schedule"
                >
                  <Calendar size={18} />
                </Link>
                <Link
                  to="/scores"
                  className="p-2 rounded-lg bg-charcoal-800/50 hover:bg-charcoal-700/50 text-cream-400 hover:text-white transition-colors"
                  title="View Scores"
                >
                  <Trophy size={18} />
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
