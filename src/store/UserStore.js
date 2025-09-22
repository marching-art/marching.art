// userStore.js - Enhanced User State Management with Zustand
// Optimized for performance and scalability

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db, firebaseUtils } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

// Enhanced user store with comprehensive state management
export const useUserStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ===============================
        // STATE
        // ===============================
        
        // Auth state
        user: null,
        isLoadingAuth: true,
        isAuthenticated: false,
        
        // Profile data
        loggedInProfile: null,
        userStats: null,
        userAchievements: [],
        userNotifications: [],
        
        // UI state
        theme: 'auto',
        sidebarCollapsed: false,
        selectedCorpsClass: 'aClass',
        
        // Cache and performance
        lastFetchTime: null,
        cacheExpirationTime: 5 * 60 * 1000, // 5 minutes
        
        // Error handling
        lastError: null,
        retryCount: 0,
        maxRetries: 3,

        // ===============================
        // ACTIONS
        // ===============================

        // Initialize authentication listener
        initializeAuth: () => {
          const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
              set({ 
                user, 
                isAuthenticated: !!user,
                isLoadingAuth: false 
              });

              if (user) {
                // Initialize user data subscriptions
                get().initializeUserData(user.uid);
                
                // Track login analytics
                firebaseUtils.logEvent('login', {
                  method: 'firebase_auth',
                  user_id: user.uid
                });
              } else {
                // Clear user data on logout
                get().clearUserData();
              }
            } catch (error) {
              console.error('Auth state change error:', error);
              set({ 
                lastError: error.message,
                isLoadingAuth: false 
              });
            }
          });

          // Store unsubscribe function for cleanup
          set({ authUnsubscribe: unsubscribe });
        },

        // Initialize user data subscriptions
        initializeUserData: (userId) => {
          const { setupProfileListener, setupStatsListener, setupAchievementsListener, setupNotificationsListener } = get();
          
          // Set up real-time listeners
          setupProfileListener(userId);
          setupStatsListener(userId);
          setupAchievementsListener(userId);
          setupNotificationsListener(userId);
        },

        // Profile data listener
        setupProfileListener: (userId) => {
          try {
            const profileRef = doc(db, `artifacts/prod/users/${userId}/profile/data`);
            const unsubscribe = onSnapshot(profileRef, (doc) => {
              if (doc.exists()) {
                const profileData = { id: doc.id, ...doc.data() };
                set({ 
                  loggedInProfile: profileData,
                  lastFetchTime: Date.now()
                });
              }
            }, (error) => {
              console.error('Profile listener error:', error);
              get().handleError(error, 'profile_listener');
            });

            // Store unsubscribe function
            set(state => ({
              profileUnsubscribe: unsubscribe
            }));
          } catch (error) {
            get().handleError(error, 'setup_profile_listener');
          }
        },

        // User stats listener
        setupStatsListener: (userId) => {
          try {
            const statsRef = doc(db, `artifacts/prod/users/${userId}/stats/data`);
            const unsubscribe = onSnapshot(statsRef, (doc) => {
              if (doc.exists()) {
                const statsData = { id: doc.id, ...doc.data() };
                set({ userStats: statsData });
                
                // Check for level ups or class unlocks
                get().checkProgressNotifications(statsData);
              }
            }, (error) => {
              console.error('Stats listener error:', error);
              get().handleError(error, 'stats_listener');
            });

            set(state => ({
              statsUnsubscribe: unsubscribe
            }));
          } catch (error) {
            get().handleError(error, 'setup_stats_listener');
          }
        },

        // User achievements listener
        setupAchievementsListener: (userId) => {
          try {
            const achievementsRef = collection(db, `artifacts/prod/users/${userId}/achievements`);
            const achievementsQuery = query(achievementsRef, orderBy('unlockedAt', 'desc'));
            
            const unsubscribe = onSnapshot(achievementsQuery, (snapshot) => {
              const achievements = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              
              set({ userAchievements: achievements });
              
              // Show toast for new achievements
              get().checkNewAchievements(achievements);
            }, (error) => {
              console.error('Achievements listener error:', error);
              get().handleError(error, 'achievements_listener');
            });

            set(state => ({
              achievementsUnsubscribe: unsubscribe
            }));
          } catch (error) {
            get().handleError(error, 'setup_achievements_listener');
          }
        },

        // User notifications listener
        setupNotificationsListener: (userId) => {
          try {
            const notificationsRef = collection(db, `artifacts/prod/users/${userId}/notifications`);
            const notificationsQuery = query(
              notificationsRef, 
              where('read', '==', false),
              orderBy('createdAt', 'desc'),
              limit(20)
            );
            
            const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
              const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              
              set({ userNotifications: notifications });
            }, (error) => {
              console.error('Notifications listener error:', error);
              get().handleError(error, 'notifications_listener');
            });

            set(state => ({
              notificationsUnsubscribe: unsubscribe
            }));
          } catch (error) {
            get().handleError(error, 'setup_notifications_listener');
          }
        },

        // Check for progress notifications (level ups, class unlocks)
        checkProgressNotifications: (newStats) => {
          const { userStats: oldStats } = get();
          
          if (!oldStats) return;
          
          // Check for level up
          if (newStats.level > oldStats.level) {
            toast.success(`🎉 Congratulations! You've reached level ${newStats.level}!`, {
              duration: 6000,
              icon: '🏆'
            });
            
            firebaseUtils.logEvent('level_up', {
              new_level: newStats.level,
              total_xp: newStats.totalXP
            });
          }
          
          // Check for class unlocks
          const newClasses = newStats.unlockedClasses?.filter(
            cls => !oldStats.unlockedClasses?.includes(cls)
          ) || [];
          
          newClasses.forEach(corpsClass => {
            const classNames = {
              aClass: 'A Class',
              openClass: 'Open Class',
              worldClass: 'World Class'
            };
            
            toast.success(`🎺 ${classNames[corpsClass]} unlocked! Create a new corps to compete!`, {
              duration: 8000,
              icon: '🔓'
            });
            
            firebaseUtils.logEvent('class_unlock', {
              corps_class: corpsClass,
              user_level: newStats.level
            });
          });
        },

        // Check for new achievements
        checkNewAchievements: (achievements) => {
          const { userAchievements: oldAchievements } = get();
          
          if (!oldAchievements || oldAchievements.length === 0) return;
          
          const newAchievements = achievements.filter(
            achievement => !oldAchievements.some(old => old.id === achievement.id)
          );
          
          newAchievements.forEach(achievement => {
            toast.success(`🏅 Achievement unlocked: ${achievement.name}!`, {
              duration: 6000,
              icon: '🎖️'
            });
            
            firebaseUtils.logEvent('achievement_unlock', {
              achievement_id: achievement.id,
              achievement_name: achievement.name
            });
          });
        },

        // Clear all user data
        clearUserData: () => {
          const { 
            profileUnsubscribe, 
            statsUnsubscribe, 
            achievementsUnsubscribe, 
            notificationsUnsubscribe 
          } = get();
          
          // Unsubscribe from all listeners
          [profileUnsubscribe, statsUnsubscribe, achievementsUnsubscribe, notificationsUnsubscribe]
            .filter(Boolean)
            .forEach(unsubscribe => unsubscribe());
          
          set({
            loggedInProfile: null,
            userStats: null,
            userAchievements: [],
            userNotifications: [],
            profileUnsubscribe: null,
            statsUnsubscribe: null,
            achievementsUnsubscribe: null,
            notificationsUnsubscribe: null,
            lastFetchTime: null,
            lastError: null,
            retryCount: 0
          });
        },

        // Enhanced error handling with retry logic
        handleError: (error, context) => {
          const { retryCount, maxRetries } = get();
          
          console.error(`Error in ${context}:`, error);
          
          set({ 
            lastError: {
              message: error.message,
              context,
              timestamp: Date.now()
            }
          });
          
          // Retry logic for network errors
          if (retryCount < maxRetries && 
              (error.code === 'unavailable' || error.code === 'deadline-exceeded')) {
            setTimeout(() => {
              set(state => ({ retryCount: state.retryCount + 1 }));
              
              // Retry the operation based on context
              if (context.includes('listener') && get().user) {
                get().initializeUserData(get().user.uid);
              }
            }, Math.pow(2, retryCount) * 1000); // Exponential backoff
          }
          
          // Show user-friendly error message
          const userMessage = firebaseUtils.handleFirebaseError(error);
          if (retryCount >= maxRetries) {
            toast.error(userMessage, {
              duration: 8000,
              icon: '⚠️'
            });
          }
        },

        // ===============================
        // CALLABLE FUNCTIONS
        // ===============================

        // Create user profile
        createProfile: async (profileData) => {
          try {
            const functions = getFunctions();
            const createUserProfile = httpsCallable(functions, 'createUserProfile');
            
            const result = await createUserProfile(profileData);
            
            if (result.data.success) {
              toast.success(result.data.message, {
                icon: '🎉'
              });
              
              // Profile will be updated automatically via listener
              return { success: true, data: result.data };
            }
            
            throw new Error(result.data.message || 'Profile creation failed');
          } catch (error) {
            get().handleError(error, 'create_profile');
            throw error;
          }
        },

        // Award XP to user
        awardXP: async (amount, reason) => {
          try {
            const functions = getFunctions();
            const awardXP = httpsCallable(functions, 'awardXP');
            
            const result = await awardXP({ amount, reason });
            
            if (result.data.success) {
              // Stats will be updated automatically via listener
              return { success: true, data: result.data };
            }
            
            throw new Error(result.data.message || 'XP award failed');
          } catch (error) {
            get().handleError(error, 'award_xp');
            throw error;
          }
        },

        // Check username availability
        checkUsername: async (username) => {
          try {
            const functions = getFunctions();
            const checkUsername = httpsCallable(functions, 'checkUsername');
            
            const result = await checkUsername({ username });
            return { success: true, available: result.data.success };
          } catch (error) {
            if (error.code === 'already-exists') {
              return { success: false, available: false, message: error.message };
            }
            get().handleError(error, 'check_username');
            throw error;
          }
        },

        // ===============================
        // UI ACTIONS
        // ===============================

        // Set theme
        setTheme: (theme) => {
          set({ theme });
          
          // Apply theme to document
          const root = document.documentElement;
          if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        },

        // Toggle sidebar
        toggleSidebar: () => {
          set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
        },

        // Set selected corps class
        setSelectedCorpsClass: (corpsClass) => {
          set({ selectedCorpsClass: corpsClass });
        },

        // Clear error
        clearError: () => {
          set({ lastError: null, retryCount: 0 });
        },

        // ===============================
        // COMPUTED VALUES
        // ===============================

        // Get user's current level progress
        getLevelProgress: () => {
          const { userStats } = get();
          if (!userStats) return { current: 0, required: 1000, percentage: 0 };
          
          const currentLevelXP = userStats.totalXP % 1000;
          const requiredXP = 1000;
          const percentage = (currentLevelXP / requiredXP) * 100;
          
          return {
            current: currentLevelXP,
            required: requiredXP,
            percentage: Math.min(percentage, 100)
          };
        },

        // Get user's unlocked classes
        getUnlockedClasses: () => {
          const { userStats } = get();
          return userStats?.unlockedClasses || ['aClass'];
        },

        // Check if user can access a specific class
        canAccessClass: (corpsClass) => {
          const unlockedClasses = get().getUnlockedClasses();
          return unlockedClasses.includes(corpsClass);
        },

        // Get user's rank/tier
        getUserTier: () => {
          const { userStats } = get();
          if (!userStats) return 'Rookie';
          
          const level = userStats.level || 1;
          if (level >= 25) return 'Legend';
          if (level >= 20) return 'Master';
          if (level >= 15) return 'Expert';
          if (level >= 10) return 'Advanced';
          if (level >= 5) return 'Intermediate';
          return 'Rookie';
        },

        // ===============================
        // CLEANUP
        // ===============================

        // Cleanup function for unmounting
        cleanup: () => {
          const { 
            authUnsubscribe,
            profileUnsubscribe, 
            statsUnsubscribe, 
            achievementsUnsubscribe, 
            notificationsUnsubscribe 
          } = get();
          
          // Unsubscribe from all listeners
          [authUnsubscribe, profileUnsubscribe, statsUnsubscribe, achievementsUnsubscribe, notificationsUnsubscribe]
            .filter(Boolean)
            .forEach(unsubscribe => unsubscribe());
        }
      }),
      {
        name: 'fantasy-drum-corps-user',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          selectedCorpsClass: state.selectedCorpsClass,
          // Don't persist sensitive data
        }),
      }
    )
  )
);

// Initialize auth on store creation
useUserStore.getState().initializeAuth();

// Auto-apply theme on load
const currentTheme = useUserStore.getState().theme;
useUserStore.getState().setTheme(currentTheme);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { theme, setTheme } = useUserStore.getState();
    if (theme === 'auto') {
      setTheme('auto'); // Re-apply auto theme
    }
  });
}

export default useUserStore;