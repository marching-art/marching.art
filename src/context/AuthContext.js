// Enhanced AuthContext.js - Complete Authentication System for marching.art
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, storage, functions } from '../firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Firebase Functions
  const checkUsernameAvailability = httpsCallable(functions, 'checkUsername');
  const createUserProfileFunc = httpsCallable(functions, 'createUserProfile');
  const setUserRoleFunc = httpsCallable(functions, 'setUserRole');

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          await loadUserProfile(user.uid);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        toast.error('Authentication error occurred');
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  // Load user profile from Firestore
  const loadUserProfile = async (uid) => {
    try {
      const profileDoc = await getDoc(doc(db, `artifacts/prod/users/${uid}/profile/data`));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        setUserProfile(profileData);
        
        // Update last login time
        await updateDoc(doc(db, `artifacts/prod/users/${uid}/profile/data`), {
          lastLogin: serverTimestamp(),
          lastActive: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Check username availability
  const checkUsername = async (username) => {
    try {
      const result = await checkUsernameAvailability({ username: username.trim() });
      return result.data.success;
    } catch (error) {
      console.error('Username check error:', error);
      throw new Error(error.message || 'Failed to check username availability');
    }
  };

  // Sign up with email and password
  const signUp = async (email, password, username, additionalData = {}) => {
    try {
      setLoading(true);
      
      // Validate inputs
      if (!email || !password || !username) {
        throw new Error('Email, password, and username are required');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (username.length < 3 || username.length > 20) {
        throw new Error('Username must be between 3 and 20 characters');
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
      }

      // Check username availability
      await checkUsername(username);

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Send email verification
      await sendEmailVerification(user);
      toast.success('Verification email sent! Please check your inbox.');

      // Create user profile in Firestore
      await createUserProfileFunc({
        username: username.trim(),
        email: user.email,
        ...additionalData
      });

      // Load the newly created profile
      await loadUserProfile(user.uid);

      return user;
    } catch (error) {
      console.error('Sign up error:', error);
      
      // Handle specific Firebase errors
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Try signing in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.message?.includes('username')) {
        errorMessage = 'This username is already taken. Please choose another.';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setLoading(true);
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Try signing up instead.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Contact support for assistance.';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  // Send password reset email
  const resetPassword = async (email) => {
    try {
      if (!email) {
        throw new Error('Email is required');
      }
      
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Resend email verification
  const resendEmailVerification = async () => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }
      
      await sendEmailVerification(user);
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Email verification error:', error);
      throw new Error('Failed to send verification email');
    }
  };

  // Update user email
  const updateUserEmail = async (newEmail, currentPassword) => {
    try {
      if (!user || !newEmail || !currentPassword) {
        throw new Error('All fields are required');
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update email
      await updateEmail(user, newEmail.trim());
      
      // Send verification email for new address
      await sendEmailVerification(user);
      
      toast.success('Email updated! Please verify your new email address.');
    } catch (error) {
      console.error('Email update error:', error);
      
      let errorMessage = 'Failed to update email';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Update user password
  const updateUserPassword = async (currentPassword, newPassword) => {
    try {
      if (!user || !currentPassword || !newPassword) {
        throw new Error('All fields are required');
      }
      
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Password update error:', error);
      
      let errorMessage = 'Failed to update password';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect current password';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Upload avatar image
  const uploadAvatar = async (file) => {
    try {
      if (!user || !file) {
        throw new Error('User must be logged in and file is required');
      }
      
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Image must be smaller than 5MB');
      }
      
      // Create storage reference
      const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update user profile with new avatar URL
      await updateDoc(doc(db, `artifacts/prod/users/${user.uid}/profile/data`), {
        avatar: downloadURL,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        avatar: downloadURL
      }));
      
      toast.success('Avatar updated successfully');
      return downloadURL;
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  };

  // Delete avatar
  const deleteAvatar = async () => {
    try {
      if (!user || !userProfile?.avatar) {
        throw new Error('No avatar to delete');
      }
      
      // Delete from storage if it's a Firebase Storage URL
      if (userProfile.avatar.includes('firebase')) {
        try {
          const storageRef = ref(storage, userProfile.avatar);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn('Could not delete avatar from storage:', storageError);
        }
      }
      
      // Update user profile
      await updateDoc(doc(db, `artifacts/prod/users/${user.uid}/profile/data`), {
        avatar: null,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        avatar: null
      }));
      
      toast.success('Avatar removed successfully');
    } catch (error) {
      console.error('Avatar deletion error:', error);
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      if (!user) {
        throw new Error('User must be logged in');
      }
      
      // Sanitize and validate profile data
      const sanitizedData = {
        ...profileData,
        updatedAt: serverTimestamp()
      };
      
      // Remove undefined values
      Object.keys(sanitizedData).forEach(key => {
        if (sanitizedData[key] === undefined) {
          delete sanitizedData[key];
        }
      });
      
      await updateDoc(doc(db, `artifacts/prod/users/${user.uid}/profile/data`), sanitizedData);
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        ...sanitizedData
      }));
      
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  // Delete user account
  const deleteAccount = async (password) => {
    try {
      if (!user || !password) {
        throw new Error('Password is required to delete account');
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      const userId = user.uid;
      
      // Delete user data from Firestore
      try {
        await deleteDoc(doc(db, `artifacts/prod/users/${userId}/profile/data`));
        await deleteDoc(doc(db, `artifacts/prod/users/${userId}/private/data`));
        await deleteDoc(doc(db, `usernames/${userProfile?.username?.toLowerCase()}`));
      } catch (firestoreError) {
        console.error('Error deleting Firestore data:', firestoreError);
      }
      
      // Delete avatar from storage
      if (userProfile?.avatar?.includes('firebase')) {
        try {
          const storageRef = ref(storage, userProfile.avatar);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.error('Error deleting avatar:', storageError);
        }
      }
      
      // Delete Firebase Auth user
      await deleteUser(user);
      
      // Clear local state
      setUserProfile(null);
      
      toast.success('Account deleted successfully');
    } catch (error) {
      console.error('Account deletion error:', error);
      
      let errorMessage = 'Failed to delete account';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign in again before deleting your account';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Set user role (admin only)
  const setUserRole = async (email, makeAdmin) => {
    try {
      if (!user || !userProfile?.role || !['admin', 'super_admin'].includes(userProfile.role)) {
        throw new Error('Insufficient permissions');
      }
      
      const result = await setUserRoleFunc({ email, makeAdmin });
      toast.success(result.data.message);
    } catch (error) {
      console.error('Set user role error:', error);
      throw error;
    }
  };

  // Helper functions
  const isAdmin = () => {
    return userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  };

  const isSuperAdmin = () => {
    return userProfile?.role === 'super_admin';
  };

  const isEmailVerified = () => {
    return user?.emailVerified || false;
  };

  const value = {
    // State
    user,
    userProfile,
    loading,
    initializing,
    
    // Authentication methods
    signUp,
    signIn,
    logout,
    resetPassword,
    resendEmailVerification,
    
    // Profile methods
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    
    // Account management
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
    
    // Admin methods
    setUserRole,
    
    // Utility methods
    checkUsername,
    isAdmin,
    isSuperAdmin,
    isEmailVerified,
    loadUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};