import React, { useState, useEffect } from 'react';
import { db } from 'firebaseConfig';
import { collectionGroup, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
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
      // Fetch leaderboard data for all classes using collection group query
      const leaderboardRef = collectionGroup(db, 'data');
      const q = query(
        leaderboardRef,
        limit(500) // Limit for performance
      );
      
      const snapshot = await getDocs(q);
      const allCorps = [];
      
      snapshot.docs.forEach(doc => {
        try {
          const data = doc.data();
          
          // Safety checks for required data
          if (!data || !data.corps) return;
          
          // Skip new users
          if (data.corps.corpsName === 'New Corps') return;
          
          // Only include users with active season data
          if (!data.activeSeasonId || data.activeSeasonId !== currentSeason) return;
          
          // Build corps data with safe defaults
          const corpsData = {
            id: doc.id,
            userId: data.id || doc.ref.parent.parent.id,
            corpsName: data.corps.corpsName || 'Unknown Corps',
            alias: data.corps.alias || 'Director',
            class: data.corps.class || 'SoundSport',
            score: typeof data.corps.lastScore === 'number' ? data.corps.lastScore : 0,
            lastPerformance: data.corps.lastPerformance || null,
            seasonRank: typeof data.corps.seasonRank === 'number' ? data.corps.seasonRank : 0,
            uniforms: data.uniforms || {},
            displayName: data.displayName || '',
            location: data.location || ''
          };
          
          // Only add if we have valid data
          if (corpsData.corpsName && corpsData.corpsName !== 'Unknown Corps') {
            allCorps.push(corpsData);
          }
        } catch (docError) {
          console.warn('Error processing document:', doc.id, docError);
        }
      });

      // Group by class and sort by score
      const groupedData = {};
      classes.forEach(cls => {
        const classCorps = allCorps
          .filter(corps => corps.class === cls)
          .sort((a, b) => b.score - a.score)
          .map((corps, index) => ({ ...corps, rank: index + 1 }));
        
        groupedData[cls] = classCorps;
      });

      setLeaderboardData(groupedData);
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
      const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
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