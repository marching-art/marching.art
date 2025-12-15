// src/pages/Dashboard.jsx
// Data-dense Dashboard focused on quick stats and actionable information
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Edit, ChevronRight, Coins, Users,
  Music, Sparkles, X, Crown
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
  OnboardingTour,
  QuickStartGuide,
  QuickStartButton,
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import GameShell from '../components/Layout/GameShell';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import { TableSkeleton } from '../components/Skeleton';

// Caption definitions for lineup display
const CAPTIONS = [
  { id: 'GE1', name: 'GE1', fullName: 'General Effect 1', category: 'ge' },
  { id: 'GE2', name: 'GE2', fullName: 'General Effect 2', category: 'ge' },
  { id: 'VP', name: 'VP', fullName: 'Visual Proficiency', category: 'vis' },
  { id: 'VA', name: 'VA', fullName: 'Visual Analysis', category: 'vis' },
  { id: 'CG', name: 'CG', fullName: 'Color Guard', category: 'vis' },
  { id: 'B', name: 'B', fullName: 'Brass', category: 'mus' },
  { id: 'MA', name: 'MA', fullName: 'Music Analysis', category: 'mus' },
  { id: 'P', name: 'P', fullName: 'Percussion', category: 'mus' },
];

// Class badge styles
const classColors = {
  worldClass: 'bg-gold-500 text-charcoal-900',
  openClass: 'bg-purple-500 text-white',
  aClass: 'bg-blue-500 text-white',
  soundSport: 'bg-green-500 text-white',
};

const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Parse lineup value "CorpsName|Year|Points" -> { name, year, points }
const parseLineupValue = (value) => {
  if (!value) return null;
  const parts = value.split('|');
  return {
    name: parts[0] || 'Unknown',
    year: parts[1] || '',
    points: parseInt(parts[2]) || 0,
  };
};

// Standings table columns
const standingsColumns = [
  {
    key: 'rank',
    header: '#',
    width: '50px',
    align: 'center',
    sticky: true,
    render: (row) => (
      <span className="font-data font-bold text-cream-500/80">{row.rank}</span>
    ),
  },
  {
    key: 'corpsName',
    header: 'Corps',
    sticky: true,
    render: (row) => (
      <span className="font-semibold text-cream truncate block max-w-[120px] md:max-w-none">
        {row.corpsName || row.corps}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '80px',
    render: (row) => (
      <span className="font-data font-bold text-gold-400 tabular-nums">
        {typeof row.score === 'number' ? row.score.toFixed(2) : row.score}
      </span>
    ),
  },
];

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
  const [showSynergyPanel, setShowSynergyPanel] = useState(false);

  // Onboarding tour and quick start guide states
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

  // Show onboarding tour on first dashboard visit
  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps && !showMorningReport) {
      const timer = setTimeout(() => {
        setShowOnboardingTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, showMorningReport]);

  // Mark first visit as complete when tour ends
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

  // Show class unlock congrats when newly unlocked
  useEffect(() => {
    if (newlyUnlockedClass) setShowClassUnlockCongrats(true);
  }, [newlyUnlockedClass]);

  // Show achievement modal when new achievement
  useEffect(() => {
    if (newAchievement) setShowAchievementModal(true);
  }, [newAchievement]);

  // Get upcoming shows for this week
  const getThisWeekShows = () => {
    if (!activeCorps?.selectedShows) return [];
    const weekShows = activeCorps.selectedShows[`week${currentWeek}`] || [];
    return weekShows.slice(0, 3);
  };

  // Get next show
  const getNextShow = () => {
    const shows = getThisWeekShows();
    return shows.length > 0 ? shows[0] : null;
  };

  // Get user's primary league
  const getPrimaryLeague = () => {
    if (!myLeagues || myLeagues.length === 0) return null;
    return myLeagues[0];
  };

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
      await updateDoc(profileRef, { [`corps.${formData.class}`]: corpsData });
      toast.success(`${formData.name} registered successfully!`);
      setShowRegistration(false);
      clearNewlyUnlockedClass();
    } catch (error) {
      console.error('Error registering corps:', error);
      toast.error('Failed to register corps. Please try again.');
    }
  };

  const handleCaptionSelection = async () => {
    setShowCaptionSelection(false);
  };

  const thisWeekShows = getThisWeekShows();
  const nextShow = getNextShow();
  const primaryLeague = getPrimaryLeague();
  const lineup = activeCorps?.lineup || {};
  const lineupCount = Object.keys(lineup).length;

  // Get top 5 standings
  const standingsPreview = aggregatedScores.slice(0, 5);

  // Calculate trend for rank
  const getRankTrend = () => {
    if (!activeCorps?.rankHistory || activeCorps.rankHistory.length < 2) return undefined;
    const prev = activeCorps.rankHistory[activeCorps.rankHistory.length - 2];
    const curr = activeCorps.rank;
    if (prev > curr) return 'up';
    if (prev < curr) return 'down';
    return 'neutral';
  };

  const dashboardContent = (
    <>
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
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold text-cream">Dashboard</h1>
          <span className="text-xs text-cream-500/50 hidden sm:inline">
            {formatSeasonName(seasonData?.name)} • Week {currentWeek}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gold-500/10 border border-gold-500/20 rounded">
            <Coins className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-xs font-bold text-gold-400 tabular-nums">
              {(profile?.corpsCoin || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {activeCorps ? (
        <div className="space-y-4">
          {/* Corps Switcher */}
          {hasMultipleCorps && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {Object.entries(corps)
                .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                .map(([classId, corpsData]) => (
                  <button
                    key={classId}
                    onClick={() => handleCorpsSwitch(classId)}
                    className={`px-3 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                      activeCorpsClass === classId
                        ? `${classColors[classId]} shadow-lg`
                        : 'bg-charcoal-800 text-cream-500/60 hover:text-cream border border-white/10'
                    }`}
                  >
                    {(corpsData.corpsName || corpsData.name || '').slice(0, 15)}
                  </button>
                ))}
            </div>
          )}

          {/* QUICK LOOK - StatCards Row */}
          <section aria-label="Quick Stats">
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Rank"
                value={activeCorps.rank ? `#${activeCorps.rank}` : '-'}
                trend={getRankTrend()}
                trendValue={activeCorps.rankChange ? Math.abs(activeCorps.rankChange).toString() : undefined}
              />
              <StatCard
                label="Season Score"
                value={activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
              />
              <StatCard
                label="Next Show"
                value={nextShow ? (nextShow.eventName || nextShow.name || 'Show').slice(0, 12) : 'None'}
              />
            </div>
          </section>

          {/* MIDDLE ROW - My Corps + Standings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* MY CORPS Card */}
            <Card data-tour="corps-card">
              <Card.Header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-bold text-cream-500/70 uppercase tracking-wider">
                    My Corps
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-display font-bold uppercase ${classColors[activeCorpsClass]}`}>
                    {getCorpsClassName(activeCorpsClass)}
                  </span>
                  {activeCorps.rank && activeCorps.rank <= 10 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 text-[10px] font-bold">
                      <Crown size={10} /> Top 10
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-1.5 rounded hover:bg-white/10 text-cream-500/40 hover:text-cream transition-colors"
                  aria-label="Edit corps"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </Card.Header>

              <Card.Body className="space-y-3">
                {/* Corps Name */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-display font-black text-cream uppercase tracking-tight">
                    {activeCorps.corpsName || activeCorps.name || 'Your Corps'}
                  </h3>
                  {typeof activeCorps?.showConcept === 'object' && activeCorps.showConcept.theme && (
                    <button
                      onClick={() => setShowSynergyPanel(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 hover:bg-purple-500/20 transition-colors"
                      aria-label={`View show concept: ${activeCorps.showConcept.theme}`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {activeCorps.showConcept.theme}
                    </button>
                  )}
                </div>

                {/* Lineup Summary */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cream-500/50">Lineup</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-data font-bold ${lineupCount === 8 ? 'text-green-400' : 'text-gold-400'}`}>
                      {lineupCount}/8
                    </span>
                    <button
                      onClick={() => setShowCaptionSelection(true)}
                      className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                      aria-label="Edit lineup"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Compact Lineup Grid */}
                {lineupCount > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {CAPTIONS.map((caption) => {
                      const value = lineup[caption.id];
                      const parsed = parseLineupValue(value);
                      const categoryColors = {
                        ge: 'border-gold-500/30 bg-gold-500/5 text-gold-400',
                        vis: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
                        mus: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
                      };

                      return (
                        <div
                          key={caption.id}
                          className={`p-1.5 rounded border text-center ${categoryColors[caption.category]}`}
                          title={parsed ? `${parsed.name} '${parsed.year?.slice(-2) || '??'}` : 'Not set'}
                        >
                          <div className="text-[10px] font-bold uppercase">{caption.name}</div>
                          {parsed ? (
                            <div className="text-[9px] text-cream-500/50 truncate">{parsed.name.slice(0, 8)}</div>
                          ) : (
                            <div className="text-[9px] text-cream-500/30">-</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCaptionSelection(true)}
                    className="w-full py-3 text-center bg-gold-500/10 border border-gold-500/20 rounded text-gold-400 text-sm font-semibold hover:bg-gold-500/20 transition-colors"
                  >
                    <Music className="w-4 h-4 inline mr-2" />
                    Build Lineup
                  </button>
                )}

                {/* League Info */}
                {primaryLeague ? (
                  <Link
                    to="/leagues"
                    className="flex items-center justify-between p-2 bg-blue-500/5 border border-blue-500/20 rounded hover:bg-blue-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-cream">{primaryLeague.name}</span>
                    </div>
                    <span className="text-xs font-data font-bold text-blue-400">
                      #{primaryLeague.userRank || '-'}
                    </span>
                  </Link>
                ) : (
                  <Link
                    to="/leagues"
                    className="flex items-center justify-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Join a League
                  </Link>
                )}
              </Card.Body>
            </Card>

            {/* STANDINGS PREVIEW */}
            <div data-tour="standings">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-display font-bold text-cream-500/70 uppercase tracking-wider">
                  Standings
                </h2>
                <Link
                  to="/leaderboard"
                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {scoresLoading ? (
                <TableSkeleton rows={5} columns={3} />
              ) : (
                <div className="overflow-x-auto">
                  <DataTable
                    columns={standingsColumns}
                    data={standingsPreview}
                    getRowKey={(row) => row.corpsName || row.corps}
                    rowHeight="compact"
                    zebraStripes={true}
                    emptyState={
                      <div className="text-center py-6">
                        <Trophy className="w-8 h-8 text-cream-500/20 mx-auto mb-2" />
                        <p className="text-sm text-cream-500/50">No standings yet</p>
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM - Upcoming Shows */}
          <section data-tour="schedule" aria-label="Upcoming Shows">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-display font-bold text-cream-500/70 uppercase tracking-wider">
                This Week's Shows
              </h2>
              <Link
                to="/schedule"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                Schedule <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {thisWeekShows.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {thisWeekShows.map((show, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-charcoal-900 border border-charcoal-700 rounded-md"
                  >
                    <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-cream truncate">
                        {show.eventName || show.name || 'Show'}
                      </div>
                      <div className="text-xs text-cream-500/50 truncate">
                        {show.location || show.date || ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-charcoal-900 border border-charcoal-700 rounded-md">
                <Calendar className="w-8 h-8 text-cream-500/20 mx-auto mb-2" />
                <p className="text-sm text-cream-500/50 mb-3">No shows selected for this week</p>
                <Link
                  to="/schedule"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400 text-sm font-semibold hover:bg-purple-500/20 transition-colors"
                >
                  Select Shows <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* No Corps State */
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md text-center">
            <Card.Body className="py-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gold-500/10 rounded-full flex items-center justify-center">
                <Trophy className="w-7 h-7 text-gold-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-cream mb-2">Start Your Season</h2>
              <p className="text-sm text-cream-500/50 mb-6">Create your first fantasy corps to begin competing!</p>
              <button
                onClick={() => setShowRegistration(true)}
                className="px-5 py-2.5 bg-gold-500 text-charcoal-900 rounded font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
              >
                Register Corps
              </button>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Show Concept Synergy Panel */}
      <AnimatePresence>
        {showSynergyPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSynergyPanel(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-charcoal-950 border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-display font-bold text-cream">Show Concept</h2>
                <button
                  onClick={() => setShowSynergyPanel(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                  aria-label="Close show concept panel"
                >
                  <X className="w-5 h-5 text-cream-500/60" />
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

      {/* Modals */}
      <AnimatePresence>
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
            onClose={() => { setShowAchievementModal(false); clearNewAchievement(); }}
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
      />

      {/* Onboarding Tour for first-time users */}
      <OnboardingTour
        isOpen={showOnboardingTour}
        onClose={() => setShowOnboardingTour(false)}
        onComplete={handleTourComplete}
      />

      {/* Quick Start Guide */}
      <QuickStartGuide
        isOpen={showQuickStartGuide}
        onClose={() => setShowQuickStartGuide(false)}
        onAction={(action) => {
          if (action === 'lineup') {
            setShowCaptionSelection(true);
          }
        }}
        completedSteps={[
          ...(activeCorps?.lineup && Object.keys(activeCorps.lineup).length === 8 ? ['lineup'] : []),
          ...(activeCorps?.selectedShows && Object.values(activeCorps.selectedShows).flat().length > 0 ? ['schedule'] : []),
          ...(myLeagues && myLeagues.length > 0 ? ['league'] : []),
        ]}
      />

      {/* Quick Start Button (floating) */}
      <QuickStartButton
        onClick={() => setShowQuickStartGuide(true)}
        show={!primaryLeague || (activeCorps?.lineup && Object.keys(activeCorps.lineup).length < 8)}
      />
    </>
  );

  return (
    <GameShell>
      {dashboardContent}
    </GameShell>
  );
};

export default Dashboard;
