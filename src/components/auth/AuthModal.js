import React, { useState } from 'react';
import { X } from 'lucide-react';
import { auth, db } from '../../firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        // Create new user profile
        await setDoc(profileRef, {
          displayName: user.displayName || 'Director',
          email: user.email,
          createdAt: serverTimestamp(),
          xp: 0,
          corpsCoin: 1000,
          hasCompletedSetup: false,
          unlockedClasses: ['SoundSport']
        });
      }

      toast.success('Welcome to marching.art!');
      onClose();
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        // Create user profile
        const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);
        await setDoc(profileRef, {
          displayName: 'Director',
          email: user.email,
          createdAt: serverTimestamp(),
          xp: 0,
          corpsCoin: 1000,
          hasCompletedSetup: false,
          unlockedClasses: ['SoundSport']
        });

        toast.success('Account created successfully!');
      }
      onClose();
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Solid backdrop - NO TRANSPARENCY */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      
      {/* Modal - SOLID BACKGROUND */}
      <div className="relative bg-surface dark:bg-surface-dark rounded-theme p-6 sm:p-8 w-full max-w-md shadow-2xl border-2 border-accent dark:border-accent-dark">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-theme hover:bg-accent dark:hover:bg-accent-dark transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            {isLogin ? 'Welcome Back!' : 'Join marching.art'}
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {isLogin ? 'Sign in to continue your journey' : 'Create your account to get started'}
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full mb-4 px-4 py-3 bg-white dark:bg-surface-dark border-2 border-accent dark:border-accent-dark rounded-theme font-semibold text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-accent dark:border-accent-dark"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            disabled={isLoading}
            className="text-primary dark:text-primary-dark hover:underline font-semibold"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;