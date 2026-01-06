import { create } from 'zustand';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { formatSeasonName } from '../utils/season';

/**
 * Get the current date string in Eastern Time (YYYY-MM-DD format)
 * Used to ensure day calculations are based on Eastern Time
 */
const getEasternDateString = (date) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

/**
 * Global Season Store
 *
 * This store maintains a SINGLE Firestore listener for season data,
 * preventing duplicate reads across components that need season info.
 *
 * Components should use this store instead of creating their own listeners.
 */
export const useSeasonStore = create((set, get) => ({
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
          const data = docSnapshot.data();

          // Calculate derived values
          let weeksRemaining = null;
          let currentWeek = 1;
          let currentDay = 1;

          if (data.schedule?.startDate) {
            const startDate = data.schedule.startDate.toDate();
            const now = new Date();

            // Calculate day difference using Eastern Time dates
            // This ensures the day changes at midnight Eastern, not local time
            const startDateET = getEasternDateString(startDate);
            const nowET = getEasternDateString(now);
            const startDateObj = new Date(startDateET + 'T00:00:00');
            const nowDateObj = new Date(nowET + 'T00:00:00');
            const diffInDays = Math.floor((nowDateObj - startDateObj) / (1000 * 60 * 60 * 24));

            currentDay = Math.max(1, Math.min(diffInDays + 1, 49));
            currentWeek = Math.max(1, Math.ceil(currentDay / 7));
          }

          if (data.schedule?.endDate) {
            const endDate = data.schedule.endDate.toDate();
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
            error: null
          });
        } else {
          set({
            seasonData: null,
            seasonUid: null,
            weeksRemaining: null,
            currentWeek: 1,
            currentDay: 1,
            loading: false,
            error: 'No active season found'
          });
        }
      },
      (err) => {
        console.error('Error fetching season data:', err);
        set({
          loading: false,
          error: err.message
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
   * @returns {Object} { currentDay, currentWeek }
   */
  getSeasonProgress: () => {
    const { currentDay, currentWeek } = get();
    return { currentDay, currentWeek };
  },

  /**
   * Check if a class registration is locked based on weeks remaining
   * @param {string} corpsClass - Class to check
   * @returns {boolean} True if registration is locked
   */
  isRegistrationLocked: (corpsClass) => {
    const { weeksRemaining } = get();
    if (weeksRemaining === null) return false;

    const locks = {
      world: 6,
      open: 5,
      aClass: 4,
      soundSport: 0
    };

    const lockWeeks = locks[corpsClass] || 0;
    return weeksRemaining < lockWeeks;
  },

  /**
   * Get season type display information
   * @returns {Object} Display info { label, color, bgColor, description }
   */
  getSeasonTypeInfo: () => {
    const { seasonData } = get();

    if (seasonData?.status === 'live-season') {
      return {
        label: 'Live Season',
        color: 'text-red-500',
        bgColor: 'bg-red-500/20',
        description: 'Follow real DCI scores as they happen!'
      };
    }

    return {
      label: 'Off-Season',
      color: 'text-gold-500',
      bgColor: 'bg-gold-500/20',
      description: 'Fantasy competition with historical data'
    };
  },

  /**
   * Format season name for display
   * @returns {string} Formatted season name
   */
  formatSeasonName: () => {
    const { seasonData } = get();
    return formatSeasonName(seasonData?.name);
  }
}));

export default useSeasonStore;
