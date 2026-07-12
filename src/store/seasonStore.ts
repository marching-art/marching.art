import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../api';
import { formatSeasonName } from '../utils/season';
import { getSeasonProgress } from '../utils/seasonProgress';

/**
 * Raw shape of the `game-settings/season` Firestore document as this store and
 * its consumers actually read it. The document carries more fields than are
 * listed here; the index signature preserves that while still documenting the
 * ones the app depends on. (This is the on-the-wire doc, deliberately kept
 * separate from the idealized `SeasonData` type in `../types/season`.)
 */
export interface SeasonDoc {
  seasonUid?: string;
  name?: string;
  /** e.g. 'live-season' | 'off-season' */
  status?: string;
  seasonType?: string;
  seasonYear?: number;
  totalWeeks?: number;
  currentPointCap?: number;
  dataDocId?: string;
  lastScrapedDate?: string;
  registrationOpen?: boolean;
  registrationDeadline?: Timestamp;
  schedule?: {
    startDate?: Timestamp;
    endDate?: Timestamp;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SeasonTypeInfo {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

interface SeasonState {
  // Core season data from Firestore
  seasonData: SeasonDoc | null;
  loading: boolean;
  error: string | null;

  // Derived values (computed when seasonData changes)
  weeksRemaining: number | null;
  currentWeek: number;
  currentDay: number;
  seasonUid: string | null;

  // Unsubscribe function for cleanup
  _unsubscribe: (() => void) | null;

  initSeasonListener: () => () => void;
  cleanup: () => void;
  getSeasonProgress: () => { currentDay: number; currentWeek: number };
  isRegistrationLocked: (corpsClass: string) => boolean;
  getSeasonTypeInfo: () => SeasonTypeInfo;
  formatSeasonName: () => string;
}

/**
 * Global Season Store
 *
 * This store maintains a SINGLE Firestore listener for season data,
 * preventing duplicate reads across components that need season info.
 *
 * Components should use this store instead of creating their own listeners.
 */
export const useSeasonStore = create<SeasonState>()((set, get) => ({
  // Core season data from Firestore
  seasonData: null,
  loading: true,
  error: null,

  // Derived values (computed when seasonData changes)
  weeksRemaining: null,
  currentWeek: 1,
  currentDay: 1,
  seasonUid: null,

  // Unsubscribe function for cleanup
  _unsubscribe: null,

  /**
   * Initialize the season listener - should be called ONCE at app startup
   * Returns unsubscribe function for cleanup
   */
  initSeasonListener: () => {
    const { _unsubscribe } = get();

    // Prevent duplicate listeners
    if (_unsubscribe) {
      return _unsubscribe;
    }

    const seasonRef = doc(db, 'game-settings/season');

    const unsubscribe = onSnapshot(
      seasonRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as SeasonDoc;

          // Derived day/week come from the single canonical source
          // (utils/seasonProgress), which mirrors the backend game-day math in
          // functions/src/helpers/gameDay.js exactly — 2 AM ET reset, start
          // normalized on the UTC calendar. Keeps the day the UI shows in sync
          // with the day the nightly scoring processors actually score.
          const { currentDay, currentWeek } = data.schedule?.startDate
            ? getSeasonProgress(data)
            : { currentDay: 1, currentWeek: 1 };

          let weeksRemaining: number | null = null;

          const endTimestamp = data.schedule?.endDate;
          if (endTimestamp) {
            const endDate = endTimestamp.toDate();
            const now = new Date();
            const millisRemaining = endDate.getTime() - now.getTime();
            const weeks = Math.ceil(millisRemaining / (7 * 24 * 60 * 60 * 1000));
            weeksRemaining = weeks > 0 ? weeks : 0;
          }

          set({
            seasonData: data,
            seasonUid: data.seasonUid || null,
            weeksRemaining,
            currentWeek,
            currentDay,
            loading: false,
            error: null,
          });
        } else {
          set({
            seasonData: null,
            seasonUid: null,
            weeksRemaining: null,
            currentWeek: 1,
            currentDay: 1,
            loading: false,
            error: 'No active season found',
          });
        }
      },
      (err) => {
        console.error('Error fetching season data:', err);
        set({
          loading: false,
          error: err.message,
        });
      }
    );

    set({ _unsubscribe: unsubscribe });
    return unsubscribe;
  },

  /**
   * Cleanup the listener - call on app unmount
   */
  cleanup: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) {
      _unsubscribe();
      set({ _unsubscribe: null });
    }
  },

  /**
   * Get season progress info
   */
  getSeasonProgress: () => {
    const { currentDay, currentWeek } = get();
    return { currentDay, currentWeek };
  },

  /**
   * Check if a class registration is locked based on weeks remaining
   */
  isRegistrationLocked: (corpsClass) => {
    const { weeksRemaining } = get();
    if (weeksRemaining === null) return false;

    // Accepts canonical keys (worldClass/openClass) and legacy short keys
    // (world/open) — callers now pass canonical.
    const locks: Record<string, number> = {
      worldClass: 6,
      world: 6,
      openClass: 5,
      open: 5,
      aClass: 4,
      soundSport: 0,
    };

    const lockWeeks = locks[corpsClass] || 0;
    return weeksRemaining < lockWeeks;
  },

  /**
   * Get season type display information
   */
  getSeasonTypeInfo: () => {
    const { seasonData } = get();

    if (seasonData?.status === 'live-season') {
      return {
        label: 'Live Season',
        color: 'text-red-500',
        bgColor: 'bg-red-500/20',
        description: 'Follow real DCI scores as they happen!',
      };
    }

    return {
      label: 'Off-Season',
      color: 'text-gold-500',
      bgColor: 'bg-gold-500/20',
      description: 'Fantasy competition with historical data',
    };
  },

  /**
   * Format season name for display
   */
  formatSeasonName: () => {
    const { seasonData } = get();
    return formatSeasonName(seasonData?.name);
  },
}));

export default useSeasonStore;
