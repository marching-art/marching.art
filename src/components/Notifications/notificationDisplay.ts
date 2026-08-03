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
  Bell,
  CalendarClock,
  Check,
  Clock,
  Flame,
  Mail,
  MessageSquare,
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
  eastern_night_change: { Icon: CalendarClock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  streak_broken: { Icon: Flame, color: 'text-red-400', bg: 'bg-red-500/20' },
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
