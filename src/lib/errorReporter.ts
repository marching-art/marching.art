// =============================================================================
// ERROR REPORTER
// =============================================================================
// Provider-agnostic production error observability. Before this, errors caught
// by the app's error boundaries were only `console.error`-ed — invisible in
// production — and there was no global handler for uncaught errors or unhandled
// promise rejections, so crashes vanished silently.
//
// This module gives one funnel — `reportError` — plus global `error` /
// `unhandledrejection` listeners. It is intentionally vendor-neutral: if
// `VITE_ERROR_REPORTING_ENDPOINT` is set, structured payloads are POSTed there
// (Sentry tunnel, a logging endpoint, whatever); if not, it degrades to
// `console.error` only, so the default build behaves exactly as before and
// nothing external is contacted.

const ENDPOINT = import.meta.env.VITE_ERROR_REPORTING_ENDPOINT || '';
const RELEASE = import.meta.env.VITE_APP_VERSION || 'dev';

export interface ErrorContext {
  /** Where the error was caught, e.g. 'ErrorBoundary', 'window.onerror'. */
  source: string;
  /** React component stack, when reporting from an error boundary. */
  componentStack?: string;
  [key: string]: unknown;
}

let installed = false;

/** Fire-and-forget delivery. Never throws; a reporting failure must not cascade. */
function deliver(payload: Record<string, unknown>): void {
  if (!ENDPOINT) return;
  try {
    const body = JSON.stringify(payload);
    // sendBeacon survives page unload (the moment a crash often triggers a
    // navigation); fall back to keepalive fetch where it is unavailable.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, body);
    } else {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* swallow — reporting is best-effort */
      });
    }
  } catch {
    /* swallow — never let reporting throw */
  }
}

/**
 * Report an error to the console and (when configured) the reporting endpoint.
 * Accepts any thrown value; non-Errors are coerced so a stack is always present.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log locally so dev and endpoint-less builds still surface the error.
  console.error(`[${context.source}]`, err, context);

  deliver({
    message: err.message,
    name: err.name,
    stack: err.stack || null,
    release: RELEASE,
    url: typeof location !== 'undefined' ? location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    ...context,
  });
}

/**
 * Install global handlers for uncaught errors and unhandled promise rejections.
 * Idempotent — safe to call once at app startup.
 */
export function initErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? event.message, {
      source: 'window.onerror',
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}
