// src/store/userStore.js - Complete User State Management with Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const useUserStore = create(
  persist(
    (set, get) => ({
      // User state
      user: null,
      profile: null,
      isAdmin: false,
      loading: false,
      
      // Game state
      level: 1,
      experience: 0,
      totalScore: 0,
      currentLineup: null,
      achievements: [],
      tradingHistory: [],
      
      // UI state
      theme: 'light',
      notifications: true,
      sidebarOpen: false,
      
      // Initialize user data
      initializeUser: async (firebaseUser) => {
        try {
          set({ loading: true });
          
          // Check if user is admin (hardcoded UID or custom claims)
          const isAdmin = firebaseUser.uid === 'o8vfRCOevjTKBY0k2dISlpiYiIH2' || 
                          (firebaseUser.customClaims && firebaseUser.customClaims.admin);
          
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let profileData = null;
          
          if (userDoc.exists()) {
            profileData = userDoc.data();
          } else {
            // Create new user profile
            profileData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              createdAt: new Date(),
              isAdmin,
              level: 1,
              experience: 0,
              totalScore: 0,
              achievements: [],
              settings: {
                notifications: true,
                theme: 'light'
              }
            };
            
            await setDoc(doc(db, 'users', firebaseUser.uid), profileData);
          }
          
          set({
            user: firebaseUser,
            profile: profileData,
            isAdmin,
            level: profileData.level || 1,
            experience: profileData.experience || 0,
            totalScore: profileData.totalScore || 0,
            achievements: profileData.achievements || [],
            theme: profileData.settings?.theme || 'light',
            notifications: profileData.settings?.notifications || true,
            loading: false
          });
          
        } catch (error) {
          console.error('Error initializing user:', error);
          toast.error('Failed to load user data');
          set({ loading: false });
        }
      },
      
      // Clear user data on logout
      clearUser: () => {
        set({
          user: null,
          profile: null,
          isAdmin: false,
          level: 1,
          experience: 0,
          totalScore: 0,
          currentLineup: null,
          achievements: [],
          tradingHistory: []
        });
      },
      
      // Update user profile
      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) return;
        
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            ...updates,
            updatedAt: new Date()
          });
          
          set(state => ({
            profile: { ...state.profile, ...updates }
          }));
          
          toast.success('Profile updated successfully');
        } catch (error) {
          console.error('Error updating profile:', error);
          toast.error('Failed to update profile');
        }
      },
      
      // Award experience points
      awardXP: async (amount, reason = '') => {
        const { user, experience, level } = get();
        if (!user) return;
        
        try {
          const newXP = experience + amount;
          const newLevel = calculateLevel(newXP);
          
          await updateDoc(doc(db, 'users', user.uid), {
            experience: newXP,
            level: newLevel,
            lastXPAward: new Date()
          });
          
          set({ experience: newXP, level: newLevel });
          
          if (newLevel > level) {
            toast.success(`Level up! You're now level ${newLevel}`);
          } else if (amount > 0) {
            toast.success(`+${amount} XP${reason ? ` for ${reason}` : ''}`);
          }
          
        } catch (error) {
          console.error('Error awarding XP:', error);
        }
      },
      
      // Update total score
      updateScore: async (score) => {
        const { user } = get();
        if (!user) return;
        
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            totalScore: score,
            lastScoreUpdate: new Date()
          });
          
          set({ totalScore: score });
          
        } catch (error) {
          console.error('Error updating score:', error);
        }
      },
      
      // Add achievement
      addAchievement: async (achievementId) => {
        const { user, achievements } = get();
        if (!user || achievements.includes(achievementId)) return;
        
        try {
          const newAchievements = [...achievements, achievementId];
          
          await updateDoc(doc(db, 'users', user.uid), {
            achievements: newAchievements,
            lastAchievement: new Date()
          });
          
          set({ achievements: newAchievements });
          toast.success('Achievement unlocked!');
          
        } catch (error) {
          console.error('Error adding achievement:', error);
        }
      },
      
      // Set current lineup
      setCurrentLineup: (lineup) => {
        set({ currentLineup: lineup });
      },
      
      // Update settings
      updateSettings: async (settings) => {
        const { user } = get();
        if (!user) return;
        
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            'settings': settings,
            updatedAt: new Date()
          });
          
          set(state => ({
            profile: {
              ...state.profile,
              settings: { ...state.profile.settings, ...settings }
            },
            theme: settings.theme || state.theme,
            notifications: settings.notifications !== undefined ? settings.notifications : state.notifications
          }));
          
        } catch (error) {
          console.error('Error updating settings:', error);
          toast.error('Failed to update settings');
        }
      },
      
      // Toggle theme
      toggleTheme: () => {
        const { theme } = get();
        const newTheme = theme === 'light' ? 'dark' : 'light';
        
        get().updateSettings({ theme: newTheme });
        set({ theme: newTheme });
      },
      
      // Toggle sidebar
      toggleSidebar: () => {
        set(state => ({ sidebarOpen: !state.sidebarOpen }));
      },
      
      // Update last active timestamp
      updateLastActive: async () => {
        const { user } = get();
        if (!user) return;
        
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            lastActive: new Date()
          });
        } catch (error) {
          console.error('Error updating last active:', error);
        }
      },
      
      // Check achievements based on user actions
      checkAchievements: async (action, data = {}) => {
        const { user, level, totalScore, experience } = get();
        if (!user) return;
        
        const achievementsToAward = [];
        
        // Define achievement conditions
        const achievementConditions = {
          firstLogin: () => action === 'login',
          levelUp5: () => level >= 5,
          levelUp10: () => level >= 10,
          score1000: () => totalScore >= 1000,
          score5000: () => totalScore >= 5000,
          experience1000: () => experience >= 1000,
          firstLineup: () => action === 'createLineup',
          firstTrade: () => action === 'completeTrade'
        };
        
        // Check each condition
        for (const [achievementId, condition] of Object.entries(achievementConditions)) {
          if (condition() && !get().achievements.includes(achievementId)) {
            achievementsToAward.push(achievementId);
          }
        }
        
        // Award achievements
        for (const achievementId of achievementsToAward) {
          await get().addAchievement(achievementId);
        }
      }
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        notifications: state.notifications,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
);

// Helper function to calculate level from experience
function calculateLevel(experience) {
  if (experience < 100) return 1;
  if (experience < 300) return 2;
  if (experience < 600) return 3;
  if (experience < 1000) return 4;
  if (experience < 1500) return 5;
  if (experience < 2500) return 6;
  if (experience < 4000) return 7;
  if (experience < 6000) return 8;
  if (experience < 9000) return 9;
  if (experience < 13000) return 10;
  
  // Level 10+: 5000 XP per level
  return Math.floor((experience - 13000) / 5000) + 11;
}

export { useUserStore };