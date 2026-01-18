// =============================================================================
// DIRECTOR PROFILE - Career Portfolio Layout (Compact)
// =============================================================================
// Side-by-side hero with avatar, deduped awards sections, CTAs for empty state
// Laws: No glow, no shadow, grid layout, minimal scrolling

import React, { useState, useMemo, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  User, Trophy, Star, TrendingUp, Calendar, Crown, Medal,
  MapPin, Zap, Flame, Award, ChevronDown, ChevronRight,
  Music, Disc3, Play, Clock, Target, Shield, Swords,
  ArrowUp, ArrowDown, Minus, X, Palette, ExternalLink,
} from 'lucide-react';
import type { UserProfile, Achievement, CorpsClass } from '../../types';
import { formatSeasonName } from '../../utils/season';

// =============================================================================
// TYPES
// =============================================================================

interface DirectorProfileProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
  onDesignUniform?: () => void;
  onSelectAvatarCorps?: (corpsClass: CorpsClass) => Promise<void>;
}

interface SeasonHistoryEntry {
  seasonId: string;
  seasonName?: string;
  corpsName: string;
  classKey: CorpsClass;
  placement?: number;
  finalScore?: number;
  totalSeasonScore?: number;
  previousPlacement?: number;
  showTitle?: string;
  repertoire?: string[];
  showsAttended?: number;
  circuitPoints?: number;
}

interface TrophyData {
  id: string;
  title: string;
  description: string;
  tier: 'gold' | 'silver' | 'bronze' | 'special';
  season?: string;
  icon: React.ElementType;
  earnedAt?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_DISPLAY = {
  world: { name: 'World Class', short: 'WC', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  open: { name: 'Open Class', short: 'OC', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  aClass: { name: 'A Class', short: 'A', color: 'text-green-400', bg: 'bg-green-500/10' },
  soundSport: { name: 'SoundSport', short: 'SS', color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

const TIER_STYLES = {
  gold: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: 'text-yellow-500' },
  silver: { bg: 'bg-gray-300/10', border: 'border-gray-400/40', text: 'text-gray-300', icon: 'text-gray-400' },
  bronze: { bg: 'bg-orange-600/15', border: 'border-orange-500/40', text: 'text-orange-400', icon: 'text-orange-500' },
  special: { bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-400', icon: 'text-purple-500' },
};

const STATUS_INDICATORS = {
  active: { label: 'Active', color: 'bg-green-500', pulse: true },
  onTour: { label: 'On Tour', color: 'bg-blue-500', pulse: true },
  offseason: { label: 'Off-Season', color: 'bg-gray-500', pulse: false },
  retired: { label: 'Retired', color: 'bg-red-500/50', pulse: false },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDirectorStatus(profile: UserProfile): keyof typeof STATUS_INDICATORS {
  const hasActiveCorps = profile.corps && Object.values(profile.corps).some(c => c && c.corpsName);
  const hasActiveSeasonId = !!profile.activeSeasonId;

  if (!hasActiveCorps) return 'retired';
  if (hasActiveSeasonId) return 'onTour';
  if (hasActiveCorps) return 'active';
  return 'offseason';
}

function calculateInfluenceScore(profile: UserProfile): number {
  const baseXp = profile.xp || 0;
  const levelBonus = (profile.xpLevel || 1) * 100;
  const streakBonus = (profile.engagement?.loginStreak || 0) * 10;
  const champBonus = (profile.stats?.championships || 0) * 500;
  const seasonBonus = (profile.stats?.seasonsPlayed || 0) * 50;
  return baseXp + levelBonus + streakBonus + champBonus + seasonBonus;
}

function calculateDirectorRating(profile: UserProfile): number {
  const baseRating = 1000;
  const championships = profile.stats?.championships || 0;
  const seasons = profile.stats?.seasonsPlayed || 0;
  const topTens = profile.stats?.topTenFinishes || 0;
  const rating = baseRating + (championships * 150) + (topTens * 50) + (seasons * 10);
  return Math.min(rating, 3000);
}

// Get primary corps avatar URL - respects profileAvatarCorps selection
function getCorpsAvatarUrl(profile: UserProfile): { url: string | null; corpsClass: CorpsClass | null } {
  if (!profile.corps) return { url: null, corpsClass: null };

  // If user has selected a specific corps for their profile avatar, use that
  if (profile.profileAvatarCorps) {
    const selectedCorps = profile.corps[profile.profileAvatarCorps];
    if (selectedCorps?.avatarUrl) {
      return { url: selectedCorps.avatarUrl, corpsClass: profile.profileAvatarCorps };
    }
  }

  // Fallback: Priority order world > open > aClass > soundSport
  const classOrder: CorpsClass[] = ['world', 'open', 'aClass', 'soundSport'];
  for (const classKey of classOrder) {
    const corps = profile.corps[classKey];
    if (corps?.avatarUrl) return { url: corps.avatarUrl, corpsClass: classKey };
  }
  return { url: null, corpsClass: null };
}

// Get all corps with avatars for selection
function getCorpsWithAvatars(profile: UserProfile): { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] {
  if (!profile.corps) return [];
  const result: { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] = [];
  const classOrder: CorpsClass[] = ['world', 'open', 'aClass', 'soundSport'];

  for (const classKey of classOrder) {
    const corps = profile.corps[classKey];
    if (corps?.avatarUrl && corps?.corpsName) {
      result.push({
        corpsClass: classKey,
        corpsName: corps.corpsName,
        avatarUrl: corps.avatarUrl,
      });
    }
  }
  return result;
}

// Get trophies (competition-based awards only - NOT achievements)
function getCompetitionTrophies(profile: UserProfile): TrophyData[] {
  const trophies: TrophyData[] = [];
  const stats = profile.stats;

  // Championship trophies
  if (stats?.championships && stats.championships > 0) {
    for (let i = 0; i < Math.min(stats.championships, 5); i++) {
      trophies.push({
        id: `champ-${i}`,
        title: 'League Champion',
        description: 'Captured a league championship',
        tier: 'gold',
        icon: Trophy,
      });
    }
  }

  // Top 10 finishes (excluding championships)
  if (stats?.topTenFinishes && stats.topTenFinishes > (stats?.championships || 0)) {
    const topTenCount = Math.min(stats.topTenFinishes - (stats?.championships || 0), 3);
    for (let i = 0; i < topTenCount; i++) {
      trophies.push({
        id: `top10-${i}`,
        title: 'Top 10 Finish',
        description: 'Finished in the top 10',
        tier: 'silver',
        icon: Medal,
      });
    }
  }

  // Class unlock as special trophy
  if (profile.unlockedClasses?.includes('world')) {
    trophies.push({
      id: 'world-unlock',
      title: 'World Class',
      description: 'Achieved World Class status',
      tier: 'special',
      icon: Crown,
    });
  }

  // Veteran badge (seasons-based)
  if (stats?.seasonsPlayed && stats.seasonsPlayed >= 5) {
    trophies.push({
      id: 'veteran',
      title: 'Veteran',
      description: `${stats.seasonsPlayed} seasons`,
      tier: 'bronze',
      icon: Shield,
    });
  }

  return trophies;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const StatusIndicator = memo(({ status }: { status: keyof typeof STATUS_INDICATORS }) => {
  const config = STATUS_INDICATORS[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-50`} />
        )}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {config.label}
      </span>
    </div>
  );
});
StatusIndicator.displayName = 'StatusIndicator';

// Compact stat pill
const StatPill = memo(({ icon: Icon, value, label, color = 'text-white' }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color?: string;
}) => (
  <div className="flex items-center gap-1.5 px-2 py-1 bg-[#222] border border-[#333]">
    <Icon className={`w-3.5 h-3.5 ${color}`} />
    <span className={`text-xs font-bold font-data tabular-nums ${color}`}>{value}</span>
    <span className="text-[9px] text-gray-500 uppercase">{label}</span>
  </div>
));
StatPill.displayName = 'StatPill';

// Trophy mini card
const TrophyMini = memo(({ trophy }: { trophy: TrophyData }) => {
  const styles = TIER_STYLES[trophy.tier];
  const Icon = trophy.icon;
  return (
    <div className={`p-2 ${styles.bg} border ${styles.border} flex flex-col items-center text-center`} title={trophy.description}>
      <Icon className={`w-5 h-5 ${styles.icon}`} />
      <span className={`text-[9px] font-bold ${styles.text} mt-1 truncate w-full`}>{trophy.title}</span>
    </div>
  );
});
TrophyMini.displayName = 'TrophyMini';

// Achievement badge (compact)
const AchievementMini = memo(({ achievement }: { achievement: Achievement }) => {
  const rarityColors: Record<string, string> = {
    legendary: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    epic: 'bg-purple-400/15 border-purple-400/30 text-purple-300',
    rare: 'bg-[#0057B8]/15 border-[#0057B8]/30 text-[#0057B8]',
    common: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  };
  const colors = rarityColors[achievement.rarity] || rarityColors.common;

  return (
    <div className={`px-2 py-1.5 border ${colors} flex items-center gap-1.5`} title={achievement.description}>
      <Award className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-[10px] font-bold truncate">{achievement.title}</span>
    </div>
  );
});
AchievementMini.displayName = 'AchievementMini';

// Season row (compact)
const SeasonRow = memo(({ season, isExpanded, onToggle }: {
  season: SeasonHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const classConfig = CLASS_DISPLAY[season.classKey] || CLASS_DISPLAY.soundSport;
  const score = season.finalScore || season.totalSeasonScore || 0;
  const placement = season.placement;

  return (
    <div className="border-b border-[#333] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#222] transition-colors text-left"
      >
        {/* Rank */}
        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border ${
          placement === 1 ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' :
          placement && placement <= 3 ? 'bg-gray-400/10 border-gray-500/30 text-gray-300' :
          placement && placement <= 10 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
          'bg-[#222] border-[#333] text-gray-500'
        }`}>
          {placement ? <span className="text-xs font-bold">#{placement}</span> : <Minus className="w-3 h-3" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate">{season.corpsName}</span>
            <span className={`text-[9px] font-bold px-1 ${classConfig.bg} ${classConfig.color}`}>
              {classConfig.short}
            </span>
          </div>
          <span className="text-[10px] text-gray-500">{formatSeasonName(season.seasonId || season.seasonName || '')}</span>
        </div>

        {/* Score */}
        <div className="text-right">
          <span className="text-xs font-bold text-white font-data">{score > 0 ? score.toLocaleString() : '-'}</span>
        </div>

        <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 pt-1 bg-[#0a0a0a] grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs font-bold text-white">{season.showsAttended || 0}</div>
                <div className="text-[9px] text-gray-500">Shows</div>
              </div>
              <div>
                <div className="text-xs font-bold text-white">{season.circuitPoints || 0}</div>
                <div className="text-[9px] text-gray-500">Pts</div>
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {score > 0 && season.showsAttended ? (score / season.showsAttended).toFixed(1) : '-'}
                </div>
                <div className="text-[9px] text-gray-500">Avg</div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SeasonRow.displayName = 'SeasonRow';

// Empty state with CTA
const EmptyWithCTA = memo(({ icon: Icon, title, cta, to }: {
  icon: React.ElementType;
  title: string;
  cta: string;
  to: string;
}) => (
  <div className="p-4 text-center">
    <Icon className="w-6 h-6 text-gray-600 mx-auto mb-1" />
    <p className="text-[10px] text-gray-500 mb-2">{title}</p>
    <Link to={to} className="inline-flex items-center gap-1 text-[10px] text-[#0057B8] hover:underline">
      {cta} <ExternalLink className="w-3 h-3" />
    </Link>
  </div>
));
EmptyWithCTA.displayName = 'EmptyWithCTA';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const DirectorProfile: React.FC<DirectorProfileProps> = ({
  profile,
  isOwnProfile = false,
  onDesignUniform,
  onSelectAvatarCorps,
}) => {
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [showAllTrophies, setShowAllTrophies] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Computed values
  const status = useMemo(() => getDirectorStatus(profile), [profile]);
  const influenceScore = useMemo(() => calculateInfluenceScore(profile), [profile]);
  const directorRating = useMemo(() => calculateDirectorRating(profile), [profile]);
  const avatarData = useMemo(() => getCorpsAvatarUrl(profile), [profile]);
  const corpsWithAvatars = useMemo(() => getCorpsWithAvatars(profile), [profile]);

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

  // DEDUPED: Trophies are competition-based, achievements are profile.achievements
  const trophies = useMemo(() => getCompetitionTrophies(profile), [profile]);
  const achievements = profile.achievements || [];

  // Season history
  const seasonHistory = useMemo((): SeasonHistoryEntry[] => {
    if (!profile.corps) return [];
    const history: SeasonHistoryEntry[] = [];
    const seen = new Set<string>();

    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (!corps) return;
      const corpsAny = corps as { seasonHistory?: SeasonHistoryEntry[] };
      if (corpsAny.seasonHistory) {
        corpsAny.seasonHistory.forEach(season => {
          const key = `${classKey}-${season.seasonId || season.seasonName}`;
          if (seen.has(key)) return;
          seen.add(key);
          history.push({
            ...season,
            corpsName: season.corpsName || corps.corpsName || (corps as { name?: string }).name || 'Unknown',
            classKey: classKey as CorpsClass,
          });
        });
      }
    });

    return history.sort((a, b) => {
      const aId = a.seasonId || a.seasonName || '';
      const bId = b.seasonId || b.seasonName || '';
      return bId.localeCompare(aId);
    });
  }, [profile.corps]);

  const memberSince = useMemo(() => {
    if (!profile.createdAt) return 'Unknown';
    const date = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt as unknown as string);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [profile.createdAt]);

  // Check if stats are empty
  const hasStats = (profile.stats?.championships || 0) > 0 ||
    (profile.stats?.topTenFinishes || 0) > 0 ||
    (profile.stats?.seasonsPlayed || 0) > 0;

  return (
    <div className="bg-[#0a0a0a]">
      {/* ================================================================== */}
      {/* HERO SECTION - Avatar Left, Info Right */}
      {/* ================================================================== */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="flex">
          {/* LEFT: Avatar/Uniform - Large */}
          <div className="flex-shrink-0 w-32 sm:w-40 lg:w-48 bg-[#0a0a0a] border-r border-[#333] relative group">
            {avatarData.url ? (
              <img src={avatarData.url} alt="Corps Uniform" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center aspect-square">
                <User className="w-12 h-12 text-gray-600" />
              </div>
            )}

            {/* Overlay actions for own profile */}
            {isOwnProfile && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                {onDesignUniform && (
                  <button
                    onClick={onDesignUniform}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0057B8] hover:bg-[#0066d6] transition-colors"
                  >
                    <Palette className="w-4 h-4 text-white" />
                    <span className="text-[10px] text-white font-bold uppercase">Design</span>
                  </button>
                )}
                {corpsWithAvatars.length > 1 && onSelectAvatarCorps && (
                  <button
                    onClick={() => setShowAvatarSelector(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] transition-colors"
                  >
                    <User className="w-4 h-4 text-white" />
                    <span className="text-[10px] text-white font-bold uppercase">Change</span>
                  </button>
                )}
              </div>
            )}

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
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Select Profile Avatar
                      </span>
                      <button
                        onClick={() => setShowAvatarSelector(false)}
                        className="p-1 text-gray-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-3">
                      {corpsWithAvatars.map(corps => {
                        const isSelected = avatarData.corpsClass === corps.corpsClass;
                        const classConfig = CLASS_DISPLAY[corps.corpsClass];
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
                            <img
                              src={corps.avatarUrl}
                              alt={corps.corpsName}
                              className="w-full aspect-square object-cover"
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
              </div>

              {profile.userTitle && (
                <div className="flex items-center gap-1 mb-1">
                  <Shield className="w-3 h-3 text-[#0057B8]" />
                  <span className="text-[11px] text-[#0057B8] font-bold">{profile.userTitle}</span>
                </div>
              )}

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

            {/* Bottom: Stats Row */}
            <div className="flex flex-wrap gap-2 mt-3">
              <StatPill icon={Zap} value={influenceScore.toLocaleString()} label="Influence" color="text-yellow-400" />
              <StatPill icon={Target} value={directorRating} label="Rating" color="text-[#0057B8]" />
              <StatPill icon={Flame} value={profile.engagement?.loginStreak || 0} label="Streak" color={profile.engagement?.loginStreak && profile.engagement.loginStreak >= 7 ? 'text-orange-400' : 'text-gray-400'} />
              <StatPill icon={Calendar} value={profile.stats?.seasonsPlayed || 0} label="Seasons" color="text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CONTENT GRID - Compact 3-column */}
      {/* ================================================================== */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* COLUMN 1: Trophy Case */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Trophy Case</span>
            </div>
            {trophies.length > 0 && (
              <span className="text-[9px] text-gray-500">{trophies.length}</span>
            )}
          </div>

          {trophies.length > 0 ? (
            <div className="p-2 grid grid-cols-3 gap-1.5">
              {trophies.slice(0, 6).map(trophy => (
                <TrophyMini key={trophy.id} trophy={trophy} />
              ))}
            </div>
          ) : (
            <EmptyWithCTA
              icon={Trophy}
              title="No trophies yet"
              cta="Join a league"
              to="/leagues"
            />
          )}
        </div>

        {/* COLUMN 2: Achievements */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Achievements</span>
            </div>
            {achievements.length > 0 && (
              <span className="text-[9px] text-gray-500">{achievements.length} earned</span>
            )}
          </div>

          {achievements.length > 0 ? (
            <div className="p-2 space-y-1">
              {achievements.slice(0, 4).map(achievement => (
                <AchievementMini key={achievement.id} achievement={achievement} />
              ))}
              {achievements.length > 4 && (
                <button className="w-full text-[9px] text-[#0057B8] hover:underline py-1">
                  +{achievements.length - 4} more
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Career Stats</span>
          </div>

          {hasStats ? (
            <div className="p-2 space-y-1">
              {[
                { label: 'Championships', value: profile.stats?.championships || 0, color: 'text-yellow-400' },
                { label: 'Top 10s', value: profile.stats?.topTenFinishes || 0, color: 'text-white' },
                { label: 'Seasons', value: profile.stats?.seasonsPlayed || 0, color: 'text-white' },
                { label: 'League Wins', value: profile.stats?.leagueWins || 0, color: 'text-white' },
                { label: 'Total XP', value: (profile.xp || 0).toLocaleString(), color: 'text-blue-400' },
              ].map(stat => (
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
      {/* SEASON HISTORY - Full Width */}
      {/* ================================================================== */}
      <div className="px-3 pb-3">
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-[#0057B8]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Season History</span>
            </div>
            <span className="text-[9px] text-gray-500">{seasonHistory.length} seasons</span>
          </div>

          {seasonHistory.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {seasonHistory.map(season => (
                <SeasonRow
                  key={`${season.classKey}-${season.seasonId}`}
                  season={season}
                  isExpanded={expandedSeason === `${season.classKey}-${season.seasonId}`}
                  onToggle={() => setExpandedSeason(
                    expandedSeason === `${season.classKey}-${season.seasonId}` ? null : `${season.classKey}-${season.seasonId}`
                  )}
                />
              ))}
            </div>
          ) : (
            <EmptyWithCTA
              icon={Calendar}
              title="No season history yet"
              cta="Find your first show"
              to="/schedule"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(DirectorProfile);
