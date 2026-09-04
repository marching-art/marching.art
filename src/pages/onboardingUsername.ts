// Username validation for the onboarding wizard: the client-side format rules
// (mirrored from the server's checkUsername) and the mapping from a failed
// server check to the message the director sees. Pure, so Onboarding.jsx only
// owns the debounce and the status state.

export interface UsernameStatus {
  checking: boolean;
  valid: boolean | null;
  message: string;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 15;

/** The message for a username that fails the format rules, else null. */
export function usernameFormatError(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or less`;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Only letters, numbers, and underscores allowed';
  }
  return null;
}

/** The status to show when the server's checkUsername call rejected. */
export function usernameCheckFailure(error: unknown): UsernameStatus {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code === 'functions/already-exists') {
    return { checking: false, valid: false, message: 'This username is already taken' };
  }
  if (code === 'functions/invalid-argument') {
    return { checking: false, valid: false, message: message || 'Invalid username' };
  }
  return { checking: false, valid: false, message: 'Could not verify username' };
}
