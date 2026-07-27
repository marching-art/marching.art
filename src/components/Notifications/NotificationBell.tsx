// =============================================================================
// NOTIFICATION BELL - the inbox entry point in the app chrome
// =============================================================================
// Owns the inbox subscription and the open/close state; NotificationPanel
// renders the list. Mounted exactly once (GameShell's header) so the session
// only ever holds one notifications listener — see useNotificationInbox.
//
// Responsive by the repo's established split: a dropdown on desktop, the
// shared BottomSheet on mobile (same pattern the rest of the app uses for
// panel-like surfaces), with the identical panel body inside both.

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useNotificationInbox } from '../../hooks/useNotificationInbox';
import { describeUnread, formatUnreadBadge } from '../../utils/notifications';
import NotificationPanel from './NotificationPanel';
import type { AppNotification } from '../../types/notifications';

export interface NotificationBellProps {
  /** Signed-in uid; falsy renders nothing (no listener, no bell). */
  uid: string | null | undefined;
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ uid, className = '' }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const panelId = useId();

  const { notifications, unreadCount, loading, markRead, markAllRead, remove } =
    useNotificationInbox(uid);

  // Trap focus in the desktop dropdown only; BottomSheet manages its own.
  useFocusTrap(dropdownRef, open && !isMobile);

  const close = useCallback(() => setOpen(false), []);

  // Escape closes, and a click outside the dropdown dismisses it. Both are
  // desktop-only: the sheet has an overlay and its own close affordance.
  useEffect(() => {
    if (!open || isMobile) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) close();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, isMobile, close]);

  const handleSelect = useCallback(
    (notification: AppNotification) => {
      // Mark-read is best-effort: a failed write must never swallow the
      // navigation the director actually asked for.
      void markRead(notification.id);
      close();
      if (notification.link) navigate(notification.link);
    },
    [markRead, navigate, close]
  );

  const handleMarkAllRead = useCallback(() => {
    void markAllRead();
  }, [markAllRead]);

  const handleDismiss = useCallback(
    (id: string) => {
      void remove(id);
    },
    [remove]
  );

  if (!uid) return null;

  const badge = formatUnreadBadge(unreadCount);
  // The true count, not the capped badge text — "12 unread" beats "9+ unread".
  const label = describeUnread(unreadCount);

  const panel = (
    <NotificationPanel
      notifications={notifications}
      unreadCount={unreadCount}
      loading={loading}
      onSelect={handleSelect}
      onMarkAllRead={handleMarkAllRead}
      onDismiss={handleDismiss}
      variant={isMobile ? 'sheet' : 'dropdown'}
      headingId={headingId}
    />
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        className="relative flex items-center justify-center min-w-touch min-h-touch text-muted hover:text-white transition-colors press-feedback"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-white text-[10px] font-bold font-data tabular-nums rounded-full"
          >
            {badge}
          </span>
        )}
      </button>

      {isMobile ? (
        <BottomSheet isOpen={open} onClose={close} title="Notifications">
          <div id={panelId}>{panel}</div>
        </BottomSheet>
      ) : (
        open && (
          <div
            ref={dropdownRef}
            id={panelId}
            role="dialog"
            aria-labelledby={headingId}
            className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-1rem)] max-h-[70vh] bg-surface-card border border-line shadow-none z-50 overflow-hidden"
          >
            {panel}
          </div>
        )
      )}
    </div>
  );
};

export default NotificationBell;
