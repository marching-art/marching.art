import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from 'firebaseConfig';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  Trophy, 
  Award, 
  MapPin, 
  Calendar, 
  Users, 
  TrendingUp, 
  Star,
  MessageCircle,
  BarChart3,
  Clock,
  Target
} from 'lucide-react';

const ProfilePage = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [performanceHistory, setPerformanceHistory] = useState([]);
  const [seasonStats, setSeasonStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userId) {
      fetchProfileData();
    }
  }, [userId]);

  const fetchProfileData = async () => {
    try {
      // Fetch user profile
      const profileRef = doc(db, `artifacts/marching-art/users/${userId}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const profileData = { id: profileSnap.id, ...profileSnap.data() };
        setProfile(profileData);
        
        // Fetch performance history
        await fetchPerformanceHistory(userId);
        
        // Fetch season statistics
        await fetchSeasonStats(userId);
      } else {
        console.error('Profile not found');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceHistory = async (uid) => {
    try {
      const performanceRef = collection(db, `performance_history/${uid}/performances`);
      const q = query(performanceRef, orderBy('date', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      
      const performances = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || new Date(doc.data().date)
      }));
      
      setPerformanceHistory(performances);
    } catch (error) {
      console.error('Error fetching performance history:', error);
    }
  };

  const fetchSeasonStats = async (uid) => {
    try {
      // This would typically come from aggregated season data
      // For now, we'll simulate some season statistics
      const mockSeasonStats = [
        { season: '2023', avgScore: 82.150, rank: 15, performances: 8, topScore: 85.200 },
        { season: '2024', avgScore: 84.750, rank: 12, performances: 10, topScore: 87.900 },
        { season: '2025', avgScore: 86.200, rank: 8, performances: 6, topScore: 88.450 }
      ];
      
      setSeasonStats(mockSeasonStats);
    } catch (error) {
      console.error('Error fetching season stats:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatScore = (score) => {
    return typeof score === 'number' ? score.toFixed(3) : '0.000';
  };

  const getClassBadge = (className) => {
    const colors = {
      'World Class': 'bg-red-500 text-white',
      'Open Class': 'bg-blue-500 text-white',
      'A Class': 'bg-green-500 text-white',
      'SoundSport': 'bg-purple-500 text-white'
    };
    
    return `${colors[className] || 'bg-gray-500 text-white'} px-3 py-1 rounded-full text-sm font-medium`;
  };

  const getAchievementBadges = () => {
    if (!profile?.stats) return [];
    
    const achievements = [];
    const stats = profile.stats;
    
    if (stats.championshipsWon > 0) {
      achievements.push({
        icon: Trophy,
        title: 'Champion',
        description: `${stats.championshipsWon} Championships`,
        color: 'text-yellow-500'
      });
    }
    
    if (stats.topFinishes?.first > 0) {
      achievements.push({
        icon: Award,
        title: 'Gold Medalist',
        description: `${stats.topFinishes.first} First Places`,
        color: 'text-yellow-400'
      });
    }
    
    if (stats.totalSeasons >= 5) {
      achievements.push({
        icon: Star,
        title: 'Veteran',
        description: `${stats.totalSeasons} Seasons`,
        color: 'text-primary-dark'
      });
    }
    
    if (profile.level >= 10) {
      achievements.push({
        icon: TrendingUp,
        title: 'Expert',
        description: `Level ${profile.level}`,
        color: 'text-green-500'
      });
    }
    
    return achievements;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Profile Not Found</h3>
        <p className="text-text-secondary-dark">This user profile could not be found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Corps Visual */}
          <div className="flex-shrink-0">
            <div 
              className="w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold"
              style={{ 
                backgroundColor: profile.uniforms?.primaryColor || '#8B4513',
                borderColor: profile.uniforms?.secondaryColor || '#F7941D',
                color: profile.uniforms?.textColor || '#FFFFFF'
              }}
            >
              {profile.corps?.corpsName?.charAt(0) || 'C'}
            </div>
          </div>

          {/* Corps Info */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold text-text-primary-dark">{profile.corps?.corpsName}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-lg text-text-secondary-dark">{profile.corps?.alias}</span>
                  <span className={getClassBadge(profile.corps?.class)}>{profile.corps?.class}</span>
                </div>
                
                <div className="flex items-center gap-4 mt-3 text-text-secondary-dark">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {profile.createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Joined {formatDate(profile.createdAt.toDate?.() || new Date(profile.createdAt))}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span>Level {profile.level || 1}</span>
                  </div>
                </div>
              </div>

              {/* Current Season Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center bg-background-dark p-3 rounded-theme">
                  <div className="text-2xl font-bold text-primary-dark">{formatScore(profile.corps?.lastScore || 0)}</div>
                  <div className="text-xs text-text-secondary-dark">Latest Score</div>
                </div>
                <div className="text-center bg-background-dark p-3 rounded-theme">
                  <div className="text-2xl font-bold text-primary-dark">#{profile.corps?.seasonRank || 'N/A'}</div>
                  <div className="text-xs text-text-secondary-dark">Season Rank</div>
                </div>
                <div className="text-center bg-background-dark p-3 rounded-theme">
                  <div className="text-2xl font-bold text-primary-dark">{profile.corps?.totalPerformances || 0}</div>
                  <div className="text-xs text-text-secondary-dark">Performances</div>
                </div>
                <div className="text-center bg-background-dark p-3 rounded-theme">
                  <div className="text-2xl font-bold text-primary-dark">{profile.xp || 0}</div>
                  <div className="text-xs text-text-secondary-dark">Total XP</div>
                </div>
              </div>
            </div>

            {/* Biography */}
            {profile.corps?.biography && (
              <div className="mt-4 p-4 bg-background-dark rounded-theme">
                <h4 className="font-semibold text-text-primary-dark mb-2">About</h4>
                <p className="text-text-secondary-dark">{profile.corps.biography}</p>
              </div>
            )}
          </div>
        </div>

        {/* Achievements */}
        {getAchievementBadges().length > 0 && (
          <div className="mt-6 pt-6 border-t border-accent-dark">
            <h4 className="font-semibold text-text-primary-dark mb-3">Achievements</h4>
            <div className="flex flex-wrap gap-3">
              {getAchievementBadges().map((achievement, index) => (
                <div key={index} className="flex items-center gap-2 bg-background-dark px-3 py-2 rounded-theme">
                  <achievement.icon className={`w-5 h-5 ${achievement.color}`} />
                  <div>
                    <div className="font-medium text-text-primary-dark text-sm">{achievement.title}</div>
                    <div className="text-xs text-text-secondary-dark">{achievement.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-surface-dark rounded-theme p-2 shadow-theme-dark">
        <div className="flex gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'performance', label: 'Performance History', icon: TrendingUp },
            { id: 'statistics', label: 'Statistics', icon: Target },
            { id: 'schedule', label: 'Schedule', icon: Calendar }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-theme font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Season Overview */}
          <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Current Season</h3>
            {profile.corps?.showConcept && (
              <div className="mb-4">
                <h4 className="font-medium text-text-primary-dark mb-2">Show Concept</h4>
                <p className="text-text-secondary-dark italic">"{profile.corps.showConcept}"</p>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-secondary-dark">Season ID:</span>
                <span className="font-medium text-text-primary-dark">{profile.activeSeasonId || '2025'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary-dark">Class:</span>
                <span className={getClassBadge(profile.corps?.class)}>{profile.corps?.class}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary-dark">Last Performance:</span>
                <span className="font-medium text-text-primary-dark">
                  {formatDate(profile.corps?.lastPerformance?.toDate?.() || new Date(profile.corps?.lastPerformance))}
                </span>
              </div>
            </div>
          </div>

          {/* Career Highlights */}
          <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Career Highlights</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-background-dark rounded-theme">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  <div>
                    <div className="font-medium text-text-primary-dark">Championships</div>
                    <div className="text-sm text-text-secondary-dark">Total wins</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary-dark">
                  {profile.stats?.championshipsWon || 0}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background-dark rounded-theme">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-primary-dark" />
                  <div>
                    <div className="font-medium text-text-primary-dark">Best Score</div>
                    <div className="text-sm text-text-secondary-dark">All-time high</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary-dark">
                  {formatScore(profile.stats?.bestScore || 0)}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background-dark rounded-theme">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-green-500" />
                  <div>
                    <div className="font-medium text-text-primary-dark">Total Seasons</div>
                    <div className="text-sm text-text-secondary-dark">Experience</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary-dark">
                  {profile.stats?.totalSeasons || 1}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Performance Chart */}
          {performanceHistory.length > 0 && (
            <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
              <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Score Progression</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceHistory.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => formatDate(new Date(date))}
                    />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip 
                      labelFormatter={(date) => formatDate(new Date(date))}
                      contentStyle={{ 
                        backgroundColor: 'rgb(40 28 20)', 
                        border: '1px solid rgb(101 67 33)',
                        borderRadius: '0.75rem'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalScore" 
                      stroke="#F7941D" 
                      strokeWidth={3}
                      dot={{ fill: '#F7941D', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Performances */}
          <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Recent Performances</h3>
            {performanceHistory.length > 0 ? (
              <div className="space-y-3">
                {performanceHistory.slice(0, 10).map((performance, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-background-dark rounded-theme">
                    <div>
                      <div className="font-medium text-text-primary-dark">{performance.showName}</div>
                      <div className="text-sm text-text-secondary-dark">
                        {formatDate(performance.date)} • {performance.location}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-dark">
                        {formatScore(performance.totalScore)}
                      </div>
                      <div className="text-sm text-text-secondary-dark">
                        Rank #{performance.placement}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-text-secondary-dark mb-3" />
                <p className="text-text-secondary-dark">No performance history available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* Season Comparison Chart */}
          {seasonStats.length > 0 && (
            <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
              <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Season Comparison</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={seasonStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="season" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgb(40 28 20)', 
                        border: '1px solid rgb(101 67 33)',
                        borderRadius: '0.75rem'
                      }}
                    />
                    <Bar dataKey="avgScore" fill="#F7941D" name="Average Score" />
                    <Bar dataKey="topScore" fill="#8B4513" name="Top Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
              <h4 className="font-semibold text-text-primary-dark mb-4">Performance Stats</h4>
              <div className="space-y-3">
                {seasonStats.map((season, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-background-dark rounded">
                    <span className="font-medium text-text-primary-dark">{season.season}</span>
                    <div className="text-right">
                      <div className="text-sm text-text-secondary-dark">Avg: {formatScore(season.avgScore)}</div>
                      <div className="text-xs text-text-secondary-dark">Rank: #{season.rank}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
              <h4 className="font-semibold text-text-primary-dark mb-4">Achievement Breakdown</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary-dark">🥇 First Place Finishes:</span>
                  <span className="font-medium text-text-primary-dark">{profile.stats?.topFinishes?.first || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary-dark">🥈 Second Place Finishes:</span>
                  <span className="font-medium text-text-primary-dark">{profile.stats?.topFinishes?.second || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary-dark">🥉 Third Place Finishes:</span>
                  <span className="font-medium text-text-primary-dark">{profile.stats?.topFinishes?.third || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary-dark">Average Score:</span>
                  <span className="font-medium text-text-primary-dark">{formatScore(profile.stats?.averageScore || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Upcoming Schedule</h3>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto text-text-secondary-dark mb-3" />
            <p className="text-text-secondary-dark">Schedule information coming soon</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        <button className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-on-primary rounded-theme font-medium transition-colors">
          <MessageCircle className="w-4 h-4" />
          Send Message
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-accent-dark hover:bg-secondary text-text-primary-dark rounded-theme font-medium transition-colors">
          <Users className="w-4 h-4" />
          Add Friend
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;