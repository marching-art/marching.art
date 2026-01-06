// useLeagueNotifications - Hook for managing league notifications and activity
// Provides real-time notifications, unread counts, and rivalry detection

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  Timestamp,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, paths } from '../api/client';
import { queryKeys } from '../lib/queryClient';
import type {
  LeagueNotification,
  LeagueActivity,
  RivalryData,
  League,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface NotificationState {
  notifications: LeagueNotification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
}

interface UseLeagueNotificationsOptions {
  enabled?: boolean;
  limit?: number;
}

interface UseLeagueActivityOptions {
  enabled?: boolean;
  limit?: number;
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

/**
 * Get notification icon and color based on type
 */
export function getNotificationStyle(type: LeagueNotification['type']) {
  switch (type) {
    case 'matchup_result':
      return { icon: 'Swords', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    case 'standings_change':
      return { icon: 'TrendingUp', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    case 'new_message':
      return { icon: 'MessageSquare', color: 'text-green-400', bg: 'bg-green-500/20' };
    case 'trade_proposal':
      return { icon: 'ArrowLeftRight', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    case 'trade_response':
      return { icon: 'Check', color: 'text-teal-400', bg: 'bg-teal-500/20' };
    case 'member_joined':
      return { icon: 'UserPlus', color: 'text-cyan-400', bg: 'bg-cyan-500/20' };
    case 'rivalry_matchup':
      return { icon: 'Flame', color: 'text-red-400', bg: 'bg-red-500/20' };
    default:
      return { icon: 'Bell', color: 'text-cream-400', bg: 'bg-cream-500/20' };
  }
}

/**
 * Format notification timestamp
 */
export function formatNotificationTime(timestamp: Timestamp | Date): string {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// MAIN HOOK: useLeagueNotifications
// =============================================================================

export function useLeagueNotifications(
  uid: string | undefined,
  options: UseLeagueNotificationsOptions = {}
) {
  const { enabled = true, limit: notificationLimit = 50 } = options;
  const queryClient = useQueryClient();

  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
    error: null,
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!uid || !enabled) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    // Query for league notifications
    const notificationsRef = collection(db, paths.userNotifications(uid));
    const q = query(
      notificationsRef,
      where('type', 'in', [
        'matchup_result',
        'standings_change',
        'new_message',
        'trade_proposal',
        'trade_response',
        'member_joined',
        'rivalry_matchup',
      ]),
      orderBy('createdAt', 'desc'),
      limit(notificationLimit)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as LeagueNotification[];

        const unreadCount = notifications.filter(n => !n.read).length;

        setState({
          notifications,
          unreadCount,
          loading: false,
          error: null,
        });

        // Update query cache for badge
        queryClient.setQueryData(
          queryKeys.unreadNotificationCount(uid),
          unreadCount
        );
      },
      (error) => {
        console.error('Notification subscription error:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error,
        }));
      }
    );

    return () => unsubscribe();
  }, [uid, enabled, notificationLimit, queryClient]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!uid) return;

    try {
      const notificationRef = doc(db, paths.userNotifications(uid), notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [uid]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!uid || state.notifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      const unreadNotifications = state.notifications.filter(n => !n.read);

      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, paths.userNotifications(uid), notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [uid, state.notifications]);

  // Clear old notifications
  const clearOldNotifications = useCallback(async (olderThanDays = 30) => {
    if (!uid) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const notificationsRef = collection(db, paths.userNotifications(uid));
      const q = query(
        notificationsRef,
        where('createdAt', '<', cutoffTimestamp),
        where('read', '==', true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to clear old notifications:', error);
    }
  }, [uid]);

  return {
    ...state,
    markAsRead,
    markAllAsRead,
    clearOldNotifications,
  };
}

// =============================================================================
// HOOK: useLeagueActivity
// =============================================================================

export function useLeagueActivity(
  leagueId: string | undefined,
  options: UseLeagueActivityOptions = {}
) {
  const { enabled = true, limit: activityLimit = 20 } = options;

  const [activities, setActivities] = useState<LeagueActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time activity
  useEffect(() => {
    if (!leagueId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const activityRef = collection(db, paths.leagueActivity(leagueId));
    const q = query(
      activityRef,
      orderBy('timestamp', 'desc'),
      limit(activityLimit)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activityData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as LeagueActivity[];

        setActivities(activityData);
        setLoading(false);
      },
      (error) => {
        console.error('Activity subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [leagueId, enabled, activityLimit]);

  return { activities, loading };
}

// =============================================================================
// HOOK: useUnreadNotificationCount
// =============================================================================

export function useUnreadNotificationCount(uid: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    const notificationsRef = collection(db, paths.userNotifications(uid));
    const q = query(
      notificationsRef,
      where('read', '==', false),
      limit(100) // Cap at 100 for performance
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.docs.length);
      },
      (error) => {
        console.error('Unread count subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return count;
}

// =============================================================================
// HOOK: useRivalries
// =============================================================================

export function useRivalries(
  uid: string | undefined,
  leagueId: string | undefined,
  weeklyMatchups: Record<number, Array<{ user1: string; user2: string }>>,
  weeklyResults: Record<number, Record<string, number>>,
  memberProfiles: Record<string, { displayName?: string; username?: string }>
) {
  return useMemo(() => {
    if (!uid || !leagueId) return [];

    const rivalryMap: Record<string, RivalryData> = {};

    // Count matchups with each opponent
    Object.entries(weeklyMatchups).forEach(([weekNum, matchups]) => {
      matchups.forEach(matchup => {
        if (matchup.user1 !== uid && matchup.user2 !== uid) return;

        const opponentId = matchup.user1 === uid ? matchup.user2 : matchup.user1;

        if (!rivalryMap[opponentId]) {
          const profile = memberProfiles[opponentId];
          rivalryMap[opponentId] = {
            rivalId: opponentId,
            rivalName: profile?.displayName || profile?.username || `Director ${opponentId.slice(0, 6)}`,
            matchupCount: 0,
            userWins: 0,
            rivalWins: 0,
            ties: 0,
          };
        }

        rivalryMap[opponentId].matchupCount++;
        rivalryMap[opponentId].lastMatchupWeek = parseInt(weekNum);

        // Calculate result
        const scores = weeklyResults[parseInt(weekNum)];
        if (scores) {
          const userScore = scores[uid] || 0;
          const rivalScore = scores[opponentId] || 0;

          if (userScore > rivalScore) {
            rivalryMap[opponentId].userWins++;
          } else if (rivalScore > userScore) {
            rivalryMap[opponentId].rivalWins++;
          } else {
            rivalryMap[opponentId].ties++;
          }
        }
      });
    });

    // Calculate streaks
    Object.values(rivalryMap).forEach(rivalry => {
      const weeks = Object.keys(weeklyMatchups)
        .map(Number)
        .sort((a, b) => b - a);

      let streak = 0;
      let streakType: 'W' | 'L' | null = null;

      for (const week of weeks) {
        const matchup = weeklyMatchups[week]?.find(
          m => (m.user1 === uid && m.user2 === rivalry.rivalId) ||
               (m.user2 === uid && m.user1 === rivalry.rivalId)
        );

        if (!matchup) continue;

        const scores = weeklyResults[week];
        if (!scores) continue;

        const userScore = scores[uid] || 0;
        const rivalScore = scores[rivalry.rivalId] || 0;

        if (userScore === rivalScore) continue;

        const currentType: 'W' | 'L' = userScore > rivalScore ? 'W' : 'L';

        if (streakType === null) {
          streakType = currentType;
          streak = 1;
        } else if (streakType === currentType) {
          streak++;
        } else {
          break;
        }
      }

      if (streakType) {
        rivalry.streak = { count: streak, type: streakType };
      }
    });

    // Return rivals with 2+ matchups, sorted by total matchups
    return Object.values(rivalryMap)
      .filter(r => r.matchupCount >= 2)
      .sort((a, b) => b.matchupCount - a.matchupCount);
  }, [uid, leagueId, weeklyMatchups, weeklyResults, memberProfiles]);
}

// =============================================================================
// HOOK: useLeagueNotificationBadge
// =============================================================================

/**
 * Simple hook for navigation badge - just returns unread count for all leagues
 */
export function useLeagueNotificationBadge(uid: string | undefined) {
  const count = useUnreadNotificationCount(uid);

  return {
    count,
    hasNotifications: count > 0,
    displayCount: count > 99 ? '99+' : count.toString(),
  };
}

// =============================================================================
// UTILITY: Create notification
// =============================================================================

export async function createLeagueNotification(
  notification: Omit<LeagueNotification, 'id' | 'createdAt'>
): Promise<string> {
  const notificationsRef = collection(db, paths.userNotifications(notification.userId));
  const newNotificationRef = doc(notificationsRef);

  await setDoc(newNotificationRef, {
    ...notification,
    id: newNotificationRef.id,
    createdAt: Timestamp.now(),
  });

  return newNotificationRef.id;
}

// =============================================================================
// UTILITY: Check if user has rivalry with opponent
// =============================================================================

export function isRivalry(
  rivalries: RivalryData[],
  opponentId: string
): RivalryData | undefined {
  return rivalries.find(r => r.rivalId === opponentId);
}

// =============================================================================
// UTILITY: Get rivalry description
// =============================================================================

export function getRivalryDescription(rivalry: RivalryData): string {
  const record = `${rivalry.userWins}-${rivalry.rivalWins}`;
  const streak = rivalry.streak
    ? ` (${rivalry.streak.type}${rivalry.streak.count} streak)`
    : '';

  return `${rivalry.matchupCount} matchups, ${record}${streak}`;
}
