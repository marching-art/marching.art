// =============================================================================
// NOTIFICATION PANEL - the inbox list body
// =============================================================================
// Pure presentation: it receives the inbox state and the handlers from
// NotificationBell, so the exact same list renders inside the desktop dropdown
// and inside the mobile BottomSheet (the sheet already supplies its own
// title/close chrome, hence the `variant` prop).

import React from 'react';
import { BellOff, X } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { formatRelativeTime, toDateOrNull } from '../../utils/notifications';
import { getNotificationDisplay } from './notificationDisplay';
import type { AppNotification } from '../../types/notifications';

export interface NotificationPanelProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Activate a row: mark it read and follow its link. */
  onSelect: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  /**
   * 'dropdown' renders its own heading; 'sheet' omits it because BottomSheet
   * already renders the title row.
   */
  variant?: 'dropdown' | 'sheet';
  /** id of the element the heading provides, for the dialog's aria-labelledby. */
  headingId?: string;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  unreadCount,
  loading,
  onSelect,
  onMarkAllRead,
  onDismiss,
  variant = 'dropdown',
  headingId,
}) => (
  <div className="flex flex-col min-h-0">
    {/* Header: heading (dropdown only) + the mark-all action */}
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line bg-surface-raised flex-shrink-0">
      {variant === 'dropdown' ? (
        <h2
          id={headingId}
          className="text-xs font-bold text-white uppercase tracking-wider truncate"
        >
          Notifications
        </h2>
      ) : (
        <span className="text-xs text-muted">
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </span>
      )}

      {unreadCount > 0 && (
        <button
          type="button"
          onClick={onMarkAllRead}
          className="flex-shrink-0 px-2 py-1.5 text-xs font-medium text-interactive hover:text-interactive-hover hover:bg-white/5 rounded-none transition-colors press-feedback"
        >
          Mark all read
        </button>
      )}
    </div>

    {/* Body */}
    <div className="flex-1 min-h-0 overflow-y-auto max-h-[70vh] sm:max-h-96">
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <BellOff className="w-6 h-6 text-muted" aria-hidden="true" />
          <p className="text-sm font-medium text-secondary">You&apos;re all caught up</p>
          <p className="text-xs text-muted">
            Score drops, lineup reminders and league news will land here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {notifications.map((notification) => {
            const { Icon, color, bg } = getNotificationDisplay(notification.type);
            const date = toDateOrNull(notification.createdAt);
            const relative = formatRelativeTime(notification.createdAt);

            return (
              <li key={notification.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect(notification)}
                  className={`flex-1 min-w-0 flex items-start gap-2.5 px-3 py-2.5 min-h-touch text-left transition-colors press-feedback hover:bg-white/5 ${
                    notification.read ? '' : 'bg-interactive/5'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-none ${bg}`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      {!notification.read && (
                        <span
                          className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-interactive"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`flex-1 min-w-0 truncate text-sm ${
                          notification.read ? 'font-medium text-secondary' : 'font-bold text-white'
                        }`}
                      >
                        {notification.title}
                      </span>
                      {/* Unread state is conveyed by the dot AND this text, so
                          it does not rely on color alone. */}
                      {!notification.read && <span className="sr-only">Unread</span>}
                    </span>
                    <span className="block mt-0.5 text-xs text-muted line-clamp-2">
                      {notification.message}
                    </span>
                    {relative && (
                      <time
                        dateTime={date ? date.toISOString() : undefined}
                        className="block mt-1 text-[11px] text-muted font-data tabular-nums"
                      >
                        {relative}
                      </time>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                  aria-label={`Dismiss notification: ${notification.title}`}
                  className="flex-shrink-0 flex items-center justify-center w-10 min-h-touch text-muted hover:text-white hover:bg-white/5 rounded-none transition-colors press-feedback"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </div>
);

export default NotificationPanel;
