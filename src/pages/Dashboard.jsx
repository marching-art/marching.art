// src/pages/Dashboard.jsx
// ARCHITECTURE: High-Density HUD (Heads-Up Display) - One-Page Command Center
// Three-Column Layout: Intelligence | Command | Logistics
// No scrolling on desktop - everything fits in viewport
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Trophy, Calendar,
  TrendingUp, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit, BarChart3, Settings, Clock, RefreshCw,
  CheckCircle, Circle, ArrowUp, AlertTriangle, ChevronRight,
  Shield, Eye, Drum, Flag, Activity, Radio
} from 'lucide-react';
import { useAuth } from '../App';
import BrandLogo from '../components/BrandLogo';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
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
import { useScoresData } from '../hooks/useScoresData';
import {
  retireCorps,
  claimDailyLogin,
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
// LEAGUE TICKER COMPONENT - User's Corps Game Data Footer
// ============================================================================
const LeagueTicker = ({ seasonData, currentDay }) => {
  const [tickerData, setTickerData] = useState({ scores: [], loading: true, error: null });
  const { allShows, loading: scoresLoading } = useScoresData();

  // Get recent game show results for ticker
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
    getCorpsClassName,
    getCorpsClassColor,
    completeDailyChallenge,
    refreshProfile
  } = dashboardData;

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
    if (!opsStatus) return { completed: 0, total: 8 };
    let completed = 0;
    if (!opsStatus.loginBonus?.available) completed++;
    if (!opsStatus.memberWellness?.available) completed++;
    if (!opsStatus.equipmentInspection?.available) completed++;
    if (!opsStatus.showReview?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.music?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.visual?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.guard?.available) completed++;
    if (!opsStatus.sectionalRehearsals?.percussion?.available) completed++;
    return { completed, total: 8 };
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

  const handleOpenRetireModal = () => {
    setShowRetireConfirm(true);
  };

  const handleRetireCorps = async () => {
    setRetiring(true);
    try {
      const result = await retireCorps({
        corpsClass: activeCorpsClass
      });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowRetireConfirm(false);
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
            COLUMN B: COMMAND (The "Act" Zone)
            Action Deck, Daily Tasks, Show Concept/Synergy
            ================================================================ */}
        <motion.section
          variants={columnVariants}
          className="col-span-1 lg:col-span-9 flex flex-col gap-2.5 overflow-y-auto lg:overflow-hidden"
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
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-xl font-data font-bold text-purple-400">
                      {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0}
                    </div>
                    <div className="text-[10px] text-cream/40 uppercase">Shows This Week</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <div className="text-center">
                      <div className="text-xl font-data font-bold text-gold-400">
                        {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-[10px] text-cream/40 uppercase">Season Score</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Deck - Primary Actions */}
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Show Concept / Synergy */}
                  <ActionButton
                    icon={Sparkles}
                    label="Show Concept"
                    subtitle={activeCorps?.showConcept?.theme || 'Configure'}
                    onClick={() => setShowSynergyPanel(true)}
                    color="purple"
                  />
                  {/* Schedule */}
                  <Link to="/schedule">
                    <ActionButton
                      icon={Calendar}
                      label="Schedule"
                      subtitle="View shows"
                      color="blue"
                    />
                  </Link>
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
            Season Progress and Navigation
            ================================================================ */}
        <motion.aside
          variants={columnVariants}
          className="hidden lg:flex lg:col-span-3 flex-col gap-2.5 overflow-hidden"
        >
          {/* Season Progress */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider">Season Progress</span>
              <span className="text-xs font-mono text-cream/40">Day {currentDay}/49</span>
            </div>
            <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-gold-500 rounded-full transition-all"
                style={{ width: `${(currentDay / 49) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-cream/40">
              <span>Week {currentWeek}</span>
              <span>{weeksRemaining}w remaining</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3.5 flex-1 overflow-y-auto">
            <span className="text-xs font-display font-bold text-cream/60 uppercase tracking-wider block mb-3">Quick Links</span>
            <div className="space-y-2">
              <Link
                to="/schedule"
                className="flex items-center gap-2 p-2.5 bg-black/30 rounded border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/10 transition-colors group"
              >
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-cream group-hover:text-purple-400">Show Schedule</span>
              </Link>
              <Link
                to="/leaderboard"
                className="flex items-center gap-2 p-2.5 bg-black/30 rounded border border-white/5 hover:border-gold-500/30 hover:bg-gold-500/10 transition-colors group"
              >
                <Trophy className="w-4 h-4 text-gold-400" />
                <span className="text-sm text-cream group-hover:text-gold-400">Leaderboard</span>
              </Link>
              <Link
                to="/battlepass"
                className="flex items-center gap-2 p-2.5 bg-black/30 rounded border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/10 transition-colors group"
              >
                <Gift className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-cream group-hover:text-blue-400">Battle Pass</span>
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
            onClose={() => setShowRetireConfirm(false)}
            onConfirm={handleRetireCorps}
            corpsName={activeCorps.corpsName || activeCorps.name}
            corpsClass={activeCorpsClass}
            retiring={retiring}
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
        engagementData={engagementData}
        dailyChallenges={dailyChallenges}
        recentScores={recentScores}
      />
    </div>
  );
};

export default Dashboard;
