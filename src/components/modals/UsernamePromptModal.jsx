// src/components/modals/UsernamePromptModal.jsx
// Modal to prompt existing users who don't have a username set

import React, { useState, useRef, useEffect } from 'react';
import { AtSign, Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useProfileStore } from '../../store/profileStore';
import { useAuth } from '../../App';
import { db, functions } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const UsernamePromptModal = () => {
  const { user } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const loading = useProfileStore((state) => state.loading);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, valid: null, message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const usernameCheckTimeout = useRef(null);

  // Determine if modal should show
  const shouldShow = !loading && profile && !profile.username && user && !dismissed;

  // Username validation function
  const validateUsername = async (usernameValue) => {
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    if (!usernameValue.trim()) {
      setUsernameStatus({ checking: false, valid: null, message: '' });
      return;
    }

    if (usernameValue.length < 3) {
      setUsernameStatus({ checking: false, valid: false, message: 'Username must be at least 3 characters' });
      return;
    }
    if (usernameValue.length > 15) {
      setUsernameStatus({ checking: false, valid: false, message: 'Username must be 15 characters or less' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(usernameValue)) {
      setUsernameStatus({ checking: false, valid: false, message: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    setUsernameStatus({ checking: true, valid: null, message: 'Checking availability...' });

    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const checkUsername = httpsCallable(functions, 'checkUsername');
        await checkUsername({ username: usernameValue });
        setUsernameStatus({ checking: false, valid: true, message: 'Username is available!' });
      } catch (error) {
        if (error.code === 'functions/already-exists') {
          setUsernameStatus({ checking: false, valid: false, message: 'This username is already taken' });
        } else if (error.code === 'functions/invalid-argument') {
          setUsernameStatus({ checking: false, valid: false, message: error.message });
        } else {
          setUsernameStatus({ checking: false, valid: false, message: 'Could not verify username' });
        }
      }
    }, 500);
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(value);
    validateUsername(value);
  };

  const handleSubmit = async () => {
    if (usernameStatus.valid !== true || !user) return;

    setSubmitting(true);
    try {
      const usernameRef = doc(db, `usernames/${username.toLowerCase()}`);

      // Update profile with username
      await updateProfile({ username: username.trim().toLowerCase() });

      // Reserve username in usernames collection
      await setDoc(usernameRef, { uid: user.uid });

      toast.success('Username set successfully!');
    } catch (error) {
      console.error('Error setting username:', error);
      toast.error('Failed to set username. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Allow escape to dismiss (but show reminder)
  useEscapeKey(() => {
    if (shouldShow) {
      handleDismiss();
      toast('You can set your username anytime in your profile settings.', { icon: 'ℹ️' });
    }
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  if (!shouldShow) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-prompt-title"
      >
        <div
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#333] bg-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-500/20">
                <AtSign className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h2 id="username-prompt-title" className="text-sm font-bold text-cream-100">
                  Choose Your Username
                </h2>
                <p className="text-xs text-cream-500">
                  This will be your unique identifier
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 text-gray-500 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-cream-300">
              Welcome back! We've added usernames to help identify players. Please choose a unique username for your account.
            </p>

            <div>
              <label className="block text-xs font-semibold text-cream-400 mb-2 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  className={`w-full px-4 py-3 bg-charcoal-900 border rounded-lg text-cream-100 placeholder-cream-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50 pr-10 ${
                    usernameStatus.valid === true ? 'border-green-500/50' :
                    usernameStatus.valid === false ? 'border-red-500/50' : 'border-charcoal-700'
                  }`}
                  placeholder="e.g., drumcorps_fan"
                  value={username}
                  onChange={handleUsernameChange}
                  maxLength={15}
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus.checking && (
                    <Loader2 className="w-5 h-5 text-cream-400 animate-spin" />
                  )}
                  {!usernameStatus.checking && usernameStatus.valid === true && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {!usernameStatus.checking && usernameStatus.valid === false && (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
              </div>
              {usernameStatus.message && (
                <p className={`text-xs mt-2 ${
                  usernameStatus.valid === true ? 'text-green-400' :
                  usernameStatus.valid === false ? 'text-red-400' : 'text-cream-400'
                }`}>
                  {usernameStatus.message}
                </p>
              )}
              <p className="text-xs text-cream-500 mt-2">
                3-15 characters, letters, numbers, and underscores only
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#333] bg-[#222] flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2.5 bg-charcoal-700 text-cream-300 rounded-lg hover:bg-charcoal-600 transition-colors text-sm font-semibold"
            >
              Later
            </button>
            <button
              onClick={handleSubmit}
              disabled={usernameStatus.valid !== true || submitting}
              className="flex-1 px-4 py-2.5 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Username'
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default UsernamePromptModal;
