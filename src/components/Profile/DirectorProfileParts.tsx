// =============================================================================
// DIRECTOR PROFILE - Shared constants, types, and presentational sub-components
// =============================================================================
// Extracted from DirectorProfile.tsx. The main component composes these.

import React, { memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Award,
  Trophy,
  ChevronRight,
  Music,
  Disc3,
  Minus,
  ExternalLink,
  Globe,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  MessageCircle,
  Flag,
  Quote,
} from 'lucide-react';
import type {
  Achievement,
  CorpsClass,
  EnsembleProfileInfo,
  DirectorSocialLinks,
} from '../../types';
import { formatSeasonName } from '../../utils/season';
import { describeConceptStyle, getConceptTitle } from '../../utils/showConcept';
import { toCanonicalClassKey } from '../../utils/classUnlocks';
import { getSoundSportRating } from '../../utils/scoresUtils';
import {
  TIER_STYLES,
  STATUS_INDICATORS,
  getClassDisplay,
  type SeasonHistoryEntry,
  type TrophyData,
} from './directorProfileHelpers';

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
          <div
            className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-50`}
          />
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
const StatPill = memo(
  ({
    icon: Icon,
    value,
    label,
    color = 'text-white',
  }: {
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
  )
);
StatPill.displayName = 'StatPill';

// Trophy mini card
// Per-class accent: border color + 2-char code so each competition class reads
// distinctly (an Open Class champion is not a World Class champion). The tile's
// metal (gold/silver/bronze via TIER_STYLES) still encodes rank, and the icon
// shape encodes the award type (Crown = Finals, Trophy = Class, Medal =
// Regional, Shield = Finalist).
const CLASS_ACCENT: Record<string, { border: string; text: string; code: string }> = {
  worldClass: { border: 'border-purple-400/70', text: 'text-purple-300', code: 'WC' },
  openClass: { border: 'border-blue-400/70', text: 'text-blue-300', code: 'OC' },
  aClass: { border: 'border-green-400/70', text: 'text-green-300', code: 'A' },
  soundSport: { border: 'border-orange-400/70', text: 'text-orange-300', code: 'SS' },
  // Podium Class — the management-sim tier below SoundSport (in progress).
  podiumClass: { border: 'border-teal-400/70', text: 'text-teal-300', code: 'PC' },
};

// Compact trophy chip — an icon, not a card. Full detail lives in the tooltip.
const TrophyMini = memo(({ trophy }: { trophy: TrophyData }) => {
  const styles = TIER_STYLES[trophy.tier];
  const Icon = trophy.icon;
  const canonical = trophy.corpsClass ? toCanonicalClassKey(trophy.corpsClass) : null;
  const accent = (canonical && CLASS_ACCENT[canonical]) || null;
  const tooltip = [trophy.title, trophy.description].filter(Boolean).join(' — ');

  return (
    <div
      className={`relative aspect-square flex items-center justify-center rounded-sm border-2 ${styles.bg} ${accent ? accent.border : styles.border}`}
      title={tooltip}
      role="img"
      aria-label={tooltip}
    >
      <Icon className={`w-5 h-5 ${styles.icon}`} />
      {accent && (
        <span
          className={`absolute bottom-0 inset-x-0 text-center text-[7px] font-bold leading-[1.4] ${accent.text} bg-black/50`}
        >
          {accent.code}
        </span>
      )}
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
    <div
      className={`px-2 py-1.5 border ${colors} flex items-center gap-1.5`}
      title={achievement.description}
    >
      <Award className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-[10px] font-bold truncate">{achievement.title}</span>
    </div>
  );
});
AchievementMini.displayName = 'AchievementMini';

// Season row (compact)
const SeasonRow = memo(
  ({
    season,
    isExpanded,
    onToggle,
  }: {
    season: SeasonHistoryEntry;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const classConfig = getClassDisplay(season.classKey);
    const score = season.finalScore || season.totalSeasonScore || 0;
    const placement = season.placement;
    // SoundSport is a ratings-only format: never display the numeric score,
    // only the earned rating tier (Gold / Silver / Bronze / Participation).
    const isSoundSport = toCanonicalClassKey(season.classKey) === 'soundSport';
    const rating = isSoundSport && score > 0 ? getSoundSportRating(score) : null;
    // Archived show concept: title in the row, full program style when expanded
    const conceptTitle = getConceptTitle(season.showConcept);
    const conceptStyle = describeConceptStyle(season.showConcept);

    return (
      <div className="border-b border-[#333] last:border-b-0">
        <button
          onClick={onToggle}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#222] transition-colors text-left"
        >
          {/* Rank */}
          <div
            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border ${
              placement === 1
                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                : placement && placement <= 3
                  ? 'bg-gray-400/10 border-gray-500/30 text-gray-300'
                  : placement && placement <= 10
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : 'bg-[#222] border-[#333] text-gray-500'
            }`}
          >
            {placement ? (
              <span className="text-xs font-bold">#{placement}</span>
            ) : (
              <Minus className="w-3 h-3" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">{season.corpsName}</span>
              <span className={`text-[9px] font-bold px-1 ${classConfig.bg} ${classConfig.color}`}>
                {classConfig.short}
              </span>
            </div>
            <span className="text-[10px] text-gray-500">
              {conceptTitle && (
                <span className="text-[#0057B8] italic">&ldquo;{conceptTitle}&rdquo; · </span>
              )}
              {formatSeasonName(season.seasonId || season.seasonName || '')}
            </span>
          </div>

          {/* Score (SoundSport shows its rating tier, never the numeric score) */}
          <div className="text-right">
            {isSoundSport ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                {rating || '-'}
              </span>
            ) : (
              <span className="text-xs font-bold text-white font-data">
                {score > 0 ? score.toLocaleString() : '-'}
              </span>
            )}
          </div>

          <ChevronRight
            className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {conceptStyle && (
                <div className="px-3 pt-1 pb-1 bg-[#0a0a0a] flex items-center gap-1.5 text-[10px] text-gray-400">
                  <Music className="w-3 h-3 text-[#0057B8] flex-shrink-0" />
                  <span className="truncate">
                    {conceptTitle ? `“${conceptTitle}” — ` : ''}
                    {conceptStyle}
                  </span>
                </div>
              )}
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
                  {isSoundSport ? (
                    <>
                      <div className="text-xs font-bold text-orange-400">{rating || '-'}</div>
                      <div className="text-[9px] text-gray-500">Rating</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-white">
                        {score > 0 && season.showsAttended
                          ? (score / season.showsAttended).toFixed(1)
                          : '-'}
                      </div>
                      <div className="text-[9px] text-gray-500">Avg</div>
                    </>
                  )}
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
SeasonRow.displayName = 'SeasonRow';

// Section wrapper
const Section = memo(
  ({
    icon: Icon,
    iconColor,
    title,
    children,
    action,
  }: {
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
  )
);
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
      return handle.includes('/')
        ? `https://youtube.com/${handle}`
        : `https://youtube.com/@${handle}`;
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
const EnsembleCard = memo(
  ({
    corpsName,
    classKey,
    info,
    avatarUrl,
    location,
    showTitle,
  }: {
    corpsName: string;
    classKey: CorpsClass;
    info: EnsembleProfileInfo;
    avatarUrl?: string;
    location?: string;
    /** This season's show title (from the per-season show concept) */
    showTitle?: string | null;
  }) => {
    const classConfig = getClassDisplay(classKey);
    const hasAnyInfo = !!(
      info.tagline ||
      info.mission ||
      info.history ||
      info.motto ||
      info.foundedYear ||
      info.homeVenue ||
      (info.notableShows && info.notableShows.length > 0)
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
              {showTitle && (
                <span className="text-[#0057B8] italic truncate">&ldquo;{showTitle}&rdquo;</span>
              )}
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
                    <li
                      key={`${show}-${i}`}
                      className="text-[11px] text-gray-300 flex items-center gap-1.5"
                    >
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
  }
);
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
const EmptyWithCTA = memo(
  ({
    icon: Icon,
    title,
    cta,
    to,
  }: {
    icon: React.ElementType;
    title: string;
    cta: string;
    to: string;
  }) => (
    <div className="p-4 text-center">
      <Icon className="w-6 h-6 text-gray-600 mx-auto mb-1" />
      <p className="text-[10px] text-gray-500 mb-2">{title}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-[10px] text-[#0057B8] hover:underline"
      >
        {cta} <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
);
EmptyWithCTA.displayName = 'EmptyWithCTA';

// Trophy case — a dense collection of class-distinct trophy chips (see
// TrophyMini) rather than word-cards, capped with a "+N" overflow tile.
const TROPHY_CAP = 11;
const TrophyCaseGrid = memo(({ trophies }: { trophies: TrophyData[] }) => {
  if (trophies.length === 0) {
    return (
      <EmptyWithCTA icon={Trophy} title="No trophies yet" cta="Join a league" to="/leagues" />
    );
  }
  const overflow = trophies.length - TROPHY_CAP;
  return (
    <div className="p-2 grid grid-cols-4 gap-1.5">
      {trophies.slice(0, TROPHY_CAP).map((trophy) => (
        <TrophyMini key={trophy.id} trophy={trophy} />
      ))}
      {overflow > 0 && (
        <div
          className="aspect-square flex items-center justify-center rounded-sm border-2 border-[#333] bg-[#222]"
          title={`${overflow} more trophies`}
        >
          <span className="text-[10px] font-bold text-gray-400 font-data">+{overflow}</span>
        </div>
      )}
    </div>
  );
});
TrophyCaseGrid.displayName = 'TrophyCaseGrid';

// -----------------------------------------------------------------------------
// AVATAR ACTIONS - Design / Regenerate / Change avatar
// -----------------------------------------------------------------------------
// Rendered twice from one action list: a hover overlay on desktop, and an
// always-visible button row on touch/small screens where hover never fires.

export interface AvatarAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  spinning?: boolean;
}

const AvatarActions = ({ actions }: { actions: AvatarAction[] }) => {
  if (actions.length === 0) return null;
  return (
    <>
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 hidden lg:flex flex-col items-center justify-center gap-2 transition-opacity">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors disabled:opacity-50 ${
              action.primary ? 'bg-[#0057B8] hover:bg-[#0066d6]' : 'bg-[#333] hover:bg-[#444]'
            }`}
          >
            <action.icon
              className={`w-4 h-4 text-white ${action.spinning ? 'animate-spin' : ''}`}
            />
            <span className="text-[10px] text-white font-bold uppercase">{action.label}</span>
          </button>
        ))}
      </div>
      <div className="lg:hidden flex flex-col border-t border-[#333] divide-y divide-[#333]">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex items-center justify-center gap-1.5 min-h-touch px-2 transition-colors press-feedback disabled:opacity-50 ${
              action.primary
                ? 'bg-[#0057B8] active:bg-[#0066d6] text-white'
                : 'bg-[#1a1a1a] active:bg-[#333] text-gray-300'
            }`}
          >
            <action.icon className={`w-4 h-4 ${action.spinning ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-bold uppercase">{action.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};

// Purchased director title from the Corps Identity Shop, shown as flair next
// to the level title in the profile hero.
const ShopTitleFlair = ({ item }: { item: { name: string; textClass?: string } }) => (
  <span className={`text-[11px] font-bold ${item.textClass || 'text-yellow-400'}`}>
    ★ {item.name}
  </span>
);

export {
  StatusIndicator,
  StatPill,
  TrophyMini,
  TrophyCaseGrid,
  AchievementMini,
  SeasonRow,
  Section,
  SocialLinks,
  EnsembleCard,
  UnregisteredEnsembleCard,
  EmptyWithCTA,
  AvatarActions,
  ShopTitleFlair,
};
