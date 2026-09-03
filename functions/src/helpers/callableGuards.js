// Shared request guards for onCall functions.
//
// Every callable used to hand-copy its own `if (!request.auth) throw ...`
// block (~78 occurrences), which is exactly how an unauthenticated callable
// slipped into production once. Use these instead so the auth gate is
// impossible to mistype and easy to grep for.

const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Require an authenticated caller.
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {string} The caller's uid.
 * @throws {HttpsError} unauthenticated when there is no auth context.
 */
function assertAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  return request.auth.uid;
}

/**
 * Require an authenticated caller with the admin custom claim.
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {string} The caller's uid.
 * @throws {HttpsError} unauthenticated / permission-denied.
 */
function assertAdmin(request) {
  const uid = assertAuth(request);
  if (request.auth.token?.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "You must be an admin to perform this action."
    );
  }
  return uid;
}

/**
 * Non-throwing admin check, for call sites that branch on admin status rather
 * than gate on it (e.g. "the owner OR an admin may delete"). Reads the same
 * custom claim as assertAdmin and is null-safe on request.auth / token, so it
 * can't throw on an unauthenticated or token-less request.
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {boolean} true when the caller has the admin custom claim.
 */
function hasAdminClaim(request) {
  return request.auth?.token?.admin === true;
}

/**
 * Coerce a client-supplied query limit into a safe integer within [1, max].
 *
 * Client `limit` values flow straight into Firestore `.limit()`; unvalidated,
 * a caller can request an oversized page (a large, billable read + bloated
 * response) or a non-integer/negative value that throws deep in the query.
 * Non-numeric/NaN input falls back to `fallback`.
 *
 * @param {unknown} value - Raw request.data.limit (any type).
 * @param {Object} [opts]
 * @param {number} [opts.fallback=50] - Used when value is absent/invalid.
 * @param {number} [opts.max=100] - Upper bound.
 * @param {number} [opts.min=1] - Lower bound.
 * @returns {number} An integer in [min, max].
 */
function clampLimit(value, { fallback = 50, max = 100, min = 1 } = {}) {
  // null/undefined mean "not provided" — Number() would coerce them to 0/NaN,
  // so short-circuit to the fallback before the numeric check.
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

// Firestore doc-id shape for client-supplied ids (uids, comment ids, league
// ids, season ids, ...). Anything outside this set could mint arbitrary doc
// ids, inject path segments ("a/b"), or address reserved names ("__foo__").
const DOC_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Validate a client-supplied Firestore document id before it is interpolated
 * into a document path. Rejects non-strings, empty/oversized values, and any
 * character outside [A-Za-z0-9_-] (notably "/" and ".").
 *
 * @param {unknown} value - Raw id from request data.
 * @param {string} [label="id"] - Field name used in the error message.
 * @returns {string} The validated id.
 * @throws {HttpsError} invalid-argument when the id is malformed.
 */
function assertDocId(value, label = "id") {
  if (typeof value !== "string" || !DOC_ID_RE.test(value)) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return value;
}

/**
 * Throttle a caller's writes through a windowed per-uid budget, throwing
 * resource-exhausted when it is spent. This is abuse/billing protection for
 * auth-only mutation callables (economy purchases, votes, notifications) —
 * every one is already server-authoritative, but with App Check unenforced
 * any script holding one Firebase token could hammer them unthrottled.
 *
 * The budgets should be far above any human rate so legitimate players never
 * see the error. Backed by helpers/rateLimit.consumeRateBudget (one small
 * doc read per call, in a server-only `rate_{key}` collection with no client
 * rules); its bookkeeping failures fail open, so this guard can never take
 * a feature down.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid - The (already authenticated) caller.
 * @param {string} key - Budget bucket, e.g. "economy" — one shared window
 *   per bucket, so related mutations draw from the same budget.
 * @param {Object} [opts]
 * @param {number} [opts.max=30] - Allowed actions per window.
 * @param {number} [opts.windowMs=600000] - Window length (default 10 min).
 * @throws {HttpsError} resource-exhausted when the budget is spent.
 */
async function assertWriteBudget(db, uid, key, { max = 30, windowMs = 10 * 60 * 1000 } = {}) {
  const { consumeRateBudget } = require("./rateLimit");
  const allowed = await consumeRateBudget(db, `rate_${key}`, uid, max, windowMs);
  if (!allowed) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests. Please wait a moment and try again."
    );
  }
}

/**
 * The DEFAULT guard for user-facing mutation callables: authenticate, then
 * charge the caller's write budget in one call. Prefer this over a bare
 * assertAuth in any callable that writes — scripts/callableBudgetCensus.mjs
 * fails CI when a callable file ships with neither a budget nor an admin
 * gate, so unthrottled mutations can't quietly come back.
 *
 * HAZARD: pass an ALREADY-OBTAINED db handle. Writing
 * `assertAuthWithBudget(getDb(), request, ...)` evaluates getDb() before the
 * auth check runs, so an anonymous caller in an uninitialized context gets an
 * internal error instead of `unauthenticated` (caught by authGates.test.js).
 * When the db isn't in scope yet, use the two-step idiom instead:
 * `const uid = assertAuth(request); await assertWriteBudget(getDb(), uid, ...)`.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @param {string} key - Budget bucket (see assertWriteBudget).
 * @param {Object} [opts] - Budget options (max / windowMs).
 * @returns {Promise<string>} The caller's uid.
 */
async function assertAuthWithBudget(db, request, key, opts = {}) {
  const uid = assertAuth(request);
  await assertWriteBudget(db, uid, key, opts);
  return uid;
}

/**
 * Block a caller whose account an admin has restricted (a moderation action).
 * Applied to the zero-sum surfaces — Showcase entries/votes, league prediction
 * pools, daily predictions — so a confirmed alt / abuse account can be stopped
 * from farming payouts or colluding on pots WITHOUT a full account ban. The
 * restriction is a server-only profile field (`moderation.restricted`) written
 * only by the setAccountRestriction admin callable, and is fully reversible.
 *
 * Fails OPEN on a read error — a flaky profile read must never block a
 * legitimate player's action — matching assertWriteBudget's posture. The
 * restriction is a soft anti-abuse measure, not a security boundary (the
 * economy is server-authoritative regardless), so the occasional missed block
 * on a transient error is the right trade against blocking real directors.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid - The (already authenticated) caller.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {Object|null} [preloadedProfile] The caller's profile data when the
 *   callable already read it (null = no profile doc); omit to read it here.
 * @throws {HttpsError} permission-denied when the account is restricted.
 */
async function assertNotRestricted(db, uid, preloadedProfile) {
  const { paths } = require("./paths");
  let restricted = false;
  try {
    // Callers that already hold the profile doc pass it to save the read.
    const data =
      preloadedProfile !== undefined
        ? preloadedProfile
        : await db
            .doc(paths.userProfile(uid))
            .get()
            .then((snap) => (snap.exists ? snap.data() : null));
    restricted = data?.moderation?.restricted === true;
  } catch {
    return; // fail open — never block on a read failure
  }
  if (restricted) {
    throw new HttpsError(
      "permission-denied",
      "This account is restricted from competitive and social actions. " +
        "Email support@marching.art if you believe this is a mistake."
    );
  }
}

module.exports = {
  assertAuth,
  assertAdmin,
  hasAdminClaim,
  clampLimit,
  assertDocId,
  assertWriteBudget,
  assertAuthWithBudget,
  assertNotRestricted,
};
