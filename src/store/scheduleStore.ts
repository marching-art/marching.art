import { create } from 'zustand';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../api';
import {
  groupShowsByWeek,
  groupShowsByDay,
  getShowsForWeek,
  getShowsForDay,
  getShowCountsByWeek,
} from '../utils/scheduleUtils';

/**
 * A single competition entry from the `schedules/{seasonUid}` document. The raw
 * Firestore shape carries many fields; the schedule utilities consume it
 * structurally, so it is modeled here as an open record.
 */
export type Competition = Record<string, unknown>;

interface ScheduleState {
  // Raw competitions array from Firestore
  competitions: Competition[];

  // Pre-computed derived data
  showsByWeek: Record<number, Competition[]>;
  showsByDay: Competition[][];
  showCountsByWeek: Record<number, number>;

  // Loading/error state
  loading: boolean;
  error: string | null;

  // Current seasonUid being listened to
  _currentSeasonUid: string | null;

  // Unsubscribe function for cleanup
  _unsubscribe: (() => void) | null;

  initScheduleListener: (seasonUid: string | null | undefined) => void;
  cleanup: () => void;
  getWeekShows: (weekNumber: number, options?: { skipChampionship?: boolean }) => Competition[];
  getDayShows: (dayNumber: number) => Competition[];
  getWeekShowCount: (weekNumber: number) => number;
  getWeeksWithShows: () => number[];
  hasScheduleData: () => boolean;
}

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
export const useScheduleStore = create<ScheduleState>()((set, get) => ({
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
          const competitions: Competition[] = data.competitions || [];

          // Pre-compute derived data. The schedule utilities are untyped JS
          // (loose `@returns {Object}`/`{Array}` JSDoc), so assert their known
          // shapes at this boundary.
          const showsByWeek = groupShowsByWeek(competitions) as Record<number, Competition[]>;
          const showsByDay = groupShowsByDay(competitions) as Competition[][];
          const showCountsByWeek = getShowCountsByWeek(competitions) as Record<number, number>;

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
   */
  getWeekShows: (weekNumber, options = {}) => {
    const { competitions } = get();
    // getShowsForWeek reads options.skipChampionship (falsy when absent), so a
    // partial options object is safe; its JSDoc types the field as required.
    return getShowsForWeek(competitions, weekNumber, options as { skipChampionship: boolean });
  },

  /**
   * Get shows for a specific day
   */
  getDayShows: (dayNumber) => {
    const { competitions } = get();
    return getShowsForDay(competitions, dayNumber);
  },

  /**
   * Get show count for a specific week
   */
  getWeekShowCount: (weekNumber) => {
    const { showCountsByWeek } = get();
    return showCountsByWeek[weekNumber] || 0;
  },

  /**
   * Get all weeks that have shows
   */
  getWeeksWithShows: () => {
    const { showsByWeek } = get();
    return Object.keys(showsByWeek)
      .map(Number)
      .sort((a, b) => a - b);
  },

  /**
   * Check if schedule data is available
   */
  hasScheduleData: () => {
    const { competitions } = get();
    return competitions.length > 0;
  },
}));

export default useScheduleStore;
