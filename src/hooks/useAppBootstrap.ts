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
import { getGameDay } from '../utils/dailyChallenges';
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

  // Claim daily login once per GAME day (2 AM ET, the same boundary the server
  // streak and the nightly scores use) to award XP, update streak, and update
  // userTitle. The backend is idempotent (returns alreadyClaimed:true on
  // subsequent calls within the same game day); the localStorage guard just
  // avoids redundant network calls.
  //
  // The guard used to be keyed on the UTC date, which rolls over at 7–8 PM ET.
  // A director who visited in the evening stamped TOMORROW's UTC date, so the
  // next day's daytime visits skipped the claim entirely — the streak-at-risk
  // push fired every evening and the Director's Report showed login undone
  // until they came back after the UTC rollover, perpetuating the cycle.
  //
  // Also re-checked whenever the tab regains focus, so a tab left open across
  // the 2 AM ET rollover claims the new day instead of waiting for a reload.
  //
  // Gate on `profile` as well as `user`: a freshly-authenticated user going
  // through onboarding has no profile yet, and claimDailyLogin would 404 with
  // "profile not found". Waiting for the profile to exist avoids that race.
  const hasProfile = !!profile;
  useEffect(() => {
    if (!user || !hasProfile || typeof window === 'undefined') return;
    const storageKey = `dailyLoginClaimed:${user.uid}`;
    let inFlight = false;

    const claimIfNewGameDay = () => {
      const gameDay = getGameDay();
      let lastClaimed: string | null = null;
      try {
        lastClaimed = window.localStorage.getItem(storageKey);
      } catch {
        // Storage unavailable (private mode) — fall through; the server dedupes.
      }
      if (lastClaimed === gameDay || inFlight) return;
      inFlight = true;
      claimDailyLogin()
        .then((result) => {
          try {
            window.localStorage.setItem(storageKey, gameDay);
          } catch {
            // Best-effort guard only.
          }
          // Show the payoff (XP/coin pills, milestone celebration, level-up).
          // The response used to be discarded, making the game's most
          // reliable daily reward beat completely silent.
          surfaceDailyLoginPayoff(result?.data);
        })
        .catch((err) => {
          console.warn('Daily login claim skipped:', err?.message || err);
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') claimIfNewGameDay();
    };

    claimIfNewGameDay();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, hasProfile]);

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
