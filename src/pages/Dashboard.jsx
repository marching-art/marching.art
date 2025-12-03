// src/pages/Dashboard.jsx
// UI/UX Overhaul: "Refined Brutalism meets Luxury Sports Analytics"
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, ChevronRight, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift
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
// BRUTALIST DESIGN COMPONENTS
// ============================================================================

// Chunky Progress Bar Component
const ChunkyProgressBar = ({ value, color = 'gold', label, icon: Icon }) => {
  const percentage = Math.round(value * 100);
  const colorClasses = {
    gold: 'bg-gold-500',
    blue: 'bg-blue-500',
    red: 'bg-rose-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#FAF6EA]" />}
          <span className="text-xs font-display font-bold uppercase tracking-widest text-[#FAF6EA]/60">
            {label}
          </span>
        </div>
        <span className="text-lg font-mono font-bold text-gold-500">{percentage}%</span>
      </div>
      <div className="progress-chunky">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`progress-chunky-fill ${colorClasses[color]}`}
        />
      </div>
    </div>
  );
};

// Action Tile Component (Square interactive tiles)
const ActionTile = ({ icon: Icon, label, subtitle, onClick, disabled, processing, completed }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled || processing}
    whileHover={!disabled && !processing ? { scale: 1.02, y: -3 } : {}}
    whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
    className={`tile-action group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${completed ? 'border-green-500/50' : ''}`}
  >
    <div className={`p-3 rounded-xl transition-colors ${completed ? 'bg-green-500/20' : 'bg-gold-500/10 group-hover:bg-transparent'}`}>
      {processing ? (
        <div className="w-8 h-8 border-3 border-gold-500 border-t-transparent rounded-full animate-spin" />
      ) : completed ? (
        <Check className="w-8 h-8 text-green-500" />
      ) : (
        <Icon className="w-8 h-8 tile-icon text-gold-500 transition-colors" />
      )}
    </div>
    <span className="tile-label text-sm font-display font-bold text-[#FAF6EA] transition-colors text-center">
      {label}
    </span>
    {subtitle && (
      <span className="text-[10px] text-[#FAF6EA]/40 group-hover:text-charcoal-900/60 transition-colors">
        {subtitle}
      </span>
    )}
  </motion.button>
);

// Quick Stat Card
const QuickStatCard = ({ icon: Icon, label, value, color = 'gold', to }) => {
  const colorClasses = {
    gold: 'text-gold-500 bg-gold-500/10 border-gold-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30'
  };

  const content = (
    <div className={`card-brutalist p-4 flex items-center gap-3 ${to ? 'cursor-pointer' : ''}`}>
      <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
        <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[0]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xl font-mono font-bold ${colorClasses[color].split(' ')[0]}`}>
          {value}
        </div>
        <div className="text-[10px] font-display uppercase tracking-widest text-[#FAF6EA]/40">
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

  // Get multiplier status
  const getMultiplierStatus = () => {
    if (multiplier >= 1.05) return { color: 'text-green-400', bg: 'bg-green-500', label: 'ELITE' };
    if (multiplier >= 0.95) return { color: 'text-gold-500', bg: 'bg-gold-500', label: 'STRONG' };
    if (multiplier >= 0.85) return { color: 'text-yellow-400', bg: 'bg-yellow-500', label: 'FAIR' };
    return { color: 'text-red-400', bg: 'bg-red-500', label: 'WEAK' };
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
    <div className="space-y-6 relative z-10">
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
            <h1 className="text-2xl md:text-3xl font-display font-black text-[#FAF6EA] uppercase tracking-tight truncate">
              {profile?.displayName || 'Director'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[#FAF6EA]/60 text-sm font-display">
                {formatSeasonName(seasonData?.name)}
              </span>
              {weeksRemaining && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-bold">
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
                <Flame className={`w-5 h-5 ${engagementData.loginStreak >= 7 ? 'text-orange-400 animate-pulse' : 'text-orange-500'}`} />
                <span className="text-lg font-mono font-bold text-orange-400">
                  {engagementData.loginStreak}
                </span>
              </div>
            )}

            {/* XP Level */}
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold-500/20 border-2 border-gold-500/30 hover:border-gold-500/60 transition-all"
            >
              <Zap className="w-5 h-5 text-gold-500" />
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-gold-500">LVL {profile?.xpLevel || 1}</span>
                <div className="w-12 h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-500 transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </Link>

            {/* CorpsCoin */}
            <Link
              to="/staff"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold-500/20 border-2 border-gold-500/30 hover:border-gold-500/60 transition-all"
            >
              <Coins className="w-5 h-5 text-gold-500" />
              <span className="text-lg font-mono font-bold text-gold-500">
                {(profile?.corpsCoin || 0).toLocaleString()}
              </span>
            </Link>

            {/* Battle Pass Rewards */}
            {unclaimedRewardsCount > 0 && (
              <Link
                to="/battlepass"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gold-500/30 to-purple-500/30 border-2 border-gold-500/50 animate-pulse"
              >
                <Gift className="w-5 h-5 text-gold-400" />
                <span className="text-sm font-bold text-gold-400">{unclaimedRewardsCount}</span>
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
          <Music className="w-5 h-5 text-gold-500 flex-shrink-0" />
          <div className="flex items-center gap-2 overflow-x-auto scroll-hide pb-1">
            {Object.entries(corps)
              .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
              .map(([classId, corpsData]) => (
                <button
                  key={classId}
                  onClick={() => handleCorpsSwitch(classId)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all border-2 ${
                    activeCorpsClass === classId
                      ? 'bg-gold-500 text-charcoal-900 border-gold-400 shadow-brutal-gold'
                      : 'bg-[#1A1A1A] text-[#FAF6EA]/70 border-[#2A2A2A] hover:text-[#FAF6EA] hover:border-gold-500/50'
                  }`}
                >
                  {corpsData.corpsName || corpsData.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          MAIN BENTO GRID LAYOUT
          ====================================================================== */}
      {activeCorps && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

          {/* ================================================================
              HERO CARD: Corps Status (spans 8 columns on desktop)
              ================================================================ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-8 card-hero p-6 md:p-8"
          >
            {/* Watermark Trophy */}
            <div className="absolute top-4 right-4 opacity-5 pointer-events-none">
              <Trophy className="w-48 h-48" />
            </div>

            <div className="relative z-10">
              {/* Corps Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                {/* Corps Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded text-[10px] font-display font-black tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                      {getCorpsClassName(activeCorpsClass)}
                    </span>
                    {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/20 text-gold-400 text-[10px] font-bold">
                        <Crown size={10} />
                        TOP 10
                      </span>
                    )}
                  </div>
                  <h2 className="text-massive text-4xl md:text-5xl lg:text-6xl text-[#FAF6EA] mb-2">
                    {activeCorps.corpsName || activeCorps.name}
                  </h2>
                  {activeCorps.showConcept && (
                    <p className="text-[#FAF6EA]/60 text-lg font-display">
                      <span className="text-gold-500">"</span>
                      {activeCorps.showConcept}
                      <span className="text-gold-500">"</span>
                    </p>
                  )}
                </div>

                {/* Performance Multiplier - THE BIG NUMBER */}
                <div className="flex-shrink-0 text-center md:text-right bg-[#0D0D0D] p-6 rounded-2xl border-2 border-[#2A2A2A]">
                  <div className="text-[10px] text-[#FAF6EA]/40 uppercase tracking-[0.3em] font-display font-bold mb-2">
                    PERFORMANCE
                  </div>
                  <div className={`text-5xl md:text-6xl lg:text-7xl font-display font-black tabular-nums tracking-tighter ${multiplierStatus.color} multiplier-glow`}>
                    {multiplier.toFixed(2)}x
                  </div>
                  <div className={`text-sm font-display font-bold ${multiplierStatus.color} flex items-center justify-center md:justify-end gap-2 mt-2`}>
                    <TrendingUp size={16} />
                    {multiplierStatus.label}
                  </div>
                </div>
              </div>

              {/* Health Metrics - Chunky Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ChunkyProgressBar
                  value={readiness}
                  color="blue"
                  label="Readiness"
                  icon={Target}
                />
                <ChunkyProgressBar
                  value={morale}
                  color="red"
                  label="Morale"
                  icon={Heart}
                />
                <ChunkyProgressBar
                  value={avgEquipment}
                  color="orange"
                  label="Equipment"
                  icon={Wrench}
                />
              </div>

              {/* Quick Stats Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t-2 border-[#2A2A2A]">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-blue-400">{rehearsalsThisWeek}/7</div>
                    <div className="text-[10px] text-[#FAF6EA]/40 uppercase tracking-widest font-display">This Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-purple-400">{showsThisWeek}</div>
                    <div className="text-[10px] text-[#FAF6EA]/40 uppercase tracking-widest font-display">Shows</div>
                  </div>
                  {activeCorpsClass !== 'soundSport' && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-gold-500">
                        {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-[10px] text-[#FAF6EA]/40 uppercase tracking-widest font-display">Score</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-green-400">{assignedStaff.length}/8</div>
                    <div className="text-[10px] text-[#FAF6EA]/40 uppercase tracking-widest font-display">Staff</div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex items-center gap-2">
                  <Link
                    to="/schedule"
                    className="p-3 rounded-lg bg-[#1A1A1A] border-2 border-[#2A2A2A] hover:border-gold-500/50 text-[#FAF6EA]/60 hover:text-gold-500 transition-all"
                    title="View Schedule"
                  >
                    <Calendar size={20} />
                  </Link>
                  <Link
                    to="/scores"
                    className="p-3 rounded-lg bg-[#1A1A1A] border-2 border-[#2A2A2A] hover:border-gold-500/50 text-[#FAF6EA]/60 hover:text-gold-500 transition-all"
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
          <div className="lg:col-span-4 grid grid-cols-2 gap-4">
            {/* Daily Rehearsal */}
            <ActionTile
              icon={Music}
              label="Rehearse"
              subtitle="+5% Ready"
              onClick={handleRehearsal}
              disabled={!canRehearseToday()}
              processing={executionProcessing}
              completed={!canRehearseToday()}
            />

            {/* Staff Panel */}
            <ActionTile
              icon={Users}
              label="Staff"
              subtitle={`${assignedStaff.length}/8 Assigned`}
              onClick={() => {
                setShowStaffPanel(true);
                completeDailyChallenge('staff_meeting');
              }}
            />

            {/* Equipment Panel */}
            <ActionTile
              icon={Wrench}
              label="Equipment"
              subtitle={equipmentNeedsRepair ? 'Needs Repair!' : `${Math.round(avgEquipment * 100)}%`}
              onClick={() => {
                setShowEquipmentPanel(true);
                completeDailyChallenge('maintain_equipment');
              }}
            />

            {/* Daily Activities */}
            <ActionTile
              icon={Zap}
              label="Activities"
              subtitle="Daily Tasks"
              onClick={() => setShowDailyActivities(true)}
            />
          </div>

          {/* ================================================================
              SECONDARY ROW: Weekly Progress & Quick Stats
              ================================================================ */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* ================================================================
              QUICK LINKS ROW
              ================================================================ */}
          <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/scores"
              className="card-brutalist p-4 flex items-center gap-3 hover:shadow-brutal-gold transition-all"
            >
              <Trophy className="w-6 h-6 text-gold-500" />
              <span className="font-display font-bold text-[#FAF6EA]">Leaderboards</span>
              <ChevronRight className="w-5 h-5 text-[#FAF6EA]/40 ml-auto" />
            </Link>
            <Link
              to="/schedule"
              className="card-brutalist p-4 flex items-center gap-3 hover:shadow-brutal-gold transition-all"
            >
              <Calendar className="w-6 h-6 text-purple-400" />
              <span className="font-display font-bold text-[#FAF6EA]">Schedule</span>
              <ChevronRight className="w-5 h-5 text-[#FAF6EA]/40 ml-auto" />
            </Link>
            <Link
              to="/leagues"
              className="card-brutalist p-4 flex items-center gap-3 hover:shadow-brutal-gold transition-all"
            >
              <Sparkles className="w-6 h-6 text-blue-400" />
              <span className="font-display font-bold text-[#FAF6EA]">Leagues</span>
              <ChevronRight className="w-5 h-5 text-[#FAF6EA]/40 ml-auto" />
            </Link>
            <Link
              to="/battlepass"
              className="card-brutalist p-4 flex items-center gap-3 hover:shadow-brutal-gold transition-all"
            >
              <Crown className="w-6 h-6 text-gold-500" />
              <span className="font-display font-bold text-[#FAF6EA]">Season Pass</span>
              <ChevronRight className="w-5 h-5 text-[#FAF6EA]/40 ml-auto" />
            </Link>
          </div>

        </div>
      )}

      {/* SoundSport Fun Badge */}
      {activeCorpsClass === 'soundSport' && (
        <div className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-green-500/10 border-2 border-green-500/30 text-green-400">
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
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0D0D0D] border-l-3 border-[#2A2A2A] z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-[#0D0D0D] border-b-2 border-[#2A2A2A] p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-[#FAF6EA] uppercase tracking-tight">Equipment Manager</h2>
                <button
                  onClick={() => setShowEquipmentPanel(false)}
                  className="p-2 rounded-lg hover:bg-[#1A1A1A] text-[#FAF6EA]/60 hover:text-[#FAF6EA] transition-colors"
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
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0D0D0D] border-l-3 border-[#2A2A2A] z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-[#0D0D0D] border-b-2 border-[#2A2A2A] p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-[#FAF6EA] uppercase tracking-tight">Staff Roster</h2>
                <button
                  onClick={() => setShowStaffPanel(false)}
                  className="p-2 rounded-lg hover:bg-[#1A1A1A] text-[#FAF6EA]/60 hover:text-[#FAF6EA] transition-colors"
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
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0D0D0D] border-l-3 border-[#2A2A2A] z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-[#0D0D0D] border-b-2 border-[#2A2A2A] p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-display font-black text-[#FAF6EA] uppercase tracking-tight">Daily Activities</h2>
                <button
                  onClick={() => setShowDailyActivities(false)}
                  className="p-2 rounded-lg hover:bg-[#1A1A1A] text-[#FAF6EA]/60 hover:text-[#FAF6EA] transition-colors"
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
