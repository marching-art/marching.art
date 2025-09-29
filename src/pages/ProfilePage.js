import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from 'firebaseConfig';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
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
  Target,
  Crown,
  Coins
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
        
        // For now, use mock data since performance history collections don't exist yet
        setPerformanceHistory([]);
        setSeasonStats([]);
      } else {
        console.error('Profile not found');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  const formatScore = (score) => {
    if (!score) return '0.000';
    return parseFloat(score).toFixed(3);
  };

  const getClassIcon = (className) => {
    switch(className) {
      case 'World Class': return <Crown className="w-5 h-5 text-purple-500" />;
      case 'Open Class': return <Trophy className="w-5 h-5 text-blue-500" />;
      case 'A Class': return <Award className="w-5 h-5 text-green-500" />;
      default: return <Star className="w-5 h-5 text-orange-500" />;
    }
  };

  const getHighestClass = () => {
    if (!profile?.unlockedClasses) return 'SoundSport';
    const classOrder = ['SoundSport', 'A Class', 'Open Class', 'World Class'];
    return profile.unlockedClasses.reduce((highest, current) => {
      return classOrder.indexOf(current) > classOrder.indexOf(highest) ? current : highest;
    });
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
        <div className="text-text-primary-dark text-xl">Profile not found.</div>
      </div>
    );
  }

  const currentClass = getHighestClass();

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-surface-dark to-background-dark p-6 rounded-theme shadow-theme-dark">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-text-primary-dark">
                {profile.displayName || 'Anonymous Director'}
              </h1>
              {profile.isPublic && (
                <div className="flex items-center space-x-1 text-green-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Public</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-text-secondary-dark">
              {profile.location && (
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(profile.createdAt?.toDate?.() || profile.createdAt)}</span>
              </div>
            </div>

            {profile.bio && (
              <p className="text-text-primary-dark mt-3 max-w-2xl">{profile.bio}</p>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-end space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary-dark">{profile.xp || 0}</div>
                <div className="text-sm text-text-secondary-dark">XP</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold text-text-primary-dark">
                    {profile.corpsCoin?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="text-sm text-text-secondary-dark">CorpsCoin</div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-2">
              {getClassIcon(currentClass)}
              <span className="font-semibold text-text-primary-dark">{currentClass}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Corps Information */}
      {profile.corps && (
        <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
          <h2 className="text-2xl font-bold text-text-primary-dark mb-4">Current Corps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-text-primary-dark mb-2">
                {profile.corps.corpsName}
              </h3>
              <p className="text-text-secondary-dark mb-4">
                Directed by {profile.corps.alias}
              </p>
              {profile.showConcept && (
                <div>
                  <h4 className="font-medium text-text-primary-dark mb-2">Show Concept</h4>
                  <p className="text-text-secondary-dark">{profile.showConcept}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="bg-background-dark p-4 rounded-theme">
                <h4 className="font-medium text-text-primary-dark mb-2">Season Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-text-primary-dark">
                      {formatScore(profile.totalSeasonScore)}
                    </div>
                    <div className="text-sm text-text-secondary-dark">Current Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-text-primary-dark">
                      {profile.seasonRank || '-'}
                    </div>
                    <div className="text-sm text-text-secondary-dark">Season Rank</div>
                  </div>
                </div>
              </div>
              
              {profile.uniform && (
                <div className="bg-background-dark p-4 rounded-theme">
                  <h4 className="font-medium text-text-primary-dark mb-2">Uniform Colors</h4>
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: profile.uniform.colors?.primary || '#000000' }}
                      title="Primary Color"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: profile.uniform.colors?.secondary || '#cccccc' }}
                      title="Secondary Color"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: profile.uniform.colors?.accent || '#ff0000' }}
                      title="Accent Color"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-surface-dark p-1 rounded-theme shadow-theme-dark">
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'history', label: 'Performance History', icon: BarChart3 },
            { id: 'achievements', label: 'Achievements', icon: Trophy }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-theme transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary'
                    : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Stats */}
          <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary-dark">Experience Points</span>
                <span className="font-semibold text-text-primary-dark">{profile.xp || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary-dark">Current Class</span>
                <span className="font-semibold text-text-primary-dark">{currentClass}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary-dark">CorpsCoin Balance</span>
                <span className="font-semibold text-text-primary-dark">
                  {profile.corpsCoin?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary-dark">Unlocked Classes</span>
                <span className="font-semibold text-text-primary-dark">
                  {profile.unlockedClasses?.length || 1}
                </span>
              </div>
            </div>
          </div>
          
          {/* Class Progress */}
          <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Class Progress</h3>
            <div className="space-y-4">
              {['SoundSport', 'A Class', 'Open Class', 'World Class'].map((className, index) => {
                const isUnlocked = profile.unlockedClasses?.includes(className);
                const requirements = {
                  'SoundSport': 0,
                  'A Class': 500,
                  'Open Class': 2000,
                  'World Class': 5000
                };
                const required = requirements[className];
                const current = profile.xp || 0;
                const progress = required === 0 ? 100 : Math.min(100, (current / required) * 100);
                
                return (
                  <div key={className} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {getClassIcon(className)}
                        <span className={`font-medium ${
                          isUnlocked ? 'text-text-primary-dark' : 'text-text-secondary-dark'
                        }`}>
                          {className}
                        </span>
                      </div>
                      <span className={`text-sm ${
                        isUnlocked ? 'text-green-400' : 'text-text-secondary-dark'
                      }`}>
                        {isUnlocked ? 'Unlocked' : `${required} XP`}
                      </span>
                    </div>
                    <div className="w-full bg-accent-dark rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isUnlocked ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Performance History</h3>
          <div className="text-center py-8">
            <BarChart3 className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
            <p className="text-text-secondary-dark">Performance history will be available once the season starts.</p>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Achievements</h3>
          <div className="text-center py-8">
            <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
            <p className="text-text-secondary-dark">Achievement system coming soon!</p>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-text-primary-dark">Comments</h3>
          <MessageCircle className="w-5 h-5 text-text-secondary-dark" />
        </div>
        <div className="text-center py-8">
          <MessageCircle className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
          <p className="text-text-secondary-dark">Comments system coming soon!</p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;