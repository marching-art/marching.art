// =============================================================================
// PENDING POST-AUTH REDIRECT
// =============================================================================
// ProtectedRoute bounces a signed-out visitor to the home page with the
// attempted location in router state (`state.from`). Router state only
// survives a single navigation, so it covered exactly one path: the inline
// sign-in on the landing page. The common case for a shared deep link — a
// league invite (`/leagues?join=CODE`) opened by someone WITHOUT an account —
// walks Register → Onboarding → Dashboard, and the invite was gone by then.
//
// This keeps the resolved target in sessionStorage (per tab, gone when the
// tab closes) so every terminal point of the auth funnel can finish the trip:
//   - the landing page's inline sign-in (falls back to this when state is gone)
//   - RedirectIfAuthed on /login and /register (peeks)
//   - Onboarding completion (consumes)
// ProtectedRoute clears it once the signed-in, onboarded director actually
// reaches the target; sign-out clears it so it never carries across accounts.

const KEY = 'ma:pendingRedirect';
const DEFAULT_TARGET = '/dashboard';
/** A deep link older than this is stale — someone abandoned the funnel. */
const TTL_MS = 60 * 60 * 1000;

interface Stored {
  path: string;
  at: number;
}

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.path !== 'string' || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return { path: parsed.path, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * Remember a resolved, router-relative target (see resolveAuthRedirect) for
 * after sign-in/sign-up. The default target is never worth remembering.
 */
export function rememberPendingRedirect(path: string | null | undefined): void {
  if (!path || path === DEFAULT_TARGET || !path.startsWith('/') || path.startsWith('//')) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() } satisfies Stored));
  } catch {
    /* storage unavailable — the state.from path still works for one hop */
  }
}

/** The pending target, if any, without clearing it. */
export function peekPendingRedirect(): string | null {
  return read()?.path ?? null;
}

/** The pending target, if any, and forget it. */
export function consumePendingRedirect(): string | null {
  const path = peekPendingRedirect();
  clearPendingRedirect();
  return path;
}

export function clearPendingRedirect(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
