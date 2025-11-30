// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Users, Target, Wrench, Zap, Trophy, Lock, Plus,
  CheckCircle, AlertTriangle, Eye, Lightbulb, ChevronRight, Square
} from 'lucide-react';
import { useAuth } from '../App';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  ExecutionDashboard,
  RehearsalPanel,
  EquipmentManager,
  DashboardStaffPanel,
  ShowDifficultySelector
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
  DashboardHeader,
  DashboardSidebar,
  QuickActionsRow,
  DashboardCorpsPanel,
  MorningReport,
  DailyOperations
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { retireCorps } from '../firebase/functions';

const Dashboard = () => {
  const { user } = useAuth();

  // Use centralized dashboard hook
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

  // Tab state
  const [activeTab, setActiveTab] = useState('daily');

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

  // Show morning report on first visit of the day
  useEffect(() => {
    if (profile && activeCorps) {
      const today = new Date().toDateString();
      const lastVisit = localStorage.getItem(`lastDashboardVisit_${user?.uid}`);

      if (lastVisit !== today) {
        // First visit today - show morning report
        setShowMorningReport(true);
        localStorage.setItem(`lastDashboardVisit_${user?.uid}`, today);
      }
    }
  }, [profile, activeCorps, user?.uid]);

  // Show class unlock congrats when newly unlocked
  React.useEffect(() => {
    if (newlyUnlockedClass) {
      setShowClassUnlockCongrats(true);
    }
  }, [newlyUnlockedClass]);

  // Show achievement modal when new achievement
  React.useEffect(() => {
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

  // Check for assigned staff when opening retire modal
  const handleOpenRetireModal = async () => {
    try {
      // Check for staff assigned to this corps
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
        // Staff needs to be handled - this shouldn't happen with the new flow
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

  return (
    <div className="space-y-6">
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

      {/* Dashboard Header */}
      <DashboardHeader
        profile={profile}
        seasonData={seasonData}
        formatSeasonName={formatSeasonName}
        weeksRemaining={weeksRemaining}
        currentWeek={currentWeek}
        engagementData={engagementData}
        activeCorps={activeCorps}
        activeCorpsClass={activeCorpsClass}
      />

      {/* MY CORPS OVERVIEW - 2x2 Grid - Cream Card Style */}
      <div className="card-cream p-5 transition-all duration-300">
        <h2 className="text-lg font-oswald font-bold text-gold-600 uppercase tracking-wide mb-4">
          My Corps Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* World Class */}
          <CorpsOverviewCard
            classType="world"
            label="WORLD CLASS"
            corps={corps?.world}
            isActive={activeCorpsClass === 'world'}
            onSwitch={() => handleCorpsSwitch('world')}
            onRegister={() => {
              setShowRegistration(true);
            }}
            isUnlocked={profile?.unlockedClasses?.includes('world')}
            getCorpsClassName={getCorpsClassName}
          />
          {/* Open Class */}
          <CorpsOverviewCard
            classType="open"
            label="OPEN CLASS"
            corps={corps?.open}
            isActive={activeCorpsClass === 'open'}
            onSwitch={() => handleCorpsSwitch('open')}
            onRegister={() => {
              setShowRegistration(true);
            }}
            isUnlocked={profile?.unlockedClasses?.includes('open')}
            getCorpsClassName={getCorpsClassName}
          />
          {/* A Class */}
          <CorpsOverviewCard
            classType="aClass"
            label="A CLASS"
            corps={corps?.aClass}
            isActive={activeCorpsClass === 'aClass'}
            onSwitch={() => handleCorpsSwitch('aClass')}
            onRegister={() => {
              setShowRegistration(true);
            }}
            isUnlocked={profile?.unlockedClasses?.includes('aClass')}
            getCorpsClassName={getCorpsClassName}
          />
          {/* SoundSport */}
          <CorpsOverviewCard
            classType="soundSport"
            label="SOUNDSPORT"
            corps={corps?.soundSport}
            isActive={activeCorpsClass === 'soundSport'}
            onSwitch={() => handleCorpsSwitch('soundSport')}
            onRegister={() => {
              setShowRegistration(true);
            }}
            isUnlocked={profile?.unlockedClasses?.includes('soundSport')}
            getCorpsClassName={getCorpsClassName}
          />
        </div>
      </div>

      {/* TODAY'S BRIEFING Panel - Cream Card with Hashmark Texture */}
      <div className="card-cream hashmark-texture p-5 transition-all duration-300">
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h2 className="text-lg font-oswald font-bold text-gold-600 uppercase tracking-wide flex items-center gap-2">
            <Target className="w-5 h-5 text-gold-500" />
            Today's Briefing
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-montserrat font-medium text-brown-900/70">
              Day {currentWeek ? ((currentWeek - 1) * 7 + new Date().getDay() + 1) : '-'} of 70
            </span>
            <div className="bg-gold-500 text-brown-900 px-3 py-1 rounded-lg text-sm font-bold shadow-md">
              Captions Lock in: {weeksRemaining ? `${weeksRemaining}w` : '-'}
            </div>
          </div>
        </div>

        {/* Briefing Items */}
        <div className="space-y-3 relative z-10">
          {/* Urgent Action Item */}
          {canRehearseToday && canRehearseToday() && (
            <BriefingItem
              type="action"
              title="ACTION: Daily Rehearsal Available"
              description="Your corps is ready for today's rehearsal session."
              onAction={() => {
                setActiveTab('daily');
                rehearse();
              }}
              isOnCream
            />
          )}

          {/* Review Item */}
          {recentScores && recentScores.length > 0 && (
            <BriefingItem
              type="review"
              title={`REVIEW: ${recentScores.length} new score recap${recentScores.length > 1 ? 's' : ''} available`}
              description="Check your recent competition scores and recaps."
              linkTo="/scores"
              isOnCream
            />
          )}

          {/* Strategy Item */}
          {executionState && executionState.readiness < 0.85 && (
            <BriefingItem
              type="strategy"
              title="STRATEGY: Corps Readiness Below Target"
              description={`Current readiness at ${Math.round((executionState.readiness || 0.75) * 100)}%. Consider additional rehearsals.`}
              onAction={() => setActiveTab('daily')}
              isOnCream
            />
          )}

          {/* Staff Check */}
          {executionState && (!executionState.staff || executionState.staff.length < 3) && (
            <BriefingItem
              type="strategy"
              title="STRATEGY: Hire More Staff"
              description="Your corps would benefit from additional staff members."
              linkTo="/staff"
              isOnCream
            />
          )}
        </div>
      </div>

      {/* Main Content Layout - Desktop: 2 columns, Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab Navigation */}
          {activeCorps && (
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button
                onClick={() => setActiveTab('daily')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'daily'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'glass text-cream-300 hover:text-cream-100'
                }`}
              >
                <Zap className="w-4 h-4" />
                Daily Ops
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'overview'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'glass text-cream-300 hover:text-cream-100'
                }`}
              >
                <Music className="w-4 h-4" />
                Corps
              </button>
              <button
                onClick={() => {
                  setActiveTab('equipment');
                  completeDailyChallenge('maintain_equipment');
                }}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'equipment'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'glass text-cream-300 hover:text-cream-100'
                }`}
              >
                <Wrench className="w-4 h-4" />
                Equipment
              </button>
              <button
                onClick={() => {
                  setActiveTab('staff');
                  completeDailyChallenge('staff_meeting');
                }}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'staff'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'glass text-cream-300 hover:text-cream-100'
                }`}
              >
                <Users className="w-4 h-4" />
                Staff
              </button>
            </div>
          )}

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'daily' && activeCorps && (
              <motion.div
                key="daily"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
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
                    // Refresh profile to update XP display in header
                    refreshProfile();
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Corps Panel */}
                <DashboardCorpsPanel
                  activeCorps={activeCorps}
                  activeCorpsClass={activeCorpsClass}
                  profile={profile}
                  currentWeek={currentWeek}
                  getCorpsClassName={getCorpsClassName}
                  onShowCaptionSelection={() => setShowCaptionSelection(true)}
                  onShowEditCorps={() => setShowEditCorps(true)}
                  onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
                  onShowMoveCorps={() => setShowMoveCorps(true)}
                  onShowRetireConfirm={handleOpenRetireModal}
                  onShowRegistration={() => setShowRegistration(true)}
                />
              </motion.div>
            )}

            {activeCorps && activeTab === 'equipment' && (
              <motion.div
                key="equipment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
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

            {activeCorps && activeTab === 'staff' && (
              <motion.div
                key="staff"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <DashboardStaffPanel activeCorpsClass={activeCorpsClass} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar - Hidden on mobile, visible on lg+ */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-4">
            <DashboardSidebar
              dailyChallenges={dailyChallenges}
              weeklyProgress={weeklyProgress}
              engagementData={engagementData}
              profile={profile}
              activeCorps={activeCorps}
              activeCorpsClass={activeCorpsClass}
              currentWeek={currentWeek}
              unclaimedRewardsCount={unclaimedRewardsCount}
              onTabChange={setActiveTab}
              completeDailyChallenge={completeDailyChallenge}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Challenges Section (shown below main content) */}
      <div className="lg:hidden">
        <DashboardSidebar
          dailyChallenges={dailyChallenges}
          weeklyProgress={weeklyProgress}
          engagementData={engagementData}
          profile={profile}
          activeCorps={activeCorps}
          activeCorpsClass={activeCorpsClass}
          currentWeek={currentWeek}
          unclaimedRewardsCount={unclaimedRewardsCount}
          onTabChange={setActiveTab}
          completeDailyChallenge={completeDailyChallenge}
        />
      </div>

      {/* Modals */}
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
            inLeague={false} // TODO: Check if user is in a league
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
          setActiveTab('equipment');
        }}
        onNavigateToStaff={() => {
          setShowMorningReport(false);
          setActiveTab('staff');
        }}
      />
    </div>
  );
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Corps Overview Card - Shows corps status in the 2x2 grid
 * Updated for Cream Card styling with proper contrast
 */
const CorpsOverviewCard = ({ classType, label, corps, isActive, onSwitch, onRegister, isUnlocked, getCorpsClassName }) => {
  if (!isUnlocked) {
    return (
      <div className="bg-cream-200 rounded-lg p-4 opacity-60 border border-brown-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-brown-900/40" />
            <span className="text-sm font-oswald font-semibold text-brown-900/40 uppercase">{label}</span>
          </div>
        </div>
        <p className="text-xs text-brown-900/40 mt-2 font-montserrat">Unlock by gaining more XP</p>
      </div>
    );
  }

  if (!corps) {
    return (
      <button
        onClick={onRegister}
        className="bg-cream-200/50 border-2 border-dashed border-gold-500/40 rounded-lg p-4 hover:border-gold-500 hover:bg-cream-200 transition-all text-left w-full group"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-gold-600 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-oswald font-semibold text-brown-900 uppercase">{label}</span>
        </div>
        <p className="text-xs text-brown-900/60 mt-2 font-montserrat">Click to register a corps</p>
      </button>
    );
  }

  return (
    <button
      onClick={onSwitch}
      className={`rounded-lg p-4 text-left w-full transition-all duration-200 ${
        isActive
          ? 'bg-gold-500 shadow-lg shadow-gold-500/30 scale-[1.02]'
          : 'bg-cream-200/60 hover:bg-cream-200 border border-gold-500/20 hover:border-gold-500/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && <CheckCircle className="w-4 h-4 text-brown-900" />}
          <span className={`text-sm font-oswald font-semibold uppercase ${isActive ? 'text-brown-900' : 'text-brown-900'}`}>
            {label}
          </span>
        </div>
        {corps.rank && (
          <div className={`flex items-center gap-1 text-xs font-bold ${isActive ? 'text-brown-900' : 'text-gold-600'}`}>
            <Trophy className="w-3 h-3" />
            #{corps.rank}
          </div>
        )}
      </div>
      <p className={`text-sm font-montserrat font-medium mt-1 truncate ${isActive ? 'text-brown-900' : 'text-brown-900'}`}>
        {corps.corpsName || corps.name}
      </p>
      <p className={`text-xs font-montserrat mt-1 ${isActive ? 'text-brown-900/70' : 'text-brown-900/60'}`}>
        {corps.totalSeasonScore?.toFixed(2) || '0.00'} pts
      </p>
    </button>
  );
};

/**
 * Briefing Item - Shows action/review/strategy items in Today's Briefing
 * Updated for Cream Card styling with proper contrast
 */
const BriefingItem = ({ type, title, description, onAction, linkTo, isOnCream = false }) => {
  // Styling adjusted for cream background
  const typeConfig = {
    action: {
      icon: AlertTriangle,
      iconBg: 'bg-red-600/20',
      iconColor: 'text-red-600',
      borderColor: 'border-l-red-600',
      bgColor: isOnCream ? 'bg-red-100' : 'bg-red-500/10',
      urgent: true
    },
    review: {
      icon: Eye,
      iconBg: 'bg-blue-600/20',
      iconColor: 'text-blue-700',
      borderColor: 'border-l-blue-600',
      bgColor: isOnCream ? 'bg-blue-100' : 'bg-blue-500/10'
    },
    strategy: {
      icon: Lightbulb,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-700',
      borderColor: 'border-l-amber-500',
      bgColor: isOnCream ? 'bg-amber-100' : 'bg-amber-500/10'
    }
  };

  const config = typeConfig[type] || typeConfig.strategy;
  const Icon = config.icon;

  const content = (
    <div className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${config.borderColor} ${config.bgColor} hover:brightness-95 transition-all cursor-pointer ${config.urgent ? 'task-urgent-glow' : ''}`}>
      <div className={`p-2 rounded-lg ${config.iconBg}`}>
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-oswald font-semibold ${isOnCream ? 'text-brown-900' : 'text-cream-100'}`}>{title}</p>
        <p className={`text-xs font-montserrat mt-0.5 ${isOnCream ? 'text-brown-900/60' : 'text-cream-500/60'}`}>{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Square className={`w-4 h-4 ${isOnCream ? 'text-brown-900/30' : 'text-cream-500/30'}`} />
        <ChevronRight className={`w-4 h-4 ${isOnCream ? 'text-brown-900/40' : 'text-cream-500/40'}`} />
      </div>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return <div onClick={onAction}>{content}</div>;
};

export default Dashboard;
