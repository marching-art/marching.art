// Toast-safe messages for failed callables. Deliberately free of Firebase
// imports: the components that need it are unit-tested with api/functions
// mocked, and importing api/client here would initialize the SDK under test.

/** The bare code of a Functions client error ("functions/internal" → "internal"). */
function callableCode(error: unknown): string {
  const raw = (error as { code?: unknown } | null)?.code;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
  }
  return '';
}

/**
 * Codes whose `message` is not written for a director: the Functions client
 * surfaces them as the bare code ("internal", "unavailable") or an SDK
 * sentence, none of which belongs in a toast.
 */
const OPAQUE_CALLABLE_CODES = new Set([
  'internal',
  'unknown',
  'unavailable',
  'deadline-exceeded',
  'cancelled',
  'aborted',
  'data-loss',
  'unauthenticated',
  'unimplemented',
]);

const CONNECTIVITY_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

/**
 * A toast-safe message for a failed callable. Server-authored messages
 * (`HttpsError` with a real code — `failed-precondition`, `invalid-argument`,
 * `permission-denied`, …) pass through, because those ARE the player-facing
 * explanation; transport and infrastructure codes collapse to a connectivity
 * line or the caller's fallback, so a raw "internal" never reaches a director.
 */
export function friendlyCallableError(error: unknown, fallback: string): string {
  const code = callableCode(error);
  if (code === 'unavailable' || code === 'deadline-exceeded') return CONNECTIVITY_MESSAGE;
  if (code && OPAQUE_CALLABLE_CODES.has(code)) return fallback;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === 'string'
        ? (error as { message: string }).message
        : '';
  const trimmed = message.trim();
  // A message that is just the code again ("internal", "INTERNAL") is opaque too.
  if (!trimmed || /^[a-z-]+$/i.test(trimmed)) return fallback;
  return trimmed;
}
