// src/pages/Leagues.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, Plus, Search, Crown, TrendingUp, Award,
  Calendar, X, Check, Shield, Star, AlertCircle, Lock,
  MessageSquare, Settings, ArrowLeftRight, Flame, Target,
  ChevronDown, ChevronRight, Medal, Zap, MapPin, Music,
  Eye, Sparkles, CircleDot
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, onSnapshot, orderBy, limit as firestoreLimit, getDoc, startAfter } from 'firebase/firestore';
import {
  createLeague,
  joinLeague,
  leaveLeague,
  proposeStaffTrade,
  respondToStaffTrade,
  postLeagueMessage
} from '../firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../components/Portal';

// Placement points - DCI/NASCAR style scoring
const PLACEMENT_POINTS = {
  1: 15, 2: 12, 3: 10, 4: 8, 5: 6,
  6: 5, 7: 4, 8: 3, 9: 2, 10: 1
};

const getPlacementPoints = (placement) => {
  return PLACEMENT_POINTS[placement] || 1;
};

const LEAGUES_PAGE_SIZE = 12;

const Leagues = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('browse'); // browse, league
  const [activeTab, setActiveTab] = useState('my-leagues');
  const [myLeagues, setMyLeagues] = useState([]);
  const [availableLeagues, setAvailableLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);

  // Pagination state
  const [lastLeagueDoc, setLastLeagueDoc] = useState(null);
  const [hasMoreLeagues, setHasMoreLeagues] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadMyLeagues();
      loadAvailableLeagues();
    }
  }, [user]);

  const loadUserProfile = () => {
    const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    });
    return unsubscribe;
  };

  const loadMyLeagues = async () => {
    try {
      const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
      const q = query(
        leaguesRef,
        where('members', 'array-contains', user.uid),
        firestoreLimit(20) // Users typically won't be in more than 20 leagues
      );

      const querySnapshot = await getDocs(q);
      const leagues = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMyLeagues(leagues);
    } catch (error) {
      console.error('Error loading my leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableLeagues = async (loadMore = false) => {
    if (loadMore && loadingMore) return;

    try {
      if (loadMore) setLoadingMore(true);

      const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
      let q;

      if (loadMore && lastLeagueDoc) {
        q = query(
          leaguesRef,
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(lastLeagueDoc),
          firestoreLimit(LEAGUES_PAGE_SIZE)
        );
      } else {
        q = query(
          leaguesRef,
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          firestoreLimit(LEAGUES_PAGE_SIZE)
        );
      }

      const querySnapshot = await getDocs(q);
      const leagues = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      setLastLeagueDoc(lastVisible);
      setHasMoreLeagues(querySnapshot.docs.length === LEAGUES_PAGE_SIZE);

      if (loadMore) {
        setAvailableLeagues(prev => [...prev, ...leagues]);
      } else {
        setAvailableLeagues(leagues);
      }
    } catch (error) {
      console.error('Error loading available leagues:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateLeague = async (leagueData) => {
    try {
      const result = await createLeague(leagueData);

      if (result.data.success) {
        toast.success('League created successfully!', { icon: '🏆' });
        setShowCreateModal(false);
        loadMyLeagues();
        loadAvailableLeagues();
      }
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error(error.message || 'Failed to create league');
    }
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      const result = await joinLeague({ leagueId });

      if (result.data.success) {
        toast.success('Joined league successfully!', { icon: '🎉' });
        loadMyLeagues();
        loadAvailableLeagues();
      }
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error(error.message || 'Failed to join league');
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    if (!window.confirm('Are you sure you want to leave this league?')) return;

    try {
      const result = await leaveLeague({ leagueId });

      if (result.data.success) {
        toast.success('Left league successfully');
        setSelectedLeague(null);
        setActiveView('browse');
        loadMyLeagues();
      }
    } catch (error) {
      console.error('Error leaving league:', error);
      toast.error(error.message || 'Failed to leave league');
    }
  };

  const filteredAvailableLeagues = availableLeagues.filter(league =>
    league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    league.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (activeView === 'league' && selectedLeague) {
    return (
      <LeagueDetailView
        league={selectedLeague}
        userProfile={userProfile}
        onBack={() => {
          setSelectedLeague(null);
          setActiveView('browse');
        }}
        onLeave={() => handleLeaveLeague(selectedLeague.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-gradient mb-2">
                Circuit Leagues
              </h1>
              <p className="text-cream-300 text-sm sm:text-base">
                Compete on the tour circuit with other directors throughout the season
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Create League
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('my-leagues')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'my-leagues'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Trophy className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">My Leagues</span>
          <span className="sm:hidden">My</span>
          <span className="text-xs md:text-sm">({myLeagues.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'discover'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Search className="w-4 h-4 md:w-5 md:h-5" />
          Discover
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'my-leagues' && (
          <motion.div
            key="my-leagues"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {loading ? (
              <div className="card p-8 text-center">
                <p className="text-cream-500/60">Loading leagues...</p>
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="card p-12 text-center">
                <Users className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-cream-100 mb-2">
                  You're not in any leagues yet
                </h3>
                <p className="text-cream-500/60 mb-6">
                  Join a public league or create your own to compete with other directors
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="btn-outline"
                  >
                    Browse Leagues
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create League
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLeagues.map(league => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    isMember={true}
                    onClick={() => {
                      setSelectedLeague(league);
                      setActiveView('league');
                    }}
                    userProfile={userProfile}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Search Bar */}
            <div className="card p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/60" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            {/* Available Leagues */}
            {filteredAvailableLeagues.length === 0 ? (
              <div className="card p-12 text-center">
                <Search className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-cream-100 mb-2">
                  No leagues found
                </h3>
                <p className="text-cream-500/60">
                  Try adjusting your search or create your own league
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAvailableLeagues.map(league => (
                    <LeagueCard
                      key={league.id}
                      league={league}
                      isMember={myLeagues.some(l => l.id === league.id)}
                      onJoin={() => handleJoinLeague(league.id)}
                      onClick={() => {
                        if (myLeagues.some(l => l.id === league.id)) {
                          setSelectedLeague(league);
                          setActiveView('league');
                        }
                      }}
                      userProfile={userProfile}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {hasMoreLeagues && !searchTerm && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => loadAvailableLeagues(true)}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-6 py-3 bg-charcoal-800/50 text-cream-300 rounded-lg hover:bg-charcoal-800 transition-colors disabled:opacity-50"
                    >
                      <ChevronDown className={`w-4 h-4 ${loadingMore ? 'animate-bounce' : ''}`} />
                      {loadingMore ? 'Loading...' : 'Load More Leagues'}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create League Modal */}
      {showCreateModal && (
        <CreateLeagueModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLeague}
        />
      )}
    </div>
  );
};

// League Card Component
const LeagueCard = ({ league, isMember, onJoin, onClick, userProfile }) => {
  const memberCount = league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isCommissioner = league.creatorId === userProfile?.uid;

  return (
    <motion.div
      whileHover={{ scale: isMember ? 1.02 : 1.0 }}
      className={`card-hover p-6 ${isMember ? 'cursor-pointer' : ''}`}
      onClick={isMember ? onClick : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-cream-100">{league.name}</h3>
            {!league.isPublic && (
              <Lock className="w-4 h-4 text-cream-500/60" />
            )}
            {isCommissioner && (
              <Crown className="w-4 h-4 text-gold-500" />
            )}
          </div>
          <p className="text-sm text-cream-500/60 line-clamp-2">
            {league.description || 'No description provided'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-charcoal-900/50 rounded-lg">
          <p className="text-xs text-cream-500/60 mb-1">Members</p>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-cream-100">
              {memberCount}/{maxMembers}
            </span>
          </div>
        </div>
        <div className="p-3 bg-charcoal-900/50 rounded-lg">
          <p className="text-xs text-cream-500/60 mb-1">Prize Pool</p>
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-gold-500" />
            <span className="text-sm font-bold text-cream-100">
              {league.settings?.prizePool || 1000}
            </span>
          </div>
        </div>
      </div>

      {isMember ? (
        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-semibold text-green-400">Member</span>
          </div>
          <ChevronRight className="w-5 h-5 text-green-400" />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin?.();
          }}
          disabled={memberCount >= maxMembers}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {memberCount >= maxMembers ? 'League Full' : 'Join League'}
        </button>
      )}
    </motion.div>
  );
};

// League Detail View Component
const LeagueDetailView = ({ league, userProfile, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [standings, setStandings] = useState(null);
  const [matchups, setMatchups] = useState([]);
  const [trades, setTrades] = useState([]);
  const [messages, setMessages] = useState([]);

  const isCommissioner = league.creatorId === userProfile?.uid;

  useEffect(() => {
    // Load standings
    const standingsRef = doc(db, `artifacts/marching-art/leagues/${league.id}/standings/current`);
    const unsubStandings = onSnapshot(standingsRef, (doc) => {
      if (doc.exists()) {
        setStandings(doc.data());
      }
    });

    // Load trades
    const tradesRef = collection(db, `artifacts/marching-art/leagues/${league.id}/trades`);
    const unsubTrades = onSnapshot(query(tradesRef, orderBy('createdAt', 'desc'), firestoreLimit(10)), (snapshot) => {
      const tradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrades(tradesData);
    });

    // Load chat messages
    const messagesRef = collection(db, `artifacts/marching-art/leagues/${league.id}/chat`);
    const unsubMessages = onSnapshot(query(messagesRef, orderBy('createdAt', 'desc'), firestoreLimit(50)), (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesData.reverse());
    });

    return () => {
      unsubStandings();
      unsubTrades();
      unsubMessages();
    };
  }, [league.id]);

  const tabs = [
    { id: 'standings', label: 'Circuit Standings', icon: Trophy },
    { id: 'tour', label: 'Tour Stops', icon: MapPin },
    { id: 'awards', label: 'Awards', icon: Award },
    { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    ...(isCommissioner ? [{ id: 'settings', label: 'Settings', icon: Settings }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <button
            onClick={onBack}
            className="mb-4 text-cream-300 hover:text-cream-100 flex items-center gap-2"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
            Back to Leagues
          </button>

          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <h1 className="text-2xl md:text-4xl font-display font-bold text-gradient">
                  {league.name}
                </h1>
                {isCommissioner && (
                  <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-gold-500/20 border border-gold-500/50 rounded-full">
                    <Crown className="w-3 h-3 md:w-4 md:h-4 text-gold-500" />
                    <span className="text-xs md:text-sm font-semibold text-gold-500">Commissioner</span>
                  </div>
                )}
              </div>
              <p className="text-sm md:text-base text-cream-300">{league.description}</p>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={onLeave}
                className="btn-ghost text-red-400 hover:bg-red-500/10 flex-1 md:flex-none"
              >
                Leave League
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Directors</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.members?.length || 0}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Prize Pool</p>
              <p className="text-2xl font-bold text-gold-500">
                {league.settings?.prizePool || 1000}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Finals Spots</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.settings?.finalsSize || 12}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Staff Trading</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.settings?.enableStaffTrading ? 'On' : 'Off'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'glass text-cream-300 hover:text-cream-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'standings' && (
          <CircuitStandingsTab key="standings" league={league} />
        )}
        {activeTab === 'tour' && (
          <TourStopsTab key="tour" league={league} />
        )}
        {activeTab === 'awards' && (
          <AwardsTab key="awards" league={league} />
        )}
        {activeTab === 'trades' && (
          <TradesTab key="trades" league={league} trades={trades} userProfile={userProfile} />
        )}
        {activeTab === 'chat' && (
          <ChatTab key="chat" league={league} messages={messages} userProfile={userProfile} />
        )}
        {activeTab === 'settings' && isCommissioner && (
          <SettingsTab key="settings" league={league} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Circuit Standings Tab - Uses existing game scoring data filtered by league members
const CircuitStandingsTab = ({ league }) => {
  const [memberData, setMemberData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tourStopResults, setTourStopResults] = useState([]);

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch all member profiles and their corps data
        const memberPromises = league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);

          if (!profileDoc.exists()) return null;

          const profile = profileDoc.data();

          // Get the total season score from their active corps
          let totalScore = 0;
          let corpsName = 'Unknown Corps';
          let corpsClass = null;

          if (profile.corps) {
            // Find the corps with the highest score or the active one
            Object.entries(profile.corps).forEach(([cls, data]) => {
              if (data.totalSeasonScore && data.totalSeasonScore > totalScore) {
                totalScore = data.totalSeasonScore;
                corpsName = data.corpsName || data.name || 'Unknown Corps';
                corpsClass = cls;
              }
            });
          }

          return {
            uid,
            displayName: profile.displayName || profile.username || `Director ${uid.slice(0, 6)}`,
            corpsName,
            corpsClass,
            totalSeasonScore: totalScore,
            // These would be calculated from fantasy_recaps in a real implementation
            circuitPoints: 0,
            medals: { gold: 0, silver: 0, bronze: 0 },
            tourStops: 0,
            seasonHighScore: 0,
            averagePlacement: 0
          };
        });

        const members = (await Promise.all(memberPromises)).filter(Boolean);

        // Fetch fantasy recaps to calculate circuit standings
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          const recapsRef = doc(db, `fantasy_recaps/${seasonData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);

            // Process each week's results
            const weeklyResults = {};

            recaps.forEach(dayRecap => {
              const week = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyResults[week]) {
                weeklyResults[week] = {};
              }

              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (memberUids.has(result.uid)) {
                    if (!weeklyResults[week][result.uid]) {
                      weeklyResults[week][result.uid] = {
                        totalScore: 0,
                        showCount: 0,
                        highScore: 0
                      };
                    }
                    weeklyResults[week][result.uid].totalScore += result.totalScore || 0;
                    weeklyResults[week][result.uid].showCount += 1;
                    weeklyResults[week][result.uid].highScore = Math.max(
                      weeklyResults[week][result.uid].highScore,
                      result.totalScore || 0
                    );
                  }
                });
              });
            });

            // Calculate circuit points and medals from weekly rankings
            const tourStops = [];

            Object.entries(weeklyResults).forEach(([week, weekData]) => {
              const weekRankings = Object.entries(weekData)
                .map(([uid, data]) => ({
                  uid,
                  weekScore: data.totalScore,
                  showCount: data.showCount,
                  highScore: data.highScore
                }))
                .sort((a, b) => b.weekScore - a.weekScore);

              tourStops.push({
                week: parseInt(week),
                rankings: weekRankings
              });

              // Award points and medals
              weekRankings.forEach((ranking, index) => {
                const member = members.find(m => m.uid === ranking.uid);
                if (member) {
                  const placement = index + 1;
                  member.circuitPoints += getPlacementPoints(placement);
                  member.tourStops += 1;
                  member.seasonHighScore = Math.max(member.seasonHighScore, ranking.highScore);

                  if (placement === 1) member.medals.gold += 1;
                  else if (placement === 2) member.medals.silver += 1;
                  else if (placement === 3) member.medals.bronze += 1;
                }
              });
            });

            // Calculate average placement
            members.forEach(member => {
              if (member.tourStops > 0) {
                let totalPlacements = 0;
                tourStops.forEach(stop => {
                  const ranking = stop.rankings.findIndex(r => r.uid === member.uid);
                  if (ranking !== -1) {
                    totalPlacements += ranking + 1;
                  }
                });
                member.averagePlacement = totalPlacements / member.tourStops;
              }
            });

            setTourStopResults(tourStops.sort((a, b) => b.week - a.week));
          }
        }

        // Sort by circuit points, then by total season score
        members.sort((a, b) => {
          if (b.circuitPoints !== a.circuitPoints) return b.circuitPoints - a.circuitPoints;
          return b.totalSeasonScore - a.totalSeasonScore;
        });

        setMemberData(members);
      } catch (error) {
        console.error('Error fetching member data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [league]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading circuit standings...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
        Circuit Standings
      </h2>

      <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cream-500/20">
              <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Rank</th>
              <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Director</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">
                <span className="hidden md:inline">Circuit</span> Pts
              </th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Medals</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden md:table-cell">Stops</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden lg:table-cell">High</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">
                <span className="hidden md:inline">Season</span> Total
              </th>
            </tr>
          </thead>
          <tbody>
            {memberData.map((member, index) => {
              const isFinalsSpot = index < (league.settings?.finalsSize || 12);

              return (
                <tr
                  key={member.uid}
                  className={`border-b border-cream-500/10 hover:bg-cream-500/5 ${
                    isFinalsSpot ? 'bg-green-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-2 md:px-4">
                    <div className="flex items-center gap-1 md:gap-2">
                      <span className="text-base md:text-lg font-bold text-cream-100">{index + 1}</span>
                      {index === 0 && <Crown className="w-4 h-4 text-gold-500" />}
                    </div>
                  </td>
                  <td className="py-3 px-2 md:px-4">
                    <div>
                      <span className="font-semibold text-cream-100 text-sm md:text-base">{member.displayName}</span>
                      <p className="text-xs text-cream-500/60 hidden md:block">{member.corpsName}</p>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4">
                    <span className="text-base md:text-lg font-bold text-gold-500">{member.circuitPoints}</span>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4">
                    <div className="flex items-center justify-center gap-0.5 md:gap-1">
                      {member.medals.gold > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-yellow-500/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-yellow-500" />
                          <span className="text-yellow-500 font-bold">{member.medals.gold}</span>
                        </div>
                      )}
                      {member.medals.silver > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-gray-400/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-400 font-bold">{member.medals.silver}</span>
                        </div>
                      )}
                      {member.medals.bronze > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-orange-600/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-orange-600" />
                          <span className="text-orange-600 font-bold">{member.medals.bronze}</span>
                        </div>
                      )}
                      {member.medals.gold === 0 && member.medals.silver === 0 && member.medals.bronze === 0 && (
                        <span className="text-cream-500/40 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden md:table-cell">
                    {member.tourStops}
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden lg:table-cell">
                    {member.seasonHighScore > 0 ? member.seasonHighScore.toFixed(1) : '—'}
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 font-bold text-sm md:text-base">
                    {member.totalSeasonScore.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {league.settings?.finalsSize && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">
            <Star className="w-4 h-4 inline mr-1" />
            Top {league.settings.finalsSize || 12} directors advance to League Finals
          </p>
        </div>
      )}

      {/* Scoring Legend */}
      <div className="mt-6 p-4 bg-charcoal-900/50 rounded-lg">
        <h4 className="text-sm font-semibold text-cream-300 mb-2">Circuit Points per Tour Stop</h4>
        <div className="flex flex-wrap gap-2 text-xs text-cream-500/60">
          <span className="px-2 py-1 bg-gold-500/20 rounded text-gold-500">1st: 15 pts</span>
          <span className="px-2 py-1 bg-gray-400/20 rounded text-gray-400">2nd: 12 pts</span>
          <span className="px-2 py-1 bg-orange-600/20 rounded text-orange-600">3rd: 10 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">4th: 8 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">5th: 6 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">6th+: 5-1 pts</span>
        </div>
      </div>
    </motion.div>
  );
};

// Tour Stops Tab - Shows weekly results filtered to league members
const TourStopsTab = ({ league }) => {
  const [tourStops, setTourStops] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [seasonData, setSeasonData] = useState(null);

  useEffect(() => {
    const fetchTourStops = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch member profiles
        const profiles = {};
        await Promise.all(league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            profiles[uid] = profileDoc.data();
          }
        }));
        setMemberProfiles(profiles);

        // Fetch season data
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          setSeasonData(sData);

          // Calculate current week
          const startDate = sData.schedule?.startDate?.toDate();
          if (startDate) {
            const now = new Date();
            const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            const currentWeek = Math.max(1, Math.ceil((diffInDays + 1) / 7));
            setSelectedWeek(currentWeek);
          }

          // Fetch fantasy recaps
          const recapsRef = doc(db, `fantasy_recaps/${sData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);

            // Group by week
            const weeklyData = {};

            recaps.forEach(dayRecap => {
              const week = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyData[week]) {
                weeklyData[week] = {
                  week,
                  shows: [],
                  memberResults: {}
                };
              }

              dayRecap.shows?.forEach(show => {
                const leagueResults = (show.results || []).filter(r => memberUids.has(r.uid));
                if (leagueResults.length > 0) {
                  weeklyData[week].shows.push({
                    eventName: show.eventName,
                    location: show.location,
                    day: dayRecap.offSeasonDay,
                    results: leagueResults.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                  });

                  // Aggregate member results for the week
                  leagueResults.forEach(result => {
                    if (!weeklyData[week].memberResults[result.uid]) {
                      weeklyData[week].memberResults[result.uid] = {
                        totalScore: 0,
                        showCount: 0,
                        highScore: 0,
                        geScore: 0,
                        visualScore: 0,
                        musicScore: 0
                      };
                    }
                    weeklyData[week].memberResults[result.uid].totalScore += result.totalScore || 0;
                    weeklyData[week].memberResults[result.uid].showCount += 1;
                    weeklyData[week].memberResults[result.uid].highScore = Math.max(
                      weeklyData[week].memberResults[result.uid].highScore,
                      result.totalScore || 0
                    );
                    weeklyData[week].memberResults[result.uid].geScore += result.geScore || 0;
                    weeklyData[week].memberResults[result.uid].visualScore += result.visualScore || 0;
                    weeklyData[week].memberResults[result.uid].musicScore += result.musicScore || 0;
                  });
                }
              });
            });

            // Calculate rankings for each week
            Object.values(weeklyData).forEach(weekData => {
              weekData.rankings = Object.entries(weekData.memberResults)
                .map(([uid, data]) => ({ uid, ...data }))
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((item, index) => ({
                  ...item,
                  placement: index + 1,
                  pointsEarned: getPlacementPoints(index + 1)
                }));
            });

            setTourStops(Object.values(weeklyData).sort((a, b) => b.week - a.week));
          }
        }
      } catch (error) {
        console.error('Error fetching tour stops:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTourStops();
  }, [league]);

  const getDirectorName = (uid) => {
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid.slice(0, 6)}`;
  };

  const getCorpsName = (uid) => {
    const profile = memberProfiles[uid];
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find(c => c.corpsName || c.name);
      return activeCorps?.corpsName || activeCorps?.name || 'Unknown Corps';
    }
    return 'Unknown Corps';
  };

  const getMedalColor = (placement) => {
    if (placement === 1) return 'text-yellow-500 bg-yellow-500/20';
    if (placement === 2) return 'text-gray-400 bg-gray-400/20';
    if (placement === 3) return 'text-orange-600 bg-orange-600/20';
    return 'text-cream-500/60 bg-cream-500/10';
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading tour stops...</p>
      </motion.div>
    );
  }

  const selectedStop = tourStops.find(s => s.week === selectedWeek);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Week Selector */}
      <div className="card p-4">
        <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gold-500" />
          Tour Schedule
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map(week => {
            const hasResults = tourStops.some(s => s.week === week && s.rankings?.length > 0);
            const isSelected = selectedWeek === week;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all ${
                  isSelected
                    ? 'bg-gold-500 text-charcoal-900'
                    : hasResults
                    ? 'glass text-cream-100 hover:bg-cream-500/10'
                    : 'glass text-cream-500/40'
                }`}
              >
                <span className="text-sm">Week {week}</span>
                {hasResults && !isSelected && (
                  <CircleDot className="w-3 h-3 inline ml-1 text-green-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Week Results */}
      {selectedStop && selectedStop.rankings?.length > 0 ? (
        <div className="card p-6">
          <h3 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            Week {selectedStop.week} Results
          </h3>

          {/* Rankings Table */}
          <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-500/20">
                  <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Place</th>
                  <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Director</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Shows</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Total</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden md:table-cell">High</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Pts</th>
                </tr>
              </thead>
              <tbody>
                {selectedStop.rankings.map((ranking) => (
                  <tr key={ranking.uid} className="border-b border-cream-500/10 hover:bg-cream-500/5">
                    <td className="py-3 px-2 md:px-4">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${getMedalColor(ranking.placement)}`}>
                        {ranking.placement}
                      </div>
                    </td>
                    <td className="py-3 px-2 md:px-4">
                      <div>
                        <span className="font-semibold text-cream-100 text-sm md:text-base">
                          {getDirectorName(ranking.uid)}
                        </span>
                        <p className="text-xs text-cream-500/60 hidden md:block">
                          {getCorpsName(ranking.uid)}
                        </p>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100">
                      {ranking.showCount}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100 font-bold">
                      {ranking.totalScore.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden md:table-cell">
                      {ranking.highScore.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4">
                      <span className="text-gold-500 font-bold">+{ranking.pointsEarned}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shows List */}
          {selectedStop.shows?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-cream-300 mb-3">Shows This Week</h4>
              <div className="space-y-2">
                {selectedStop.shows.map((show, idx) => (
                  <div key={idx} className="p-3 bg-charcoal-900/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-cream-100 text-sm">{show.eventName}</p>
                        <p className="text-xs text-cream-500/60 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {show.location}
                        </p>
                      </div>
                      <span className="text-xs text-cream-500/40">Day {show.day}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cream-100 mb-2">
            No Results Yet
          </h3>
          <p className="text-cream-500/60">
            {selectedWeek ? `Week ${selectedWeek} results will appear after shows are scored` : 'Select a week to view results'}
          </p>
        </div>
      )}
    </motion.div>
  );
};

// Awards Tab - Caption awards and special recognitions
const AwardsTab = ({ league }) => {
  const [awards, setAwards] = useState(null);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAwards = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch member profiles
        const profiles = {};
        await Promise.all(league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            profiles[uid] = profileDoc.data();
          }
        }));
        setMemberProfiles(profiles);

        // Fetch season and recaps
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          const recapsRef = doc(db, `fantasy_recaps/${seasonData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);

            // Calculate award leaders
            const leaderboards = {
              highScore: { uid: null, score: 0, eventName: '' },
              totalGE: {},
              totalVisual: {},
              totalMusic: {},
              totalScore: {},
              showsAttended: {}
            };

            recaps.forEach(dayRecap => {
              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (!memberUids.has(result.uid)) return;

                  // High score (single show)
                  if ((result.totalScore || 0) > leaderboards.highScore.score) {
                    leaderboards.highScore = {
                      uid: result.uid,
                      score: result.totalScore,
                      eventName: show.eventName
                    };
                  }

                  // Cumulative scores
                  if (!leaderboards.totalGE[result.uid]) {
                    leaderboards.totalGE[result.uid] = 0;
                    leaderboards.totalVisual[result.uid] = 0;
                    leaderboards.totalMusic[result.uid] = 0;
                    leaderboards.totalScore[result.uid] = 0;
                    leaderboards.showsAttended[result.uid] = 0;
                  }

                  leaderboards.totalGE[result.uid] += result.geScore || 0;
                  leaderboards.totalVisual[result.uid] += result.visualScore || 0;
                  leaderboards.totalMusic[result.uid] += result.musicScore || 0;
                  leaderboards.totalScore[result.uid] += result.totalScore || 0;
                  leaderboards.showsAttended[result.uid] += 1;
                });
              });
            });

            // Find leaders for each category
            const findLeader = (obj) => {
              const entries = Object.entries(obj);
              if (entries.length === 0) return null;
              entries.sort((a, b) => b[1] - a[1]);
              return { uid: entries[0][0], score: entries[0][1] };
            };

            setAwards({
              highScore: leaderboards.highScore,
              geLeader: findLeader(leaderboards.totalGE),
              visualLeader: findLeader(leaderboards.totalVisual),
              musicLeader: findLeader(leaderboards.totalMusic),
              ironman: findLeader(leaderboards.showsAttended)
            });
          }
        }
      } catch (error) {
        console.error('Error fetching awards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAwards();
  }, [league]);

  const getDirectorName = (uid) => {
    if (!uid) return '—';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid.slice(0, 6)}`;
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading awards...</p>
      </motion.div>
    );
  }

  const awardCards = [
    {
      id: 'highScore',
      title: 'High Score Award',
      subtitle: 'Highest single-show score',
      icon: Sparkles,
      color: 'gold',
      leader: awards?.highScore?.uid,
      value: awards?.highScore?.score?.toFixed(1),
      extra: awards?.highScore?.eventName
    },
    {
      id: 'ge',
      title: 'GE Excellence',
      subtitle: 'General Effect leader',
      icon: Star,
      color: 'purple',
      leader: awards?.geLeader?.uid,
      value: awards?.geLeader?.score?.toFixed(1)
    },
    {
      id: 'visual',
      title: 'Visual Excellence',
      subtitle: 'Visual caption leader',
      icon: Eye,
      color: 'blue',
      leader: awards?.visualLeader?.uid,
      value: awards?.visualLeader?.score?.toFixed(1)
    },
    {
      id: 'music',
      title: 'Music Excellence',
      subtitle: 'Music caption leader',
      icon: Music,
      color: 'green',
      leader: awards?.musicLeader?.uid,
      value: awards?.musicLeader?.score?.toFixed(1)
    },
    {
      id: 'ironman',
      title: 'Iron Director',
      subtitle: 'Most shows attended',
      icon: Flame,
      color: 'orange',
      leader: awards?.ironman?.uid,
      value: awards?.ironman?.score,
      valueSuffix: ' shows'
    }
  ];

  const colorClasses = {
    gold: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30'
  };

  const iconColorClasses = {
    gold: 'text-yellow-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
    orange: 'text-orange-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="card p-6">
        <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
          Season Awards
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {awardCards.map(award => {
            const Icon = award.icon;
            return (
              <div
                key={award.id}
                className={`p-4 rounded-xl border bg-gradient-to-br ${colorClasses[award.color]}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-charcoal-900/50 ${iconColorClasses[award.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-cream-100">{award.title}</h4>
                    <p className="text-xs text-cream-500/60 mb-2">{award.subtitle}</p>

                    {award.leader ? (
                      <div className="mt-2">
                        <p className="font-semibold text-cream-100 truncate">
                          {getDirectorName(award.leader)}
                        </p>
                        <p className={`text-lg font-bold ${iconColorClasses[award.color]}`}>
                          {award.value}{award.valueSuffix || ' pts'}
                        </p>
                        {award.extra && (
                          <p className="text-xs text-cream-500/60 truncate">{award.extra}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-cream-500/40 mt-2">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info about awards */}
      <div className="card p-4 bg-charcoal-900/50">
        <p className="text-sm text-cream-500/60 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Awards are calculated from all shows attended by league members this season.
            Final awards will be presented at the end of the season.
          </span>
        </p>
      </div>
    </motion.div>
  );
};

// Trades Tab
const TradesTab = ({ league, trades, userProfile }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <ArrowLeftRight className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
        Staff Trades
      </h2>

      {!league.settings?.enableStaffTrading ? (
        <div className="p-8 text-center">
          <Lock className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <p className="text-cream-500/60">
            Staff trading is disabled in this league
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Propose Trade
          </button>

          {trades.length === 0 ? (
            <div className="p-8 text-center">
              <ArrowLeftRight className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
              <p className="text-cream-500/60">No trades yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map(trade => (
                <div key={trade.id} className="p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-cream-300">
                        <span className="font-semibold">Director {trade.fromUserId.slice(0, 6)}</span>
                        {' → '}
                        <span className="font-semibold">Director {trade.toUserId.slice(0, 6)}</span>
                      </p>
                      <p className="text-xs text-cream-500/60 mt-1">
                        {new Date(trade.createdAt?.toDate()).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      trade.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : trade.status === 'accepted'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// Chat Tab
const ChatTab = ({ league, messages, userProfile }) => {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId: league.id, message: newMessage });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
        League Chat
      </h2>

      <div className="space-y-4">
        {/* Messages */}
        <div className="h-64 md:h-96 overflow-y-auto space-y-3 p-4 bg-charcoal-900/50 rounded-lg">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-cream-500/60">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.userId === userProfile?.uid
                    ? 'bg-gold-500/20 ml-auto max-w-md'
                    : 'bg-cream-500/10 max-w-md'
                }`}
              >
                <p className="text-xs text-cream-500/60 mb-1">
                  Director {msg.userId.slice(0, 6)}
                </p>
                <p className="text-cream-100">{msg.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="btn-primary px-6"
          >
            Send
          </button>
        </form>
      </div>
    </motion.div>
  );
};

// Settings Tab
const SettingsTab = ({ league }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
        Commissioner Settings
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-cream-100 mb-2">Invite Code</h3>
          <div className="flex items-center gap-3 p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/20">
            <code className="text-2xl font-mono font-bold text-gold-500 tracking-wider">
              {league.inviteCode}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(league.inviteCode);
                toast.success('Invite code copied!');
              }}
              className="btn-outline text-sm"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-cream-100 mb-4">League Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Prize Pool (CorpsCoin)</span>
              <span className="font-bold text-gold-500">{league.settings?.prizePool || 1000}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Finals Spots</span>
              <span className="font-bold text-cream-100">{league.settings?.finalsSize || 12}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Staff Trading</span>
              <span className={`font-bold ${league.settings?.enableStaffTrading ? 'text-green-400' : 'text-red-400'}`}>
                {league.settings?.enableStaffTrading ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Create League Modal (Updated for Circuit Format)
const CreateLeagueModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 20,
    settings: {
      enableStaffTrading: true,
      scoringFormat: 'circuit', // circuit points based
      finalsSize: 12,
      prizePool: 1000
    }
  });
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      await onCreate(formData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-4 md:p-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-gradient">
              Create Circuit League
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-cream-500/10 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-cream-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* League Name */}
            <div>
              <label className="label">League Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DCI Fantasy Champions"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Description */}
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea h-20"
                placeholder="Describe your league..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={200}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.description.length}/200 characters
              </p>
            </div>

            {/* Max Members & Prize Pool - Side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Maximum Members</label>
                <input
                  type="number"
                  className="input"
                  min="2"
                  max="50"
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="label">Prize Pool (CorpsCoin)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="100"
                  value={formData.settings.prizePool}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, prizePool: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            {/* Finals Size */}
            <div>
              <label className="label">League Finals Spots</label>
              <select
                className="input"
                value={formData.settings.finalsSize}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, finalsSize: parseInt(e.target.value) }
                })}
              >
                <option value={6}>Top 6</option>
                <option value={8}>Top 8</option>
                <option value={12}>Top 12 (DCI Style)</option>
                <option value={15}>Top 15</option>
              </select>
              <p className="text-xs text-cream-500/40 mt-1">
                Directors advancing to league finals week
              </p>
            </div>

            {/* Staff Trading */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-charcoal-900/50 rounded-lg">
              <div>
                <label className="font-semibold text-cream-100 text-sm md:text-base">Enable Staff Trading</label>
                <p className="text-xs md:text-sm text-cream-500/60">Allow members to trade staff</p>
              </div>
              <input
                type="checkbox"
                checked={formData.settings.enableStaffTrading}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, enableStaffTrading: e.target.checked }
                })}
                className="w-5 h-5"
              />
            </div>

            {/* Public/Private */}
            <div>
              <label className="label">League Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: true })}
                  className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                    formData.isPublic
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/20 hover:border-cream-500/40'
                  }`}
                >
                  <Users className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-cream-100" />
                  <p className="font-semibold text-cream-100 text-sm md:text-base">Public</p>
                  <p className="text-xs text-cream-500/60 mt-1">
                    Anyone can join
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: false })}
                  className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                    !formData.isPublic
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/20 hover:border-cream-500/40'
                  }`}
                >
                  <Lock className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-cream-100" />
                  <p className="font-semibold text-cream-100 text-sm md:text-base">Private</p>
                  <p className="text-xs text-cream-500/60 mt-1">
                    Invite only
                  </p>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 md:pt-4 sticky bottom-0 bg-charcoal-900 pb-2 md:pb-0">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? 'Creating...' : 'Create League'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  </Portal>
  );
};

export default Leagues;
