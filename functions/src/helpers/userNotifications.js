/**
 * In-app notification writer — the one place the backend writes into
 * users/{uid}/notifications.
 *
 * Firestore rules make this subcollection backend-create-only (a client may
 * only flip `read` and delete its own docs — see firestore.rules), so every
 * notification-worthy event funnels through here with the Admin SDK. The doc
 * shape matches what the client hooks read (useLeagueNotifications /
 * useNotificationInbox): { id, userId, type, title, message, read, createdAt }
 * plus optional { link, metadata } and any caller extras (leagueId,
 * leagueName, …) spread through unchanged for compatibility with the existing
 * league notification docs.
 *
 * Design rules:
 *   - Best-effort, always: a notification failure must NEVER fail the parent
 *     job or callable, so both writers catch and log instead of throwing.
 *   - Idempotent where the caller can name the event: pass `dedupeKey` and it
 *     becomes the doc id, so a scheduler retry overwrites the same doc
 *     instead of duplicating the inbox entry.
 *   - The in-app inbox is the passive, lowest-friction channel: it is
 *     deliberately NOT gated on settings.pushPreferences /
 *     settings.emailPreferences — those are channel opt-outs (allPush /
 *     allEmails), not "never tell me about this" switches, and no
 *     channel-neutral category preference exists today. If one is added,
 *     gate it in the callers (where the recipient's settings are in hand).
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { ChunkedWriter } = require("./chunkedWriter");

// Bounds keep a buggy caller (or runaway template string) from writing
// unbounded payloads into a per-user collection the owner pays to read.
const MAX_TITLE = 120;
const MAX_MESSAGE = 500;
const MAX_LINK = 300;
const MAX_DEDUPE_KEY = 180;

/** Clamp user-visible text; returns "" for non-strings. */
function clampText(value, max) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Doc ids cannot contain '/'; keep keys short and slash-free. */
function sanitizeDedupeKey(key) {
  return String(key).replace(/[/\s]+/g, "_").slice(0, MAX_DEDUPE_KEY);
}

/**
 * Build the notification doc body (everything except id/userId/createdAt,
 * which are stamped at write time). Returns null when the entry is not a
 * valid notification (missing type/title/message).
 *
 * Extra fields (e.g. leagueId/leagueName from the league flows) pass through
 * unchanged so existing consumers keep reading the fields they expect.
 *
 * @param {Record<string, any>} notification - Requires type/title/message;
 *   also accepts link, metadata, dedupeKey, uid, and caller extras.
 * @returns {Record<string, any>|null}
 */
function buildNotificationDoc(notification) {
  if (!notification || typeof notification !== "object") return null;
  // dedupeKey addresses the doc, uid addresses the recipient — neither
  // belongs in the doc body.
  const { type, title, message, link, metadata, dedupeKey: _dedupeKey, uid: _uid, ...extra } =
    notification;

  const clampedTitle = clampText(title, MAX_TITLE);
  const clampedMessage = clampText(message, MAX_MESSAGE);
  if (!type || typeof type !== "string" || !clampedTitle || !clampedMessage) return null;

  /** @type {Record<string, any>} */
  const doc = {
    ...extra,
    type,
    title: clampedTitle,
    message: clampedMessage,
    read: false,
  };
  if (typeof link === "string" && link) doc.link = link.slice(0, MAX_LINK);
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    doc.metadata = metadata;
  }
  return doc;
}

/** The target doc ref: deterministic when dedupeKey names the event. */
function notificationRef(db, uid, dedupeKey) {
  const collectionRef = db.collection(paths.userNotifications(uid));
  return dedupeKey ? collectionRef.doc(sanitizeDedupeKey(dedupeKey)) : collectionRef.doc();
}

/**
 * Write one in-app notification. Never throws — a notification failure never
 * fails the action that triggered it.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid - Recipient.
 * @param {Object} notification - See buildNotificationDoc; also accepts
 *   `dedupeKey` to make the write idempotent across retries.
 * @returns {Promise<string|null>} The written doc id, or null on skip/failure.
 */
async function createUserNotification(db, uid, notification) {
  try {
    if (!uid) return null;
    const doc = buildNotificationDoc(notification);
    if (!doc) {
      logger.warn(`Skipping malformed in-app notification for ${uid}`);
      return null;
    }
    const ref = notificationRef(db, uid, notification.dedupeKey);
    await ref.set({
      ...doc,
      id: ref.id,
      userId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    logger.error(`Failed to write in-app notification for ${uid}:`, error);
    return null;
  }
}

/**
 * Fan out in-app notifications to many recipients in one chunked batch —
 * for the scheduled jobs that already hold every recipient + message in
 * memory (score drop, lineup lock, weekly matchups).
 *
 * Never throws. Malformed entries are skipped (and counted), and a commit
 * failure is logged with the ChunkedWriter tear point; earlier chunks stay
 * durable, which is fine — every caller passes dedupeKeyed entries, so a
 * retry converges instead of duplicating.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<Object>} entries - Each: { uid, type, title, message,
 *   link?, metadata?, dedupeKey?, ...extra }.
 * @returns {Promise<{written: number, skipped: number}>}
 */
async function createUserNotifications(db, entries) {
  const result = { written: 0, skipped: 0 };
  try {
    if (!Array.isArray(entries) || entries.length === 0) return result;

    const writer = new ChunkedWriter(db);
    for (const entry of entries) {
      const uid = entry && entry.uid;
      const doc = uid ? buildNotificationDoc(entry) : null;
      if (!doc) {
        result.skipped++;
        continue;
      }
      const ref = notificationRef(db, uid, entry.dedupeKey);
      writer.set(ref, {
        ...doc,
        id: ref.id,
        userId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      result.written++;
    }

    if (result.written > 0) await writer.commit();
  } catch (error) {
    logger.error(
      `In-app notification fan-out failed (${result.written} queued, ` +
        `${result.skipped} skipped):`,
      error
    );
  }
  return result;
}

module.exports = {
  buildNotificationDoc,
  createUserNotification,
  createUserNotifications,
};
