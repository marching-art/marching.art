/**
 * Podium staff NAMES — a director may name each staffer they employ, and no
 * two staffers anywhere in the game may share a name. The registry is a flat
 * collection keyed by the name's canonical form (`podium-staff-names/{key}`),
 * so a claim is one document read + write inside whichever transaction
 * mints, renames, releases, or retires the staffer:
 *
 *   { name, key, uid, staffId, specialty, corpsName, claimedAt }
 *
 * Canonicalisation is deliberately aggressive (case, accents, punctuation and
 * spacing all fold away) so "J.T. Smith", "jt smith" and "JT Smíth" are one
 * name — lookalikes are the whole point of a uniqueness rule. The display
 * form the director typed is what everyone sees.
 *
 * A name belongs to the STAFFER (staffId), not the director: it rides along a
 * retrain (specialty changes, name stays) and season to season while the
 * staffer is retained. It is released — the document deleted — the moment
 * the career ends: an in-season release, a lapsed/released/retired contract
 * at re-registration, a fresh-start registration that drops the roster, an
 * account deletion, or an admin clearing an inappropriate name.
 *
 * Firestore transactions read before they write, so the helpers here split
 * every claim/release into a READ half (refs to fetch alongside the caller's
 * other reads) and an APPLY half (given the snapshots, what to write).
 *
 * Moderation: admins can clear a name (a strike for the director) and revoke
 * naming outright; `STRIKES_TO_REVOKE` clears revoke naming automatically. The
 * privilege lives on the profile at `moderation.staffNaming` so it survives
 * seasons, retirements and fresh starts.
 */

const { HttpsError } = require("firebase-functions/v2/https");

const COLLECTION = "podium-staff-names";
const NAME_MIN = 2;
const NAME_MAX = 32;
const KEY_MIN = 2;
/** Admin clears before naming is revoked automatically. */
const STRIKES_TO_REVOKE = 3;
/** Recent moderation events kept on the profile (newest last). */
const HISTORY_CAP = 10;

// Letters (any script), marks, digits, spaces and the punctuation a real name
// carries. Anything else (emoji, symbols, slashes, control chars) is refused
// rather than silently stripped so the director sees what was wrong.
const ALLOWED_CHARS = /^[\p{L}\p{M}\p{N} .'-]+$/u;
// Same guard the corps-name path uses (registerCorps.js), plus the obvious
// slurs a name field attracts. Word-boundary free on purpose: "sh1t" and
// "assh0le" style evasions are the admin's job (moderatePodiumStaffName).
const PROFANITY = /fuck|shit|damn|cunt|nigg|fagg|retard|bitch|whore|slut|kike|spic|chink/i;

/**
 * Validate a raw name and derive its display + canonical forms.
 * @param {unknown} raw what the director typed
 * @returns {{display: string, key: string}}
 * @throws {HttpsError} invalid-argument with a director-facing reason
 */
function normalizeStaffName(raw) {
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "A staff name must be text.");
  }
  const display = raw.replace(/\s+/g, " ").trim();
  if (display.length < NAME_MIN || display.length > NAME_MAX) {
    throw new HttpsError(
      "invalid-argument",
      `A staff name must be ${NAME_MIN}-${NAME_MAX} characters.`
    );
  }
  if (!ALLOWED_CHARS.test(display)) {
    throw new HttpsError(
      "invalid-argument",
      "A staff name may only use letters, numbers, spaces, periods, apostrophes and hyphens."
    );
  }
  if (PROFANITY.test(display)) {
    throw new HttpsError("invalid-argument", "That staff name isn't allowed.");
  }
  const key = keyFor(display);
  if (key.length < KEY_MIN) {
    throw new HttpsError("invalid-argument", "A staff name needs at least two letters or digits.");
  }
  return { display, key };
}

/**
 * The canonical registry key for a display name: accents folded, lower-cased,
 * everything but letters and digits dropped. Pure; never throws.
 * @param {string} display
 */
function keyFor(display) {
  return String(display || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** @param {FirebaseFirestore.Firestore} db @param {string} key */
function nameRef(db, key) {
  return db.doc(`${COLLECTION}/${key}`);
}

/**
 * The registry document a claim writes.
 * @param {{uid:string, staffId:string, specialty:string, corpsName:string|null, name:string, key:string}} args
 */
function buildClaim({ uid, staffId, specialty, corpsName, name, key }) {
  return {
    name,
    key,
    uid,
    staffId,
    specialty,
    corpsName: corpsName || null,
    claimedAt: new Date().toISOString(),
  };
}

/**
 * Does an existing registry doc block THIS staffer from taking the name?
 * A staffer's own claim (same uid + staffId) never blocks — renaming to the
 * name you already hold, or a retried write, is a no-op.
 * @param {FirebaseFirestore.DocumentSnapshot|null|undefined} snapshot
 * @param {{uid:string, staffId:string}} owner
 * @returns {null|{uid:string, staffId:string, corpsName:string|null, name:string}}
 *   the blocking claim, or null when the name is free for this staffer
 */
function blockingClaim(snapshot, { uid, staffId }) {
  if (!snapshot || !snapshot.exists) return null;
  const claim = snapshot.data() || {};
  if (claim.uid === uid && claim.staffId === staffId) return null;
  return {
    uid: claim.uid || null,
    staffId: claim.staffId || null,
    corpsName: claim.corpsName || null,
    name: claim.name || null,
  };
}

/**
 * The director-facing "taken" error, naming the corps that employs the
 * staffer already carrying the name (the ask: tell them WHO has it).
 * @param {{corpsName:string|null}} claim
 */
function takenError(claim) {
  const who = claim && claim.corpsName ? `the ${claim.corpsName} staff` : "another corps' staff";
  return new HttpsError("already-exists", `That name is already taken — it belongs to ${who}.`);
}

/**
 * READ half of a release: the registry refs for every named member. Fetch
 * these in the transaction's read phase, then hand the snapshots to
 * applyRelease. Members without a name contribute nothing.
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<object|null|undefined>} members staff instances (state.staff values)
 * @returns {Array<{member: object, ref: FirebaseFirestore.DocumentReference}>}
 */
function planRelease(db, members) {
  const plan = [];
  for (const member of members || []) {
    if (!member || !member.id || typeof member.name !== "string" || !member.name) continue;
    const key = member.nameKey || keyFor(member.name);
    if (!key) continue;
    plan.push({ member, ref: nameRef(db, key) });
  }
  return plan;
}

/**
 * APPLY half of a release: delete each registry doc that still belongs to the
 * member it was planned for. A doc held by someone else (a stale name on the
 * member after a moderation clear, say) is left alone — a release must never
 * free a name another corps legitimately holds.
 * @param {FirebaseFirestore.Transaction} transaction
 * @param {Array<{member: object, ref: FirebaseFirestore.DocumentReference}>} plan
 * @param {Array<FirebaseFirestore.DocumentSnapshot>} snapshots index-aligned with plan
 * @returns {number} docs deleted
 */
function applyRelease(transaction, plan, snapshots) {
  let released = 0;
  plan.forEach((entry, i) => {
    const snapshot = snapshots[i];
    if (!snapshot || !snapshot.exists) return;
    const claim = snapshot.data() || {};
    if (claim.staffId !== entry.member.id) return;
    transaction.delete(entry.ref);
    released += 1;
  });
  return released;
}

/**
 * APPLY half of a carry-over: a retained staffer's claim follows the corps
 * into the new season (the corps may have been renamed at registration).
 * Only touches a doc the member still owns — never creates one.
 * @param {FirebaseFirestore.Transaction} transaction
 * @param {Array<{member: object, ref: FirebaseFirestore.DocumentReference}>} plan
 * @param {Array<FirebaseFirestore.DocumentSnapshot>} snapshots index-aligned with plan
 * @param {{corpsName?: string|null, specialty?: string}} patch
 */
function applyCarry(transaction, plan, snapshots, patch) {
  plan.forEach((entry, i) => {
    const snapshot = snapshots[i];
    if (!snapshot || !snapshot.exists) return;
    const claim = snapshot.data() || {};
    if (claim.staffId !== entry.member.id) return;
    transaction.set(entry.ref, { ...patch }, { merge: true });
  });
}

// ---------------------------------------------------------------------------
// Naming privilege (profile.moderation.staffNaming)
// ---------------------------------------------------------------------------

/**
 * The naming privilege as stored on a profile, normalised.
 * @param {object|null|undefined} profile the profile/data document
 * @returns {{revoked:boolean, strikes:number, reason:string|null, history:Array<object>}}
 */
function namingPrivilege(profile) {
  const raw = (profile && profile.moderation && profile.moderation.staffNaming) || {};
  return {
    revoked: raw.revoked === true,
    strikes: Number.isInteger(raw.strikes) && raw.strikes > 0 ? raw.strikes : 0,
    reason: typeof raw.reason === "string" && raw.reason ? raw.reason : null,
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

/**
 * Refuse a naming action for a director whose privilege was revoked.
 * @param {object|null|undefined} profile
 * @throws {HttpsError} permission-denied
 */
function assertMayName(profile) {
  const privilege = namingPrivilege(profile);
  if (privilege.revoked) {
    throw new HttpsError(
      "permission-denied",
      "Staff naming has been disabled on your account" +
        (privilege.reason ? ` (${privilege.reason})` : "") +
        ". Your staff keep working — they just go by their role."
    );
  }
}

/**
 * The privilege after an admin clears a name: one more strike, and revoked
 * once the strikes reach the threshold. Pure.
 * @param {object|null|undefined} profile
 * @param {{name:string, staffId:string, reason:string|null, by:string}} event
 */
function strike(profile, event) {
  const current = namingPrivilege(profile);
  const strikes = current.strikes + 1;
  const autoRevoke = strikes >= STRIKES_TO_REVOKE;
  return {
    revoked: current.revoked || autoRevoke,
    strikes,
    reason: current.revoked
      ? current.reason
      : autoRevoke
        ? `repeated inappropriate staff names (${strikes} removed)`
        : null,
    by: event.by,
    at: new Date().toISOString(),
    history: [
      ...current.history.slice(-(HISTORY_CAP - 1)),
      {
        action: "cleared",
        name: event.name,
        staffId: event.staffId,
        reason: event.reason || null,
        by: event.by,
        at: new Date().toISOString(),
      },
    ],
  };
}

/**
 * The privilege after an admin revokes or restores naming explicitly. Pure.
 * Strikes are kept on restore so a repeat offender's record is visible.
 * @param {object|null|undefined} profile
 * @param {{revoked:boolean, reason:string|null, by:string}} event
 */
function setRevoked(profile, event) {
  const current = namingPrivilege(profile);
  return {
    revoked: event.revoked,
    strikes: current.strikes,
    reason: event.revoked ? event.reason || "staff naming abuse" : null,
    by: event.by,
    at: new Date().toISOString(),
    history: [
      ...current.history.slice(-(HISTORY_CAP - 1)),
      {
        action: event.revoked ? "revoked" : "restored",
        reason: event.reason || null,
        by: event.by,
        at: new Date().toISOString(),
      },
    ],
  };
}

module.exports = {
  COLLECTION,
  NAME_MIN,
  NAME_MAX,
  STRIKES_TO_REVOKE,
  normalizeStaffName,
  keyFor,
  nameRef,
  buildClaim,
  blockingClaim,
  takenError,
  planRelease,
  applyRelease,
  applyCarry,
  namingPrivilege,
  assertMayName,
  strike,
  setRevoked,
};
