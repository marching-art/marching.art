// src/pages/Dashboard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Music, Plus, Edit, Calendar, Users, AlertCircle, Check,
  Target, Wrench, Trophy, Star, ChevronRight, MapPin
} from 'lucide-react';
import { useAuth } from '../App';
import { db, analyticsHelpers } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import SeasonInfo from '../components/SeasonInfo';
import PerformanceChart from '../components/PerformanceChart';
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
  DashboardCorpsPanel
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

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

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
    completeDailyChallenge
  } = dashboardData;

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

  const handleRetireCorps = async () => {
    setRetiring(true);
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass });
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

      {/* Compact Header */}
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

      {/* Quick Actions Row */}
      {activeCorps && (
        <QuickActionsRow
          activeCorps={activeCorps}
          activeCorpsClass={activeCorpsClass}
          executionState={executionState}
          executionProcessing={executionProcessing}
          canRehearseToday={canRehearseToday}
          rehearse={rehearse}
          currentWeek={currentWeek}
          onTabChange={setActiveTab}
          hasMultipleCorps={hasMultipleCorps}
          corps={corps}
          onCorpsSwitch={handleCorpsSwitch}
          getCorpsClassName={getCorpsClassName}
          getCorpsClassColor={getCorpsClassColor}
        />
      )}

      {/* Main Content Layout - Desktop: 2 columns, Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab Navigation */}
          {activeCorps && (
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'overview'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
                }`}
              >
                <Music className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('execution')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'execution'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
                }`}
              >
                <Target className="w-4 h-4" />
                Execution
              </button>
              <button
                onClick={() => {
                  setActiveTab('equipment');
                  completeDailyChallenge('maintain_equipment');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'equipment'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
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
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'staff'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
                }`}
              >
                <Users className="w-4 h-4" />
                Staff
              </button>
            </div>
          )}

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Corps Panel + Season Info in Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2">
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
                      onShowRetireConfirm={() => setShowRetireConfirm(true)}
                      onShowRegistration={() => setShowRegistration(true)}
                    />
                  </div>
                  <div className="xl:col-span-1">
                    <SeasonInfo />
                  </div>
                </div>

                {/* Performance Chart + Recent Activity */}
                {activeCorps && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <PerformanceChart scores={recentScores} corpsClass={activeCorpsClass} />

                    {/* Recent Scores */}
                    <div className="card">
                      <h3 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-gold-500" />
                        {activeCorpsClass === 'soundSport' ? 'Recent Performances' : 'Recent Scores'}
                      </h3>
                      {recentScores.length === 0 ? (
                        <p className="text-cream-500/60 text-center py-6 text-sm">
                          No scores available yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {recentScores.slice(0, 4).map((score, index) => (
                            <div key={index} className="flex items-center justify-between p-2 hover:bg-cream-500/5 rounded-lg transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-cream-100 truncate">{score.showName}</p>
                                <p className="text-xs text-cream-500/60">
                                  {score.date?.toDate ? score.date.toDate().toLocaleDateString() : score.date}
                                </p>
                              </div>
                              <div className="text-right pl-2">
                                <p className="text-sm font-bold text-gold-500">{score.totalScore}</p>
                                {activeCorpsClass !== 'soundSport' && score.rank && (
                                  <p className="text-xs text-cream-500/60">#{score.rank}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Link
                        to="/scores"
                        className="block mt-3 pt-3 border-t border-cream-500/10 text-center text-xs text-gold-500 hover:text-gold-400"
                      >
                        View All Scores <ChevronRight className="w-3 h-3 inline" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* League Activity */}
                {activeCorps && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-gold-500" />
                      League Activity
                    </h3>
                    {!profile?.leagueIds || profile.leagueIds.length === 0 ? (
                      <div className="text-center py-4">
                        <Users className="w-8 h-8 text-cream-500/40 mx-auto mb-2" />
                        <p className="text-sm text-cream-500/60 mb-2">Not in any leagues yet</p>
                        <Link to="/leagues" className="btn-outline text-xs inline-flex items-center">
                          Browse Leagues <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profile.leagueIds.slice(0, 3).map((leagueId, index) => (
                          <div
                            key={leagueId}
                            className="flex items-center gap-2 px-3 py-2 bg-charcoal-900/30 rounded-lg"
                          >
                            <Trophy className="w-4 h-4 text-gold-500" />
                            <span className="text-sm text-cream-100">League {index + 1}</span>
                          </div>
                        ))}
                        <Link
                          to="/leagues"
                          className="flex items-center gap-1 px-3 py-2 text-sm text-gold-500 hover:text-gold-400"
                        >
                          View All <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeCorps && activeTab === 'execution' && (
              <motion.div
                key="execution"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <ExecutionDashboard
                  executionState={executionState}
                  multiplier={calculateMultiplier()}
                />
                <RehearsalPanel
                  executionState={executionState}
                  canRehearseToday={canRehearseToday()}
                  onRehearsal={rehearse}
                  processing={executionProcessing}
                />
                <ShowDifficultySelector
                  corpsClass={activeCorpsClass}
                  currentDifficulty={executionState?.showDesign?.difficulty || activeCorps?.execution?.showDesign?.difficulty}
                  currentDay={profile?.currentDay || 1}
                  onSuccess={() => {
                    toast.success('Show difficulty updated successfully!');
                  }}
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
            onClose={() => setShowRetireConfirm(false)}
            onConfirm={handleRetireCorps}
            corpsName={activeCorps.corpsName || activeCorps.name}
            corpsClass={activeCorpsClass}
            retiring={retiring}
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
    </div>
  );
};

export default Dashboard;
