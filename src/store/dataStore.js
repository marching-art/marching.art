import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, getDoc, getDocs, collection, query, limit, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebaseConfig';

// Cache duration in milliseconds
const CACHE_DURATION = {
  SEASON: 5 * 60 * 1000,      // 5 minutes - season data changes rarely
  SCHEDULE: 60 * 60 * 1000,   // 1 hour - schedules are static once created
  LEAGUES: 10 * 60 * 1000,    // 10 minutes - leagues don't change frequently
  RECAPS: 2 * 60 * 1000,      // 2 minutes - scores update daily at 2 AM
};

export const useDataStore = create(
  persist(
    (set, get) => ({
      // === SEASON DATA ===
      currentSeason: null,
      seasonTimestamp: null,
      
      fetchCurrentSeason: async () => {
        const state = get();
        const now = Date.now();
        
        // Return cached data if still valid
        if (state.currentSeason && state.seasonTimestamp && (now - state.seasonTimestamp) < CACHE_DURATION.SEASON) {
          console.log('Using cached season data');
          return state.currentSeason;
        }
        
        try {
          const seasonDoc = await getDoc(doc(db, 'game-settings/current'));
          if (seasonDoc.exists()) {
            const seasonData = seasonDoc.data();
            set({ 
              currentSeason: seasonData, 
              seasonTimestamp: now 
            });
            return seasonData;
          }
        } catch (error) {
          console.error('Error fetching season:', error);
        }
        return null;
      },
      
      // === SCHEDULE DATA ===
      schedules: {}, // keyed by seasonId
      scheduleTimestamps: {},
      
      fetchSchedule: async (seasonId) => {
        const state = get();
        const now = Date.now();
        
        // Return cached schedule if valid
        if (state.schedules[seasonId] && state.scheduleTimestamps[seasonId] && 
            (now - state.scheduleTimestamps[seasonId]) < CACHE_DURATION.SCHEDULE) {
          console.log('Using cached schedule for', seasonId);
          return state.schedules[seasonId];
        }
        
        try {
          const scheduleDoc = await getDoc(doc(db, 'schedules', seasonId));
          if (scheduleDoc.exists()) {
            const scheduleData = scheduleDoc.data();
            set({
              schedules: { ...state.schedules, [seasonId]: scheduleData },
              scheduleTimestamps: { ...state.scheduleTimestamps, [seasonId]: now }
            });
            return scheduleData;
          }
        } catch (error) {
          console.error('Error fetching schedule:', error);
        }
        return null;
      },
      
      // === SCORES/RECAPS DATA ===
      recaps: {}, // keyed by seasonId
      recapsTimestamps: {},
      
      fetchRecaps: async (seasonId) => {
        const state = get();
        const now = Date.now();
        
        // Return cached recaps if valid
        if (state.recaps[seasonId] && state.recapsTimestamps[seasonId] &&
            (now - state.recapsTimestamps[seasonId]) < CACHE_DURATION.RECAPS) {
          console.log('Using cached recaps for', seasonId);
          return state.recaps[seasonId];
        }
        
        try {
          const recapsDoc = await getDoc(doc(db, 'fantasy_recaps', seasonId));
          if (recapsDoc.exists()) {
            const recapsData = recapsDoc.data().recaps || [];
            set({
              recaps: { ...state.recaps, [seasonId]: recapsData },
              recapsTimestamps: { ...state.recapsTimestamps, [seasonId]: now }
            });
            return recapsData;
          }
        } catch (error) {
          console.error('Error fetching recaps:', error);
        }
        return [];
      },
      
      // === LEAGUES DATA (WITH PAGINATION) ===
      leagues: [],
      leaguesTimestamp: null,
      leaguesLastDoc: null,
      
      fetchLeagues: async (pageSize = 20, refresh = false) => {
        const state = get();
        const now = Date.now();
        
        // Return cached leagues if valid and not refreshing
        if (!refresh && state.leagues.length > 0 && state.leaguesTimestamp &&
            (now - state.leaguesTimestamp) < CACHE_DURATION.LEAGUES) {
          console.log('Using cached leagues');
          return state.leagues;
        }
        
        try {
          // CRITICAL: Add limit to prevent fetching all leagues
          const leaguesQuery = query(
            collection(db, 'leagues'),
            where('isPublic', '==', true),
            limit(pageSize)
          );
          
          const leaguesSnap = await getDocs(leaguesQuery);
          const leaguesData = leaguesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          set({
            leagues: leaguesData,
            leaguesTimestamp: now,
            leaguesLastDoc: leaguesSnap.docs[leaguesSnap.docs.length - 1]
          });
          
          return leaguesData;
        } catch (error) {
          console.error('Error fetching leagues:', error);
        }
        return [];
      },
      
      // Clear all cached data
      clearCache: () => {
        set({
          currentSeason: null,
          seasonTimestamp: null,
          schedules: {},
          scheduleTimestamps: {},
          recaps: {},
          recapsTimestamps: {},
          leagues: [],
          leaguesTimestamp: null
        });
      },
      
      // Clear specific cache
      clearSeasonCache: () => {
        set({ currentSeason: null, seasonTimestamp: null });
      },
      
      clearScheduleCache: (seasonId) => {
        const state = get();
        const newSchedules = { ...state.schedules };
        const newTimestamps = { ...state.scheduleTimestamps };
        delete newSchedules[seasonId];
        delete newTimestamps[seasonId];
        set({ schedules: newSchedules, scheduleTimestamps: newTimestamps });
      }
    }),
    {
      name: 'marching-art-data-cache',
      partialize: (state) => ({
        // Only persist non-timestamp data
        currentSeason: state.currentSeason,
        schedules: state.schedules,
        leagues: state.leagues.slice(0, 20) // Only cache first page of leagues
      })
    }
  )
);