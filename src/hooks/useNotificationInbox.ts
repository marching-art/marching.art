// =============================================================================
// useNotificationInbox - the signed-in user's whole notification inbox
// =============================================================================
// One real-time listener over `users/{uid}/notifications`, backing the bell in
// the app chrome. Complements useLeagueNotifications, which reads the SAME
// collection but filters to the league types for the league activity feed;
// this hook is type-agnostic so score drops, lineup-lock reminders, weekly
// matchups and streak notices show up too.
//
// Query shape is deliberately minimal — orderBy('createdAt','desc') + limit —
// which is served by the automatic single-field index. No `where` clause, so
// unlike the league hook's `type in [...]` + orderBy this needs no composite
// index at all.
//
// Write surface is exactly what firestore.rules permits for the owner:
//   - update { read: true } (single + batched) — rules assert
//     affectedKeys().hasOnly(['read']), so ANY extra field is denied
//   - delete
// Creates are backend-only (functions/src/helpers/userNotifications.js).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, paths } from '../api/client';
import { reportError } from '../lib/errorReporter';
import { countUnread } from '../utils/notifications';
import type { AppNotification, NotificationInbox } from '../types/notifications';

/**
 * How many notifications the bell holds. Bounded on purpose: this listener
 * lives for the whole session, and the owner pays for every doc read (see the
 * cautionary note at the bottom of useLeagueNotifications.ts).
 */
export const INBOX_LIMIT = 30;

interface InboxState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
}

const EMPTY_STATE: InboxState = { notifications: [], unreadCount: 0, loading: false };

/**
 * Subscribe to the signed-in user's notification inbox.
 *
 * @param uid - The signed-in user's uid. Falsy (signed out / public route)
 *   opens no listener and returns an empty, non-loading inbox.
 */
export function useNotificationInbox(uid: string | null | undefined): NotificationInbox {
  const [state, setState] = useState<InboxState>({ ...EMPTY_STATE, loading: Boolean(uid) });

  // The latest snapshot, for markAllRead. Held in a ref (not a dependency) so
  // the returned callbacks keep a stable identity across every snapshot —
  // otherwise the bell and every memoized row re-render on each update.
  const notificationsRef = useRef<AppNotification[]>([]);

  useEffect(() => {
    if (!uid) {
      notificationsRef.current = [];
      setState(EMPTY_STATE);
      return;
    }

    // Guards against a late snapshot/error landing after the user changed or
    // the component unmounted (the same discipline the store subscriptions use).
    let active = true;
    setState({ notifications: [], unreadCount: 0, loading: true });

    const inboxQuery = query(
      collection(db, paths.userNotifications(uid)),
      orderBy('createdAt', 'desc'),
      limitTo(INBOX_LIMIT)
    );

    const unsubscribe = onSnapshot(
      inboxQuery,
      (snapshot) => {
        if (!active) return;
        const notifications = snapshot.docs.map((snap) => ({
          ...(snap.data() as Omit<AppNotification, 'id'>),
          // Last so a stale `id` field in the doc body can never disagree with
          // the doc id the write helpers address.
          id: snap.id,
        })) as AppNotification[];

        notificationsRef.current = notifications;
        setState({ notifications, unreadCount: countUnread(notifications), loading: false });
      },
      (error) => {
        // Never throw out of a listener: a permission blip or an offline start
        // must degrade to an empty bell, not a blank app shell.
        reportError(error, { source: 'useNotificationInbox', uid });
        if (!active) return;
        setState((prev) => ({ ...prev, loading: false }));
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  const markRead = useCallback(
    async (id: string) => {
      if (!uid || !id) return;
      try {
        // `{ read: true }` ONLY — rules reject an update touching any other key.
        await updateDoc(doc(db, paths.userNotifications(uid), id), { read: true });
      } catch (error) {
        reportError(error, { source: 'useNotificationInbox.markRead', uid, notificationId: id });
      }
    },
    [uid]
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unread = notificationsRef.current.filter((notification) => !notification.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const notification of unread) {
        batch.update(doc(db, paths.userNotifications(uid), notification.id), { read: true });
      }
      await batch.commit();
    } catch (error) {
      reportError(error, {
        source: 'useNotificationInbox.markAllRead',
        uid,
        count: unread.length,
      });
    }
  }, [uid]);

  const remove = useCallback(
    async (id: string) => {
      if (!uid || !id) return;
      try {
        await deleteDoc(doc(db, paths.userNotifications(uid), id));
      } catch (error) {
        reportError(error, { source: 'useNotificationInbox.remove', uid, notificationId: id });
      }
    },
    [uid]
  );

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    markRead,
    markAllRead,
    remove,
  };
}

export default useNotificationInbox;
