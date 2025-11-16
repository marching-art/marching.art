// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Trophy, Users, Calendar, Star, TrendingUp,
  ChevronRight, Plus, Edit, Lock, Zap, AlertCircle, Check,
  Target, Heart, Wrench, MapPin
} from 'lucide-react';
import { useAuth } from '../App';
import { db, functions, seasonHelpers, analyticsHelpers } from '../firebase';
import { doc, collection, onSnapshot, setDoc, updateDoc, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { SkeletonLoader } from '../components/LoadingScreen';
import SeasonInfo from '../components/SeasonInfo';
import {
  ExecutionDashboard,
  RehearsalPanel,
  EquipmentManager,
  StaffRoster
} from '../components/Execution';
import { useExecution } from '../hooks/useExecution';
import CaptionSelectionModal from '../components/CaptionSelection/CaptionSelectionModal';
import ShowSelectionModal from '../components/ShowSelection/ShowSelectionModal';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corps, setCorps] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [showShowSelection, setShowShowSelection] = useState(false);
  const [availableCorps, setAvailableCorps] = useState([]);
  const [season] = useState(seasonHelpers.getCurrentSeason());
  const [recentScores, setRecentScores] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Get the active corps class (for now, use the first available corps)
  const activeCorpsClass = corps ? Object.keys(corps)[0] : null;
  const activeCorps = activeCorpsClass ? corps[activeCorpsClass] : null;

  // Use execution hook
  const {
    executionState,
    loading: executionLoading,
    processing: executionProcessing,
    rehearse,
    repairEquipment,
    upgradeEquipment,
    boostMorale,
    calculateMultiplier,
    canRehearseToday
  } = useExecution(user?.uid, activeCorpsClass);
  
  useEffect(() => {
    if (user) {
      // Subscribe to profile updates
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribeProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProfile(data);
          setCorps(data.corps || null);
        } else {
          // Create initial profile
          const initialProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Director',
            createdAt: new Date(),
            xp: 0,
            xpLevel: 1,
            unlockedClasses: ['soundSport'],
            achievements: [],
            stats: {
              seasonsPlayed: 0,
              championships: 0,
              topTenFinishes: 0
            }
          };
          setDoc(profileRef, initialProfile);
        }
        setLoading(false);
      });

      // Fetch available corps for the season
      fetchAvailableCorps();

      // Fetch recent scores
      fetchRecentScores();

      // Subscribe to league rankings
      subscribeToLeagueRankings();

      return () => {
        unsubscribeProfile();
      };
    }
  }, [user]);

  const fetchAvailableCorps = async () => {
    try {
      const seasonId = `${season.year}-${season.type}`;
      const corpsDataRef = doc(db, 'dci-data', seasonId);
      const corpsDataSnap = await getDoc(corpsDataRef);

      if (corpsDataSnap.exists()) {
        const data = corpsDataSnap.data();
        const corpsData = data.corpsValues || [];
        setAvailableCorps(corpsData);
      } else {
        setAvailableCorps([]);
      }
    } catch (error) {
      console.error('Error fetching available corps:', error);
      setAvailableCorps([]);
    }
  };

const fetchRecentScores = async () => {
  try {
    const seasonId = `${season.year}-${season.type}`;
    const recapDocRef = doc(db, 'fantasy_recaps', seasonId);
    const recapDocSnap = await getDoc(recapDocRef);

    if (recapDocSnap.exists()) {
      const allRecaps = recapDocSnap.data().recaps || [];
      // Sort by date descending and take the first 5, map to expected UI shape
      const sortedRecaps = allRecaps
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(r => {
          // For SoundSport, mask the scores
          const isSoundSport = activeCorpsClass === 'soundSport';
          return {
            showName: r.showName || r.name || 'Unknown Show',
            date: r.date || '',
            totalScore: isSoundSport ? 'Complete' : (typeof r.totalScore === 'number' ? r.totalScore.toFixed(2) : (r.totalScore || '0.00')),
            rank: isSoundSport ? '🎉' : (r.rank ?? '-')
          };
        });
      setRecentScores(sortedRecaps);
    } else {
      setRecentScores([]);
    }
  } catch (error) {
    console.error('Error fetching recent scores:', error);
  }
};

  const subscribeToLeagueRankings = () => {
    // Subscribe to user's league rankings
    if (profile?.leagues) {
      // Implementation for league rankings
    }
  };

  const handleCorpsRegistration = async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const corpsData = {
        name: formData.name,
        location: formData.location,
        showConcept: formData.showConcept,
        class: formData.class,
        createdAt: new Date(),
        seasonId: `${season.year}-${season.type}`,
        lineup: {},
        score: 0,
        rank: null
      };

      await updateDoc(profileRef, {
        [`corps.${formData.class}`]: corpsData
      });

      analyticsHelpers.logCorpsCreated(formData.class);
      toast.success(`${formData.name} registered successfully!`);
      setShowRegistration(false);
    } catch (error) {
      console.error('Error registering corps:', error);
      toast.error('Failed to register corps. Please try again.');
    }
  };

  const handleCaptionSelection = async (captions) => {
    // The new CaptionSelectionModal handles saving via the backend function
    // This callback is called after successful save
    setShowCaptionSelection(false);
  };

  const handleShowSelection = async (shows) => {
    // The ShowSelectionModal handles saving via the backend function
    // This callback is called after successful save
    setShowShowSelection(false);
  };

  const handleDailyRehearsal = async () => {
    try {
      const dailyRehearsal = httpsCallable(functions, 'dailyRehearsal');
      const result = await dailyRehearsal();

      const data = result.data;

      // Show success message
      if (data.classUnlocked) {
        toast.success(data.message, { duration: 5000, icon: '🎉' });
      } else {
        toast.success(data.message, { duration: 3000 });
      }

      // Show XP gained
      toast.success(`+${data.xpEarned} XP! (${data.totalXP} total)`, {
        duration: 2000,
        icon: '⭐'
      });

      if (data.level > (profile?.xpLevel || 1)) {
        toast.success(`Level Up! Now Level ${data.level}`, {
          duration: 4000,
          icon: '🎊'
        });
      }
    } catch (error) {
      console.error('Error with daily rehearsal:', error);

      if (error.message && error.message.includes('rehearse again in')) {
        toast.error(error.message);
      } else {
        toast.error('Failed to complete rehearsal. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader type="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-cream-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient mb-2">
                Welcome back, {profile?.displayName || 'Director'}!
              </h1>
              <p className="text-cream-300">
                {seasonHelpers.formatSeasonName(season)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* XP Progress */}
              <div className="glass-dark rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Zap className="w-8 h-8 text-gold-500" />
                    <span className="absolute -top-1 -right-1 text-xs font-bold text-gold-500">
                      {profile?.xpLevel || 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-cream-500/60">Level Progress</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-charcoal-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-gold transition-all duration-500"
                          style={{ width: `${((profile?.xp || 0) % 1000) / 10}%` }}
                        />
                      </div>
                      <span className="text-xs text-cream-300">
                        {profile?.xp || 0} XP
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {activeCorpsClass === 'soundSport' ? '🎉' : (activeCorps?.rank || '-')}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">
            {activeCorpsClass === 'soundSport' ? 'Participant' : 'Current Rank'}
          </p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {activeCorpsClass === 'soundSport' ? (
                activeCorps?.totalSeasonScore > 0 ? '✓' : '-'
              ) : (
                activeCorps?.totalSeasonScore?.toFixed(2) || '0.00'
              )}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">
            {activeCorpsClass === 'soundSport' ? 'Performance' : 'Total Score'}
          </p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {profile?.leagues?.length || 0}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">Active Leagues</p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {season.type === 'live' ? season.daysRemaining : '-'}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">Days to Finals</p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      {activeCorps && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('execution')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'execution'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Target className="w-4 h-4" />
            Execution
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Equipment
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Staff
          </button>
        </motion.div>
      )}

      {/* Execution System Panels */}
      <AnimatePresence mode="wait">
        {activeCorps && activeTab === 'execution' && (
          <motion.div
            key="execution"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <ExecutionDashboard
              executionState={executionState}
              multiplier={calculateMultiplier()}
            />
            <RehearsalPanel
              executionState={executionState}
              canRehearseToday={canRehearseToday()}
              onRehearsal={rehearse}
              processing={executionProcessing}
            />
          </motion.div>
        )}

        {activeCorps && activeTab === 'equipment' && (
          <motion.div
            key="equipment"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <EquipmentManager
              equipment={executionState?.equipment}
              onRepair={repairEquipment}
              onUpgrade={upgradeEquipment}
              processing={executionProcessing}
              corpsCoin={profile?.corpsCoin || 0}
            />
          </motion.div>
        )}

        {activeCorps && activeTab === 'staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <StaffRoster
              staff={executionState?.staff}
              processing={executionProcessing}
              corpsCoin={profile?.corpsCoin || 0}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Season Info & Corps Management */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Season Information */}
        <SeasonInfo className="lg:col-span-1" />

        {/* Corps Management Card */}
        <div className="lg:col-span-2">
          {/* Corps Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {!activeCorps ? (
          // Registration CTA
          <div className="card-premium p-8 text-center">
            <Music className="w-16 h-16 text-gold-500 mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Start Your Journey
            </h2>
            <p className="text-cream-300 mb-6">
              Register your fantasy corps and compete in the ultimate drum corps experience
            </p>
            <button
              onClick={() => setShowRegistration(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Register Corps
            </button>
          </div>
        ) : (
          // Corps Dashboard
          <div className="space-y-6">
            {/* Corps Info */}
            <div className="card">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-cream-100 mb-1">
                    {activeCorps.corpsName || activeCorps.name}
                  </h2>
                  <p className="text-cream-500/60">{activeCorps.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${
                      activeCorpsClass === 'world' ? 'badge-gold' :
                      activeCorpsClass === 'open' ? 'badge-cream' :
                      activeCorpsClass === 'soundSport' ? 'badge-success' :
                      'badge-primary'
                    }`}>
                      {activeCorpsClass === 'soundSport' ? 'SoundSport' :
                       activeCorpsClass === 'world' ? 'World Class' :
                       activeCorpsClass === 'open' ? 'Open Class' :
                       activeCorpsClass === 'aClass' ? 'A Class' : 'Unknown'}
                    </span>
                    {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                      <span className="badge badge-gold">
                        <Trophy className="w-3 h-3 mr-1" />
                        Top 10
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn-ghost">
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Show Concept */}
              {activeCorps.showConcept && (
                <div className="p-4 bg-charcoal-900/30 rounded-lg mb-6">
                  <p className="text-sm text-cream-500/60 mb-1">Show Concept</p>
                  <p className="text-cream-100">{activeCorps.showConcept}</p>
                </div>
              )}

              {/* Caption Lineup */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-cream-100">
                      Caption Lineup
                    </h3>
                    {Object.keys(activeCorps.lineup || {}).length > 0 && (() => {
                      const totalPoints = Object.values(activeCorps.lineup).reduce((sum, selection) => {
                        const parts = selection.split('|');
                        return sum + (parseInt(parts[2]) || 0);
                      }, 0);
                      const pointLimits = { soundSport: 90, aClass: 60, open: 120, world: 150 };
                      const limit = pointLimits[activeCorpsClass] || 150;
                      return (
                        <p className="text-sm text-cream-500/60">
                          Total: <span className={`font-bold ${totalPoints > limit ? 'text-red-500' : 'text-gold-500'}`}>
                            {totalPoints}
                          </span> / {limit} points
                        </p>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setShowCaptionSelection(true)}
                    className="btn-outline text-sm py-2"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Lineup
                  </button>
                </div>

                {Object.keys(activeCorps.lineup || {}).length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
                    <p className="text-cream-500/60">No captions selected yet</p>
                    <button
                      onClick={() => setShowCaptionSelection(true)}
                      className="btn-primary mt-4"
                    >
                      Select Captions
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(activeCorps.lineup).map(([caption, selection]) => {
                      // Parse the selection string: corpsName|sourceYear|points
                      const parts = selection.split('|');
                      const corpsName = parts[0] || selection;
                      const year = parts[1] || '';
                      const points = parts[2] || '';

                      return (
                        <div key={caption} className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg">
                          <div className="flex-1">
                            <p className="text-xs text-cream-500/60">{caption}</p>
                            <p className="text-sm font-medium text-cream-100">{corpsName}</p>
                            {year && <p className="text-xs text-cream-500/40">({year})</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gold-500">{points || '?'}</p>
                            <p className="text-xs text-cream-500/60">pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Show Selection */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-cream-100">
                    Show Schedule
                  </h3>
                  <p className="text-sm text-cream-500/60">
                    Week {season.week || season.week === 0 ? season.week : '?'}
                    {activeCorps.selectedShows?.[`week${season.week}`]?.length > 0 &&
                      ` - ${activeCorps.selectedShows[`week${season.week}`].length} shows selected`
                    }
                  </p>
                </div>
                <button
                  onClick={() => setShowShowSelection(true)}
                  className="btn-outline text-sm py-2"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {activeCorps.selectedShows?.[`week${season.week}`]?.length > 0 ? 'Edit Shows' : 'Select Shows'}
                </button>
              </div>

              {!activeCorps.selectedShows?.[`week${season.week}`] || activeCorps.selectedShows[`week${season.week}`].length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
                  <p className="text-cream-500/60 mb-1">No shows selected for this week</p>
                  <p className="text-sm text-cream-500/40 mb-4">Select up to 4 shows to attend</p>
                  <button
                    onClick={() => setShowShowSelection(true)}
                    className="btn-primary"
                  >
                    Select Shows
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCorps.selectedShows[`week${season.week}`].map((show, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-cream-100">{show.eventName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {show.date && (
                            <p className="text-xs text-cream-500/60 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {show.date}
                            </p>
                          )}
                          {show.location && (
                            <p className="text-xs text-cream-500/60 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {show.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-cream-100 mb-4">
                {activeCorpsClass === 'soundSport' ? 'Season Journey' : 'Performance Trend'}
              </h3>
              <div className="h-64 flex items-center justify-center text-cream-500/40">
                <TrendingUp className="w-8 h-8" />
                <span className="ml-2">
                  {activeCorpsClass === 'soundSport'
                    ? 'Your performance history will appear here'
                    : 'Chart coming soon'}
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
        </div>
      </div>
      )}

      {/* Recent Activity */}
      {activeTab === 'overview' && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Recent Scores */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">
            {activeCorpsClass === 'soundSport' ? 'Recent Performances' : 'Recent Scores'}
          </h3>
          {recentScores.length === 0 ? (
            <p className="text-cream-500/60 text-center py-8">
              {activeCorpsClass === 'soundSport'
                ? 'No performances yet'
                : 'No scores available yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {recentScores.map((score, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-cream-500/5 rounded-lg transition-colors">
                  <div>
                    <p className="font-medium text-cream-100">{score.showName}</p>
                    <p className="text-sm text-cream-500/60">{score.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold-500">{score.totalScore}</p>
                    {activeCorpsClass !== 'soundSport' && (
                      <p className="text-xs text-cream-500/60">Rank #{score.rank}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* League Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">
            League Activity
          </h3>
          {!profile?.leagues || profile.leagues.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
              <p className="text-cream-500/60 mb-4">Not in any leagues yet</p>
              <button className="btn-outline">
                Browse Leagues
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* League activity items */}
            </div>
          )}
        </div>
      </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showRegistration && (
          <CorpsRegistrationModal
            onClose={() => setShowRegistration(false)}
            onSubmit={handleCorpsRegistration}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
          />
        )}
        
        {showCaptionSelection && activeCorps && (
          <CaptionSelectionModal
            onClose={() => setShowCaptionSelection(false)}
            onSubmit={handleCaptionSelection}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={`${season.year}-${season.type}`}
          />
        )}

        {showShowSelection && activeCorps && (
          <ShowSelectionModal
            onClose={() => setShowShowSelection(false)}
            onSubmit={handleShowSelection}
            corpsClass={activeCorpsClass}
            currentWeek={season.week || 1}
            seasonId={`${season.year}-${season.type}`}
            currentSelections={activeCorps.selectedShows?.[`week${season.week}`] || []}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Corps Registration Modal Component
const CorpsRegistrationModal = ({ onClose, onSubmit, unlockedClasses }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    showConcept: '',
    class: 'soundSport'
  });

  const classes = [
    { 
      id: 'soundSport', 
      name: 'SoundSport', 
      description: 'Entry level - Perfect for beginners',
      unlocked: true,
      color: 'bg-green-500'
    },
    { 
      id: 'aClass', 
      name: 'A Class', 
      description: 'Intermediate - Requires Level 3',
      unlocked: unlockedClasses.includes('aClass'),
      color: 'bg-blue-500'
    },
    { 
      id: 'open', 
      name: 'Open Class', 
      description: 'Advanced - Requires Level 5',
      unlocked: unlockedClasses.includes('open'),
      color: 'bg-purple-500'
    },
    { 
      id: 'world', 
      name: 'World Class', 
      description: 'Elite - Requires Level 10',
      unlocked: unlockedClasses.includes('world'),
      color: 'bg-gold-500'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8">
          <h2 className="text-3xl font-display font-bold text-gradient mb-6">
            Register Your Corps
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Corps Name */}
            <div>
              <label className="label">Corps Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your corps name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Location */}
            <div>
              <label className="label">Home Location</label>
              <input
                type="text"
                className="input"
                placeholder="City, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Show Concept */}
            <div>
              <label className="label">Show Concept</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your show concept for this season..."
                value={formData.showConcept}
                onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                required
                maxLength={500}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.showConcept.length}/500 characters
              </p>
            </div>

            {/* Class Selection */}
            <div>
              <label className="label">Competition Class</label>
              <div className="grid grid-cols-2 gap-3">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-300
                      ${formData.class === cls.id 
                        ? 'border-gold-500 bg-gold-500/10' 
                        : 'border-cream-500/20 hover:border-cream-500/40'
                      }
                      ${!cls.unlocked ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => cls.unlocked && setFormData({ ...formData, class: cls.id })}
                    disabled={!cls.unlocked}
                  >
                    {!cls.unlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-cream-500/40" />
                      </div>
                    )}
                    {cls.unlocked && formData.class === cls.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-gold-500" />
                      </div>
                    )}
                    <div className={`w-2 h-2 ${cls.color} rounded-full mb-2`} />
                    <p className="font-semibold text-cream-100">{cls.name}</p>
                    <p className="text-xs text-cream-500/60 mt-1">{cls.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
              >
                Register Corps
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
