import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Users, 
  Trophy, 
  Star, 
  TrendingUp, 
  MessageSquare, 
  Crown,
  Shield,
  Target,
  Plus,
  Search,
  Filter,
  Calendar,
  Award,
  Zap,
  Lock,
  CheckCircle,
  X,
  ArrowRight
} from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';

const LeaguesPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse', 'myLeagues', 'create'
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'public', 'private', 'competitive'
  const [sortBy, setSortBy] = useState('members'); // 'members', 'rating', 'recent'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, [currentUser]);

  const fetchLeagues = async () => {
    try {
      setLoading(true);

      // Fetch all public leagues
      const leaguesRef = collection(db, 'leagues');
      const leaguesSnap = await getDocs(leaguesRef);
      
      const allLeagues = [];
      const userLeagues = [];

      leaguesSnap.forEach(doc => {
        const leagueData = { id: doc.id, ...doc.data() };
        allLeagues.push(leagueData);
        
        if (currentUser && leagueData.members && leagueData.members.includes(currentUser.uid)) {
          userLeagues.push(leagueData);
        }
      });

      // Sort leagues by member count (default)
      allLeagues.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

      setLeagues(allLeagues);
      setMyLeagues(userLeagues);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      toast.error('Failed to load leagues');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeagues = () => {
    let filtered = leagues;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(league => 
        league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (league.description && league.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(league => {
        if (filterType === 'public') return league.isPublic === true;
        if (filterType === 'private') return league.isPublic === false;
        if (filterType === 'competitive') return league.isCompetitive === true;
        return true;
      });
    }

    // Sort
    if (sortBy === 'members') {
      filtered.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
        const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
        return dateB - dateA;
      });
    }

    return filtered;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Unknown';
    }
  };

  const getLeagueIcon = (league) => {
    if (league.isCompetitive) return Trophy;
    if (league.tier === 'elite') return Crown;
    if (league.tier === 'pro') return Shield;
    return Users;
  };

  const getLeagueTier = (memberCount) => {
    if (memberCount >= 50) return { name: 'Elite', color: 'text-purple-500', bg: 'bg-purple-500' };
    if (memberCount >= 25) return { name: 'Pro', color: 'text-blue-500', bg: 'bg-blue-500' };
    if (memberCount >= 10) return { name: 'Advanced', color: 'text-green-500', bg: 'bg-green-500' };
    return { name: 'Casual', color: 'text-orange-500', bg: 'bg-orange-500' };
  };

  const handleJoinLeague = async (leagueId) => {
    if (!currentUser) {
      toast.error('Please sign in to join a league');
      return;
    }

    try {
      // In production, this would call a cloud function
      toast.success('League join request sent!');
      
      // Refresh leagues
      await fetchLeagues();
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error('Failed to join league');
    }
  };

  const handleLeagueClick = (league) => {
    setSelectedLeague(league);
    setShowDetailsModal(true);
  };

  if (loading) {
    return <LoadingScreen message="Loading leagues..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Leagues
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          Compete with friends, build rivalries, and climb the rankings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-primary dark:text-primary-dark" />
          <div className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
            {leagues.length}
          </div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Active Leagues</p>
        </div>
        
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-primary dark:text-primary-dark" />
          <div className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
            {myLeagues.length}
          </div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Your Leagues</p>
        </div>
        
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark text-center">
          <Star className="w-12 h-12 mx-auto mb-3 text-primary dark:text-primary-dark" />
          <div className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
            {leagues.reduce((sum, l) => sum + (l.memberCount || 0), 0)}
          </div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Total Members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface dark:bg-surface-dark p-2 rounded-theme shadow-theme dark:shadow-theme-dark">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex-1 px-4 py-3 rounded-theme font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'browse'
              ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
          }`}
        >
          <Search className="w-5 h-5" />
          Browse Leagues
        </button>
        
        {currentUser && (
          <button
            onClick={() => setActiveTab('myLeagues')}
            className={`flex-1 px-4 py-3 rounded-theme font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'myLeagues'
                ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark'
                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
            }`}
          >
            <Shield className="w-5 h-5" />
            My Leagues
            {myLeagues.length > 0 && (
              <span className="bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-2 py-1 rounded-full text-xs">
                {myLeagues.length}
              </span>
            )}
          </button>
        )}
        
        {currentUser && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-secondary dark:bg-secondary-dark text-on-secondary dark:text-on-secondary-dark rounded-theme font-medium transition-colors hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create League
          </button>
        )}
      </div>

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                />
              </div>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
              >
                <option value="all">All Types</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="competitive">Competitive</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
              >
                <option value="members">Most Members</option>
                <option value="rating">Highest Rated</option>
                <option value="recent">Recently Created</option>
              </select>
            </div>
          </div>

          {/* Leagues Grid */}
          {filteredLeagues().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeagues().map(league => {
                const LeagueIcon = getLeagueIcon(league);
                const tier = getLeagueTier(league.memberCount || 0);
                const isMember = myLeagues.some(ml => ml.id === league.id);
                
                return (
                  <div
                    key={league.id}
                    onClick={() => handleLeagueClick(league)}
                    className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-primary dark:hover:border-primary-dark"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                          <LeagueIcon className="w-8 h-8 text-primary dark:text-primary-dark" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
                            {league.name}
                          </h3>
                          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {league.creatorName || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      
                      {isMember && (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      )}
                    </div>

                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4 line-clamp-2">
                      {league.description || 'No description available'}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
                        <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                          {league.memberCount || 0} members
                        </span>
                      </div>
                      
                      <span className={`text-xs font-semibold ${tier.color} bg-opacity-10 ${tier.bg} bg-opacity-10 px-2 py-1 rounded-full`}>
                        {tier.name}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {league.isPublic ? (
                        <span className="text-xs bg-green-500 bg-opacity-10 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Public
                        </span>
                      ) : (
                        <span className="text-xs bg-accent dark:bg-accent-dark px-2 py-1 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Private
                        </span>
                      )}
                      
                      {league.isCompetitive && (
                        <span className="text-xs bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 text-primary dark:text-primary-dark px-2 py-1 rounded-full flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Competitive
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-12 text-center shadow-theme dark:shadow-theme-dark">
              <Search className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
                No Leagues Found
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* My Leagues Tab */}
      {activeTab === 'myLeagues' && (
        <div className="space-y-4">
          {myLeagues.length > 0 ? (
            myLeagues.map(league => {
              const LeagueIcon = getLeagueIcon(league);
              const tier = getLeagueTier(league.memberCount || 0);
              
              return (
                <div
                  key={league.id}
                  onClick={() => handleLeagueClick(league)}
                  className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer border-2 border-primary dark:border-primary-dark"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-4 rounded-theme">
                        <LeagueIcon className="w-10 h-10 text-primary dark:text-primary-dark" />
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                          {league.name}
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-2">
                          {league.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-text-secondary dark:text-text-secondary-dark">
                            <Users className="w-4 h-4" />
                            {league.memberCount || 0} members
                          </span>
                          <span className="flex items-center gap-1 text-text-secondary dark:text-text-secondary-dark">
                            <Calendar className="w-4 h-4" />
                            {formatDate(league.createdAt)}
                          </span>
                          <span className={`flex items-center gap-1 ${tier.color}`}>
                            <Star className="w-4 h-4" />
                            {tier.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <ArrowRight className="w-6 h-6 text-primary dark:text-primary-dark" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-12 text-center shadow-theme dark:shadow-theme-dark">
              <Shield className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
                You're Not in Any Leagues Yet
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                Browse available leagues and join one to start competing!
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-3 rounded-theme font-medium transition-colors hover:opacity-90"
              >
                Browse Leagues
              </button>
            </div>
          )}
        </div>
      )}

      {/* League Details Modal */}
      {showDetailsModal && selectedLeague && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-4 rounded-theme">
                  {React.createElement(getLeagueIcon(selectedLeague), {
                    className: "w-12 h-12 text-primary dark:text-primary-dark"
                  })}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                    {selectedLeague.name}
                  </h2>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    Created by {selectedLeague.creatorName || 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* League Details */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Description</h3>
                <p className="text-text-secondary dark:text-text-secondary-dark bg-background dark:bg-background-dark p-4 rounded-theme">
                  {selectedLeague.description || 'No description available'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <span className="font-semibold text-text-primary dark:text-text-primary-dark">Members</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {selectedLeague.memberCount || 0}
                  </p>
                </div>
                
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <span className="font-semibold text-text-primary dark:text-text-primary-dark">Created</span>
                  </div>
                  <p className="text-lg font-medium text-text-primary dark:text-text-primary-dark">
                    {formatDate(selectedLeague.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                {!myLeagues.some(ml => ml.id === selectedLeague.id) ? (
                  <button
                    onClick={() => handleJoinLeague(selectedLeague.id)}
                    disabled={!currentUser}
                    className="flex-1 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-3 rounded-theme font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {currentUser ? 'Request to Join' : 'Sign In to Join'}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/leagues/${selectedLeague.id}`)}
                    className="flex-1 bg-secondary dark:bg-secondary-dark text-on-secondary dark:text-on-secondary-dark px-6 py-3 rounded-theme font-medium transition-colors hover:opacity-90 flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-5 h-5" />
                    View League Dashboard
                  </button>
                )}
                
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-3 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark rounded-theme font-medium transition-colors hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Create New League
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-background dark:bg-background-dark p-6 rounded-theme text-center">
              <Plus className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                League Creation Coming Soon!
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                The league creation feature is currently in development. Stay tuned for updates!
              </p>
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-2 rounded-theme font-medium transition-colors hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;