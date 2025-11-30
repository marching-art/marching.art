// src/pages/Leagues.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, Plus, Search, Crown, TrendingUp, Award,
  Calendar, X, Check, Shield, Star, AlertCircle, Lock,
  MessageSquare, Settings, ArrowLeftRight, Flame, Target,
  ChevronDown, ChevronRight, Medal, Zap
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, onSnapshot, orderBy, limit as firestoreLimit, getDoc } from 'firebase/firestore';
import {
  createLeague,
  joinLeague,
  leaveLeague,
  generateMatchups,
  updateMatchupResults,
  proposeStaffTrade,
  respondToStaffTrade,
  postLeagueMessage
} from '../firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../components/Portal';

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
        where('members', 'array-contains', user.uid)
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

  const loadAvailableLeagues = async () => {
    try {
      const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
      const q = query(
        leaguesRef,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );

      const querySnapshot = await getDocs(q);
      const leagues = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAvailableLeagues(leagues);
    } catch (error) {
      console.error('Error loading available leagues:', error);
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
                Fantasy Leagues
              </h1>
              <p className="text-cream-300 text-sm sm:text-base">
                Compete head-to-head with other directors in weekly matchups
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
    { id: 'standings', label: 'Standings', icon: Trophy },
    { id: 'matchups', label: 'Matchups', icon: Target },
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
              <p className="text-xs text-cream-500/60 mb-1">Members</p>
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
              <p className="text-xs text-cream-500/60 mb-1">Playoff Teams</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.settings?.playoffSize || 4}
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
          <StandingsTab key="standings" league={league} standings={standings} />
        )}
        {activeTab === 'matchups' && (
          <MatchupsTab key="matchups" league={league} isCommissioner={isCommissioner} />
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

// Standings Tab
const StandingsTab = ({ league, standings }) => {
  const [memberProfiles, setMemberProfiles] = useState({});

  // Fetch member profiles to get displayNames
  useEffect(() => {
    const fetchMemberProfiles = async () => {
      if (!standings?.records) return;

      const uids = Object.keys(standings.records);
      const profiles = {};

      for (const uid of uids) {
        try {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);

          if (profileDoc.exists()) {
            profiles[uid] = profileDoc.data();
          }
        } catch (error) {
          console.error(`Error fetching profile for ${uid}:`, error);
        }
      }

      setMemberProfiles(profiles);
    };

    fetchMemberProfiles();
  }, [standings]);

  if (!standings || !standings.records) {
    return (
      <div className="card p-8 text-center">
        <p className="text-cream-500/60">No standings data yet</p>
      </div>
    );
  }

  const sortedRecords = Object.entries(standings.records)
    .map(([uid, record]) => ({ uid, ...record }))
    .sort((a, b) => {
      // Sort by wins first
      if (b.wins !== a.wins) return b.wins - a.wins;
      // Then by win percentage
      const aWinPct = a.wins / (a.wins + a.losses + a.ties) || 0;
      const bWinPct = b.wins / (b.wins + b.losses + b.ties) || 0;
      if (bWinPct !== aWinPct) return bWinPct - aWinPct;
      // Then by points for
      return b.pointsFor - a.pointsFor;
    });

  // Helper to get director display name
  const getDirectorName = (uid) => {
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid.slice(0, 6)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
        League Standings
      </h2>

      <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cream-500/20">
              <th className="text-left py-3 px-4 text-sm font-semibold text-cream-500/60">Rank</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-cream-500/60">Director</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">W</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">L</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">T</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">PCT</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">PF</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">PA</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-cream-500/60">Streak</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record, index) => {
              const winPct = record.wins / (record.wins + record.losses + record.ties) || 0;
              const isPlayoffSpot = index < (league.settings?.playoffSize || 4);

              return (
                <tr
                  key={record.uid}
                  className={`border-b border-cream-500/10 hover:bg-cream-500/5 ${
                    isPlayoffSpot ? 'bg-green-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-cream-100">{index + 1}</span>
                      {index === 0 && <Crown className="w-4 h-4 text-gold-500" />}
                      {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                      {index === 2 && <Medal className="w-4 h-4 text-orange-600" />}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-cream-100">{getDirectorName(record.uid)}</span>
                  </td>
                  <td className="text-center py-3 px-4 text-cream-100 font-bold">{record.wins}</td>
                  <td className="text-center py-3 px-4 text-cream-100 font-bold">{record.losses}</td>
                  <td className="text-center py-3 px-4 text-cream-100 font-bold">{record.ties}</td>
                  <td className="text-center py-3 px-4 text-cream-100 font-bold">
                    {winPct.toFixed(3)}
                  </td>
                  <td className="text-center py-3 px-4 text-cream-100">
                    {record.pointsFor.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-4 text-cream-100">
                    {record.pointsAgainst.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-4">
                    {record.streakType && record.currentStreak > 0 && (
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                        record.streakType === 'W'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {record.streakType === 'W' ? <Flame className="w-3 h-3" /> : null}
                        <span className="text-sm font-bold">
                          {record.streakType}{record.currentStreak}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {league.settings?.playoffSize && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">
            <Star className="w-4 h-4 inline mr-1" />
            Top {league.settings.playoffSize} teams make the playoffs
          </p>
        </div>
      )}
    </motion.div>
  );
};

// Matchups Tab
const MatchupsTab = ({ league, isCommissioner }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6">Weekly Matchups</h2>
      <p className="text-cream-500/60">Matchup system coming soon...</p>
      {isCommissioner && (
        <div className="mt-4">
          <button className="btn-primary">
            Generate This Week's Matchups
          </button>
        </div>
      )}
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
              <span className="text-cream-300">Playoff Teams</span>
              <span className="font-bold text-cream-100">{league.settings?.playoffSize || 4}</span>
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

// Create League Modal (Updated)
const CreateLeagueModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 20,
    settings: {
      enableStaffTrading: true,
      matchupType: 'weekly',
      playoffSize: 4,
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
              Create Fantasy League
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

            {/* Playoff Size */}
            <div>
              <label className="label">Playoff Teams</label>
              <select
                className="input"
                value={formData.settings.playoffSize}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, playoffSize: parseInt(e.target.value) }
                })}
              >
                <option value={2}>2 Teams</option>
                <option value={4}>4 Teams</option>
                <option value={6}>6 Teams</option>
                <option value={8}>8 Teams</option>
              </select>
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
