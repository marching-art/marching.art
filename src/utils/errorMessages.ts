// src/utils/errorMessages.ts
// User-friendly error messages for common error scenarios

export interface ErrorInfo {
  title: string;
  message: string;
  action?: string;
  actionLabel?: string;
  recoverable: boolean;
}

// Firebase error code mappings
const FIREBASE_ERROR_MESSAGES: Record<string, ErrorInfo> = {
  'auth/email-already-in-use': {
    title: 'Email Already Registered',
    message: 'This email is already associated with an account. Try signing in instead.',
    actionLabel: 'Sign In',
    action: '/login',
    recoverable: true,
  },
  'auth/invalid-email': {
    title: 'Invalid Email',
    message: 'Please enter a valid email address.',
    recoverable: true,
  },
  'auth/user-not-found': {
    title: 'Account Not Found',
    message: 'No account exists with this email. Would you like to create one?',
    actionLabel: 'Create Account',
    action: '/register',
    recoverable: true,
  },
  'auth/wrong-password': {
    title: 'Incorrect Password',
    message: 'The password you entered is incorrect. Please try again.',
    recoverable: true,
  },
  'auth/too-many-requests': {
    title: 'Too Many Attempts',
    message: 'Too many failed attempts. Please wait a few minutes before trying again.',
    recoverable: true,
  },
  'auth/network-request-failed': {
    title: 'Connection Error',
    message: 'Unable to connect. Please check your internet connection and try again.',
    actionLabel: 'Retry',
    recoverable: true,
  },
  'auth/popup-closed-by-user': {
    title: 'Sign In Cancelled',
    message: 'The sign in window was closed. Please try again when ready.',
    recoverable: true,
  },
  'auth/requires-recent-login': {
    title: 'Session Expired',
    message: 'For security, please sign in again to complete this action.',
    actionLabel: 'Sign In',
    action: '/login',
    recoverable: true,
  },
  'permission-denied': {
    title: 'Access Denied',
    message: 'You don\'t have permission to access this resource.',
    recoverable: false,
  },
  'unavailable': {
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable. Please try again later.',
    recoverable: true,
  },
  'deadline-exceeded': {
    title: 'Request Timeout',
    message: 'The request took too long. Please check your connection and try again.',
    actionLabel: 'Retry',
    recoverable: true,
  },
  'not-found': {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    recoverable: false,
  },
  'already-exists': {
    title: 'Already Exists',
    message: 'This resource already exists. Please try a different name.',
    recoverable: true,
  },
  'resource-exhausted': {
    title: 'Limit Reached',
    message: 'You\'ve reached the limit for this action. Please try again later.',
    recoverable: true,
  },
};

// Generic network errors
const NETWORK_ERROR_MESSAGES: Record<string, ErrorInfo> = {
  'NetworkError': {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    actionLabel: 'Retry',
    recoverable: true,
  },
  'TimeoutError': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    actionLabel: 'Retry',
    recoverable: true,
  },
  'AbortError': {
    title: 'Request Cancelled',
    message: 'The request was cancelled. Please try again.',
    recoverable: true,
  },
};

// Default error for unknown cases
const DEFAULT_ERROR: ErrorInfo = {
  title: 'Something Went Wrong',
  message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  actionLabel: 'Try Again',
  recoverable: true,
};

/**
 * Get a user-friendly error message from an error object
 */
export function getErrorMessage(error: unknown): ErrorInfo {
  if (!error) return DEFAULT_ERROR;

  // Handle Firebase errors
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Firebase Auth errors
    if ('code' in errorObj && typeof errorObj.code === 'string') {
      const code = errorObj.code as string;
      if (FIREBASE_ERROR_MESSAGES[code]) {
        return FIREBASE_ERROR_MESSAGES[code];
      }
      // Try without 'auth/' prefix
      const shortCode = code.replace('auth/', '');
      if (FIREBASE_ERROR_MESSAGES[shortCode]) {
        return FIREBASE_ERROR_MESSAGES[shortCode];
      }
    }

    // Network errors
    if ('name' in errorObj && typeof errorObj.name === 'string') {
      if (NETWORK_ERROR_MESSAGES[errorObj.name]) {
        return NETWORK_ERROR_MESSAGES[errorObj.name];
      }
    }

    // Custom error message
    if ('message' in errorObj && typeof errorObj.message === 'string') {
      // Check if it's a specific known message
      const message = errorObj.message.toLowerCase();

      if (message.includes('network') || message.includes('offline')) {
        return NETWORK_ERROR_MESSAGES['NetworkError'];
      }
      if (message.includes('timeout')) {
        return NETWORK_ERROR_MESSAGES['TimeoutError'];
      }

      // Return with the actual message
      return {
        ...DEFAULT_ERROR,
        message: errorObj.message as string,
      };
    }
  }

  // String errors
  if (typeof error === 'string') {
    return {
      ...DEFAULT_ERROR,
      message: error,
    };
  }

  return DEFAULT_ERROR;
}

/**
 * Format error for display in toast notifications
 */
export function getToastMessage(error: unknown): string {
  const errorInfo = getErrorMessage(error);
  return errorInfo.message;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  const errorInfo = getErrorMessage(error);
  return errorInfo.recoverable;
}

/**
 * Log error for debugging (only in development)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'Error'}]`, error);
  }
  // In production, this could send to an error tracking service
}

export default {
  getErrorMessage,
  getToastMessage,
  isRecoverableError,
  logError,
};
