// =============================================================================
// HUD DASHBOARD - Director's Daily Briefing (Glass Cockpit v2)
// =============================================================================
// Comprehensive command center showing 100% of game state and mechanics.
// Every factor that affects scoring, operations, and progression is visible.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { useDashboardData } from '../hooks/useDashboardData';
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

// Firebase Functions
import {
  // claimDailyLogin is no longer used - login tracking happens automatically in useDashboardData
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
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Bus,
  Truck,
  Flame,
  Radio,
  Minus,
  Crown,
  DollarSign,
  Shield,
  Sparkles,
  Info,
} from 'lucide-react';

// =============================================================================
// GAME CONSTANTS - All the rules the director needs to know
// =============================================================================


// 5 Equipment items with their properties
const EQUIPMENT_CONFIG = {
  instruments: { name: 'Instruments', captions: ['B', 'MA', 'P'], repairCost: 50, upgradeCost: 500, icon: Music },
  uniforms: { name: 'Uniforms', captions: ['VP', 'VA'], repairCost: 30, upgradeCost: 300, icon: Shield },
  props: { name: 'Props', captions: ['CG'], repairCost: 75, upgradeCost: 750, icon: Flag },
  bus: { name: 'Tour Bus', captions: [], repairCost: 200, upgradeCost: 2000, icon: Bus, isTravel: true },
  truck: { name: 'Equip Truck', captions: [], repairCost: 250, upgradeCost: 2500, icon: Truck, isTravel: true },
};

// Show difficulty presets
const DIFFICULTY_PRESETS = {
  conservative: { label: 'Conservative', threshold: 0.70, ceiling: 0.04, risk: -0.05, color: 'green' },
  moderate: { label: 'Moderate', threshold: 0.80, ceiling: 0.08, risk: -0.10, color: 'blue' },
  ambitious: { label: 'Ambitious', threshold: 0.85, ceiling: 0.12, risk: -0.15, color: 'orange' },
  legendary: { label: 'Legendary', threshold: 0.90, ceiling: 0.15, risk: -0.20, color: 'red' },
};

// Daily operations removed - no daily grind pressure

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

// Compact stat bar with label
const StatBar = ({ value, label, color = 'blue', showValue = true, size = 'sm' }) => {
  const percent = Math.round((value || 0) * 100);
  const barColor = percent < 60 ? 'red' : percent < 80 ? 'orange' : color;

  const colors = {
    blue: 'bg-blue-500', green: 'bg-green-500', gold: 'bg-gold-500',
    orange: 'bg-orange-500', purple: 'bg-purple-500', red: 'bg-red-500',
  };
  const textColors = {
    blue: 'text-blue-400', green: 'text-green-400', gold: 'text-gold-400',
    orange: 'text-orange-400', purple: 'text-purple-400', red: 'text-red-400',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`${size === 'xs' ? 'text-[8px] w-16' : 'text-[9px] w-20'} font-display font-bold text-cream/60 uppercase tracking-wide shrink-0 truncate`}>
        {label}
      </span>
      <div className={`flex-1 ${size === 'xs' ? 'h-1' : 'h-1.5'} bg-white/10 rounded-full overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${colors[barColor]} rounded-full`}
        />
      </div>
      {showValue && (
        <span className={`${size === 'xs' ? 'text-[8px] w-6' : 'text-[9px] w-8'} font-data font-bold text-right ${textColors[barColor]}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

// Factor row for multiplier breakdown showing the actual math
const MultiplierFactorRow = ({ label, contribution, range, icon: Icon, explanation, isActive = true }) => {
  const isPositive = contribution > 0.005;
  const isNegative = contribution < -0.005;
  const colorClass = !isActive ? 'text-cream/20' : isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-cream/40';
  const bgClass = !isActive ? 'bg-white/[0.02]' : isPositive ? 'bg-green-500/10' : isNegative ? 'bg-red-500/10' : 'bg-white/5';

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${bgClass} border border-white/5`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-display font-bold ${isActive ? 'text-cream' : 'text-cream/30'} truncate`}>{label}</span>
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-cream/30">{range}</span>
            <span className={`text-[10px] font-data font-bold ${colorClass} tabular-nums`}>
              {isPositive ? '+' : ''}{(contribution * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        {explanation && (
          <div className={`text-[8px] ${isActive ? 'text-cream/50' : 'text-cream/20'} truncate`}>{explanation}</div>
        )}
      </div>
    </div>
  );
};

// Staff slot showing assignment and effectiveness
const StaffSlotDetail = ({ caption, staff, isMatched }) => {
  const hasStaff = !!staff;

  return (
    <div className={`p-2 rounded border ${
      hasStaff
        ? isMatched ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'
        : 'bg-red-500/5 border-red-500/20 border-dashed'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-display font-bold ${hasStaff ? 'text-cream' : 'text-red-400/60'}`}>
          {caption.id}
        </span>
        {hasStaff ? (
          <span className={`text-[8px] px-1 rounded ${isMatched ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {isMatched ? '+15%' : '-5%'}
          </span>
        ) : (
          <span className="text-[8px] text-red-400/60">-25%</span>
        )}
      </div>
      {hasStaff ? (
        <>
          <div className="text-[9px] text-cream/80 truncate">{staff.name}</div>
          <div className="flex items-center gap-2 mt-1 text-[8px] text-cream/40">
            <span>Rating: {staff.rating || '?'}</span>
            <span>Morale: {Math.round((staff.morale || 0.9) * 100)}%</span>
          </div>
        </>
      ) : (
        <div className="text-[8px] text-cream/30 italic">No staff - scoring penalty!</div>
      )}
    </div>
  );
};

// Equipment item with full details
const EquipmentDetail = ({ id, config, condition, maxCondition }) => {
  const percent = Math.round((condition || 0.9) * 100);
  const needsRepair = percent < 80;
  const repairCost = Math.ceil(((maxCondition || 1) - (condition || 0.9)) / 0.10) * config.repairCost;
  const Icon = config.icon;

  return (
    <div className={`p-2 rounded border ${needsRepair ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${needsRepair ? 'text-orange-400' : 'text-cream/60'}`} />
        <span className="text-[9px] font-display font-bold text-cream flex-1">{config.name}</span>
        <span className={`text-[10px] font-data font-bold ${needsRepair ? 'text-orange-400' : 'text-green-400'}`}>
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full ${needsRepair ? 'bg-orange-500' : 'bg-green-500'}`}
          style={{ width: `${(condition / (maxCondition || 1)) * 100}%` }}
        />
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-[8px]">
        <span className="text-cream/40">
          {config.captions.length > 0 ? `Affects: ${config.captions.join(', ')}` : config.isTravel ? 'Travel Health' : ''}
        </span>
        {needsRepair && repairCost > 0 && (
          <span className="text-orange-400">Repair: {repairCost} CC</span>
        )}
      </div>
    </div>
  );
};

// Season progress bar with milestones
const SeasonTimeline = ({ currentDay, totalDays = 49 }) => {
  const progress = (currentDay / totalDays) * 100;
  const currentWeek = Math.ceil(currentDay / 7);

  const milestones = [
    { day: 10, label: 'Difficulty Lock', passed: currentDay > 10 },
    { day: 35, label: 'Fatigue Starts', passed: currentDay > 35 },
    { day: 47, label: 'Finals', passed: currentDay >= 47 },
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[8px]">
        <span className="text-cream/50">Season Progress</span>
        <span className="font-data font-bold text-gold-400">Week {currentWeek} • Day {currentDay}/{totalDays}</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-600 to-gold-400 rounded-full"
          style={{ width: `${progress}%` }}
        />
        {milestones.map(m => (
          <div
            key={m.day}
            className={`absolute top-0 bottom-0 w-0.5 ${m.passed ? 'bg-cream/20' : 'bg-white/40'}`}
            style={{ left: `${(m.day / totalDays) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[7px] text-cream/30">
        {milestones.map(m => (
          <span key={m.day} className={m.passed ? 'text-cream/20' : 'text-cream/50'}>
            D{m.day}: {m.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Warning/Alert banner
const AlertBanner = ({ type = 'warning', children }) => {
  const styles = {
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    danger: 'bg-red-500/10 border-red-500/30 text-red-400',
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };
  const icons = { warning: AlertTriangle, danger: AlertCircle, success: Check, info: Info };
  const Icon = icons[type];

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border ${styles[type]}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span className="text-[9px]">{children}</span>
    </div>
  );
};

// Live ticker footer
const LeagueTicker = ({ currentDay }) => {
  const { allShows, loading } = useScoresData();
  const [scores, setScores] = useState([]);

  useEffect(() => {
    if (!loading && allShows?.length > 0) {
      const recent = allShows
        .filter(show => show.offSeasonDay >= currentDay - 3 && show.offSeasonDay <= currentDay)
        .flatMap(show => (show.scores || []).slice(0, 5).map(s => ({
          corps: s.corpsName || s.corps,
          score: s.totalScore || s.score,
        })))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
      setScores(recent);
    }
  }, [allShows, loading, currentDay]);

  if (scores.length === 0) {
    return (
      <div className="h-6 bg-black/60 border-t border-white/10 flex items-center justify-center">
        <Radio className="w-3 h-3 text-cream/30 mr-2" />
        <span className="text-[8px] text-cream/40">No Recent Scores</span>
      </div>
    );
  }

  return (
    <div className="h-6 bg-black/60 border-t border-white/10 flex items-center overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 border-r border-white/10 h-full shrink-0">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[7px] font-bold text-cream/60">LIVE</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex items-center gap-3 whitespace-nowrap px-2"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { repeat: Infinity, duration: 20, ease: 'linear' } }}
        >
          {[...scores, ...scores].map((s, i) => (
            <span key={i} className="text-[9px]">
              <span className="font-display font-bold text-cream">{s.corps}</span>
              {' '}
              <span className="font-data text-gold-400">{typeof s.score === 'number' ? s.score.toFixed(2) : s.score}</span>
              <span className="text-cream/20 mx-1">|</span>
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN HUD DASHBOARD
// =============================================================================

const HUDDashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();

  // Daily ops state removed - no daily grind pressure
  const [showMobileLogistics, setShowMobileLogistics] = useState(false);

  const {
    profile,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    corps,
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

  // ==========================================================================
  // COMPUTED DATA
  // ==========================================================================

  const readiness = useMemo(() => {
    const r = executionState?.readiness;
    if (typeof r === 'object') {
      return {
        brass: r.brass ?? 0.75, percussion: r.percussion ?? 0.75,
        guard: r.guard ?? 0.75, ensemble: r.ensemble ?? 0.75,
        avg: ((r.brass ?? 0.75) + (r.percussion ?? 0.75) + (r.guard ?? 0.75) + (r.ensemble ?? 0.75)) / 4,
      };
    }
    const val = r ?? 0.75;
    return { brass: val, percussion: val, guard: val, ensemble: val, avg: val };
  }, [executionState?.readiness]);

  const morale = useMemo(() => {
    const m = executionState?.morale;
    if (typeof m === 'object') {
      return {
        brass: m.brass ?? 0.80, percussion: m.percussion ?? 0.80,
        guard: m.guard ?? 0.80, overall: m.overall ?? 0.80,
        avg: ((m.brass ?? 0.80) + (m.percussion ?? 0.80) + (m.guard ?? 0.80)) / 3,
      };
    }
    const val = m ?? 0.80;
    return { brass: val, percussion: val, guard: val, overall: val, avg: val };
  }, [executionState?.morale]);

  const equipment = useMemo(() => {
    const eq = executionState?.equipment || {};
    return {
      instruments: eq.instruments ?? 0.90, instrumentsMax: eq.instrumentsMax ?? 1.00,
      uniforms: eq.uniforms ?? 0.90, uniformsMax: eq.uniformsMax ?? 1.00,
      props: eq.props ?? 0.90, propsMax: eq.propsMax ?? 1.00,
      bus: eq.bus ?? 0.90, busMax: eq.busMax ?? 1.00,
      truck: eq.truck ?? 0.90, truckMax: eq.truckMax ?? 1.00,
    };
  }, [executionState?.equipment]);

  const showDifficulty = useMemo(() => {
    const sd = executionState?.showDesign || {};
    const preset = Object.entries(DIFFICULTY_PRESETS).find(([_, p]) =>
      Math.abs(p.threshold - (sd.preparednessThreshold || 0.80)) < 0.02
    );
    return {
      key: preset?.[0] || 'moderate',
      label: preset?.[1]?.label || 'Moderate',
      threshold: sd.preparednessThreshold ?? 0.80,
      ceiling: sd.ceilingBonus ?? 0.08,
      risk: sd.riskPenalty ?? -0.10,
      isPrepared: readiness.avg >= (sd.preparednessThreshold ?? 0.80),
    };
  }, [executionState?.showDesign, readiness.avg]);

  // ==========================================================================
  // MULTIPLIER BREAKDOWN - All 9 factors
  // ==========================================================================

  const multiplierFactors = useMemo(() => {
    const factors = [];
    const eqAvg = (equipment.instruments + equipment.uniforms + equipment.props) / 3;
    const travelHealth = equipment.bus + equipment.truck;

    // 1. Section Readiness (±12%)
    const readinessContrib = (readiness.avg - 0.80) * 0.60;
    factors.push({
      id: 'readiness', label: 'Section Readiness', range: '±12%',
      contribution: readinessContrib, icon: Target,
      explanation: `${Math.round(readiness.avg * 100)}% avg vs 80% baseline`,
      isActive: true,
    });

    // 2. Equipment Condition (-5% to 0%)
    const eqContrib = (eqAvg - 1.00) * 0.50;
    factors.push({
      id: 'equipment', label: 'Equipment Condition', range: '-5% to 0%',
      contribution: eqContrib, icon: Wrench,
      explanation: `${Math.round(eqAvg * 100)}% avg (100% = no penalty)`,
      isActive: true,
    });

    // 3. Travel Health (-3% if combined < 140%)
    const travelContrib = travelHealth < 1.40 ? -0.03 : 0;
    factors.push({
      id: 'travel', label: 'Travel Health', range: '-3%',
      contribution: travelContrib, icon: Bus,
      explanation: `Bus+Truck = ${Math.round(travelHealth * 50)}% (need ≥140%)`,
      isActive: travelContrib !== 0,
    });

    // 4. Corps Morale (±8%)
    const moraleContrib = (morale.avg - 0.75) * 0.32;
    factors.push({
      id: 'morale', label: 'Corps Morale', range: '±8%',
      contribution: moraleContrib, icon: Heart,
      explanation: `${Math.round(morale.avg * 100)}% avg vs 75% baseline`,
      isActive: true,
    });

    // 5. Show Difficulty (±15%)
    const diffContrib = showDifficulty.isPrepared ? showDifficulty.ceiling : showDifficulty.risk;
    factors.push({
      id: 'difficulty', label: `Show: ${showDifficulty.label}`, range: '±15%',
      contribution: diffContrib, icon: showDifficulty.isPrepared ? Crown : AlertTriangle,
      explanation: showDifficulty.isPrepared
        ? `Ready! Need ${Math.round(showDifficulty.threshold * 100)}%, have ${Math.round(readiness.avg * 100)}%`
        : `NOT READY! Need ${Math.round(showDifficulty.threshold * 100)}%, have ${Math.round(readiness.avg * 100)}%`,
      isActive: true,
    });

    // 6. Random Variance (±2%)
    factors.push({
      id: 'variance', label: 'Daily Variance', range: '±2%',
      contribution: 0, icon: Sparkles,
      explanation: 'Random each show (weather, nerves)',
      isActive: false,
    });

    // 7. Championship Pressure (±2%, finals only)
    const champContrib = currentDay >= 47 ? (morale.overall - 0.80) * 0.10 : 0;
    factors.push({
      id: 'championship', label: 'Championship Pressure', range: '±2%',
      contribution: champContrib, icon: Trophy,
      explanation: currentDay >= 47 ? `Finals week! Morale ${Math.round(morale.overall * 100)}%` : 'Days 47-49 only',
      isActive: currentDay >= 47,
    });

    // 8. Late Season Fatigue (-5% max)
    const fatigueContrib = currentDay > 35 ? -0.05 * ((currentDay - 35) / 14) : 0;
    factors.push({
      id: 'fatigue', label: 'Late Season Fatigue', range: '-5% max',
      contribution: fatigueContrib, icon: Flame,
      explanation: currentDay > 35 ? `Day ${currentDay}: ${Math.round(((currentDay - 35) / 14) * 100)}% fatigue` : 'Starts day 35',
      isActive: currentDay > 35,
    });

    return factors;
  }, [readiness, morale, equipment, assignedStaff.length, staffByCaption, showDifficulty, currentDay]);

  const finalMultiplier = useMemo(() => {
    const total = 1.0 + multiplierFactors.reduce((sum, f) => sum + f.contribution, 0);
    return Math.max(0.70, Math.min(1.10, total));
  }, [multiplierFactors]);

  // ==========================================================================
  // ALERTS
  // ==========================================================================

  const alerts = useMemo(() => {
    const list = [];

    const lowEquipment = Object.entries(equipment)
      .filter(([k, v]) => !k.includes('Max') && v < 0.70)
      .map(([k]) => EQUIPMENT_CONFIG[k]?.name || k);
    if (lowEquipment.length > 0) {
      list.push({ type: 'warning', msg: `Low equipment: ${lowEquipment.join(', ')}` });
    }

    if ((equipment.bus + equipment.truck) < 1.40) {
      list.push({ type: 'danger', msg: 'Travel penalty active (-3%)! Repair Bus/Truck.' });
    }

    if (!showDifficulty.isPrepared) {
      list.push({ type: 'warning', msg: `Not ready for ${showDifficulty.label} show (${Math.round(showDifficulty.risk * 100)}% penalty).` });
    }

    if (morale.avg < 0.65) {
      list.push({ type: 'warning', msg: 'Corps morale is critically low.' });
    }

    return list;
  }, [equipment, showDifficulty, morale.avg]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  // Daily ops handlers removed - no daily grind pressure

  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900', openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white', soundSport: 'bg-green-500 text-white',
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="shrink-0 bg-black/60 backdrop-blur-xl border-b border-white/10 px-3 py-2 z-20">
        <div className="flex items-center gap-4 mb-2">
          {/* Corps Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {activeCorps && (
              hasMultipleCorps ? (
                <div className="flex items-center gap-1">
                  {Object.entries(corps).map(([classId, data]) => (
                    <button key={classId} onClick={() => handleCorpsSwitch(classId)}
                      className={`px-2 py-0.5 rounded text-[9px] font-display font-bold uppercase ${
                        activeCorpsClass === classId ? `${classColors[classId]} shadow-sm` : 'bg-white/5 text-cream/60 hover:text-cream border border-white/10'
                      }`}>{(data.corpsName || data.name || '').slice(0, 10)}</button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${classColors[activeCorpsClass]}`}>
                    {getCorpsClassName(activeCorpsClass)?.slice(0, 2)}</span>
                  <span className="text-xs font-display font-bold text-cream truncate max-w-[120px]">{activeCorps.corpsName || activeCorps.name}</span>
                </div>
              )
            )}
          </div>

          {/* Resources */}
          <div className="flex items-center gap-2 ml-auto">
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
              <DollarSign className="w-3 h-3 text-gold-400" />
              <span className="text-[10px] font-data font-bold text-gold-400">{(profile?.corpsCoin || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <SeasonTimeline currentDay={currentDay} />
      </header>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div className="shrink-0 px-3 py-1.5 bg-black/40 border-b border-white/5 space-y-1">
          {alerts.slice(0, 2).map((a, i) => <AlertBanner key={i} type={a.type}>{a.msg}</AlertBanner>)}
        </div>
      )}

      {/* MAIN BODY */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CommandCenterLayout fullHeight>

          {/* LEFT: SCORING INTELLIGENCE */}
          <IntelligenceColumn>
            <div className="h-full flex flex-col gap-1 overflow-y-auto">

              {/* Final Multiplier */}
              <Panel variant="accent" className="flex-none">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-cream/50 uppercase">Score Multiplier</div>
                    <div className={`text-2xl font-data font-black ${finalMultiplier >= 1.0 ? 'text-green-400' : 'text-red-400'}`}>
                      {finalMultiplier.toFixed(3)}x
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-cream/40">Range: 0.70 - 1.10</div>
                    <div className={`text-[10px] font-bold ${finalMultiplier >= 1.0 ? 'text-green-400' : 'text-red-400'}`}>
                      {finalMultiplier >= 1.0 ? '+' : ''}{((finalMultiplier - 1) * 100).toFixed(1)}% from base
                    </div>
                  </div>
                </div>
              </Panel>

              {/* 9 Scoring Factors */}
              <Panel title="9 Scoring Factors" subtitle="How your score multiplier is calculated" variant="default" className="flex-1 min-h-0" scrollable>
                <div className="space-y-1">
                  {multiplierFactors.map(f => (
                    <MultiplierFactorRow key={f.id} {...f} />
                  ))}
                </div>
              </Panel>

              {/* Section Stats */}
              <Panel title="Section Readiness" variant="default" className="flex-none">
                <div className="space-y-1">
                  <StatBar value={readiness.brass} label="Brass (B,MA)" color="blue" />
                  <StatBar value={readiness.percussion} label="Percussion (P)" color="blue" />
                  <StatBar value={readiness.guard} label="Guard (VP,VA,CG)" color="blue" />
                  <StatBar value={readiness.ensemble} label="Ensemble (GE)" color="blue" />
                </div>
              </Panel>

              <Panel title="Corps Morale" variant="default" className="flex-none">
                <div className="space-y-1">
                  <StatBar value={morale.brass} label="Brass" color="green" />
                  <StatBar value={morale.percussion} label="Percussion" color="green" />
                  <StatBar value={morale.guard} label="Guard" color="green" />
                </div>
              </Panel>

            </div>
          </IntelligenceColumn>

          {/* CENTER: OPERATIONS */}
          <CommandColumn>
            <div className="h-full flex flex-col gap-1 overflow-y-auto">

              {/* Full Rehearsal */}
              <Panel title="Daily Rehearsal" subtitle="+5% readiness, -2% morale, -1% equipment wear" variant="elevated" className="flex-none">
                <button onClick={handleRehearsal} disabled={!canRehearseToday() || executionProcessing}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    canRehearseToday() ? 'bg-gold-500/20 border-gold-500/40 text-gold-400 hover:bg-gold-500/30' : 'bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                  <div className={`w-8 h-8 flex items-center justify-center rounded ${canRehearseToday() ? 'bg-gold-500/30' : 'bg-green-500/20'}`}>
                    {executionProcessing ? <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                      : canRehearseToday() ? <Play className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-display font-bold uppercase">{canRehearseToday() ? 'Run Full Rehearsal' : 'Done Today'}</div>
                    <div className="text-[9px] opacity-70">{executionState?.rehearsalsThisWeek || 0}/7 this week • +25 XP • Perfect week = +50 bonus</div>
                  </div>
                </button>
              </Panel>

              {/* Show Difficulty */}
              <Panel title="Show Configuration" variant="default" className="flex-none">
                <div className={`p-2 rounded border ${showDifficulty.isPrepared ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-display font-bold text-cream uppercase">{showDifficulty.label} Difficulty</span>
                    <span className={`text-[9px] px-1.5 rounded ${showDifficulty.isPrepared ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {showDifficulty.isPrepared ? 'PREPARED' : 'NOT READY'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[8px]">
                    <div><div className="text-cream/40">Threshold</div><div className="font-data font-bold text-cream">{Math.round(showDifficulty.threshold * 100)}%</div></div>
                    <div><div className="text-cream/40">If Ready</div><div className="font-data font-bold text-green-400">+{Math.round(showDifficulty.ceiling * 100)}%</div></div>
                    <div><div className="text-cream/40">If Not</div><div className="font-data font-bold text-red-400">{Math.round(showDifficulty.risk * 100)}%</div></div>
                  </div>
                </div>
                <div className="mt-2 text-[8px] text-cream/40">
                  Current readiness: {Math.round(readiness.avg * 100)}%
                  {!showDifficulty.isPrepared && ` (need ${Math.round(showDifficulty.threshold * 100)}%)`}
                  {currentDay <= 10 && ' • Can change difficulty until Day 10'}
                </div>
              </Panel>

            </div>
          </CommandColumn>

          {/* RIGHT: LOGISTICS */}
          <LogisticsColumn>
            <div className="h-full flex flex-col gap-1 overflow-y-auto">

              {/* Mobile Toggle */}
              <button onClick={() => setShowMobileLogistics(!showMobileLogistics)}
                className="lg:hidden flex items-center justify-between w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-gold-400" />
                  <span className="text-xs font-display font-bold text-cream uppercase">Logistics</span>
                </div>
                {showMobileLogistics ? <ChevronUp className="w-4 h-4 text-cream/40" /> : <ChevronDown className="w-4 h-4 text-cream/40" />}
              </button>

              <div className={`flex flex-col gap-1 flex-1 min-h-0 ${showMobileLogistics ? 'flex' : 'hidden lg:flex'}`}>

                {/* Staff Coverage - All 8 */}
                <Panel title="8 Staff Positions" subtitle={`${assignedStaff.length}/8 filled • +15% match, -5% mismatch, -25% vacant`}
                  variant="default" className="flex-1 min-h-0" scrollable
                  actions={<button onClick={() => setShowStaffPanel(true)} className="text-[8px] text-gold-400 hover:text-gold-300 uppercase">Manage</button>}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CAPTIONS.map(c => (
                      <StaffSlotDetail key={c.id} caption={c} staff={staffByCaption[c.id]?.staff} isMatched={staffByCaption[c.id]?.isMatched} />
                    ))}
                  </div>
                </Panel>

                {/* Equipment - All 5 */}
                <Panel title="5 Equipment Items" subtitle="Performance gear + Travel fleet" variant="default" className="flex-none">
                  <div className="space-y-1.5">
                    {Object.entries(EQUIPMENT_CONFIG).map(([id, config]) => (
                      <EquipmentDetail key={id} id={id} config={config} condition={equipment[id]} maxCondition={equipment[`${id}Max`]} />
                    ))}
                  </div>
                </Panel>

                {/* Quick Links */}
                <Panel variant="sunken" className="flex-none">
                  <div className="grid grid-cols-3 gap-1">
                    <Link to="/schedule" className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10">
                      <Calendar className="w-4 h-4 text-purple-400" /><span className="text-[8px] text-cream/60">Schedule</span></Link>
                    <Link to="/scores" className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10">
                      <Trophy className="w-4 h-4 text-gold-400" /><span className="text-[8px] text-cream/60">Scores</span></Link>
                    <Link to="/staff" className="flex flex-col items-center gap-1 p-2 rounded bg-white/5 hover:bg-white/10">
                      <Users className="w-4 h-4 text-green-400" /><span className="text-[8px] text-cream/60">Market</span></Link>
                  </div>
                </Panel>

              </div>
            </div>
          </LogisticsColumn>

        </CommandCenterLayout>
      </div>

      {/* FOOTER */}
      <LeagueTicker currentDay={currentDay} />

    </div>
  );
};

export default HUDDashboard;
