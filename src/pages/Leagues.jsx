// src/pages/Leagues.jsx
// Master-Detail View: Sidebar List + Main Detail Pane
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trophy, Plus, Search, ChevronRight, AlertTriangle, RefreshCw, X, Crown, Calendar, ArrowLeft } from 'lucide-react';
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
import EmptyState from '../components/EmptyState';

const Leagues = () => {
  const { user } = useAuth();
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

  // Get current list based on active tab
  const currentList = activeTab === 'my-leagues' ? myLeagues : filteredAvailableLeagues;
  const isLoading = activeTab === 'my-leagues' ? loadingMyLeagues : loadingPublicLeagues;
  const hasError = activeTab === 'my-leagues' ? myLeaguesHasError : publicLeaguesHasError;
  const error = activeTab === 'my-leagues' ? myLeaguesError : publicLeaguesError;
  const refetch = activeTab === 'my-leagues' ? refetchMyLeagues : refetchPublicLeagues;

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
    } catch (error) {
      console.error('Error leaving league:', error);
      toast.error(error.message || 'Failed to leave league');
    }
  };

  const handleSelectLeague = (league) => {
    setSelectedLeague(league);
  };

  // Sidebar League Item Component
  const LeagueListItem = ({ league, isSelected, isMember }) => (
    <button
      onClick={() => handleSelectLeague(league)}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
        isSelected
          ? 'bg-gold-500/20 border-gold-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
          : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30 hover:bg-charcoal-900/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isSelected ? 'bg-gold-500/30' : 'bg-charcoal-800'
        }`}>
          <Trophy className={`w-5 h-5 ${isSelected ? 'text-gold-400' : 'text-cream-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-display font-bold text-sm truncate ${
              isSelected ? 'text-gold-400' : 'text-cream-100'
            }`}>
              {league.name}
            </h4>
            {isMember && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-500/20 text-green-400">
                Joined
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-cream-500/60">
            <Users className="w-3 h-3" />
            <span>{league.memberCount || 0} / {league.maxMembers || 10}</span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-gold-400' : 'text-cream-500/40'}`} />
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          MASTER-DETAIL LAYOUT: Sidebar + Main Pane
          ================================================================ */}
      <div className="flex-1 flex min-h-0">

        {/* ============================================================
            LEFT SIDEBAR: League List (Fixed Width)
            ============================================================ */}
        <div className={`flex flex-col min-h-0 border-r border-cream-500/10 bg-charcoal-950/50 ${
          selectedLeague ? 'hidden lg:flex lg:w-80 xl:w-96' : 'w-full lg:w-80 xl:w-96'
        }`}>

          {/* Sidebar Header */}
          <div className="flex-shrink-0 p-4 border-b border-cream-500/10">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                Circuit Leagues
              </h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg">
              <button
                onClick={() => setActiveTab('my-leagues')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-display font-bold uppercase tracking-wide transition-all ${
                  activeTab === 'my-leagues'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'text-cream-400 hover:text-cream-100 hover:bg-charcoal-800'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>My ({myLeagues.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-display font-bold uppercase tracking-wide transition-all ${
                  activeTab === 'discover'
                    ? 'bg-gold-500 text-charcoal-900'
                    : 'text-cream-400 hover:text-cream-100 hover:bg-charcoal-800'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Discover</span>
              </button>
            </div>
          </div>

          {/* Search Bar (Discover tab only) */}
          {activeTab === 'discover' && (
            <div className="flex-shrink-0 p-3 border-b border-cream-500/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500/40" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-sm text-cream-100 placeholder:text-cream-500/40 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            </div>
          )}

          {/* League List (Scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : hasError ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-cream-500/60 mb-3">{error?.message || 'Error loading'}</p>
                <button
                  onClick={() => refetch()}
                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-10 h-10 text-cream-500/20 mx-auto mb-3" />
                <p className="text-sm text-cream-500/60 mb-4">
                  {activeTab === 'my-leagues'
                    ? 'No leagues joined yet'
                    : searchTerm ? 'No matches found' : 'No public leagues available'}
                </p>
                {activeTab === 'my-leagues' && (
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="text-xs text-gold-400 hover:text-gold-300"
                  >
                    Browse available leagues →
                  </button>
                )}
              </div>
            ) : (
              <>
                {currentList.map(league => (
                  <LeagueListItem
                    key={league.id}
                    league={league}
                    isSelected={selectedLeague?.id === league.id}
                    isMember={myLeagues.some(l => l.id === league.id)}
                  />
                ))}

                {/* Load More for Discover */}
                {activeTab === 'discover' && hasNextPage && !searchTerm && (
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full py-2 text-xs text-cream-400 hover:text-cream-100 transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ============================================================
            RIGHT PANE: League Detail View
            ============================================================ */}
        <div className={`flex-1 flex flex-col min-h-0 ${!selectedLeague ? 'hidden lg:flex' : 'flex'}`}>
          {selectedLeague ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back Button */}
              <div className="lg:hidden flex-shrink-0 p-3 border-b border-cream-500/10 bg-charcoal-950/50">
                <button
                  onClick={() => setSelectedLeague(null)}
                  className="flex items-center gap-2 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-display">Back to List</span>
                </button>
              </div>

              {/* League Detail */}
              <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
                <LeagueDetailView
                  league={selectedLeague}
                  userProfile={userProfile}
                  onBack={() => setSelectedLeague(null)}
                  onLeave={() => handleLeaveLeague(selectedLeague.id)}
                  embedded={true}
                />
              </div>
            </div>
          ) : (
            /* Empty State - No League Selected */
            <div className="flex-1 flex items-center justify-center bg-charcoal-950/30">
              <EmptyState
                variant="signal"
                title="Select a Circuit"
                subtitle="Choose a league from the sidebar to view standings, members, and compete with other directors."
                actionLabel="Create League"
                onAction={() => setShowCreateModal(true)}
              />
            </div>
          )}
        </div>
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
