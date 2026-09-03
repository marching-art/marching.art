// =============================================================================
// APP BOOTSTRAP — the app-wide side effects, extracted from App.jsx
// =============================================================================
// App.jsx was ~800 lines mixing the route table with six global side effects,
// which meant every routing change sat next to Firestore listener lifecycles
// and the daily-login claim. None of these have anything to do with routing;
// they are "things that must happen once while the app is mounted".
//
// The order below is deliberate and load-bearing:
//   1. season listener      — no dependencies; seeds seasonUid for (2)
//   2. schedule listener    — keyed on the season from (1)
//   3. profile listener     — keyed on the signed-in user, and the place the
//                             react-query cache is evicted on sign-out
//   4. offline lineup replay — needs a user
//   5. daily login claim    — needs a user AND a profile (see the note there)
//   6. push notifications   — needs a user, and only re-attaches an existing
//                             grant; it never prompts
//
// Behavior is identical to what lived in App.jsx; only the location changed.

import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { claimDailyLogin } from '../api/functions';
import { surfaceDailyLoginPayoff } from '../utils/dailyLoginPayoff';
import { queryClient } from '../lib/queryClient';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useProfileStore } from '../store/profileStore';
import { initOfflineLineupReplay } from '../lib/offlineLineupQueue';
import { clearPendingRedirect } from '../lib/pendingRedirect';

/**
 * Mount every app-wide listener and daily-loop side effect. Call once, from
 * the root component, above the router.
 */
export function useAppBootstrap(user: User | null | undefined): void {
  const initSeasonListener = useSeasonStore((state) => state.initSeasonListener);
  const cleanupSeasonListener = useSeasonStore((state) => state.cleanup);
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const initScheduleListener = useScheduleStore((state) => state.initScheduleListener);
  const cleanupScheduleListener = useScheduleStore((state) => state.cleanup);
  const initProfileListener = useProfileStore((state) => state.initProfileListener);
  const cleanupProfileListener = useProfileStore((state) => state.cleanup);
  const profile = useProfileStore((state) => state.profile);

  // Initialize global season listener ONCE at app startup
  // This prevents duplicate Firestore listeners across components
  useEffect(() => {
    initSeasonListener();
    return () => {
      cleanupSeasonListener();
    };
  }, [initSeasonListener, cleanupSeasonListener]);

  // Initialize global schedule listener when seasonUid changes
  // This keeps schedule data in sync with the current season
  useEffect(() => {
    if (seasonUid) {
      initScheduleListener(seasonUid);
    }
    return () => {
      cleanupScheduleListener();
    };
  }, [seasonUid, initScheduleListener, cleanupScheduleListener]);

  // Initialize global profile listener when user changes
  // This prevents duplicate Firestore listeners for profile data across components
  useEffect(() => {
    if (user) {
      initProfileListener(user.uid);
    } else if (user === null) {
      // A SETTLED sign-out only. While Firebase Auth is still resolving the
      // session (`undefined`) nothing may be cleared: this effect used to run
      // then too, so every page load — including the forced reload
      // lazyWithRetry does after a deploy — wiped the pending deep link a
      // director was carrying through Register → Onboarding.
      cleanupProfileListener();
      // Evict cached per-user react-query data (profiles, leagues, etc.) so a
      // subsequent sign-in with a different account can't briefly see the
      // previous account's cached reads.
      queryClient.clear();
      clearPendingRedirect();
    }
    return () => {
      // Only cleanup on unmount, not on user change (handled above)
    };
  }, [user, initProfileListener, cleanupProfileListener]);

  // Replay lineup saves queued while offline: flush on sign-in and whenever
  // connectivity returns (see src/lib/offlineLineupQueue.ts).
  useEffect(() => {
    if (!user) return;
    return initOfflineLineupReplay(user.uid);
  }, [user]);

  // Claim daily login once per calendar day to award XP, update streak, and
  // update userTitle. The backend is idempotent (returns alreadyClaimed:true
  // on subsequent calls within the same day); the localStorage guard just
  // avoids redundant network calls per session.
  // Gate on `profile` as well as `user`: a freshly-authenticated user going
  // through onboarding has no profile yet, and claimDailyLogin would 404 with
  // "profile not found". Waiting for the profile to exist avoids that race.
  useEffect(() => {
    if (!user || !profile) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `dailyLoginClaimed:${user.uid}`;
    if (typeof window === 'undefined') return;
    const lastClaimed = window.localStorage.getItem(storageKey);
    if (lastClaimed === todayKey) return;
    claimDailyLogin()
      .then((result) => {
        window.localStorage.setItem(storageKey, todayKey);
        // Show the payoff (XP/coin pills, milestone celebration, level-up).
        // The response used to be discarded, making the game's most
        // reliable daily reward beat completely silent.
        surfaceDailyLoginPayoff(result?.data);
      })
      .catch((err) => {
        console.warn('Daily login claim skipped:', err?.message || err);
      });
  }, [user, profile]);

  // Initialize push notifications when user is authenticated
  // Only attempts to get token if user has previously granted permission
  useEffect(() => {
    const initPushNotifications = async () => {
      if (!user) return;

      // Only proceed if notifications are supported and permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const { initializePushNotifications } = await import('../api/pushNotifications');
          await initializePushNotifications(user.uid);
        } catch (error) {
          console.warn(
            'Push notification initialization skipped:',
            error instanceof Error ? error.message : error
          );
        }
      }
    };

    initPushNotifications();
  }, [user]);
}

export default useAppBootstrap;
