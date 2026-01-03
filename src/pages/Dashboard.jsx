// =============================================================================
// DASHBOARD - DAILY BRIEFING TERMINAL
// =============================================================================
// Dense, data-rich "Command Center" layout. ESPN/Bloomberg inspired.
// Laws: App Shell, widget grid, ticker header, no glow

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Edit, ChevronRight, Users, TrendingUp, TrendingDown,
  Activity, Medal, FileText, Swords, Radio, Clock, Zap,
  Calendar, DollarSign, Newspaper, CheckCircle, Circle
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Lazy-load large modals
const CaptionSelectionModal = lazy(() => import('../components/CaptionSelection/CaptionSelectionModal'));
const SeasonSetupWizard = lazy(() => import('../components/SeasonSetupWizard'));
const NewsSubmissionModal = lazy(() => import('../components/modals/NewsSubmissionModal'));

import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  OnboardingTour,
  QuickStartGuide,
} from '../components/Dashboard';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { useTickerData } from '../hooks/useTickerData';
import { retireCorps } from '../firebase/functions';
import { submitNewsForApproval, registerCorps, unlockClassWithCorpsCoin, getRecentNews } from '../api/functions';
import ClassPurchaseModal from '../components/modals/ClassPurchaseModal';
import { useHaptic } from '../hooks/useHaptic';
import { useModalQueue, MODAL_PRIORITY } from '../hooks/useModalQueue';
import { useSeasonStore } from '../store/seasonStore';

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

const CLASS_UNLOCK_LEVELS = { aClass: 3, open: 5, world: 10 };
const CLASS_UNLOCK_COSTS = { aClass: 1000, open: 2500, world: 5000 };
const CLASS_DISPLAY_NAMES = { aClass: 'A Class', open: 'Open Class', world: 'World Class' };

// =============================================================================
// WIDGET COMPONENTS
// =============================================================================

// Widget wrapper with standard header
const Widget = ({ title, icon: Icon, iconColor = 'text-gray-400', action, children }) => (
  <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
    <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center justify-between">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

// Ticker Item - CorpsCoin price display
const TickerItem = ({ abbr, change, isPositive }) => (
  <span className="inline-flex items-center gap-1.5 px-2">
    <span className="text-xs font-bold text-white font-data">{abbr}</span>
    <span className={`text-xs font-bold font-data tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
      {isPositive ? '+' : ''}{change}
    </span>
  </span>
);

// Next Up Widget - Shows next matchup or show
const NextUpWidget = ({ activeCorps, currentWeek, userMatchup, memberProfiles, userProfile }) => {
  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 2);
  }, [activeCorps?.selectedShows, currentWeek]);

  const hasLiveShow = thisWeekShows.length > 0;

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  return (
    <Widget title="Next Up" icon={Swords} iconColor="text-purple-500">
      <div className="p-3">
        {userMatchup ? (
          <div className="bg-[#222] border border-[#333] p-3">
            {/* Matchup Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Week {currentWeek} Matchup</span>
              {hasLiveShow && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 text-red-500 text-[9px] font-bold">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            {/* Versus Strip */}
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-400">
                    {getDisplayName(userMatchup.user1).charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-bold text-white truncate">
                  {getDisplayName(userMatchup.user1)}
                </span>
              </div>

              <div className="px-2 py-1 bg-[#111]">
                <span className="text-xs text-gray-500">VS</span>
              </div>

              <div className="flex-1 flex items-center gap-2 justify-end">
                <span className="text-sm font-bold text-white truncate">
                  {getDisplayName(userMatchup.user2)}
                </span>
                <div className="w-8 h-8 bg-[#333] flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-400">
                    {getDisplayName(userMatchup.user2).charAt(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : thisWeekShows.length > 0 ? (
          <div className="space-y-2">
            {thisWeekShows.map((show, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-[#222] border border-[#333]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-sm text-white truncate">{show.eventName || show.name}</span>
                </div>
                {idx === 0 && hasLiveShow && (
                  <span className="text-[9px] font-bold text-red-500">TODAY</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Calendar className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No shows scheduled</p>
            <Link to="/schedule" className="text-[10px] text-yellow-500 hover:underline">
              View Schedule →
            </Link>
          </div>
        )}
      </div>
    </Widget>
  );
};

// League Pulse Widget - User's league ranks
const LeaguePulseWidget = ({ leagues }) => (
  <Widget
    title="League Pulse"
    icon={Users}
    iconColor="text-blue-500"
    action={
      <Link to="/leagues" className="text-[10px] text-gray-500 hover:text-white flex items-center gap-0.5">
        All <ChevronRight className="w-3 h-3" />
      </Link>
    }
  >
    {leagues && leagues.length > 0 ? (
      <div className="divide-y divide-[#222]">
        {leagues.slice(0, 4).map((league, idx) => (
          <Link
            key={league.id || idx}
            to="/leagues"
            className="flex items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 bg-[#333] flex items-center justify-center flex-shrink-0">
                <Trophy className="w-3 h-3 text-yellow-500" />
              </div>
              <span className="text-sm text-white truncate">{league.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold text-white font-data">#{league.userRank || '-'}</span>
              {league.rankChange > 0 && (
                <span className="text-[10px] text-green-500 flex items-center">
                  <TrendingUp className="w-3 h-3" />
                </span>
              )}
              {league.rankChange < 0 && (
                <span className="text-[10px] text-red-500 flex items-center">
                  <TrendingDown className="w-3 h-3" />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <div className="p-4 text-center">
        <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500 mb-2">No leagues joined</p>
        <Link
          to="/leagues"
          className="inline-block text-[10px] px-3 py-1.5 bg-[#0057B8] text-white font-bold hover:bg-[#0066d6]"
        >
          Join League
        </Link>
      </div>
    )}
  </Widget>
);

// Headlines Widget - Text-only news
const HeadlinesWidget = ({ news, loading }) => (
  <Widget
    title="Headlines"
    icon={Newspaper}
    iconColor="text-yellow-500"
    action={
      <Link to="/news" className="text-[10px] text-gray-500 hover:text-white flex items-center gap-0.5">
        More <ChevronRight className="w-3 h-3" />
      </Link>
    }
  >
    {loading ? (
      <div className="p-4 text-center">
        <Activity className="w-5 h-5 text-gray-500 mx-auto animate-pulse" />
      </div>
    ) : news && news.length > 0 ? (
      <div className="divide-y divide-[#222]">
        {news.slice(0, 4).map((story, idx) => (
          <Link
            key={story.id || idx}
            to="/news"
            className="flex items-start gap-2 px-3 py-2.5 hover:bg-[#222] transition-colors"
          >
            <span className={`text-[9px] font-bold px-1 py-0.5 flex-shrink-0 ${
              story.category === 'dci' ? 'bg-yellow-500/20 text-yellow-500' :
              story.category === 'fantasy' ? 'bg-purple-500/20 text-purple-500' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {story.category?.toUpperCase() || 'NEWS'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white leading-tight line-clamp-2">{story.headline}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {story.timeAgo || 'Recently'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <div className="p-4 text-center text-xs text-gray-500">
        No news available
      </div>
    )}
  </Widget>
);

// Financials Widget - CorpsCoin balance
const FinancialsWidget = ({ corpsCoin, xp, xpLevel, streak }) => (
  <Widget title="Director Stats" icon={DollarSign} iconColor="text-green-500">
    <div className="p-3 grid grid-cols-2 gap-2">
      <div className="bg-[#222] p-2.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">CorpsCoin</p>
        <p className="text-lg font-bold text-yellow-500 font-data tabular-nums">
          {(corpsCoin || 0).toLocaleString()}
        </p>
      </div>
      <div className="bg-[#222] p-2.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Level</p>
        <p className="text-lg font-bold text-purple-500 font-data tabular-nums">
          {xpLevel || 1}
        </p>
      </div>
      <div className="bg-[#222] p-2.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">XP</p>
        <p className="text-lg font-bold text-blue-500 font-data tabular-nums">
          {(xp || 0).toLocaleString()}
        </p>
      </div>
      <div className="bg-[#222] p-2.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Streak</p>
        <p className="text-lg font-bold text-orange-500 font-data tabular-nums flex items-center justify-center gap-1">
          <Zap className="w-4 h-4" />
          {streak || 0}
        </p>
      </div>
    </div>
  </Widget>
);

// Season Prep Checklist - Off-season state
const SeasonPrepWidget = ({ profile, activeCorps, leagues, lineupCount }) => {
  const tasks = [
    { id: 'corps', label: 'Register Corps', done: !!activeCorps, link: null },
    { id: 'lineup', label: 'Draft 8 Captions', done: lineupCount === 8, link: '/draft' },
    { id: 'league', label: 'Join a League', done: leagues?.length > 0, link: '/leagues' },
    { id: 'schedule', label: 'Select Shows', done: activeCorps?.selectedShows && Object.keys(activeCorps.selectedShows).length > 0, link: '/schedule' },
  ];

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <Widget title="Season Prep" icon={CheckCircle} iconColor="text-green-500">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">{completedCount}/{tasks.length} complete</span>
          <div className="flex-1 ml-3 h-1.5 bg-[#222] overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {task.done ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-600" />
                )}
                <span className={`text-sm ${task.done ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {task.label}
                </span>
              </div>
              {!task.done && task.link && (
                <Link to={task.link} className="text-[10px] text-yellow-500 hover:underline">
                  Go →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </Widget>
  );
};

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const { aggregatedScores, loading: scoresLoading, refetch: refetchScores } = useScoresData();
  const { data: myLeagues, refetch: refetchLeagues } = useMyLeagues(user?.uid);
  const { tickerData, hasData: hasTickerData } = useTickerData();
  const { trigger: haptic } = useHaptic();
  const { weeksRemaining, isRegistrationLocked } = useSeasonStore();

  // News state
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Modal states
  const modalQueue = useModalQueue();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [showQuickStartGuide, setShowQuickStartGuide] = useState(false);
  const [showNewsSubmission, setShowNewsSubmission] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);
  const [classToPurchase, setClassToPurchase] = useState(null);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
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

  // Computed values
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  const lineupCount = useMemo(() => Object.keys(lineup).length, [lineup]);
  const userCorpsScore = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps]);
  const userCorpsRank = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.rank ?? null;
  }, [aggregatedScores, activeCorps]);

  // Mock user matchup from leagues (would come from real data)
  const userMatchup = useMemo(() => {
    if (!myLeagues?.length || !user?.uid) return null;
    // This would be populated from actual matchup data
    return null;
  }, [myLeagues, user?.uid]);

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const result = await getRecentNews({ limit: 5 });
        if (result.data?.news) {
          setNews(result.data.news.map(story => ({
            ...story,
            timeAgo: formatTimeAgo(story.publishedAt)
          })));
        }
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);

  // Format time ago helper
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  // Queue auto-triggered modals
  useEffect(() => {
    if (showSeasonSetupWizard && seasonData) {
      modalQueue.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP, { seasonData });
    }
  }, [showSeasonSetupWizard, seasonData, modalQueue.enqueue]);

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        modalQueue.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, modalQueue.enqueue]);

  useEffect(() => {
    if (newlyUnlockedClass) {
      modalQueue.enqueue('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, { unlockedClass: newlyUnlockedClass });
    }
  }, [newlyUnlockedClass, modalQueue.enqueue]);

  useEffect(() => {
    if (newAchievement) {
      modalQueue.enqueue('achievement', MODAL_PRIORITY.ACHIEVEMENT, { achievement: newAchievement });
    }
  }, [newAchievement, modalQueue.enqueue]);

  useEffect(() => {
    const userModalOpen = showRegistration || showCaptionSelection || showEditCorps ||
                          showDeleteConfirm || showMoveCorps || showRetireConfirm;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [showRegistration, showCaptionSelection, showEditCorps, showDeleteConfirm, showMoveCorps, showRetireConfirm, modalQueue]);

  // Handlers
  const handleTourComplete = useCallback(async () => {
    modalQueue.dequeue();
    if (profile?.isFirstVisit && user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { isFirstVisit: false });
      } catch (error) {
        console.error('Error updating first visit flag:', error);
      }
    }
  }, [modalQueue, profile?.isFirstVisit, user]);

  const handleSetupNewClass = useCallback(() => {
    modalQueue.dequeue();
    setShowRegistration(true);
  }, [modalQueue]);

  const handleDeclineSetup = useCallback(() => {
    modalQueue.dequeue();
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  }, [modalQueue, clearNewlyUnlockedClass]);

  const handleAchievementClose = useCallback(() => {
    modalQueue.dequeue();
    clearNewAchievement();
  }, [modalQueue, clearNewAchievement]);

  const handleSeasonSetupClose = useCallback(() => {
    modalQueue.dequeue();
    setShowSeasonSetupWizard(false);
  }, [modalQueue, setShowSeasonSetupWizard]);

  const handleEditCorps = useCallback(async (formData) => {
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
  }, [user, activeCorpsClass]);

  const handleDeleteCorps = useCallback(async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete corps');
    }
  }, [user, activeCorpsClass]);

  const handleRetireCorps = useCallback(async () => {
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
  }, [activeCorpsClass]);

  const handleMoveCorps = useCallback(async (targetClass) => {
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
  }, [corps, getCorpsClassName, user, activeCorps, activeCorpsClass]);

  const handleCorpsRegistration = useCallback(async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded');
        return;
      }
      const result = await registerCorps({
        corpsName: formData.name,
        location: formData.location,
        showConcept: formData.showConcept || '',
        class: formData.class
      });
      if (result.data.success) {
        toast.success(`${formData.name} registered!`);
        setShowRegistration(false);
        clearNewlyUnlockedClass();
        refreshProfile?.();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to register corps');
    }
  }, [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile]);

  const handleNewsSubmission = useCallback(async (formData) => {
    setSubmittingNews(true);
    try {
      const result = await submitNewsForApproval(formData);
      if (result.data.success) {
        toast.success('Article submitted for review!');
        setShowNewsSubmission(false);
      } else {
        toast.error(result.data.message || 'Failed to submit article');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit article');
    } finally {
      setSubmittingNews(false);
    }
  }, []);

  const handleClassUnlock = useCallback((classKey) => {
    setClassToPurchase(classKey);
  }, []);

  const handleConfirmClassPurchase = useCallback(async () => {
    if (!classToPurchase) return;
    try {
      const result = await unlockClassWithCorpsCoin({ classToUnlock: classToPurchase });
      if (result.data.success) {
        toast.success(`${CLASS_DISPLAY_NAMES[classToPurchase]} unlocked!`);
        setClassToPurchase(null);
        refreshProfile?.();
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to unlock class');
    }
  }, [classToPurchase, refreshProfile]);

  const openCaptionSelection = useCallback((captionId = null) => {
    setSelectedCaption(captionId);
    setShowCaptionSelection(true);
  }, []);

  // Get ticker movers for display
  const tickerMovers = useMemo(() => {
    if (!hasTickerData) return [];
    const movers = [];
    Object.values(tickerData.byClass || {}).forEach(classData => {
      classData.movers?.slice(0, 3).forEach(mover => {
        movers.push({
          abbr: mover.name,
          change: mover.change,
          isPositive: mover.direction === 'up'
        });
      });
    });
    return movers.slice(0, 6);
  }, [tickerData, hasTickerData]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Season Setup Wizard */}
      {modalQueue.isActive('seasonSetup') && seasonData && (
        <Suspense fallback={null}>
          <SeasonSetupWizard
            onComplete={() => { handleSeasonSetupComplete(); handleSeasonSetupClose(); }}
            profile={profile}
            seasonData={seasonData}
            corpsNeedingSetup={corpsNeedingSetup}
            existingCorps={corps || {}}
            retiredCorps={profile?.retiredCorps || []}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
          />
        </Suspense>
      )}

      {/* THE TICKER - Fixed Header */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Market Status */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Season:</span>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-bold">
              {seasonData?.status === 'active' ? 'OPEN' : 'PREP'}
            </span>
            {currentWeek && (
              <span className="text-[10px] text-gray-400">Week {currentWeek}</span>
            )}
          </div>

          {/* CorpsCoin Ticker */}
          <div className="flex items-center gap-1 overflow-hidden">
            {tickerMovers.length > 0 ? (
              <div className="flex items-center">
                {tickerMovers.map((item, idx) => (
                  <TickerItem key={idx} {...item} />
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-gray-500 italic">No market data</span>
            )}
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        {activeCorps ? (
          <>
            {/* Corps Status Strip */}
            <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#333] border border-[#444] flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        {activeCorps.corpsName || activeCorps.name}
                      </h2>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#222] text-gray-400 uppercase">
                        {CLASS_LABELS[activeCorpsClass]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Rank #{userCorpsRank || '-'}</span>
                      <span>Score: {userCorpsScore?.toFixed(2) || '-'}</span>
                      <span>Lineup: {lineupCount}/8</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-2 text-gray-500 hover:text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Widget Grid */}
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Next Up Widget */}
              <NextUpWidget
                activeCorps={activeCorps}
                currentWeek={currentWeek}
                userMatchup={userMatchup}
                memberProfiles={{}}
                userProfile={profile}
              />

              {/* League Pulse Widget */}
              <LeaguePulseWidget leagues={myLeagues} />

              {/* Headlines Widget */}
              <HeadlinesWidget news={news} loading={newsLoading} />

              {/* Financials Widget */}
              <FinancialsWidget
                corpsCoin={profile?.corpsCoin}
                xp={profile?.xp}
                xpLevel={profile?.xpLevel}
                streak={engagementData?.loginStreak}
              />

              {/* Season Prep (if needed) */}
              {lineupCount < 8 && (
                <div className="md:col-span-2">
                  <SeasonPrepWidget
                    profile={profile}
                    activeCorps={activeCorps}
                    leagues={myLeagues}
                    lineupCount={lineupCount}
                  />
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => openCaptionSelection()}
                className="flex items-center justify-center gap-2 p-3 bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:border-[#444]"
              >
                <Edit className="w-4 h-4" />
                <span className="text-sm">Edit Lineup</span>
              </button>
              <button
                onClick={() => setShowNewsSubmission(true)}
                className="flex items-center justify-center gap-2 p-3 bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:border-[#444]"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">Submit News</span>
              </button>
            </div>
          </>
        ) : (
          /* No Corps State */
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="bg-[#1a1a1a] border border-[#333] max-w-sm w-full">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Start Your Season
                </h3>
              </div>
              <div className="p-6 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-4">
                  Create your first fantasy corps to begin competing.
                </p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="w-full py-3 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6]"
                >
                  Register Corps
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modalQueue.isActive('classUnlock') && newlyUnlockedClass && (
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
        <Suspense fallback={null}>
          <CaptionSelectionModal
            onClose={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            onSubmit={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={seasonData.seasonUid}
            initialCaption={selectedCaption}
          />
        </Suspense>
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

      {modalQueue.isActive('achievement') && newAchievement && (
        <AchievementModal
          onClose={handleAchievementClose}
          achievements={profile?.achievements || []}
          newAchievement={newAchievement}
        />
      )}

      <OnboardingTour
        isOpen={modalQueue.isActive('onboarding')}
        onClose={() => modalQueue.dequeue()}
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
          ...(activeCorps?.selectedShows && Object.keys(activeCorps.selectedShows).length > 0 ? ['schedule'] : []),
          ...(myLeagues?.length > 0 ? ['league'] : []),
        ]}
      />

      {showNewsSubmission && (
        <Suspense fallback={null}>
          <NewsSubmissionModal
            onClose={() => setShowNewsSubmission(false)}
            onSubmit={handleNewsSubmission}
            isSubmitting={submittingNews}
          />
        </Suspense>
      )}

      {classToPurchase && profile && (
        <ClassPurchaseModal
          classKey={classToPurchase}
          className={CLASS_DISPLAY_NAMES[classToPurchase]}
          coinCost={CLASS_UNLOCK_COSTS[classToPurchase]}
          currentBalance={profile.corpsCoin || 0}
          levelRequired={CLASS_UNLOCK_LEVELS[classToPurchase]}
          currentLevel={profile.xpLevel || 1}
          weeksRemaining={weeksRemaining}
          isRegistrationLocked={isRegistrationLocked(classToPurchase)}
          onConfirm={handleConfirmClassPurchase}
          onClose={() => setClassToPurchase(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
