// =============================================================================
// DASHBOARD - ESPN DATA GRID LAYOUT
// =============================================================================
// Dense, puzzle-fit panels. Zero black space between cards.
// Laws: gap-px creates borders, tables over cards, no glow

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Edit, ChevronRight, Coins, Users,
  Music, TrendingUp, TrendingDown, Activity
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
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
  OnboardingTour,
  QuickStartGuide,
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';

// =============================================================================
// CONSTANTS
// =============================================================================

const CAPTIONS = [
  { id: 'GE1', name: 'GE1', category: 'ge' },
  { id: 'GE2', name: 'GE2', category: 'ge' },
  { id: 'VP', name: 'VP', category: 'vis' },
  { id: 'VA', name: 'VA', category: 'vis' },
  { id: 'CG', name: 'CG', category: 'vis' },
  { id: 'B', name: 'B', category: 'mus' },
  { id: 'MA', name: 'MA', category: 'mus' },
  { id: 'P', name: 'P', category: 'mus' },
];

const CLASS_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const standingsColumns = [
  {
    key: 'rank',
    header: 'RK',
    width: '40px',
    isRank: true,
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => (
      <span className="truncate block max-w-[140px]">
        {row.corpsName || row.corps}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '70px',
    render: (row) => (
      <span className="text-white tabular-nums">
        {typeof row.score === 'number' ? row.score.toFixed(2) : row.score}
      </span>
    ),
  },
];

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const { aggregatedScores, loading: scoresLoading } = useScoresData();
  const { data: myLeagues } = useMyLeagues(user?.uid);

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
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [showQuickStartGuide, setShowQuickStartGuide] = useState(false);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    currentWeek,
    formatSeasonName,
    engagementData,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
    handleCorpsSwitch,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    getCorpsClassName,
    refreshProfile
  } = dashboardData;

  // Effects
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

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps && !showMorningReport) {
      const timer = setTimeout(() => setShowOnboardingTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, showMorningReport]);

  useEffect(() => {
    if (newlyUnlockedClass) setShowClassUnlockCongrats(true);
  }, [newlyUnlockedClass]);

  useEffect(() => {
    if (newAchievement) setShowAchievementModal(true);
  }, [newAchievement]);

  // Handlers
  const handleTourComplete = async () => {
    setShowOnboardingTour(false);
    if (profile?.isFirstVisit && user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { isFirstVisit: false });
      } catch (error) {
        console.error('Error updating first visit flag:', error);
      }
    }
  };

  const handleSetupNewClass = () => {
    setShowClassUnlockCongrats(false);
    setShowRegistration(true);
  };

  const handleDeclineSetup = () => {
    setShowClassUnlockCongrats(false);
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  };

  const handleEditCorps = async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.corpsName`]: formData.name,
        [`corps.${activeCorpsClass}.location`]: formData.location,
        [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
      });
      toast.success('Corps updated!');
      setShowEditCorps(false);
    } catch (error) {
      toast.error('Failed to update corps');
    }
  };

  const handleDeleteCorps = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete corps');
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
      toast.error(error.message || 'Failed to retire corps');
    } finally {
      setRetiring(false);
    }
  };

  const handleMoveCorps = async (targetClass) => {
    try {
      if (corps[targetClass]) {
        toast.error(`Already have a corps in ${getCorpsClassName(targetClass)}`);
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${targetClass}`]: { ...activeCorps, class: targetClass },
        [`corps.${activeCorpsClass}`]: null
      });
      toast.success('Corps moved!');
      setShowMoveCorps(false);
    } catch (error) {
      toast.error('Failed to move corps');
    }
  };

  const handleCorpsRegistration = async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded');
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${formData.class}`]: {
          name: formData.name,
          location: formData.location,
          showConcept: formData.showConcept,
          class: formData.class,
          createdAt: new Date(),
          seasonId: seasonData.seasonUid,
          lineup: {},
          score: 0,
          rank: null
        }
      });
      toast.success(`${formData.name} registered!`);
      setShowRegistration(false);
      clearNewlyUnlockedClass();
    } catch (error) {
      toast.error('Failed to register corps');
    }
  };

  // Computed values
  const lineup = activeCorps?.lineup || {};
  const lineupCount = Object.keys(lineup).length;
  const standingsData = aggregatedScores.slice(0, 8);
  const primaryLeague = myLeagues?.[0];

  const getThisWeekShows = () => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 4);
  };

  const getRankTrend = () => {
    if (!activeCorps?.rankHistory || activeCorps.rankHistory.length < 2) return null;
    const prev = activeCorps.rankHistory[activeCorps.rankHistory.length - 2];
    const curr = activeCorps.rank;
    if (prev > curr) return 'up';
    if (prev < curr) return 'down';
    return null;
  };

  const thisWeekShows = getThisWeekShows();
  const rankTrend = getRankTrend();

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="w-full h-full min-h-screen bg-[#0a0a0a]">
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

      {activeCorps ? (
        <>
          {/* Corps Switcher Bar */}
          {hasMultipleCorps && (
            <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-2 flex items-center gap-2 overflow-x-auto">
              {Object.entries(corps)
                .sort((a, b) => {
                  const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                  return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
                })
                .map(([classId, corpsData]) => (
                <button
                  key={classId}
                  onClick={() => handleCorpsSwitch(classId)}
                  className={`px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${
                    activeCorpsClass === classId
                      ? 'bg-[#0057B8] text-white'
                      : 'bg-[#333] text-gray-400 hover:text-white'
                  }`}
                >
                  {corpsData.corpsName || corpsData.name || ''}
                </button>
              ))}
            </div>
          )}

          {/* MAIN GRID - gap-px creates borders, full width fluid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 w-full gap-px bg-[#333]">

            {/* LEFT COLUMN - My Team */}
            <div className="bg-[#1a1a1a] p-4">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {CLASS_LABELS[activeCorpsClass] || activeCorpsClass}
                  </span>
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-1 text-gray-500 hover:text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Corps Name */}
              <h2 className="text-lg font-bold text-white mb-4">
                {activeCorps.corpsName || activeCorps.name || 'Your Corps'}
              </h2>

              {/* Big Score */}
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Season Score
                </div>
                <div className="text-3xl font-bold font-data text-white tabular-nums">
                  {activeCorps.totalSeasonScore?.toFixed(2) || '0.00'}
                </div>
              </div>

              {/* Rank */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#333]">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Rank
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">
                      #{activeCorps.rank || '-'}
                    </span>
                    {rankTrend === 'up' && (
                      <span className="flex items-center text-green-500 text-xs">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                    )}
                    {rankTrend === 'down' && (
                      <span className="flex items-center text-red-500 text-xs">
                        <TrendingDown className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Lineup
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${lineupCount === 8 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {lineupCount}/8
                    </span>
                    <button
                      onClick={() => setShowCaptionSelection(true)}
                      className="text-[10px] text-[#0057B8] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Lineup Grid */}
              <div className="grid grid-cols-4 gap-1 mb-4">
                {CAPTIONS.map((caption) => {
                  const value = lineup[caption.id];
                  const hasValue = !!value;
                  return (
                    <div
                      key={caption.id}
                      className={`p-1.5 text-center border ${
                        hasValue ? 'border-[#444] bg-[#222]' : 'border-[#333] bg-[#1a1a1a]'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-gray-400">{caption.name}</div>
                      <div className={`text-[9px] truncate ${hasValue ? 'text-gray-300' : 'text-gray-600'}`}>
                        {hasValue ? value.split('|')[0]?.slice(0, 6) : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* League Link */}
              {primaryLeague ? (
                <Link
                  to="/leagues"
                  className="flex items-center justify-between p-2 bg-[#222] border border-[#333] hover:border-[#444]"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0057B8]" />
                    <span className="text-sm text-white truncate">{primaryLeague.name}</span>
                  </div>
                  <span className="text-xs font-bold text-[#0057B8]">#{primaryLeague.userRank || '-'}</span>
                </Link>
              ) : (
                <Link
                  to="/leagues"
                  className="flex items-center justify-center gap-2 p-2 border border-dashed border-[#444] text-gray-500 hover:text-white hover:border-[#555]"
                >
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Join a League</span>
                </Link>
              )}

              {/* CorpsCoin */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#333]">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-gray-400">CorpsCoin</span>
                </div>
                <span className="text-sm font-bold font-data text-yellow-500 tabular-nums">
                  {(profile?.corpsCoin || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* CENTER COLUMN - Standings */}
            <div className="bg-[#0a0a0a]">
              <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Standings
                </span>
                <Link to="/scores" className="text-[10px] text-[#0057B8] hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {scoresLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
              ) : (
                <DataTable
                  columns={standingsColumns}
                  data={standingsData}
                  getRowKey={(row) => row.corpsName || row.corps}
                  zebraStripes={true}
                  highlightRow={(row) =>
                    row.corpsName === (activeCorps.corpsName || activeCorps.name)
                  }
                  emptyState={
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No standings yet
                    </div>
                  }
                />
              )}
            </div>

            {/* RIGHT COLUMN - Activity */}
            <div className="bg-[#1a1a1a]">
              <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Week {currentWeek} Schedule
                </span>
                <Link to="/schedule" className="text-[10px] text-[#0057B8] hover:underline flex items-center gap-1">
                  Full Schedule <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {thisWeekShows.length > 0 ? (
                <div className="divide-y divide-[#333]">
                  {thisWeekShows.map((show, idx) => (
                    <div key={idx} className="px-3 py-2 flex items-center gap-3 hover:bg-[#222]">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">
                          {show.eventName || show.name || 'Show'}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {show.location || show.date || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <Calendar className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 mb-2">No shows selected</p>
                  <Link
                    to="/schedule"
                    className="text-xs text-[#0057B8] hover:underline"
                  >
                    Select Shows
                  </Link>
                </div>
              )}

              {/* Season Info */}
              <div className="px-3 py-2 border-t border-[#333] bg-[#222]">
                <div className="text-[10px] text-gray-500">
                  {formatSeasonName(seasonData?.name)} • Week {currentWeek}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW - Activity Feed */}
          <div className="bg-[#1a1a1a] border-t border-[#333]">
            <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Recent Activity
              </span>
            </div>
            <div className="px-4 py-3 text-sm text-gray-500">
              {engagementData?.streak > 0 ? (
                <span>🔥 {engagementData.streak} day streak! Keep it up.</span>
              ) : (
                <span>No recent activity. Check back after competing!</span>
              )}
            </div>
          </div>
        </>
      ) : (
        /* No Corps State */
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm">
            <Card.Header>
              <Card.Title>Start Your Season</Card.Title>
            </Card.Header>
            <Card.Body className="p-4 text-center">
              <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">
                Create your first fantasy corps to begin competing.
              </p>
              <button
                onClick={() => setShowRegistration(true)}
                className="w-full py-2 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6]"
              >
                Register Corps
              </button>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* MODALS */}
      {showClassUnlockCongrats && newlyUnlockedClass && (
        <ClassUnlockCongratsModal
          unlockedClass={newlyUnlockedClass}
          onSetup={handleSetupNewClass}
          onDecline={handleDeclineSetup}
        />
      )}

      {showRegistration && (
        <CorpsRegistrationModal
          onClose={() => { setShowRegistration(false); clearNewlyUnlockedClass(); }}
          onSubmit={handleCorpsRegistration}
          unlockedClasses={profile?.unlockedClasses || ['soundSport']}
          defaultClass={newlyUnlockedClass}
        />
      )}

      {showCaptionSelection && activeCorps && seasonData && (
        <CaptionSelectionModal
          onClose={() => setShowCaptionSelection(false)}
          onSubmit={() => setShowCaptionSelection(false)}
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
          onClose={() => { setShowAchievementModal(false); clearNewAchievement(); }}
          achievements={profile?.achievements || []}
          newAchievement={newAchievement}
        />
      )}

      <MorningReport
        isOpen={showMorningReport}
        onClose={() => setShowMorningReport(false)}
        profile={profile}
        activeCorps={activeCorps}
        activeCorpsClass={activeCorpsClass}
        engagementData={engagementData}
      />

      <OnboardingTour
        isOpen={showOnboardingTour}
        onClose={() => setShowOnboardingTour(false)}
        onComplete={handleTourComplete}
      />

      <QuickStartGuide
        isOpen={showQuickStartGuide}
        onClose={() => setShowQuickStartGuide(false)}
        onAction={(action) => {
          if (action === 'lineup') setShowCaptionSelection(true);
        }}
        completedSteps={[
          ...(lineupCount === 8 ? ['lineup'] : []),
          ...(thisWeekShows.length > 0 ? ['schedule'] : []),
          ...(myLeagues?.length > 0 ? ['league'] : []),
        ]}
      />
    </div>
  );
};

export default Dashboard;
