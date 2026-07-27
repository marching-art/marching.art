// =============================================================================
// NOTIFICATION INBOX HELPERS (pure)
// =============================================================================
// Formatting and counting for the in-app notification inbox. Deliberately free
// of firebase, react and lucide imports so the hook, the bell and the panel can
// all share these and the unit tests import nothing but this module.
//
// NOTE: useLeagueNotifications.ts has a `formatNotificationTime` of its own.
// It is NOT reused here on purpose: that module pulls in @tanstack/react-query
// and the whole league-notification hook, which would drag react-query into the
// header chunk just to render "3h ago".

/**
 * Anything the inbox might hold in `createdAt`: a Firestore Timestamp (duck
 * typed so this module stays firebase-free), a Date, epoch millis, or an ISO
 * string. Nullable because a serverTimestamp read back too early is null.
 */
export type TimestampLike = { toDate: () => Date } | Date | number | string | null | undefined;

/** Above this, the badge shows the cap plus a "+" instead of the real count. */
export const UNREAD_BADGE_CAP = 9;

/** Coerce a TimestampLike into a Date, or null when it is absent/invalid. */
export function toDateOrNull(value: TimestampLike): Date | null {
  if (value == null) return null;

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && typeof value.toDate === 'function') {
    // Firestore Timestamp. toDate() can throw on a malformed doc value.
    try {
      date = value.toDate();
    } catch {
      return null;
    }
  } else if (typeof value === 'number' || typeof value === 'string') {
    date = new Date(value);
  } else {
    return null;
  }

  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * Short relative timestamp for an inbox row: "Just now", "12m ago", "3h ago",
 * "2d ago", then an absolute "Mar 4" past a week. Returns '' when there is no
 * usable timestamp so the row simply omits the time instead of showing "NaN".
 *
 * `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(value: TimestampLike, now: Date = new Date()): string {
  const date = toDateOrNull(value);
  if (!date) return '';

  const diffMs = now.getTime() - date.getTime();
  // A clock skew between the server stamp and the browser can put a fresh
  // notification slightly in the future; "Just now" beats "-1m ago".
  if (diffMs < 60_000) return 'Just now';

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Badge text for the bell. '' means "render no badge" — the caller decides,
 * so an unread count of 0 can never render an empty circle.
 */
export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  const whole = Math.floor(count);
  return whole > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(whole);
}

/**
 * Screen-reader text for the bell's aria-label. Uses the true count, not the
 * capped badge text: "12 unread" is more useful than "9+ unread".
 */
export function describeUnread(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return 'Notifications, none unread';
  const whole = Math.floor(count);
  return `Notifications, ${whole} unread`;
}

/** Count the unread entries. Treats a missing `read` field as unread. */
export function countUnread(notifications: ReadonlyArray<{ read?: boolean }>): number {
  return notifications.reduce((total, notification) => (notification.read ? total : total + 1), 0);
}
