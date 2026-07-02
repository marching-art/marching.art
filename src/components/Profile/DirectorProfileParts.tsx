// =============================================================================
// DIRECTOR PROFILE - Shared constants, types, and presentational sub-components
// =============================================================================
// Extracted from DirectorProfile.tsx. The main component composes these.

import React, { memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Crown, Medal,
  MapPin, Award, ChevronRight,
  Music, Disc3, Shield, Minus, ExternalLink, Globe, Twitter, Instagram, Youtube, Facebook, MessageCircle,
  Flag, Quote, } from 'lucide-react';
import type { UserProfile, Achievement, CorpsClass, EnsembleProfileInfo, DirectorSocialLinks } from '../../types';
import { formatSeasonName } from '../../utils/season';
import { CORPS_CLASS_ORDER, resolveCorpsForClass, isCorpsClassUnlocked } from '../../utils/corps';
import { toCanonicalClassKey } from '../../utils/classUnlockTime';

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

// Keyed by canonical class keys ('worldClass'/'openClass'), which is what the
// data layer stores. Look up via getClassDisplay() so legacy short keys
// ('world'/'open') still resolve.
const CLASS_DISPLAY = {
  worldClass: { name: 'World Class', short: 'WC', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  openClass: { name: 'Open Class', short: 'OC', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  aClass: { name: 'A Class', short: 'A', color: 'text-green-400', bg: 'bg-green-500/10' },
  soundSport: { name: 'SoundSport', short: 'SS', color: 'text-orange-400', bg: 'bg-orange-500/10' },
} as const;

type ClassDisplayConfig = (typeof CLASS_DISPLAY)[keyof typeof CLASS_DISPLAY];

function getClassDisplay(classKey: string): ClassDisplayConfig {
  const canonical = toCanonicalClassKey(classKey) as keyof typeof CLASS_DISPLAY;
  return CLASS_DISPLAY[canonical] || CLASS_DISPLAY.soundSport;
}

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

// Kept in sync with src/api/profile.ts getLevelTitle and
// functions/src/helpers/xpCalculations.js getLevelTitle.
const LEVEL_TITLES: Record<number, string> = {
  1: 'Rookie',
  2: 'Trainee',
  3: 'Assistant',
  4: 'Coordinator',
  5: 'Instructor',
  6: 'Caption Head',
  7: 'Program Director',
  8: 'Director',
  9: 'Executive Director',
  10: 'Legend',
};

function titleForLevel(level: number): string {
  const lvl = Math.max(1, Math.floor(level || 1));
  if (lvl >= 10) return LEVEL_TITLES[10];
  return LEVEL_TITLES[lvl] || 'Rookie';
}

// Prefer the stored title, but if it's stale ("Rookie" while level > 1), fall
// back to the title computed from xpLevel so existing profiles heal on view.
function getDisplayTitle(profile: UserProfile): string {
  const level = profile.xpLevel || 1;
  const computed = titleForLevel(level);
  const stored = profile.userTitle;
  if (!stored) return computed;
  if (stored === 'Rookie' && level > 1) return computed;
  return stored;
}

// Get primary corps avatar URL - respects profileAvatarCorps selection
function getCorpsAvatarUrl(profile: UserProfile): { url: string | null; corpsClass: CorpsClass | null } {
  if (!profile.corps) return { url: null, corpsClass: null };

  // If user has selected a specific corps for their profile avatar, use that
  if (profile.profileAvatarCorps) {
    const selectedCorps = resolveCorpsForClass(profile.corps, profile.profileAvatarCorps);
    if (selectedCorps?.avatarUrl) {
      return { url: selectedCorps.avatarUrl, corpsClass: profile.profileAvatarCorps };
    }
  }

  // Fallback: Priority order world > open > aClass > soundSport
  for (const classKey of CORPS_CLASS_ORDER) {
    const corps = resolveCorpsForClass(profile.corps, classKey);
    if (corps?.avatarUrl) return { url: corps.avatarUrl, corpsClass: classKey as CorpsClass };
  }
  return { url: null, corpsClass: null };
}

// Get all corps with avatars for selection
function getCorpsWithAvatars(profile: UserProfile): { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] {
  if (!profile.corps) return [];
  const result: { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] = [];

  for (const classKey of CORPS_CLASS_ORDER) {
    const corps = resolveCorpsForClass(profile.corps, classKey);
    if (corps?.avatarUrl && corps?.corpsName) {
      result.push({
        corpsClass: classKey as CorpsClass,
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
  if (isCorpsClassUnlocked(profile.unlockedClasses, 'worldClass')) {
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
  const classConfig = getClassDisplay(season.classKey);
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

// Section wrapper
const Section = memo(({ icon: Icon, iconColor, title, children, action }: {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="bg-[#1a1a1a] border border-[#333]">
    <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconColor || 'text-gray-400'}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </span>
      </div>
      {action}
    </div>
    {children}
  </div>
));
Section.displayName = 'Section';

// Normalize a social handle/URL into a clickable absolute URL
function normalizeSocialUrl(platform: keyof DirectorSocialLinks, value: string): string {
  if (!value) return '';
  const v = value.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;

  const handle = v.replace(/^@/, '');
  switch (platform) {
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'youtube':
      return handle.includes('/') ? `https://youtube.com/${handle}` : `https://youtube.com/@${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'website':
      return `https://${handle}`;
    case 'discord':
      return v.startsWith('discord.gg') ? `https://${v}` : '';
    default:
      return v;
  }
}

const SOCIAL_META: Array<{
  key: keyof DirectorSocialLinks;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  { key: 'website', label: 'Website', icon: Globe, color: 'text-[#0057B8]' },
  { key: 'twitter', label: 'Twitter', icon: Twitter, color: 'text-sky-400' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-400' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-400' },
  { key: 'tiktok', label: 'TikTok', icon: Music, color: 'text-gray-300' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { key: 'discord', label: 'Discord', icon: MessageCircle, color: 'text-[#5865F2]' },
];

const SocialLinks = memo(({ links }: { links: DirectorSocialLinks }) => {
  const entries = SOCIAL_META.filter(({ key }) => {
    const val = links[key];
    return typeof val === 'string' && val.trim().length > 0;
  });
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(({ key, label, icon: Icon, color }) => {
        const raw = (links[key] || '').trim();
        const href = normalizeSocialUrl(key, raw);
        const display = raw.startsWith('http') ? label : raw;
        if (!href) {
          return (
            <span
              key={key}
              className="flex items-center gap-1 px-2 py-1 border border-[#333] bg-[#0a0a0a] text-[10px] text-gray-400"
            >
              <Icon className={`w-3 h-3 ${color}`} />
              <span className="truncate max-w-[120px]">{display}</span>
            </span>
          );
        }
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-[#333] bg-[#0a0a0a] text-[10px] text-gray-300 hover:text-white hover:border-[#555] transition-colors"
          >
            <Icon className={`w-3 h-3 ${color}`} />
            <span className="truncate max-w-[120px]">{display}</span>
          </a>
        );
      })}
    </div>
  );
});
SocialLinks.displayName = 'SocialLinks';

// Ensemble card - displays one corps's ensemble identity
const EnsembleCard = memo(({
  corpsName,
  classKey,
  info,
  avatarUrl,
  location,
}: {
  corpsName: string;
  classKey: CorpsClass;
  info: EnsembleProfileInfo;
  avatarUrl?: string;
  location?: string;
}) => {
  const classConfig = getClassDisplay(classKey);
  const hasAnyInfo = !!(
    info.tagline || info.mission || info.history || info.motto ||
    info.foundedYear || info.homeVenue || (info.notableShows && info.notableShows.length > 0)
  );

  return (
    <div className="bg-[#0a0a0a] border border-[#333]">
      <div className="px-3 py-2 border-b border-[#333] bg-[#111] flex items-center gap-2">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={corpsName}
            className="w-7 h-7 object-cover border border-[#333]"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">{corpsName}</div>
          <div className="flex items-center gap-2 text-[9px] text-gray-500">
            <span className={`font-bold ${classConfig.color}`}>{classConfig.name}</span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {location}
              </span>
            )}
          </div>
        </div>
      </div>

      {!hasAnyInfo ? (
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-gray-500">No ensemble details yet.</p>
        </div>
      ) : (
        <div className="px-3 py-2 space-y-2">
          {info.tagline && (
            <p className="text-[11px] italic text-gray-300">&ldquo;{info.tagline}&rdquo;</p>
          )}

          <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
            {info.foundedYear && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Est. {info.foundedYear}
              </span>
            )}
            {info.homeVenue && (
              <span className="flex items-center gap-1">
                <Flag className="w-3 h-3" /> {info.homeVenue}
              </span>
            )}
            {info.motto && (
              <span className="flex items-center gap-1">
                <Quote className="w-3 h-3" /> {info.motto}
              </span>
            )}
          </div>

          {info.mission && (
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                Mission
              </div>
              <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{info.mission}</p>
            </div>
          )}

          {info.history && (
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                History
              </div>
              <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{info.history}</p>
            </div>
          )}

          {info.notableShows && info.notableShows.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                Notable Shows
              </div>
              <ul className="space-y-0.5">
                {info.notableShows.map((show, i) => (
                  <li key={`${show}-${i}`} className="text-[11px] text-gray-300 flex items-center gap-1.5">
                    <Disc3 className="w-2.5 h-2.5 text-[#0057B8] flex-shrink-0" /> {show}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
EnsembleCard.displayName = 'EnsembleCard';

// Placeholder card for an unlocked-but-unregistered class
const UnregisteredEnsembleCard = memo(({ classKey }: { classKey: CorpsClass }) => {
  const classConfig = getClassDisplay(classKey);
  return (
    <div className="bg-[#0a0a0a] border border-dashed border-[#333]">
      <div className="px-3 py-2 border-b border-[#333] bg-[#111] flex items-center gap-2">
        <div className="w-7 h-7 border border-dashed border-[#333] flex items-center justify-center">
          <Music className="w-3.5 h-3.5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-400 truncate">Not yet registered</div>
          <div className={`text-[9px] font-bold ${classConfig.color}`}>{classConfig.name}</div>
        </div>
      </div>
      <div className="px-3 py-3 text-center space-y-2">
        <p className="text-[10px] text-gray-500">
          You&apos;ve unlocked {classConfig.name}. Register a corps to start competing.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[10px] text-[#0057B8] hover:underline"
        >
          Register on dashboard <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
});
UnregisteredEnsembleCard.displayName = 'UnregisteredEnsembleCard';

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


export {
  CLASS_DISPLAY,
  getClassDisplay,
  getDirectorStatus,
  calculateInfluenceScore,
  calculateDirectorRating,
  getDisplayTitle,
  getCorpsAvatarUrl,
  getCorpsWithAvatars,
  getCompetitionTrophies,
  TIER_STYLES,
  STATUS_INDICATORS,
  LEVEL_TITLES,
  StatusIndicator,
  StatPill,
  TrophyMini,
  AchievementMini,
  SeasonRow,
  Section,
  SocialLinks,
  EnsembleCard,
  UnregisteredEnsembleCard,
  EmptyWithCTA,
};
export type { SeasonHistoryEntry, TrophyData, ClassDisplayConfig };
