// src/pages/Dashboard.jsx
// ARCHITECTURE FIX: Single Source of Truth - Fixed-Height Game HUD
// Bento Grid Layout: 100vh viewport with TopBar + 2-column grid (Cockpit | Context Panel)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, ChevronRight, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit, BarChart3, Settings, Clock, RefreshCw,
  CheckCircle, Circle, ArrowUp, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../App';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  EquipmentManager,
  DashboardStaffPanel,
  ExecutionInsightsPanel,
  SectionGauges,
  // HUD Hover Insights - Phase 3 Transparent Gameplay
  TacticalGaugeWithInsight,
  MultiplierFactorPills,
  ScoreBreakdownTooltip,
  StaffEffectivenessTooltip,
  // Glass Box Multiplier - Interactive breakdown
  MultiplierGlassBoxLarge,
  // Segmented Metric Bars - Split-signal display
  SegmentedMetricBar,
  ClusterBar,
  // Difficulty Confidence Meter - Risk/Reward visualization
  ConfidenceBadge,
  DifficultyConfidenceMeter,
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
  DailyOperations
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { retireCorps } from '../firebase/functions';

// ============================================================================
// FIXED-HEIGHT HUD COMPONENTS
// Night Mode aesthetic with glassmorphism and neon gold accents
// ============================================================================

// TopBar Component - Fixed height header with user stats
const TopBar = ({ profile, seasonData, weeksRemaining, currentWeek, formatSeasonName, engagementData, unclaimedRewardsCount }) => {
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  return (
    <div className="shrink-0 bg-surface-secondary border-b border-border-default">
      <div className="px-4 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Welcome & Season Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-display font-black text-text-main uppercase tracking-tight truncate">
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
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <Flame className={`w-4 h-4 ${engagementData.loginStreak >= 7 ? 'text-orange-500 animate-pulse' : 'text-orange-500'}`} />
                <span className="text-sm font-mono font-bold text-orange-600 dark:text-orange-400">
                  {engagementData.loginStreak}
                </span>
              </div>
            )}

            {/* XP Level */}
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 dark:bg-gold-500/20 border border-amber-500/30 dark:border-gold-500/30 hover:border-amber-500/60 dark:hover:border-gold-500/60 transition-all"
            >
              <Zap className="w-4 h-4 text-amber-600 dark:text-gold-500" />
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-gold-500">LVL {profile?.xpLevel || 1}</span>
                <div className="w-10 h-1 bg-stone-200 dark:bg-charcoal-800 rounded-full overflow-hidden">
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 dark:bg-gold-500/20 border border-amber-500/30 dark:border-gold-500/30 hover:border-amber-500/60 dark:hover:border-gold-500/60 transition-all"
            >
              <Coins className="w-4 h-4 text-amber-600 dark:text-gold-500" />
              <span className="text-sm font-mono font-bold text-amber-600 dark:text-gold-500">
                {(profile?.corpsCoin || 0).toLocaleString()}
              </span>
            </Link>

            {/* Battle Pass Rewards */}
            {unclaimedRewardsCount > 0 && (
              <Link
                to="/battlepass"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/30 dark:from-gold-500/30 to-purple-500/30 border border-amber-500/50 dark:border-gold-500/50 animate-pulse"
              >
                <Gift className="w-4 h-4 text-amber-600 dark:text-gold-400" />
                <span className="text-xs font-bold text-amber-600 dark:text-gold-400">{unclaimedRewardsCount}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stadium HUD Action Tile - Responsive, fills grid cell
const IconCard = ({ icon: Icon, label, subtitle, onClick, disabled, processing, completed }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled || processing}
    whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
    whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
    className={`icon-card group min-h-[90px] flex flex-col items-center justify-center gap-2 p-3 ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    } ${completed ? 'border-green-500/40' : ''}`}
  >
    {/* Large background icon */}
    <div className="icon-card-bg flex items-center justify-center">
      <Icon className="w-full h-full text-white/80" />
    </div>

    {/* Content */}
    <div className="relative z-10 flex flex-col items-center gap-1">
      <div className={`p-2 rounded-xl transition-all duration-300 ${
        completed
          ? 'bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
          : 'bg-gold-500/10 group-hover:bg-gold-500/20 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.3)]'
      }`}>
        {processing ? (
          <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        ) : completed ? (
          <Check className="w-5 h-5 text-green-500" />
        ) : (
          <Icon className="w-5 h-5 text-gold-400 transition-all group-hover:text-gold-300" />
        )}
      </div>
      <span className="text-xs font-display font-bold text-cream uppercase tracking-wider text-center group-hover:text-gold-400 transition-colors">
        {label}
      </span>
      {subtitle && (
        <span className="text-[9px] text-cream-muted font-display uppercase tracking-wide">
          {subtitle}
        </span>
      )}
    </div>
  </motion.button>
);

// Quick Stat Card
const QuickStatCard = ({ icon: Icon, label, value, color = 'gold', to }) => {
  const colorClasses = {
    gold: 'text-gold-400 bg-gold-500/10 border-gold-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30'
  };

  const content = (
    <div className={`glass-card p-3 flex items-center gap-3 ${to ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
      <div className={`p-2 rounded-xl border flex-shrink-0 ${colorClasses[color]}`}>
        <Icon className={`w-4 h-4 ${colorClasses[color].split(' ')[0]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-lg font-mono font-bold ${colorClasses[color].split(' ')[0]}`}>
          {value}
        </div>
        <div className="text-[10px] font-display uppercase tracking-widest text-cream-muted">
          {label}
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
};

// Class colors for badges
const classColors = {
  worldClass: 'bg-gold-500 text-charcoal-900',
  openClass: 'bg-purple-500 text-white',
  aClass: 'bg-blue-500 text-white',
  soundSport: 'bg-green-500 text-white',
};

// Class order for sorting
const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// ===========================================================================
// MAIN DASHBOARD COMPONENT
// ===========================================================================

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

  // Slide-out panel states (mobile only)
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  // Daily activities panel
  const [showDailyActivities, setShowDailyActivities] = useState(false);

  // Execution Insights panel (Transparent Gameplay)
  const [showExecutionInsights, setShowExecutionInsights] = useState(false);

  // Synergy configuration panel
  const [showSynergyPanel, setShowSynergyPanel] = useState(false);

  // Context Panel tab state (desktop right column)
  const [contextPanelTab, setContextPanelTab] = useState('insights');

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

  const rehearsalsThisWeek = executionState?.rehearsalsThisWeek ?? 0;
  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;
  const equipmentNeedsRepair = avgEquipment < 0.85;

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

  // Handle rehearsal
  const handleRehearsal = async () => {
    if (canRehearseToday()) {
      const result = await rehearse();
      if (result.success) {
        toast.success(`Rehearsal complete! +${result.data?.xpGained || 50} XP`);
      }
    }
  };

  // ============================================================================
  // RENDER: BENTO GRID LAYOUT - 100vh Fixed-Height HUD
  // ============================================================================

  return (
    <div className="h-screen w-full bg-surface overflow-hidden flex flex-col">
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
          TOP BAR (Fixed Height)
          ====================================================================== */}
      <TopBar
        profile={profile}
        seasonData={seasonData}
        weeksRemaining={weeksRemaining}
        currentWeek={currentWeek}
        formatSeasonName={formatSeasonName}
        engagementData={engagementData}
        unclaimedRewardsCount={unclaimedRewardsCount}
      />

      {/* ======================================================================
          MAIN CONTENT GRID (Fills remaining height)
          Mobile: Single column | Desktop: 2-column grid [1fr 380px]
          ====================================================================== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] overflow-hidden">

        {/* ================================================================
            CENTER COLUMN: The Cockpit (Scrollable internally)
            ================================================================ */}
        <div className="h-full overflow-y-auto p-4 space-y-4">

          {/* Corps Selector (if multiple) */}
          {hasMultipleCorps && (
            <div className="flex items-center gap-3">
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
                          ? 'bg-primary text-text-inverse border-amber-400 dark:border-gold-400 shadow-md'
                          : 'bg-white dark:bg-surface-secondary text-text-muted border-stone-200 dark:border-border-default hover:text-text-main hover:border-primary/50'
                      }`}
                    >
                      {corpsData.corpsName || corpsData.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {activeCorps && (
            <>
              {/* ============================================================
                  1. HEADER ROW: Corps Name + MultiplierGlassBoxLarge
                  ============================================================ */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="stadium-banner p-6 rounded-xl"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Corps Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                        {getCorpsClassName(activeCorpsClass)}
                      </span>
                      {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold-500/20 text-gold-400 text-[10px] font-bold uppercase">
                          <Crown size={10} />
                          TOP 10
                        </span>
                      )}
                      <button
                        onClick={() => setShowEditCorps(true)}
                        className="p-1 rounded hover:bg-white/10 text-cream-muted hover:text-gold-400 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    <h2 className="sports-header text-2xl md:text-3xl lg:text-4xl text-cream">
                      {activeCorps.corpsName || activeCorps.name || 'UNNAMED'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {typeof activeCorps.showConcept === 'object' && activeCorps.showConcept.theme ? (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gold-500/10 border border-gold-500/30 hover:bg-gold-500/20 transition-colors group"
                        >
                          <Sparkles className="w-3 h-3 text-gold-400" />
                          <span className="text-xs text-cream-muted group-hover:text-gold-400 transition-colors">
                            {activeCorps.showConcept.theme} • {activeCorps.showConcept.drillStyle}
                          </span>
                          {(executionState?.synergyBonus || 0) > 0 && (
                            <span className="text-xs font-mono font-bold text-gold-400">
                              +{(executionState?.synergyBonus || 0).toFixed(1)}
                            </span>
                          )}
                        </button>
                      ) : typeof activeCorps.showConcept === 'string' && activeCorps.showConcept ? (
                        <p className="text-cream-muted text-sm font-body italic">
                          "{activeCorps.showConcept}"
                        </p>
                      ) : (
                        <button
                          onClick={() => setShowSynergyPanel(true)}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-orange-400"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span className="text-xs">Configure Synergy</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Performance Multiplier - Glass Box */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <MultiplierGlassBoxLarge
                      multiplier={multiplier}
                      breakdown={{
                        readiness: (readiness - 0.80) * 0.60,
                        staff: assignedStaff?.length >= 6 ? 0.04 : assignedStaff?.length >= 4 ? 0.02 : -0.04,
                        equipment: (avgEquipment - 1.00) * 0.50,
                        travelCondition: ((executionState?.equipment?.bus || 0.90) + (executionState?.equipment?.truck || 0.90)) < 1.40 ? -0.03 : 0,
                        morale: (morale - 0.75) * 0.32,
                        showDifficulty: readiness >= (executionState?.showDesign?.preparednessThreshold || 0.80)
                          ? (executionState?.showDesign?.ceilingBonus || 0.08)
                          : (executionState?.showDesign?.riskPenalty || -0.10),
                      }}
                      currentDay={currentDay}
                      showDifficulty={executionState?.showDesign}
                      avgReadiness={readiness}
                    />
                    <button
                      onClick={() => setShowExecutionInsights(true)}
                      className="mt-2 text-[9px] text-cream-muted hover:text-gold-400 uppercase tracking-wider flex items-center gap-1 transition-colors lg:hidden"
                    >
                      <ChevronRight size={10} />
                      Full Analysis
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* ============================================================
                  2. VITALS ROW: ClusterBar (Readiness), ClusterBar (Morale), TacticalGauge (Equip)
                  ============================================================ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Readiness - 4 Segment Cluster Bar */}
                <div className="glass-card p-4 rounded-xl">
                  <ClusterBar
                    type="readiness"
                    sections={typeof executionState?.readiness === 'object' ? executionState.readiness : {
                      brass: readiness,
                      percussion: readiness,
                      guard: readiness,
                      ensemble: readiness
                    }}
                  />
                </div>
                {/* Morale - 4 Segment Cluster Bar */}
                <div className="glass-card p-4 rounded-xl">
                  <ClusterBar
                    type="morale"
                    sections={typeof executionState?.morale === 'object' ? executionState.morale : {
                      brass: morale,
                      percussion: morale,
                      guard: morale,
                      overall: morale
                    }}
                  />
                </div>
                {/* Equipment - Single Gauge */}
                <div className="glass-card p-4 rounded-xl">
                  <TacticalGaugeWithInsight
                    value={avgEquipment}
                    color="orange"
                    label="Equipment"
                    icon={Wrench}
                    type="equipment"
                    equipment={executionState?.equipment}
                  />
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="flex flex-wrap items-center gap-4 px-2">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xl font-mono font-bold text-blue-400">{rehearsalsThisWeek}/7</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-display">This Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-mono font-bold text-purple-400">{showsThisWeek}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-display">Shows</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <ScoreBreakdownTooltip
                      baseScore={activeCorps.totalSeasonScore || 0}
                      multiplier={multiplier}
                      synergyBonus={executionState?.synergyBonus || 0}
                      finalScore={(activeCorps.totalSeasonScore || 0) * multiplier + (executionState?.synergyBonus || 0)}
                    >
                      <div className="text-center cursor-help hover:scale-105 transition-transform">
                        <div className="text-xl font-mono font-bold text-gold-400">
                          {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-[10px] text-text-muted uppercase tracking-widest font-display">Score</div>
                      </div>
                    </ScoreBreakdownTooltip>
                  )}
                  <StaffEffectivenessTooltip
                    assignedStaff={assignedStaff}
                    totalImpact={assignedStaff?.length >= 6 ? 0.04 : assignedStaff?.length >= 4 ? 0.02 : -0.04}
                  >
                    <div className="text-center cursor-help hover:scale-105 transition-transform">
                      <div className="text-xl font-mono font-bold text-green-400">{assignedStaff.length}/8</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-widest font-display">Staff</div>
                    </div>
                  </StaffEffectivenessTooltip>
                  {/* Difficulty Confidence Badge */}
                  <ConfidenceBadge
                    currentDifficulty={executionState?.showDesign || 'moderate'}
                    currentReadiness={readiness}
                    onClick={() => setShowExecutionInsights(true)}
                  />
                </div>
              </div>

              {/* ============================================================
                  3. ACTION GRID: Rehearse, Staff, Equipment, Synergy, Activities
                  ============================================================ */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

                {/* Synergy Panel */}
                <IconCard
                  icon={Sparkles}
                  label="Synergy"
                  subtitle={activeCorps?.showConcept?.theme ? `+${(executionState?.synergyBonus || 0).toFixed(1)} pts` : 'Configure'}
                  onClick={() => setShowSynergyPanel(true)}
                />

                {/* Daily Activities */}
                <IconCard
                  icon={Zap}
                  label="Activities"
                  subtitle="Daily Tasks"
                  onClick={() => setShowDailyActivities(true)}
                />
              </div>

              {/* ============================================================
                  4. STATS ROW: Weekly Progress
                  ============================================================ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

              {/* ============================================================
                  5. QUICK LINKS ROW
                  ============================================================ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  to="/scores"
                  className="card-brutalist p-4 flex items-center gap-3 transition-all hover:scale-[1.02]"
                >
                  <div className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/30 flex-shrink-0">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display font-bold text-text-main text-sm truncate">Leaderboards</span>
                  <ChevronRight className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" />
                </Link>
                <Link
                  to="/schedule"
                  className="card-brutalist p-4 flex items-center gap-3 transition-all hover:scale-[1.02]"
                >
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 flex-shrink-0">
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-display font-bold text-text-main text-sm truncate">Schedule</span>
                  <ChevronRight className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" />
                </Link>
                <Link
                  to="/leagues"
                  className="card-brutalist p-4 flex items-center gap-3 transition-all hover:scale-[1.02]"
                >
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-display font-bold text-text-main text-sm truncate">Leagues</span>
                  <ChevronRight className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" />
                </Link>
                <Link
                  to="/battlepass"
                  className="card-brutalist p-4 flex items-center gap-3 transition-all hover:scale-[1.02]"
                >
                  <div className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/30 flex-shrink-0">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display font-bold text-text-main text-sm truncate">Season Pass</span>
                  <ChevronRight className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" />
                </Link>
              </div>

              {/* SoundSport Fun Badge */}
              {activeCorpsClass === 'soundSport' && (
                <div className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-green-500/10 border-2 border-green-500/30 text-green-600 dark:text-green-400">
                  <Sparkles size={20} />
                  <span className="font-display font-bold">SoundSport is non-competitive - just have fun!</span>
                </div>
              )}
            </>
          )}

          {/* No Corps State */}
          {!activeCorps && !showSeasonSetupWizard && (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <Music className="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" />
                <h2 className="text-xl font-display font-bold text-text-main mb-2">No Corps Registered</h2>
                <p className="text-text-muted mb-4">Create your first corps to begin your journey!</p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="btn-primary"
                >
                  Register Corps
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            RIGHT COLUMN: Context Panel (Fixed Width 380px, Scrollable internally)
            Hidden on mobile - use slide-out panels instead
            ================================================================ */}
        <div className="hidden lg:flex flex-col h-full border-l border-border-default bg-surface-secondary overflow-hidden">
          {/* Context Panel Tabs */}
          <div className="flex border-b border-border-default shrink-0">
            <button
              onClick={() => setContextPanelTab('insights')}
              className={`flex-1 px-4 py-3 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                contextPanelTab === 'insights'
                  ? 'text-gold-600 dark:text-gold-400 border-b-2 border-gold-500 bg-gold-500/5'
                  : 'text-text-muted hover:text-text-main hover:bg-stone-50 dark:hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Insights
              </div>
            </button>
            <button
              onClick={() => setContextPanelTab('staff')}
              className={`flex-1 px-4 py-3 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                contextPanelTab === 'staff'
                  ? 'text-gold-600 dark:text-gold-400 border-b-2 border-gold-500 bg-gold-500/5'
                  : 'text-text-muted hover:text-text-main hover:bg-stone-50 dark:hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Staff
              </div>
            </button>
            <button
              onClick={() => setContextPanelTab('equipment')}
              className={`flex-1 px-4 py-3 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                contextPanelTab === 'equipment'
                  ? 'text-gold-600 dark:text-gold-400 border-b-2 border-gold-500 bg-gold-500/5'
                  : 'text-text-muted hover:text-text-main hover:bg-stone-50 dark:hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Wrench className="w-4 h-4" />
                Equip
              </div>
            </button>
            <button
              onClick={() => setContextPanelTab('synergy')}
              className={`flex-1 px-4 py-3 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                contextPanelTab === 'synergy'
                  ? 'text-gold-600 dark:text-gold-400 border-b-2 border-gold-500 bg-gold-500/5'
                  : 'text-text-muted hover:text-text-main hover:bg-stone-50 dark:hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Synergy
              </div>
            </button>
          </div>

          {/* Context Panel Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {contextPanelTab === 'insights' && (
                <motion.div
                  key="insights"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4 space-y-4"
                >
                  {/* Difficulty Confidence Meter */}
                  <div className="glass-dark rounded-xl p-4">
                    <DifficultyConfidenceMeter
                      currentDifficulty={executionState?.showDesign || 'moderate'}
                      currentReadiness={typeof readiness === 'number' ? readiness : 0.75}
                      currentDay={currentDay}
                      showSelector={false}
                      compact={true}
                    />
                  </div>

                  {/* Section Readiness Breakdown */}
                  <div className="glass-dark rounded-xl p-4">
                    <h4 className="text-xs font-display font-bold text-cream-muted uppercase tracking-wider mb-3">
                      Section Readiness
                    </h4>
                    <SegmentedMetricBar
                      type="readiness"
                      sections={typeof executionState?.readiness === 'object' ? executionState.readiness : {
                        brass: readiness || 0.75,
                        percussion: readiness || 0.75,
                        guard: readiness || 0.75,
                        ensemble: readiness || 0.75
                      }}
                      compact={true}
                    />
                  </div>

                  {/* Section Morale Breakdown */}
                  <div className="glass-dark rounded-xl p-4">
                    <h4 className="text-xs font-display font-bold text-cream-muted uppercase tracking-wider mb-3">
                      Section Morale
                    </h4>
                    <SegmentedMetricBar
                      type="morale"
                      sections={typeof executionState?.morale === 'object' ? executionState.morale : {
                        brass: morale || 0.80,
                        percussion: morale || 0.80,
                        guard: morale || 0.80,
                        overall: morale || 0.80
                      }}
                      compact={true}
                    />
                  </div>

                  {/* View Full Analysis Button */}
                  <button
                    onClick={() => setShowExecutionInsights(true)}
                    className="w-full py-3 px-4 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400 hover:bg-gold-500/20 transition-colors font-display font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Full Analysis Panel
                  </button>
                </motion.div>
              )}

              {contextPanelTab === 'staff' && (
                <motion.div
                  key="staff"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4"
                >
                  <DashboardStaffPanel activeCorpsClass={activeCorpsClass} />
                </motion.div>
              )}

              {contextPanelTab === 'equipment' && (
                <motion.div
                  key="equipment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4"
                >
                  <EquipmentManager
                    equipment={executionState?.equipment}
                    onRepair={repairEquipment}
                    onUpgrade={upgradeEquipment}
                    processing={executionProcessing}
                    corpsCoin={profile?.corpsCoin || 0}
                  />
                </motion.div>
              )}

              {contextPanelTab === 'synergy' && (
                <motion.div
                  key="synergy"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4"
                >
                  <ShowConceptSelector
                    corpsClass={activeCorpsClass}
                    currentConcept={typeof activeCorps?.showConcept === 'object' ? activeCorps.showConcept : {}}
                    onSave={() => {
                      refreshProfile();
                      toast.success('Show concept synergy updated!');
                    }}
                    compact={true}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ======================================================================
          SLIDE-OUT PANELS (Mobile Only)
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
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-border-default p-4 flex items-center justify-between z-10">
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
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-border-default p-4 flex items-center justify-between z-10">
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
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-border-default p-4 flex items-center justify-between z-10">
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

      {/* Synergy Panel */}
      <AnimatePresence>
        {showSynergyPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSynergyPanel(false)}
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface border-l border-stone-200 dark:border-border-default z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-surface border-b border-stone-200 dark:border-border-default p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-text-main uppercase tracking-tight">Show Concept Synergy</h2>
                <button
                  onClick={() => setShowSynergyPanel(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-surface-secondary text-text-muted hover:text-text-main transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <ShowConceptSelector
                  corpsClass={activeCorpsClass}
                  currentConcept={typeof activeCorps?.showConcept === 'object' ? activeCorps.showConcept : {}}
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
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-surface border-l border-stone-200 dark:border-border-default z-50 overflow-hidden"
            >
              <ExecutionInsightsPanel
                executionState={executionState}
                multiplierBreakdown={{
                  readiness: (executionState?.readiness || 0.75) - 0.75 > 0 ? ((executionState?.readiness || 0.75) - 0.75) * 0.48 : ((executionState?.readiness || 0.75) - 0.75) * 0.48,
                  morale: (executionState?.morale || 0.80) - 0.80 > 0 ? ((executionState?.morale || 0.80) - 0.80) * 0.32 : ((executionState?.morale || 0.80) - 0.80) * 0.32,
                  equipment: ((executionState?.equipment?.instruments || 0.90) + (executionState?.equipment?.uniforms || 0.90) + (executionState?.equipment?.props || 0.90)) / 3 - 0.90 > 0 ? (((executionState?.equipment?.instruments || 0.90) + (executionState?.equipment?.uniforms || 0.90) + (executionState?.equipment?.props || 0.90)) / 3 - 0.90) * 0.20 : (((executionState?.equipment?.instruments || 0.90) + (executionState?.equipment?.uniforms || 0.90) + (executionState?.equipment?.props || 0.90)) / 3 - 0.90) * 0.20,
                  staff: assignedStaff?.length >= 6 ? 0.04 : assignedStaff?.length >= 4 ? 0.02 : -0.04,
                  showDifficulty: executionState?.showDesign?.ceilingBonus || 0,
                  travelCondition: ((executionState?.equipment?.bus || 0.90) + (executionState?.equipment?.truck || 0.90)) < 1.40 ? -0.03 : 0,
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
