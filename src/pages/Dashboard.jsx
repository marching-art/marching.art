// src/pages/Dashboard.jsx
// UI/UX Overhaul: "Refined Brutalism meets Luxury Sports Analytics"
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, ChevronRight, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit
} from 'lucide-react';
import { useAuth } from '../App';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  EquipmentManager,
  DashboardStaffPanel
} from '../components/Execution';
import CaptionSelectionModal from '../components/CaptionSelection/CaptionSelectionModal';
import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  MorningReport,
  DailyOperations
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { retireCorps } from '../firebase/functions';

// ============================================================================
// STADIUM HUD DESIGN COMPONENTS
// Night Mode aesthetic with glassmorphism and neon gold accents
// ============================================================================

// Stadium HUD Metric Gauge - Glowing progress bar with light trail effect
const TacticalMetricGauge = ({ value, color = 'gold', label, icon: Icon }) => {
  const percentage = Math.round(value * 100);

  // Stadium HUD color mapping for progress fill
  const fillColorClasses = {
    gold: 'progress-glow-fill',
    blue: 'progress-glow-fill status-good',
    red: 'progress-glow-fill status-danger',
    orange: 'progress-glow-fill status-warning',
    green: 'progress-glow-fill status-excellent',
    purple: 'progress-glow-fill status-good'
  };

  const textColorClasses = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    red: 'text-rose-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    purple: 'text-purple-400'
  };

  const iconColorClasses = {
    gold: 'text-gold-500',
    blue: 'text-blue-400',
    red: 'text-rose-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    purple: 'text-purple-400'
  };

  return (
    <div className="space-y-3">
      {/* Label with neon icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconColorClasses[color]}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />}
          <span className="text-xs font-display font-bold uppercase tracking-widest text-cream-muted">
            {label}
          </span>
        </div>
        <span className={`font-mono font-bold text-lg ${textColorClasses[color]}`} style={{ textShadow: '0 0 10px currentColor' }}>
          {percentage}%
        </span>
      </div>
      {/* Stadium HUD Progress Bar with Gold Light Trail */}
      <div className="progress-glow h-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={fillColorClasses[color]}
        />
      </div>
    </div>
  );
};

// Stadium HUD Action Tile - Fills available space proportionally
const IconCard = ({ icon: Icon, label, subtitle, onClick, disabled, processing, completed }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled || processing}
    whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
    whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
    className={`icon-card group h-full min-h-[140px] flex flex-col items-center justify-center gap-3 ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    } ${completed ? 'border-green-500/40' : ''}`}
  >
    {/* Large background icon - subtle watermark with neon glow on hover */}
    <div className="icon-card-bg flex items-center justify-center">
      <Icon className="w-full h-full text-white/80" />
    </div>

    {/* Content */}
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className={`p-3 rounded-xl transition-all duration-300 ${
        completed
          ? 'bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
          : 'bg-gold-500/10 group-hover:bg-gold-500/20 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.3)]'
      }`}>
        {processing ? (
          <div className="w-7 h-7 border-3 border-gold-500 border-t-transparent rounded-full animate-spin" style={{ boxShadow: '0 0 10px rgba(250, 204, 21, 0.4)' }} />
        ) : completed ? (
          <Check className="w-7 h-7 text-green-500" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.6))' }} />
        ) : (
          <Icon className="w-7 h-7 text-gold-400 transition-all group-hover:text-gold-300" style={{ filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.5))' }} />
        )}
      </div>
      <span className="text-sm font-display font-bold text-cream uppercase tracking-wider text-center group-hover:text-gold-400 transition-colors" style={{ textShadow: '0 0 0 transparent', transition: 'text-shadow 0.3s' }}>
        {label}
      </span>
      {subtitle && (
        <span className="text-[10px] text-cream-muted font-display uppercase tracking-wide">
          {subtitle}
        </span>
      )}
    </div>
  </motion.button>
);

// Stadium HUD Quick Stat Card - Larger, fills available height proportionally
const QuickStatCard = ({ icon: Icon, label, value, color = 'gold', to }) => {
  const colorClasses = {
    gold: 'text-gold-400 bg-gold-500/10 border-gold-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30'
  };

  const glowStyles = {
    gold: { filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))' },
    blue: { filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' },
    purple: { filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' },
    orange: { filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.5))' },
    green: { filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.5))' }
  };

  const content = (
    <div className={`glass-card h-full p-5 flex flex-col justify-center gap-3 ${to ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
      <div className={`p-3 rounded-xl border w-fit ${colorClasses[color]}`}>
        <Icon className={`w-7 h-7 ${colorClasses[color].split(' ')[0]}`} style={glowStyles[color]} />
      </div>
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className={`text-3xl lg:text-4xl font-mono font-bold ${colorClasses[color].split(' ')[0]}`} style={{ textShadow: '0 0 12px currentColor' }}>
          {value}
        </div>
        <div className="text-xs font-display uppercase tracking-widest text-cream-muted mt-1">
          {label}
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

const Dashboard = () => {
  const { user } = useAuth();

  // Use centralized dashboard hook
  const dashboardData = useDashboardData();

  // Get assigned staff for CommandCenter
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

  // Slide-out panel states
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  // Daily activities panel
  const [showDailyActivities, setShowDailyActivities] = useState(false);

  // Destructure commonly used values
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    weeksRemaining,
    currentWeek,
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
  const assignedStaff = ownedStaff?.filter(
    s => s.assignedTo?.corpsClass === activeCorpsClass
  ) || [];

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

  // Calculate multiplier
  const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);
  const multiplier = Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));

  // Get multiplier status - Light mode uses dark colors, Dark mode uses bright colors
  const getMultiplierStatus = () => {
    if (multiplier >= 1.05) return { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-500', label: 'ELITE' };
    if (multiplier >= 0.95) return { color: 'text-amber-700 dark:text-gold-500', bg: 'bg-gold-500', label: 'STRONG' };
    if (multiplier >= 0.85) return { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500', label: 'FAIR' };
    return { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500', label: 'WEAK' };
  };
  const multiplierStatus = getMultiplierStatus();

  const rehearsalsThisWeek = executionState?.rehearsalsThisWeek ?? 0;
  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;
  const equipmentNeedsRepair = avgEquipment < 0.85;
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  // Class colors for badges
  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900',
    openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white',
    soundSport: 'bg-green-500 text-white',
  };

  // Class order for sorting
  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

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
    if (newlyUnlockedClass) {
      setShowClassUnlockCongrats(true);
    }
  }, [newlyUnlockedClass]);

  // Show achievement modal when new achievement
  useEffect(() => {
    if (newAchievement) {
      setShowAchievementModal(true);
    }
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
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}`]: null
      });
      toast.success(`${activeCorps.corpsName || activeCorps.name} has been deleted`);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting corps:', error);
      toast.error('Failed to delete corps. Please try again.');
    }
  };

  // Track assigned staff for retirement flow
  const [assignedStaffForRetire, setAssignedStaffForRetire] = useState([]);

  const handleOpenRetireModal = async () => {
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass, checkOnly: true });
      if (result.data.assignedStaff) {
        setAssignedStaffForRetire(result.data.assignedStaff);
      } else {
        setAssignedStaffForRetire([]);
      }
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
      await updateDoc(profileRef, {
        [`corps.${formData.class}`]: corpsData
      });
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

  // Handle rehearsal from CommandCenter
  const handleRehearsal = async () => {
    if (canRehearseToday()) {
      const result = await rehearse();
      if (result.success) {
        toast.success(`Rehearsal complete! +${result.data?.xpGained || 50} XP`);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 relative z-10">
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

      {/* ======================================================================
          TOP BAR: User Identity & Quick Stats
          ====================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-brutalist p-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Welcome & Season Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-display font-black text-text-main uppercase tracking-tight truncate">
              {profile?.displayName || 'Director'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-text-muted text-sm font-display">
                {formatSeasonName(seasonData?.name)}
              </span>
              {weeksRemaining && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold">
                  <Calendar className="w-3 h-3" />
                  Week {currentWeek} • {weeksRemaining}w left
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Login Streak */}
            {engagementData?.loginStreak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 border-2 border-orange-500/30">
                <Flame className={`w-5 h-5 ${engagementData.loginStreak >= 7 ? 'text-orange-500 animate-pulse' : 'text-orange-600 dark:text-orange-500'}`} />
                <span className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400">
                  {engagementData.loginStreak}
                </span>
              </div>
            )}

            {/* XP Level */}
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 dark:bg-gold-500/20 border-2 border-amber-500/30 dark:border-gold-500/30 hover:border-amber-500/60 dark:hover:border-gold-500/60 transition-all"
            >
              <Zap className="w-5 h-5 text-amber-600 dark:text-gold-500" />
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-gold-500">LVL {profile?.xpLevel || 1}</span>
                <div className="w-12 h-1.5 bg-stone-200 dark:bg-charcoal-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 dark:bg-gold-500 transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </Link>

            {/* CorpsCoin */}
            <Link
              to="/staff"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 dark:bg-gold-500/20 border-2 border-amber-500/30 dark:border-gold-500/30 hover:border-amber-500/60 dark:hover:border-gold-500/60 transition-all"
            >
              <Coins className="w-5 h-5 text-amber-600 dark:text-gold-500" />
              <span className="text-lg font-mono font-bold text-amber-600 dark:text-gold-500">
                {(profile?.corpsCoin || 0).toLocaleString()}
              </span>
            </Link>

            {/* Battle Pass Rewards */}
            {unclaimedRewardsCount > 0 && (
              <Link
                to="/battlepass"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/30 dark:from-gold-500/30 to-purple-500/30 border-2 border-amber-500/50 dark:border-gold-500/50 animate-pulse"
              >
                <Gift className="w-5 h-5 text-amber-600 dark:text-gold-400" />
                <span className="text-sm font-bold text-amber-600 dark:text-gold-400">{unclaimedRewardsCount}</span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* ======================================================================
          CORPS SELECTOR (if multiple corps)
          ====================================================================== */}
      {hasMultipleCorps && (
        <div className="flex items-center gap-3 px-1">
          <Music className="w-5 h-5 text-amber-600 dark:text-gold-500 flex-shrink-0" />
          <div className="flex items-center gap-2 overflow-x-auto scroll-hide pb-1">
            {Object.entries(corps)
              .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
              .map(([classId, corpsData]) => (
                <button
                  key={classId}
                  onClick={() => handleCorpsSwitch(classId)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all border-2 ${
                    activeCorpsClass === classId
                      ? 'bg-primary text-text-inverse border-amber-400 dark:border-gold-400 shadow-md dark:shadow-brutal-gold'
                      : 'bg-white dark:bg-surface-secondary text-text-muted border-stone-200 dark:border-border-default hover:text-text-main hover:border-primary/50'
                  }`}
                >
                  {corpsData.corpsName || corpsData.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          MAIN BENTO GRID LAYOUT - Proportional scaling across all elements
          ====================================================================== */}
      {activeCorps && (
        <div className="flex-1 min-h-0 flex flex-col gap-4 lg:gap-5">
          {/* ROW 1: Hero Card + Action Tiles - Takes ~55% of available space */}
          <div className="flex-[55] min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* ================================================================
                HERO CARD: Stadium Banner with Score Bug
                ================================================================ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-8 stadium-banner p-0 overflow-hidden flex flex-col"
            >
            {/* Stadium overlay silhouette */}
            <div className="stadium-overlay" />

            {/* Watermark Trophy */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
              <Trophy className="w-64 h-64 md:w-80 md:h-80" />
            </div>

            <div className="relative z-10">
              {/* ============================================================
                  CORPS STATUS HEADER - Stadium HUD with glowing elements
                  ============================================================ */}
              <div className="px-6 md:px-8 pt-6 md:pt-8 pb-5 border-b border-white/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Corps Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                        {getCorpsClassName(activeCorpsClass)}
                      </span>
                      {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold-500/20 text-gold-400 text-[10px] font-bold uppercase tracking-wide" style={{ boxShadow: '0 0 10px rgba(250, 204, 21, 0.2)' }}>
                          <Crown size={10} style={{ filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))' }} />
                          TOP 10
                        </span>
                      )}
                    </div>
                    <h2 className="sports-header text-3xl md:text-4xl lg:text-5xl text-cream">
                      {activeCorps.corpsName || activeCorps.name || 'UNSPECIFIED'}
                    </h2>
                    {activeCorps.showConcept && (
                      <p className="text-cream-muted text-sm md:text-base font-body italic mt-1">
                        <span className="text-gold-400 not-italic">"</span>
                        {activeCorps.showConcept}
                        <span className="text-gold-400 not-italic">"</span>
                      </p>
                    )}
                  </div>

                  {/* Performance Multiplier - Glowing Score Bug */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="score-bug">
                      <div className="text-[8px] text-cream-muted uppercase tracking-[0.25em] font-display font-bold mb-1">
                        Multiplier
                      </div>
                      <div className={`text-4xl md:text-5xl font-display font-bold tabular-nums text-gold-400`} style={{ textShadow: '0 0 20px rgba(250, 204, 21, 0.5)' }}>
                        {multiplier.toFixed(2)}x
                      </div>
                      <div className={`text-xs font-display font-bold uppercase tracking-wider ${multiplierStatus.color} flex items-center gap-1 mt-1`}>
                        <TrendingUp size={12} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
                        {multiplierStatus.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================
                  EXECUTION METRICS - Tactical Gauge Section
                  ============================================================ */}
              <div className="px-6 md:px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <TacticalMetricGauge
                    value={readiness}
                    color="blue"
                    label="Readiness"
                    icon={Target}
                  />
                  <TacticalMetricGauge
                    value={morale}
                    color="red"
                    label="Morale"
                    icon={Heart}
                  />
                  <TacticalMetricGauge
                    value={avgEquipment}
                    color="orange"
                    label="Equipment"
                    icon={Wrench}
                  />
                </div>
              </div>

              {/* Quick Stats Row - Stadium HUD with glowing numbers */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 md:px-8 pb-6 pt-0 border-t border-white/10 mt-0">
                <div className="flex items-center gap-6 pt-5">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-blue-400" style={{ textShadow: '0 0 10px rgba(96, 165, 250, 0.5)' }}>{rehearsalsThisWeek}/7</div>
                    <div className="text-[10px] text-cream-muted uppercase tracking-widest font-display">This Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-purple-400" style={{ textShadow: '0 0 10px rgba(192, 132, 252, 0.5)' }}>{showsThisWeek}</div>
                    <div className="text-[10px] text-cream-muted uppercase tracking-widest font-display">Shows</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 15px rgba(250, 204, 21, 0.5)' }}>
                        {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-[10px] text-cream-muted uppercase tracking-widest font-display">Score</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-green-400" style={{ textShadow: '0 0 10px rgba(74, 222, 128, 0.5)' }}>{assignedStaff.length}/8</div>
                    <div className="text-[10px] text-cream-muted uppercase tracking-widest font-display">Staff</div>
                  </div>
                </div>

                {/* Quick Links - Glass buttons with glow */}
                <div className="flex items-center gap-2 pt-5">
                  <button
                    onClick={() => setShowCaptionSelection(true)}
                    className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/40 hover:border-gold-500 text-gold-400 hover:text-gold-300 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                    title="Edit Captions"
                  >
                    <Edit size={20} />
                  </button>
                  <Link
                    to="/schedule"
                    className="p-3 rounded-lg bg-white/5 border border-white/15 hover:border-gold-500/50 text-cream-muted hover:text-gold-400 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                    title="View Schedule"
                  >
                    <Calendar size={20} />
                  </Link>
                  <Link
                    to="/scores"
                    className="p-3 rounded-lg bg-white/5 border border-white/15 hover:border-gold-500/50 text-cream-muted hover:text-gold-400 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                    title="View Scores"
                  >
                    <Trophy size={20} />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

            {/* ================================================================
                ACTION TILES GRID (spans 4 columns on desktop)
                ================================================================ */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3 lg:gap-4 content-stretch">
              {/* Daily Rehearsal */}
              <IconCard
                icon={Music}
                label="Rehearse"
                subtitle="+5% Ready"
                onClick={handleRehearsal}
                disabled={!canRehearseToday()}
                processing={executionProcessing}
                completed={!canRehearseToday()}
              />

              {/* Staff Panel */}
              <IconCard
                icon={Users}
                label="Staff"
                subtitle={`${assignedStaff.length}/8 Assigned`}
                onClick={() => {
                  setShowStaffPanel(true);
                  completeDailyChallenge('staff_meeting');
                }}
              />

              {/* Equipment Panel */}
              <IconCard
                icon={Wrench}
                label="Equipment"
                subtitle={equipmentNeedsRepair ? 'Needs Repair!' : `${Math.round(avgEquipment * 100)}%`}
                onClick={() => {
                  setShowEquipmentPanel(true);
                  completeDailyChallenge('maintain_equipment');
                }}
              />

              {/* Daily Activities */}
              <IconCard
                icon={Zap}
                label="Activities"
                subtitle="Daily Tasks"
                onClick={() => setShowDailyActivities(true)}
              />
            </div>
          </div>

          {/* ROW 2: Weekly Progress Stats - Takes ~25% of available space */}
          <div className="flex-[25] min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <QuickStatCard
              icon={Target}
              label="Rehearsals"
              value={`+${weeklyProgress?.rehearsalsCompleted || 0}`}
              color="blue"
            />
            <QuickStatCard
              icon={Trophy}
              label="Score Change"
              value={`${(weeklyProgress?.scoreImprovement || 0) >= 0 ? '+' : ''}${(weeklyProgress?.scoreImprovement || 0).toFixed(1)}`}
              color={(weeklyProgress?.scoreImprovement || 0) >= 0 ? 'green' : 'orange'}
            />
            <QuickStatCard
              icon={TrendingUp}
              label="Rank Change"
              value={`${(weeklyProgress?.rankChange || 0) > 0 ? '↑' : (weeklyProgress?.rankChange || 0) < 0 ? '↓' : '→'}${Math.abs(weeklyProgress?.rankChange || 0)}`}
              color={(weeklyProgress?.rankChange || 0) > 0 ? 'green' : (weeklyProgress?.rankChange || 0) < 0 ? 'orange' : 'blue'}
            />
            <QuickStatCard
              icon={Users}
              label="Staff Market"
              value="Browse"
              color="purple"
              to="/staff"
            />
          </div>

          {/* ROW 3: Quick Links - Takes ~20% of available space */}
          <div className="flex-[20] min-h-0 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
            <Link
              to="/scores"
              className="card-brutalist p-5 flex items-center gap-4 transition-all hover:scale-[1.02]"
            >
              <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/30">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
              <span className="font-display font-bold text-text-main text-lg">Leaderboards</span>
              <ChevronRight className="w-6 h-6 text-text-muted ml-auto" />
            </Link>
            <Link
              to="/schedule"
              className="card-brutalist p-5 flex items-center gap-4 transition-all hover:scale-[1.02]"
            >
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <Calendar className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-display font-bold text-text-main text-lg">Schedule</span>
              <ChevronRight className="w-6 h-6 text-text-muted ml-auto" />
            </Link>
            <Link
              to="/leagues"
              className="card-brutalist p-5 flex items-center gap-4 transition-all hover:scale-[1.02]"
            >
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-display font-bold text-text-main text-lg">Leagues</span>
              <ChevronRight className="w-6 h-6 text-text-muted ml-auto" />
            </Link>
            <Link
              to="/battlepass"
              className="card-brutalist p-5 flex items-center gap-4 transition-all hover:scale-[1.02]"
            >
              <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/30">
                <Crown className="w-7 h-7 text-primary" />
              </div>
              <span className="font-display font-bold text-text-main text-lg">Season Pass</span>
              <ChevronRight className="w-6 h-6 text-text-muted ml-auto" />
            </Link>
          </div>

        </div>
      )}

      {/* SoundSport Fun Badge */}
      {activeCorpsClass === 'soundSport' && (
        <div className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-green-500/10 border-2 border-green-500/30 text-green-600 dark:text-green-400">
          <Sparkles size={20} />
          <span className="font-display font-bold">SoundSport is non-competitive - just have fun!</span>
        </div>
      )}

      {/* ======================================================================
          SLIDE-OUT PANELS
          ====================================================================== */}

      {/* Equipment Panel */}
      <AnimatePresence>
        {showEquipmentPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEquipmentPanel(false)}
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-l-3 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-b-2 dark:border-border-default p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-text-main uppercase tracking-tight">Equipment Manager</h2>
                <button
                  onClick={() => setShowEquipmentPanel(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-surface-secondary text-text-muted hover:text-text-main transition-colors"
                >
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
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-l-3 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-b-2 dark:border-border-default p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-text-main uppercase tracking-tight">Staff Roster</h2>
                <button
                  onClick={() => setShowStaffPanel(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-surface-secondary text-text-muted hover:text-text-main transition-colors"
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

      {/* Daily Activities Panel */}
      <AnimatePresence>
        {showDailyActivities && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDailyActivities(false)}
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-l-3 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-b-2 dark:border-border-default p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-text-main uppercase tracking-tight">Daily Activities</h2>
                <button
                  onClick={() => setShowDailyActivities(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-surface-secondary text-text-muted hover:text-text-main transition-colors"
                >
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

      {/* ======================================================================
          MODALS
          ====================================================================== */}
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
