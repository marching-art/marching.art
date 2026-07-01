// =============================================================================
// PROFILE - DIRECTOR CAREER PORTFOLIO
// =============================================================================
// Redesigned with rich Trophy Case, Season Timeline, and gamification
// Laws: No glow, no shadow, grid layout, expandable sections

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  User, Settings, Crown, Coins, Heart, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile } from '../hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { DirectorProfile } from '../components/Profile/DirectorProfile';
import PendingLeagueInvitations from '../components/Profile/PendingLeagueInvitations';
import { generateCorpsAvatar } from '../api/functions';
import { CORPS_CLASS_ORDER, resolveCorpsForClass } from '../utils/corps';

// OPTIMIZATION #9: Lazy-load UniformDesignModal (794 lines) to reduce initial bundle
const UniformDesignModal = lazy(() => import('../components/modals/UniformDesignModal'));
const ProfileEditModal = lazy(() => import('../components/modals/ProfileEditModal'));
const LeagueInviteModal = lazy(() => import('../components/modals/LeagueInviteModal'));
import SettingsModal from '../components/Profile/SettingsModal';

// =============================================================================
// NOTE: Achievement and season history display is now handled by DirectorProfile
// =============================================================================


// =============================================================================
// NOTE: StatCell component moved to DirectorProfile
// =============================================================================

// =============================================================================
// MAIN PROFILE COMPONENT
// =============================================================================

const Profile = () => {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [showUniformDesign, setShowUniformDesign] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [visitorCommissionsLeagues, setVisitorCommissionsLeagues] = useState(false);

  // Resolve @username → uid. The usernames/{lower} doc holds { uid } and is
  // publicly readable. If the param doesn't start with @, treat it as a uid.
  const rawParam = userId || '';
  const isUsernameParam = rawParam.startsWith('@');
  const usernameKey = isUsernameParam ? rawParam.slice(1).toLowerCase() : null;
  const [resolvedUid, setResolvedUid] = useState(isUsernameParam ? null : (userId || null));
  const [usernameResolveError, setUsernameResolveError] = useState(null);

  useEffect(() => {
    if (!isUsernameParam) {
      setResolvedUid(userId || null);
      setUsernameResolveError(null);
      return;
    }
    let cancelled = false;
    setResolvedUid(null);
    setUsernameResolveError(null);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'usernames', usernameKey));
        if (cancelled) return;
        if (!snap.exists()) {
          setUsernameResolveError('Username not found');
          return;
        }
        setResolvedUid(snap.data().uid || null);
      } catch (err) {
        if (!cancelled) setUsernameResolveError(err.message || 'Failed to resolve username');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isUsernameParam, usernameKey, userId]);

  const isOwnProfile = !userId || resolvedUid === user?.uid || userId === user?.uid;

  // Handle URL parameters for deep linking to settings
  useEffect(() => {
    const settingsParam = searchParams.get('settings');
    if (settingsParam && isOwnProfile) {
      if (settingsParam === 'emails') {
        setSettingsTab('emails');
      } else {
        setSettingsTab('account');
      }
      setShowSettings(true);
      searchParams.delete('settings');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isOwnProfile, setSearchParams]);

  const profileUserId = isUsernameParam ? resolvedUid : (userId || user?.uid);
  const { data: profile, isLoading, error, isError, refetch } = useProfile(profileUserId);

  // When viewing someone else's profile, check whether the current user
  // commissions any league so we know whether to show the Invite button.
  useEffect(() => {
    if (!user || isOwnProfile) {
      setVisitorCommissionsLeagues(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
        const q = query(leaguesRef, where('creatorId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!cancelled) setVisitorCommissionsLeagues(!snapshot.empty);
      } catch {
        if (!cancelled) setVisitorCommissionsLeagues(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isOwnProfile, profileUserId]);

  // The invite button should appear when: viewing someone else's profile,
  // the visitor commissions at least one league, and the target director
  // hasn't opted out of league invites.
  const canInviteToLeague =
    !isOwnProfile &&
    visitorCommissionsLeagues &&
    (profile?.directorInfo?.acceptingLeagueInvites !== false);

  // NOTE: Stats, achievements, and season history are now computed in DirectorProfile

  // Get all corps for uniform design modal. Iterate canonical class keys and
  // resolve corps tolerating legacy short keys ('world'/'open').
  const allCorps = React.useMemo(() => {
    if (!profile?.corps) return [];
    return CORPS_CLASS_ORDER
      .map(c => ({ classKey: c, corps: resolveCorpsForClass(profile.corps, c) }))
      .filter(({ corps }) => corps?.corpsName)
      .map(({ classKey, corps }) => ({
        classKey,  // Must match CorpsOption interface in UniformDesignModal
        corpsName: corps.corpsName,
        uniformDesign: corps.uniformDesign,
      }));
  }, [profile?.corps]);

  // Get initial corps class for uniform design (first available)
  const initialCorpsClass = allCorps.length > 0 ? allCorps[0].classKey : 'soundSport';

  // Handle uniform design save with copy-to-others support
  const handleUniformDesign = useCallback(async (design, corpsClass, copyToClasses = []) => {
    if (!user || !corpsClass) return;
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');

      // Build update object for primary corps and any copies
      const updateData = {
        [`corps.${corpsClass}.uniformDesign`]: design,
        // Auto-switch profile avatar to the corps being designed
        profileAvatarCorps: corpsClass,
      };

      // Add copy targets
      for (const targetClass of copyToClasses) {
        updateData[`corps.${targetClass}.uniformDesign`] = design;
      }

      // Save the uniform design first
      await updateDoc(profileRef, updateData);
      setShowUniformDesign(false);

      // Generate avatars for all affected corps
      const corpsToGenerate = [corpsClass, ...copyToClasses];
      const totalCount = corpsToGenerate.length;

      toast.loading(`Generating avatar${totalCount > 1 ? 's' : ''}...`, { id: 'generate-avatars' });

      let successCount = 0;
      let failCount = 0;
      const avatarUpdates = {};

      for (const targetClass of corpsToGenerate) {
        try {
          const result = await generateCorpsAvatar({ corpsClass: targetClass });
          if (result.data.success) {
            successCount++;
            // Collect the new avatar URL for cache update
            if (result.data.avatarUrl) {
              avatarUpdates[targetClass] = result.data.avatarUrl;
            }
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      // Immediately update the cache with all new avatar URLs and profileAvatarCorps
      if (Object.keys(avatarUpdates).length > 0) {
        queryClient.setQueryData(queryKeys.profile(user.uid), (oldData) => {
          if (!oldData) return oldData;
          const updatedCorps = { ...oldData.corps };
          for (const [targetClass, avatarUrl] of Object.entries(avatarUpdates)) {
            updatedCorps[targetClass] = {
              ...updatedCorps[targetClass],
              avatarUrl,
              avatarGeneratedAt: new Date().toISOString(),
            };
          }
          return {
            ...oldData,
            corps: updatedCorps,
            profileAvatarCorps: corpsClass, // Switch to the designed corps
          };
        });
      } else if (successCount > 0) {
        // Fallback: if no avatarUrls returned (function not deployed yet), refetch from server
        await new Promise(resolve => setTimeout(resolve, 500));
        refetch();
      }

      // Show final result
      if (failCount === 0) {
        toast.success(
          totalCount > 1
            ? `${successCount} avatar${successCount > 1 ? 's' : ''} generated!`
            : 'Avatar generated!',
          { id: 'generate-avatars' }
        );
      } else if (successCount > 0) {
        toast.success(
          `${successCount} avatar${successCount > 1 ? 's' : ''} generated, ${failCount} failed`,
          { id: 'generate-avatars' }
        );
      } else {
        toast.error('Failed to generate avatars', { id: 'generate-avatars' });
      }
    } catch (err) {
      toast.error('Failed to save uniform design');
      throw err;
    }
  }, [user, queryClient, refetch]);

  // Handle profile avatar corps selection
  const handleSelectAvatarCorps = useCallback(async (corpsClass) => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        profileAvatarCorps: corpsClass,
      });
      toast.success('Profile avatar updated!');
      refetch();
    } catch (err) {
      toast.error('Failed to update avatar');
      throw err;
    }
  }, [user, refetch]);

  // Handle avatar regeneration
  const handleRegenerateAvatar = useCallback(async (corpsClass) => {
    if (!user) return;
    try {
      toast.loading('Generating new avatar...', { id: 'regenerate-avatar' });
      const result = await generateCorpsAvatar({ corpsClass });
      if (result.data.success) {
        // Immediately update the cache with the new avatar URL
        const newAvatarUrl = result.data.avatarUrl;
        if (newAvatarUrl) {
          // Update cache for current user's profile
          queryClient.setQueryData(queryKeys.profile(user.uid), (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              corps: {
                ...oldData.corps,
                [corpsClass]: {
                  ...oldData.corps?.[corpsClass],
                  avatarUrl: newAvatarUrl,
                  avatarGeneratedAt: new Date().toISOString(),
                },
              },
            };
          });
        } else {
          // Fallback: if avatarUrl not returned, refetch from server
          // This handles cases where the function hasn't been deployed yet
          await new Promise(resolve => setTimeout(resolve, 500));
          refetch();
        }
        toast.success('Avatar regenerated!', { id: 'regenerate-avatar' });
      } else {
        toast.error(result.data.message || 'Failed to regenerate avatar', { id: 'regenerate-avatar' });
      }
    } catch (err) {
      toast.error('Failed to regenerate avatar', { id: 'regenerate-avatar' });
      throw err;
    }
  }, [user, queryClient, refetch]);

  // Handlers
  const handleStartEdit = () => {
    setShowEditModal(true);
  };

  const handleShareProfile = useCallback(async () => {
    if (!profile) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const handle = profile.username ? `@${profile.username}` : profile.uid;
    const url = `${origin}/profile/${handle}`;
    const title = profile.displayName || 'marching.art director';
    const shareText = `Check out ${title} on marching.art`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: shareText, url });
        return;
      }
    } catch (err) {
      // User canceled share sheet — fall through to clipboard copy
      if (err?.name === 'AbortError') return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success('Profile link copied');
        return;
      }
    } catch {
      // Ignore — fall through
    }
    toast(url);
  }, [profile]);

  const handleSaveProfile = useCallback(async ({ displayName, location, directorInfo, ensembleInfo }) => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const updateData = {
        displayName,
        location,
        directorInfo,
      };
      // Write per-corps ensembleInfo using dotted paths so other corps fields are untouched
      if (ensembleInfo) {
        for (const [classKey, info] of Object.entries(ensembleInfo)) {
          updateData[`corps.${classKey}.ensembleInfo`] = info;
        }
      }
      await updateDoc(profileRef, updateData);
      await refetch();
      toast.success('Profile updated');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  }, [user, refetch]);

  // Username resolution error
  if (usernameResolveError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{usernameResolveError}</p>
        </div>
      </div>
    );
  }

  // Loading state (username lookup or profile fetch)
  if (isLoading || (isUsernameParam && !resolvedUid)) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error?.message || 'Error loading profile'}</p>
          <button onClick={() => refetch()} className="text-xs text-[#0057B8] hover:underline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a] relative">
      {/* FLOATING SETTINGS BUTTON - Top right corner */}
      {isOwnProfile && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:bg-[#222] transition-colors rounded-sm"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-momentum">
        {/* DIRECTOR PROFILE - New Career Portfolio Layout */}
        <DirectorProfile
          profile={profile}
          isOwnProfile={isOwnProfile}
          onEditProfile={handleStartEdit}
          onDesignUniform={() => setShowUniformDesign(true)}
          onSelectAvatarCorps={handleSelectAvatarCorps}
          onRegenerateAvatar={handleRegenerateAvatar}
          onShare={handleShareProfile}
          onInviteToLeague={() => setShowInviteModal(true)}
          canInviteToLeague={canInviteToLeague}
        />

        {/* PENDING LEAGUE INVITATIONS (own profile only) */}
        {isOwnProfile && user && (
          <PendingLeagueInvitations userId={user.uid} />
        )}

        {/* QUICK LINKS */}
        <div className="px-4 pb-4">
          <div className={`grid gap-2 ${isOwnProfile ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-4'}`}>
            <Link
              to="/scores?tab=champions"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Crown className="w-5 h-5 text-yellow-400 mb-1" />
              <span className="text-xs text-gray-400">Champions</span>
            </Link>
            <a
              href="https://buymeacoffee.com/marching.art"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Heart className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs text-gray-400">Support</span>
            </a>
            <a
              href="https://discord.gg/YvFRJ97A5H"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <MessageCircle className="w-5 h-5 text-[#5865F2] mb-1" />
              <span className="text-xs text-gray-400">Discord</span>
            </a>
            <Link
              to="/leagues"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Crown className="w-5 h-5 text-purple-500 mb-1" />
              <span className="text-xs text-gray-400">Leagues</span>
            </Link>
            {isOwnProfile && (
              <Link
                to="/dashboard"
                className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
              >
                <Coins className="w-5 h-5 text-yellow-500 mb-1" />
                <span className="text-xs text-gray-400 font-data tabular-nums">
                  {(profile.corpsCoin || 0).toLocaleString()} CC
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <SettingsModal
        user={user}
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setSettingsTab('account');
        }}
        initialTab={settingsTab}
      />

      {/* UNIFORM DESIGN MODAL - OPTIMIZATION #9: Lazy-loaded */}
      {showUniformDesign && allCorps.length > 0 && (
        <Suspense fallback={null}>
          <UniformDesignModal
            onClose={() => setShowUniformDesign(false)}
            onSubmit={handleUniformDesign}
            corpsName={allCorps[0]?.corpsName || 'My Corps'}
            currentDesign={allCorps[0]?.uniformDesign}
            allCorps={allCorps}
            initialCorpsClass={initialCorpsClass}
          />
        </Suspense>
      )}

      {/* PROFILE EDIT MODAL */}
      {showEditModal && isOwnProfile && profile && (
        <Suspense fallback={null}>
          <ProfileEditModal
            profile={profile}
            onClose={() => setShowEditModal(false)}
            onSave={handleSaveProfile}
          />
        </Suspense>
      )}

      {/* LEAGUE INVITE MODAL */}
      {showInviteModal && !isOwnProfile && profile && user && (
        <Suspense fallback={null}>
          <LeagueInviteModal
            inviterUid={user.uid}
            inviteeUid={profile.uid || profileUserId}
            inviteeName={profile.displayName || profile.username}
            onClose={() => setShowInviteModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Profile;
