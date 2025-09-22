// context/AuthContext.js - Enhanced Authentication Context
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db, dataNamespace, firebaseUtils } from '../firebase';
import toast from 'react-hot-toast';

// Create AuthContext
const AuthContext = createContext({});

// Enhanced user profile structure
const createUserProfile = (user, additionalData = {}) => ({
  userId: user.uid,
  email: user.email,
  displayName: additionalData.displayName || user.displayName || '',
  username: additionalData.username || '',
  bio: additionalData.bio || '',
  location: additionalData.location || '',
  favoriteCorps: additionalData.favoriteCorps || [],
  profileImage: user.photoURL || '',
  
  // Game-specific data
  experience: 0,
  level: 1,
  totalPoints: 0,
  gamesPlayed: 0,
  achievements: [],
  unlockedClasses: ['aClass'], // Start with A Class unlocked
  
  // Corps data structure
  corps: {
    aClass: null,
    openClass: null,
    worldClass: null
  },
  
  // Enhanced preferences
  preferences: {
    theme: 'auto',
    notifications: {
      email: true,
      push: true,
      scores: true,
      trades: true,
      achievements: true,
      leagues: true
    },
    privacy: {
      profileVisible: true,
      statsVisible: true,
      corpsVisible: true
    },
    accessibility: {
      reduceMotion: false,
      highContrast: false,
      fontSize: 'medium'
    }
  },
  
  // Social features
  isPublic: true,
  friends: [],
  blockedUsers: [],
  
  // Timestamps
  createdAt: serverTimestamp(),
  lastActive: serverTimestamp(),
  lastLogin: serverTimestamp(),
  
  // Administrative
  isAdmin: false,
  isModerator: false,
  isPremium: false,
  premiumExpiry: null,
  
  // Onboarding
  hasCompletedOnboarding: false,
  onboardingStep: 0,
  
  // Statistics
  stats: {
    loginStreak: 0,
    longestStreak: 0,
    totalPlayTime: 0,
    favoritePage: '',
    lastSeasonParticipated: null
  },

  // Additional metadata
  ...additionalData
});

// Enhanced AuthProvider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track authentication state
  useEffect(() => {
    setIsLoadingAuth(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          
          // Fetch or create user profile
          const profile = await fetchOrCreateUserProfile(firebaseUser);
          setUserProfile(profile);
          
          // Update last login
          await updateLastLogin(firebaseUser.uid);
          
          // Track login event
          firebaseUtils.trackEvent('user_login', {
            user_id: firebaseUser.uid,
            login_method: 'email'
          });
          
          setAuthError(null);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setAuthError(firebaseUtils.handleFirebaseError(error, 'auth state change'));
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return unsubscribe;
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch or create user profile
  const fetchOrCreateUserProfile = async (firebaseUser) => {
    try {
      const profileRef = doc(db, `artifacts/${dataNamespace}/users/${firebaseUser.uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const existingProfile = profileSnap.data();
        
        // Update profile with any missing fields from new structure
        const updatedProfile = {
          ...createUserProfile(firebaseUser),
          ...existingProfile,
          lastLogin: serverTimestamp()
        };
        
        // Save updated profile
        await updateDoc(profileRef, {
          lastLogin: serverTimestamp(),
          // Only update missing fields, don't overwrite existing data
          ...Object.fromEntries(
            Object.entries(updatedProfile).filter(([key]) => 
              !existingProfile.hasOwnProperty(key)
            )
          )
        });
        
        return updatedProfile;
      } else {
        // Create new user profile
        const newProfile = createUserProfile(firebaseUser);
        await setDoc(profileRef, newProfile);
        
        // Track new user registration
        firebaseUtils.trackEvent('user_registration', {
          user_id: firebaseUser.uid,
          registration_method: 'email'
        });
        
        return newProfile;
      }
    } catch (error) {
      console.error('Error fetching/creating user profile:', error);
      throw new Error(firebaseUtils.handleFirebaseError(error, 'profile creation'));
    }
  };

  // Update last login timestamp
  const updateLastLogin = async (uid) => {
    try {
      const profileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      await updateDoc(profileRef, {
        lastLogin: serverTimestamp(),
        lastActive: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  // Enhanced sign up function
  const signUp = useCallback(async (email, password, additionalData = {}) => {
    try {
      setAuthError(null);
      
      // Check if username is taken (if provided)
      if (additionalData.username) {
        const isUsernameTaken = await checkUsernameAvailability(additionalData.username);
        if (isUsernameTaken) {
          throw new Error('Username is already taken');
        }
      }
      
      // Create user account
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (additionalData.displayName) {
        await updateProfile(firebaseUser, {
          displayName: additionalData.displayName
        });
      }
      
      // Create user profile with additional data
      const profile = await fetchOrCreateUserProfile(firebaseUser, additionalData);
      setUserProfile(profile);
      
      // Reserve username if provided
      if (additionalData.username) {
        await reserveUsername(additionalData.username, firebaseUser.uid);
      }
      
      toast.success('Account created successfully!');
      return firebaseUser;
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'sign up');
      setAuthError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Enhanced sign in function
  const signIn = useCallback(async (email, password) => {
    try {
      setAuthError(null);
      
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
      
      // Update login streak
      await updateLoginStreak(firebaseUser.uid);
      
      toast.success('Welcome back!');
      return firebaseUser;
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'sign in');
      setAuthError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Enhanced logout function
  const logout = useCallback(async () => {
    try {
      // Track logout event
      if (user) {
        firebaseUtils.trackEvent('user_logout', {
          user_id: user.uid,
          session_duration: Date.now() - (userProfile?.lastLogin?.toMillis() || 0)
        });
      }
      
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setAuthError(null);
      
      toast.success('Signed out successfully');
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'logout');
      toast.error(errorMessage);
      throw error;
    }
  }, [user, userProfile]);

  // Password reset function
  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent');
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'password reset');
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Update user profile
  const updateUserProfile = useCallback(async (updates) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
      const updateData = {
        ...updates,
        lastActive: serverTimestamp()
      };
      
      await updateDoc(profileRef, updateData);
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        ...updates
      }));
      
      toast.success('Profile updated successfully');
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'profile update');
      toast.error(errorMessage);
      throw error;
    }
  }, [user]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      toast.success('Password updated successfully');
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'password change');
      toast.error(errorMessage);
      throw error;
    }
  }, [user]);

  // Delete account
  const deleteAccount = useCallback(async (password) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      // Delete user data (implement as needed)
      // await deleteUserData(user.uid);
      
      // Delete user account
      await deleteUser(user);
      
      setUser(null);
      setUserProfile(null);
      
      toast.success('Account deleted successfully');
      
    } catch (error) {
      const errorMessage = firebaseUtils.handleFirebaseError(error, 'account deletion');
      toast.error(errorMessage);
      throw error;
    }
  }, [user]);

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    try {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      const usernameSnap = await getDoc(usernameRef);
      return usernameSnap.exists();
    } catch (error) {
      console.error('Error checking username:', error);
      return true; // Assume taken on error
    }
  };

  // Reserve username
  const reserveUsername = async (username, uid) => {
    try {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      await setDoc(usernameRef, {
        uid,
        username,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error reserving username:', error);
    }
  };

  // Update login streak
  const updateLoginStreak = async (uid) => {
    try {
      const profileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        const lastLogin = profile.lastLogin?.toDate();
        const now = new Date();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        let newStreak = 1;
        
        if (lastLogin) {
          const daysSinceLastLogin = Math.floor((now - lastLogin) / oneDayMs);
          
          if (daysSinceLastLogin === 1) {
            // Consecutive day
            newStreak = (profile.stats?.loginStreak || 0) + 1;
          } else if (daysSinceLastLogin === 0) {
            // Same day
            newStreak = profile.stats?.loginStreak || 1;
          }
          // daysSinceLastLogin > 1 means streak is broken, reset to 1
        }
        
        const longestStreak = Math.max(
          newStreak, 
          profile.stats?.longestStreak || 0
        );
        
        await updateDoc(profileRef, {
          'stats.loginStreak': newStreak,
          'stats.longestStreak': longestStreak
        });
      }
    } catch (error) {
      console.error('Error updating login streak:', error);
    }
  };

  // Refresh user profile
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const profile = await fetchOrCreateUserProfile(user);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  }, [user]);

  const contextValue = {
    // User state
    user,
    userProfile,
    isLoadingAuth,
    authError,
    isOnline,
    
    // Authentication functions
    signUp,
    signIn,
    logout,
    resetPassword,
    
    // Profile management
    updateUserProfile,
    refreshProfile,
    
    // Account management
    changePassword,
    deleteAccount,
    
    // Utility functions
    checkUsernameAvailability,
    
    // Computed properties
    isAuthenticated: !!user,
    isProfileComplete: !!(userProfile?.displayName && userProfile?.hasCompletedOnboarding)
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Export context for advanced usage
export { AuthContext };