// =============================================================================
// NOTIFICATION TYPE → ICON / COLOR MAP
// =============================================================================
// The presentational half of the inbox. Mirrors getNotificationStyle() in
// useLeagueNotifications.ts for the league types (same icons, same palette, so
// a league entry looks identical in the league feed and in the global inbox)
// and extends it with the server-emitted types (score drop, lineup lock,
// weekly matchup, streak).
//
// Unlike the league version this returns the lucide component itself rather
// than an icon *name*, so callers can't typo a name into a blank cell.

import {
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Ban,
  Bell,
  CalendarClock,
  Check,
  Clock,
  Coins,
  Crown,
  Flame,
  Heart,
  Mail,
  MessageSquare,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { AppNotificationType } from '../../types/notifications';

export interface NotificationDisplay {
  Icon: LucideIcon;
  /** Foreground token for the icon. */
  color: string;
  /** Tinted chip behind the icon. */
  bg: string;
}

/** Unknown/legacy types still render — with the neutral bell. */
export const DEFAULT_NOTIFICATION_DISPLAY: NotificationDisplay = {
  Icon: Bell,
  color: 'text-muted',
  bg: 'bg-charcoal-500/20',
};

const DISPLAY_BY_TYPE: Record<AppNotificationType, NotificationDisplay> = {
  // League types — kept in lockstep with getNotificationStyle().
  matchup_result: { Icon: Swords, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  standings_change: { Icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  new_message: { Icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/20' },
  trade_proposal: { Icon: ArrowLeftRight, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  trade_response: { Icon: Check, color: 'text-teal-400', bg: 'bg-teal-500/20' },
  member_joined: { Icon: UserPlus, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  rivalry_matchup: { Icon: Flame, color: 'text-red-400', bg: 'bg-red-500/20' },
  league_invite: { Icon: Mail, color: 'text-interactive', bg: 'bg-interactive/20' },

  // Server-emitted types (scheduled jobs).
  matchup_start: { Icon: Swords, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  score_drop: { Icon: Trophy, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  lineup_lock: { Icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  // Schedule change = a status warning, not a reward: the `warning` token, not
  // gold/amber utilities (docs/DESIGN_SYSTEM.md rule 4).
  eastern_night_change: { Icon: CalendarClock, color: 'text-warning', bg: 'bg-warning/20' },
  streak_broken: { Icon: Flame, color: 'text-red-400', bg: 'bg-red-500/20' },

  // Newsroom types.
  article_approved: { Icon: Newspaper, color: 'text-green-400', bg: 'bg-green-500/20' },
  trusted_author_unlocked: { Icon: BadgeCheck, color: 'text-teal-400', bg: 'bg-teal-500/20' },
  // Declines/takedowns are status warnings, not rewards.
  article_rejected: { Icon: Ban, color: 'text-warning', bg: 'bg-warning/20' },
  press_release_removed: { Icon: Ban, color: 'text-warning', bg: 'bg-warning/20' },

  // Reward moments — gold is the payoff color (docs/DESIGN_SYSTEM.md: brand/gold
  // = "you won", currency, achievement unlocks, level-ups). Used only here, so
  // it still reads as a reward against the azure/neutral of the rest of the inbox.
  new_champion: { Icon: Crown, color: 'text-brand', bg: 'bg-brand/20' },
  prize_payout: { Icon: Coins, color: 'text-brand', bg: 'bg-brand/20' },
  achievement_unlocked: { Icon: Award, color: 'text-brand', bg: 'bg-brand/20' },
  level_up: { Icon: Sparkles, color: 'text-brand', bg: 'bg-brand/20' },

  // Social / status types.
  new_comment: { Icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/20' },
  // Leadership change — interactive (azure), not a reward.
  commissioner_changed: { Icon: ShieldCheck, color: 'text-interactive', bg: 'bg-interactive/20' },
  supporter_update: { Icon: Heart, color: 'text-red-400', bg: 'bg-red-500/20' },
};

/**
 * Icon + colors for a notification type. Accepts a bare string (Firestore docs
 * are untyped at the wire) and falls back to the bell, so a type added
 * server-side ships a readable row before the client knows about it.
 */
export function getNotificationDisplay(type: string | undefined): NotificationDisplay {
  if (!type) return DEFAULT_NOTIFICATION_DISPLAY;
  return DISPLAY_BY_TYPE[type as AppNotificationType] ?? DEFAULT_NOTIFICATION_DISPLAY;
}

/** Every type with a dedicated icon — exported for the exhaustiveness test. */
export const KNOWN_NOTIFICATION_TYPES = Object.keys(DISPLAY_BY_TYPE) as AppNotificationType[];
