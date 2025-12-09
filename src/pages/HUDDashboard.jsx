// =============================================================================
// HUD DASHBOARD - "Glass Cockpit" Command Center
// =============================================================================
// Full data visibility dashboard - 100% of game state surfaced on screen.
// No modals for critical data - everything visible at a glance.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { useScoresData } from '../hooks/useScoresData';
import toast from 'react-hot-toast';

// Layout Components
import {
  CommandCenterLayout,
  IntelligenceColumn,
  CommandColumn,
  LogisticsColumn,
  Panel,
} from '../components/hud/CommandCenterLayout';

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
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Bus,
  Truck,
  Flame,
  Clock,
  Radio,
  Minus,
  Crown,
} from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const CAPTIONS = [
  { id: 'GE1', name: 'General Effect 1', category: 'ge', color: 'gold' },
  { id: 'GE2', name: 'General Effect 2', category: 'ge', color: 'gold' },
  { id: 'VP', name: 'Visual Proficiency', category: 'visual', color: 'blue' },
  { id: 'VA', name: 'Visual Analysis', category: 'visual', color: 'blue' },
  { id: 'CG', name: 'Color Guard', category: 'visual', color: 'purple' },
  { id: 'B', name: 'Brass', category: 'music', color: 'orange' },
  { id: 'MA', name: 'Music Analysis', category: 'music', color: 'orange' },
  { id: 'P', name: 'Percussion', category: 'music', color: 'green' },
];

const MULTIPLIER_FACTORS = {
  readiness: { label: 'Readiness', icon: Target, baseline: 0.80, range: '±12%' },
  staff: { label: 'Staff', icon: Users, baseline: 0.80, range: '±8%' },
  equipment: { label: 'Equipment', icon: Wrench, baseline: 1.00, range: '-5%' },
  travelCondition: { label: 'Travel', icon: Bus, threshold: 1.40, range: '-3%' },
  morale: { label: 'Morale', icon: Heart, baseline: 0.75, range: '±8%' },
  showDifficulty: { label: 'Difficulty', icon: Zap, range: '±15%' },
  fatigue: { label: 'Fatigue', icon: Flame, range: '-5%' },
  championshipPressure: { label: 'Finals', icon: Trophy, range: '±2%' },
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, staggerChildren: 0.05, delayChildren: 0.1 },
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
// UTILITY COMPONENTS
// =============================================================================

// Slim Progress Bar for readiness/morale sections
const SlimBar = ({ value, label, color = 'blue', size = 'sm' }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    gold: 'bg-gold-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  const textClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    gold: 'text-gold-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
  };

  const percent = Math.round(value * 100);
  const barColor = value < 0.6 ? 'red' : value < 0.8 ? 'orange' : color;

  return (
    <div className="flex items-center gap-2">
      <span className={`${size === 'xs' ? 'text-[8px] w-12' : 'text-[9px] w-14'} font-display font-bold text-cream/60 uppercase tracking-wide shrink-0 truncate`}>
        {label}
      </span>
      <div className={`flex-1 ${size === 'xs' ? 'h-1' : 'h-1.5'} bg-white/10 rounded-full overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full ${colorClasses[barColor]} rounded-full`}
        />
      </div>
      <span className={`${size === 'xs' ? 'text-[8px] w-6' : 'text-[9px] w-7'} font-data font-bold text-right ${textClasses[barColor]}`}>
        {percent}%
      </span>
    </div>
  );
};

// Effect Pill - For active modifiers display
const EffectPill = ({ label, value, positive = true, icon: Icon }) => (
  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-data font-bold ${
    positive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
  }`}>
    {Icon && <Icon className="w-2.5 h-2.5" />}
    <span>{label}</span>
    <span>{positive ? '+' : ''}{value}</span>
  </div>
);

// Multiplier Factor Row - For breakdown table
const FactorRow = ({ label, value, icon: Icon }) => {
  const isPositive = value > 0.005;
  const isNegative = value < -0.005;
  const colorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-cream/40';
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3 h-3 ${colorClass}`} />
        <span className="text-[9px] text-cream/60">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <TrendIcon className={`w-2.5 h-2.5 ${colorClass}`} />
        <span className={`text-[9px] font-data font-bold ${colorClass}`}>
          {isPositive ? '+' : ''}{(value * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// Caption Slot - For synergy grid
const CaptionSlot = ({ caption, staff, bonus = 0 }) => {
  const hasStaff = !!staff;
  const hasBonus = bonus > 0;

  const categoryColors = {
    ge: 'border-gold-500/40 bg-gold-500/10',
    visual: 'border-blue-500/40 bg-blue-500/10',
    music: 'border-purple-500/40 bg-purple-500/10',
  };

  const categoryTextColors = {
    ge: 'text-gold-400',
    visual: 'text-blue-400',
    music: 'text-purple-400',
  };

  return (
    <div className={`flex items-center justify-between p-1.5 rounded border ${categoryColors[caption.category]}`}>
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded flex items-center justify-center ${hasStaff ? 'bg-green-500/30' : 'bg-white/5'}`}>
          <span className={`text-[8px] font-bold ${hasStaff ? 'text-green-400' : 'text-cream/30'}`}>
            {caption.id}
          </span>
        </div>
        {hasStaff && (
          <span className="text-[8px] text-cream/60 truncate max-w-[50px]">
            {staff.name?.split(' ')[0]}
          </span>
        )}
      </div>
      <span className={`text-[9px] font-data font-bold ${hasBonus ? 'text-green-400' : 'text-cream/20'}`}>
        {hasBonus ? `+${bonus.toFixed(1)}` : '—'}
      </span>
    </div>
  );
};

// Staff Slot Icon - For coverage map
const StaffSlotIcon = ({ caption, staff, compact = false }) => {
  const hasStaff = !!staff;

  if (compact) {
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center border ${
        hasStaff
          ? 'bg-green-500/20 border-green-500/40'
          : 'bg-red-500/10 border-red-500/30 border-dashed'
      }`}>
        <span className={`text-[7px] font-bold ${hasStaff ? 'text-green-400' : 'text-red-400/50'}`}>
          {caption}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded border ${
      hasStaff
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-white/5 border-white/10 border-dashed'
    }`}>
      <div className={`w-5 h-5 rounded flex items-center justify-center ${
        hasStaff ? 'bg-green-500/20' : 'bg-white/5'
      }`}>
        <span className={`text-[8px] font-bold ${hasStaff ? 'text-green-400' : 'text-cream/30'}`}>
          {caption}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {hasStaff ? (
          <>
            <div className="text-[9px] font-display font-bold text-cream truncate">
              {staff.name}
            </div>
            <div className="text-[8px] text-cream/40">
              R: <span className="text-gold-400">{staff.rating}</span>
            </div>
          </>
        ) : (
          <span className="text-[9px] text-cream/30 italic">Vacant</span>
        )}
      </div>
    </div>
  );
};

// Sectional Rehearsal Button
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
        flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg border transition-all
        ${available
          ? `${colorClasses[color]} cursor-pointer hover:shadow-lg`
          : 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default'
        }
      `}
    >
      <div className={`w-6 h-6 flex items-center justify-center rounded ${
        available ? 'bg-black/30' : 'bg-green-500/20'
      }`}>
        {loading ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : available ? (
          <Icon className="w-3.5 h-3.5" />
        ) : (
          <Check className="w-3.5 h-3.5" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
        )}
      </div>
      <span className="text-[8px] font-display font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
};

// Task Row - Checklist item
const TaskRow = ({ title, reward, available, loading, onClick }) => {
  const isCompleted = !available;

  return (
    <button
      onClick={onClick}
      disabled={isCompleted || loading}
      className={`
        w-full flex items-center gap-2 px-2 py-1 rounded transition-all
        ${isCompleted ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'}
      `}
    >
      <div className={`w-3.5 h-3.5 flex items-center justify-center rounded border ${
        isCompleted
          ? 'bg-green-500/20 border-green-500/60'
          : 'border-white/20'
      }`}>
        {loading ? (
          <div className="w-2 h-2 border border-gold-400 border-t-transparent rounded-full animate-spin" />
        ) : isCompleted ? (
          <Check className="w-2 h-2 text-green-400" />
        ) : null}
      </div>
      <span className={`flex-1 text-left text-[10px] font-mono ${
        isCompleted ? 'text-cream/50 line-through' : 'text-cream'
      }`}>
        {title}
      </span>
      <span className={`text-[8px] font-mono font-bold ${
        isCompleted ? 'text-gold-400/50' : 'text-gold-400'
      }`}>
        {reward}
      </span>
    </button>
  );
};

// Season Progress Bar
const SeasonProgressBar = ({ currentDay, totalDays = 49 }) => {
  const progress = (currentDay / totalDays) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-cream/50">Day</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-600 to-gold-400 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        {/* Week markers */}
        {[7, 14, 21, 28, 35, 42].map(day => (
          <div
            key={day}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${(day / totalDays) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-[9px] font-data font-bold text-gold-400">
        {currentDay}/{totalDays}
      </span>
    </div>
  );
};

// League Ticker Footer
const LeagueTicker = ({ seasonData, currentDay }) => {
  const { allShows, loading: scoresLoading } = useScoresData();
  const [tickerData, setTickerData] = useState({ scores: [], loading: true });

  useEffect(() => {
    if (!scoresLoading && allShows.length > 0) {
      const recentShows = allShows
        .filter(show => show.offSeasonDay >= currentDay - 2 && show.offSeasonDay <= currentDay)
        .flatMap(show =>
          show.scores.slice(0, 5).map(score => ({
            corpsName: score.corpsName || score.corps,
            totalScore: score.totalScore || score.score,
            eventName: show.eventName,
          }))
        )
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 12);

      setTickerData({ scores: recentShows, loading: false });
    } else if (!scoresLoading) {
      setTickerData({ scores: [], loading: false });
    }
  }, [allShows, scoresLoading, currentDay]);

  if (tickerData.loading) {
    return (
      <div className="h-7 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-center">
        <span className="text-[9px] font-mono text-cream/40 uppercase tracking-wider">Loading scores...</span>
      </div>
    );
  }

  if (tickerData.scores.length === 0) {
    return (
      <div className="h-7 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-2">
        <Radio className="w-3 h-3 text-cream/30" />
        <span className="text-[9px] font-mono text-cream/40 uppercase tracking-wider">
          No Recent Scores
        </span>
      </div>
    );
  }

  return (
    <div className="h-7 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center overflow-hidden">
      <div className="flex items-center gap-2 px-2 border-r border-white/10 h-full shrink-0">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[8px] font-display font-bold text-cream/60 uppercase">Live</span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <motion.div
          className="flex items-center gap-4 whitespace-nowrap px-2"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { repeat: Infinity, duration: 25, ease: 'linear' } }}
        >
          {[...tickerData.scores, ...tickerData.scores].map((score, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[9px] font-display font-bold text-cream uppercase">
                {score.corpsName}
              </span>
              <span className="text-[10px] font-data font-bold text-gold-400 tabular-nums">
                {typeof score.totalScore === 'number' ? score.totalScore.toFixed(2) : score.totalScore}
              </span>
              <span className="text-[8px] text-cream/20">|</span>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex items-center gap-1 px-2 border-l border-white/10 h-full shrink-0">
        <Calendar className="w-2.5 h-2.5 text-cream/40" />
        <span className="text-[8px] font-mono text-cream/50">Day {currentDay}</span>
      </div>
    </div>
  );
};

// =============================================================================
// HUD DASHBOARD COMPONENT
// =============================================================================

const HUDDashboard = () => {
  const { user } = useAuth();

  // Data hooks
  const dashboardData = useDashboardData();
  const { ownedStaff } = useStaffMarketplace(user?.uid);

  // Local state
  const [showStaffPanel, setShowStaffPanel] = useState(false);
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
    corps,
    seasonData,
    weeksRemaining,
    currentWeek,
    currentDay,
    engagementData,
    executionState,
    executionProcessing,
    rehearse,
    canRehearseToday,
    handleCorpsSwitch,
    refreshProfile,
    getCorpsClassName,
  } = dashboardData;

  // Calculate staff assigned to active corps
  const assignedStaff = useMemo(() =>
    ownedStaff?.filter(s => s.assignedTo?.corpsClass === activeCorpsClass) || [],
    [ownedStaff, activeCorpsClass]
  );

  // Calculate readiness sections
  const readiness = useMemo(() => {
    if (typeof executionState?.readiness === 'object') {
      const { brass = 0.75, percussion = 0.75, guard = 0.75, ensemble = 0.75 } = executionState.readiness;
      return { brass, percussion, guard, ensemble, avg: (brass + percussion + guard + ensemble) / 4 };
    }
    const val = executionState?.readiness ?? 0.75;
    return { brass: val, percussion: val, guard: val, ensemble: val, avg: val };
  }, [executionState?.readiness]);

  // Calculate morale sections
  const morale = useMemo(() => {
    if (typeof executionState?.morale === 'object') {
      const { brass = 0.80, percussion = 0.80, guard = 0.80, overall = 0.80 } = executionState.morale;
      return { brass, percussion, guard, overall, avg: (brass + percussion + guard) / 3 };
    }
    const val = executionState?.morale ?? 0.80;
    return { brass: val, percussion: val, guard: val, overall: val, avg: val };
  }, [executionState?.morale]);

  // Calculate equipment
  const equipment = useMemo(() => {
    const eq = executionState?.equipment || {};
    const instruments = eq.instruments ?? 0.90;
    const uniforms = eq.uniforms ?? 0.90;
    const props = eq.props ?? 0.90;
    const bus = eq.bus ?? 0.90;
    const truck = eq.truck ?? 0.90;
    const perfAvg = (instruments + uniforms + props) / 3;
    const travelAvg = (bus + truck) / 2;
    return { instruments, uniforms, props, bus, truck, perfAvg, travelAvg };
  }, [executionState?.equipment]);

  // Calculate multiplier breakdown
  const multiplierBreakdown = useMemo(() => {
    const readinessBonus = (readiness.avg - 0.80) * 0.60;
    const moraleBonus = (morale.avg - 0.75) * 0.32;
    const equipmentPenalty = (equipment.perfAvg - 1.00) * 0.50;
    const travelPenalty = (equipment.bus + equipment.truck) < 1.40 ? -0.03 : 0;

    // Staff effectiveness
    let staffBonus = -0.04; // Base understaffed penalty
    if (assignedStaff.length >= 6) staffBonus = 0.04;
    else if (assignedStaff.length >= 4) staffBonus = 0.02;

    // Show difficulty
    const showDesign = executionState?.showDesign || {};
    const isPrepared = readiness.avg >= (showDesign.preparednessThreshold || 0.80);
    const difficultyBonus = isPrepared
      ? (showDesign.ceilingBonus || 0.08)
      : (showDesign.riskPenalty || -0.10);

    // Temporal effects
    const fatiguePenalty = currentDay >= 35 ? -0.05 * ((currentDay - 35) / 14) : 0;
    const championshipBonus = currentDay >= 47 ? 0.02 : 0;

    return {
      readiness: readinessBonus,
      morale: moraleBonus,
      equipment: equipmentPenalty,
      travelCondition: travelPenalty,
      staff: staffBonus,
      showDifficulty: difficultyBonus,
      fatigue: fatiguePenalty,
      championshipPressure: championshipBonus,
    };
  }, [readiness.avg, morale.avg, equipment, assignedStaff.length, executionState?.showDesign, currentDay]);

  // Calculate final multiplier
  const multiplier = useMemo(() => {
    const total = 1.0 + Object.values(multiplierBreakdown).reduce((sum, v) => sum + v, 0);
    return Math.max(0.70, Math.min(1.10, total));
  }, [multiplierBreakdown]);

  // Get active temporal effects as pills
  const activeEffects = useMemo(() => {
    const effects = [];

    // Readiness effects
    if (readiness.avg >= 0.90) effects.push({ label: 'Peak Ready', value: '+8%', positive: true, icon: Target });
    else if (readiness.avg < 0.70) effects.push({ label: 'Unprepared', value: '-8%', positive: false, icon: Target });

    // Morale effects
    if (morale.avg >= 0.85) effects.push({ label: 'High Morale', value: '+5%', positive: true, icon: Heart });
    else if (morale.avg < 0.65) effects.push({ label: 'Low Morale', value: '-5%', positive: false, icon: Heart });

    // Staff effects
    if (assignedStaff.length >= 6) effects.push({ label: 'Full Staff', value: '+4%', positive: true, icon: Users });
    else if (assignedStaff.length < 4) effects.push({ label: 'Understaffed', value: '-4%', positive: false, icon: Users });

    // Equipment
    if (equipment.perfAvg < 0.80) effects.push({ label: 'Worn Gear', value: '-5%', positive: false, icon: Wrench });

    // Travel
    if ((equipment.bus + equipment.truck) < 1.40) {
      effects.push({ label: 'Travel Issue', value: '-3%', positive: false, icon: Bus });
    }

    // Temporal
    if (currentDay >= 47) effects.push({ label: 'Finals Week', value: '±2%', positive: true, icon: Trophy });
    else if (currentDay >= 35) effects.push({ label: 'Late Season', value: '-3%', positive: false, icon: Flame });

    // Show difficulty
    const showDesign = executionState?.showDesign || {};
    if (showDesign.label === 'legendary') {
      effects.push({ label: 'Legendary', value: '+15%', positive: true, icon: Crown });
    } else if (showDesign.label === 'ambitious') {
      effects.push({ label: 'Ambitious', value: '+10%', positive: true, icon: Zap });
    }

    return effects;
  }, [readiness.avg, morale.avg, assignedStaff.length, equipment, currentDay, executionState?.showDesign]);

  // Calculate synergy bonuses per caption
  const captionBonuses = useMemo(() => {
    const bonuses = {};
    const showConcept = activeCorps?.showConcept;
    const lineup = activeCorps?.lineup || {};

    CAPTIONS.forEach(caption => {
      const staffForCaption = assignedStaff.find(s =>
        s.assignedTo?.caption === caption.id || s.caption === caption.id
      );
      // Simplified synergy calculation based on lineup match
      const hasLineup = lineup[caption.id];
      bonuses[caption.id] = {
        staff: staffForCaption,
        bonus: hasLineup && showConcept?.theme ? 0.5 + Math.random() * 0.5 : 0,
      };
    });

    return bonuses;
  }, [activeCorps?.showConcept, activeCorps?.lineup, assignedStaff]);

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

  // Class colors for switcher
  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900',
    openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white',
    soundSport: 'bg-green-500 text-white',
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ================================================================
          GLOBAL HEADER - Constraints Bar
          ================================================================ */}
      <header className="shrink-0 h-11 bg-black/60 backdrop-blur-xl border-b border-white/10 px-3 flex items-center gap-4 z-20">
        {/* Left: Corps Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {activeCorps ? (
            hasMultipleCorps ? (
              <div className="flex items-center gap-1">
                {Object.entries(corps)
                  .map(([classId, corpsData]) => (
                    <button
                      key={classId}
                      onClick={() => handleCorpsSwitch(classId)}
                      className={`px-2 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wide transition-all ${
                        activeCorpsClass === classId
                          ? `${classColors[classId]} shadow-sm`
                          : 'bg-white/5 text-cream/60 hover:text-cream border border-white/10'
                      }`}
                    >
                      {(corpsData.corpsName || corpsData.name || '').slice(0, 10)}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-display font-bold uppercase tracking-widest ${classColors[activeCorpsClass]}`}>
                  {getCorpsClassName(activeCorpsClass)?.slice(0, 2)}
                </span>
                <span className="text-xs font-display font-bold text-cream truncate max-w-[100px]">
                  {activeCorps.corpsName || activeCorps.name}
                </span>
              </div>
            )
          ) : (
            <span className="text-xs font-display text-cream/50">No Corps</span>
          )}
        </div>

        {/* Center: Season Progress */}
        <div className="flex-1 hidden md:block max-w-xs">
          <SeasonProgressBar currentDay={currentDay} totalDays={49} />
        </div>

        {/* Right: Resources */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {engagementData?.loginStreak > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/30">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] font-data font-bold text-orange-400">{engagementData.loginStreak}</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/15 border border-gold-500/30">
            <Zap className="w-3 h-3 text-gold-400" />
            <span className="text-[10px] font-data font-bold text-gold-400">L{profile?.xpLevel || 1}</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/15 border border-gold-500/30">
            <span className="text-[10px] font-data font-bold text-gold-400">{(profile?.corpsCoin || 0).toLocaleString()} CC</span>
          </div>
        </div>
      </header>

      {/* ================================================================
          MAIN HUD BODY - 3-Column Layout
          ================================================================ */}
      <motion.div
        className="flex-1 min-h-0 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <CommandCenterLayout fullHeight>

          {/* ================================================================
              LEFT COLUMN: THE ENGINE - Stats & Physics
              ================================================================ */}
          <IntelligenceColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Readiness Matrix */}
              <Panel title="Readiness" variant="default" className="flex-none">
                <div className="space-y-1">
                  <SlimBar value={readiness.brass} label="Brass" color="blue" />
                  <SlimBar value={readiness.percussion} label="Perc" color="blue" />
                  <SlimBar value={readiness.guard} label="Guard" color="blue" />
                  <SlimBar value={readiness.ensemble} label="Ensemble" color="blue" />
                </div>
              </Panel>

              {/* Morale */}
              <Panel title="Morale" variant="default" className="flex-none">
                <div className="space-y-1">
                  <SlimBar value={morale.brass} label="Brass" color="green" />
                  <SlimBar value={morale.percussion} label="Perc" color="green" />
                  <SlimBar value={morale.guard} label="Guard" color="green" />
                </div>
              </Panel>

              {/* Active Effects List */}
              <Panel title="Active Effects" variant="sunken" className="flex-none">
                <div className="flex flex-wrap gap-1">
                  {activeEffects.length > 0 ? (
                    activeEffects.map((effect, idx) => (
                      <EffectPill
                        key={idx}
                        label={effect.label}
                        value={effect.value}
                        positive={effect.positive}
                        icon={effect.icon}
                      />
                    ))
                  ) : (
                    <span className="text-[9px] text-cream/40 italic">No active modifiers</span>
                  )}
                </div>
              </Panel>

              {/* Multiplier Calculator */}
              <Panel
                title="Multiplier Breakdown"
                subtitle={`Final: ${multiplier.toFixed(2)}x`}
                variant="accent"
                className="flex-1 min-h-0"
                scrollable
              >
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between py-1 border-b border-white/10 mb-1">
                    <span className="text-[9px] text-cream/50">Base</span>
                    <span className="text-[10px] font-data font-bold text-cream">1.00x</span>
                  </div>
                  {Object.entries(multiplierBreakdown)
                    .filter(([, val]) => Math.abs(val) > 0.001)
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .map(([key, value]) => (
                      <FactorRow
                        key={key}
                        label={MULTIPLIER_FACTORS[key]?.label || key}
                        value={value}
                        icon={MULTIPLIER_FACTORS[key]?.icon || Target}
                      />
                    ))}
                  <div className="flex items-center justify-between pt-1 mt-1 border-t border-white/10">
                    <span className="text-[9px] text-cream/50">Total</span>
                    <span className={`text-sm font-data font-bold ${
                      multiplier >= 1.0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {multiplier.toFixed(2)}x
                    </span>
                  </div>
                </div>
              </Panel>

            </motion.div>
          </IntelligenceColumn>

          {/* ================================================================
              CENTER COLUMN: THE STAGE - Action & Strategy
              ================================================================ */}
          <CommandColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Command Center - Action Buttons */}
              <Panel
                title="Command Center"
                subtitle={`Week ${currentWeek} • Day ${currentDay}`}
                variant="elevated"
                className="flex-none"
              >
                <div className="space-y-2">
                  {/* Full Rehearsal */}
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
                    <div className={`w-7 h-7 flex items-center justify-center rounded ${
                      canRehearseToday() ? 'bg-gold-500/30' : 'bg-green-500/20'
                    }`}>
                      {executionProcessing ? (
                        <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                      ) : canRehearseToday() ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-display font-bold uppercase">Full Rehearsal</div>
                      <div className="text-[9px] opacity-70">
                        {executionState?.rehearsalsThisWeek || 0}/7 this week
                      </div>
                    </div>
                  </button>

                  {/* Sectional Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
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

              {/* Show Concept & Caption Grid */}
              <Panel
                title="Show Design"
                subtitle={activeCorps?.showConcept?.theme || 'Not configured'}
                variant="default"
                className="flex-none"
                actions={
                  <Link to="/design" className="text-[8px] text-gold-400 hover:text-gold-300 uppercase">
                    Edit
                  </Link>
                }
              >
                {/* Theme & Style Tags */}
                <div className="flex items-center gap-1.5 mb-2">
                  {activeCorps?.showConcept?.theme && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-[9px] font-display font-bold text-purple-400 uppercase">
                      {activeCorps.showConcept.theme}
                    </span>
                  )}
                  {activeCorps?.showConcept?.drillStyle && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-[9px] font-display font-bold text-blue-400 uppercase">
                      {activeCorps.showConcept.drillStyle}
                    </span>
                  )}
                  {activeCorps?.showConcept?.musicSource && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-[9px] font-display font-bold text-orange-400 uppercase">
                      {activeCorps.showConcept.musicSource}
                    </span>
                  )}
                </div>

                {/* Caption Grid 2x4 */}
                <div className="grid grid-cols-4 gap-1">
                  {CAPTIONS.map(caption => (
                    <CaptionSlot
                      key={caption.id}
                      caption={caption}
                      staff={captionBonuses[caption.id]?.staff}
                      bonus={captionBonuses[caption.id]?.bonus || 0}
                    />
                  ))}
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

            </motion.div>
          </CommandColumn>

          {/* ================================================================
              RIGHT COLUMN: THE BACKSTAGE - Logistics
              ================================================================ */}
          <LogisticsColumn>
            <motion.div variants={columnVariants} className="h-full flex flex-col gap-1">

              {/* Mobile Toggle */}
              <button
                onClick={() => setShowMobileLogistics(!showMobileLogistics)}
                className="lg:hidden flex items-center justify-between w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-gold-400" />
                  <span className="text-xs font-display font-bold text-cream uppercase">Logistics</span>
                </div>
                {showMobileLogistics ? (
                  <ChevronUp className="w-4 h-4 text-cream/40" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-cream/40" />
                )}
              </button>

              {/* Collapsible Content */}
              <div className={`flex flex-col gap-1 flex-1 min-h-0 ${showMobileLogistics ? 'flex' : 'hidden lg:flex'}`}>

                {/* Staff Coverage Map - All 8 Slots */}
                <Panel
                  title="Staff Coverage"
                  subtitle={`${assignedStaff.length}/8 assigned`}
                  variant="default"
                  className="flex-1 min-h-0"
                  scrollable
                  actions={
                    <button
                      onClick={() => setShowStaffPanel(true)}
                      className="text-[8px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
                    >
                      Manage
                    </button>
                  }
                >
                  {/* 8-Slot Grid */}
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {CAPTIONS.map(caption => {
                      const staff = assignedStaff.find(s =>
                        s.assignedTo?.caption === caption.id || s.caption === caption.id
                      );
                      return (
                        <StaffSlotIcon
                          key={caption.id}
                          caption={caption.id}
                          staff={staff}
                          compact
                        />
                      );
                    })}
                  </div>

                  {/* Staff List */}
                  <div className="space-y-1">
                    {CAPTIONS.slice(0, 4).map(caption => {
                      const staff = assignedStaff.find(s =>
                        s.assignedTo?.caption === caption.id || s.caption === caption.id
                      );
                      return (
                        <StaffSlotIcon
                          key={caption.id}
                          caption={caption.id}
                          staff={staff}
                        />
                      );
                    })}
                    {CAPTIONS.length > 4 && assignedStaff.length < 4 && (
                      <Link
                        to="/staff"
                        className="block text-center py-1 text-[9px] text-gold-400 hover:text-gold-300"
                      >
                        + Hire more staff
                      </Link>
                    )}
                  </div>
                </Panel>

                {/* Performance Gear */}
                <Panel title="Performance Gear" variant="default" className="flex-none">
                  <div className="space-y-1">
                    <SlimBar value={equipment.uniforms} label="Uniforms" color="gold" size="xs" />
                    <SlimBar value={equipment.instruments} label="Instruments" color="gold" size="xs" />
                    <SlimBar value={equipment.props} label="Props" color="gold" size="xs" />
                  </div>
                </Panel>

                {/* Travel Fleet */}
                <Panel
                  title="Travel Fleet"
                  variant={equipment.travelAvg < 0.70 ? 'accent' : 'default'}
                  className="flex-none"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 rounded bg-white/5 border border-white/10">
                      <Bus className={`w-4 h-4 mx-auto mb-1 ${equipment.bus >= 0.70 ? 'text-blue-400' : 'text-red-400'}`} />
                      <div className={`text-lg font-data font-bold ${equipment.bus >= 0.70 ? 'text-blue-400' : 'text-red-400'}`}>
                        {Math.round(equipment.bus * 100)}%
                      </div>
                      <div className="text-[8px] text-cream/40 uppercase">Bus</div>
                    </div>
                    <div className="text-center p-2 rounded bg-white/5 border border-white/10">
                      <Truck className={`w-4 h-4 mx-auto mb-1 ${equipment.truck >= 0.70 ? 'text-blue-400' : 'text-red-400'}`} />
                      <div className={`text-lg font-data font-bold ${equipment.truck >= 0.70 ? 'text-blue-400' : 'text-red-400'}`}>
                        {Math.round(equipment.truck * 100)}%
                      </div>
                      <div className="text-[8px] text-cream/40 uppercase">Truck</div>
                    </div>
                  </div>
                  {(equipment.bus + equipment.truck) < 1.40 && (
                    <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/30">
                      <AlertTriangle className="w-3 h-3 text-orange-400" />
                      <span className="text-[9px] text-orange-400">Travel penalty active (-3%)</span>
                    </div>
                  )}
                </Panel>

                {/* Quick Links */}
                <Panel title="Navigation" variant="sunken" className="flex-none">
                  <div className="grid grid-cols-3 gap-1">
                    <Link
                      to="/schedule"
                      className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-[8px] text-cream/60">Schedule</span>
                    </Link>
                    <Link
                      to="/scores"
                      className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Trophy className="w-4 h-4 text-gold-400" />
                      <span className="text-[8px] text-cream/60">Scores</span>
                    </Link>
                    <Link
                      to="/staff"
                      className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Users className="w-4 h-4 text-green-400" />
                      <span className="text-[8px] text-cream/60">Market</span>
                    </Link>
                  </div>
                </Panel>

              </div>
            </motion.div>
          </LogisticsColumn>

        </CommandCenterLayout>
      </motion.div>

      {/* ================================================================
          TICKER FOOTER - Live Scores
          ================================================================ */}
      <LeagueTicker seasonData={seasonData} currentDay={currentDay} />

      {/* ================================================================
          STAFF PANEL (Slide-out - only for detailed management)
          ================================================================ */}
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
    </div>
  );
};

export default HUDDashboard;
