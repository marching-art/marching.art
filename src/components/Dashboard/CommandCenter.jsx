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

// HUD-style animated status bar component with glowing light trail effect
const StatusBar = memo(({ label, value, icon: Icon }) => {
  const percentage = Math.round(value * 100);

  // Status colors: Low = Red, Mid = Yellow, High = Blue/Green
  const getStatusClass = (pct) => {
    if (pct >= 85) return { label: 'text-emerald-400', fill: 'status-excellent' };
    if (pct >= 70) return { label: 'text-blue-400', fill: 'status-good' };
    if (pct >= 50) return { label: 'text-yellow-400', fill: 'status-warning' };
    return { label: 'text-red-400', fill: 'status-danger' };
  };

  const status = getStatusClass(percentage);

  return (
    <div className="group">
      {/* Label row */}
      <div className="flex justify-between items-center mb-2">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-widest font-bold ${status.label}`}>
          <Icon size={14} strokeWidth={2.5} className="icon-neon-gold" />
          {label}
        </div>
        <span className={`font-mono font-bold text-sm ${status.label}`}>
          {percentage}%
        </span>
      </div>
      {/* Glowing progress bar with light trail effect */}
      <div className="progress-glow">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`progress-glow-fill ${status.fill}`}
        />
      </div>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

// Action card component for the right column - Dark glass with neon gold icons
const ActionCard = memo(({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  warning,
  actionLabel,
  actionVariant = 'chevron', // 'button' | 'chevron'
  onAction,
  disabled = false,
  processing = false
}) => {
  return (
    <div
      onClick={actionVariant === 'chevron' ? onAction : undefined}
      className={`action-tile cursor-pointer flex items-center justify-between ${disabled ? 'opacity-50 cursor-default' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Glowing icon container */}
        <div className="w-10 h-10 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="icon-neon-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-yellow-50 font-bold text-sm truncate">{title}</h3>
          {warning ? (
            <p className="text-xs text-orange-400 mt-0.5 flex items-center gap-1">
              <AlertCircle size={10} />
              {warning}
            </p>
          ) : subtitle ? (
            <p className="text-xs text-yellow-50/50 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {actionVariant === 'button' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
          }}
          disabled={disabled || processing}
          className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 flex-shrink-0 ${
            disabled
              ? 'bg-green-500/20 text-green-400 cursor-default border border-green-500/30'
              : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)]'
          }`}
        >
          {processing ? (
            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
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
        <div className="w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-yellow-500/30">
          <ChevronRight size={18} className="text-yellow-50/60" />
        </div>
      )}
    </div>
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

            {/* QUADRANT 1: Performance Multiplier - Ring Gauge */}
            <div className="hud-quadrant p-4 sm:p-5 border-b sm:border-b-0 sm:border-r hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                PERFORMANCE MULTIPLIER
              </div>
              <div className="flex items-center gap-4">
                {/* Ring Gauge SVG */}
                <div className="ring-gauge">
                  <svg viewBox="0 0 120 120" className="w-full h-full">
                    <defs>
                      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFD44D" />
                        <stop offset="50%" stopColor="#EAB308" />
                        <stop offset="100%" stopColor="#FFD44D" />
                      </linearGradient>
                    </defs>
                    {/* Background circle */}
                    <circle cx="60" cy="60" r="50" className="ring-gauge-bg" />
                    {/* Glow effect circle */}
                    <circle
                      cx="60" cy="60" r="50"
                      className="ring-gauge-glow"
                      strokeDasharray={`${((multiplier - 0.70) / 0.40) * 314} 314`}
                    />
                    {/* Progress circle */}
                    <circle
                      cx="60" cy="60" r="50"
                      className="ring-gauge-fill"
                      strokeDasharray={`${((multiplier - 0.70) / 0.40) * 314} 314`}
                    />
                  </svg>
                  {/* Center value */}
                  <div className="ring-gauge-value">
                    <span className="score-glow text-3xl tracking-tighter">
                      {multiplier.toFixed(2)}
                    </span>
                    <span className="text-yellow-400 text-sm font-bold">×</span>
                  </div>
                </div>
                {/* Status label */}
                <div className="flex flex-col gap-1">
                  <div className={`text-sm font-bold uppercase tracking-wider ${multiplierStatus.color} flex items-center gap-1`}>
                    <TrendingUp size={16} strokeWidth={2.5} className="icon-neon-gold" />
                    {multiplierStatus.label}
                  </div>
                  <p className="text-[10px] text-cream-500/50">
                    Based on readiness, morale & equipment
                  </p>
                </div>
              </div>
            </div>

            {/* QUADRANT 2: Quick Stats with Massive Glowing Score */}
            <div className="hud-quadrant p-4 sm:p-5 border-b hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                WEEKLY STATUS
              </div>
              <div className="flex items-center justify-between gap-2">
                {/* Rehearsals & Shows */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Music size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xl font-mono font-black text-blue-400">{rehearsalsThisWeek}/7</div>
                      <div className="text-[9px] text-cream-500/50 uppercase tracking-wider">Rehearsals</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Calendar size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xl font-mono font-black text-purple-400">{showsThisWeek}</div>
                      <div className="text-[9px] text-cream-500/50 uppercase tracking-wider">Shows</div>
                    </div>
                  </div>
                </div>
                {/* Massive Glowing Score */}
                {activeCorpsClass !== 'soundSport' && (
                  <div className="text-right">
                    <div className="text-[9px] text-cream-500/50 uppercase tracking-wider mb-1">Season Score</div>
                    <div className="score-glow text-4xl sm:text-5xl tracking-tight">
                      {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                    </div>
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

            {/* QUADRANT 4: Quick Actions - Dark glass tiles with neon icons */}
            <div className="hud-quadrant p-4 sm:p-5">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                QUICK ACTIONS
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  to="/schedule"
                  className="action-tile flex items-center gap-3 !p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
                    <Calendar size={18} className="icon-neon-gold" />
                  </div>
                  <span className="text-sm font-semibold text-yellow-50 uppercase tracking-wide">View Schedule</span>
                  <ChevronRight size={16} className="ml-auto text-yellow-50/40" />
                </Link>
                <Link
                  to="/scores"
                  className="action-tile flex items-center gap-3 !p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
                    <Trophy size={18} className="icon-neon-gold" />
                  </div>
                  <span className="text-sm font-semibold text-yellow-50 uppercase tracking-wide">View Scores</span>
                  <ChevronRight size={16} className="ml-auto text-yellow-50/40" />
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
            title="Equipment"
            subtitle={equipmentNeedsRepair ? undefined : `${Math.round(avgEquipment * 100)}% Condition`}
            warning={equipmentNeedsRepair ? 'Repairs needed' : undefined}
            onAction={onOpenEquipmentModal}
          />

          {/* Staff Management */}
          <ActionCard
            icon={Users}
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
