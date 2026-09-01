// Client error intake behind the /api/errors hosting rewrite (both hosts).
//
// src/lib/errorReporter.ts POSTs one JSON payload per uncaught error,
// unhandled rejection, or error-boundary catch. Production builds default to
// this same-origin path, so the CSP's connect-src 'self' already permits it
// and no third-party vendor or extra secret is involved. Each accepted payload
// becomes one structured `logger.error` entry, which Cloud Logging routes into
// Google Cloud Error Reporting automatically (grouped by message + stack).
//
// It is public and unauthenticated by nature (a crash can happen before auth
// resolves), so the surface is kept deliberately dumb:
//   - POST only, JSON only, body capped at MAX_BODY_BYTES;
//   - only allowlisted string fields are logged, each length-capped;
//   - a per-instance token bucket bounds log volume from a misbehaving client.
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_CHARS = { message: 1000, name: 100, stack: 6000, source: 100, componentStack: 4000, url: 1000, userAgent: 400, release: 100, filename: 500 };
const NUMBER_FIELDS = new Set(["line", "column"]);

// Per-instance bucket: BUCKET_CAPACITY reports per BUCKET_WINDOW_MS. Instances
// are few and short-lived, so this is a volume guard, not a fairness scheme.
const BUCKET_CAPACITY = 120;
const BUCKET_WINDOW_MS = 60 * 1000;
let bucket = { windowStart: 0, count: 0 };

function takeToken(now = Date.now()) {
  if (now - bucket.windowStart >= BUCKET_WINDOW_MS) bucket = { windowStart: now, count: 0 };
  if (bucket.count >= BUCKET_CAPACITY) return false;
  bucket.count += 1;
  return true;
}

/** Test hook: reset the per-instance bucket. */
function resetBucketForTesting() {
  bucket = { windowStart: 0, count: 0 };
}

/**
 * Reduce an untrusted payload to the allowlisted, length-capped fields.
 * @param {unknown} raw
 * @returns {Record<string, string|number>|null} null when nothing usable.
 */
function sanitizeClientError(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  /** @type {Record<string, string|number>} */
  const out = {};
  for (const [key, max] of Object.entries(MAX_FIELD_CHARS)) {
    const value = /** @type {Record<string, unknown>} */ (raw)[key];
    if (typeof value === "string" && value.length) out[key] = value.slice(0, max);
  }
  for (const key of NUMBER_FIELDS) {
    const value = /** @type {Record<string, unknown>} */ (raw)[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  if (!out.message) return null;
  return out;
}

/**
 * Parse the request body regardless of how the client sent it: sendBeacon
 * ships a string body as text/plain, fetch ships application/json.
 * @param {import("firebase-functions/v2/https").Request} req
 */
function readJsonBody(req) {
  const raw = req.rawBody;
  if (raw && raw.length > MAX_BODY_BYTES) return { tooLarge: true, body: null };
  try {
    if (raw && raw.length) return { tooLarge: false, body: JSON.parse(raw.toString("utf8")) };
    if (req.body && typeof req.body === "object") return { tooLarge: false, body: req.body };
    if (typeof req.body === "string") return { tooLarge: false, body: JSON.parse(req.body) };
  } catch {
    return { tooLarge: false, body: null };
  }
  return { tooLarge: false, body: null };
}

exports.reportClientErrorHttp = onRequest(
  {
    timeoutSeconds: 10,
    cpu: 1,
    maxInstances: 2,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST").status(405).end();
      return;
    }
    if (!takeToken()) {
      res.status(429).end();
      return;
    }
    const { tooLarge, body } = readJsonBody(req);
    if (tooLarge) {
      res.status(413).end();
      return;
    }
    const report = sanitizeClientError(body);
    if (!report) {
      res.status(400).end();
      return;
    }
    logger.error(`[client-error] ${report.message}`, {
      ...report,
      ip: req.ip || null,
    });
    res.set("Cache-Control", "no-store").status(204).end();
  }
);

module.exports = {
  reportClientErrorHttp: exports.reportClientErrorHttp,
  sanitizeClientError,
  resetBucketForTesting,
  MAX_BODY_BYTES,
  BUCKET_CAPACITY,
};
