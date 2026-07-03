// =============================================================================
// CALLABLE HELPER
// =============================================================================
// Shared factory for typed Firebase Cloud Function wrappers.

import { httpsCallable, HttpsCallableResult, HttpsCallableOptions } from 'firebase/functions';
import { functions } from './client';

/**
 * Create a typed callable function wrapper
 */
export function createCallable<TData = void, TResult = unknown>(
  name: string,
  options?: HttpsCallableOptions
) {
  const callable = options
    ? httpsCallable<TData, TResult>(functions, name, options)
    : httpsCallable<TData, TResult>(functions, name);
  return async (data?: TData): Promise<HttpsCallableResult<TResult>> => {
    return callable(data as TData);
  };
}
