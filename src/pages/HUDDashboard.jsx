// =============================================================================
// HUD DASHBOARD - High-Density Command Center (Phase 3)
// =============================================================================
// Fully populated 3-column dashboard with data-connected widgets.
// Uses existing reusable components from Phase 1 audit.

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import toast from 'react-hot-toast';

// Layout Components
import {
  CommandCenterLayout,
  IntelligenceColumn,
  CommandColumn,
  LogisticsColumn,
  Panel,
} from '../components/hud/CommandCenterLayout';

// Execution Components
import {
  SegmentedMetricBar,
  ClusterBar,
  DualClusterDisplay,
} from '../components/Execution/TransparentGameplay/SegmentedMetricBar';

// Dashboard Components
import { DashboardStaffPanel } from '../components/Execution';

// Firebase Functions
import {
  sectionalRehearsal,
  getDailyOpsStatus,
  claimDailyLogin,
  staffCheckin,
  memberWellnessCheck,
  equipmentInspection,
  showReview,
} from '../firebase/functions';

// Icons
import {
  Target,
  Heart,
  Music,
  Eye,
  Flag,
  Drum,
  Zap,
  Users,
  Wrench,
  Calendar,
  Play,
  Check,
  X,
  Sparkles,
  Trophy,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Coffee,
  Square,
  Settings,
  LayoutGrid,
} from 'lucide-react';

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const columnVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] },
  },
};

// =============================================================================
// COMPACT PROGRESS BAR - For equipment and other metrics
// =============================================================================

const CompactBar = ({ value, label, color = 'gold', showPercent = true }) => {
  const colorClasses = {
    gold: 'bg-gold-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };

  const textClasses = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  const percent = Math.round(value * 100);
  const barColor = value < 0.6 ? 'red' : value < 0.8 ? 'orange' : color;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-display font-bold text-cream/60 uppercase tracking-wide w-20 shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full ${colorClasses[barColor]} rounded-full`}
        />
      </div>
      {showPercent && (
        <span className={`text-[10px] font-data font-bold w-8 text-right ${textClasses[barColor]}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

// =============================================================================
// SECTIONAL REHEARSAL BUTTON - For action deck
// =============================================================================

const SectionalButton = ({ icon: Icon, label, available, loading, onClick, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:border-blue-400',
    green: 'bg-green-500/20 border-green-500/30 text-green-400 hover:border-green-400',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400 hover:border-purple-400',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:border-orange-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`
        flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all
        ${available
          ? `${colorClasses[color]} cursor-pointer hover:shadow-lg`
          : 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default'
        }
      `}
    >
      <div className={`w-7 h-7 flex items-center justify-center rounded ${
        available ? 'bg-black/30' : 'bg-green-500/20'
      }`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : available ? (
          <Icon className="w-4 h-4" />
        ) : (
          <Check className="w-4 h-4" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
        )}
      </div>
      <span className="text-[9px] font-display font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
};

// =============================================================================
// TASK ROW - Checklist style for daily tasks
// =============================================================================

const TaskRow = ({ title, reward, available, loading, onClick }) => {
  const isCompleted = !available;

  return (
    <button
      onClick={onClick}
      disabled={isCompleted || loading}
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all
        ${isCompleted ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'}
      `}
    >
      <div className={`w-4 h-4 flex items-center justify-center rounded border ${
        isCompleted
          ? 'bg-green-500/20 border-green-500/60'
          : 'border-white/20'
      }`}>
        {loading ? (
          <div className="w-2.5 h-2.5 border border-gold-400 border-t-transparent rounded-full animate-spin" />
        ) : isCompleted ? (
          <Check className="w-2.5 h-2.5 text-green-400" />
        ) : null}
      </div>
      <span className={`flex-1 text-left text-[11px] font-mono ${
        isCompleted ? 'text-cream/50 line-through' : 'text-cream'
      }`}>
        {title}
      </span>
      <span className={`text-[9px] font-mono font-bold ${
        isCompleted ? 'text-gold-400/50' : 'text-gold-400'
      }`}>
        {reward}
      </span>
    </button>
  );
};

// =============================================================================
// STAFF CARD - Compact staff display
// =============================================================================

const StaffSlot = ({ staff, caption }) => {
  if (!staff) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10 border-dashed">
        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center">
          <span className="text-[8px] font-mono text-cream/30">{caption}</span>
        </div>
        <span className="text-[10px] text-cream/30 italic">Empty</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
      <div className="w-6 h-6 rounded bg-gold-500/20 flex items-center justify-center">
        <span className="text-[8px] font-mono font-bold text-gold-400">{caption}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-display font-bold text-cream truncate">
          {staff.name}
        </div>
        <div className="text-[9px] text-cream/50">
          Rating: <span className="text-gold-400 font-bold">{staff.rating}</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// EQUIPMENT STATUS INDICATOR
// =============================================================================

const EquipmentStatus = ({ equipment }) => {
  const items = [
    { key: 'uniforms', label: 'Uniforms', icon: '👔' },
    { key: 'instruments', label: 'Instruments', icon: '🎺' },
    { key: 'props', label: 'Props', icon: '🚩' },
  ];

  const values = items.map(i => equipment?.[i.key] || 0.9);
  const avgEquipment = values.reduce((a, b) => a + b, 0) / values.length;
  const needsRepair = avgEquipment < 0.85;

  return (
    <div className="space-y-2">
      {/* Overall Status */}
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${
        needsRepair ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'
      }`}>
        {needsRepair ? (
          <AlertTriangle className="w-4 h-4 text-orange-400" />
        ) : (
          <Check className="w-4 h-4 text-green-400" />
        )}
        <span className={`text-[10px] font-mono ${needsRepair ? 'text-orange-400' : 'text-green-400'}`}>
          {needsRepair ? 'Repair Needed' : 'All Systems Nominal'}
        </span>
        <span className="ml-auto text-[10px] font-data font-bold text-cream/60">
          {Math.round(avgEquipment * 100)}%
        </span>
      </div>

      {/* Individual Bars */}
      <div className="space-y-1">
        {items.map(item => (
          <CompactBar
            key={item.key}
            value={equipment?.[item.key] || 0.9}
            label={item.label}
            color="gold"
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// SYNERGY DISPLAY - Show concept and bonus
// =============================================================================

const SynergyDisplay = ({ showConcept, synergyBonus }) => {
  const hasTheme = typeof showConcept === 'object' && showConcept?.theme;

  if (!hasTheme) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-orange-500/10 border border-orange-500/30">
        <Sparkles className="w-4 h-4 text-orange-400" />
        <span className="text-[11px] text-orange-400">No show concept configured</span>
        <ChevronRight className="w-3 h-3 text-orange-400 ml-auto" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded bg-gold-500/10 border border-gold-500/30">
      <Sparkles className="w-4 h-4 text-gold-400" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-display font-bold text-gold-400 truncate">
          {showConcept.theme}
        </div>
        {showConcept.style && (
          <div className="text-[9px] text-cream/50">{showConcept.style}</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-sm font-data font-bold text-gold-400">
          +{(synergyBonus || 0).toFixed(1)}
        </div>
        <div className="text-[8px] text-cream/40 uppercase">Bonus</div>
      </div>
    </div>
  );
};

// =============================================================================
// MULTIPLIER DISPLAY - Large performance multiplier
// =============================================================================

const MultiplierDisplay = ({ multiplier, readiness, morale, equipment, staffCount }) => {
  const getMultiplierColor = (m) => {
    if (m >= 1.05) return 'text-green-400';
    if (m >= 0.95) return 'text-blue-400';
    if (m >= 0.85) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center gap-4">
      {/* Large Multiplier */}
      <div className="text-center">
        <div className={`text-3xl font-data font-black ${getMultiplierColor(multiplier)}`}>
          {multiplier.toFixed(2)}x
        </div>
        <div className="text-[9px] text-cream/40 uppercase tracking-wide">Multiplier</div>
      </div>

      {/* Breakdown Mini-bars */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-cream/50 w-12">Ready</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${readiness * 100}%` }} />
          </div>
          <span className="text-[9px] text-blue-400 w-8 text-right">{Math.round(readiness * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-cream/50 w-12">Morale</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500" style={{ width: `${morale * 100}%` }} />
          </div>
          <span className="text-[9px] text-rose-400 w-8 text-right">{Math.round(morale * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-cream/50 w-12">Equip</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gold-500" style={{ width: `${equipment * 100}%` }} />
          </div>
          <span className="text-[9px] text-gold-400 w-8 text-right">{Math.round(equipment * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-cream/50 w-12">Staff</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500" style={{ width: `${(staffCount / 8) * 100}%` }} />
          </div>
          <span className="text-[9px] text-purple-400 w-8 text-right">{staffCount}/8</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// AGGREGATE STAFF EFFECTIVENESS
// =============================================================================

const StaffEffectivenessDisplay = ({ assignedStaff }) => {
  // Calculate aggregate effectiveness from staff ratings
  const totalRating = assignedStaff.reduce((sum, s) => sum + (s.rating || 0), 0);
  const avgRating = assignedStaff.length > 0 ? totalRating / assignedStaff.length : 0;
  const effectiveness = Math.round((avgRating / 100) * 100); // Assuming rating is 0-100

  const getColor = (eff) => {
    if (eff >= 80) return 'text-green-400';
    if (eff >= 60) return 'text-gold-400';
    if (eff >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="text-center py-3">
      <div className={`text-4xl font-data font-black ${getColor(effectiveness)}`}>
        {effectiveness}%
      </div>
      <div className="text-[10px] text-cream/40 uppercase tracking-wide mt-1">
        Aggregate Effectiveness
      </div>
      <div className="text-[9px] text-cream/30 mt-0.5">
        Based on {assignedStaff.length} staff ({Math.round(avgRating)} avg rating)
      </div>
    </div>
  );
};

// =============================================================================
// HUD DASHBOARD COMPONENT
// =============================================================================

const HUDDashboard = () => {
  const { user } = useAuth();

  // Centralized dashboard data hook
  const dashboardData = useDashboardData();

  // Staff marketplace for assigned staff
  const { ownedStaff } = useStaffMarketplace(user?.uid);

  // Local state
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [opsStatus, setOpsStatus] = useState(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [showMobileLogistics, setShowMobileLogistics] = useState(false);

  // Destructure dashboard data
  const {
    profile,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    weeksRemaining,
    currentWeek,
    currentDay,
    engagementData,
    executionState,
    executionProcessing,
    rehearse,
    repairEquipment,
    canRehearseToday,
    handleCorpsSwitch,
    completeDailyChallenge,
    refreshProfile,
  } = dashboardData;

  // Calculate staff assigned to active corps
  const assignedStaff = ownedStaff?.filter(
    s => s.assignedTo?.corpsClass === activeCorpsClass
  ) || [];

  // Calculate metrics
  const readiness = typeof executionState?.readiness === 'number'
    ? executionState.readiness
    : typeof executionState?.readiness === 'object'
      ? Object.values(executionState.readiness).reduce((a, b) => a + b, 0) / 4
      : 0.75;

  const morale = typeof executionState?.morale === 'number'
    ? executionState.morale
    : typeof executionState?.morale === 'object'
      ? Object.values(executionState.morale).reduce((a, b) => a + b, 0) / 4
      : 0.80;

  const equipment = executionState?.equipment || {};
  const equipmentValues = Object.entries(equipment)
    .filter(([k, v]) => typeof v === 'number' && !k.includes('Max'))
    .map(([, v]) => v);
  const avgEquipment = equipmentValues.length > 0
    ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
    : 0.90;

  // Calculate multiplier
  const staffBonus = Math.min(assignedStaff.length * 0.01, 0.05);
  const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);
  const multiplier = Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));

  // Prepare readiness/morale sections for SegmentedMetricBar
  const readinessSections = typeof executionState?.readiness === 'object'
    ? executionState.readiness
    : { brass: readiness, percussion: readiness, guard: readiness, ensemble: readiness };

  const moraleSections = typeof executionState?.morale === 'object'
    ? executionState.morale
    : { brass: morale, percussion: morale, guard: morale, overall: morale };

  // Fetch daily ops status
  const fetchOpsStatus = useCallback(async () => {
    if (!activeCorpsClass) return;
    try {
      setOpsLoading(true);
      const result = await getDailyOpsStatus({ corpsClass: activeCorpsClass });
      if (result.data.success) {
        setOpsStatus(result.data.status);
      }
    } catch (error) {
      console.error('Error fetching ops status:', error);
    } finally {
      setOpsLoading(false);
    }
  }, [activeCorpsClass]);

  useEffect(() => {
    fetchOpsStatus();
  }, [fetchOpsStatus]);

  // Handlers
  const handleRehearsal = async () => {
    if (canRehearseToday()) {
      const result = await rehearse();
      if (result?.success) {
        toast.success(`Rehearsal complete! +${result.data?.xpGained || 50} XP`);
        fetchOpsStatus();
      }
    }
  };

  const handleSectional = async (section) => {
    setProcessing(`sectional_${section}`);
    try {
      const result = await sectionalRehearsal({ corpsClass: activeCorpsClass, section });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchOpsStatus();
        if (completeDailyChallenge) completeDailyChallenge('sectional');
      }
    } catch (error) {
      toast.error(error.message || `Failed to complete ${section} sectional`);
    } finally {
      setProcessing(null);
    }
  };

  const handleDailyTask = async (taskId, taskFn) => {
    setProcessing(taskId);
    try {
      const result = await taskFn();
      if (result.data.success) {
        toast.success(result.data.message);
        fetchOpsStatus();
        refreshProfile?.();
      }
    } catch (error) {
      toast.error(error.message || 'Task failed');
    } finally {
      setProcessing(null);
    }
  };

  // Caption order for staff display
  const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Main Content */}
      <motion.div
        className="flex-1 min-h-0 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <CommandCenterLayout fullHeight>

          {/* ================================================================
              LEFT COLUMN: INTELLIGENCE - Vitals Display
              ================================================================ */}
          <IntelligenceColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Section Readiness */}
              <Panel
                title="Readiness"
                variant="default"
                className="flex-1 min-h-0"
                scrollable
              >
                <SegmentedMetricBar
                  type="readiness"
                  sections={readinessSections}
                  showAverage={true}
                  compact={false}
                />
              </Panel>

              {/* Section Morale */}
              <Panel
                title="Morale"
                variant="default"
                className="flex-1 min-h-0"
                scrollable
              >
                <SegmentedMetricBar
                  type="morale"
                  sections={moraleSections}
                  showAverage={true}
                  compact={false}
                />
              </Panel>

              {/* Leaderboard Quick Stats */}
              <Panel
                title="Standing"
                variant="sunken"
                className="flex-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-gold-400" />
                    <span className="text-sm font-display font-bold text-cream">
                      Rank #{activeCorps?.rank || '—'}
                    </span>
                  </div>
                  <Link
                    to="/scores"
                    className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
                  >
                    Leaderboard →
                  </Link>
                </div>
              </Panel>
            </motion.div>
          </IntelligenceColumn>

          {/* ================================================================
              CENTER COLUMN: COMMAND - Actions & Operations
              ================================================================ */}
          <CommandColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Performance Multiplier */}
              <Panel
                title="Performance"
                subtitle={`Week ${currentWeek} • Day ${currentDay}`}
                variant="accent"
                className="flex-none"
              >
                <MultiplierDisplay
                  multiplier={multiplier}
                  readiness={readiness}
                  morale={morale}
                  equipment={avgEquipment}
                  staffCount={assignedStaff.length}
                />
              </Panel>

              {/* Action Deck - Sectional Rehearsals */}
              <Panel
                title="Rehearsals"
                subtitle="Sectional drills (+2% each)"
                variant="elevated"
                className="flex-none"
              >
                <div className="space-y-3">
                  {/* Full Rehearsal Button */}
                  <button
                    onClick={handleRehearsal}
                    disabled={!canRehearseToday() || executionProcessing}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all
                      ${canRehearseToday()
                        ? 'bg-gold-500/20 border-gold-500/40 text-gold-400 hover:bg-gold-500/30'
                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded ${
                      canRehearseToday() ? 'bg-gold-500/30' : 'bg-green-500/20'
                    }`}>
                      {executionProcessing ? (
                        <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                      ) : canRehearseToday() ? (
                        <Play className="w-5 h-5" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-display font-bold uppercase">Full Rehearsal</div>
                      <div className="text-[10px] opacity-70">
                        {executionState?.rehearsalsThisWeek || 0}/7 this week • +5% readiness
                      </div>
                    </div>
                  </button>

                  {/* Sectional Buttons Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <SectionalButton
                      icon={Music}
                      label="Music"
                      available={opsStatus?.sectionalRehearsals?.music?.available}
                      loading={processing === 'sectional_music'}
                      onClick={() => handleSectional('music')}
                      color="blue"
                    />
                    <SectionalButton
                      icon={Eye}
                      label="Visual"
                      available={opsStatus?.sectionalRehearsals?.visual?.available}
                      loading={processing === 'sectional_visual'}
                      onClick={() => handleSectional('visual')}
                      color="purple"
                    />
                    <SectionalButton
                      icon={Flag}
                      label="Guard"
                      available={opsStatus?.sectionalRehearsals?.guard?.available}
                      loading={processing === 'sectional_guard'}
                      onClick={() => handleSectional('guard')}
                      color="orange"
                    />
                    <SectionalButton
                      icon={Drum}
                      label="Battery"
                      available={opsStatus?.sectionalRehearsals?.percussion?.available}
                      loading={processing === 'sectional_percussion'}
                      onClick={() => handleSectional('percussion')}
                      color="green"
                    />
                  </div>
                </div>
              </Panel>

              {/* Daily Tasks */}
              <Panel
                title="Daily Tasks"
                subtitle={opsLoading ? 'Loading...' : undefined}
                variant="default"
                className="flex-1 min-h-0"
                scrollable
              >
                <div className="space-y-0.5">
                  <TaskRow
                    title="Login Bonus"
                    reward="+10 XP"
                    available={opsStatus?.loginBonus?.available}
                    loading={processing === 'login'}
                    onClick={() => handleDailyTask('login', claimDailyLogin)}
                  />
                  <TaskRow
                    title="Staff Check-in"
                    reward="+15 XP"
                    available={opsStatus?.staffCheckin?.available}
                    loading={processing === 'staff'}
                    onClick={() => handleDailyTask('staff', () => staffCheckin({ corpsClass: activeCorpsClass }))}
                  />
                  <TaskRow
                    title="Wellness Check"
                    reward="+3% morale"
                    available={opsStatus?.memberWellness?.available}
                    loading={processing === 'wellness'}
                    onClick={() => handleDailyTask('wellness', () => memberWellnessCheck({ corpsClass: activeCorpsClass }))}
                  />
                  <TaskRow
                    title="Equipment Inspection"
                    reward="+5 CC"
                    available={opsStatus?.equipmentInspection?.available}
                    loading={processing === 'equipment'}
                    onClick={() => handleDailyTask('equipment', () => equipmentInspection({ corpsClass: activeCorpsClass }))}
                  />
                  <TaskRow
                    title="Show Review"
                    reward="+20 XP"
                    available={opsStatus?.showReview?.available}
                    loading={processing === 'review'}
                    onClick={() => handleDailyTask('review', () => showReview({ corpsClass: activeCorpsClass }))}
                  />
                </div>
              </Panel>

              {/* Synergy Display */}
              <Panel variant="sunken" className="flex-none" noPadding>
                <div className="p-2">
                  <SynergyDisplay
                    showConcept={activeCorps?.showConcept}
                    synergyBonus={executionState?.synergyBonus || 0}
                  />
                </div>
              </Panel>
            </motion.div>
          </CommandColumn>

          {/* ================================================================
              RIGHT COLUMN: LOGISTICS - Staff & Equipment
              Mobile: Collapsible with "Show Details" toggle
              ================================================================ */}
          <LogisticsColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Mobile Toggle Button */}
              <button
                onClick={() => setShowMobileLogistics(!showMobileLogistics)}
                className="lg:hidden flex items-center justify-between w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-gold-400" />
                  <span className="text-xs font-display font-bold text-cream uppercase">
                    Logistics Details
                  </span>
                  <span className="text-[9px] text-cream/40">
                    Staff, Equipment, Schedule
                  </span>
                </div>
                {showMobileLogistics ? (
                  <ChevronUp className="w-4 h-4 text-cream/40" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-cream/40" />
                )}
              </button>

              {/* Collapsible Content (always visible on desktop, toggleable on mobile) */}
              <div className={`
                flex flex-col gap-1 flex-1 min-h-0
                ${showMobileLogistics ? 'flex' : 'hidden lg:flex'}
              `}>
                {/* Staff Summary */}
                <Panel
                  title="Staff"
                  subtitle={`${assignedStaff.length}/8 assigned`}
                  variant="default"
                  className="flex-1 min-h-0"
                  scrollable
                  actions={
                    <button
                      onClick={() => setShowStaffPanel(true)}
                      className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
                    >
                      Manage →
                    </button>
                  }
                >
                  {/* Aggregate Effectiveness */}
                  <StaffEffectivenessDisplay assignedStaff={assignedStaff} />

                  {/* Staff Slots */}
                  <div className="mt-3 space-y-1">
                    {CAPTIONS.slice(0, 4).map(caption => {
                      const staff = assignedStaff.find(s =>
                        s.assignedTo?.caption === caption || s.caption === caption
                      );
                      return <StaffSlot key={caption} staff={staff} caption={caption} />;
                    })}
                    {assignedStaff.length > 4 && (
                      <div className="text-[9px] text-cream/40 text-center py-1">
                        +{assignedStaff.length - 4} more staff assigned
                      </div>
                    )}
                  </div>
                </Panel>

                {/* Equipment Status */}
                <Panel
                  title="Equipment"
                  variant="default"
                  className="flex-none"
                  actions={
                    <button
                      onClick={() => setShowEquipmentPanel(true)}
                      className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
                    >
                      Repair →
                    </button>
                  }
                >
                  <EquipmentStatus equipment={executionState?.equipment} />
                </Panel>

                {/* Schedule Quick View */}
                <Panel
                  title="Schedule"
                  subtitle={`Week ${currentWeek}`}
                  variant="sunken"
                  className="flex-none"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-display font-bold text-cream">
                        {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0} Shows
                      </span>
                    </div>
                    <Link
                      to="/schedule"
                      className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
                    >
                      View →
                    </Link>
                  </div>
                </Panel>
              </div>
            </motion.div>
          </LogisticsColumn>

        </CommandCenterLayout>
      </motion.div>

      {/* ======================================================================
          SLIDE-OUT PANELS
          ====================================================================== */}

      {/* Staff Panel */}
      <AnimatePresence>
        {showStaffPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStaffPanel(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-950/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-charcoal-950/95 backdrop-blur-xl border-b border-gold-500/30 p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-gold-400 uppercase tracking-tight">Staff Roster</h2>
                <button
                  onClick={() => setShowStaffPanel(false)}
                  className="p-2 rounded hover:bg-red-500/20 text-cream-muted hover:text-red-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <DashboardStaffPanel activeCorpsClass={activeCorpsClass} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Equipment Panel - Links to full equipment manager */}
      <AnimatePresence>
        {showEquipmentPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEquipmentPanel(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-950/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-charcoal-950/95 backdrop-blur-xl border-b border-gold-500/30 p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-cream-100 uppercase tracking-tight">Equipment</h2>
                <button
                  onClick={() => setShowEquipmentPanel(false)}
                  className="p-2 rounded hover:bg-red-500/20 text-cream-muted hover:text-red-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {['uniforms', 'instruments', 'props'].map(type => {
                    const value = executionState?.equipment?.[type] || 0.9;
                    const needsRepair = value < 0.85;

                    return (
                      <div key={type} className="glass-slot p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-display font-bold text-cream capitalize">{type}</span>
                          <span className={`text-sm font-data font-bold ${
                            value >= 0.9 ? 'text-green-400' : value >= 0.7 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {Math.round(value * 100)}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all ${
                              value >= 0.9 ? 'bg-green-500' : value >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                        {needsRepair && (
                          <button
                            onClick={() => {
                              repairEquipment?.(type);
                              toast.success(`Repairing ${type}...`);
                            }}
                            className="w-full py-2 px-3 bg-gold-500/20 border border-gold-500/40 rounded text-gold-400 text-sm font-display font-bold uppercase hover:bg-gold-500/30 transition-colors"
                          >
                            Repair (-50 CC)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HUDDashboard;
