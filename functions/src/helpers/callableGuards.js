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

module.exports = { assertAuth, assertAdmin };
