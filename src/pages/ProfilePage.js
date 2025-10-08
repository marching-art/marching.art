import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { 
  User, 
  MapPin, 
  Calendar, 
  Award,
  Coins,
  Star,
  TrendingUp,
  Settings,
  Trophy,
  Target,
  Shield,
  Music
} from 'lucide-react';

const ProfilePage = () => {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [corpsList, setCorpsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = currentUser && currentUser.uid === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Load profile
      const profileRef = doc(db, `artifacts/marching-art/users/${userId}/profile/data`);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        setProfile({ id: profileSnap.id, ...profileSnap.data() });
      }

      // Load all user's corps
      const corpsRef = collection(db, `artifacts/marching-art/users/${userId}/corps`);
      const corpsQuery = query(corpsRef, where('isActive', '==', true));
      const corpsSnap = await getDocs(corpsQuery);

      const corps = [];
      corpsSnap.forEach(doc => {
        corps.push({ id: doc.id, ...doc.data() });
      });

      // Sort by class
      const classOrder = ['World Class', 'Open Class', 'A Class', 'SoundSport'];
      corps.sort((a, b) => classOrder.indexOf(a.corpsClass) - classOrder.indexOf(b.corpsClass));

      setCorpsList(corps);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClassIcon = (corpsClass) => {
    const icons = {
      'SoundSport': Music,
      'A Class': Award,
      'Open Class': Trophy,
      'World Class': Star
    };
    const Icon = icons[corpsClass] || Star;
    return <Icon className="w-5 h-5" />;
  };

  const getClassColor = (corpsClass) => {
    const colors = {
      'SoundSport': 'text-blue-500 border-blue-500 bg-blue-500/10',
      'A Class': 'text-green-500 border-green-500 bg-green-500/10',
      'Open Class': 'text-purple-500 border-purple-500 bg-purple-500/10',
      'World Class': 'text-yellow-500 border-yellow-500 bg-yellow-500/10'
    };
    return colors[corpsClass] || 'text-primary border-primary bg-primary/10';
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <User className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Profile Not Found
        </h2>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          This user profile could not be found.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-16 h-16 bg-primary dark:bg-primary-dark rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                  {profile.displayName || profile.alias || 'Anonymous'}
                </h1>
                {profile.location && (
                  <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-text-secondary dark:text-text-secondary-dark mt-3 max-w-2xl">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {isOwnProfile && (
              <button
                onClick={() => navigate('/settings')}
                className="px-4 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold flex items-center gap-2 transition-all"
              >
                <Settings className="w-4 h-4" />
                Edit Profile
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary dark:text-primary-dark" />
                  <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {profile.xp || 0}
                  </div>
                </div>
                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">XP</div>
              </div>
              <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {profile.corpsCoin?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">CorpsCoin</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Corps Grid */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
          <Target className="w-6 h-6" />
          Corps ({corpsList.length})
        </h2>

        {corpsList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {corpsList.map(corps => {
              const classColor = getClassColor(corps.corpsClass);

              return (
                <div
                  key={corps.id}
                  className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border-2 ${classColor} shadow-theme dark:shadow-theme-dark`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getClassIcon(corps.corpsClass)}
                      <div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {corps.corpsName}
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                          {corps.corpsClass}
                        </p>
                      </div>
                    </div>
                  </div>

                  {corps.alias && (
                    <div className="mb-3 text-sm">
                      <span className="text-text-secondary dark:text-text-secondary-dark">Director: </span>
                      <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                        {corps.alias}
                      </span>
                    </div>
                  )}

                  {corps.location && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                      <MapPin className="w-4 h-4" />
                      <span>{corps.location}</span>
                    </div>
                  )}

                  {corps.showConcept && (
                    <div className="mb-4 p-3 bg-background dark:bg-background-dark rounded-theme">
                      <div className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-1">
                        Show Concept:
                      </div>
                      <p className="text-sm text-text-primary dark:text-text-primary-dark">
                        {corps.showConcept}
                      </p>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-accent dark:border-accent-dark">
                    <div className="text-center">
                      <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                        {corps.stats?.totalShows || 0}
                      </div>
                      <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        Shows
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary dark:text-primary-dark">
                        {corps.stats?.bestScore?.toFixed(3) || 'N/A'}
                      </div>
                      <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        Best Score
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-secondary dark:text-secondary-dark">
                        #{corps.stats?.seasonRank || '--'}
                      </div>
                      <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        Rank
                      </div>
                    </div>
                  </div>

                  {/* Uniform Preview */}
                  {corps.uniforms && (
                    <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                      <div className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">
                        Uniform Colors:
                      </div>
                      <div className="flex gap-2">
                        <div 
                          className="w-8 h-8 rounded border-2 border-accent dark:border-accent-dark"
                          style={{ backgroundColor: corps.uniforms.jacket?.baseColor || '#8B4513' }}
                          title="Jacket"
                        />
                        <div 
                          className="w-8 h-8 rounded border-2 border-accent dark:border-accent-dark"
                          style={{ backgroundColor: corps.uniforms.pants?.baseColor || '#000000' }}
                          title="Pants"
                        />
                        <div 
                          className="w-8 h-8 rounded border-2 border-accent dark:border-accent-dark"
                          style={{ backgroundColor: corps.uniforms.shako?.baseColor || '#8B4513' }}
                          title="Shako"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-surface dark:bg-surface-dark rounded-theme border-2 border-dashed border-accent dark:border-accent-dark">
            <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
            <p className="text-text-secondary dark:text-text-secondary-dark">
              No active corps yet
            </p>
          </div>
        )}
      </div>

      {/* Member Since */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-text-secondary dark:text-text-secondary-dark">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">
            Member since {profile.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;