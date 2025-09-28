import React, { useState, useEffect } from 'react';
import { db } from 'firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trophy, Medal, Award, TrendingUp, Users, Clock } from 'lucide-react';

const LeaderboardPage = () => {
  const [leaderboardData, setLeaderboardData] = useState({});
  const [selectedClass, setSelectedClass] = useState('World Class');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  const classes = ['World Class', 'Open Class', 'A Class', 'SoundSport'];
  const currentSeason = '2025';

  useEffect(() => {
    fetchLeaderboardData();
  }, [currentSeason]);

  const fetchLeaderboardData = async () => {
    try {
      setError('');
      
      // Create mock leaderboard data since collection group queries require special setup
      const mockLeaderboardData = {
        'World Class': [
          {
            id: '1',
            userId: 'user1',
            corpsName: 'Blue Devils Fantasy',
            alias: 'Director A',
            class: 'World Class',
            score: 94.850,
            lastPerformance: new Date('2025-08-10'),
            seasonRank: 1,
            uniforms: { primaryColor: '#0000FF', secondaryColor: '#FFD700' },
            displayName: 'John Smith',
            location: 'California, USA',
            rank: 1
          },
          {
            id: '2', 
            userId: 'user2',
            corpsName: 'Santa Clara Vanguard Elite',
            alias: 'Director B',
            class: 'World Class',
            score: 93.425,
            lastPerformance: new Date('2025-08-10'),
            seasonRank: 2,
            uniforms: { primaryColor: '#FF0000', secondaryColor: '#000000' },
            displayName: 'Jane Doe',
            location: 'California, USA',
            rank: 2
          },
          {
            id: '3',
            userId: 'user3', 
            corpsName: 'Carolina Crown Dynasty',
            alias: 'Director C',
            class: 'World Class',
            score: 92.100,
            lastPerformance: new Date('2025-08-09'),
            seasonRank: 3,
            uniforms: { primaryColor: '#FFD700', secondaryColor: '#000000' },
            displayName: 'Mike Johnson',
            location: 'North Carolina, USA',
            rank: 3
          },
          {
            id: '4',
            userId: 'user4',
            corpsName: 'Bluecoats Thunder', 
            alias: 'Director D',
            class: 'World Class',
            score: 91.750,
            lastPerformance: new Date('2025-08-09'),
            seasonRank: 4,
            uniforms: { primaryColor: '#000080', secondaryColor: '#FFFFFF' },
            displayName: 'Sarah Wilson',
            location: 'Ohio, USA',
            rank: 4
          }
        ],
        'Open Class': [
          {
            id: '5',
            userId: 'user5',
            corpsName: 'Genesis Elite',
            alias: 'Director E', 
            class: 'Open Class',
            score: 89.250,
            lastPerformance: new Date('2025-08-08'),
            seasonRank: 1,
            uniforms: { primaryColor: '#800080', secondaryColor: '#FFFFFF' },
            displayName: 'David Brown',
            location: 'Texas, USA',
            rank: 1
          },
          {
            id: '6',
            userId: 'user6',
            corpsName: 'Spirit Force',
            alias: 'Director F',
            class: 'Open Class', 
            score: 87.900,
            lastPerformance: new Date('2025-08-08'),
            seasonRank: 2,
            uniforms: { primaryColor: '#FF4500', secondaryColor: '#000000' },
            displayName: 'Emily Davis',
            location: 'Georgia, USA',
            rank: 2
          }
        ],
        'A Class': [
          {
            id: '7',
            userId: 'user7',
            corpsName: 'Pioneer Pride',
            alias: 'Director G',
            class: 'A Class',
            score: 82.150,
            lastPerformance: new Date('2025-08-07'),
            seasonRank: 1,
            uniforms: { primaryColor: '#008000', secondaryColor: '#FFFFFF' },
            displayName: 'Chris Miller',
            location: 'Wisconsin, USA',
            rank: 1
          }
        ],
        'SoundSport': [
          {
            id: '8',
            userId: 'user8',
            corpsName: 'Thunder Bay Ensemble',
            alias: 'Director H',
            class: 'SoundSport',
            score: 78.500,
            lastPerformance: new Date('2025-08-06'),
            seasonRank: 1,
            uniforms: { primaryColor: '#4B0082', secondaryColor: '#FFD700' },
            displayName: 'Alex Taylor',
            location: 'Ontario, Canada',
            rank: 1
          },
          {
            id: '9',
            userId: 'user9',
            corpsName: 'Rising Stars',
            alias: 'Director I',
            class: 'SoundSport',
            score: 76.250,
            lastPerformance: new Date('2025-08-06'),
            seasonRank: 2,
            uniforms: { primaryColor: '#FF1493', secondaryColor: '#000000' },
            displayName: 'Jordan Lee',
            location: 'Florida, USA',
            rank: 2
          }
        ]
      };

      setLeaderboardData(mockLeaderboardData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setError('Failed to load leaderboard data. Please try again.');
      toast.error('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-text-secondary-dark font-bold">{rank}</span>;
  };

  const getRankBadge = (rank) => {
    let badgeClass = 'bg-surface-dark border-accent-dark';
    if (rank === 1) badgeClass = 'bg-yellow-500 border-yellow-600 text-black';
    else if (rank === 2) badgeClass = 'bg-gray-400 border-gray-500 text-black';
    else if (rank === 3) badgeClass = 'bg-amber-600 border-amber-700 text-white';
    
    return `${badgeClass} border rounded-full w-10 h-10 flex items-center justify-center font-bold`;
  };

  const formatScore = (score) => {
    return typeof score === 'number' ? score.toFixed(3) : '0.000';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = dateString instanceof Date ? dateString : new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleProfileClick = (userId) => {
    window.location.href = `/profile/${userId}`;
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchLeaderboardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Error Loading Leaderboard</h3>
        <p className="text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentClassData = leaderboardData[selectedClass] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary-dark mb-2">Leaderboard</h1>
        <p className="text-text-secondary-dark text-lg">
          {currentSeason} Season Rankings • {currentClassData.length} Active Corps
        </p>
        {lastUpdated && (
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-text-secondary-dark">
            <Clock className="w-4 h-4" />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Class Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {classes.map(cls => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={`px-6 py-3 rounded-theme font-medium transition-colors flex items-center gap-2 ${
              selectedClass === cls
                ? 'bg-primary text-on-primary'
                : 'bg-surface-dark text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
            }`}
          >
            <Users className="w-4 h-4" />
            {cls}
            <span className="bg-background-dark px-2 py-1 rounded-full text-xs">
              {leaderboardData[cls]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {currentClassData.length > 0 ? (
        <div className="bg-surface-dark rounded-theme shadow-theme-dark overflow-hidden">
          {/* Table Header */}
          <div className="bg-accent-dark p-4">
            <div className="grid grid-cols-12 gap-4 font-semibold text-text-primary-dark">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-4">Corps</div>
              <div className="col-span-2 text-center">Director</div>
              <div className="col-span-2 text-center">Score</div>
              <div className="col-span-2 text-center">Last Performance</div>
              <div className="col-span-1 text-center">Trend</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-accent-dark">
            {currentClassData.map((corps, index) => (
              <div
                key={corps.id}
                className={`grid grid-cols-12 gap-4 p-4 hover:bg-background-dark transition-colors cursor-pointer ${
                  corps.rank <= 3 ? 'bg-gradient-to-r from-accent-dark/20 to-transparent' : ''
                }`}
                onClick={() => handleProfileClick(corps.userId)}
              >
                {/* Rank */}
                <div className="col-span-1 flex justify-center items-center">
                  <div className={getRankBadge(corps.rank)}>
                    {corps.rank <= 3 ? getRankIcon(corps.rank) : corps.rank}
                  </div>
                </div>

                {/* Corps Info */}
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    {/* Uniform Color Indicator */}
                    <div 
                      className="w-4 h-4 rounded border border-accent-dark flex-shrink-0"
                      style={{ 
                        backgroundColor: corps.uniforms?.primaryColor || '#8B4513',
                        borderColor: corps.uniforms?.secondaryColor || '#F7941D'
                      }}
                    />
                    <div>
                      <div className="font-semibold text-text-primary-dark hover:text-primary-dark transition-colors">
                        {corps.corpsName}
                      </div>
                      {corps.location && (
                        <p className="text-sm text-text-secondary-dark">{corps.location}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Director */}
                <div className="col-span-2 text-center">
                  <p className="text-text-primary-dark font-medium">{corps.alias}</p>
                  {corps.displayName && (
                    <p className="text-sm text-text-secondary-dark">{corps.displayName}</p>
                  )}
                </div>

                {/* Score */}
                <div className="col-span-2 text-center">
                  <p className="text-xl font-bold text-text-primary-dark">
                    {formatScore(corps.score)}
                  </p>
                  {corps.seasonRank > 0 && (
                    <p className="text-sm text-text-secondary-dark">
                      Season: #{corps.seasonRank}
                    </p>
                  )}
                </div>

                {/* Last Performance */}
                <div className="col-span-2 text-center">
                  <p className="text-text-primary-dark">
                    {formatDate(corps.lastPerformance)}
                  </p>
                </div>

                {/* Trend */}
                <div className="col-span-1 flex justify-center items-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
          <h3 className="text-xl font-medium text-text-primary-dark mb-2">
            No corps found for {selectedClass}
          </h3>
          <p className="text-text-secondary-dark">
            Be the first to register for this class!
          </p>
        </div>
      )}

      {/* Stats Summary */}
      {currentClassData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-surface-dark p-4 rounded-theme text-center">
            <h4 className="font-semibold text-text-primary-dark mb-2">Highest Score</h4>
            <p className="text-2xl font-bold text-primary-dark">
              {formatScore(currentClassData[0]?.score)}
            </p>
            <p className="text-sm text-text-secondary-dark">{currentClassData[0]?.corpsName}</p>
          </div>
          <div className="bg-surface-dark p-4 rounded-theme text-center">
            <h4 className="font-semibold text-text-primary-dark mb-2">Active Corps</h4>
            <p className="text-2xl font-bold text-primary-dark">{currentClassData.length}</p>
            <p className="text-sm text-text-secondary-dark">in {selectedClass}</p>
          </div>
          <div className="bg-surface-dark p-4 rounded-theme text-center">
            <h4 className="font-semibold text-text-primary-dark mb-2">Average Score</h4>
            <p className="text-2xl font-bold text-primary-dark">
              {currentClassData.length > 0 ? formatScore(
                currentClassData.reduce((sum, corps) => sum + corps.score, 0) / currentClassData.length
              ) : '0.000'}
            </p>
            <p className="text-sm text-text-secondary-dark">across all corps</p>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={handleRefresh}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Refresh Rankings
        </button>
      </div>
    </div>
  );
};

export default LeaderboardPage;