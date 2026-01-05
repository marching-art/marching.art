import { create } from 'zustand';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  groupShowsByWeek,
  groupShowsByDay,
  getShowsForWeek,
  getShowsForDay,
  getShowCountsByWeek,
} from '../utils/scheduleUtils';

/**
 * Global Schedule Store
 *
 * This store maintains a SINGLE Firestore listener for schedule data,
 * preventing duplicate reads across components that need schedule info.
 *
 * The listener is tied to the current seasonUid - when the season changes,
 * the schedule listener is automatically updated.
 *
 * Components should use this store instead of creating their own fetches.
 */
export const useScheduleStore = create((set, get) => ({
  // Raw competitions array from Firestore
  competitions: [],

  // Pre-computed derived data
  showsByWeek: {},
  showsByDay: [],
  showCountsByWeek: {},

  // Loading/error state
  loading: true,
  error: null,

  // Current seasonUid being listened to
  _currentSeasonUid: null,

  // Unsubscribe function for cleanup
  _unsubscribe: null,

  /**
   * Initialize or update the schedule listener for a given seasonUid
   * Should be called when seasonUid changes (typically from seasonStore)
   * @param {string} seasonUid - The season to listen to
   */
  initScheduleListener: (seasonUid) => {
    const { _currentSeasonUid, _unsubscribe } = get();

    // If already listening to this season, skip
    if (_currentSeasonUid === seasonUid && _unsubscribe) {
      return;
    }

    // Cleanup existing listener
    if (_unsubscribe) {
      _unsubscribe();
    }

    // If no seasonUid, reset state
    if (!seasonUid) {
      set({
        competitions: [],
        showsByWeek: {},
        showsByDay: [],
        showCountsByWeek: {},
        loading: false,
        error: null,
        _currentSeasonUid: null,
        _unsubscribe: null,
      });
      return;
    }

    set({ loading: true, _currentSeasonUid: seasonUid });

    const scheduleRef = doc(db, `schedules/${seasonUid}`);

    const unsubscribe = onSnapshot(
      scheduleRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const competitions = data.competitions || [];

          // Pre-compute derived data
          const showsByWeek = groupShowsByWeek(competitions);
          const showsByDay = groupShowsByDay(competitions);
          const showCountsByWeek = getShowCountsByWeek(competitions);

          set({
            competitions,
            showsByWeek,
            showsByDay,
            showCountsByWeek,
            loading: false,
            error: null,
          });
        } else {
          set({
            competitions: [],
            showsByWeek: {},
            showsByDay: [],
            showCountsByWeek: {},
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        console.error('Error fetching schedule data:', err);
        set({
          loading: false,
          error: err.message,
        });
      }
    );

    set({ _unsubscribe: unsubscribe });
  },

  /**
   * Cleanup the listener - call on app unmount
   */
  cleanup: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) {
      _unsubscribe();
      set({
        _unsubscribe: null,
        _currentSeasonUid: null,
      });
    }
  },

  /**
   * Get shows for a specific week
   * @param {number} weekNumber - Week number (1-7)
   * @param {Object} options - Filter options
   * @returns {Array} Shows for the week
   */
  getWeekShows: (weekNumber, options = {}) => {
    const { competitions } = get();
    return getShowsForWeek(competitions, weekNumber, options);
  },

  /**
   * Get shows for a specific day
   * @param {number} dayNumber - Day number (1-49)
   * @returns {Array} Shows for the day
   */
  getDayShows: (dayNumber) => {
    const { competitions } = get();
    return getShowsForDay(competitions, dayNumber);
  },

  /**
   * Get show count for a specific week
   * @param {number} weekNumber - Week number (1-7)
   * @returns {number} Number of shows
   */
  getWeekShowCount: (weekNumber) => {
    const { showCountsByWeek } = get();
    return showCountsByWeek[weekNumber] || 0;
  },

  /**
   * Get all weeks that have shows
   * @returns {Array} Array of week numbers
   */
  getWeeksWithShows: () => {
    const { showsByWeek } = get();
    return Object.keys(showsByWeek).map(Number).sort((a, b) => a - b);
  },

  /**
   * Check if schedule data is available
   * @returns {boolean}
   */
  hasScheduleData: () => {
    const { competitions } = get();
    return competitions.length > 0;
  },
}));

export default useScheduleStore;
