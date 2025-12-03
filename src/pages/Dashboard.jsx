// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, ClipboardList, X } from 'lucide-react';
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
  DashboardHeader,
  DashboardSidebar,
  DashboardCorpsPanel,
  MorningReport,
  DailyOperations,
  CommandCenter
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';
import { retireCorps } from '../firebase/functions';

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

  // New: Slide-out panel states for Equipment and Staff
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    dailyOps: true,
    corpsDetails: false
  });

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

  // Check for assigned staff when opening retire modal
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
    <div className="space-y-4">
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

      {/* Streamlined Header - User identity and key stats only */}
      <DashboardHeader
        profile={profile}
        seasonData={seasonData}
        formatSeasonName={formatSeasonName}
        weeksRemaining={weeksRemaining}
        currentWeek={currentWeek}
        engagementData={engagementData}
      />

      {/* Command Center - Unified corps management HUD */}
      {activeCorps && (
        <CommandCenter
          profile={profile}
          activeCorps={activeCorps}
          activeCorpsClass={activeCorpsClass}
          executionState={executionState}
          canRehearseToday={canRehearseToday()}
          onRehearsal={handleRehearsal}
          rehearsalProcessing={executionProcessing}
          currentWeek={currentWeek}
          corps={corps}
          hasMultipleCorps={hasMultipleCorps}
          onCorpsSwitch={handleCorpsSwitch}
          getCorpsClassName={getCorpsClassName}
          assignedStaff={assignedStaff}
          onOpenEquipmentModal={() => {
            setShowEquipmentPanel(true);
            completeDailyChallenge('maintain_equipment');
          }}
          onOpenStaffModal={() => {
            setShowStaffPanel(true);
            completeDailyChallenge('staff_meeting');
          }}
        />
      )}

      {/* Main Content Layout - Unified HUD approach, no tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4">

          {/* Daily Operations - Collapsible Section */}
          {activeCorps && (
            <div className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, dailyOps: !prev.dailyOps }))}
                className="w-full flex items-center justify-between p-4 hover:bg-cream-500/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gold-500/20">
                    <Zap className="w-4 h-4 text-gold-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-cream-100">Daily Activities</h3>
                    <p className="text-xs text-cream-500/60">Complete activities to boost your corps</p>
                  </div>
                </div>
                {expandedSections.dailyOps ? (
                  <ChevronUp className="w-5 h-5 text-cream-500/60" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-cream-500/60" />
                )}
              </button>
              <AnimatePresence>
                {expandedSections.dailyOps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
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
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Corps Details - Collapsible Section */}
          {activeCorps && (
            <div className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, corpsDetails: !prev.corpsDetails }))}
                className="w-full flex items-center justify-between p-4 hover:bg-cream-500/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <ClipboardList className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-cream-100">Corps Details</h3>
                    <p className="text-xs text-cream-500/60">Manage lineup, schedule, and corps info</p>
                  </div>
                </div>
                {expandedSections.corpsDetails ? (
                  <ChevronUp className="w-5 h-5 text-cream-500/60" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-cream-500/60" />
                )}
              </button>
              <AnimatePresence>
                {expandedSections.corpsDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sidebar - Desktop only */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-4">
            <DashboardSidebar
              weeklyProgress={weeklyProgress}
              engagementData={engagementData}
              profile={profile}
              activeCorps={activeCorps}
              activeCorpsClass={activeCorpsClass}
              currentWeek={currentWeek}
              unclaimedRewardsCount={unclaimedRewardsCount}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Sidebar content shown below main content */}
      <div className="lg:hidden">
        <DashboardSidebar
          weeklyProgress={weeklyProgress}
          engagementData={engagementData}
          profile={profile}
          activeCorps={activeCorps}
          activeCorpsClass={activeCorpsClass}
          currentWeek={currentWeek}
          unclaimedRewardsCount={unclaimedRewardsCount}
        />
      </div>

      {/* Equipment Slide-out Panel */}
      <AnimatePresence>
        {showEquipmentPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEquipmentPanel(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-900 border-l border-cream-500/10 z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-charcoal-900/95 backdrop-blur-sm border-b border-cream-500/10 p-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-cream-100">Equipment Manager</h2>
                <button
                  onClick={() => setShowEquipmentPanel(false)}
                  className="p-2 rounded-lg hover:bg-cream-500/10 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <X className="w-5 h-5" />
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

      {/* Staff Slide-out Panel */}
      <AnimatePresence>
        {showStaffPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStaffPanel(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-900 border-l border-cream-500/10 z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-charcoal-900/95 backdrop-blur-sm border-b border-cream-500/10 p-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-cream-100">Staff Roster</h2>
                <button
                  onClick={() => setShowStaffPanel(false)}
                  className="p-2 rounded-lg hover:bg-cream-500/10 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <DashboardStaffPanel activeCorpsClass={activeCorpsClass} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

export default Dashboard;
