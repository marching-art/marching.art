// src/pages/DashboardCommandCenter.jsx
// UX/UI Overhaul: "Command Center" Strategy Game Interface
// Zero-scroll, high-density HUD for 1080p viewport
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  Zap, Music, Users, Wrench, Heart, Target, Trophy, Calendar,
  TrendingUp, ChevronRight, Play, Check, X, Crown, Flame, Coins,
  Sparkles, Gift, Edit, Home, ShoppingBag, Award, Star, Clock,
  ChevronDown, MoreHorizontal, ArrowUp, ArrowDown, Minus,
  AlertTriangle, CheckCircle, Circle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../App';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { retireCorps } from '../firebase/functions';

// ============================================================================
// MICRO COMPONENTS - Dense, Information-Rich UI Elements
// ============================================================================

// Compact inline progress bar (no label, just bar + value)
const MicroGauge = ({ value, color = 'gold', label, size = 'md' }) => {
  const percentage = Math.round(value * 100);
  const colors = {
    gold: { bar: 'bg-gold-500', text: 'text-gold-400', glow: 'shadow-[0_0_8px_rgba(250,204,21,0.4)]' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-400', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.4)]' },
    red: { bar: 'bg-rose-500', text: 'text-rose-400', glow: 'shadow-[0_0_8px_rgba(244,63,94,0.4)]' },
    orange: { bar: 'bg-orange-500', text: 'text-orange-400', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.4)]' },
    green: { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' },
    purple: { bar: 'bg-purple-500', text: 'text-purple-400', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.4)]' },
  };
  const c = colors[color];
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' };

  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && <span className="text-[10px] uppercase tracking-wider text-cream-muted font-display shrink-0">{label}</span>}
      <div className={`flex-1 ${heights[size]} bg-white/10 rounded-full overflow-hidden min-w-[40px]`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full ${c.bar} ${c.glow} rounded-full`}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${c.text} tabular-nums shrink-0`}>{percentage}%</span>
    </div>
  );
};

// Multiplier badge - compact pill
const MultiplierBadge = ({ value }) => {
  const getStatus = () => {
    if (value >= 1.05) return { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', label: 'ELITE' };
    if (value >= 0.95) return { color: 'bg-gold-500/20 text-gold-400 border-gold-500/40', label: 'STRONG' };
    if (value >= 0.85) return { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', label: 'FAIR' };
    return { color: 'bg-rose-500/20 text-rose-400 border-rose-500/40', label: 'WEAK' };
  };
  const status = getStatus();

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${status.color}`}>
      <span className="text-lg font-mono font-bold tabular-nums">{value.toFixed(2)}x</span>
      <span className="text-[9px] uppercase tracking-wider font-display">{status.label}</span>
    </div>
  );
};

// Week day strip - shows 7-day progress
const WeekStrip = ({ rehearsalsThisWeek = 0, shows = [], currentDay = new Date().getDay() }) => {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="flex items-center gap-1">
      {days.map((day, i) => {
        const hasShow = shows.includes(i);
        const hasRehearsed = i < rehearsalsThisWeek;
        const isToday = i === currentDay;

        return (
          <div
            key={i}
            className={`
              w-7 h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold
              transition-all relative
              ${isToday ? 'ring-1 ring-gold-400/60' : ''}
              ${hasShow ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' :
                hasRehearsed ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' :
                i <= currentDay ? 'bg-white/5 text-cream-muted border border-white/10' :
                'bg-white/5 text-cream-muted/50 border border-white/5'}
            `}
            title={hasShow ? 'Show Day' : hasRehearsed ? 'Rehearsed' : ''}
          >
            {hasShow ? '🎭' : hasRehearsed ? '✓' : day}
          </div>
        );
      })}
    </div>
  );
};

// Stat pill - compact inline stat
const StatPill = ({ icon: Icon, value, label, color = 'gold', trend }) => {
  const colors = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-rose-400',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <Icon className={`w-3.5 h-3.5 ${colors[color]}`} />
      <span className={`text-sm font-mono font-bold ${colors[color]} tabular-nums`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-cream-muted">{label}</span>
      {trend !== undefined && (
        <span className={`text-[10px] font-mono ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-cream-muted'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '–'}
        </span>
      )}
    </div>
  );
};

// Action button - compact HUD style
const ActionButton = ({ icon: Icon, label, onClick, disabled, processing, completed, variant = 'default' }) => {
  const variants = {
    default: 'bg-white/5 border-white/15 hover:border-gold-500/50 text-cream hover:text-gold-400',
    primary: 'bg-gold-500/20 border-gold-500/40 hover:border-gold-500 text-gold-400 hover:bg-gold-500/30',
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    danger: 'bg-rose-500/20 border-rose-500/40 hover:border-rose-500 text-rose-400',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || processing}
      whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
      whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
      className={`
        w-full flex items-center justify-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-2 lg:py-2.5 rounded-lg border transition-all
        ${completed ? variants.success : variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {processing ? (
        <RefreshCw className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" />
      ) : completed ? (
        <CheckCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      ) : (
        <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      )}
      <span className="text-[10px] lg:text-xs font-display font-bold uppercase tracking-wider">{label}</span>
    </motion.button>
  );
};

// Staff row - dense table row
const StaffRow = ({ staff, onUnassign }) => {
  const roleIcons = {
    brass: '🎺',
    visual: '🎨',
    percussion: '🥁',
    guard: '🚩',
    admin: '📋',
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
      <span className="text-base">{roleIcons[staff.role] || '👤'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-display font-semibold text-cream truncate">{staff.name}</div>
        <div className="text-[10px] text-cream-muted uppercase tracking-wider">{staff.role}</div>
      </div>
      <div className="text-right">
        <div className="text-xs font-mono font-bold text-emerald-400">+{(staff.boost * 100).toFixed(0)}%</div>
        <div className="text-[10px] text-cream-muted">${staff.salary}/wk</div>
      </div>
      <button
        onClick={() => onUnassign?.(staff.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-cream-muted hover:text-rose-400 transition-all"
        title="Unassign"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

// Empty staff slot
const EmptyStaffSlot = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 hover:border-gold-500/50 text-cream-muted hover:text-gold-400 transition-all"
  >
    <Users className="w-4 h-4" />
    <span className="text-xs font-display uppercase tracking-wider">Hire Staff</span>
  </button>
);

// Equipment item row
const EquipmentRow = ({ name, icon, condition, level, maxLevel, onRepair, onUpgrade, repairing }) => {
  const needsRepair = condition < 0.85;
  const canUpgrade = level < maxLevel;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-semibold text-cream">{name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cream-muted font-mono">Lv.{level}</span>
        </div>
        <MicroGauge
          value={condition}
          color={condition >= 0.9 ? 'green' : condition >= 0.7 ? 'orange' : 'red'}
          size="sm"
        />
      </div>
      <div className="flex items-center gap-1">
        {needsRepair && (
          <button
            onClick={onRepair}
            disabled={repairing}
            className="p-1.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 transition-all disabled:opacity-50"
            title="Repair"
          >
            {repairing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
          </button>
        )}
        {canUpgrade && (
          <button
            onClick={onUpgrade}
            className="p-1.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 transition-all"
            title="Upgrade"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// Daily task checkbox
const DailyTask = ({ task, completed, onComplete }) => (
  <button
    onClick={() => !completed && onComplete?.(task.id)}
    disabled={completed}
    className={`
      flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full text-left
      ${completed
        ? 'bg-emerald-500/10 border border-emerald-500/30'
        : 'bg-white/5 border border-white/10 hover:border-gold-500/30'}
    `}
  >
    {completed ? (
      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
    ) : (
      <Circle className="w-4 h-4 text-cream-muted shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <span className={`text-xs font-display ${completed ? 'text-emerald-400 line-through' : 'text-cream'}`}>
        {task.label}
      </span>
    </div>
    {!completed && task.reward && (
      <span className="text-[10px] text-gold-400 font-mono">+{task.reward}</span>
    )}
  </button>
);

// Navigation rail item
const NavItem = ({ icon: Icon, label, to, active, badge }) => (
  <Link
    to={to}
    className={`
      relative flex flex-col items-center gap-1 px-2 py-3 rounded-lg transition-all
      ${active
        ? 'bg-gold-500/20 text-gold-400 border border-gold-500/40'
        : 'text-cream-muted hover:text-cream hover:bg-white/5 border border-transparent'}
    `}
    title={label}
  >
    <Icon className="w-5 h-5" />
    <span className="text-[9px] font-display uppercase tracking-wider">{label}</span>
    {badge && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
        {badge}
      </span>
    )}
  </Link>
);

// ============================================================================
// MOBILE HUD COMPONENTS - Compact, dense UI for small screens
// ============================================================================

// Mobile-specific compact status bar row
const MobileStatusRow = ({ seasonData, weeksRemaining, currentWeek, profile, formatSeasonName }) => {
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  return (
    <div className="lg:hidden shrink-0 px-3 py-2 bg-black/50 backdrop-blur-md border-b border-white/10">
      {/* Row 1: Season & Time | Level & Coins */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-cream font-display font-medium truncate">
            {formatSeasonName(seasonData?.name)}
          </span>
          {weeksRemaining && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono shrink-0">
              <Clock className="w-3 h-3" />
              Wk {currentWeek} • {weeksRemaining}w left
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Level with progress bar */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/20 border border-gold-500/30">
            <Zap className="w-3 h-3 text-gold-500" />
            <span className="font-mono font-bold text-gold-400">Lv.{profile?.xpLevel || 1}</span>
            <div className="w-10 h-1 bg-charcoal-800 rounded-full overflow-hidden">
              <div className="h-full bg-gold-500" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
          {/* Coins */}
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gold-500/20 border border-gold-500/30">
            <Trophy className="w-3 h-3 text-gold-500" />
            <span className="font-mono font-bold text-gold-400">{(profile?.corpsCoin || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mobile Corps Tabs - Horizontal scrolling
const MobileCorpsTabs = ({ corps, activeCorpsClass, handleCorpsSwitch, setShowRegistration, CLASS_ORDER }) => {
  if (!corps || Object.keys(corps).length === 0) return null;

  return (
    <div className="lg:hidden shrink-0 px-3 py-1.5 bg-black/30 border-b border-white/5">
      <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide">
        <Music className="w-3.5 h-3.5 text-gold-500 shrink-0" />
        {Object.entries(corps)
          .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
          .map(([classId, corpsData]) => (
            <button
              key={classId}
              onClick={() => handleCorpsSwitch(classId)}
              className={`
                px-2.5 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wide transition-all border shrink-0
                ${activeCorpsClass === classId
                  ? 'bg-gold-500/20 text-gold-400 border-gold-500/40'
                  : 'bg-white/5 text-cream-muted border-white/10'}
              `}
            >
              {corpsData.corpsName || corpsData.name}
            </button>
          ))}
        <button
          onClick={() => setShowRegistration(true)}
          className="px-2 py-1 rounded text-[10px] font-display uppercase tracking-wide border border-dashed border-white/20 text-cream-muted shrink-0"
        >
          + New
        </button>
      </div>
    </div>
  );
};

// Mobile Context Switcher - Tab bar for Staff/Equip/Tasks
const MobileContextSwitcher = ({ contextTab, setContextTab }) => (
  <div className="lg:hidden shrink-0 flex border-t border-b border-white/10 bg-black/40">
    {[
      { id: 'staff', label: 'Staff', icon: Users },
      { id: 'equipment', label: 'Equip', icon: Wrench },
      { id: 'tasks', label: 'Tasks', icon: Zap },
    ].map(tab => (
      <button
        key={tab.id}
        onClick={() => setContextTab(tab.id)}
        className={`
          flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-display font-bold uppercase tracking-wider transition-all
          ${contextTab === tab.id
            ? 'bg-gold-500/20 text-gold-400 border-b-2 border-gold-500'
            : 'text-cream-muted'}
        `}
      >
        <tab.icon className="w-3.5 h-3.5" />
        {tab.label}
      </button>
    ))}
  </div>
);

// ============================================================================
// MAIN COMMAND CENTER DASHBOARD
// ============================================================================

const DashboardCommandCenter = () => {
  const { user } = useAuth();
  const location = useLocation();
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
  const [assignedStaffForRetire, setAssignedStaffForRetire] = useState([]);

  // Context panel tab state
  const [contextTab, setContextTab] = useState('staff');

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
    .filter(([k, v]) => typeof v === 'number' && !k.includes('Max') && !k.includes('Level'))
    .map(([, v]) => v);
  const avgEquipment = equipmentValues.length > 0
    ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
    : 0.90;

  // Staff bonus (max 5%)
  const staffBonus = Math.min(assignedStaff.length * 0.01, 0.05);

  // Calculate multiplier
  const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);
  const multiplier = Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));

  const rehearsalsThisWeek = executionState?.rehearsalsThisWeek ?? 0;
  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;
  const equipmentNeedsRepair = avgEquipment < 0.85;
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  // Class colors
  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900',
    openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white',
    soundSport: 'bg-green-500 text-white',
  };

  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  // Show morning report on first visit
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

  // Show class unlock modal
  useEffect(() => {
    if (newlyUnlockedClass) setShowClassUnlockCongrats(true);
  }, [newlyUnlockedClass]);

  // Show achievement modal
  useEffect(() => {
    if (newAchievement) setShowAchievementModal(true);
  }, [newAchievement]);

  // Handler functions (same as original)
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

  // Daily tasks data
  const dailyTasks = [
    { id: 'rehearse', label: 'Complete daily rehearsal', reward: '50 XP', completed: !canRehearseToday() },
    { id: 'staff_meeting', label: 'Review staff roster', reward: '10 XP', completed: dailyChallenges?.staff_meeting },
    { id: 'maintain_equipment', label: 'Check equipment status', reward: '10 XP', completed: dailyChallenges?.maintain_equipment },
    { id: 'check_schedule', label: 'Review weekly schedule', reward: '5 XP', completed: dailyChallenges?.check_schedule },
    { id: 'visit_market', label: 'Browse staff market', reward: '5 XP', completed: dailyChallenges?.visit_market },
  ];

  const completedTasks = dailyTasks.filter(t => t.completed).length;

  // Equipment data
  const equipmentItems = [
    {
      name: 'Uniforms',
      icon: '👔',
      condition: equipment.uniformCondition ?? 0.9,
      level: equipment.uniformLevel ?? 1,
      maxLevel: equipment.uniformMaxLevel ?? 5,
      key: 'uniform'
    },
    {
      name: 'Instruments',
      icon: '🎺',
      condition: equipment.instrumentCondition ?? 0.9,
      level: equipment.instrumentLevel ?? 1,
      maxLevel: equipment.instrumentMaxLevel ?? 5,
      key: 'instrument'
    },
    {
      name: 'Props',
      icon: '🎨',
      condition: equipment.propsCondition ?? 0.9,
      level: equipment.propsLevel ?? 1,
      maxLevel: equipment.propsMaxLevel ?? 5,
      key: 'props'
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
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

      {/* ========================================================================
          MOBILE HUD - Compact status bar (hidden on desktop)
          ======================================================================== */}
      <MobileStatusRow
        seasonData={seasonData}
        weeksRemaining={weeksRemaining}
        currentWeek={currentWeek}
        profile={profile}
        formatSeasonName={formatSeasonName}
      />

      {/* ========================================================================
          MOBILE CORPS TABS (hidden on desktop)
          ======================================================================== */}
      <MobileCorpsTabs
        corps={corps}
        activeCorpsClass={activeCorpsClass}
        handleCorpsSwitch={handleCorpsSwitch}
        setShowRegistration={setShowRegistration}
        CLASS_ORDER={CLASS_ORDER}
      />

      {/* ========================================================================
          DESKTOP TOP STATUS BAR - (hidden on mobile)
          ======================================================================== */}
      <div className="hidden lg:block shrink-0 px-4 py-2 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between gap-4">
          {/* Season & Time */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-display text-cream font-medium">
              {formatSeasonName(seasonData?.name)}
            </span>
            {weeksRemaining && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-mono">
                <Clock className="w-3.5 h-3.5" />
                Wk {currentWeek} • {weeksRemaining}w left
              </span>
            )}
          </div>

          {/* User Stats */}
          <div className="flex items-center gap-2">
            {/* XP Level with progress bar */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/30">
              <Zap className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-mono font-bold text-gold-400">Lv.{profile?.xpLevel || 1}</span>
              <div className="w-16 h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                <div className="h-full bg-gold-500 transition-all" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>

            {/* Corps Coins */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/30">
              <Trophy className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-mono font-bold text-gold-400">{(profile?.corpsCoin || 0).toLocaleString()}</span>
            </div>

            {/* Director Name */}
            <div className="pl-3 border-l border-white/10">
              <span className="text-sm font-display font-bold text-cream uppercase tracking-wide">
                {profile?.displayName || 'Director'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================
          DESKTOP CORPS TABS - Switch between corps (hidden on mobile)
          ======================================================================== */}
      {corps && Object.keys(corps).length > 0 && (
        <div className="hidden lg:block shrink-0 px-4 py-2 bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-gold-500" />
            <div className="flex items-center gap-1 overflow-x-auto scroll-hide">
              {Object.entries(corps)
                .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                .map(([classId, corpsData]) => (
                  <button
                    key={classId}
                    onClick={() => handleCorpsSwitch(classId)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all border
                      ${activeCorpsClass === classId
                        ? 'bg-gold-500/20 text-gold-400 border-gold-500/40'
                        : 'bg-white/5 text-cream-muted border-white/10 hover:text-cream hover:border-white/20'}
                    `}
                  >
                    {corpsData.corpsName || corpsData.name}
                  </button>
                ))}
              {/* Add new corps button */}
              <button
                onClick={() => setShowRegistration(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-wide border border-dashed border-white/20 text-cream-muted hover:text-gold-400 hover:border-gold-500/40 transition-all"
              >
                + New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MAIN CONTENT AREA - Responsive 3-Panel / Mobile HUD Layout
          ======================================================================== */}
      {activeCorps && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* ================================================================
              LEFT NAV RAIL - Desktop only (hidden on mobile - BottomNav used)
              ================================================================ */}
          <div className="hidden lg:flex shrink-0 w-16 bg-black/30 border-r border-white/10 py-3 flex-col items-center gap-1">
            <NavItem icon={Home} label="Home" to="/" active={location.pathname === '/'} />
            <NavItem icon={Calendar} label="Schedule" to="/schedule" />
            <NavItem icon={ShoppingBag} label="Market" to="/staff" />
            <NavItem icon={Award} label="Leagues" to="/leagues" />
            <NavItem icon={Trophy} label="Scores" to="/scores" />
            <NavItem icon={Crown} label="Pass" to="/battlepass" badge={unclaimedRewardsCount > 0 ? unclaimedRewardsCount : null} />
            <div className="flex-1" />
            <NavItem icon={Star} label="Profile" to="/profile" />
          </div>

          {/* ================================================================
              MAIN PANEL - Corps status + Actions
              Mobile: Compact HUD layout | Desktop: Full panel
              ================================================================ */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-3 lg:p-4 space-y-3 lg:space-y-4">
              {/* Corps Identity Header - Responsive */}
              <div className="glass-panel p-3 lg:p-4">
                {/* Mobile: Compact single-line header */}
                <div className="lg:hidden">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-display font-bold tracking-widest uppercase shrink-0 ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                        {getCorpsClassName(activeCorpsClass)}
                      </span>
                      <h2 className="text-base font-display font-black text-cream uppercase tracking-tight truncate">
                        {activeCorps.corpsName || activeCorps.name || 'UNNAMED'}
                      </h2>
                      <button
                        onClick={() => setShowEditCorps(true)}
                        className="p-1 rounded hover:bg-white/10 text-cream-muted shrink-0"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                    </div>
                    <MultiplierBadge value={multiplier} />
                  </div>
                  {/* Mobile Metrics Row - Tighter */}
                  <div className="grid grid-cols-3 gap-2">
                    <MicroGauge value={readiness} color="blue" label="Ready" size="sm" />
                    <MicroGauge value={morale} color="red" label="Morale" size="sm" />
                    <MicroGauge value={avgEquipment} color="orange" label="Equip" size="sm" />
                  </div>
                </div>

                {/* Desktop: Full header */}
                <div className="hidden lg:block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-display font-bold tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`}>
                          {getCorpsClassName(activeCorpsClass)}
                        </span>
                        {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 text-[10px] font-bold">
                            <Crown className="w-3 h-3" /> TOP 10
                          </span>
                        )}
                        <button
                          onClick={() => setShowEditCorps(true)}
                          className="p-1 rounded hover:bg-white/10 text-cream-muted hover:text-gold-400 transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      </div>
                      <h2 className="text-2xl font-display font-black text-cream uppercase tracking-tight truncate">
                        {activeCorps.corpsName || activeCorps.name || 'UNNAMED CORPS'}
                      </h2>
                      {activeCorps.showConcept && (
                        <p className="text-sm text-cream-muted italic truncate">"{activeCorps.showConcept}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <MultiplierBadge value={multiplier} />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowCaptionSelection(true)}
                          className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400 hover:bg-gold-500/20 transition-all"
                          title="Edit Lineup"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <Link
                          to="/schedule"
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-cream-muted hover:text-gold-400 hover:border-gold-500/30 transition-all"
                          title="Schedule"
                        >
                          <Calendar className="w-4 h-4" />
                        </Link>
                        <Link
                          to="/scores"
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-cream-muted hover:text-gold-400 hover:border-gold-500/30 transition-all"
                          title="Leaderboard"
                        >
                          <Trophy className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                  {/* Desktop Metrics Row */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <MicroGauge value={readiness} color="blue" label="Ready" />
                    <MicroGauge value={morale} color="red" label="Morale" />
                    <MicroGauge value={avgEquipment} color="orange" label="Equip" />
                  </div>
                </div>
              </div>

            {/* Week Strip + Stats - Responsive */}
              <div className="glass-panel p-3 lg:p-4">
                {/* Mobile: Vertical layout */}
                <div className="lg:hidden space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-cream-muted font-display">Week {currentWeek}</span>
                    <WeekStrip
                      rehearsalsThisWeek={rehearsalsThisWeek}
                      shows={activeCorps?.selectedShows?.[`week${currentWeek}`]?.map(s => s.dayOfWeek) || []}
                    />
                  </div>
                  {/* Mobile: 2x2 stat grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <Target className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-mono font-bold text-blue-400">{rehearsalsThisWeek}/7</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <Music className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] font-mono font-bold text-purple-400">{showsThisWeek}</span>
                    </div>
                    {activeCorpsClass !== 'soundSport' && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <Trophy className="w-3 h-3 text-gold-400" />
                        <span className="text-[10px] font-mono font-bold text-gold-400">{activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold text-emerald-400">{assignedStaff.length}/8</span>
                    </div>
                  </div>
                </div>
                {/* Desktop: Horizontal layout */}
                <div className="hidden lg:flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-cream-muted font-display mb-2">Week {currentWeek} Progress</div>
                    <WeekStrip
                      rehearsalsThisWeek={rehearsalsThisWeek}
                      shows={activeCorps?.selectedShows?.[`week${currentWeek}`]?.map(s => s.dayOfWeek) || []}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <StatPill icon={Target} value={`${rehearsalsThisWeek}/7`} label="Rehearsals" color="blue" />
                    <StatPill icon={Music} value={showsThisWeek} label="Shows" color="purple" />
                    {activeCorpsClass !== 'soundSport' && (
                      <StatPill icon={Trophy} value={activeCorps.totalSeasonScore?.toFixed(1) || '0.0'} label="Score" color="gold" trend={weeklyProgress?.scoreImprovement} />
                    )}
                    <StatPill icon={Users} value={`${assignedStaff.length}/8`} label="Staff" color="green" />
                  </div>
                </div>
              </div>

              {/* Quick Actions - 2x2 Grid on Mobile, Row on Desktop */}
              <div className="grid grid-cols-2 lg:flex lg:items-center gap-2">
                <ActionButton
                  icon={Music}
                  label="Rehearse"
                  onClick={handleRehearsal}
                  disabled={!canRehearseToday()}
                  processing={executionProcessing}
                  completed={!canRehearseToday()}
                  variant="primary"
                />
                <ActionButton
                  icon={Heart}
                  label="Boost Morale"
                  onClick={boostMorale}
                  disabled={morale >= 1}
                />
                <ActionButton
                  icon={Wrench}
                  label="Repair All"
                  onClick={() => {
                    equipmentItems.forEach(item => {
                      if (item.condition < 0.85) {
                        repairEquipment(item.key);
                      }
                    });
                  }}
                  disabled={!equipmentNeedsRepair}
                />
                <Link to="/staff" className="lg:ml-auto">
                  <ActionButton icon={Users} label="Hire Staff" />
                </Link>
              </div>

              {/* Activity Log - Desktop only */}
              <div className="hidden lg:flex glass-panel p-3 items-center gap-4 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-cream-muted font-display">This Week:</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-3.5 h-3.5 ${(weeklyProgress?.scoreImprovement || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span className={`text-sm font-mono font-bold ${(weeklyProgress?.scoreImprovement || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(weeklyProgress?.scoreImprovement || 0) >= 0 ? '+' : ''}{(weeklyProgress?.scoreImprovement || 0).toFixed(1)} Score
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(weeklyProgress?.rankChange || 0) > 0 ? (
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (weeklyProgress?.rankChange || 0) < 0 ? (
                    <ArrowDown className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-cream-muted" />
                  )}
                  <span className={`text-sm font-mono font-bold ${
                    (weeklyProgress?.rankChange || 0) > 0 ? 'text-emerald-400' :
                    (weeklyProgress?.rankChange || 0) < 0 ? 'text-rose-400' : 'text-cream-muted'
                  }`}>
                    {Math.abs(weeklyProgress?.rankChange || 0)} Rank
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-mono font-bold text-blue-400">
                    {weeklyProgress?.rehearsalsCompleted || 0} Rehearsals
                  </span>
                </div>
              </div>

              {/* SoundSport Banner */}
              {activeCorpsClass === 'soundSport' && (
                <div className="flex items-center justify-center gap-2 py-2 px-3 lg:px-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
                  <Sparkles className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="text-[10px] lg:text-xs font-display font-bold">SoundSport is non-competitive - just have fun!</span>
                </div>
              )}
            </div>

            {/* ================================================================
                MOBILE CONTEXT SWITCHER - Staff/Equip/Tasks tabs (mobile only)
                ================================================================ */}
            <MobileContextSwitcher contextTab={contextTab} setContextTab={setContextTab} />

            {/* ================================================================
                MOBILE CONTEXT CONTENT - Shows below main content on mobile
                ================================================================ */}
            <div className="lg:hidden flex-1 min-h-0 overflow-y-auto hud-scroll p-3 bg-black/30">
              <AnimatePresence mode="wait">
                {contextTab === 'staff' && (
                  <motion.div
                    key="staff-mobile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-cream-muted font-display uppercase tracking-wider">
                        Assigned ({assignedStaff.length}/8)
                      </span>
                      <Link to="/staff" className="text-[10px] text-gold-400 font-display uppercase">
                        Browse →
                      </Link>
                    </div>
                    {assignedStaff.map(staff => (
                      <StaffRow key={staff.id} staff={staff} />
                    ))}
                    {assignedStaff.length < 8 && [...Array(Math.min(2, 8 - assignedStaff.length))].map((_, i) => (
                      <EmptyStaffSlot key={i} onClick={() => window.location.href = '/staff'} />
                    ))}
                    {assignedStaff.length === 0 && (
                      <div className="text-center py-4 text-cream-muted">
                        <Users className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <p className="text-[10px]">No staff assigned</p>
                      </div>
                    )}
                  </motion.div>
                )}
                {contextTab === 'equipment' && (
                  <motion.div
                    key="equipment-mobile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-cream-muted font-display uppercase tracking-wider">Equipment</span>
                      <span className={`text-[10px] font-mono ${avgEquipment >= 0.9 ? 'text-emerald-400' : avgEquipment >= 0.7 ? 'text-orange-400' : 'text-rose-400'}`}>
                        Avg: {Math.round(avgEquipment * 100)}%
                      </span>
                    </div>
                    {equipmentItems.map(item => (
                      <EquipmentRow
                        key={item.key}
                        name={item.name}
                        icon={item.icon}
                        condition={item.condition}
                        level={item.level}
                        maxLevel={item.maxLevel}
                        onRepair={() => repairEquipment(item.key)}
                        onUpgrade={() => upgradeEquipment(item.key)}
                        repairing={executionProcessing}
                      />
                    ))}
                  </motion.div>
                )}
                {contextTab === 'tasks' && (
                  <motion.div
                    key="tasks-mobile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-cream-muted font-display uppercase tracking-wider">Daily Tasks</span>
                      <span className="text-[10px] font-mono text-gold-400">{completedTasks}/{dailyTasks.length}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(completedTasks / dailyTasks.length) * 100}%` }}
                        className="h-full bg-gold-500 rounded-full"
                      />
                    </div>
                    {dailyTasks.map(task => (
                      <DailyTask
                        key={task.id}
                        task={task}
                        completed={task.completed}
                        onComplete={() => {
                          completeDailyChallenge(task.id);
                          if (task.id === 'rehearse') handleRehearsal();
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ================================================================
              RIGHT CONTEXT PANEL - Desktop only (hidden on mobile)
              ================================================================ */}
          <div className="hidden lg:flex shrink-0 w-80 bg-black/30 border-l border-white/10 flex-col overflow-hidden">
            {/* Context Tabs */}
            <div className="shrink-0 flex border-b border-white/10">
              {[
                { id: 'staff', label: 'Staff', icon: Users },
                { id: 'equipment', label: 'Equip', icon: Wrench },
                { id: 'tasks', label: 'Tasks', icon: Zap },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setContextTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-display font-bold uppercase tracking-wider transition-all
                    ${contextTab === tab.id
                      ? 'bg-gold-500/20 text-gold-400 border-b-2 border-gold-500'
                      : 'text-cream-muted hover:text-cream hover:bg-white/5'}
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Context Content */}
            <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-3">
              <AnimatePresence mode="wait">
                {contextTab === 'staff' && (
                  <motion.div
                    key="staff"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-cream-muted font-display uppercase tracking-wider">
                        Assigned Staff ({assignedStaff.length}/8)
                      </span>
                      <Link to="/staff" className="text-[10px] text-gold-400 hover:text-gold-300 font-display uppercase">
                        Browse →
                      </Link>
                    </div>
                    {assignedStaff.map(staff => (
                      <StaffRow key={staff.id} staff={staff} />
                    ))}
                    {assignedStaff.length < 8 && (
                      <>
                        {[...Array(Math.min(3, 8 - assignedStaff.length))].map((_, i) => (
                          <EmptyStaffSlot key={i} onClick={() => window.location.href = '/staff'} />
                        ))}
                      </>
                    )}
                    {assignedStaff.length === 0 && (
                      <div className="text-center py-6 text-cream-muted">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No staff assigned</p>
                        <Link to="/staff" className="text-xs text-gold-400 hover:text-gold-300">
                          Visit the market →
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}

                {contextTab === 'equipment' && (
                  <motion.div
                    key="equipment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-cream-muted font-display uppercase tracking-wider">
                        Equipment Status
                      </span>
                      <span className={`text-xs font-mono ${avgEquipment >= 0.9 ? 'text-emerald-400' : avgEquipment >= 0.7 ? 'text-orange-400' : 'text-rose-400'}`}>
                        Avg: {Math.round(avgEquipment * 100)}%
                      </span>
                    </div>
                    {equipmentItems.map(item => (
                      <EquipmentRow
                        key={item.key}
                        name={item.name}
                        icon={item.icon}
                        condition={item.condition}
                        level={item.level}
                        maxLevel={item.maxLevel}
                        onRepair={() => repairEquipment(item.key)}
                        onUpgrade={() => upgradeEquipment(item.key)}
                        repairing={executionProcessing}
                      />
                    ))}
                    {equipmentNeedsRepair && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Equipment needs repair!</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {contextTab === 'tasks' && (
                  <motion.div
                    key="tasks"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-cream-muted font-display uppercase tracking-wider">
                        Daily Tasks
                      </span>
                      <span className="text-xs font-mono text-gold-400">
                        {completedTasks}/{dailyTasks.length}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(completedTasks / dailyTasks.length) * 100}%` }}
                        className="h-full bg-gold-500 rounded-full"
                      />
                    </div>
                    {dailyTasks.map(task => (
                      <DailyTask
                        key={task.id}
                        task={task}
                        completed={task.completed}
                        onComplete={() => {
                          completeDailyChallenge(task.id);
                          if (task.id === 'rehearse') handleRehearsal();
                        }}
                      />
                    ))}
                    {completedTasks === dailyTasks.length && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>All tasks complete! Great work!</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* No Corps State */}
      {!activeCorps && !showSeasonSetupWizard && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Music className="w-16 h-16 mx-auto mb-4 text-cream-muted opacity-50" />
            <h2 className="text-xl font-display font-bold text-cream mb-2">No Corps Registered</h2>
            <p className="text-cream-muted mb-4">Create your first corps to begin your journey!</p>
            <button
              onClick={() => setShowRegistration(true)}
              className="btn-primary-hud"
            >
              Register Corps
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODALS (same as original)
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
          setContextTab('equipment');
        }}
        onNavigateToStaff={() => {
          setShowMorningReport(false);
          setContextTab('staff');
        }}
      />
    </div>
  );
};

export default DashboardCommandCenter;
