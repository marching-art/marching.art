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
import { useDataStore } from '../store/dataStore';
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
  const { fetchLeagues: getCachedLeagues } = useDataStore();
  
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
    loadLeaguesData();
  }, [currentUser]);

  const loadLeaguesData = async () => {
    try {
      setLoading(true);

      // OPTIMIZED: Use cached leagues with pagination
      const cachedLeagues = await getCachedLeagues(50, false);

      // Filter user's leagues from the cached data
      const userLeagues = currentUser 
        ? cachedLeagues.filter(league => league.members && league.members.includes(currentUser.uid))
        : [];

      // Sort leagues by member count (default)
      cachedLeagues.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

      setLeagues(cachedLeagues);
      setMyLeagues(userLeagues);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      toast.error('Failed to load leagues');
    } finally {
      setLoading(false);
    }
  };

  const openLeagueDetails = (league) => {
    setSelectedLeague(league);
    setShowDetailsModal(true);
  };

  const handleJoinLeague = async (leagueId) => {
    if (!currentUser) {
      toast.error('Please log in to join leagues');
      return;
    }

    try {
      // TODO: Implement join league function
      toast.success('League join request sent!');
      setShowDetailsModal(false);
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error('Failed to join league');
    }
  };

  const handleCreateLeague = async (leagueData) => {
    if (!currentUser) {
      toast.error('Please log in to create leagues');
      return;
    }

    try {
      // TODO: Implement create league function
      toast.success('League created successfully!');
      setShowCreateModal(false);
      loadLeaguesData();
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error('Failed to create league');
    }
  };

  const filteredLeagues = leagues.filter(league => {
    // Search filter
    if (searchTerm && !league.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filterType !== 'all') {
      if (filterType === 'public' && !league.isPublic) return false;
      if (filterType === 'private' && league.isPublic) return false;
      if (filterType === 'competitive' && !league.isCompetitive) return false;
    }

    return true;
  });

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
          Join competitive leagues and compete with other corps
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-accent dark:border-accent-dark">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'browse'
              ? 'border-b-2 border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Browse Leagues
          </div>
        </button>
        <button
          onClick={() => setActiveTab('myLeagues')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'myLeagues'
              ? 'border-b-2 border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            My Leagues ({myLeagues.length})
          </div>
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto px-6 py-3 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create League
        </button>
      </div>

      {/* Browse Leagues Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search leagues..."
                  className="w-full px-4 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-primary dark:focus:border-primary-dark"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-primary dark:focus:border-primary-dark"
                >
                  <option value="all">All Types</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="competitive">Competitive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-primary dark:focus:border-primary-dark"
                >
                  <option value="members">Most Members</option>
                  <option value="rating">Highest Rated</option>
                  <option value="recent">Recently Created</option>
                </select>
              </div>
            </div>
          </div>

          {/* Leagues Grid */}
          {filteredLeagues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLeagues.map((league) => (
                <div
                  key={league.id}
                  onClick={() => openLeagueDetails(league)}
                  className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-primary dark:hover:border-primary-dark"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                        <Shield className="w-8 h-8 text-primary dark:text-primary-dark" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {league.name}
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                          {league.isPublic ? 'Public' : 'Private'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-text-secondary dark:text-text-secondary-dark text-sm mb-4 line-clamp-2">
                    {league.description || 'No description available'}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                      <Users className="w-4 h-4" />
                      <span>{league.memberCount || 0} members</span>
                    </div>
                    <div className="flex items-center gap-2 text-primary dark:text-primary-dark">
                      <Trophy className="w-4 h-4" />
                      <span>{league.rating || 0} rating</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
                No Leagues Found
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Try adjusting your filters or create a new league
              </p>
            </div>
          )}
        </div>
      )}

      {/* My Leagues Tab */}
      {activeTab === 'myLeagues' && (
        <div className="space-y-6">
          {myLeagues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myLeagues.map((league) => (
                <div
                  key={league.id}
                  onClick={() => openLeagueDetails(league)}
                  className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-primary dark:hover:border-primary-dark"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {league.name}
                        </h3>
                        <p className="text-sm text-green-500">Member</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-text-secondary dark:text-text-secondary-dark text-sm mb-4 line-clamp-2">
                    {league.description || 'No description available'}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                      <Users className="w-4 h-4" />
                      <span>{league.memberCount || 0} members</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/league/${league.id}`);
                      }}
                      className="flex items-center gap-1 text-primary dark:text-primary-dark hover:underline"
                    >
                      View <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
                No Leagues Yet
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                Join a league to compete with other corps directors
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="px-6 py-2 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
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
                  <Shield className="w-10 h-10 text-primary dark:text-primary-dark" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                    {selectedLeague.name}
                  </h2>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {selectedLeague.isPublic ? 'Public League' : 'Private League'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">About</h3>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  {selectedLeague.description || 'No description available'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Members</h3>
                  </div>
                  <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {selectedLeague.memberCount || 0}
                  </p>
                </div>

                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Rating</h3>
                  </div>
                  <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {selectedLeague.rating || 0}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 rounded-theme border-2 border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark hover:bg-opacity-10 dark:hover:bg-opacity-10 transition-colors"
                >
                  Close
                </button>
                {!myLeagues.find(l => l.id === selectedLeague.id) && (
                  <button
                    onClick={() => handleJoinLeague(selectedLeague.id)}
                    className="px-6 py-2 rounded-theme bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90 transition-opacity"
                  >
                    Join League
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Create New League
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center py-8">
              <Lock className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <p className="text-text-secondary dark:text-text-secondary-dark">
                League creation coming soon!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;