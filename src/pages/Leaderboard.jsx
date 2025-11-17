import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { Trophy, Medal, Award, Crown, Star, Users, TrendingUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import toast from 'react-hot-toast';

// Remove any duplicate import of useEffect here - this was likely at line 11

const Leaderboard = () => {
  const { user } = useAuth();
  const { loggedInProfile } = useUserStore();
  const [leaderboardData, setLeaderboardData] = useState({
    overall: [],
    weekly: [],
    monthly: [],
    lifetime: []
  });
  const [activeTab, setActiveTab] = useState('overall');
  const [activeClass, setActiveClass] = useState('world');
  const [isLoading, setIsLoading] = useState(true);
  const [userRank, setUserRank] = useState(null);
  const [lifetimeView, setLifetimeView] = useState('totalPoints'); // totalPoints, totalSeasons, totalShows, bestSeason, championships

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch overall leaderboard
        const overallRef = collection(db, 'artifacts', dataNamespace, 'leaderboard', 'overall', activeClass);
        const overallQuery = query(overallRef, orderBy('score', 'desc'), limit(100));
        const overallSnapshot = await getDocs(overallQuery);
        const overallData = overallSnapshot.docs.map((doc, index) => ({
          id: doc.id,
          rank: index + 1,
          ...doc.data()
        }));

        // Fetch weekly leaderboard
        const weeklyRef = collection(db, 'artifacts', dataNamespace, 'leaderboard', 'weekly', activeClass);
        const weeklyQuery = query(weeklyRef, orderBy('score', 'desc'), limit(100));
        const weeklySnapshot = await getDocs(weeklyQuery);
        const weeklyData = weeklySnapshot.docs.map((doc, index) => ({
          id: doc.id,
          rank: index + 1,
          ...doc.data()
        }));

        // Fetch monthly leaderboard
        const monthlyRef = collection(db, 'artifacts', dataNamespace, 'leaderboard', 'monthly', activeClass);
        const monthlyQuery = query(monthlyRef, orderBy('score', 'desc'), limit(100));
        const monthlySnapshot = await getDocs(monthlyQuery);
        const monthlyData = monthlySnapshot.docs.map((doc, index) => ({
          id: doc.id,
          rank: index + 1,
          ...doc.data()
        }));

        // Fetch lifetime stats leaderboard
        const usersRef = collection(db, 'artifacts', dataNamespace, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const lifetimeData = [];

        for (const userDoc of usersSnapshot.docs) {
          const profileRef = collection(db, 'artifacts', dataNamespace, 'users', userDoc.id, 'profile');
          const profileSnapshot = await getDocs(profileRef);

          if (!profileSnapshot.empty) {
            const profileData = profileSnapshot.docs[0].data();
            if (profileData.lifetimeStats && profileData.username) {
              lifetimeData.push({
                id: userDoc.id,
                username: profileData.username,
                userTitle: profileData.userTitle,
                lifetimeStats: profileData.lifetimeStats
              });
            }
          }
        }

        // Sort by the selected lifetime view
        const sortedLifetimeData = lifetimeData.sort((a, b) => {
          const aVal = a.lifetimeStats[lifetimeView] || 0;
          const bVal = b.lifetimeStats[lifetimeView] || 0;
          return bVal - aVal;
        }).slice(0, 100).map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));

        setLeaderboardData({
          overall: overallData,
          weekly: weeklyData,
          monthly: monthlyData,
          lifetime: sortedLifetimeData
        });

        // Find user's rank if logged in
        if (user && loggedInProfile?.username) {
          const userData = overallData.find(entry => entry.username === loggedInProfile.username);
          if (userData) {
            setUserRank(userData.rank);
          }
        }

      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        toast.error('Failed to load leaderboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [activeClass, user, loggedInProfile, lifetimeView]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Trophy className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />;
      default:
        return <span className="text-cream-light font-bold">#{rank}</span>;
    }
  };

  const getRankBgColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border-yellow-400/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-orange-400/20 to-orange-500/10 border-orange-400/30';
      default:
        if (rank <= 10) return 'bg-cream-dark/20 border-cream-light/20';
        return 'bg-black-light/30 border-cream-dark/10';
    }
  };

  const tabs = [
    { id: 'overall', label: 'Overall', icon: Trophy },
    { id: 'weekly', label: 'Weekly', icon: TrendingUp },
    { id: 'monthly', label: 'Monthly', icon: Star },
    { id: 'lifetime', label: 'Lifetime Stats', icon: Award }
  ];

  const lifetimeViews = [
    { id: 'totalPoints', label: 'Total Points', desc: 'All-time points' },
    { id: 'totalSeasons', label: 'Seasons', desc: 'Seasons played' },
    { id: 'totalShows', label: 'Shows', desc: 'Shows attended' },
    { id: 'bestSeasonScore', label: 'Best Season', desc: 'Highest season score' },
    { id: 'leagueChampionships', label: 'Championships', desc: 'League titles won' }
  ];

  const classes = [
    { id: 'world', label: 'World Class' },
    { id: 'open', label: 'Open Class' },
    { id: 'a', label: 'A Class' },
    { id: 'soundsport', label: 'SoundSport' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-cream mb-4">Leaderboard</h1>
        <p className="text-cream-light">Compete with players worldwide</p>
      </motion.div>

      {/* User Rank Card */}
      {user && userRank && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-r from-gold/20 to-gold-light/10 border border-gold/30 rounded-lg p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
                {getRankIcon(userRank)}
              </div>
              <div>
                <p className="text-cream-light text-sm">Your Current Rank</p>
                <p className="text-2xl font-bold text-cream">#{userRank}</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-gold text-black-dark rounded-lg hover:bg-gold-light transition-colors">
              View My Stats
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-black-light rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-gold text-black-dark'
                    : 'text-cream-light hover:text-cream hover:bg-black-light/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Class Filter (only show for non-lifetime tabs) */}
      {activeTab !== 'lifetime' && (
        <div className="flex justify-center mb-8">
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveClass(cls.id)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeClass === cls.id
                    ? 'bg-cream text-black-dark'
                    : 'bg-black-light text-cream-light hover:bg-black-light/70'
                }`}
              >
                {cls.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lifetime View Selector */}
      {activeTab === 'lifetime' && (
        <div className="flex justify-center mb-8">
          <div className="flex flex-wrap gap-2">
            {lifetimeViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setLifetimeView(view.id)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  lifetimeView === view.id
                    ? 'bg-gold text-black-dark'
                    : 'bg-black-light text-cream-light hover:bg-black-light/70'
                }`}
              >
                <div className="text-sm font-semibold">{view.label}</div>
                <div className="text-xs opacity-75">{view.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <motion.div
        key={`${activeTab}-${activeClass}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-black-light rounded-lg overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
          </div>
        ) : leaderboardData[activeTab].length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black-dark border-b border-cream-dark/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-cream-light">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-cream-light">Player</th>
                    {activeTab !== 'lifetime' && (
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-light">Corps</th>
                    )}
                    {activeTab === 'lifetime' ? (
                      <>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Total Points</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Seasons</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Shows</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Best Season</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Championships</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Score</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-cream-light">Trophies</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-dark/10">
                  {leaderboardData[activeTab].map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-black/30 transition-colors ${
                        loggedInProfile?.username === entry.username ? 'bg-gold/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {getRankIcon(entry.rank)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cream-dark/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-cream-light" />
                          </div>
                          <div>
                            <p className="text-cream font-medium">{entry.username}</p>
                            <p className="text-cream-light/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                          </div>
                        </div>
                      </td>
                      {activeTab === 'lifetime' ? (
                        <>
                          <td className="px-6 py-4 text-right">
                            <p className="text-cream font-bold">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-cream font-bold">{entry.lifetimeStats?.totalSeasons || 0}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-cream font-bold">{entry.lifetimeStats?.totalShows || 0}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-cream font-bold">{entry.lifetimeStats?.bestSeasonScore?.toFixed(2) || '0.00'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Trophy className="w-4 h-4 text-gold" />
                              <span className="text-cream font-bold">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <p className="text-cream-light">{entry.corpsName || 'No Corps'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-cream font-bold">{entry.score?.toFixed(2) || '0.00'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Trophy className="w-4 h-4 text-gold" />
                              <span className="text-cream">{entry.trophies || 0}</span>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
              {leaderboardData[activeTab].map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg p-4 border-2 transition-all ${
                    getRankBgColor(entry.rank)
                  } ${loggedInProfile?.username === entry.username ? 'ring-2 ring-gold' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div>
                        <p className="text-cream font-semibold text-base">{entry.username}</p>
                        <p className="text-cream-light/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                      </div>
                    </div>
                    {activeTab === 'lifetime' ? (
                      <div className="text-right">
                        <p className="text-cream font-bold text-lg">{entry.lifetimeStats?.[lifetimeView]?.toLocaleString() || '0'}</p>
                        <p className="text-cream-light/60 text-xs">{lifetimeViews.find(v => v.id === lifetimeView)?.label}</p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-cream font-bold text-lg">{entry.score?.toFixed(2) || '0.00'}</p>
                        <p className="text-cream-light/60 text-xs">Score</p>
                      </div>
                    )}
                  </div>
                  {activeTab === 'lifetime' ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex flex-col text-cream-light">
                        <span className="text-xs opacity-60">Total Points</span>
                        <span className="font-semibold">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex flex-col text-cream-light">
                        <span className="text-xs opacity-60">Seasons</span>
                        <span className="font-semibold">{entry.lifetimeStats?.totalSeasons || 0}</span>
                      </div>
                      <div className="flex flex-col text-cream-light">
                        <span className="text-xs opacity-60">Shows</span>
                        <span className="font-semibold">{entry.lifetimeStats?.totalShows || 0}</span>
                      </div>
                      <div className="flex flex-col text-cream-light">
                        <span className="text-xs opacity-60">Championships</span>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-gold" />
                          <span className="font-semibold">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cream-light">
                        <Users className="w-4 h-4" />
                        <span>{entry.corpsName || 'No Corps'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-cream-light">
                        <Trophy className="w-4 h-4 text-gold" />
                        <span className="font-semibold">{entry.trophies || 0}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-cream-dark mx-auto mb-4" />
            <p className="text-cream-light">No leaderboard data available</p>
            <p className="text-cream-light/60 text-sm mt-2">Check back after the first competition</p>
          </div>
        )}
      </motion.div>

      {/* Load More Button */}
      {!isLoading && leaderboardData[activeTab].length >= 100 && (
        <div className="flex justify-center mt-8">
          <button className="flex items-center gap-2 px-6 py-3 bg-black-light text-cream rounded-lg hover:bg-black/50 transition-colors">
            <ChevronDown className="w-5 h-5" />
            Load More
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Leaderboard;