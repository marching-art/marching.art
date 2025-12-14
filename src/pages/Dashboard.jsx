// src/pages/Dashboard.jsx
// Simplified Fantasy Dashboard - Focus on Corps, Scores, League
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Edit, ChevronRight, Coins, Users,
  Music, Eye, Sparkles, X, Crown, Lock, Unlock, TrendingUp
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
import { getNextClassProgress, XP_SOURCES } from '../utils/captionPricing';

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

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Simplified Dashboard Component
const Dashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const { allShows } = useScoresData();
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
    weeksRemaining,
    currentWeek,
    currentDay,
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

  // Show onboarding tour on first dashboard visit (after onboarding completion)
  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps && !showMorningReport) {
      // Delay tour slightly to let UI settle
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

  // Get recent scores for active corps
  const getRecentScores = () => {
    if (!allShows || !activeCorps) return [];
    const corpsName = activeCorps.corpsName || activeCorps.name;

    return allShows
      .flatMap(show =>
        show.scores
          .filter(s => s.corpsName === corpsName || s.corps === corpsName)
          .map(s => ({
            eventName: show.eventName,
            date: show.date,
            totalScore: s.totalScore || s.score,
            geScore: s.geScore,
            visualScore: s.visualScore,
            musicScore: s.musicScore,
          }))
      )
      .slice(0, 3);
  };

  // Get upcoming shows for this week
  const getThisWeekShows = () => {
    if (!activeCorps?.selectedShows) return [];
    const weekShows = activeCorps.selectedShows[`week${currentWeek}`] || [];
    return weekShows.slice(0, 3);
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

  const recentScores = getRecentScores();
  const thisWeekShows = getThisWeekShows();
  const primaryLeague = getPrimaryLeague();
  const lineup = activeCorps?.lineup || {};
  const lineupCount = Object.keys(lineup).length;

  // Calculate next class unlock progress
  const nextClassProgress = getNextClassProgress(
    profile?.xp || 0,
    profile?.unlockedClasses || ['soundSport'],
    profile?.corpsCoin || 0
  );

  return (
    <div className="min-h-full bg-charcoal-950 p-4 md:p-6">
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

      {/* Simple Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-display font-bold text-cream">Dashboard</h1>
          <span className="text-sm text-cream/50">
            {formatSeasonName(seasonData?.name)} - Week {currentWeek}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 border border-gold-500/20 rounded-lg">
            <Coins className="w-4 h-4 text-gold-400" />
            <span className="text-sm font-bold text-gold-400">{(profile?.corpsCoin || 0).toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* Next Class Unlock Progress */}
      {nextClassProgress && (() => {
        // Static class mappings for Tailwind
        const colorStyles = {
          blue: {
            border: 'border-blue-500/20',
            iconBg: 'bg-blue-500/20',
            iconText: 'text-blue-400',
            text: 'text-blue-400',
            gradient: 'from-blue-500 to-blue-400',
            buttonBg: 'bg-blue-500/10',
            buttonBorder: 'border-blue-500/20',
            buttonHover: 'hover:bg-blue-500/20'
          },
          purple: {
            border: 'border-purple-500/20',
            iconBg: 'bg-purple-500/20',
            iconText: 'text-purple-400',
            text: 'text-purple-400',
            gradient: 'from-purple-500 to-purple-400',
            buttonBg: 'bg-purple-500/10',
            buttonBorder: 'border-purple-500/20',
            buttonHover: 'hover:bg-purple-500/20'
          },
          gold: {
            border: 'border-gold-500/20',
            iconBg: 'bg-gold-500/20',
            iconText: 'text-gold-400',
            text: 'text-gold-400',
            gradient: 'from-gold-500 to-gold-400',
            buttonBg: 'bg-gold-500/10',
            buttonBorder: 'border-gold-500/20',
            buttonHover: 'hover:bg-gold-500/20'
          }
        };
        const styles = colorStyles[nextClassProgress.color] || colorStyles.blue;

        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto mb-6"
          >
            <div className={`bg-charcoal-900 border ${styles.border} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${styles.iconBg} flex items-center justify-center`}>
                    <Lock className={`w-5 h-5 ${styles.iconText}`} />
                  </div>
                  <div>
                    <p className="text-sm text-cream/70">Next Unlock</p>
                    <p className={`font-display font-bold ${styles.text}`}>
                      {nextClassProgress.className}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cream/70">Progress</p>
                  <p className="font-data font-bold text-cream">
                    {nextClassProgress.currentXP.toLocaleString()} / {nextClassProgress.requiredXP.toLocaleString()} XP
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${nextClassProgress.xpProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${styles.gradient} rounded-full`}
                />
              </div>

              {/* XP Sources Hint */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4 text-cream/50">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Weekly: +{XP_SOURCES.weeklyParticipation} XP
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    League Wins: +{XP_SOURCES.leagueWin} XP
                  </span>
                </div>
                {nextClassProgress.canUnlockWithCC && (
                  <button className={`flex items-center gap-1.5 px-3 py-1 ${styles.buttonBg} border ${styles.buttonBorder} rounded ${styles.text} ${styles.buttonHover} transition-colors`}>
                    <Coins className="w-3 h-3" />
                    Unlock with {nextClassProgress.requiredCC.toLocaleString()} CC
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {activeCorps ? (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Corps Switcher (if multiple corps) */}
          {hasMultipleCorps && (
            <div className="flex items-center gap-2">
              {Object.entries(corps)
                .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
                .map(([classId, corpsData]) => (
                  <button
                    key={classId}
                    onClick={() => handleCorpsSwitch(classId)}
                    className={`px-4 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all ${
                      activeCorpsClass === classId
                        ? `${classColors[classId]} shadow-lg`
                        : 'bg-charcoal-800 text-cream/60 hover:text-cream border border-white/10'
                    }`}
                  >
                    {(corpsData.corpsName || corpsData.name || '').slice(0, 15)}
                  </button>
                ))}
            </div>
          )}

          {/* Top Row: Corps Hero + This Week */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* YOUR CORPS - Hero Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              data-tour="corps-card"
              className="lg:col-span-2 bg-charcoal-900 border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-1 rounded text-xs font-display font-bold uppercase tracking-widest ${classColors[activeCorpsClass]}`}>
                      {getCorpsClassName(activeCorpsClass)}
                    </span>
                    {activeCorps.rank && activeCorps.rank <= 10 && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/20 text-gold-400 text-xs font-bold">
                        <Crown size={12} /> Top 10
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-display font-black text-cream uppercase tracking-tight">
                    {activeCorps.corpsName || activeCorps.name || 'Your Corps'}
                  </h2>
                  {activeCorps.location && (
                    <p className="text-sm text-cream/50 mt-1">{activeCorps.location}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-2 rounded-lg hover:bg-white/10 text-cream/40 hover:text-cream transition-colors"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </div>

              {/* Season Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                <div>
                  <div className="text-2xl font-data font-bold text-gold-400">
                    {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-xs text-cream/50 uppercase">Season Score</div>
                </div>
                <div>
                  <div className="text-2xl font-data font-bold text-purple-400">
                    #{activeCorps.rank || '-'}
                  </div>
                  <div className="text-xs text-cream/50 uppercase">Rank</div>
                </div>
                <div>
                  <div className="text-2xl font-data font-bold text-blue-400">
                    {activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0}
                  </div>
                  <div className="text-xs text-cream/50 uppercase">Shows This Week</div>
                </div>
                <div>
                  <div className="text-2xl font-data font-bold text-green-400">
                    {lineupCount}/8
                  </div>
                  <div className="text-xs text-cream/50 uppercase">Lineup Set</div>
                </div>
              </div>
            </motion.div>

            {/* THIS WEEK Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              data-tour="schedule"
              className="bg-charcoal-900 border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-display font-bold text-cream/70 uppercase tracking-wider">This Week</h3>
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>

              {thisWeekShows.length > 0 ? (
                <div className="space-y-3">
                  {thisWeekShows.map((show, idx) => (
                    <div key={idx} className="p-3 bg-charcoal-800 rounded-lg">
                      <div className="text-sm font-semibold text-cream">{show.eventName || show.name || 'Show'}</div>
                      <div className="text-xs text-cream/50">{show.location || show.date || ''}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="w-8 h-8 text-cream/20 mx-auto mb-2" />
                  <p className="text-sm text-cream/50">No shows selected</p>
                </div>
              )}

              <Link
                to="/schedule"
                className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 text-sm font-semibold hover:bg-purple-500/20 transition-colors"
              >
                View Schedule <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          {/* YOUR LINEUP Section */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            data-tour="lineup"
            className="bg-charcoal-900 border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-display font-bold text-cream/70 uppercase tracking-wider">Your Lineup</h3>
                {typeof activeCorps?.showConcept === 'object' && activeCorps.showConcept.theme && (
                  <button
                    onClick={() => setShowSynergyPanel(true)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    {activeCorps.showConcept.theme}
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowCaptionSelection(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gold-500/10 border border-gold-500/20 rounded-lg text-gold-400 text-sm font-semibold hover:bg-gold-500/20 transition-colors"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
            </div>

            {lineupCount > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CAPTIONS.map((caption) => {
                  const value = lineup[caption.id];
                  const parsed = parseLineupValue(value);
                  const categoryColors = {
                    ge: 'border-gold-500/30 bg-gold-500/5',
                    vis: 'border-blue-500/30 bg-blue-500/5',
                    mus: 'border-purple-500/30 bg-purple-500/5',
                  };
                  const textColors = {
                    ge: 'text-gold-400',
                    vis: 'text-blue-400',
                    mus: 'text-purple-400',
                  };

                  return (
                    <div
                      key={caption.id}
                      className={`p-3 rounded-lg border ${categoryColors[caption.category]}`}
                    >
                      <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${textColors[caption.category]}`}>
                        {caption.name}
                      </div>
                      {parsed ? (
                        <>
                          <div className="text-sm font-semibold text-cream truncate">
                            {parsed.name}
                          </div>
                          <div className="text-xs text-cream/50">
                            '{parsed.year?.slice(-2) || '??'}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-cream/30">Not set</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Music className="w-10 h-10 text-cream/20 mx-auto mb-3" />
                <p className="text-sm text-cream/50 mb-4">No lineup configured yet</p>
                <button
                  onClick={() => setShowCaptionSelection(true)}
                  className="px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
                >
                  Build Lineup
                </button>
              </div>
            )}
          </motion.div>

          {/* Bottom Row: League + Recent Scores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEAGUE Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              data-tour="league"
              className="bg-charcoal-900 border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-display font-bold text-cream/70 uppercase tracking-wider">League</h3>
                <Users className="w-4 h-4 text-blue-400" />
              </div>

              {primaryLeague ? (
                <div>
                  <h4 className="text-lg font-display font-bold text-cream mb-2">{primaryLeague.name}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xl font-data font-bold text-blue-400">
                        #{primaryLeague.userRank || '-'}
                      </div>
                      <div className="text-xs text-cream/50">Your Position</div>
                    </div>
                    <div>
                      <div className="text-xl font-data font-bold text-cream/60">
                        {primaryLeague.memberCount || 0}
                      </div>
                      <div className="text-xs text-cream/50">Members</div>
                    </div>
                  </div>
                  <Link
                    to="/leagues"
                    className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-semibold hover:bg-blue-500/20 transition-colors"
                  >
                    View League <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  {/* Pulsing indicator for new users */}
                  <div className="relative w-14 h-14 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full bg-gold-500/20 animate-ping" />
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-gold-500/20 to-blue-500/20 flex items-center justify-center border border-gold-500/30">
                      <Users className="w-7 h-7 text-gold-400" />
                    </div>
                  </div>
                  <h4 className="font-display font-bold text-gold-400 text-lg mb-1">Join a League!</h4>
                  <p className="text-sm text-cream/60 mb-4">
                    Compete with friends and track your rankings together
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/leagues?action=create"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 text-charcoal-900 rounded-lg font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                    >
                      <Trophy className="w-4 h-4" />
                      Create a League
                    </Link>
                    <Link
                      to="/leagues"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-semibold hover:bg-blue-500/20 transition-colors"
                    >
                      Browse Public Leagues <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>

            {/* RECENT SCORES Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="bg-charcoal-900 border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-display font-bold text-cream/70 uppercase tracking-wider">Recent Scores</h3>
                <Trophy className="w-4 h-4 text-gold-400" />
              </div>

              {recentScores.length > 0 ? (
                <div className="space-y-3">
                  {recentScores.map((score, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-charcoal-800 rounded-lg">
                      <div>
                        <div className="text-sm font-semibold text-cream">{score.eventName}</div>
                        <div className="text-xs text-cream/50">{score.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-data font-bold text-gold-400">
                          {typeof score.totalScore === 'number' ? score.totalScore.toFixed(2) : score.totalScore}
                        </div>
                        {(score.geScore || score.visualScore || score.musicScore) && (
                          <div className="flex items-center gap-2 text-xs text-cream/40">
                            <span className="text-gold-400/60">GE:{score.geScore?.toFixed(0) || '-'}</span>
                            <span className="text-blue-400/60">VIS:{score.visualScore?.toFixed(0) || '-'}</span>
                            <span className="text-purple-400/60">MUS:{score.musicScore?.toFixed(0) || '-'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Trophy className="w-8 h-8 text-cream/20 mx-auto mb-2" />
                  <p className="text-sm text-cream/50">No scores yet</p>
                </div>
              )}

              <Link
                to="/leaderboard"
                className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-lg text-gold-400 text-sm font-semibold hover:bg-gold-500/20 transition-colors"
              >
                View Leaderboard <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      ) : (
        /* No Corps State */
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center p-8 bg-charcoal-900 border border-white/10 rounded-xl max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-gold-500/10 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-gold-400" />
            </div>
            <h2 className="text-2xl font-display font-bold text-cream mb-2">Welcome to Marching.Art</h2>
            <p className="text-sm text-cream/50 mb-6">Create your first fantasy corps to begin your journey!</p>
            <button
              onClick={() => setShowRegistration(true)}
              className="px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg font-display font-bold uppercase tracking-wide hover:bg-gold-400 transition-colors"
            >
              Register Corps
            </button>
          </div>
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
                <button onClick={() => setShowSynergyPanel(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-cream/60" />
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

      {/* Quick Start Button (floating) - show for new users */}
      <QuickStartButton
        onClick={() => setShowQuickStartGuide(true)}
        show={!primaryLeague || (activeCorps?.lineup && Object.keys(activeCorps.lineup).length < 8)}
      />
    </div>
  );
};

export default Dashboard;
