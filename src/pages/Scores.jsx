// src/pages/Scores.jsx
// Unified hub for scores, rankings, and statistics
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  TrendingUp,
  Clock,
  Award,
  BarChart3,
  Music
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, startAfter } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';
import toast from 'react-hot-toast';

// Import modular tab components
import LatestScoresTab from '../components/Scores/tabs/LatestScoresTab';
import RankingsTab from '../components/Scores/tabs/RankingsTab';
import StatsTab from '../components/Scores/tabs/StatsTab';
import SoundSportTab from '../components/Scores/tabs/SoundSportTab';
import ShowDetailModal from '../components/Scores/ShowDetailModal';

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();

  // Use global season store instead of fetching independently
  const seasonData = useSeasonStore((state) => state.seasonData);
  const seasonUid = useSeasonStore((state) => state.seasonUid);

  // Main tab state
  const [activeTab, setActiveTab] = useState('latest');
  const [loading, setLoading] = useState(true);

  // Scores data
  const [allShows, setAllShows] = useState([]); // All shows grouped by day
  const [selectedDay, setSelectedDay] = useState(null); // Current day being viewed
  const [availableDays, setAvailableDays] = useState([]); // Days with shows
  const [selectedShow, setSelectedShow] = useState(null);
  const [stats, setStats] = useState({ recentShows: 0, topScore: '-', corpsActive: 0 });

  // Extract user's corps names for highlighting in the Latest Scores feed
  const userCorpsNames = React.useMemo(() => {
    if (!loggedInProfile?.corps) return [];
    return Object.values(loggedInProfile.corps)
      .filter(corps => corps?.corpsName)
      .map(corps => corps.corpsName);
  }, [loggedInProfile?.corps]);

  // Rankings/Leaderboard data
  const [leaderboardData, setLeaderboardData] = useState({
    overall: [],
    weekly: [],
    monthly: [],
    lifetime: []
  });
  const [rankingsTab, setRankingsTab] = useState('overall');
  const [activeClass, setActiveClass] = useState('world');
  const [userRank, setUserRank] = useState(null);
  const [lifetimeView, setLifetimeView] = useState('totalPoints');

  // Pagination state
  const [lastDocs, setLastDocs] = useState({ overall: null, weekly: null, monthly: null });
  const [hasMore, setHasMore] = useState({ overall: false, weekly: false, monthly: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 25;

  // Main tabs configuration
  const mainTabs = [
    { id: 'latest', name: 'Latest Scores', icon: Clock },
    { id: 'rankings', name: 'Rankings', icon: Trophy },
    { id: 'stats', name: 'Stats', icon: BarChart3 },
    { id: 'soundsport', name: 'SoundSport', icon: Music }
  ];

  // Complete the daily challenge for checking scores/leaderboard
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  // Fetch scores data (all shows with day-based organization)
  useEffect(() => {
    const fetchScoresData = async () => {
      if (!seasonUid) return;
      if (activeTab !== 'latest' && activeTab !== 'soundsport') return;

      try {
        setLoading(true);
        const recapRef = doc(db, 'fantasy_recaps', seasonUid);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();
          const recaps = data.recaps || [];

          // Process all shows and group by day
          const shows = recaps.flatMap(recap =>
            recap.shows?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: recap.date?.toDate?.().toLocaleDateString() || 'TBD',
              offSeasonDay: recap.offSeasonDay,
              scores: show.results?.map(result => ({
                corps: result.corpsName,
                score: result.totalScore || 0,
                geScore: result.geScore || 0,
                visualScore: result.visualScore || 0,
                musicScore: result.musicScore || 0,
                corpsClass: result.corpsClass
              })).sort((a, b) => b.score - a.score) || []
            })) || []
          ).sort((a, b) => b.offSeasonDay - a.offSeasonDay);

          setAllShows(shows);

          // Get unique days that have shows (sorted descending - most recent first)
          const days = [...new Set(shows.map(s => s.offSeasonDay))].sort((a, b) => b - a);
          setAvailableDays(days);

          // Set selected day to most recent if not already set
          if (days.length > 0 && selectedDay === null) {
            setSelectedDay(days[0]);
          }

          // Calculate stats
          const allScores = shows.flatMap(show => show.scores.map(s => s.score));
          const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(3) : '-';
          const uniqueCorps = new Set(shows.flatMap(show => show.scores.map(s => s.corps)));

          setStats({
            recentShows: shows.length,
            topScore,
            corpsActive: uniqueCorps.size
          });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching scores:', error);
        setLoading(false);
      }
    };

    fetchScoresData();
  }, [activeTab, seasonUid]);

  // Fetch leaderboard data with pagination
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      if (activeTab !== 'rankings' && activeTab !== 'stats') return;

      setLoading(true);
      // Reset pagination when filters change
      setLastDocs({ overall: null, weekly: null, monthly: null });
      setHasMore({ overall: false, weekly: false, monthly: false });

      try {
        const safeCollectionFetch = async (collectionPath, orderField = 'score') => {
          try {
            const collRef = collection(db, ...collectionPath);
            const q = query(collRef, orderBy(orderField, 'desc'), limit(PAGE_SIZE));
            const snapshot = await getDocs(q);
            const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
            const hasMoreDocs = snapshot.docs.length === PAGE_SIZE;
            return {
              data: snapshot.docs.map((doc, index) => ({
                id: doc.id,
                rank: index + 1,
                ...doc.data()
              })),
              lastDoc: lastVisible,
              hasMore: hasMoreDocs
            };
          } catch (err) {
            console.log(`Collection ${collectionPath.join('/')} not found or empty`);
            return { data: [], lastDoc: null, hasMore: false };
          }
        };

        // Fetch overall leaderboard
        const overallResult = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'overall', activeClass]
        );

        // Fetch weekly leaderboard
        const weeklyResult = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'weekly', activeClass]
        );

        // Fetch monthly leaderboard
        const monthlyResult = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'monthly', activeClass]
        );

        // Fetch lifetime stats (single document, no pagination needed)
        let sortedLifetimeData = [];
        try {
          const lifetimeRef = doc(db, `artifacts/${dataNamespace}/leaderboard/lifetime_${lifetimeView}/data`);
          const lifetimeDoc = await getDoc(lifetimeRef);

          if (lifetimeDoc.exists()) {
            const lifetimeLeaderboard = lifetimeDoc.data();
            sortedLifetimeData = (lifetimeLeaderboard.entries || []).map((entry, index) => ({
              id: entry.userId,
              rank: index + 1,
              username: entry.username,
              userTitle: entry.userTitle,
              lifetimeStats: entry.lifetimeStats
            }));
          }
        } catch (err) {
          console.log('Lifetime leaderboard not available yet');
        }

        setLeaderboardData({
          overall: overallResult.data,
          weekly: weeklyResult.data,
          monthly: monthlyResult.data,
          lifetime: sortedLifetimeData
        });

        setLastDocs({
          overall: overallResult.lastDoc,
          weekly: weeklyResult.lastDoc,
          monthly: monthlyResult.lastDoc
        });

        setHasMore({
          overall: overallResult.hasMore,
          weekly: weeklyResult.hasMore,
          monthly: monthlyResult.hasMore
        });

        // Find user's rank if logged in
        if (user && loggedInProfile?.username) {
          const userData = overallResult.data.find(entry => entry.username === loggedInProfile.username);
          if (userData) {
            setUserRank(userData.rank);
          }
        }

      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        if (error.code !== 'permission-denied' && error.code !== 'not-found') {
          toast.error('Failed to load leaderboard data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [activeTab, activeClass, user, loggedInProfile, lifetimeView]);

  // Load more leaderboard entries
  const loadMoreLeaderboard = async () => {
    if (loadingMore || !hasMore[rankingsTab] || !lastDocs[rankingsTab]) return;

    setLoadingMore(true);
    try {
      const collRef = collection(db, 'artifacts', dataNamespace, 'leaderboard', rankingsTab, activeClass);
      const q = query(
        collRef,
        orderBy('score', 'desc'),
        startAfter(lastDocs[rankingsTab]),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);

      const currentLength = leaderboardData[rankingsTab].length;
      const newData = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        rank: currentLength + index + 1,
        ...doc.data()
      }));

      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

      setLeaderboardData(prev => ({
        ...prev,
        [rankingsTab]: [...prev[rankingsTab], ...newData]
      }));

      setLastDocs(prev => ({
        ...prev,
        [rankingsTab]: lastVisible
      }));

      setHasMore(prev => ({
        ...prev,
        [rankingsTab]: snapshot.docs.length === PAGE_SIZE
      }));

    } catch (error) {
      console.error('Error loading more:', error);
      toast.error('Failed to load more entries');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="!text-3xl md:!text-5xl font-display font-black uppercase tracking-tighter text-charcoal-950 dark:text-cream-100 mb-4">
          Scores & Rankings
        </h1>
        <p className="text-slate-600 dark:text-cream-300">
          Results, player rankings, and performance statistics
        </p>
      </motion.div>

      {/* Stadium Scoreboard Metrics */}
      <div className="flex overflow-x-auto space-x-4 pb-4 md:grid md:grid-cols-3 md:gap-6 md:space-x-0 md:pb-0 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-shrink-0 w-[160px] md:w-auto bg-white dark:bg-charcoal-900 border-2 border-black dark:border-gold-500 shadow-hard dark:shadow-brutal-gold rounded-sm p-4 relative"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-black dark:text-cream-300">
            Recent Shows
          </span>
          <Calendar className="w-5 h-5 text-black dark:text-cream-100 absolute top-4 right-4" aria-hidden="true" />
          <p className="text-4xl md:text-5xl font-mono font-bold text-black dark:text-cream-100 text-center my-4">
            {stats.recentShows}
          </p>
          <p className="text-xs font-mono text-muted dark:text-cream-500/60 text-center">
            Last 30 Days
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-shrink-0 w-[160px] md:w-auto bg-white dark:bg-charcoal-900 border-2 border-black dark:border-gold-500 shadow-hard dark:shadow-brutal-gold rounded-sm p-4 relative"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-black dark:text-cream-300">
            Top Score
          </span>
          <TrendingUp className="w-5 h-5 text-black dark:text-cream-100 absolute top-4 right-4" aria-hidden="true" />
          <p className="text-4xl md:text-5xl font-mono font-bold text-black dark:text-cream-100 text-center my-4">
            {stats.topScore}
          </p>
          <p className="text-xs font-mono text-muted dark:text-cream-500/60 text-center">
            Season High
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-shrink-0 w-[160px] md:w-auto bg-white dark:bg-charcoal-900 border-2 border-black dark:border-gold-500 shadow-hard dark:shadow-brutal-gold rounded-sm p-4 relative"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-black dark:text-cream-300">
            Corps Active
          </span>
          <Award className="w-5 h-5 text-black dark:text-cream-100 absolute top-4 right-4" aria-hidden="true" />
          <p className="text-4xl md:text-5xl font-mono font-bold text-black dark:text-cream-100 text-center my-4">
            {stats.corpsActive}
          </p>
          <p className="text-xs font-mono text-muted dark:text-cream-500/60 text-center">
            This Season
          </p>
        </motion.div>
      </div>

      {/* Main Tabs - Mechanical Segmented Control */}
      <div className="flex justify-center -mx-4 px-4 md:mx-0 md:px-0">
        <div className="inline-flex border-2 border-charcoal-900 dark:border-cream-100 rounded-sm overflow-hidden">
          {mainTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLast = index === mainTabs.length - 1;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 font-bold uppercase tracking-wide transition-all whitespace-nowrap text-xs md:text-sm ${
                  isActive
                    ? 'bg-charcoal-900 dark:bg-cream-100 text-gold-400 dark:text-charcoal-900'
                    : 'bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-charcoal-800'
                } ${!isLast ? 'border-r-2 border-charcoal-900 dark:border-cream-100' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'latest' && (
            <LatestScoresTab
              loading={loading}
              allShows={allShows}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              availableDays={availableDays}
              setSelectedShow={setSelectedShow}
              userCorpsNames={userCorpsNames}
            />
          )}
          {activeTab === 'rankings' && (
            <RankingsTab
              loading={loading}
              leaderboardData={leaderboardData}
              rankingsTab={rankingsTab}
              setRankingsTab={setRankingsTab}
              activeClass={activeClass}
              setActiveClass={setActiveClass}
              userRank={userRank}
              loggedInProfile={loggedInProfile}
              user={user}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMoreLeaderboard={loadMoreLeaderboard}
            />
          )}
          {activeTab === 'stats' && (
            <StatsTab
              loading={loading}
              lifetimeData={leaderboardData.lifetime}
              lifetimeView={lifetimeView}
              setLifetimeView={setLifetimeView}
              loggedInProfile={loggedInProfile}
            />
          )}
          {activeTab === 'soundsport' && (
            <SoundSportTab
              loading={loading}
              allShows={allShows}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Show Detail Modal */}
      {selectedShow && (
        <ShowDetailModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </div>
  );
};

export default Scores;
