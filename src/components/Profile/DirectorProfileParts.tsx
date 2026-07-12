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
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
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
    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised border border-line">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-xs font-bold font-data tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] text-muted uppercase">{label}</span>
    </div>
  )
);
StatPill.displayName = 'StatPill';

// A trophy is a single bare icon — no box, no label. Shape (class or award
// family) and color are resolved in the data layer (getRealTrophies); this just
// renders them. Full detail lives in the tooltip.
const TrophyMini = memo(({ trophy }: { trophy: TrophyData }) => {
  const Icon = trophy.icon || Award;
  const tooltip = [trophy.title, trophy.description].filter(Boolean).join(' — ');

  return (
    <span className="inline-flex" title={tooltip} role="img" aria-label={tooltip}>
      <Icon className={`w-7 h-7 ${trophy.color}`} />
    </span>
  );
});
TrophyMini.displayName = 'TrophyMini';

// Achievement badge (compact)
const AchievementMini = memo(({ achievement }: { achievement: Achievement }) => {
  const rarityColors: Record<string, string> = {
    legendary: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    epic: 'bg-purple-400/15 border-purple-400/30 text-purple-300',
    rare: 'bg-interactive/15 border-interactive/30 text-interactive',
    common: 'bg-charcoal-500/10 border-charcoal-500/30 text-muted',
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
      <div className="border-b border-line last:border-b-0">
        <button
          onClick={onToggle}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface-raised transition-colors text-left"
        >
          {/* Rank */}
          <div
            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border ${
              placement === 1
                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                : placement && placement <= 3
                  ? 'bg-charcoal-400/10 border-charcoal-500/30 text-secondary'
                  : placement && placement <= 10
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : 'bg-surface-raised border-line text-muted'
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
            <span className="text-[10px] text-muted">
              {conceptTitle && (
                <span className="text-interactive italic">&ldquo;{conceptTitle}&rdquo; · </span>
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
            className={`w-3 h-3 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
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
                <div className="px-3 pt-1 pb-1 bg-background flex items-center gap-1.5 text-[10px] text-muted">
                  <Music className="w-3 h-3 text-interactive flex-shrink-0" />
                  <span className="truncate">
                    {conceptTitle ? `“${conceptTitle}” — ` : ''}
                    {conceptStyle}
                  </span>
                </div>
              )}
              <div className="px-3 pb-2 pt-1 bg-background grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs font-bold text-white">{season.showsAttended || 0}</div>
                  <div className="text-[9px] text-muted">Shows</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{season.circuitPoints || 0}</div>
                  <div className="text-[9px] text-muted">Pts</div>
                </div>
                <div>
                  {isSoundSport ? (
                    <>
                      <div className="text-xs font-bold text-orange-400">{rating || '-'}</div>
                      <div className="text-[9px] text-muted">Rating</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-white">
                        {score > 0 && season.showsAttended
                          ? (score / season.showsAttended).toFixed(1)
                          : '-'}
                      </div>
                      <div className="text-[9px] text-muted">Avg</div>
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
    <div className="bg-surface-card border border-line">
      <div className="px-3 py-2 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${iconColor || 'text-muted'}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{title}</span>
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
  { key: 'website', label: 'Website', icon: Globe, color: 'text-interactive' },
  { key: 'twitter', label: 'Twitter', icon: Twitter, color: 'text-sky-400' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-400' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-400' },
  { key: 'tiktok', label: 'TikTok', icon: Music, color: 'text-secondary' },
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
              className="flex items-center gap-1 px-2 py-1 border border-line bg-background text-[10px] text-muted"
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
            className="flex items-center gap-1 px-2 py-1 border border-line bg-background text-[10px] text-secondary hover:text-white hover:border-line-strong transition-colors"
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
      <div className="bg-background border border-line">
        <div className="px-3 py-2 border-b border-line bg-surface-sunken flex items-center gap-2">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={corpsName}
              className="w-7 h-7 object-cover border border-line"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{corpsName}</div>
            <div className="flex items-center gap-2 text-[9px] text-muted">
              <span className={`font-bold ${classConfig.color}`}>{classConfig.name}</span>
              {showTitle && (
                <span className="text-interactive italic truncate">&ldquo;{showTitle}&rdquo;</span>
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
            <p className="text-[10px] text-muted">No ensemble details yet.</p>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-2">
            {info.tagline && (
              <p className="text-[11px] italic text-secondary">&ldquo;{info.tagline}&rdquo;</p>
            )}

            <div className="flex flex-wrap gap-2 text-[10px] text-muted">
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
                <div className="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5">
                  Mission
                </div>
                <p className="text-[11px] text-secondary whitespace-pre-wrap">{info.mission}</p>
              </div>
            )}

            {info.history && (
              <div>
                <div className="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5">
                  History
                </div>
                <p className="text-[11px] text-secondary whitespace-pre-wrap">{info.history}</p>
              </div>
            )}

            {info.notableShows && info.notableShows.length > 0 && (
              <div>
                <div className="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5">
                  Notable Shows
                </div>
                <ul className="space-y-0.5">
                  {info.notableShows.map((show, i) => (
                    <li
                      key={`${show}-${i}`}
                      className="text-[11px] text-secondary flex items-center gap-1.5"
                    >
                      <Disc3 className="w-2.5 h-2.5 text-interactive flex-shrink-0" /> {show}
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
    <div className="bg-background border border-dashed border-line">
      <div className="px-3 py-2 border-b border-line bg-surface-sunken flex items-center gap-2">
        <div className="w-7 h-7 border border-dashed border-line flex items-center justify-center">
          <Music className="w-3.5 h-3.5 text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-muted truncate">Not yet registered</div>
          <div className={`text-[9px] font-bold ${classConfig.color}`}>{classConfig.name}</div>
        </div>
      </div>
      <div className="px-3 py-3 text-center space-y-2">
        <p className="text-[10px] text-muted">
          You&apos;ve unlocked {classConfig.name}. Register a corps to start competing.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[10px] text-interactive hover:underline"
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
      <Icon className="w-6 h-6 text-muted mx-auto mb-1" />
      <p className="text-[10px] text-muted mb-2">{title}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-[10px] text-interactive hover:underline"
      >
        {cta} <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
);
EmptyWithCTA.displayName = 'EmptyWithCTA';

// Trophy case — a scrollable field of bare trophy icons (see TrophyMini),
// sorted by class hierarchy then award. No boxes, no labels; the shelf simply
// fills and scrolls as hardware accumulates.
const TrophyCaseGrid = memo(({ trophies }: { trophies: TrophyData[] }) => {
  if (trophies.length === 0) {
    return <EmptyWithCTA icon={Trophy} title="No trophies yet" cta="Join a league" to="/leagues" />;
  }
  return (
    <div className="p-3 flex flex-wrap gap-x-2.5 gap-y-3 max-h-44 overflow-y-auto">
      {trophies.map((trophy) => (
        <TrophyMini key={trophy.id} trophy={trophy} />
      ))}
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
              action.primary
                ? 'bg-interactive hover:bg-interactive-hover'
                : 'bg-line hover:bg-line-strong'
            }`}
          >
            <action.icon
              className={`w-4 h-4 text-white ${action.spinning ? 'animate-spin' : ''}`}
            />
            <span className="text-[10px] text-white font-bold uppercase">{action.label}</span>
          </button>
        ))}
      </div>
      <div className="lg:hidden flex flex-col border-t border-line divide-y divide-line">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex items-center justify-center gap-1.5 min-h-touch px-2 transition-colors press-feedback disabled:opacity-50 ${
              action.primary
                ? 'bg-interactive active:bg-interactive-hover text-white'
                : 'bg-surface-card active:bg-line text-secondary'
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
