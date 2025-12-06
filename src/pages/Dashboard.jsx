// src/pages/Dashboard.jsx
// ARCHITECTURE: High-Density HUD (Heads-Up Display) - One-Page Command Center
// Three-Column Layout: Intelligence | Command | Logistics
// No scrolling on desktop - everything fits in viewport
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit, BarChart3, Settings, Clock, RefreshCw,
  CheckCircle, Circle, ArrowUp, AlertTriangle, ChevronRight,
  Shield, Eye, Drum, Flag, Activity, Radio, Gauge
} from 'lucide-react';
import { useAuth } from '../App';
import BrandLogo from '../components/BrandLogo';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  EquipmentManager,
  DashboardStaffPanel,
  ExecutionInsightsPanel,
  SectionGauges,
  MultiplierGlassBoxLarge,
  ConfidenceBadge,
} from '../components/Execution';
import CaptionSelectionModal from '../components/CaptionSelection/CaptionSelectionModal';
import ShowConceptSelector from '../components/ShowConcept/ShowConceptSelector';
import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  MorningReport,
  DailyOperations,
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { useScoresData } from '../hooks/useScoresData';
import { retireCorps } from '../firebase/functions';
import { useSeasonStore } from '../store/seasonStore';

// ============================================================================
// DESIGN TOKENS (from audit)
// ============================================================================
const classColors = {
  worldClass: 'bg-gold-500 text-charcoal-900',
  openClass: 'bg-purple-500 text-white',
  aClass: 'bg-blue-500 text-white',
  soundSport: 'bg-green-500 text-white',
};

const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// ============================================================================
// REUSABLE HUD COMPONENTS
// ============================================================================

// Resource Pill - Compact stat display for header
const ResourcePill = ({ icon: Icon, value, label, color = 'gold', onClick, pulse = false }) => {
  const colorMap = {
    gold: 'text-gold-400 bg-gold-500/15 border-gold-500/30',
    blue: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    green: 'text-green-400 bg-green-500/15 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-sm transition-all ${colorMap[color]} ${onClick ? 'hover:bg-white/10 cursor-pointer' : ''} ${pulse ? 'animate-pulse' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-sm font-data font-bold tabular-nums">{value}</span>
      {label && <span className="text-[9px] text-cream/50 uppercase tracking-wide">{label}</span>}
    </Wrapper>
  );
};

// Section Progress Bar - Compact progress with label
const SectionProgressBar = ({ value, label, color = 'blue', showPercent = true }) => {
  const bgMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    gold: 'bg-gold-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };
  const textMap = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    gold: 'text-gold-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  const percent = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wide w-14 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full ${bgMap[color]} rounded-full`}
        />
      </div>
      {showPercent && (
        <span className={`text-[10px] font-data font-bold w-8 text-right ${textMap[color]}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

// Multiplier Badge - Shows active buff/debuff
const MultiplierBadge = ({ label, value, positive = true }) => (
  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-data font-bold ${
    positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
  }`}>
    <span>{label}:</span>
    <span>{positive ? '+' : ''}{value}</span>
  </div>
);

// Action Button - Primary action tile
const ActionButton = ({ icon: Icon, label, subtitle, onClick, disabled, processing, completed, color = 'gold', size = 'md' }) => {
  const colorMap = {
    gold: { bg: 'bg-gold-500/20', border: 'border-gold-500/40', icon: 'text-gold-400', hover: 'hover:bg-gold-500/30' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', icon: 'text-blue-400', hover: 'hover:bg-blue-500/30' },
    green: { bg: 'bg-green-500/20', border: 'border-green-500/40', icon: 'text-green-400', hover: 'hover:bg-green-500/30' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', icon: 'text-purple-400', hover: 'hover:bg-purple-500/30' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', icon: 'text-orange-400', hover: 'hover:bg-orange-500/30' },
  };
  const c = colorMap[color];
  const sizeClass = size === 'sm' ? 'p-2' : size === 'lg' ? 'p-4' : 'p-3';

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || processing}
      whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
      whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
      className={`
        ${sizeClass} flex items-center gap-3 w-full
        bg-black/40 backdrop-blur-md border border-white/10 rounded-lg
        transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed' : `cursor-pointer hover:border-white/20 ${c.hover}`}
        ${completed ? 'border-green-500/40 bg-green-500/10' : ''}
      `}
    >
      <div className={`p-2 rounded-lg ${completed ? 'bg-green-500/20' : c.bg} border ${completed ? 'border-green-500/40' : c.border}`}>
        {processing ? (
          <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        ) : completed ? (
          <Check className="w-5 h-5 text-green-400" />
        ) : (
          <Icon className={`w-5 h-5 ${c.icon}`} />
        )}
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-display font-bold text-cream uppercase tracking-wide">{label}</div>
        {subtitle && <div className="text-[10px] text-cream/50">{subtitle}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-cream/30" />
    </motion.button>
  );
};

// Task Checkbox - Daily task checklist item
const TaskCheckbox = ({ title, reward, completed, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={completed || loading}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
      completed ? 'opacity-50 cursor-default' : 'hover:bg-white/5 cursor-pointer'
    }`}
  >
    <div className={`w-5 h-5 flex items-center justify-center rounded border transition-all ${
      completed
        ? 'bg-green-500/20 border-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
        : 'bg-transparent border-white/20'
    }`}>
      {loading ? (
        <div className="w-3 h-3 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      ) : completed ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : null}
    </div>
    <span className={`flex-1 text-left text-sm font-mono ${completed ? 'text-cream/50 line-through' : 'text-cream'}`}>
      {title}
    </span>
    <span className={`text-xs font-data font-bold ${completed ? 'text-gold-400/50' : 'text-gold-400'}`}>
      {reward}
    </span>
  </button>
);

// Stat Card - Compact stat display for logistics
const StatCard = ({ label, value, icon: Icon, color = 'gold', action, actionLabel }) => {
  const colorMap = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-display font-bold text-cream/50 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${colorMap[color]}`} />}
      </div>
      <div className={`text-2xl font-data font-bold ${colorMap[color]} tabular-nums`}>{value}</div>
      {action && (
        <button
          onClick={action}
          className="mt-2 text-[10px] font-display font-bold text-gold-400 uppercase tracking-wide hover:text-gold-300 transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
};

// ============================================================================
// LEAGUE TICKER COMPONENT - Live Data Footer
// ============================================================================
const LeagueTicker = ({ seasonData, currentDay }) => {
  const [tickerData, setTickerData] = useState({ scores: [], loading: true, error: null });
  const { allShows, loading: scoresLoading } = useScoresData();

  // Get recent show results for ticker
  useEffect(() => {
    if (!scoresLoading && allShows.length > 0) {
      // Get scores from yesterday and today
      const recentShows = allShows
        .filter(show => show.offSeasonDay >= currentDay - 1 && show.offSeasonDay <= currentDay)
        .flatMap(show =>
          show.scores.slice(0, 5).map(score => ({
            corpsName: score.corpsName || score.corps,
            totalScore: score.totalScore || score.score,
            eventName: show.eventName,
            day: show.offSeasonDay,
            corpsClass: score.corpsClass,
          }))
        )
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      setTickerData({ scores: recentShows, loading: false, error: null });
    } else if (!scoresLoading && allShows.length === 0) {
      setTickerData({ scores: [], loading: false, error: null });
    }
  }, [allShows, scoresLoading, currentDay]);

  // No data state
  if (tickerData.loading) {
    return (
      <div className="h-8 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-center">
        <span className="text-[10px] font-mono text-cream/40 uppercase tracking-wider">Loading league data...</span>
      </div>
    );
  }

  if (tickerData.scores.length === 0) {
    const isOffSeason = !seasonData || seasonData.seasonType === 'off';
    return (
      <div className="h-8 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-2">
        <Radio className="w-3 h-3 text-cream/30" />
        <span className="text-[10px] font-mono text-cream/40 uppercase tracking-wider">
          {isOffSeason ? 'Off-Season • No Active Shows' : 'Season Pending • Check Schedule'}
        </span>
      </div>
    );
  }

  return (
    <div className="h-8 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center overflow-hidden">
      {/* Ticker Label */}
      <div className="flex items-center gap-2 px-3 border-r border-white/10 h-full shrink-0">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Live</span>
      </div>

      {/* Scrolling Ticker */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          className="flex items-center gap-6 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { repeat: Infinity, duration: 30, ease: 'linear' } }}
        >
          {/* Double the content for seamless loop */}
          {[...tickerData.scores, ...tickerData.scores].map((score, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[10px] font-display font-bold text-cream uppercase">
                {score.corpsName}
              </span>
              <span className="text-[11px] font-data font-bold text-gold-400 tabular-nums">
                {typeof score.totalScore === 'number' ? score.totalScore.toFixed(3) : score.totalScore}
              </span>
              <span className="text-[9px] text-cream/30">•</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Day Indicator */}
      <div className="flex items-center gap-1.5 px-3 border-l border-white/10 h-full shrink-0">
        <Calendar className="w-3 h-3 text-cream/40" />
        <span className="text-[9px] font-mono text-cream/50">Day {currentDay}</span>
      </div>
    </div>
  );
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const columnVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] } },
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
const Dashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const { ownedStaff } = useStaffMarketplace(user?.uid);

  // Modal states
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [showClassUnlockCongrats, setShowClassUnlockCongrats] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [showMorningReport, setShowMorningReport] = useState(false);

  // Panel states
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [showDailyActivities, setShowDailyActivities] = useState(false);
  const [showExecutionInsights, setShowExecutionInsights] = useState(false);
  const [showSynergyPanel, setShowSynergyPanel] = useState(false);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    weeksRemaining,
    currentWeek,
    currentDay,
    formatSeasonName,
    engagementData,
    dailyChallenges,
    weeklyProgress,
    unclaimedRewardsCount,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
    handleCorpsSwitch,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    recentScores,
    executionState,
    executionProcessing,
    rehearse,
    repairEquipment,
    upgradeEquipment,
    boostMorale,
    calculateMultiplier,
    canRehearseToday,
    getCorpsClassName,
    getCorpsClassColor,
    completeDailyChallenge,
    refreshProfile
  } = dashboardData;

  // Get staff assigned to active corps
  const assignedStaff = useMemo(() =>
    ownedStaff?.filter(s => s.assignedTo?.corpsClass === activeCorpsClass) || [],
    [ownedStaff, activeCorpsClass]
  );

  // Calculate execution metrics
  const readiness = useMemo(() => {
    if (typeof executionState?.readiness === 'object') {
      const { brass = 0.75, percussion = 0.75, guard = 0.75, ensemble = 0.75 } = executionState.readiness;
      return { brass, percussion, guard, ensemble, avg: (brass + percussion + guard + ensemble) / 4 };
    }
    const val = executionState?.readiness ?? 0.75;
    return { brass: val, percussion: val, guard: val, ensemble: val, avg: val };
  }, [executionState?.readiness]);

  const morale = useMemo(() => {
    if (typeof executionState?.morale === 'object') {
      const { brass = 0.80, percussion = 0.80, guard = 0.80, overall = 0.80 } = executionState.morale;
      return { brass, percussion, guard, overall, avg: (brass + percussion + guard) / 3 };
    }
    const val = executionState?.morale ?? 0.80;
    return { brass: val, percussion: val, guard: val, overall: val, avg: val };
  }, [executionState?.morale]);

  const equipment = useMemo(() => {
    const eq = executionState?.equipment || {};
    const instruments = eq.instruments ?? 0.90;
    const uniforms = eq.uniforms ?? 0.90;
    const props = eq.props ?? 0.90;
    const bus = eq.bus ?? 0.90;
    const truck = eq.truck ?? 0.90;
    const avg = (instruments + uniforms + props) / 3;
    return { instruments, uniforms, props, bus, truck, avg };
  }, [executionState?.equipment]);

  // Calculate aggregate staff efficiency
  const staffEfficiency = useMemo(() => {
    if (assignedStaff.length === 0) return { value: 0.80, bonus: -0.04, label: 'No Staff' };

    // Base efficiency + bonuses
    let efficiency = 0.80;
    assignedStaff.forEach(staff => {
      // Caption match bonus
      if (staff.assignedTo?.caption === staff.caption) efficiency += 0.02;
      // Experience bonus (cap at 10%)
      const expBonus = Math.min((staff.seasonsCompleted || 0) * 0.01, 0.10);
      efficiency += expBonus;
    });

    // Staff count bonus
    const countBonus = assignedStaff.length >= 6 ? 0.04 : assignedStaff.length >= 4 ? 0.02 : -0.04;
    efficiency = Math.min(1.0, efficiency);

    return {
      value: efficiency,
      bonus: countBonus,
      label: assignedStaff.length >= 6 ? 'Full Roster' : assignedStaff.length >= 4 ? 'Adequate' : 'Understaffed'
    };
  }, [assignedStaff]);

  // Calculate multiplier
  const multiplier = useMemo(() => {
    const base = (readiness.avg * 0.4) + (morale.avg * 0.3) + (equipment.avg * 0.3);
    const staffBonus = Math.min(assignedStaff.length * 0.01, 0.05);
    return Math.max(0.70, Math.min(1.10, base + staffBonus));
  }, [readiness.avg, morale.avg, equipment.avg, assignedStaff.length]);

  // Track assigned staff for retirement flow
  const [assignedStaffForRetire, setAssignedStaffForRetire] = useState([]);

  // Show morning report on first visit of the day
  useEffect(() => {
    if (profile && activeCorps) {
      const today = new Date().toDateString();
      const lastVisit = localStorage.getItem(`lastDashboardVisit_${user?.uid}`);
      if (lastVisit !== today) {
        setShowMorningReport(true);
        localStorage.setItem(`lastDashboardVisit_${user?.uid}`, today);
      }
    }
  }, [profile, activeCorps, user?.uid]);

  // Show class unlock congrats when newly unlocked
  useEffect(() => {
    if (newlyUnlockedClass) setShowClassUnlockCongrats(true);
  }, [newlyUnlockedClass]);

  // Show achievement modal when new achievement
  useEffect(() => {
    if (newAchievement) setShowAchievementModal(true);
  }, [newAchievement]);

  // Handler functions
  const handleSetupNewClass = () => {
    setShowClassUnlockCongrats(false);
    setShowRegistration(true);
  };

  const handleDeclineSetup = () => {
    setShowClassUnlockCongrats(false);
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime from the dashboard!');
  };

  const handleEditCorps = async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.name`]: formData.name,
        [`corps.${activeCorpsClass}.location`]: formData.location,
        [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
      });
      toast.success('Corps updated successfully!');
      setShowEditCorps(false);
    } catch (error) {
      console.error('Error updating corps:', error);
      toast.error('Failed to update corps. Please try again.');
    }
  };

  const handleDeleteCorps = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success(`${activeCorps.corpsName || activeCorps.name} has been deleted`);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting corps:', error);
      toast.error('Failed to delete corps. Please try again.');
    }
  };

  const handleOpenRetireModal = async () => {
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass, checkOnly: true });
      setAssignedStaffForRetire(result.data.assignedStaff || []);
      setShowRetireConfirm(true);
    } catch (error) {
      console.error('Error checking assigned staff:', error);
      setAssignedStaffForRetire([]);
      setShowRetireConfirm(true);
    }
  };

  const handleRetireCorps = async (staffActions = {}) => {
    setRetiring(true);
    try {
      const result = await retireCorps({
        corpsClass: activeCorpsClass,
        staffActions: Object.keys(staffActions).length > 0 ? staffActions : undefined
      });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowRetireConfirm(false);
        setAssignedStaffForRetire([]);
      } else if (result.data.needsStaffHandling) {
        setAssignedStaffForRetire(result.data.assignedStaff || []);
        toast.error('Please specify what to do with assigned staff.');
      }
    } catch (error) {
      console.error('Error retiring corps:', error);
      toast.error(error.message || 'Failed to retire corps. Please try again.');
    } finally {
      setRetiring(false);
    }
  };

  const handleMoveCorps = async (targetClass) => {
    try {
      if (corps[targetClass]) {
        toast.error(`You already have a corps registered in ${getCorpsClassName(targetClass)}`);
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const corpsData = { ...activeCorps, class: targetClass };
      await updateDoc(profileRef, {
        [`corps.${targetClass}`]: corpsData,
        [`corps.${activeCorpsClass}`]: null
      });
      toast.success(`${activeCorps.corpsName || activeCorps.name} moved to ${getCorpsClassName(targetClass)}`);
      setShowMoveCorps(false);
    } catch (error) {
      console.error('Error moving corps:', error);
      toast.error('Failed to move corps. Please try again.');
    }
  };

  const handleCorpsRegistration = async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded. Please try again.');
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const corpsData = {
        name: formData.name,
        location: formData.location,
        showConcept: formData.showConcept,
        class: formData.class,
        createdAt: new Date(),
        seasonId: seasonData.seasonUid,
        lineup: {},
        score: 0,
        rank: null
      };
      await updateDoc(profileRef, { [`corps.${formData.class}`]: corpsData });
      analyticsHelpers.logCorpsCreated(formData.class);
      toast.success(`${formData.name} registered successfully!`);
      setShowRegistration(false);
      clearNewlyUnlockedClass();
    } catch (error) {
      console.error('Error registering corps:', error);
      toast.error('Failed to register corps. Please try again.');
    }
  };

  const handleCloseRegistration = () => {
    setShowRegistration(false);
    clearNewlyUnlockedClass();
  };

  const handleCaptionSelection = async () => {
    setShowCaptionSelection(false);
  };

  const handleRehearsal = async () => {
    if (canRehearseToday()) {
      const result = await rehearse();
      if (result.success) {
        toast.success(`Rehearsal complete! +${result.data?.xpGained || 50} XP`);
      }
    }
  };

  // ============================================================================
  // RENDER: THREE-COLUMN HUD LAYOUT
  // ============================================================================
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-charcoal-950">
      {/* Season Setup Wizard */}
      {showSeasonSetupWizard && seasonData && (
        <SeasonSetupWizard
          onComplete={handleSeasonSetupComplete}
          profile={profile}
          seasonData={seasonData}
          corpsNeedingSetup={corpsNeedingSetup}
          existingCorps={corps || {}}
          retiredCorps={profile?.retiredCorps || []}
          unlockedClasses={profile?.unlockedClasses || ['soundSport']}
        />
      )}

      {/* ================================================================
          GLOBAL HEADER - Resource Monitor Bar
          Sticky, low-profile bar displaying real-time constraints
          ================================================================ */}
      <header className="shrink-0 h-12 bg-black/60 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-20">
        {/* Left: Corps Name & Class */}
        <div className="flex items-center gap-3">
          {activeCorps ? (
            <>
              {hasMultipleCorps ? (
                <div className="flex items-center gap-1">
                  {Object.entries(corps)
                    .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                    .map(([classId, corpsData]) => (
                      <button
                        key={classId}
                        onClick={() => handleCorpsSwitch(classId)}
                        className={`px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wide transition-all ${
                          activeCorpsClass === classId
                            ? `${classColors[classId]} shadow-sm`
                            : 'bg-white/5 text-cream/60 hover:text-cream border border-white/10'
                        }`}
                      >
                        {(corpsData.corpsName || corpsData.name || '').slice(0, 12)}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-widest ${classColors[activeCorpsClass]}`}>
                    {getCorpsClassName(activeCorpsClass)}
                  </span>
                  <span className="text-sm font-display font-bold text-cream truncate max-w-[120px]">
                    {activeCorps.corpsName || activeCorps.name}
                  </span>
                </div>
              )}
              {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 text-[9px] font-bold">
                  <Crown size={8} /> #{activeCorps.rank}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-display text-cream/50">No Corps Registered</span>
          )}
        </div>

        {/* Center: Season Progress */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-cream/40" />
            <span className="text-[10px] font-mono text-cream/60">
              {formatSeasonName(seasonData?.name)} • Week {currentWeek} • Day {currentDay}
            </span>
          </div>
          {weeksRemaining !== null && (
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-500 rounded-full transition-all"
                  style={{ width: `${((7 - weeksRemaining) / 7) * 100}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-cream/40">{weeksRemaining}w left</span>
            </div>
          )}
        </div>

        {/* Right: Resource Pills */}
        <div className="flex items-center gap-2">
          {engagementData?.loginStreak > 0 && (
            <ResourcePill icon={Flame} value={engagementData.loginStreak} label="streak" color="orange" />
          )}
          <ResourcePill icon={Zap} value={`L${profile?.xpLevel || 1}`} color="gold" />
          <ResourcePill icon={Coins} value={(profile?.corpsCoin || 0).toLocaleString()} color="gold" />
          {unclaimedRewardsCount > 0 && (
            <Link to="/battlepass">
              <ResourcePill icon={Gift} value={unclaimedRewardsCount} color="purple" pulse />
            </Link>
          )}
        </div>
      </header>

      {/* ================================================================
          HUD BODY - Three-Column Layout
          Left: Intelligence | Center: Command | Right: Logistics
          ================================================================ */}
      <motion.main
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ================================================================
            COLUMN A: INTELLIGENCE (The "Read" Zone)
            Section Readiness, Multipliers, Performance Insights
            ================================================================ */}
        <motion.aside
          variants={columnVariants}
          className="hidden lg:flex lg:col-span-3 flex-col gap-2 overflow-hidden"
        >
          {/* Section Readiness */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Section Readiness</span>
              <Target className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="space-y-2">
              <SectionProgressBar value={readiness.brass} label="Brass" color="blue" />
              <SectionProgressBar value={readiness.percussion} label="Perc" color="blue" />
              <SectionProgressBar value={readiness.guard} label="Guard" color="blue" />
              <SectionProgressBar value={readiness.ensemble} label="Ensemble" color="blue" />
            </div>
          </div>

          {/* Section Morale */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Section Morale</span>
              <Heart className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="space-y-2">
              <SectionProgressBar value={morale.brass} label="Brass" color="green" />
              <SectionProgressBar value={morale.percussion} label="Perc" color="green" />
              <SectionProgressBar value={morale.guard} label="Guard" color="green" />
            </div>
          </div>

          {/* Active Multipliers */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Active Modifiers</span>
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="flex flex-wrap gap-1">
              {readiness.avg >= 0.85 && <MultiplierBadge label="Ready" value="+5%" positive />}
              {readiness.avg < 0.70 && <MultiplierBadge label="Unprepared" value="-8%" positive={false} />}
              {morale.avg >= 0.85 && <MultiplierBadge label="High Morale" value="+3%" positive />}
              {morale.avg < 0.70 && <MultiplierBadge label="Low Morale" value="-5%" positive={false} />}
              {assignedStaff.length >= 6 && <MultiplierBadge label="Full Staff" value="+4%" positive />}
              {assignedStaff.length < 4 && <MultiplierBadge label="Understaffed" value="-4%" positive={false} />}
              {equipment.avg < 0.80 && <MultiplierBadge label="Worn Equipment" value="-3%" positive={false} />}
              {executionState?.synergyBonus > 0 && (
                <MultiplierBadge label="Synergy" value={`+${(executionState.synergyBonus).toFixed(1)}`} positive />
              )}
            </div>
          </div>

          {/* Show Difficulty */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Show Difficulty</span>
            </div>
            <ConfidenceBadge
              currentDifficulty={executionState?.showDesign || 'moderate'}
              currentReadiness={readiness.avg}
              onClick={() => setShowExecutionInsights(true)}
            />
          </div>

          {/* Full Analysis Link */}
          <button
            onClick={() => setShowExecutionInsights(true)}
            className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex items-center justify-between hover:border-gold-500/30 transition-colors"
          >
            <span className="text-[10px] font-display font-bold text-gold-400 uppercase tracking-wide">Full Analysis</span>
            <BarChart3 className="w-4 h-4 text-gold-400" />
          </button>
        </motion.aside>

        {/* ================================================================
            COLUMN B: COMMAND (The "Act" Zone)
            Action Deck, Daily Tasks, Show Concept/Synergy
            ================================================================ */}
        <motion.section
          variants={columnVariants}
          className="col-span-1 lg:col-span-6 flex flex-col gap-2 overflow-y-auto lg:overflow-hidden"
        >
          {activeCorps ? (
            <>
              {/* Corps Hero Card */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex-shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl lg:text-2xl font-display font-black text-cream uppercase tracking-tight truncate">
                        {activeCorps.corpsName || activeCorps.name || 'UNNAMED'}
                      </h1>
                      <button
                        onClick={() => setShowEditCorps(true)}
                        className="p-1 rounded hover:bg-white/10 text-cream/40 hover:text-gold-400 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Show Concept */}
                    <div className="flex items-center gap-2 mt-1">
                      {typeof activeCorps.showConcept === 'object' && activeCorps.showConcept.theme ? (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors group"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] text-cream/60 group-hover:text-purple-400 capitalize">
                            {activeCorps.showConcept.theme}
                          </span>
                          {(executionState?.synergyBonus || 0) > 0 && (
                            <span className="text-[10px] font-bold text-purple-400">
                              +{(executionState?.synergyBonus || 0).toFixed(1)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px]"
                        >
                          <Sparkles className="w-3 h-3" /> Configure Show
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multiplier Display */}
                  <div className="shrink-0 ml-4">
                    <MultiplierGlassBoxLarge
                      multiplier={multiplier}
                      breakdown={{
                        readiness: (readiness.avg - 0.80) * 0.60,
                        staff: staffEfficiency.bonus,
                        equipment: (equipment.avg - 1.00) * 0.50,
                        travelCondition: (equipment.bus + equipment.truck) < 1.40 ? -0.03 : 0,
                        morale: (morale.avg - 0.75) * 0.32,
                        showDifficulty: readiness.avg >= (executionState?.showDesign?.preparednessThreshold || 0.80)
                          ? (executionState?.showDesign?.ceilingBonus || 0.08)
                          : (executionState?.showDesign?.riskPenalty || -0.10),
                      }}
                      currentDay={currentDay}
                      showDifficulty={executionState?.showDesign}
                      avgReadiness={readiness.avg}
                    />
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-lg font-data font-bold text-blue-400">{executionState?.rehearsalsThisWeek || 0}/7</div>
                    <div className="text-[8px] text-cream/40 uppercase">Rehearsals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-data font-bold text-purple-400">
                      {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0}
                    </div>
                    <div className="text-[8px] text-cream/40 uppercase">Shows</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <div className="text-center">
                      <div className="text-lg font-data font-bold text-gold-400">
                        {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-[8px] text-cream/40 uppercase">Score</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-lg font-data font-bold text-green-400">{assignedStaff.length}/8</div>
                    <div className="text-[8px] text-cream/40 uppercase">Staff</div>
                  </div>
                </div>
              </div>

              {/* Action Deck - Primary Actions */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Rehearsal */}
                  <ActionButton
                    icon={Music}
                    label="Rehearse"
                    subtitle={canRehearseToday() ? '+5% readiness' : 'Complete'}
                    onClick={handleRehearsal}
                    disabled={!canRehearseToday()}
                    processing={executionProcessing}
                    completed={!canRehearseToday()}
                    color="blue"
                  />
                  {/* Staff */}
                  <ActionButton
                    icon={Users}
                    label="Staff"
                    subtitle={`${assignedStaff.length}/8 assigned`}
                    onClick={() => { setShowStaffPanel(true); completeDailyChallenge('staff_meeting'); }}
                    color="green"
                  />
                  {/* Equipment */}
                  <ActionButton
                    icon={Wrench}
                    label="Equipment"
                    subtitle={`${Math.round(equipment.avg * 100)}% condition`}
                    onClick={() => { setShowEquipmentPanel(true); completeDailyChallenge('maintain_equipment'); }}
                    color={equipment.avg < 0.85 ? 'orange' : 'gold'}
                  />
                  {/* Synergy */}
                  <ActionButton
                    icon={Sparkles}
                    label="Synergy"
                    subtitle={activeCorps?.showConcept?.theme || 'Configure'}
                    onClick={() => setShowSynergyPanel(true)}
                    color="purple"
                  />
                </div>
              </div>

              {/* Daily Tasks Checklist */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Daily Tasks</span>
                  <button
                    onClick={() => setShowDailyActivities(true)}
                    className="text-[9px] font-display text-gold-400 uppercase tracking-wide hover:text-gold-300"
                  >
                    View All →
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {dailyChallenges?.slice(0, 4).map((challenge) => (
                    <TaskCheckbox
                      key={challenge.id}
                      title={challenge.title}
                      reward={challenge.reward || `+${challenge.xpReward || 25} XP`}
                      completed={challenge.completed}
                      onClick={challenge.action}
                    />
                  ))}
                  {(!dailyChallenges || dailyChallenges.length === 0) && (
                    <div className="text-center py-4 text-cream/40 text-sm">No tasks available</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* No Corps State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg">
                <BrandLogo className="w-16 h-16 mx-auto mb-4" color="text-cream/20" />
                <h2 className="text-xl font-display font-bold text-cream mb-2">No Corps Registered</h2>
                <p className="text-sm text-cream/50 mb-4">Create your first corps to begin your journey!</p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg font-display font-bold uppercase tracking-wide hover:bg-gold-400 transition-colors"
                >
                  Register Corps
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* ================================================================
            COLUMN C: LOGISTICS (The "Manage" Zone)
            Staff Efficiency, Equipment Status, Management
            ================================================================ */}
        <motion.aside
          variants={columnVariants}
          className="hidden lg:flex lg:col-span-3 flex-col gap-2 overflow-hidden"
        >
          {/* Aggregate Staff Efficiency */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Staff Efficiency</span>
              <Users className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-data font-bold text-green-400">{Math.round(staffEfficiency.value * 100)}%</span>
              <span className={`text-[10px] font-display font-bold uppercase ${
                staffEfficiency.bonus >= 0 ? 'text-green-400' : 'text-orange-400'
              }`}>
                {staffEfficiency.label}
              </span>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-sm transition-colors ${
                    i < assignedStaff.length ? 'bg-green-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setShowStaffPanel(true)}
              className="w-full text-[10px] font-display font-bold text-gold-400 uppercase tracking-wide py-2 border border-gold-500/30 rounded hover:bg-gold-500/10 transition-colors"
            >
              Manage Staff →
            </button>
          </div>

          {/* Equipment Status */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Equipment</span>
              <Wrench className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="space-y-2">
              <SectionProgressBar value={equipment.instruments} label="Instruments" color={equipment.instruments < 0.85 ? 'orange' : 'gold'} />
              <SectionProgressBar value={equipment.uniforms} label="Uniforms" color={equipment.uniforms < 0.85 ? 'orange' : 'gold'} />
              <SectionProgressBar value={equipment.props} label="Props" color={equipment.props < 0.85 ? 'orange' : 'gold'} />
            </div>
            <button
              onClick={() => setShowEquipmentPanel(true)}
              className="w-full mt-3 text-[10px] font-display font-bold text-gold-400 uppercase tracking-wide py-2 border border-gold-500/30 rounded hover:bg-gold-500/10 transition-colors"
            >
              Manage Equipment →
            </button>
          </div>

          {/* Travel Fleet */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Travel Fleet</span>
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className={`text-xl font-data font-bold ${equipment.bus >= 0.70 ? 'text-blue-400' : 'text-red-400'}`}>
                  {Math.round(equipment.bus * 100)}%
                </div>
                <div className="text-[8px] text-cream/40 uppercase">Bus</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-data font-bold ${equipment.truck >= 0.70 ? 'text-blue-400' : 'text-red-400'}`}>
                  {Math.round(equipment.truck * 100)}%
                </div>
                <div className="text-[8px] text-cream/40 uppercase">Truck</div>
              </div>
            </div>
            {(equipment.bus + equipment.truck) < 1.40 && (
              <div className="mt-2 text-[9px] text-orange-400 text-center">
                ⚠ Travel condition affecting performance
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">Quick Links</span>
            </div>
            <div className="space-y-1">
              <Link
                to="/schedule"
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors"
              >
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-cream">Schedule</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>
              <Link
                to="/scores"
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors"
              >
                <Trophy className="w-4 h-4 text-gold-400" />
                <span className="text-sm text-cream">Scores</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>
              <Link
                to="/staff"
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors"
              >
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-sm text-cream">Market</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>
            </div>
          </div>
        </motion.aside>
      </motion.main>

      {/* ================================================================
          LIVE DATA FOOTER - League Ticker
          Real scores from database, no placeholder data
          ================================================================ */}
      <LeagueTicker seasonData={seasonData} currentDay={currentDay} />

      {/* ================================================================
          SLIDE-OUT PANELS
          ================================================================ */}

      {/* Equipment Panel */}
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
                <h2 className="text-xl font-display font-black text-cream uppercase tracking-tight">Equipment Manager</h2>
                <button onClick={() => setShowEquipmentPanel(false)} className="p-2 rounded hover:bg-red-500/20 text-cream/60 hover:text-red-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <EquipmentManager
                  equipment={executionState?.equipment}
                  onRepair={repairEquipment}
                  onUpgrade={upgradeEquipment}
                  processing={executionProcessing}
                  corpsCoin={profile?.corpsCoin || 0}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <button onClick={() => setShowStaffPanel(false)} className="p-2 rounded hover:bg-red-500/20 text-cream/60 hover:text-red-400 transition-colors">
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

      {/* Daily Activities Panel */}
      <AnimatePresence>
        {showDailyActivities && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDailyActivities(false)}
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
                <h2 className="text-xl font-display font-black text-cream uppercase tracking-tight">Daily Activities</h2>
                <button onClick={() => setShowDailyActivities(false)} className="p-2 rounded hover:bg-red-500/20 text-cream/60 hover:text-red-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <DailyOperations
                  corpsClass={activeCorpsClass}
                  profile={profile}
                  executionState={executionState}
                  canRehearseToday={canRehearseToday()}
                  onRehearsal={rehearse}
                  rehearsalProcessing={executionProcessing}
                  calculateMultiplier={calculateMultiplier}
                  onActivityComplete={(type, data) => {
                    completeDailyChallenge(type === 'staff' ? 'staff_meeting' : type === 'equipment' ? 'maintain_equipment' : type);
                    refreshProfile();
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Synergy Panel */}
      <AnimatePresence>
        {showSynergyPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSynergyPanel(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-950/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="panel-header">
                <h2 className="panel-title">Show Concept Synergy</h2>
                <button onClick={() => setShowSynergyPanel(false)} className="panel-close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <ShowConceptSelector
                  corpsClass={activeCorpsClass}
                  currentConcept={typeof activeCorps?.showConcept === 'object' ? activeCorps.showConcept : {}}
                  lineup={activeCorps?.lineup || {}}
                  onSave={() => {
                    refreshProfile();
                    setShowSynergyPanel(false);
                  }}
                  compact={false}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Execution Insights Panel */}
      <AnimatePresence>
        {showExecutionInsights && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExecutionInsights(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-charcoal-950/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-hidden"
            >
              <ExecutionInsightsPanel
                executionState={executionState}
                multiplierBreakdown={{
                  readiness: (readiness.avg - 0.75) * 0.48,
                  morale: (morale.avg - 0.80) * 0.32,
                  equipment: (equipment.avg - 0.90) * 0.20,
                  staff: staffEfficiency.bonus,
                  showDifficulty: executionState?.showDesign?.ceilingBonus || 0,
                  travelCondition: (equipment.bus + equipment.truck) < 1.40 ? -0.03 : 0,
                }}
                finalMultiplier={multiplier}
                currentDay={currentDay}
                showDifficulty={executionState?.showDesign || 'moderate'}
                showConcept={activeCorps?.showConcept}
                lineup={activeCorps?.lineup}
                assignedStaff={assignedStaff}
                activeCorpsClass={activeCorpsClass}
                onBoostStaffMorale={async (staffId) => {
                  try {
                    const { boostStaffMorale } = await import('../api/functions');
                    await boostStaffMorale({ staffId });
                    refreshProfile();
                  } catch (error) {
                    console.error('Failed to boost staff morale:', error);
                  }
                }}
                onClose={() => setShowExecutionInsights(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================
          MODALS
          ================================================================ */}
      <AnimatePresence>
        {showClassUnlockCongrats && newlyUnlockedClass && (
          <ClassUnlockCongratsModal
            unlockedClass={newlyUnlockedClass}
            onSetup={handleSetupNewClass}
            onDecline={handleDeclineSetup}
            xpLevel={profile?.xpLevel || 1}
          />
        )}

        {showRegistration && (
          <CorpsRegistrationModal
            onClose={handleCloseRegistration}
            onSubmit={handleCorpsRegistration}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
            defaultClass={newlyUnlockedClass}
          />
        )}

        {showCaptionSelection && activeCorps && seasonData && (
          <CaptionSelectionModal
            onClose={() => setShowCaptionSelection(false)}
            onSubmit={handleCaptionSelection}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={seasonData.seasonUid}
          />
        )}

        {showEditCorps && activeCorps && (
          <EditCorpsModal
            onClose={() => setShowEditCorps(false)}
            onSubmit={handleEditCorps}
            currentData={{
              name: activeCorps.corpsName || activeCorps.name,
              location: activeCorps.location,
              showConcept: activeCorps.showConcept
            }}
          />
        )}

        {showDeleteConfirm && activeCorps && (
          <DeleteConfirmModal
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteCorps}
            corpsName={activeCorps.corpsName || activeCorps.name}
            corpsClass={activeCorpsClass}
          />
        )}

        {showRetireConfirm && activeCorps && (
          <RetireConfirmModal
            onClose={() => {
              setShowRetireConfirm(false);
              setAssignedStaffForRetire([]);
            }}
            onConfirm={handleRetireCorps}
            corpsName={activeCorps.corpsName || activeCorps.name}
            corpsClass={activeCorpsClass}
            retiring={retiring}
            assignedStaff={assignedStaffForRetire}
            otherCorps={corps || {}}
            inLeague={false}
          />
        )}

        {showMoveCorps && activeCorps && (
          <MoveCorpsModal
            onClose={() => setShowMoveCorps(false)}
            onMove={handleMoveCorps}
            currentClass={activeCorpsClass}
            corpsName={activeCorps.corpsName || activeCorps.name}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
            existingCorps={corps}
          />
        )}

        {showAchievementModal && (
          <AchievementModal
            onClose={() => {
              setShowAchievementModal(false);
              clearNewAchievement();
            }}
            achievements={profile?.achievements || []}
            newAchievement={newAchievement}
          />
        )}
      </AnimatePresence>

      {/* Morning Report Modal */}
      <MorningReport
        isOpen={showMorningReport}
        onClose={() => setShowMorningReport(false)}
        profile={profile}
        activeCorps={activeCorps}
        activeCorpsClass={activeCorpsClass}
        executionState={executionState}
        engagementData={engagementData}
        dailyChallenges={dailyChallenges}
        recentScores={recentScores}
        canRehearseToday={canRehearseToday}
        onStartRehearsal={() => {
          setShowMorningReport(false);
          rehearse();
        }}
        onNavigateToEquipment={() => {
          setShowMorningReport(false);
          setShowEquipmentPanel(true);
        }}
        onNavigateToStaff={() => {
          setShowMorningReport(false);
          setShowStaffPanel(true);
        }}
      />
    </div>
  );
};

export default Dashboard;
