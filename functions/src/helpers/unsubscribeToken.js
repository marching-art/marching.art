/**
 * One-click unsubscribe tokens (RFC 8058 / Gmail & Yahoo bulk-sender rules).
 *
 * Every engagement email carries a per-recipient link that turns off all
 * engagement email WITHOUT signing in: the directors most likely to want out
 * (win-back mail goes to people who have not logged in for a week or two) are
 * exactly the ones a login-walled preferences page fails. The link carries a
 * token — the uid plus an HMAC over it — so the endpoint can trust the uid it
 * names without a session.
 *
 * The signing key is DERIVED from the Brevo API key (HMAC-SHA256 of a fixed
 * label under it) rather than being a secret of its own: every function that
 * sends mail already binds BREVO_API_KEY, and a declared-but-unset secret
 * fails the deploy, so a new one would have been an ops step waiting to break
 * a release. The derivation is one-way, so a token never exposes the API key.
 * Rotating the Brevo key invalidates every link in already-sent mail; those
 * land on the "link expired" page, which points at the signed-in preferences.
 */

const crypto = require("crypto");

const UNSUBSCRIBE_PATH = "/unsubscribe";
const KEY_LABEL = "marching.art email unsubscribe v1";

/**
 * @param {string | null | undefined} brevoApiKey
 * @returns {Buffer | null} null when no API key is configured (no tokens then)
 */
function deriveUnsubscribeKey(brevoApiKey) {
  const apiKey = (brevoApiKey || "").trim();
  if (!apiKey) return null;
  return crypto.createHmac("sha256", apiKey).update(KEY_LABEL).digest();
}

/** @param {string} uid @param {Buffer} key */
function signature(uid, key) {
  return crypto.createHmac("sha256", key).update(uid).digest("base64url");
}

/**
 * @param {string} uid
 * @param {Buffer} key from deriveUnsubscribeKey
 * @returns {string} `${uid}.${signature}` — URL-safe, no encoding needed
 */
function signUnsubscribeToken(uid, key) {
  return `${uid}.${signature(uid, key)}`;
}

/**
 * @param {unknown} token
 * @param {Buffer | null} key
 * @returns {string | null} the uid the token names, or null when invalid
 */
function verifyUnsubscribeToken(token, key) {
  if (!key || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const uid = token.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  const given = Buffer.from(token.slice(dot + 1), "utf8");
  const expected = Buffer.from(signature(uid, key), "utf8");
  if (given.length !== expected.length) return null;
  return crypto.timingSafeEqual(given, expected) ? uid : null;
}

/**
 * @param {string} uid
 * @param {Buffer} key
 * @param {string} appUrl e.g. https://marching.art
 */
function buildUnsubscribeUrl(uid, key, appUrl) {
  return `${appUrl}${UNSUBSCRIBE_PATH}?t=${signUnsubscribeToken(uid, key)}`;
}

module.exports = {
  UNSUBSCRIBE_PATH,
  deriveUnsubscribeKey,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
};
