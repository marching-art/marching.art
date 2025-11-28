// src/pages/Leagues.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trophy, Plus, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, onSnapshot, orderBy, limit as firestoreLimit, startAfter } from 'firebase/firestore';
import {
  createLeague,
  joinLeague,
  leaveLeague
} from '../firebase/functions';
import toast from 'react-hot-toast';

// Import modular components
import { LeagueCard, CreateLeagueModal, LeagueDetailView } from '../components/Leagues';

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

  // Show league detail view when a league is selected
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

export default Leagues;
