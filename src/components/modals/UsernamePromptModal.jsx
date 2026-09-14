// src/components/modals/UsernamePromptModal.jsx
// Modal to prompt existing users who don't have a username set.
//
// The format rules and the failed-check messages come from the shared
// `onboardingUsername` module (the same pure helpers the onboarding wizard
// uses), so this modal only owns the debounce and the status state — the two
// surfaces can't drift on what a legal username is or what a rejection says.

import React, { useState, useRef, useEffect } from 'react';
import { AtSign, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Portal from '../Portal';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useProfileStore } from '../../store/profileStore';
import { useAuth } from '../../context/AuthContext';
import { checkUsername, updateUsername } from '../../api/functions';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  usernameCheckFailure,
  usernameFormatError,
} from '../../pages/onboardingUsername';
import toast from 'react-hot-toast';

const UsernamePromptModal = () => {
  // Null only outside AuthProvider; this modal mounts inside the app shell.
  const user = useAuth()?.user;
  const profile = useProfileStore((state) => state.profile);
  const loading = useProfileStore((state) => state.loading);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(
    /** @type {import('../../pages/onboardingUsername').UsernameStatus} */ ({
      checking: false,
      valid: null,
      message: '',
    })
  );
  const [submitting, setSubmitting] = useState(false);
  const usernameCheckTimeout = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  // Two reasons to open: no username at all (mandatory, cannot be dismissed),
  // or a temporary numbered handle assigned by the username-reservation repair
  // (functions/src/scripts/backfillUsernameReservations.js) because an older
  // account owned the name. The temporary handle works, so that case can be
  // put off with "Later" — but it asks again on the next visit until
  // updateUsername clears the flag.
  const isTemporary = !!profile?.username && profile?.usernameTemporary === true;
  const [deferred, setDeferred] = useState(false);
  const shouldShow =
    !loading && profile && user && (!profile.username || (isTemporary && !deferred));

  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  // Trap keyboard focus inside the dialog (WCAG 2.4.3); restores on close
  useFocusTrap(dialogRef, !!shouldShow);

  // Username validation: format rules locally, availability on the server
  // (debounced so a fast typist costs one callable, not one per keystroke).
  /** @param {string} usernameValue */
  const validateUsername = async (usernameValue) => {
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    if (!usernameValue.trim()) {
      setUsernameStatus({ checking: false, valid: null, message: '' });
      return;
    }

    const formatError = usernameFormatError(usernameValue);
    if (formatError) {
      setUsernameStatus({ checking: false, valid: false, message: formatError });
      return;
    }

    setUsernameStatus({ checking: true, valid: null, message: 'Checking availability...' });

    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        await checkUsername({ username: usernameValue });
        setUsernameStatus({ checking: false, valid: true, message: 'Username is available!' });
      } catch (error) {
        setUsernameStatus(usernameCheckFailure(error));
      }
    }, 500);
  };

  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(value);
    validateUsername(value);
  };

  const handleSubmit = async () => {
    if (usernameStatus.valid !== true || !user) return;

    setSubmitting(true);
    try {
      // Reserve the username + update the profile atomically on the server.
      // The `usernames/` collection is backend-only per security rules, so a
      // client write there is denied — this MUST go through the callable.
      await updateUsername({ username: username.trim().toLowerCase() });

      toast.success('Username set successfully!');
    } catch (error) {
      console.error('Error setting username:', error);
      const { code } = /** @type {{ code?: string }} */ (error ?? {});
      if (code === 'functions/already-exists') {
        setUsernameStatus(usernameCheckFailure(error));
        toast.error('That username was just taken. Please choose another.');
      } else {
        toast.error('Failed to set username. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          ref={dialogRef}
          className="w-full max-w-md bg-surface-card border border-line rounded-none overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center px-5 py-4 border-b border-line bg-surface-raised">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-none bg-surface-elevated">
                <AtSign className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h2 id="username-prompt-title" className="text-sm font-bold text-white">
                  {isTemporary ? 'Pick a New Username' : 'Choose Your Username'}
                </h2>
                <p className="text-xs text-muted">
                  {isTemporary
                    ? `Your current handle @${profile.username} is temporary`
                    : 'This will be your unique identifier'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-secondary">
              {isTemporary
                ? `Another director registered this username before you did, so your account was given the temporary handle @${profile.username}. Choose a new username to keep.`
                : 'Welcome back! A username is now required to identify players. Please choose a unique username to continue using your account.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  className={`w-full px-4 py-3 bg-charcoal-900 border rounded-none text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-interactive/50 pr-10 ${
                    usernameStatus.valid === true
                      ? 'border-green-500/50'
                      : usernameStatus.valid === false
                        ? 'border-red-500/50'
                        : 'border-charcoal-700'
                  }`}
                  placeholder="e.g., drumcorps_fan"
                  value={username}
                  onChange={handleUsernameChange}
                  maxLength={USERNAME_MAX_LENGTH}
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus.checking && (
                    <Loader2 className="w-5 h-5 text-muted animate-spin" />
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
                <p
                  className={`text-xs mt-2 ${
                    usernameStatus.valid === true
                      ? 'text-green-400'
                      : usernameStatus.valid === false
                        ? 'text-red-400'
                        : 'text-muted'
                  }`}
                >
                  {usernameStatus.message}
                </p>
              )}
              <p className="text-xs text-muted mt-2">
                {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters, letters, numbers, and
                underscores only
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-line bg-surface-raised space-y-2">
            {isTemporary && (
              <button
                type="button"
                onClick={() => setDeferred(true)}
                disabled={submitting}
                className="w-full px-4 py-2 text-xs font-semibold text-muted hover:text-white transition-colors disabled:opacity-50"
              >
                {`Later — keep @${profile.username} for now`}
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={usernameStatus.valid !== true || submitting}
              className="w-full px-4 py-2.5 bg-interactive text-white rounded-none hover:bg-interactive-hover transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
