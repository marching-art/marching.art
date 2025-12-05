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
  DailyOperations,
  RichActionModule
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { retireCorps } from '../firebase/functions';

// ============================================================================
// DENSE BENTO-GRID HUD COMPONENTS
// "Rack" style widgets with glassmorphism and tight spacing
// ============================================================================

// Glassmorphism Widget wrapper - consistent styling for all bento cells
const Widget = ({ children, className = '', noPadding = false }) => (
  <div className={`
    bg-black/50 backdrop-blur-md
    border border-white/10
    rounded-lg overflow-hidden
    ${noPadding ? '' : 'p-3'}
    ${className}
  `}>
    {children}
  </div>
);

// Compact Action Tile - Square clickable tile for actions grid
const ActionTile = ({ icon: Icon, label, subtitle, onClick, disabled, processing, completed, color = 'gold' }) => {
  const colorClasses = {
    gold: 'text-gold-400 bg-gold-500/20 border-gold-500/30 hover:bg-gold-500/30',
    blue: 'text-blue-400 bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30',
    green: 'text-green-400 bg-green-500/20 border-green-500/30 hover:bg-green-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || processing}
      whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
      whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
      className={`
        h-full w-full flex flex-col items-center justify-center gap-1.5
        bg-black/50 backdrop-blur-md border border-white/10 rounded-lg
        transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'}
        ${completed ? 'border-green-500/40 bg-green-500/10' : ''}
      `}
    >
      <div className={`p-2 rounded-lg ${completed ? 'bg-green-500/20' : colorClasses[color]}`}>
        {processing ? (
          <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        ) : completed ? (
          <Check className="w-5 h-5 text-green-400" />
        ) : (
          <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[0]}`} />
        )}
      </div>
      <span className="text-[10px] font-display font-bold text-cream uppercase tracking-wide text-center leading-tight">
        {label}
      </span>
      {subtitle && (
        <span className="text-[8px] text-data-muted">
          {subtitle}
        </span>
      )}
    </motion.button>
  );
};

// Compact Stat Pill - For inline stats display
const StatPill = ({ icon: Icon, value, label, color = 'gold' }) => {
  const colorClasses = {
    gold: 'text-data-gold',
    blue: 'text-data-blue',
    green: 'text-data-success',
    purple: 'text-data-purple',
    orange: 'text-data-orange',
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded border border-white/10">
      <Icon className={`w-3 h-3 ${color === 'gold' ? 'text-gold-400' : color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : 'text-orange-400'}`} />
      <span className={`text-xs font-bold ${colorClasses[color]}`}>{value}</span>
      <span className="text-[9px] text-cream/40 uppercase">{label}</span>
    </div>
  );
};

// Compact Progress Bar - Reduced height for dense layout
const CompactProgressBar = ({ value, label, color = 'gold', showPercent = true }) => {
  const bgClasses = {
    gold: 'bg-gold-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };

  const textDataClasses = {
    gold: 'text-data-gold',
    blue: 'text-data-blue',
    green: 'text-data-success',
    purple: 'text-data-purple',
    orange: 'text-data-orange',
    red: 'text-data-error',
  };

  const percent = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-display font-bold text-cream/60 uppercase tracking-wide w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${bgClasses[color]} rounded-full`}
        />
      </div>
      {showPercent && (
        <span className={`text-[10px] font-bold w-8 text-right ${textDataClasses[color]}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

// Quick Link Tile - For navigation actions
const QuickLinkTile = ({ to, icon: Icon, label, color = 'gold' }) => {
  const colorClasses = {
    gold: 'text-gold-400 hover:bg-gold-500/20',
    blue: 'text-blue-400 hover:bg-blue-500/20',
    green: 'text-green-400 hover:bg-green-500/20',
    purple: 'text-purple-400 hover:bg-purple-500/20',
  };

  return (
    <Link
      to={to}
      className={`
        flex items-center gap-2 px-3 py-2
        bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg
        transition-all hover:border-white/20
        ${colorClasses[color]}
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="text-xs font-display font-bold uppercase tracking-wide text-cream">{label}</span>
      <ChevronRight className="w-3 h-3 ml-auto text-cream/40" />
    </Link>
  );
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
// SYSTEM BOOT ANIMATION VARIANTS
// Mechanical, snappy feel with staggered timing
// ===========================================================================
const bootEase = [0.25, 0.1, 0.25, 1.0]; // Mechanical ease

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: bootEase,
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: bootEase },
  },
};

const insightsVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: bootEase, delay: 0.1 },
  },
};

const statusVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: bootEase, delay: 0.2 },
  },
};

const actionsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: bootEase,
      delay: 0.25,
      staggerChildren: 0.05,
      delayChildren: 0.3,
    },
  },
};

const actionTileVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: bootEase },
  },
};

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
  // RENDER: DENSE BENTO-GRID LAYOUT - 12x6 Fixed-Height Command Center
  // No scrolling required - everything fits in viewport
  // ============================================================================

  return (
    <div className="h-full w-full overflow-hidden">
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
          BENTO GRID: 12-column, 6-row dense layout
          - Hero (cols 1-8, rows 1-2)
          - Insights Panel (cols 9-12, rows 1-6) - Full height sidebar
          - Status Bars (cols 1-8, row 3)
          - Quick Actions (cols 1-8, rows 4-6)
          ====================================================================== */}
      <motion.div
        className="h-full w-full grid grid-cols-12 grid-rows-6 gap-2 p-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        {/* ================================================================
            HERO SECTION (cols 1-8, rows 1-2)
            Compact corps header with multiplier
            ================================================================ */}
        <motion.div variants={heroVariants} className="col-span-12 lg:col-span-8 row-span-2">
        <Widget className="h-full flex flex-col" noPadding>
          {activeCorps ? (
            <div className="h-full flex flex-col p-3">
              {/* Top row: Corps selector + User stats */}
              <div className="flex items-center justify-between gap-3 mb-2">
                {/* Corps selector or single corps badge */}
                <div className="flex items-center gap-2 min-w-0">
                  {hasMultipleCorps ? (
                    <div className="flex items-center gap-1 overflow-x-auto scroll-hide">
                      {Object.entries(corps)
                        .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                        .map(([classId, corpsData]) => (
                          <button
                            key={classId}
                            onClick={() => handleCorpsSwitch(classId)}
                            className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wide transition-all ${
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
                    <span className={`px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-widest ${classColors[activeCorpsClass]}`}>
                      {getCorpsClassName(activeCorpsClass)}
                    </span>
                  )}
                  {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 text-[9px] font-bold">
                      <Crown size={8} /> TOP 10
                    </span>
                  )}
                </div>

                {/* User stats pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {engagementData?.loginStreak > 0 && (
                    <StatPill icon={Flame} value={engagementData.loginStreak} label="streak" color="orange" />
                  )}
                  <StatPill icon={Zap} value={`L${profile?.xpLevel || 1}`} label="xp" color="gold" />
                  <StatPill icon={Coins} value={(profile?.corpsCoin || 0).toLocaleString()} label="" color="gold" />
                  {unclaimedRewardsCount > 0 && (
                    <Link to="/battlepass" className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded border border-purple-500/30 animate-pulse">
                      <Gift className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] font-bold text-purple-400">{unclaimedRewardsCount}</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Main hero content: Corps name + Multiplier */}
              <div className="flex-1 flex items-center justify-between gap-4 min-h-0">
                {/* Corps Identity - Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl lg:text-2xl xl:text-3xl font-display font-black text-cream uppercase tracking-tight truncate">
                      {activeCorps.corpsName || activeCorps.name || 'UNNAMED'}
                    </h1>
                    <button
                      onClick={() => setShowEditCorps(true)}
                      className="p-1 rounded hover:bg-white/10 text-cream/40 hover:text-gold-400 transition-colors shrink-0"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Show concept / synergy */}
                  <div className="flex items-center gap-2 mt-1">
                    {typeof activeCorps.showConcept === 'object' && activeCorps.showConcept.theme ? (
                      <button
                        onClick={() => setShowSynergyPanel(true)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 transition-colors group"
                      >
                        <Sparkles className="w-3 h-3 text-gold-400" />
                        <span className="text-[10px] text-cream/60 group-hover:text-gold-400">
                          {activeCorps.showConcept.theme}
                        </span>
                        {(executionState?.synergyBonus || 0) > 0 && (
                          <span className="text-[10px] font-bold text-data-gold">
                            +{(executionState?.synergyBonus || 0).toFixed(1)}
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowSynergyPanel(true)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px]"
                      >
                        <Sparkles className="w-3 h-3" /> Configure
                      </button>
                    )}
                    {/* Season info */}
                    <span className="text-[10px] text-cream/40">
                      {formatSeasonName(seasonData?.name)} • Week {currentWeek}
                    </span>
                  </div>
                  {/* Quick stats inline */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="text-center">
                      <div className="text-sm font-bold text-data-blue">{rehearsalsThisWeek}/7</div>
                      <div className="text-[8px] text-cream/40 uppercase">Rehearsals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-data-purple">{showsThisWeek}</div>
                      <div className="text-[8px] text-cream/40 uppercase">Shows</div>
                    </div>
                    {activeCorpsClass !== 'soundSport' && (
                      <div className="text-center">
                        <div className="text-sm font-bold text-data-gold">{activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}</div>
                        <div className="text-[8px] text-cream/40 uppercase">Score</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm font-bold text-data-success">{assignedStaff.length}/8</div>
                      <div className="text-[8px] text-cream/40 uppercase">Staff</div>
                    </div>
                  </div>
                </div>

                {/* Performance Multiplier - Right */}
                <div className="shrink-0 flex flex-col items-center">
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
                </div>
              </div>
            </div>
          ) : (
            /* No Corps State */
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <Music className="w-12 h-12 mx-auto mb-3 text-cream/20" />
                <h2 className="text-lg font-display font-bold text-cream mb-1">No Corps Registered</h2>
                <p className="text-xs text-cream/50 mb-3">Create your first corps to begin!</p>
                <button onClick={() => setShowRegistration(true)} className="px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg text-sm font-bold">
                  Register Corps
                </button>
              </div>
            </div>
          )}
        </Widget>
        </motion.div>

        {/* ================================================================
            INSIGHTS PANEL (cols 9-12, rows 1-6) - Full height right sidebar
            No scrolling - tight vertical spacing
            ================================================================ */}
        <motion.div variants={insightsVariants} className="hidden lg:block col-span-4 row-span-6">
        <Widget className="h-full flex flex-col" noPadding>
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="shrink-0 px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-display font-bold text-cream/60 uppercase tracking-wider">Performance Insights</span>
              <button
                onClick={() => setShowExecutionInsights(true)}
                className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide"
              >
                Full Analysis →
              </button>
            </div>

            {/* Insights Content - No scroll, tight spacing */}
            <div className="flex-1 p-3 space-y-3 overflow-hidden">
              {/* Difficulty Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-cream/50 uppercase">Show Difficulty</span>
                <ConfidenceBadge
                  currentDifficulty={executionState?.showDesign || 'moderate'}
                  currentReadiness={readiness}
                  onClick={() => setShowExecutionInsights(true)}
                />
              </div>

              {/* Readiness Bars */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-display font-bold text-cream/50 uppercase tracking-wide">Readiness</span>
                <CompactProgressBar value={typeof executionState?.readiness === 'object' ? executionState.readiness.brass : readiness} label="Brass" color="blue" />
                <CompactProgressBar value={typeof executionState?.readiness === 'object' ? executionState.readiness.percussion : readiness} label="Perc" color="blue" />
                <CompactProgressBar value={typeof executionState?.readiness === 'object' ? executionState.readiness.guard : readiness} label="Guard" color="blue" />
                <CompactProgressBar value={typeof executionState?.readiness === 'object' ? executionState.readiness.ensemble : readiness} label="Ensemble" color="blue" />
              </div>

              {/* Morale Bars */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-display font-bold text-cream/50 uppercase tracking-wide">Morale</span>
                <CompactProgressBar value={typeof executionState?.morale === 'object' ? executionState.morale.brass : morale} label="Brass" color="green" />
                <CompactProgressBar value={typeof executionState?.morale === 'object' ? executionState.morale.percussion : morale} label="Perc" color="green" />
                <CompactProgressBar value={typeof executionState?.morale === 'object' ? executionState.morale.guard : morale} label="Guard" color="green" />
              </div>

              {/* Equipment Condition */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-display font-bold text-cream/50 uppercase tracking-wide">Equipment</span>
                <CompactProgressBar value={executionState?.equipment?.instruments || 0.90} label="Instruments" color={avgEquipment < 0.85 ? 'orange' : 'gold'} />
                <CompactProgressBar value={executionState?.equipment?.uniforms || 0.90} label="Uniforms" color={avgEquipment < 0.85 ? 'orange' : 'gold'} />
                <CompactProgressBar value={executionState?.equipment?.props || 0.90} label="Props" color={avgEquipment < 0.85 ? 'orange' : 'gold'} />
              </div>

              {/* Multiplier Factors */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <span className="text-[9px] font-display font-bold text-cream/50 uppercase tracking-wide">Multiplier Factors</span>
                <div className="grid grid-cols-2 gap-1 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-cream/40">Readiness</span>
                    <span className={readiness >= 0.80 ? 'text-data-success' : 'text-data-orange'}>
                      {readiness >= 0.80 ? '+' : ''}{((readiness - 0.80) * 0.60 * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/40">Morale</span>
                    <span className={morale >= 0.75 ? 'text-data-success' : 'text-data-orange'}>
                      {morale >= 0.75 ? '+' : ''}{((morale - 0.75) * 0.32 * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/40">Staff</span>
                    <span className={assignedStaff.length >= 4 ? 'text-data-success' : 'text-data-orange'}>
                      {assignedStaff.length >= 6 ? '+4%' : assignedStaff.length >= 4 ? '+2%' : '-4%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/40">Equipment</span>
                    <span className={avgEquipment >= 0.90 ? 'text-data-success' : 'text-data-orange'}>
                      {((avgEquipment - 1.00) * 0.50 * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Widget>
        </motion.div>

        {/* ================================================================
            STATUS BARS (cols 1-8, row 3) - Readiness/Morale module
            ================================================================ */}
        <motion.div variants={statusVariants} className="col-span-12 lg:col-span-8 row-span-1">
        <Widget className="h-full flex items-center">
          <div className="w-full grid grid-cols-3 gap-4">
            {/* Readiness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-display font-bold text-blue-400 uppercase tracking-wide">Readiness</span>
                <span className="text-xs font-bold text-data-blue">{Math.round(readiness * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readiness * 100}%` }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
            </div>
            {/* Morale */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-display font-bold text-green-400 uppercase tracking-wide">Morale</span>
                <span className="text-xs font-bold text-data-success">{Math.round(morale * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${morale * 100}%` }}
                  className="h-full bg-green-500 rounded-full"
                />
              </div>
            </div>
            {/* Equipment */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-display font-bold text-orange-400 uppercase tracking-wide">Equipment</span>
                <span className="text-xs font-bold text-data-orange">{Math.round(avgEquipment * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${avgEquipment * 100}%` }}
                  className={`h-full rounded-full ${avgEquipment < 0.85 ? 'bg-orange-500' : 'bg-gold-500'}`}
                />
              </div>
            </div>
          </div>
        </Widget>
        </motion.div>

        {/* ================================================================
            QUICK ACTIONS (cols 1-8, rows 4-6) - Rich 3x2 action grid
            Data-dense modules with inline graphics
            ================================================================ */}
        <motion.div
          variants={actionsContainerVariants}
          className="col-span-12 lg:col-span-8 row-span-3 grid grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-2"
        >
          {/* Row 1 */}
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={Music}
              label="Rehearse"
              onClick={handleRehearsal}
              disabled={!canRehearseToday()}
              processing={executionProcessing}
              completed={!canRehearseToday()}
              color="blue"
              moduleType="rehearse"
              moduleData={{
                currentReadiness: readiness,
                potentialGain: canRehearseToday() ? 0.05 : 0,
              }}
            />
          </motion.div>
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={Users}
              label="Staff"
              onClick={() => { setShowStaffPanel(true); completeDailyChallenge('staff_meeting'); }}
              color="green"
              moduleType="staff"
              moduleData={{
                filled: assignedStaff.length,
                max: 8,
              }}
            />
          </motion.div>
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={Wrench}
              label="Equipment"
              onClick={() => { setShowEquipmentPanel(true); completeDailyChallenge('maintain_equipment'); }}
              color={equipmentNeedsRepair ? 'orange' : 'gold'}
              moduleType="equipment"
              moduleData={{
                condition: avgEquipment,
              }}
            />
          </motion.div>

          {/* Row 2 */}
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={Sparkles}
              label="Synergy"
              onClick={() => setShowSynergyPanel(true)}
              color="purple"
              moduleType="synergy"
              moduleData={{
                bonus: executionState?.synergyBonus || 0,
                themeName: activeCorps?.showConcept?.theme || '',
              }}
            />
          </motion.div>
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={Zap}
              label="Activities"
              onClick={() => setShowDailyActivities(true)}
              color="gold"
              moduleType="activities"
              moduleData={{
                completed: dailyChallenges?.filter(c => c.completed)?.length || 0,
                total: dailyChallenges?.length || 3,
              }}
            />
          </motion.div>
          <motion.div variants={actionTileVariants}>
            <RichActionModule
              icon={BarChart3}
              label="Insights"
              onClick={() => setShowExecutionInsights(true)}
              color="blue"
              moduleType="insights"
              moduleData={{
                trend: recentScores?.length >= 2
                  ? (recentScores[0]?.totalScore > recentScores[1]?.totalScore ? 'up' : recentScores[0]?.totalScore < recentScores[1]?.totalScore ? 'down' : 'flat')
                  : 'flat',
                projectedScore: (activeCorps?.totalSeasonScore || 0) * multiplier || 62.5,
              }}
            />
          </motion.div>
        </motion.div>

      </motion.div>

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
