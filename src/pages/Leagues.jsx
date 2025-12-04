// src/pages/Leagues.jsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trophy, Plus, Search, ChevronDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

// Import React Query hooks
import {
  useMyLeagues,
  usePublicLeagues,
  useCreateLeague,
  useJoinLeague,
  useLeaveLeague
} from '../hooks/useLeagues';
import { useProfile } from '../hooks/useProfile';

// Import modular components
import { LeagueCard, CreateLeagueModal, LeagueDetailView } from '../components/Leagues';

const Leagues = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('browse'); // browse, league
  const [activeTab, setActiveTab] = useState('my-leagues');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeague, setSelectedLeague] = useState(null);

  // React Query hooks
  const { data: userProfile } = useProfile(user?.uid);
  const { data: myLeagues = [], isLoading: loadingMyLeagues, error: myLeaguesError, isError: myLeaguesHasError, refetch: refetchMyLeagues } = useMyLeagues(user?.uid);
  const {
    data: publicLeaguesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingPublicLeagues,
    error: publicLeaguesError,
    isError: publicLeaguesHasError,
    refetch: refetchPublicLeagues
  } = usePublicLeagues(12);

  // Mutations
  const createLeagueMutation = useCreateLeague();
  const joinLeagueMutation = useJoinLeague(user?.uid);
  const leaveLeagueMutation = useLeaveLeague(user?.uid);

  // Flatten paginated public leagues data
  const availableLeagues = useMemo(() => {
    if (!publicLeaguesData?.pages) return [];
    return publicLeaguesData.pages.flatMap(page => page.data);
  }, [publicLeaguesData]);

  // Filter leagues by search term
  const filteredAvailableLeagues = useMemo(() => {
    return availableLeagues.filter(league =>
      league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      league.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableLeagues, searchTerm]);

  const handleCreateLeague = async (leagueData) => {
    try {
      await createLeagueMutation.mutateAsync(leagueData);
      toast.success('League created successfully!', { icon: '🏆' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error(error.message || 'Failed to create league');
    }
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      await joinLeagueMutation.mutateAsync(leagueId);
      toast.success('Joined league successfully!', { icon: '🎉' });
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error(error.message || 'Failed to join league');
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    if (!window.confirm('Are you sure you want to leave this league?')) return;

    try {
      await leaveLeagueMutation.mutateAsync(leagueId);
      toast.success('Left league successfully');
      setSelectedLeague(null);
      setActiveView('browse');
    } catch (error) {
      console.error('Error leaving league:', error);
      toast.error(error.message || 'Failed to leave league');
    }
  };

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
    <div className="flex flex-col flex-1 min-h-0 gap-4 lg:gap-5">
      {/* Header - Compact */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden flex-shrink-0"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl lg:rounded-2xl" />
        <div className="relative p-4 lg:p-6 bg-white dark:bg-transparent dark:glass border border-cream-300 dark:border-transparent rounded-xl lg:rounded-2xl shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-display font-bold text-charcoal-950 dark:text-cream-100 mb-1">
                Circuit Leagues
              </h1>
              <p className="text-slate-600 dark:text-cream-300 text-xs lg:text-sm">
                Compete with other directors throughout the season
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center justify-center gap-2 text-sm py-2"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation - Compact */}
      <div className="flex-shrink-0 flex gap-2">
        <button
          onClick={() => setActiveTab('my-leagues')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'my-leagues'
              ? 'bg-amber-500 dark:bg-gold-500 text-white dark:text-charcoal-900'
              : 'bg-stone-100 dark:bg-transparent dark:glass text-slate-600 dark:text-cream-300 hover:bg-stone-200 dark:hover:text-cream-100'
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
              ? 'bg-amber-500 dark:bg-gold-500 text-white dark:text-charcoal-900'
              : 'bg-stone-100 dark:bg-transparent dark:glass text-slate-600 dark:text-cream-300 hover:bg-stone-200 dark:hover:text-cream-100'
          }`}
        >
          <Search className="w-4 h-4 md:w-5 md:h-5" />
          Discover
        </button>
      </div>

      {/* Tab Content - Fills remaining space with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
        <AnimatePresence mode="wait">
          {activeTab === 'my-leagues' && (
            <motion.div
              key="my-leagues"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
            {loadingMyLeagues ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-8 text-center">
                <div className="w-8 h-8 border-2 border-amber-500 dark:border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 dark:text-cream-500/60">Loading your leagues...</p>
              </div>
            ) : myLeaguesHasError ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-cream-100 mb-2">Error Loading Leagues</h3>
                <p className="text-slate-500 dark:text-cream-500/60 mb-4">{myLeaguesError?.message || 'Something went wrong'}</p>
                <button
                  onClick={() => refetchMyLeagues()}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-12 text-center">
                <Users className="w-16 h-16 text-slate-300 dark:text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-cream-100 mb-2">
                  You're not in any leagues yet
                </h3>
                <p className="text-slate-500 dark:text-cream-500/60 mb-6">
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
            <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-cream-500/60" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-cream-50 dark:bg-charcoal-900/50 border border-cream-200 dark:border-cream-500/20 rounded-lg text-slate-900 dark:text-cream-100 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500"
                />
              </div>
            </div>

            {/* Available Leagues */}
            {loadingPublicLeagues ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-8 text-center">
                <div className="w-8 h-8 border-2 border-amber-500 dark:border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 dark:text-cream-500/60">Loading public leagues...</p>
              </div>
            ) : publicLeaguesHasError ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-cream-100 mb-2">Error Loading Leagues</h3>
                <p className="text-slate-500 dark:text-cream-500/60 mb-4">{publicLeaguesError?.message || 'Something went wrong'}</p>
                <button
                  onClick={() => refetchPublicLeagues()}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            ) : filteredAvailableLeagues.length === 0 ? (
              <div className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl p-12 text-center">
                <Search className="w-16 h-16 text-slate-300 dark:text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-cream-100 mb-2">
                  No leagues found
                </h3>
                <p className="text-slate-500 dark:text-cream-500/60">
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
                {hasNextPage && !searchTerm && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="flex items-center gap-2 px-6 py-3 bg-stone-100 dark:bg-charcoal-800/50 text-slate-600 dark:text-cream-300 rounded-lg hover:bg-stone-200 dark:hover:bg-charcoal-800 transition-colors disabled:opacity-50 border border-cream-200 dark:border-cream-500/20"
                    >
                      <ChevronDown className={`w-4 h-4 ${isFetchingNextPage ? 'animate-bounce' : ''}`} />
                      {isFetchingNextPage ? 'Loading...' : 'Load More Leagues'}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

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
