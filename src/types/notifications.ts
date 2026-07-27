// =============================================================================
// IN-APP NOTIFICATION INBOX TYPES
// =============================================================================
// The general shape of a doc in `users/{uid}/notifications`, written ONLY by
// the backend (functions/src/helpers/userNotifications.js — Firestore rules
// make the subcollection create-denied for clients). Every writer funnels
// through that helper, so the shape below is the contract:
//
//   { id, userId, type, title, message, read, createdAt, link?, metadata? }
//
// plus any caller extras spread through unchanged (the league flows add
// leagueId / leagueName).
//
// `LeagueNotification` in ./league.ts is the narrower, league-only view of the
// same collection that useLeagueNotifications reads with a `type in [...]`
// filter. It stays as-is; this file is the superset the global inbox reads.

import type { Timestamp } from 'firebase/firestore';
import type { LeagueNotificationType } from './league';

/**
 * Notification types emitted by the non-league backend writers. Grepped from
 * the actual `type:` values passed to createUserNotification(s):
 *   - functions/src/scheduled/pushNotifications.js → matchup_start, score_drop,
 *     lineup_lock
 *   - functions/src/scheduled/emailNotifications.js → streak_broken
 * Keep this in sync when a new server writer lands; unknown types still render
 * (see notificationDisplay.ts) but lose their specific icon.
 */
export type ServerNotificationType =
  | 'matchup_start' // Weekly league matchup is about to begin
  | 'score_drop' // Last night's scores are in
  | 'lineup_lock' // Lineup lock deadline approaching
  | 'streak_broken'; // Login streak ended

/** Every notification `type` the inbox knows how to style. */
export type AppNotificationType = LeagueNotificationType | ServerNotificationType;

/**
 * One inbox entry.
 *
 * `createdAt` is nullable because a doc read back before the serverTimestamp
 * resolves has no value yet, and a malformed legacy doc may lack it entirely —
 * the UI must not crash on either.
 */
export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | null;

  /** In-app destination for the notification, e.g. '/scores?src=inbox'. */
  link?: string;
  /** Free-form context from the writer (week, opponentName, previousStreak, …). */
  metadata?: Record<string, unknown>;

  // League writers spread these through; present only on league notifications.
  leagueId?: string;
  leagueName?: string;
}

/** What useNotificationInbox returns. */
export interface NotificationInbox {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Flip a single notification's `read` flag (the only field rules allow). */
  markRead: (id: string) => Promise<void>;
  /** Batch-flip every unread notification's `read` flag. */
  markAllRead: () => Promise<void>;
  /** Delete one notification (owner-permitted by rules). */
  remove: (id: string) => Promise<void>;
}
