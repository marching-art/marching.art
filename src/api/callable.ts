// =============================================================================
// CALLABLE HELPER
// =============================================================================
// Shared factory for typed Firebase Cloud Function wrappers.
//
// Also the single instrumentation point for the product funnel: every server
// mutation in the app is created here, so the funnel stays covered as callables
// are added instead of depending on someone remembering a logEvent() call at
// each site. See src/api/funnel.ts for which callables report and why.

import { httpsCallable, HttpsCallableResult, HttpsCallableOptions } from 'firebase/functions';
import { functions, callFunction } from './client';
import { trackCallable, errorCodeOf, FUNNEL_EVENTS } from './funnel';

/** Monotonic clock where available; wall clock is fine as a fallback. */
function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

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

  // Resolved once at module load rather than per invocation: unmapped callables
  // (reads, polling, admin tooling) then cost nothing but a boolean check.
  const instrumented = Boolean(FUNNEL_EVENTS[name]);

  return async (data?: TData): Promise<HttpsCallableResult<TResult>> => {
    if (!instrumented) {
      return callable(data as TData);
    }

    const startedAt = now();
    try {
      const result = await callable(data as TData);
      trackCallable(name, 'success', { data, durationMs: now() - startedAt });
      return result;
    } catch (error) {
      trackCallable(name, 'error', {
        data,
        durationMs: now() - startedAt,
        errorCode: errorCodeOf(error),
      });
      // Rethrow untouched — instrumentation observes, it never changes behavior.
      throw error;
    }
  };
}

/**
 * Instrumented `callFunction`, for the league actions in src/api/leagues.ts.
 *
 * Those predate `createCallable` and call the raw transport in client.ts
 * directly. The tracking lives here rather than inside `callFunction` because
 * client.ts cannot import the funnel: analytics.ts needs `app` from client.ts,
 * so client -> funnel -> analytics -> client would be an import cycle, and the
 * only reason it would happen to work today is that analytics reads `app`
 * inside an async callback. Not worth depending on.
 *
 * Signature and error behavior match `callFunction` exactly, so callers keep
 * their existing `withErrorHandling` wrappers unchanged.
 */
export async function callFunctionTracked<TData = unknown, TResult = unknown>(
  name: Parameters<typeof callFunction>[0],
  data?: TData
): Promise<HttpsCallableResult<TResult>> {
  if (!FUNNEL_EVENTS[name]) {
    return callFunction<TData, TResult>(name, data);
  }

  const startedAt = now();
  try {
    const result = await callFunction<TData, TResult>(name, data);
    trackCallable(name, 'success', { data, durationMs: now() - startedAt });
    return result;
  } catch (error) {
    trackCallable(name, 'error', {
      data,
      durationMs: now() - startedAt,
      errorCode: errorCodeOf(error),
    });
    throw error;
  }
}
