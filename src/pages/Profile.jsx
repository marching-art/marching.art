// =============================================================================
// PROFILE - SPORTS ALMANAC STYLE
// =============================================================================
// Dense stats strip, minimal header, trophy case grid
// Laws: No glow, compact spacing, tables over cards

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User, Trophy, Settings, Star, TrendingUp, Calendar,
  Crown, Medal, MapPin, Edit, Check, X, LogOut, Coins
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { DataTable } from '../components/ui/DataTable';

// =============================================================================
// ACHIEVEMENT DEFINITIONS
// =============================================================================

const getMilestoneAchievements = (profile) => {
  const achievements = [];
  const stats = profile?.stats || {};
  const unlockedClasses = profile?.unlockedClasses || [];

  if ((stats.championships || 0) >= 1) {
    achievements.push({ id: 'champ', icon: Trophy, label: 'Champ' });
  }
  if ((stats.championships || 0) >= 3) {
    achievements.push({ id: 'dynasty', icon: Crown, label: 'Dynasty' });
  }
  if ((stats.seasonsPlayed || 0) >= 1) {
    achievements.push({ id: 'rookie', icon: Star, label: 'Rookie' });
  }
  if ((stats.seasonsPlayed || 0) >= 5) {
    achievements.push({ id: 'veteran', icon: Medal, label: 'Veteran' });
  }
  if ((stats.seasonsPlayed || 0) >= 10) {
    achievements.push({ id: 'legend', icon: Star, label: 'Legend' });
  }
  if (unlockedClasses.includes('world') || unlockedClasses.includes('worldClass')) {
    achievements.push({ id: 'world', icon: TrendingUp, label: 'World' });
  }

  return achievements;
};

// =============================================================================
// SEASON HISTORY TABLE COLUMNS
// =============================================================================

const seasonHistoryColumns = [
  {
    key: 'seasonNumber',
    header: 'SZN',
    width: '50px',
    align: 'center',
    render: (row) => <span className="text-gray-400 tabular-nums">S{row.seasonNumber || '?'}</span>,
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => <span className="text-white">{row.corpsName || 'Unknown'}</span>,
  },
  {
    key: 'className',
    header: 'Class',
    width: '70px',
    render: (row) => {
      const names = { worldClass: 'World', openClass: 'Open', aClass: 'A', soundSport: 'SS' };
      return <span className="text-gray-400">{names[row.classKey] || row.classKey}</span>;
    },
  },
  {
    key: 'placement',
    header: 'RK',
    width: '50px',
    align: 'center',
    isRank: true,
    render: (row) => row.placement ? `#${row.placement}` : '-',
  },
  {
    key: 'finalScore',
    header: 'Score',
    width: '60px',
    align: 'right',
    render: (row) => (
      <span className="text-white tabular-nums">
        {row.finalScore ? row.finalScore.toFixed(3) : '-'}
      </span>
    ),
  },
];

// =============================================================================
// SETTINGS MODAL
// =============================================================================

const SettingsModal = ({ user, isOpen, onClose }) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
      onClose();
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-[#1a1a1a] border-t sm:border border-[#333] rounded-t-2xl sm:rounded-lg safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile only */}
        <div className="sm:hidden flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
          <span className="text-sm font-bold uppercase text-gray-400">Settings</span>
          <button
            onClick={onClose}
            className="p-2.5 -mr-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</div>
            <div className="text-base text-white font-data">{user?.email || 'Anonymous'}</div>
          </div>

          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Member Since</div>
            <div className="text-base text-white">
              {user?.metadata?.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString()
                : 'Unknown'}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full mt-4 py-4 min-h-[52px] bg-red-500/10 border border-red-500/30 text-red-400 text-base font-bold hover:bg-red-500/20 active:bg-red-500/30 transition-all press-feedback rounded-sm flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN PROFILE COMPONENT
// =============================================================================

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;
  const profileUserId = userId || user?.uid;

  const { data: profile, isLoading, error, isError, refetch } = useProfile(profileUserId);
  const updateProfileMutation = useUpdateProfile(profileUserId || '');

  // Achievements
  const achievements = useMemo(() => getMilestoneAchievements(profile), [profile]);

  // Team name
  const teamName = useMemo(() => {
    if (!profile?.corps) return null;
    const corps = Object.values(profile.corps)[0];
    return corps?.corpsName || corps?.name || null;
  }, [profile?.corps]);

  // Stats
  const stats = useMemo(() => {
    if (!profile?.corps) return { starts: 0, avgScore: '-', bestFinish: '-', badges: 0 };

    let totalScore = 0;
    let scoreCount = 0;
    let bestRank = null;

    Object.values(profile.corps).forEach((corps) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          if (season.finalScore) {
            totalScore += season.finalScore;
            scoreCount++;
          }
          if (season.placement && (bestRank === null || season.placement < bestRank)) {
            bestRank = season.placement;
          }
        });
      }
      if (corps.totalSeasonScore) {
        totalScore += corps.totalSeasonScore;
        scoreCount++;
      }
      if (corps.ranking && (bestRank === null || corps.ranking < bestRank)) {
        bestRank = corps.ranking;
      }
    });

    return {
      starts: profile?.stats?.seasonsPlayed || scoreCount || 0,
      avgScore: scoreCount > 0 ? (totalScore / scoreCount).toFixed(3) : '-',
      bestFinish: bestRank ? `#${bestRank}` : '-',
      badges: achievements.length,
    };
  }, [profile, achievements]);

  // Season history
  const seasonHistory = useMemo(() => {
    if (!profile?.corps) return [];
    const history = [];
    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          history.push({ ...season, corpsName: corps.name || corps.corpsName, classKey });
        });
      }
    });
    return history.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
  }, [profile]);

  // Handlers
  const handleStartEdit = () => {
    setEditData({
      displayName: profile?.displayName || '',
      location: profile?.location || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync(editData);
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
  }

  // Error state
  if (isError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error?.message || 'Error loading profile'}</p>
        <button onClick={() => refetch()} className="text-[#0057B8] hover:underline">
          Try Again
        </button>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <User className="w-12 h-12 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER - Minimal: Square Avatar + Name + Team */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Square Avatar */}
            <div className="w-14 h-14 bg-[#333] border border-[#444] flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-gray-500" />
              )}
            </div>

            {/* Name + Team */}
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.displayName}
                  onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                  className="px-2 py-1 bg-[#222] border border-[#444] text-white text-lg font-bold focus:outline-none focus:border-[#0057B8]"
                  placeholder="Display Name"
                />
              ) : (
                <h1 className="text-lg font-bold text-white">
                  {profile.displayName || 'Anonymous Director'}
                </h1>
              )}
              {teamName && <p className="text-sm text-gray-500">{teamName}</p>}
              {!isEditing && profile.location && (
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {profile.location}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center">
            {isOwnProfile && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-2.5 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Edit profile"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Edit fields */}
        {isEditing && (
          <div className="w-full mt-3 flex items-center gap-2">
            <input
              type="text"
              value={editData.location}
              onChange={(e) => setEditData({ ...editData, location: e.target.value })}
              placeholder="Location"
              className="flex-1 px-2 py-1 bg-[#222] border border-[#444] text-white text-sm focus:outline-none focus:border-[#0057B8]"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold"
            >
              <Check className="w-4 h-4 inline" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 bg-[#333] border border-[#444] text-gray-400 text-sm"
            >
              <X className="w-4 h-4 inline" />
            </button>
          </div>
        )}
      </div>

      {/* STATS STRIP - Horizontal row of 4 stats */}
      <div className="border-y border-[#333] bg-[#1a1a1a] py-4 flex justify-around">
        <div className="text-center px-2">
          <div className="text-2xl font-bold text-white font-data tabular-nums">{stats.starts}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Starts</div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold text-white font-data tabular-nums">{stats.avgScore}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Avg Score</div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold text-white font-data tabular-nums">{stats.bestFinish}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Best</div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold text-white font-data tabular-nums">{stats.badges}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Badges</div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="w-full">
        {/* TROPHY CASE */}
        <div className="border-b border-[#333]">
          <div className="bg-[#222] px-4 py-2.5 border-b border-[#333]">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Trophy Case
            </span>
          </div>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-px bg-[#333] p-px">
              {achievements.map((a) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.id}
                    className="bg-[#1a1a1a] p-4 flex flex-col items-center justify-center min-h-[72px]"
                    title={a.label}
                  >
                    <Icon className="w-6 h-6 text-yellow-500" />
                    <span className="text-[11px] text-gray-500 mt-1.5">{a.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Medal className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No badges yet</p>
            </div>
          )}
        </div>

        {/* SEASON HISTORY */}
        <div className="border-b border-[#333]">
          <div className="bg-[#222] px-4 py-2.5 border-b border-[#333]">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Season History
            </span>
          </div>
          <DataTable
            columns={seasonHistoryColumns}
            data={seasonHistory}
            getRowKey={(row, idx) => `${row.classKey}-${row.seasonNumber}-${idx}`}
            zebraStripes={true}
            emptyState={
              <div className="p-6 text-center">
                <Calendar className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No season history</p>
              </div>
            }
          />
        </div>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-3 gap-px bg-[#333]">
          <Link
            to="/battlepass"
            className="bg-[#1a1a1a] p-5 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[80px] flex flex-col items-center justify-center"
          >
            <Trophy className="w-6 h-6 text-yellow-500 mb-1.5" />
            <span className="text-sm text-gray-400">Battle Pass</span>
          </Link>
          <Link
            to="/leagues"
            className="bg-[#1a1a1a] p-5 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[80px] flex flex-col items-center justify-center"
          >
            <Crown className="w-6 h-6 text-purple-500 mb-1.5" />
            <span className="text-sm text-gray-400">Leagues</span>
          </Link>
          {isOwnProfile && (
            <Link
              to="/dashboard"
              className="bg-[#1a1a1a] p-5 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[80px] flex flex-col items-center justify-center"
            >
              <Coins className="w-6 h-6 text-yellow-500 mb-1.5" />
              <span className="text-sm text-gray-400 font-data tabular-nums">
                {(profile.corpsCoin || 0).toLocaleString()} CC
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <SettingsModal
        user={user}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default Profile;
