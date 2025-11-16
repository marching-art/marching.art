// src/pages/Leagues.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, Plus, Search, Crown, TrendingUp, Award,
  Calendar, X, Check, Shield, Star, AlertCircle, Lock
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, onSnapshot, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import {
  createLeague,
  joinLeague,
  leaveLeague
} from '../firebase/functions';
import toast from 'react-hot-toast';

const Leagues = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-leagues');
  const [myLeagues, setMyLeagues] = useState([]);
  const [availableLeagues, setAvailableLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadMyLeagues();
      loadAvailableLeagues();
    }
  }, [user]);

  const loadUserProfile = () => {
    const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    });
    return unsubscribe;
  };

  const loadMyLeagues = async () => {
    try {
      const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
      const q = query(
        leaguesRef,
        where('members', 'array-contains', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const leagues = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMyLeagues(leagues);
    } catch (error) {
      console.error('Error loading my leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableLeagues = async () => {
    try {
      const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
      const q = query(
        leaguesRef,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );

      const querySnapshot = await getDocs(q);
      const leagues = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAvailableLeagues(leagues);
    } catch (error) {
      console.error('Error loading available leagues:', error);
    }
  };

  const handleCreateLeague = async (leagueData) => {
    try {
      const result = await createLeague(leagueData);

      if (result.data.success) {
        toast.success('League created successfully!', { icon: '🏆' });
        setShowCreateModal(false);
        loadMyLeagues();
        loadAvailableLeagues();
      }
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error(error.message || 'Failed to create league');
    }
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      const result = await joinLeague({ leagueId });

      if (result.data.success) {
        toast.success('Joined league successfully!', { icon: '🎉' });
        loadMyLeagues();
        loadAvailableLeagues();
      }
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error(error.message || 'Failed to join league');
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    if (!confirm('Are you sure you want to leave this league?')) return;

    try {
      const result = await leaveLeague({ leagueId });

      if (result.data.success) {
        toast.success('Left league successfully');
        loadMyLeagues();
      }
    } catch (error) {
      console.error('Error leaving league:', error);
      toast.error(error.message || 'Failed to leave league');
    }
  };

  const filteredAvailableLeagues = availableLeagues.filter(league =>
    league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    league.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient mb-2">
                Leagues
              </h1>
              <p className="text-cream-300">
                Compete with other directors in fantasy leagues
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create League
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('my-leagues')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold ${
            activeTab === 'my-leagues'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Trophy className="w-5 h-5" />
          My Leagues ({myLeagues.length})
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold ${
            activeTab === 'discover'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Search className="w-5 h-5" />
          Discover Leagues
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'my-leagues' && (
          <motion.div
            key="my-leagues"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {loading ? (
              <div className="card p-8 text-center">
                <p className="text-cream-500/60">Loading leagues...</p>
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="card p-12 text-center">
                <Users className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-cream-100 mb-2">
                  You're not in any leagues yet
                </h3>
                <p className="text-cream-500/60 mb-6">
                  Join a public league or create your own to compete with other directors
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="btn-outline"
                  >
                    Browse Leagues
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create League
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLeagues.map(league => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    isMember={true}
                    onLeave={() => handleLeaveLeague(league.id)}
                    userProfile={userProfile}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Search Bar */}
            <div className="card p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/60" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            {/* Available Leagues */}
            {filteredAvailableLeagues.length === 0 ? (
              <div className="card p-12 text-center">
                <Search className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-cream-100 mb-2">
                  No leagues found
                </h3>
                <p className="text-cream-500/60">
                  Try adjusting your search or create your own league
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAvailableLeagues.map(league => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    isMember={myLeagues.some(l => l.id === league.id)}
                    onJoin={() => handleJoinLeague(league.id)}
                    userProfile={userProfile}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

// League Card Component
const LeagueCard = ({ league, isMember, onJoin, onLeave, userProfile }) => {
  const memberCount = league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="card-hover p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-cream-100">{league.name}</h3>
            {!league.isPublic && (
              <Lock className="w-4 h-4 text-cream-500/60" />
            )}
          </div>
          <p className="text-sm text-cream-500/60 line-clamp-2">
            {league.description || 'No description provided'}
          </p>
        </div>
        {league.creatorId === userProfile?.uid && (
          <Crown className="w-5 h-5 text-gold-500" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-charcoal-900/50 rounded-lg">
          <p className="text-xs text-cream-500/60 mb-1">Members</p>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-cream-100">
              {memberCount}/{maxMembers}
            </span>
          </div>
        </div>
        <div className="p-3 bg-charcoal-900/50 rounded-lg">
          <p className="text-xs text-cream-500/60 mb-1">Type</p>
          <span className="text-sm font-bold text-cream-100">
            {league.isPublic ? 'Public' : 'Private'}
          </span>
        </div>
      </div>

      {isMember ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm font-semibold text-green-400">Member</span>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="btn-ghost w-full text-red-400 hover:bg-red-500/10"
          >
            Leave League
          </button>
        </div>
      ) : (
        <button
          onClick={onJoin}
          disabled={memberCount >= maxMembers}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {memberCount >= maxMembers ? 'League Full' : 'Join League'}
        </button>
      )}
    </motion.div>
  );
};

// Create League Modal
const CreateLeagueModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 20,
    scoringSystem: 'standard'
  });
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      await onCreate(formData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setProcessing(false);
    }
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-display font-bold text-gradient">
              Create League
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-cream-500/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-cream-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* League Name */}
            <div>
              <label className="label">League Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DCI Fantasy Champions"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Description */}
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your league..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={200}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.description.length}/200 characters
              </p>
            </div>

            {/* Max Members */}
            <div>
              <label className="label">Maximum Members</label>
              <input
                type="number"
                className="input"
                min="2"
                max="50"
                value={formData.maxMembers}
                onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                required
              />
            </div>

            {/* Public/Private */}
            <div>
              <label className="label">League Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: true })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.isPublic
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/20 hover:border-cream-500/40'
                  }`}
                >
                  <Users className="w-6 h-6 mx-auto mb-2 text-cream-100" />
                  <p className="font-semibold text-cream-100">Public</p>
                  <p className="text-xs text-cream-500/60 mt-1">
                    Anyone can join
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: false })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    !formData.isPublic
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/20 hover:border-cream-500/40'
                  }`}
                >
                  <Lock className="w-6 h-6 mx-auto mb-2 text-cream-100" />
                  <p className="font-semibold text-cream-100">Private</p>
                  <p className="text-xs text-cream-500/60 mt-1">
                    Invite only
                  </p>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? 'Creating...' : 'Create League'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Leagues;
