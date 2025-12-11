// src/pages/Dashboard.jsx
// ARCHITECTURE: High-Density HUD (Heads-Up Display) - One-Page Command Center
// Three-Column Layout: Intelligence | Command | Logistics
// No scrolling on desktop - everything fits in viewport
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit, BarChart3, Settings, Clock, RefreshCw,
  CheckCircle, Circle, ArrowUp, AlertTriangle, ChevronRight,
  Shield, Eye, Drum, Flag, Activity, Radio, Gauge, Coffee
} from 'lucide-react';
import { useAuth } from '../App';
import BrandLogo from '../components/BrandLogo';
import { db, analyticsHelpers } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  DashboardStaffPanel,
  SectionGauges,
  MultiplierGlassBoxLarge,
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
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import {
  retireCorps,
  claimDailyLogin,
  staffCheckin,
  memberWellnessCheck,
  equipmentInspection,
  showReview,
  sectionalRehearsal,
  getDailyOpsStatus,
} from '../firebase/functions';
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
// REUSABLE HUD COMPONENTS - Optimized for information density
// Uses clamp() for responsive scaling based on viewport
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
      className={`flex items-center gap-1.5 px-2 py-1 rounded border backdrop-blur-sm transition-all ${colorMap[color]} ${onClick ? 'hover:bg-white/10 cursor-pointer' : ''} ${pulse ? 'animate-pulse' : ''}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-data font-bold tabular-nums">{value}</span>
      {label && <span className="text-xs text-cream/50 uppercase tracking-wide hidden xl:inline">{label}</span>}
    </Wrapper>
  );
};

// Section Progress Bar - Compact progress with label and optional caption
const SectionProgressBar = ({ value, label, color = 'blue', showPercent = true, caption = null }) => {
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
      <div className="w-24 shrink-0">
        <span className="text-xs font-display font-bold text-cream/70 uppercase tracking-wide">
          {label}
        </span>
        {caption && (
          <span className="text-[9px] text-cream/40 ml-1">({caption})</span>
        )}
      </div>
      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full ${bgMap[color]} rounded-full`}
        />
      </div>
      {showPercent && (
        <span className={`text-sm font-data font-bold w-12 text-right tabular-nums ${textMap[color]}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

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

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || processing}
      whileHover={!disabled && !processing ? { scale: 1.01 } : {}}
      whileTap={!disabled && !processing ? { scale: 0.99 } : {}}
      className={`
        p-2.5 flex items-center gap-2.5 w-full
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
      <div className="flex-1 text-left min-w-0">
        <div className="text-sm font-display font-bold text-cream uppercase tracking-wide truncate">{label}</div>
        {subtitle && <div className="text-xs text-cream/50 truncate">{subtitle}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-cream/30 shrink-0" />
    </motion.button>
  );
};

// Task Checkbox - Daily task checklist item
const TaskCheckbox = ({ title, reward, completed, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={completed || loading}
    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded transition-all ${
      completed ? 'opacity-50 cursor-default' : 'hover:bg-white/5 cursor-pointer'
    }`}
  >
    <div className={`w-5 h-5 flex items-center justify-center rounded border transition-all shrink-0 ${
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
    <span className={`flex-1 text-left text-sm font-mono truncate ${completed ? 'text-cream/50 line-through' : 'text-cream'}`}>
      {title}
    </span>
    <span className={`text-xs font-data font-bold shrink-0 ${completed ? 'text-gold-400/50' : 'text-gold-400'}`}>
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
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-display font-bold text-cream/50 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${colorMap[color]}`} />}
      </div>
      <div className={`text-2xl font-data font-bold ${colorMap[color]} tabular-nums`}>{value}</div>
      {action && (
        <button
          onClick={action}
          className="mt-1.5 text-xs font-display font-bold text-gold-400 uppercase tracking-wide hover:text-gold-300 transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
};

// ============================================================================
// LEAGUE TICKER COMPONENT - Historical DCI Data Footer
// ============================================================================
const LeagueTicker = ({ seasonData, currentDay }) => {
  const [tickerData, setTickerData] = useState({ scores: [], loading: true, error: null, eventName: null });

  // Get historical DCI scores from the previous day
  const previousDay = currentDay - 1;
  useEffect(() => {
    const fetchHistoricalScores = async () => {
      if (!seasonData?.dataDocId || previousDay < 1) {
        setTickerData({ scores: [], loading: false, error: null, eventName: null });
        return;
      }

      try {
        // 1. Get corps data to find source years
        const corpsDataDoc = await getDoc(doc(db, `dci-data/${seasonData.dataDocId}`));
        if (!corpsDataDoc.exists()) {
          setTickerData({ scores: [], loading: false, error: 'No corps data found', eventName: null });
          return;
        }

        const corpsData = corpsDataDoc.data();
        const corpsValues = corpsData.corpsValues || [];
        const yearsToFetch = [...new Set(corpsValues.map(c => c.sourceYear))];

        // 2. Fetch historical scores for each year
        const historicalPromises = yearsToFetch.map(year =>
          getDoc(doc(db, `historical_scores/${year}`))
        );
        const historicalDocs = await Promise.all(historicalPromises);

        // 3. Find scores for the previous day
        let previousDayScores = [];
        let eventName = null;

        historicalDocs.forEach((docSnap) => {
          if (docSnap.exists()) {
            const yearData = docSnap.data().data || [];
            yearData.forEach(event => {
              if (event.offSeasonDay === previousDay && event.scores) {
                eventName = event.eventName;
                event.scores.forEach(score => {
                  previousDayScores.push({
                    corpsName: score.corps,
                    totalScore: score.score || 0,
                    eventName: event.eventName,
                    day: event.offSeasonDay,
                  });
                });
              }
            });
          }
        });

        // 4. Sort by score and take top results
        const sortedScores = previousDayScores
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 15);

        setTickerData({ scores: sortedScores, loading: false, error: null, eventName });
      } catch (err) {
        console.error('Error fetching historical scores:', err);
        setTickerData({ scores: [], loading: false, error: err.message, eventName: null });
      }
    };

    fetchHistoricalScores();
  }, [seasonData?.dataDocId, previousDay]);

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
        <div className="w-2 h-2 bg-gold-400 rounded-full" />
        <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wider">
          {tickerData.eventName ? tickerData.eventName : 'DCI Scores'}
        </span>
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
        <span className="text-[9px] font-mono text-cream/50">Day {previousDay}</span>
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
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [showSynergyPanel, setShowSynergyPanel] = useState(false);

  // Daily operations state
  const [opsStatus, setOpsStatus] = useState(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsProcessing, setOpsProcessing] = useState(null);

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

  // ============================================================================
  // DAILY OPERATIONS HANDLERS
  // ============================================================================

  // Fetch daily ops status
  const fetchOpsStatus = useCallback(async () => {
    if (!activeCorpsClass) return;
    setOpsLoading(true);
    try {
      const result = await getDailyOpsStatus({ corpsClass: activeCorpsClass });
      if (result.data.success) {
        setOpsStatus(result.data.status);
      }
    } catch (error) {
      console.error('Error fetching daily ops status:', error);
    } finally {
      setOpsLoading(false);
    }
  }, [activeCorpsClass]);

  // Fetch ops status on corps change
  useEffect(() => {
    if (activeCorpsClass) {
      fetchOpsStatus();
    }
  }, [activeCorpsClass, fetchOpsStatus]);

  // Daily task handlers
  const handleDailyTask = async (taskId, taskFn) => {
    setOpsProcessing(taskId);
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
      setOpsProcessing(null);
    }
  };

  const handleSectionalRehearsal = async (section) => {
    setOpsProcessing(`sectional_${section}`);
    try {
      const result = await sectionalRehearsal({ corpsClass: activeCorpsClass, section });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchOpsStatus();
      }
    } catch (error) {
      toast.error(error.message || `Sectional failed`);
    } finally {
      setOpsProcessing(null);
    }
  };

  // Get task availability from ops status
  const getTaskAvailability = (taskId) => {
    if (!opsStatus) return false;
    const opMap = {
      login: 'loginBonus',
      staff: 'staffCheckin',
      wellness: 'memberWellness',
      equipment: 'equipmentInspection',
      review: 'showReview'
    };
    return opsStatus[opMap[taskId]]?.available;
  };

  const getSectionalAvailability = (section) => {
    return opsStatus?.sectionalRehearsals?.[section]?.available;
  };

  // Count completed tasks
  const getCompletedTasksCount = () => {
    if (!opsStatus) return { completed: 0, total: 9 };
    let completed = 0;
    if (!opsStatus.loginBonus?.available) completed++;
    if (!opsStatus.staffCheckin?.available) completed++;
    if (!opsStatus.memberWellness?.available) completed++;
    if (!opsStatus.equipmentInspection?.available) completed++;
    if (!opsStatus.showReview?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.music?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.visual?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.guard?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.percussion?.available) completed++;
    return { completed, total: 9 };
  };

  const taskStats = getCompletedTasksCount();

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
      <header className="shrink-0 h-14 bg-black/60 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-20">
        {/* Left: Corps Name & Class */}
        <div className="flex items-center gap-3">
          {activeCorps ? (
            <>
              {hasMultipleCorps ? (
                <div className="flex items-center gap-1.5">
                  {Object.entries(corps)
                    .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                    .map(([classId, corpsData]) => (
                      <button
                        key={classId}
                        onClick={() => handleCorpsSwitch(classId)}
                        className={`px-3 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wide transition-all ${
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
                  <span className={`px-2.5 py-1 rounded text-xs font-display font-bold uppercase tracking-widest ${classColors[activeCorpsClass]}`}>
                    {getCorpsClassName(activeCorpsClass)}
                  </span>
                  <span className="text-base font-display font-bold text-cream truncate max-w-[160px]">
                    {activeCorps.corpsName || activeCorps.name}
                  </span>
                </div>
              )}
              {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/20 text-gold-400 text-xs font-bold">
                  <Crown size={10} /> #{activeCorps.rank}
                </span>
              )}
            </>
          ) : (
            <span className="text-base font-display text-cream/50">No Corps Registered</span>
          )}
        </div>

        {/* Center: Season Progress */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cream/40" />
            <span className="text-xs font-mono text-cream/60">
              {formatSeasonName(seasonData?.name)} • Week {currentWeek} • Day {currentDay}
            </span>
          </div>
          {weeksRemaining !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-500 rounded-full transition-all"
                  style={{ width: `${((7 - weeksRemaining) / 7) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-cream/40">{weeksRemaining}w left</span>
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
          className="hidden lg:flex lg:col-span-3 flex-col gap-2.5 overflow-hidden"
        >
          {/* Section Readiness - with caption associations */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Section Readiness</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-data font-bold text-blue-400">{Math.round(readiness.avg * 100)}%</span>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="text-[9px] text-cream/40 mb-2">Affects scoring captions shown in parentheses</div>
            <div className="space-y-2">
              <SectionProgressBar value={readiness.brass} label="Brass" caption="B, MA" color="blue" />
              <SectionProgressBar value={readiness.percussion} label="Perc" caption="P" color="blue" />
              <SectionProgressBar value={readiness.guard} label="Guard" caption="VP, VA, CG" color="blue" />
              <SectionProgressBar value={readiness.ensemble} label="Ensemble" caption="GE1, GE2" color="blue" />
            </div>
          </div>

          {/* Section Morale - with caption associations */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Section Morale</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-data font-bold text-green-400">{Math.round(morale.avg * 100)}%</span>
                <Heart className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div className="text-[9px] text-cream/40 mb-2">±8% impact on caption scores</div>
            <div className="space-y-2">
              <SectionProgressBar value={morale.brass} label="Brass" caption="B, MA" color="green" />
              <SectionProgressBar value={morale.percussion} label="Perc" caption="P" color="green" />
              <SectionProgressBar value={morale.guard} label="Guard" caption="VP, VA, CG" color="green" />
            </div>
          </div>

          {/* Multiplier Breakdown - Receipt Style */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Multiplier Breakdown</span>
              <TrendingUp className="w-4 h-4 text-gold-400" />
            </div>
            <div className="space-y-0 border-t border-white/10">
              {/* Readiness Factor */}
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-cream/60">Readiness</span>
                </div>
                <span className={`text-xs font-mono font-bold ${(readiness.avg - 0.80) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(readiness.avg - 0.80) >= 0 ? '+' : ''}{((readiness.avg - 0.80) * 60).toFixed(1)}%
                </span>
              </div>
              {/* Morale Factor */}
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-cream/60">Morale</span>
                </div>
                <span className={`text-xs font-mono font-bold ${(morale.avg - 0.75) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(morale.avg - 0.75) >= 0 ? '+' : ''}{((morale.avg - 0.75) * 32).toFixed(1)}%
                </span>
              </div>
              {/* Staff Factor */}
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-cream/60">Staff</span>
                </div>
                <span className={`text-xs font-mono font-bold ${staffEfficiency.bonus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {staffEfficiency.bonus >= 0 ? '+' : ''}{(staffEfficiency.bonus * 100).toFixed(1)}%
                </span>
              </div>
              {/* Equipment Factor */}
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-orange-400" />
                  <span className="text-xs text-cream/60">Equipment</span>
                </div>
                <span className={`text-xs font-mono font-bold ${(equipment.avg - 1.0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(equipment.avg - 1.0) >= 0 ? '+' : ''}{((equipment.avg - 1.0) * 50).toFixed(1)}%
                </span>
              </div>
              {/* Difficulty Bonus/Penalty */}
              {(() => {
                const difficultyConfig = executionState?.showDesign || { preparednessThreshold: 0.80, ceilingBonus: 0.08, riskPenalty: -0.10 };
                const threshold = difficultyConfig.preparednessThreshold || 0.80;
                const isPrepared = readiness.avg >= threshold;
                const diffValue = isPrepared ? (difficultyConfig.ceilingBonus || 0.08) : (difficultyConfig.riskPenalty || -0.10);
                return (
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-cream/60">Difficulty</span>
                    </div>
                    <span className={`text-xs font-mono font-bold ${isPrepared ? 'text-green-400' : 'text-red-400'}`}>
                      {isPrepared ? '+' : ''}{(diffValue * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })()}
              {/* Travel Condition */}
              {(equipment.bus + equipment.truck) < 1.40 && (
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-red-400" />
                    <span className="text-xs text-cream/60">Travel</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-400">-3.0%</span>
                </div>
              )}
              {/* Synergy if present */}
              {executionState?.synergyBonus > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-cream/60">Synergy</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-green-400">
                    +{executionState.synergyBonus.toFixed(1)}%
                  </span>
                </div>
              )}
              {/* Late Season Fatigue (Days 35-49) */}
              {currentDay > 35 && (
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Coffee className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-cream/60">Fatigue</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-orange-400">
                    -{(Math.min((currentDay - 35) / 14, 1) * 5).toFixed(1)}%
                  </span>
                </div>
              )}
              {/* Total */}
              <div className="flex items-center justify-between py-2 mt-1 bg-gold-500/10 rounded px-2 -mx-1">
                <span className="text-xs font-display font-bold text-gold-400 uppercase">Total</span>
                <span className="text-lg font-mono font-bold text-gold-400" style={{ textShadow: '0 0 8px rgba(255, 215, 0, 0.4)' }}>
                  {multiplier.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          {/* Show Difficulty Threshold */}
          {(() => {
            const difficultyConfig = executionState?.showDesign || { preparednessThreshold: 0.80, ceilingBonus: 0.08, riskPenalty: -0.10, label: 'Moderate' };
            const threshold = difficultyConfig.preparednessThreshold || 0.80;
            const isPrepared = readiness.avg >= threshold;
            const gap = Math.abs(readiness.avg - threshold);
            const diffLabel = difficultyConfig.label || (threshold <= 0.70 ? 'Conservative' : threshold <= 0.80 ? 'Moderate' : threshold <= 0.85 ? 'Ambitious' : 'Legendary');
            return (
              <div className={`bg-black/40 backdrop-blur-md border rounded-lg p-3.5 flex-shrink-0 ${
                isPrepared ? 'border-green-500/30' : 'border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Show Difficulty</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    isPrepared ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {isPrepared ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
                {/* Mini threshold gauge */}
                <div className="relative h-3 bg-charcoal-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      isPrepared ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-orange-500'
                    }`}
                    style={{ width: `${Math.round(readiness.avg * 100)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                    style={{ left: `${Math.round(threshold * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-cream/40 uppercase">{diffLabel} • {Math.round(threshold * 100)}% threshold</div>
                    <div className="text-xs text-cream/60">
                      {isPrepared
                        ? `${Math.round(gap * 100)}% above threshold`
                        : `Need ${Math.round(gap * 100)}% more readiness`
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-mono font-bold ${isPrepared ? 'text-green-400' : 'text-red-400'}`}>
                      {isPrepared ? '+' : ''}{Math.round((isPrepared ? (difficultyConfig.ceilingBonus || 0.08) : (difficultyConfig.riskPenalty || -0.10)) * 100)}%
                    </div>
                    <div className="text-[9px] text-cream/40 uppercase">{isPrepared ? 'Bonus' : 'Penalty'}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Temporal Effects - Season Phase Indicators */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Season Effects</span>
              <span className="text-xs font-mono text-cream/40">Day {currentDay}/49</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Fatigue Status */}
              <div className="text-center p-2 rounded bg-black/20">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${currentDay > 35 ? 'bg-orange-500 animate-pulse' : 'bg-gray-600'}`} />
                <div className="text-[9px] text-cream/50 uppercase">Fatigue</div>
                <div className={`text-[10px] font-mono font-bold ${currentDay > 35 ? 'text-orange-400' : 'text-cream/30'}`}>
                  {currentDay > 35 ? 'Active' : 'Day 35+'}
                </div>
              </div>
              {/* Championship Pressure */}
              <div className="text-center p-2 rounded bg-black/20">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${currentDay >= 47 ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                <div className="text-[9px] text-cream/50 uppercase">Finals</div>
                <div className={`text-[10px] font-mono font-bold ${currentDay >= 47 ? 'text-red-400' : 'text-cream/30'}`}>
                  {currentDay >= 47 ? 'Active' : 'Day 47+'}
                </div>
              </div>
              {/* Difficulty Lock */}
              <div className="text-center p-2 rounded bg-black/20">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${currentDay > 10 ? 'bg-red-500' : 'bg-green-500'}`} />
                <div className="text-[9px] text-cream/50 uppercase">Difficulty</div>
                <div className={`text-[10px] font-mono font-bold ${currentDay > 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {currentDay > 10 ? 'Locked' : `${10 - currentDay}d left`}
                </div>
              </div>
            </div>
            {/* Season Progress Bar */}
            <div className="mt-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-[9px] text-cream/40 mb-1">
                <span>Season Progress</span>
                <span>{Math.round((currentDay / 49) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-gold-500 rounded-full transition-all"
                  style={{ width: `${(currentDay / 49) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </motion.aside>

        {/* ================================================================
            COLUMN B: COMMAND (The "Act" Zone)
            Action Deck, Daily Tasks, Show Concept/Synergy
            ================================================================ */}
        <motion.section
          variants={columnVariants}
          className="col-span-1 lg:col-span-6 flex flex-col gap-2.5 overflow-y-auto lg:overflow-hidden"
        >
          {activeCorps ? (
            <>
              {/* Corps Hero Card */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex-shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl lg:text-3xl font-display font-black text-cream uppercase tracking-tight truncate">
                        {activeCorps.corpsName || activeCorps.name || 'UNNAMED'}
                      </h1>
                      <button
                        onClick={() => setShowEditCorps(true)}
                        className="p-1.5 rounded hover:bg-white/10 text-cream/40 hover:text-gold-400 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Show Concept */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {typeof activeCorps.showConcept === 'object' && activeCorps.showConcept.theme ? (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors group"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs text-cream/60 group-hover:text-purple-400 capitalize">
                            {activeCorps.showConcept.theme}
                          </span>
                          {(executionState?.synergyBonus || 0) > 0 && (
                            <span className="text-xs font-bold text-purple-400">
                              +{(executionState?.synergyBonus || 0).toFixed(1)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Configure Show
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
                <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-xl font-data font-bold text-blue-400">{executionState?.rehearsalsThisWeek || 0}/7</div>
                    <div className="text-[10px] text-cream/40 uppercase">Rehearsals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-data font-bold text-purple-400">
                      {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0}
                    </div>
                    <div className="text-[10px] text-cream/40 uppercase">Shows</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <div className="text-center">
                      <div className="text-xl font-data font-bold text-gold-400">
                        {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-[10px] text-cream/40 uppercase">Score</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-xl font-data font-bold text-green-400">{assignedStaff.length}/8</div>
                    <div className="text-[10px] text-cream/40 uppercase">Staff</div>
                  </div>
                </div>
              </div>

              {/* Action Deck - Primary Actions */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
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

              {/* Daily Tasks - Real Firebase Operations */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2.5 shrink-0">
                  <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Daily Tasks</span>
                  <span className="text-sm font-data font-bold text-gold-400">
                    {taskStats.completed}<span className="text-cream/40">/{taskStats.total}</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {opsLoading ? (
                    <div className="text-center py-4 text-cream/40 text-sm">Loading tasks...</div>
                  ) : (
                    <>
                      {/* Core Daily Operations */}
                      <TaskCheckbox
                        title="Login Bonus"
                        reward="+10 XP, +5 CC"
                        completed={!getTaskAvailability('login')}
                        loading={opsProcessing === 'login'}
                        onClick={() => handleDailyTask('login', claimDailyLogin)}
                      />
                      <TaskCheckbox
                        title="Staff Check-in"
                        reward="+15 XP"
                        completed={!getTaskAvailability('staff')}
                        loading={opsProcessing === 'staff'}
                        onClick={() => handleDailyTask('staff', () => staffCheckin({ corpsClass: activeCorpsClass }))}
                      />
                      <TaskCheckbox
                        title="Member Wellness"
                        reward="+15 XP, +3% morale"
                        completed={!getTaskAvailability('wellness')}
                        loading={opsProcessing === 'wellness'}
                        onClick={() => handleDailyTask('wellness', () => memberWellnessCheck({ corpsClass: activeCorpsClass }))}
                      />
                      <TaskCheckbox
                        title="Equipment Check"
                        reward="+10 XP, +5 CC"
                        completed={!getTaskAvailability('equipment')}
                        loading={opsProcessing === 'equipment'}
                        onClick={() => handleDailyTask('equipment', () => equipmentInspection({ corpsClass: activeCorpsClass }))}
                      />
                      <TaskCheckbox
                        title="Show Review"
                        reward="+20 XP"
                        completed={!getTaskAvailability('review')}
                        loading={opsProcessing === 'review'}
                        onClick={() => handleDailyTask('review', () => showReview({ corpsClass: activeCorpsClass }))}
                      />

                      {/* Sectional Rehearsals */}
                      <div className="pt-2.5 mt-1.5 border-t border-white/5">
                        <div className="text-[10px] font-display text-cream/40 uppercase tracking-wider mb-1.5">Sectionals (+2% readiness each)</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            onClick={() => handleSectionalRehearsal('music')}
                            disabled={!getSectionalAvailability('music') || opsProcessing === 'sectional_music'}
                            className={`flex flex-col items-center gap-1 p-2 rounded border transition-all ${
                              !getSectionalAvailability('music')
                                ? 'bg-green-500/10 border-green-500/30 opacity-60'
                                : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 cursor-pointer'
                            }`}
                          >
                            {opsProcessing === 'sectional_music' ? (
                              <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                            ) : !getSectionalAvailability('music') ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Music className="w-4 h-4 text-blue-400" />
                            )}
                            <span className={`text-[10px] font-bold ${!getSectionalAvailability('music') ? 'text-green-400' : 'text-blue-400'}`}>Music</span>
                          </button>
                          <button
                            onClick={() => handleSectionalRehearsal('visual')}
                            disabled={!getSectionalAvailability('visual') || opsProcessing === 'sectional_visual'}
                            className={`flex flex-col items-center gap-1 p-2 rounded border transition-all ${
                              !getSectionalAvailability('visual')
                                ? 'bg-green-500/10 border-green-500/30 opacity-60'
                                : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 cursor-pointer'
                            }`}
                          >
                            {opsProcessing === 'sectional_visual' ? (
                              <div className="w-4 h-4 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                            ) : !getSectionalAvailability('visual') ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-purple-400" />
                            )}
                            <span className={`text-[10px] font-bold ${!getSectionalAvailability('visual') ? 'text-green-400' : 'text-purple-400'}`}>Visual</span>
                          </button>
                          <button
                            onClick={() => handleSectionalRehearsal('guard')}
                            disabled={!getSectionalAvailability('guard') || opsProcessing === 'sectional_guard'}
                            className={`flex flex-col items-center gap-1 p-2 rounded border transition-all ${
                              !getSectionalAvailability('guard')
                                ? 'bg-green-500/10 border-green-500/30 opacity-60'
                                : 'bg-pink-500/10 border-pink-500/30 hover:bg-pink-500/20 cursor-pointer'
                            }`}
                          >
                            {opsProcessing === 'sectional_guard' ? (
                              <div className="w-4 h-4 border border-pink-400 border-t-transparent rounded-full animate-spin" />
                            ) : !getSectionalAvailability('guard') ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Flag className="w-4 h-4 text-pink-400" />
                            )}
                            <span className={`text-[10px] font-bold ${!getSectionalAvailability('guard') ? 'text-green-400' : 'text-pink-400'}`}>Guard</span>
                          </button>
                          <button
                            onClick={() => handleSectionalRehearsal('percussion')}
                            disabled={!getSectionalAvailability('percussion') || opsProcessing === 'sectional_percussion'}
                            className={`flex flex-col items-center gap-1 p-2 rounded border transition-all ${
                              !getSectionalAvailability('percussion')
                                ? 'bg-green-500/10 border-green-500/30 opacity-60'
                                : 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 cursor-pointer'
                            }`}
                          >
                            {opsProcessing === 'sectional_percussion' ? (
                              <div className="w-4 h-4 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                            ) : !getSectionalAvailability('percussion') ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Drum className="w-4 h-4 text-orange-400" />
                            )}
                            <span className={`text-[10px] font-bold ${!getSectionalAvailability('percussion') ? 'text-green-400' : 'text-orange-400'}`}>Perc</span>
                          </button>
                        </div>
                      </div>
                    </>
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
          className="hidden lg:flex lg:col-span-3 flex-col gap-2.5 overflow-hidden"
        >
          {/* Aggregate Staff Efficiency */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Staff Efficiency</span>
              <Users className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl font-data font-bold text-green-400">{Math.round(staffEfficiency.value * 100)}%</span>
              <span className={`text-xs font-display font-bold uppercase ${
                staffEfficiency.bonus >= 0 ? 'text-green-400' : 'text-orange-400'
              }`}>
                {staffEfficiency.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2.5 rounded-sm transition-colors ${
                    i < assignedStaff.length ? 'bg-green-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setShowStaffPanel(true)}
              className="w-full text-xs font-display font-bold text-gold-400 uppercase tracking-wide py-2.5 border border-gold-500/30 rounded hover:bg-gold-500/10 transition-colors"
            >
              Manage Staff →
            </button>
          </div>

          {/* Equipment Management - Full Interactive */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Equipment</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-gold-400">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="text-sm font-mono font-bold">{profile?.corpsCoin || 0}</span>
                </div>
              </div>
            </div>

            {/* Performance Equipment */}
            <div className="text-[9px] text-cream/40 uppercase tracking-wider mb-1.5">Performance (affects captions)</div>
            <div className="space-y-1.5 mb-3">
              {/* Instruments */}
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors">
                <span className="text-lg">🎺</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-cream truncate">Instruments</span>
                    <span className="text-[8px] text-cream/40">(B, MA, P)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.instruments >= 0.85 ? 'bg-green-500' : equipment.instruments >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.instruments * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${equipment.instruments >= 0.85 ? 'text-green-400' : equipment.instruments >= 0.70 ? 'text-yellow-400' : 'text-red-400'}`}>{Math.round(equipment.instruments * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => repairEquipment('instruments')}
                  disabled={executionProcessing || equipment.instruments >= 0.95}
                  className="px-2 py-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Repair 150cc
                </button>
              </div>

              {/* Uniforms */}
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors">
                <span className="text-lg">👔</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-cream truncate">Uniforms</span>
                    <span className="text-[8px] text-cream/40">(VP, VA)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.uniforms >= 0.85 ? 'bg-green-500' : equipment.uniforms >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.uniforms * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${equipment.uniforms >= 0.85 ? 'text-green-400' : equipment.uniforms >= 0.70 ? 'text-yellow-400' : 'text-red-400'}`}>{Math.round(equipment.uniforms * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => repairEquipment('uniforms')}
                  disabled={executionProcessing || equipment.uniforms >= 0.95}
                  className="px-2 py-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Repair 100cc
                </button>
              </div>

              {/* Props */}
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors">
                <span className="text-lg">🎨</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-cream truncate">Props</span>
                    <span className="text-[8px] text-cream/40">(CG)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.props >= 0.85 ? 'bg-green-500' : equipment.props >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.props * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${equipment.props >= 0.85 ? 'text-green-400' : equipment.props >= 0.70 ? 'text-yellow-400' : 'text-red-400'}`}>{Math.round(equipment.props * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => repairEquipment('props')}
                  disabled={executionProcessing || equipment.props >= 0.95}
                  className="px-2 py-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Repair 120cc
                </button>
              </div>
            </div>

            {/* Travel Equipment */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-cream/40 uppercase tracking-wider">Travel Fleet</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${(equipment.bus + equipment.truck) >= 1.40 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {(equipment.bus + equipment.truck) >= 1.40 ? 'OK' : '-3% penalty'}
              </span>
            </div>
            <div className="space-y-1.5">
              {/* Bus */}
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Radio className={`w-4 h-4 ${equipment.bus >= 0.70 ? 'text-blue-400' : 'text-red-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-cream truncate">Tour Bus</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.bus >= 0.85 ? 'bg-green-500' : equipment.bus >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.bus * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${equipment.bus >= 0.85 ? 'text-green-400' : equipment.bus >= 0.70 ? 'text-yellow-400' : 'text-red-400'}`}>{Math.round(equipment.bus * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => repairEquipment('bus')}
                  disabled={executionProcessing || equipment.bus >= 0.95}
                  className="px-2 py-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Repair 200cc
                </button>
              </div>

              {/* Truck */}
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Gauge className={`w-4 h-4 ${equipment.truck >= 0.70 ? 'text-blue-400' : 'text-red-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-cream truncate">Equipment Truck</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.truck >= 0.85 ? 'bg-green-500' : equipment.truck >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.truck * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${equipment.truck >= 0.85 ? 'text-green-400' : equipment.truck >= 0.70 ? 'text-yellow-400' : 'text-red-400'}`}>{Math.round(equipment.truck * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => repairEquipment('truck')}
                  disabled={executionProcessing || equipment.truck >= 0.95}
                  className="px-2 py-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Repair 250cc
                </button>
              </div>
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
