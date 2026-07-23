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

module.exports = { assertAuth, assertAdmin, hasAdminClaim, clampLimit };
