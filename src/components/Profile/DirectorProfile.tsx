// =============================================================================
// DIRECTOR PROFILE - Career Portfolio Layout
// =============================================================================
// ESPN-style dense data display with visual engagement
// Laws: No glow, no shadow, grid layout, expandable sections

import React, { useState, useMemo, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  User, Trophy, Star, TrendingUp, Calendar, Crown, Medal,
  MapPin, Zap, Flame, Award, ChevronDown, ChevronRight,
  Music, Disc3, Play, Clock, Target, Shield, Swords,
  CircleDot, Hash, ArrowUp, ArrowDown, Minus, X,
} from 'lucide-react';
import type { UserProfile, Achievement, CorpsClass, LifetimeStats } from '../../types';
import { formatSeasonName } from '../../utils/season';

// =============================================================================
// TYPES
// =============================================================================

interface DirectorProfileProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
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
  // Check if user has any active corps registered
  const hasActiveCorps = profile.corps && Object.values(profile.corps).some(c => c && c.corpsName);
  const hasActiveSeasonId = !!profile.activeSeasonId;

  if (!hasActiveCorps) return 'retired';
  if (hasActiveSeasonId) return 'onTour';
  if (hasActiveCorps) return 'active';
  return 'offseason';
}

function calculateInfluenceScore(profile: UserProfile): number {
  // Gamified XP-based influence score
  const baseXp = profile.xp || 0;
  const levelBonus = (profile.xpLevel || 1) * 100;
  const streakBonus = (profile.engagement?.loginStreak || 0) * 10;
  const champBonus = (profile.stats?.championships || 0) * 500;
  const seasonBonus = (profile.stats?.seasonsPlayed || 0) * 50;

  return baseXp + levelBonus + streakBonus + champBonus + seasonBonus;
}

function calculateDirectorRating(profile: UserProfile): number {
  // ELO-style rating based on performance
  const baseRating = 1000;
  const championships = profile.stats?.championships || 0;
  const seasons = profile.stats?.seasonsPlayed || 0;
  const topTens = profile.stats?.topTenFinishes || 0;

  // Rating formula: base + (champs * 150) + (top10s * 50) + (seasons * 10)
  const rating = baseRating + (championships * 150) + (topTens * 50) + (seasons * 10);
  return Math.min(rating, 3000); // Cap at 3000
}

function getTrophiesFromProfile(profile: UserProfile): TrophyData[] {
  const trophies: TrophyData[] = [];
  const stats = profile.stats;

  // Championship trophies
  if (stats?.championships && stats.championships > 0) {
    for (let i = 0; i < Math.min(stats.championships, 5); i++) {
      trophies.push({
        id: `champ-${i}`,
        title: 'League Champion',
        description: `Captured a league championship`,
        tier: 'gold',
        icon: Trophy,
      });
    }
  }

  // Top 10 finishes as silver
  if (stats?.topTenFinishes && stats.topTenFinishes > (stats?.championships || 0)) {
    const topTenCount = stats.topTenFinishes - (stats?.championships || 0);
    for (let i = 0; i < Math.min(topTenCount, 3); i++) {
      trophies.push({
        id: `top10-${i}`,
        title: 'Top 10 Finish',
        description: 'Finished in the top 10',
        tier: 'silver',
        icon: Medal,
      });
    }
  }

  // Class unlocks as special trophies
  if (profile.unlockedClasses?.includes('world')) {
    trophies.push({
      id: 'world-unlock',
      title: 'World Class Director',
      description: 'Achieved World Class status',
      tier: 'special',
      icon: Crown,
    });
  }

  // Veteran badge
  if (stats?.seasonsPlayed && stats.seasonsPlayed >= 5) {
    trophies.push({
      id: 'veteran',
      title: 'Veteran Director',
      description: `${stats.seasonsPlayed} seasons completed`,
      tier: 'bronze',
      icon: Shield,
    });
  }

  // Add achievements as trophies
  if (profile.achievements) {
    profile.achievements.forEach(achievement => {
      const tier = achievement.rarity === 'legendary' ? 'gold'
        : achievement.rarity === 'epic' ? 'silver'
        : achievement.rarity === 'rare' ? 'bronze'
        : 'bronze';

      trophies.push({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        tier,
        icon: Award,
        earnedAt: achievement.earnedAt,
      });
    });
  }

  return trophies;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Status Indicator Dot
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

// Metric Card - Small stat display
const MetricCard = memo(({
  icon: Icon,
  value,
  label,
  color = 'text-white',
  trend,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 bg-[#222] border border-[#333] flex items-center justify-center">
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-bold font-data tabular-nums ${color}`}>{value}</span>
        {trend && trend !== 'neutral' && (
          trend === 'up'
            ? <ArrowUp className="w-3 h-3 text-green-400" />
            : <ArrowDown className="w-3 h-3 text-red-400" />
        )}
      </div>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  </div>
));
MetricCard.displayName = 'MetricCard';

// Trophy Card - Featured trophy display
const TrophyCard = memo(({ trophy, featured = false }: { trophy: TrophyData; featured?: boolean }) => {
  const styles = TIER_STYLES[trophy.tier];
  const Icon = trophy.icon;

  return (
    <div className={`
      ${featured ? 'p-4' : 'p-3'}
      ${styles.bg} border ${styles.border}
      flex flex-col items-center text-center
      hover:bg-white/5 transition-colors
    `}>
      <div className={`
        ${featured ? 'w-12 h-12 mb-2' : 'w-8 h-8 mb-1'}
        flex items-center justify-center
      `}>
        <Icon className={`${featured ? 'w-8 h-8' : 'w-5 h-5'} ${styles.icon}`} />
      </div>
      <span className={`${featured ? 'text-xs' : 'text-[10px]'} font-bold ${styles.text} truncate w-full`}>
        {trophy.title}
      </span>
      {featured && (
        <span className="text-[10px] text-gray-500 mt-0.5">{trophy.description}</span>
      )}
    </div>
  );
});
TrophyCard.displayName = 'TrophyCard';

// Season Card - Expandable season entry
const SeasonCard = memo(({
  season,
  isExpanded,
  onToggle
}: {
  season: SeasonHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const classConfig = CLASS_DISPLAY[season.classKey] || CLASS_DISPLAY.soundSport;
  const score = season.finalScore || season.totalSeasonScore || 0;
  const placement = season.placement;

  // Calculate placement change indicator
  const placementChange = season.previousPlacement && placement
    ? season.previousPlacement - placement
    : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      {/* Main Row - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[#222] transition-colors text-left"
      >
        {/* Placement Badge */}
        <div className={`
          w-10 h-10 flex-shrink-0 flex flex-col items-center justify-center
          ${placement === 1 ? 'bg-yellow-500/20 border-yellow-500/40' :
            placement && placement <= 3 ? 'bg-gray-400/10 border-gray-500/30' :
            placement && placement <= 10 ? 'bg-orange-500/10 border-orange-500/30' :
            'bg-[#222] border-[#333]'}
          border
        `}>
          {placement ? (
            <>
              <span className={`text-sm font-bold font-data ${
                placement === 1 ? 'text-yellow-400' :
                placement <= 3 ? 'text-gray-300' :
                placement <= 10 ? 'text-orange-400' : 'text-gray-400'
              }`}>
                #{placement}
              </span>
              {placementChange !== null && placementChange !== 0 && (
                <span className={`text-[8px] flex items-center ${placementChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {placementChange > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                  {Math.abs(placementChange)}
                </span>
              )}
            </>
          ) : (
            <Minus className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {/* Corps Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white truncate">{season.corpsName}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 ${classConfig.bg} ${classConfig.color}`}>
              {classConfig.short}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-500">
              {formatSeasonName(season.seasonId || season.seasonName || '')}
            </span>
            {season.showTitle && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-[11px] text-gray-400 italic truncate">
                  "{season.showTitle}"
                </span>
              </>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-white font-data tabular-nums">
            {score > 0 ? score.toLocaleString() : '-'}
          </div>
          <div className="text-[10px] text-gray-500">points</div>
        </div>

        {/* Expand Icon */}
        <div className="flex-shrink-0 pl-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-[#333]">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 py-3">
                <div className="text-center">
                  <div className="text-xs font-bold text-white font-data">{season.showsAttended || 0}</div>
                  <div className="text-[10px] text-gray-500">Shows</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white font-data">{season.circuitPoints || 0}</div>
                  <div className="text-[10px] text-gray-500">Circuit Pts</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white font-data">
                    {score > 0 && season.showsAttended ? (score / season.showsAttended).toFixed(1) : '-'}
                  </div>
                  <div className="text-[10px] text-gray-500">Avg Score</div>
                </div>
              </div>

              {/* Repertoire Section */}
              {season.repertoire && season.repertoire.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Repertoire
                    </span>
                  </div>
                  <RepertoireDisplay repertoire={season.repertoire} />
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SeasonCard.displayName = 'SeasonCard';

// Repertoire Display - Music playlist style
const RepertoireDisplay = memo(({ repertoire }: { repertoire: string[] }) => (
  <div className="bg-[#0a0a0a] border border-[#333] divide-y divide-[#333]">
    {repertoire.map((track, index) => (
      <div key={index} className="flex items-center gap-3 px-3 py-2 group hover:bg-[#1a1a1a] transition-colors">
        <div className="w-5 h-5 flex items-center justify-center text-gray-600 group-hover:hidden">
          <span className="text-xs font-data tabular-nums">{index + 1}</span>
        </div>
        <div className="w-5 h-5 hidden group-hover:flex items-center justify-center">
          <Play className="w-3 h-3 text-[#0057B8]" />
        </div>
        <Disc3 className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <span className="text-xs text-gray-300 flex-1 truncate">{track}</span>
        <Clock className="w-3 h-3 text-gray-600" />
      </div>
    ))}
  </div>
));
RepertoireDisplay.displayName = 'RepertoireDisplay';

// Achievement Badge
const AchievementBadge = memo(({
  achievement
}: {
  achievement: Achievement
}) => {
  const rarityColors = {
    legendary: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    epic: 'bg-purple-400/15 border-purple-400/30 text-purple-300',
    rare: 'bg-[#0057B8]/15 border-[#0057B8]/30 text-[#0057B8]',
    common: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  };

  const colors = rarityColors[achievement.rarity] || rarityColors.common;

  return (
    <div className={`p-2 border ${colors} flex items-center gap-2 hover:bg-white/5 transition-colors`}>
      <Award className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-bold truncate block">{achievement.title}</span>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">{achievement.rarity}</span>
      </div>
    </div>
  );
});
AchievementBadge.displayName = 'AchievementBadge';

// Trophy Case Modal
const TrophyCaseModal = memo(({
  trophies,
  onClose
}: {
  trophies: TrophyData[];
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <m.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="w-full max-w-2xl max-h-[80vh] bg-[#1a1a1a] border border-[#333] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Trophy Case
          </span>
          <span className="text-[10px] text-gray-500">
            {trophies.length} total
          </span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Group by tier */}
        {(['gold', 'silver', 'bronze', 'special'] as const).map(tier => {
          const tierTrophies = trophies.filter(t => t.tier === tier);
          if (tierTrophies.length === 0) return null;

          return (
            <div key={tier} className="mb-6 last:mb-0">
              <h3 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${TIER_STYLES[tier].text}`}>
                {tier === 'special' ? 'Special Awards' : `${tier} Tier`}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {tierTrophies.map(trophy => (
                  <TrophyCard key={trophy.id} trophy={trophy} featured />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </m.div>
  </div>
));
TrophyCaseModal.displayName = 'TrophyCaseModal';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const DirectorProfile: React.FC<DirectorProfileProps> = ({
  profile,
  isOwnProfile = false,
}) => {
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [showAllTrophies, setShowAllTrophies] = useState(false);

  // Computed values
  const status = useMemo(() => getDirectorStatus(profile), [profile]);
  const influenceScore = useMemo(() => calculateInfluenceScore(profile), [profile]);
  const directorRating = useMemo(() => calculateDirectorRating(profile), [profile]);
  const trophies = useMemo(() => getTrophiesFromProfile(profile), [profile]);
  const featuredTrophies = useMemo(() => trophies.slice(0, 5), [trophies]);

  // Build season history from corps data
  const seasonHistory = useMemo((): SeasonHistoryEntry[] => {
    if (!profile.corps) return [];

    const history: SeasonHistoryEntry[] = [];
    const seen = new Set<string>();

    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (!corps) return;

      // Check if corps has seasonHistory
      const corpsAny = corps as { seasonHistory?: SeasonHistoryEntry[] };
      if (corpsAny.seasonHistory) {
        corpsAny.seasonHistory.forEach(season => {
          const key = `${classKey}-${season.seasonId || season.seasonName}`;
          if (seen.has(key)) return;
          seen.add(key);

          history.push({
            ...season,
            corpsName: season.corpsName || corps.corpsName || corps.name || 'Unknown',
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

  // Member since
  const memberSince = useMemo(() => {
    if (!profile.createdAt) return 'Unknown';
    const date = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt as unknown as string);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [profile.createdAt]);

  // Achievements list
  const achievements = profile.achievements || [];

  return (
    <div className="bg-[#0a0a0a] min-h-full">
      {/* ================================================================== */}
      {/* HERO CARD - Director Identity */}
      {/* ================================================================== */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="px-4 py-4">
          {/* Top Row: Avatar + Name + Status */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#222] border border-[#333] flex-shrink-0 flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-500" />
              )}
            </div>

            {/* Name + Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white truncate">
                  {profile.displayName || 'Anonymous Director'}
                </h1>
                <StatusIndicator status={status} />
              </div>

              {profile.userTitle && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3 text-[#0057B8]" />
                  <span className="text-xs text-[#0057B8] font-bold">{profile.userTitle}</span>
                </div>
              )}

              {profile.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-gray-500" />
                  <span className="text-[11px] text-gray-500">{profile.location}</span>
                </div>
              )}

              <div className="flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3 text-gray-600" />
                <span className="text-[11px] text-gray-600">Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              icon={Zap}
              value={influenceScore.toLocaleString()}
              label="Influence"
              color="text-yellow-400"
            />
            <MetricCard
              icon={Target}
              value={directorRating}
              label="Rating"
              color="text-[#0057B8]"
            />
            <MetricCard
              icon={Flame}
              value={profile.engagement?.loginStreak || 0}
              label="Streak"
              color={profile.engagement?.loginStreak && profile.engagement.loginStreak >= 7 ? 'text-orange-400' : 'text-gray-400'}
            />
            <MetricCard
              icon={Calendar}
              value={profile.stats?.seasonsPlayed || 0}
              label="Seasons"
              color="text-green-400"
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MAIN GRID LAYOUT */}
      {/* ================================================================== */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT COLUMN: Trophy Case + Achievements */}
        <div className="lg:col-span-1 space-y-4">

          {/* TROPHY CASE */}
          <div className="bg-[#1a1a1a] border border-[#333]">
            <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Trophy Case
                </span>
              </div>
              {trophies.length > 5 && (
                <button
                  onClick={() => setShowAllTrophies(true)}
                  className="text-[10px] text-[#0057B8] hover:underline"
                >
                  View All ({trophies.length})
                </button>
              )}
            </div>

            {featuredTrophies.length > 0 ? (
              <div className="p-3">
                {/* Featured Shelf - Top 3 */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {featuredTrophies.slice(0, 3).map(trophy => (
                    <TrophyCard key={trophy.id} trophy={trophy} featured />
                  ))}
                </div>

                {/* Secondary Row */}
                {featuredTrophies.length > 3 && (
                  <div className="grid grid-cols-2 gap-2">
                    {featuredTrophies.slice(3, 5).map(trophy => (
                      <TrophyCard key={trophy.id} trophy={trophy} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No trophies yet</p>
                <p className="text-[10px] text-gray-600">Compete to earn rewards</p>
              </div>
            )}
          </div>

          {/* ACHIEVEMENTS */}
          <div className="bg-[#1a1a1a] border border-[#333]">
            <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Achievements
              </span>
              <span className="text-[10px] text-gray-500 ml-auto">
                {achievements.length} earned
              </span>
            </div>

            {achievements.length > 0 ? (
              <div className="p-3 grid grid-cols-1 gap-2">
                {achievements.slice(0, 6).map(achievement => (
                  <AchievementBadge key={achievement.id} achievement={achievement} />
                ))}
                {achievements.length > 6 && (
                  <button className="text-[10px] text-[#0057B8] hover:underline py-2">
                    +{achievements.length - 6} more achievements
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Award className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No achievements yet</p>
                <p className="text-[10px] text-gray-600">Keep playing to unlock</p>
              </div>
            )}
          </div>

          {/* CAREER STATS */}
          <div className="bg-[#1a1a1a] border border-[#333]">
            <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Career Stats
              </span>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-[#333]/50">
                <span className="text-xs text-gray-400">Championships</span>
                <span className="text-sm font-bold text-yellow-400 font-data">
                  {profile.stats?.championships || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#333]/50">
                <span className="text-xs text-gray-400">Top 10 Finishes</span>
                <span className="text-sm font-bold text-white font-data">
                  {profile.stats?.topTenFinishes || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#333]/50">
                <span className="text-xs text-gray-400">Seasons Played</span>
                <span className="text-sm font-bold text-white font-data">
                  {profile.stats?.seasonsPlayed || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#333]/50">
                <span className="text-xs text-gray-400">League Wins</span>
                <span className="text-sm font-bold text-white font-data">
                  {profile.stats?.leagueWins || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-gray-400">Total XP</span>
                <span className="text-sm font-bold text-blue-400 font-data">
                  {(profile.xp || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Season History Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a1a1a] border border-[#333]">
            <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-[#0057B8]" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Season History
                </span>
              </div>
              <span className="text-[10px] text-gray-500">
                {seasonHistory.length} seasons
              </span>
            </div>

            {seasonHistory.length > 0 ? (
              <div className="divide-y divide-[#333]">
                {seasonHistory.map(season => (
                  <SeasonCard
                    key={`${season.classKey}-${season.seasonId}`}
                    season={season}
                    isExpanded={expandedSeason === `${season.classKey}-${season.seasonId}`}
                    onToggle={() => setExpandedSeason(
                      expandedSeason === `${season.classKey}-${season.seasonId}`
                        ? null
                        : `${season.classKey}-${season.seasonId}`
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No season history yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Register for your first season to start building your legacy
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trophy Case Modal */}
      <AnimatePresence>
        {showAllTrophies && (
          <TrophyCaseModal
            trophies={trophies}
            onClose={() => setShowAllTrophies(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(DirectorProfile);
