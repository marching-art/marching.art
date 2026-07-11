// =============================================================================
// DIRECTOR PROFILE - Career Portfolio Layout (Compact)
// =============================================================================
// Side-by-side hero with avatar, deduped awards sections, CTAs for empty state
// Laws: No glow, no shadow, grid layout, minimal scrolling

import React, { useState, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  User,
  Trophy,
  Star,
  TrendingUp,
  Calendar,
  MapPin,
  Flame,
  Award,
  Music,
  Clock,
  Target,
  Shield,
  X,
  Palette,
  RefreshCw,
  Edit3,
  BookOpen,
  Share2,
  UserPlus,
  Settings,
} from 'lucide-react';
import type { UserProfile, CorpsClass } from '../../types';
import {
  PROFILE_CORPS_CLASS_ORDER,
  resolveCorpsForClass,
  isCorpsClassUnlocked,
} from '../../utils/corps';
import {
  StatusIndicator,
  StatPill,
  TrophyCaseGrid,
  AchievementMini,
  Section,
  SocialLinks,
  EnsembleCard,
  UnregisteredEnsembleCard,
  EmptyWithCTA,
  AvatarActions,
  ShopTitleFlair,
} from './DirectorProfileParts';
import type { AvatarAction } from './DirectorProfileParts';
import {
  getClassDisplay,
  getDirectorStatus,
  getStandingDisplay,
  getDisplayTitle,
  getCorpsAvatarUrl,
  getCorpsWithAvatars,
  getCompetitionTrophies,
  getShowTitle,
} from './directorProfileHelpers';
import type { SeasonHistoryEntry } from './directorProfileHelpers';
import { getEquippedCosmetic } from '../../utils/cosmetics';
import { getXPProgress } from '../../utils/captionPricing';
import CaptionMasteryPanel from './CaptionMasteryPanel';
import SeasonHistorySection from './SeasonHistorySection';

// =============================================================================
// TYPES
// =============================================================================

interface DirectorProfileProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
  onDesignUniform?: () => void;
  onSelectAvatarCorps?: (corpsClass: CorpsClass) => Promise<void>;
  onRegenerateAvatar?: (corpsClass: CorpsClass) => Promise<void>;
  onShare?: () => void;
  onSettings?: () => void;
  onInviteToLeague?: () => void;
  canInviteToLeague?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const DirectorProfile: React.FC<DirectorProfileProps> = ({
  profile,
  isOwnProfile = false,
  onEditProfile,
  onDesignUniform,
  onSelectAvatarCorps,
  onRegenerateAvatar,
  onShare,
  onSettings,
  onInviteToLeague,
  canInviteToLeague = false,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Computed values
  const status = useMemo(() => getDirectorStatus(profile), [profile]);
  const standing = useMemo(() => getStandingDisplay(profile), [profile]);
  const avatarData = useMemo(() => getCorpsAvatarUrl(profile), [profile]);
  const corpsWithAvatars = useMemo(() => getCorpsWithAvatars(profile), [profile]);
  const equippedTitle = getEquippedCosmetic(profile, 'title');
  const equippedFrame = getEquippedCosmetic(profile, 'frame');

  const handleSelectAvatar = async (corpsClass: CorpsClass) => {
    if (!onSelectAvatarCorps) return;
    setSavingAvatar(true);
    try {
      await onSelectAvatarCorps(corpsClass);
      setShowAvatarSelector(false);
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRegenerateAvatar = async () => {
    if (!onRegenerateAvatar || !avatarData.corpsClass) return;
    setIsRegenerating(true);
    try {
      await onRegenerateAvatar(avatarData.corpsClass);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Avatar actions rendered twice: desktop hover overlay + mobile visible row
  const avatarActions = [
    onDesignUniform && {
      label: 'Design',
      icon: Palette,
      onClick: onDesignUniform,
      primary: true,
    },
    avatarData.url &&
      onRegenerateAvatar &&
      avatarData.corpsClass && {
        label: isRegenerating ? 'Generating...' : 'Regenerate',
        icon: RefreshCw,
        onClick: handleRegenerateAvatar,
        disabled: isRegenerating,
        spinning: isRegenerating,
      },
    corpsWithAvatars.length > 1 &&
      onSelectAvatarCorps && {
        label: 'Change',
        icon: User,
        onClick: () => setShowAvatarSelector(true),
      },
  ].filter(Boolean) as AvatarAction[];

  // DEDUPED: Trophies are competition-based, achievements are profile.achievements
  const trophies = useMemo(() => getCompetitionTrophies(profile), [profile]);
  const achievements = profile.achievements || [];
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  // Season history
  const seasonHistory = useMemo((): SeasonHistoryEntry[] => {
    if (!profile.corps) return [];
    const history: SeasonHistoryEntry[] = [];
    const seen = new Set<string>();

    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (!corps) return;
      const corpsAny = corps as { seasonHistory?: SeasonHistoryEntry[] };
      if (corpsAny.seasonHistory) {
        corpsAny.seasonHistory.forEach((season) => {
          const key = `${classKey}-${season.seasonId || season.seasonName}`;
          if (seen.has(key)) return;
          seen.add(key);
          history.push({
            ...season,
            corpsName:
              season.corpsName || corps.corpsName || (corps as { name?: string }).name || 'Unknown',
            classKey: classKey as CorpsClass,
          });
        });
      }
    });

    return history.sort((a, b) =>
      (b.seasonId || b.seasonName || '').localeCompare(a.seasonId || a.seasonName || '')
    );
  }, [profile.corps]);

  const memberSince = useMemo(() => {
    if (!profile.createdAt) return 'Unknown';
    const date = profile.createdAt.toDate
      ? profile.createdAt.toDate()
      : new Date(profile.createdAt as unknown as string);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [profile.createdAt]);

  // Check if stats are empty
  // Reads the fields the season pipeline maintains (lifetimeStats.*, trophies.*),
  // not the legacy profile.stats counters that are never incremented — except
  // stats.leagueWins, which IS bumped per matchup win.
  const hasStats =
    (profile.trophies?.championships?.length || 0) > 0 ||
    (profile.lifetimeStats?.totalSeasons || 0) > 0 ||
    (profile.lifetimeStats?.totalShows || 0) > 0 ||
    (profile.stats?.leagueWins || 0) > 0;

  return (
    <div className="bg-[#0a0a0a]">
      {/* ================================================================== */}
      {/* HERO SECTION - Avatar Left, Info Right */}
      {/* ================================================================== */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="flex">
          {/* LEFT: Avatar/Uniform - Large (equipped shop frame renders as ring) */}
          <div
            className={`flex-shrink-0 w-32 sm:w-40 lg:w-48 bg-[#0a0a0a] border-r border-[#333] relative group ${equippedFrame ? equippedFrame.frameClass : ''}`}
          >
            {/* OPTIMIZATION #7: Added lazy loading for profile avatar */}
            <div className="aspect-square w-full">
              {avatarData.url ? (
                <img
                  src={avatarData.url}
                  alt="Corps Uniform"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                  <User className="w-12 h-12 text-gray-600" />
                </div>
              )}
            </div>

            {/* Own-profile avatar actions. Desktop: hover overlay. Touch/small
                screens: always-visible row below the avatar, since hover never
                fires there and hidden controls would be unreachable. */}
            {isOwnProfile && <AvatarActions actions={avatarActions} />}

            {/* Avatar selector modal */}
            <AnimatePresence>
              {showAvatarSelector && (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                  onClick={() => setShowAvatarSelector(false)}
                >
                  <m.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#1a1a1a] border border-[#333] w-full max-w-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Select Profile Avatar
                      </span>
                      <button
                        onClick={() => setShowAvatarSelector(false)}
                        className="p-1 text-gray-500 hover:text-white"
                        aria-label="Close modal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-3">
                      {corpsWithAvatars.map((corps) => {
                        const isSelected = avatarData.corpsClass === corps.corpsClass;
                        const classConfig = getClassDisplay(corps.corpsClass);
                        return (
                          <button
                            key={corps.corpsClass}
                            onClick={() => handleSelectAvatar(corps.corpsClass)}
                            disabled={savingAvatar}
                            className={`relative border-2 p-1 transition-all ${
                              isSelected
                                ? 'border-[#0057B8] bg-[#0057B8]/10'
                                : 'border-[#333] hover:border-[#555]'
                            } ${savingAvatar ? 'opacity-50' : ''}`}
                          >
                            {/* OPTIMIZATION #7: Added lazy loading for corps avatar */}
                            <img
                              src={corps.avatarUrl}
                              alt={corps.corpsName}
                              className="w-full aspect-square object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                              <div className="text-[10px] text-white font-bold truncate">
                                {corps.corpsName}
                              </div>
                              <div className={`text-[9px] ${classConfig.color}`}>
                                {classConfig.short}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-[#0057B8] flex items-center justify-center">
                                <Star className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-4 pb-4">
                      <p className="text-[10px] text-gray-500 text-center">
                        Choose which corps uniform to display on your profile
                      </p>
                    </div>
                  </m.div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Director Info */}
          <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
            {/* Top: Name + Status */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {profile.displayName || 'Anonymous Director'}
                </h1>
                <StatusIndicator status={status} />

                <div className="ml-auto flex items-center gap-1">
                  {onShare && (
                    <button
                      onClick={onShare}
                      className="flex items-center gap-1 px-2.5 min-h-touch border border-[#333] text-gray-400 hover:text-white hover:border-[#555] active:text-white transition-colors press-feedback"
                      aria-label="Share profile"
                    >
                      <Share2 className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                        Share
                      </span>
                    </button>
                  )}
                  {!isOwnProfile && canInviteToLeague && onInviteToLeague && (
                    <button
                      onClick={onInviteToLeague}
                      className="flex items-center gap-1 px-2.5 min-h-touch border border-[#0057B8]/40 bg-[#0057B8]/10 text-[#0057B8] hover:bg-[#0057B8]/20 transition-colors press-feedback"
                      aria-label="Invite to league"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Invite</span>
                    </button>
                  )}
                  {isOwnProfile && onEditProfile && (
                    <button
                      onClick={onEditProfile}
                      className="flex items-center gap-1 px-2.5 min-h-touch border border-[#333] text-gray-400 hover:text-white hover:border-[#555] active:text-white transition-colors press-feedback"
                      aria-label="Edit profile"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                    </button>
                  )}
                  {isOwnProfile && onSettings && (
                    <button
                      onClick={onSettings}
                      className="flex items-center gap-1 px-2.5 min-h-touch border border-[#333] text-gray-400 hover:text-white hover:border-[#555] active:text-white transition-colors press-feedback"
                      aria-label="Settings"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Username handle */}
              {profile.username && (
                <div className="text-[10px] text-gray-500 font-data mb-1">@{profile.username}</div>
              )}

              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-[#0057B8]" />
                  <span className="text-[11px] text-[#0057B8] font-bold">
                    {getDisplayTitle(profile)}
                  </span>
                </div>
                <span
                  className="flex items-center gap-1.5 text-[10px] text-gray-500"
                  title={`${getXPProgress(profile.xp || 0).current}/${getXPProgress(profile.xp || 0).needed} XP to Level ${(profile.xpLevel || 1) + 1}`}
                >
                  Lv{' '}
                  <span className="font-bold text-gray-300 font-data tabular-nums">
                    {profile.xpLevel || 1}
                  </span>
                  <span className="inline-block w-10 h-1 bg-[#2a2a2a] rounded-full overflow-hidden align-middle">
                    <span
                      className="block h-full bg-[#0057B8]"
                      style={{ width: `${getXPProgress(profile.xp || 0).percentage}%` }}
                    />
                  </span>
                </span>
                {equippedTitle && <ShopTitleFlair item={equippedTitle} />}
              </div>

              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {profile.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Since {memberSince}
                </span>
              </div>
            </div>

            {/* Bottom: Stats Row — the progression hierarchy's secondaries.
                Standing (class + live rank) answers "how good right now";
                the retired Influence/Rating aggregates re-blended inputs
                shown more clearly elsewhere. Streak and Seasons are context. */}
            <div className="flex flex-wrap gap-2 mt-3">
              {standing && (
                <StatPill
                  icon={Target}
                  value={`${standing.value}${standing.of ? ` of ${standing.of}` : ''}`}
                  label={standing.label}
                  color={standing.soundSport ? 'text-green-400' : 'text-[#0057B8]'}
                />
              )}
              <StatPill
                icon={Flame}
                value={profile.engagement?.loginStreak || 0}
                label="Streak"
                color={
                  profile.engagement?.loginStreak && profile.engagement.loginStreak >= 7
                    ? 'text-orange-400'
                    : 'text-gray-400'
                }
              />
              <StatPill
                icon={Calendar}
                value={profile.lifetimeStats?.totalSeasons || 0}
                label="Seasons"
                color="text-green-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ABOUT THE DIRECTOR */}
      {/* ================================================================== */}
      {(() => {
        const info = profile.directorInfo;
        const hasBio = !!(info?.bio && info.bio.trim());
        const hasCreds = !!(info?.credentials && info.credentials.trim());
        const hasSpecialties = !!(info?.specialties && info.specialties.length > 0);
        const hasYears = typeof info?.yearsDirecting === 'number' && info.yearsDirecting > 0;
        const hasSocials = !!(
          info?.socialLinks &&
          Object.values(info.socialLinks).some((v) => typeof v === 'string' && v.trim())
        );
        const hasAnything = hasBio || hasCreds || hasSpecialties || hasYears || hasSocials;

        if (!hasAnything) {
          if (!isOwnProfile) return null;
          return (
            <div className="px-3 pt-3">
              <Section icon={BookOpen} iconColor="text-[#0057B8]" title="About">
                <div className="p-4 text-center">
                  <p className="text-[11px] text-gray-500 mb-2">
                    Tell other directors about yourself — bio, philosophy, specialties, and links.
                  </p>
                  {onEditProfile && (
                    <button
                      onClick={onEditProfile}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0057B8] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#0066d6] transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      Build your profile
                    </button>
                  )}
                </div>
              </Section>
            </div>
          );
        }

        return (
          <div className="px-3 pt-3">
            <Section icon={BookOpen} iconColor="text-[#0057B8]" title="About">
              <div className="p-3 space-y-3">
                {hasBio && (
                  <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {info!.bio}
                  </p>
                )}

                {(hasYears || hasSpecialties) && (
                  <div className="flex flex-wrap gap-1.5">
                    {hasYears && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-[#0a0a0a] border border-[#333] text-[10px] text-gray-300">
                        <Clock className="w-3 h-3 text-green-400" />
                        <span className="font-bold font-data tabular-nums">
                          {info!.yearsDirecting}
                        </span>
                        <span className="text-gray-500">yrs directing</span>
                      </span>
                    )}
                    {hasSpecialties &&
                      info!.specialties!.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-1 bg-[#0057B8]/10 border border-[#0057B8]/30 text-[10px] text-[#0057B8] font-bold"
                        >
                          {s}
                        </span>
                      ))}
                  </div>
                )}

                {hasCreds && (
                  <div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                      Background
                    </div>
                    <p className="text-[11px] text-gray-300 whitespace-pre-wrap">
                      {info!.credentials}
                    </p>
                  </div>
                )}

                {hasSocials && (
                  <div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Connect
                    </div>
                    <SocialLinks links={info!.socialLinks!} />
                  </div>
                )}
              </div>
            </Section>
          </div>
        );
      })()}

      {/* ================================================================== */}
      {/* ENSEMBLES */}
      {/* ================================================================== */}
      {(() => {
        const unlockedClasses = profile.unlockedClasses?.length
          ? profile.unlockedClasses
          : (['soundSport'] as CorpsClass[]);

        // Iterate the portfolio order (fantasy classes + always-open Podium) and
        // resolve both unlock status and the corps record, tolerating legacy
        // short keys ('world'/'open').
        const entries = PROFILE_CORPS_CLASS_ORDER.filter((cls) =>
          isCorpsClassUnlocked(unlockedClasses, cls)
        ).map((cls) => ({
          classKey: cls as CorpsClass,
          corps: resolveCorpsForClass(profile.corps, cls),
        }));

        // On public profiles, hide unregistered classes (no useful info to share).
        const visibleEntries = isOwnProfile
          ? entries
          : entries.filter(({ corps }) => corps && corps.corpsName);

        if (visibleEntries.length === 0) return null;

        return (
          <div className="px-3 pt-3">
            <Section
              icon={Music}
              iconColor="text-purple-400"
              title="Ensembles"
              action={
                isOwnProfile && onEditProfile ? (
                  <button
                    onClick={onEditProfile}
                    className="text-[9px] text-[#0057B8] hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-2.5 h-2.5" /> Edit
                  </button>
                ) : null
              }
            >
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleEntries.map(({ classKey, corps }) =>
                  corps && corps.corpsName ? (
                    <EnsembleCard
                      key={classKey}
                      corpsName={corps.corpsName}
                      classKey={classKey}
                      location={corps.location}
                      avatarUrl={corps.avatarUrl}
                      info={corps.ensembleInfo || {}}
                      showTitle={getShowTitle(corps)}
                    />
                  ) : (
                    <UnregisteredEnsembleCard key={classKey} classKey={classKey} />
                  )
                )}
              </div>
            </Section>
          </div>
        );
      })()}

      {/* ================================================================== */}
      {/* CONTENT GRID - Compact 3-column */}
      {/* ================================================================== */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* COLUMN 1: Trophy Case */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Trophy Case
              </span>
            </div>
            {trophies.length > 0 && (
              <span className="text-[9px] text-gray-500">{trophies.length}</span>
            )}
          </div>

          <TrophyCaseGrid trophies={trophies} />
        </div>

        {/* COLUMN 2: Achievements */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Achievements
              </span>
            </div>
            <div className="flex items-center gap-2">
              {achievements.length > 0 && (
                <span className="text-[9px] text-gray-500">{achievements.length} earned</span>
              )}
              {/* Own profile only — the page shows the viewer's own list. */}
              {isOwnProfile && (
                <Link to="/achievements" className="text-[9px] text-[#0057B8] hover:underline">
                  View all →
                </Link>
              )}
            </div>
          </div>

          {achievements.length > 0 ? (
            <div className="p-2 space-y-1">
              {(showAllAchievements ? achievements : achievements.slice(0, 4)).map(
                (achievement) => (
                  <AchievementMini key={achievement.id} achievement={achievement} />
                )
              )}
              {achievements.length > 4 && (
                <button
                  onClick={() => setShowAllAchievements((v) => !v)}
                  className="w-full text-[9px] text-[#0057B8] hover:underline py-1"
                  aria-expanded={showAllAchievements}
                  aria-label={
                    showAllAchievements
                      ? 'Show fewer achievements'
                      : `View ${achievements.length - 4} more achievements`
                  }
                >
                  {showAllAchievements ? 'Show fewer' : `+${achievements.length - 4} more`}
                </button>
              )}
            </div>
          ) : (
            <EmptyWithCTA
              icon={Award}
              title="No achievements yet"
              cta="Start playing"
              to="/schedule"
            />
          )}
        </div>

        {/* COLUMN 3: Career Stats */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Career Stats
            </span>
          </div>

          {hasStats ? (
            <div className="p-2 space-y-1">
              {[
                {
                  label: 'Championships',
                  value: profile.trophies?.championships?.length || 0,
                  color: 'text-yellow-400',
                },
                {
                  label: 'Career Shows',
                  value: (profile.lifetimeStats?.totalShows || 0).toLocaleString(),
                  color: 'text-white',
                },
                {
                  label: 'Seasons',
                  value: profile.lifetimeStats?.totalSeasons || 0,
                  color: 'text-white',
                },
                {
                  label: 'League Wins',
                  value: profile.stats?.leagueWins || 0,
                  color: 'text-white',
                },
                {
                  label: 'Total XP',
                  value: (profile.xp || 0).toLocaleString(),
                  color: 'text-blue-400',
                },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center py-0.5">
                  <span className="text-[10px] text-gray-400">{stat.label}</span>
                  <span className={`text-xs font-bold font-data ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyWithCTA
              icon={TrendingUp}
              title="No stats yet"
              cta="Register for shows"
              to="/schedule"
            />
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* CAPTION MASTERY - lifetime per-caption craft (WS5.5); renders       */}
      {/* nothing until points exist. Extracted component keeps this file     */}
      {/* under the max-lines guardrail.                                      */}
      {/* ================================================================== */}
      <CaptionMasteryPanel profile={profile} />

      {/* ================================================================== */}
      {/* SEASON HISTORY - Full Width (corps history archive, tabbed by class) */}
      {/* ================================================================== */}
      <div className="px-3 pb-3">
        <SeasonHistorySection seasons={seasonHistory} />
      </div>
    </div>
  );
};

export default memo(DirectorProfile);
