// Firestore write layer for Buy Me a Coffee supporters. Shared by the webhook
// (real-time) and the nightly reconcile job so both apply state identically.
//
// A supporter doc (artifacts/{ns}/supporters/{emailHash}) tracks two
// independent dimensions:
//   - recurring: a membership / monthly-support tier (rookie…corps_angel),
//     which the nightly reconcile keeps in sync and revokes when it lapses.
//   - one-time:  a temporary "friend" recognition earned by one-time donations,
//     lasting a duration proportional to the amount (see ONE_TIME_DAYS_PER_DOLLAR)
//     and stacking across donations. Stored as an expiry timestamp.
// The effective display tier: an active recurring tier wins; otherwise an
// unexpired one-time donor shows as 'friend'; otherwise no flair. Expiry is
// enforced by the nightly reconcile, which recomputes every active doc.
//
// When the doc is linked to a marching.art account (uid set) we mirror a
// server-only `supporter` object onto that profile so flair renders.

const admin = require("firebase-admin");
const { paths } = require("./paths");

const DAY_MS = 24 * 60 * 60 * 1000;
// One-time donation → this many days of "friend" flair per US dollar donated,
// clamped to [MIN, MAX]. Tuned so recurring always stays the better deal: $3
// one-time = 21 days of the lesser generic badge vs. $3/mo = 30 renewing days
// of the higher Rookie badge.
const ONE_TIME_DAYS_PER_DOLLAR = 7;
const ONE_TIME_MIN_DAYS = 7;
const ONE_TIME_MAX_DAYS = 365;

/** Days of one-time recognition earned for a donation of `amount` USD. */
function oneTimeDaysForAmount(amount) {
  const a = Number(amount);
  const raw = Number.isFinite(a) && a > 0 ? Math.round(a * ONE_TIME_DAYS_PER_DOLLAR) : 0;
  return Math.min(ONE_TIME_MAX_DAYS, Math.max(ONE_TIME_MIN_DAYS, raw));
}

/** The server-only object mirrored onto profile.supporter for flair rendering. */
function buildProfileSupporter({
  tier,
  emailHash,
  since,
  anonymous = false,
  message = null,
  until = null,
}) {
  return {
    tier,
    source: "bmac",
    emailHash,
    since: since ?? null,
    anonymous: anonymous === true,
    message: tier === "corps_angel" ? message ?? null : null,
    // When the one-time 'friend' recognition expires (null for recurring tiers).
    until: tier === "friend" ? until ?? null : null,
  };
}

/**
 * Core upsert: merge a patch into the supporter doc, recompute the effective
 * tier/active state (honoring one-time expiry), and mirror flair onto the
 * linked profile.
 *
 * patch fields: recurringActive?, recurringTier?, extendOneTimeDays?,
 * oneTimeExpiresMs? (null to revoke).
 *
 * @param {boolean} [opts.createIfAbsent=true] skip when the doc is absent
 *   (revoke/refresh paths pass false so they don't create empty docs).
 */
async function writeSupporterState(db, emailHash, { meta, patch = {}, createIfAbsent = true }) {
  const ref = db.doc(paths.supporter(emailHash));
  const nowMs = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists && !createIfAbsent) return;
    const ex = snap.exists ? snap.data() : {};
    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    const recurringActive = patch.recurringActive ?? ex.recurringActive ?? false;
    const recurringTier =
      patch.recurringActive === false
        ? null
        : patch.recurringTier ?? ex.recurringTier ?? null;

    // Resolve one-time expiry (ms epoch): extend, set explicitly, or inherit.
    const exExpiresMs =
      typeof ex.oneTimeExpiresAt?.toMillis === "function" ? ex.oneTimeExpiresAt.toMillis() : null;
    let oneTimeExpiresMs;
    if (patch.extendOneTimeDays != null) {
      const base = Math.max(nowMs, exExpiresMs ?? 0);
      oneTimeExpiresMs = base + patch.extendOneTimeDays * DAY_MS;
    } else if (patch.oneTimeExpiresMs !== undefined) {
      oneTimeExpiresMs = patch.oneTimeExpiresMs; // number or null (revoke)
    } else {
      oneTimeExpiresMs = exExpiresMs;
    }
    const oneTimeActive = oneTimeExpiresMs != null && oneTimeExpiresMs > nowMs;

    const tier =
      recurringActive && recurringTier ? recurringTier : oneTimeActive ? "friend" : null;
    const active = tier !== null;
    const since = ex.since ?? nowTs;
    const anonymous = ex.anonymous ?? false;
    const message = ex.message ?? null;
    const oneTimeExpiresAt =
      oneTimeExpiresMs != null ? admin.firestore.Timestamp.fromMillis(oneTimeExpiresMs) : null;

    tx.set(
      ref,
      {
        emailHash,
        email: meta?.email ?? ex.email ?? null,
        payerName: meta?.payerName || ex.payerName || "",
        recurringActive,
        recurringTier,
        oneTimeExpiresAt,
        tier,
        active,
        coffeeAmount: meta?.monthlyAmount ?? ex.coffeeAmount ?? null,
        currency: meta?.currency ?? ex.currency ?? "USD",
        levelName: meta?.levelName ?? ex.levelName ?? null,
        anonymous,
        message,
        uid: ex.uid ?? null,
        displayName: ex.displayName ?? null,
        username: ex.username ?? null,
        lastEventId: meta?.eventId ?? ex.lastEventId ?? null,
        since,
        createdAt: ex.createdAt ?? nowTs,
        updatedAt: nowTs,
      },
      { merge: true }
    );

    if (ex.uid) {
      tx.set(
        db.doc(paths.userProfile(ex.uid)),
        {
          supporter: tier
            ? buildProfileSupporter({
                tier,
                emailHash,
                since,
                anonymous,
                message,
                until: oneTimeExpiresAt,
              })
            : null,
        },
        { merge: true }
      );
    }
  });
}

/** Upsert an active recurring supporter (membership / monthly support). */
async function applyActiveSupport(db, parsed) {
  await writeSupporterState(db, parsed.emailHash, {
    meta: parsed,
    patch: { recurringActive: true, recurringTier: parsed.tier },
  });
}

/**
 * Clear the recurring dimension (cancelled/paused/lapsed) and recompute. Keeps
 * an unexpired one-time 'friend' recognition; strips flair entirely otherwise.
 * Also serves as the nightly expiry check (recompute drops expired one-timers).
 * Won't create a doc that doesn't exist.
 */
async function applyInactiveSupport(db, emailHash) {
  await writeSupporterState(db, emailHash, {
    patch: { recurringActive: false },
    createIfAbsent: false,
  });
}

/** Grant/extend the temporary one-time 'friend' recognition by the donation amount. */
async function applyOneTimeSupport(db, parsed) {
  await writeSupporterState(db, parsed.emailHash, {
    meta: parsed,
    patch: { extendOneTimeDays: oneTimeDaysForAmount(parsed.amount) },
  });
}

/** Remove the one-time recognition (donation refunded). */
async function revokeOneTimeSupport(db, emailHash) {
  await writeSupporterState(db, emailHash, {
    patch: { oneTimeExpiresMs: null },
    createIfAbsent: false,
  });
}

module.exports = {
  ONE_TIME_DAYS_PER_DOLLAR,
  oneTimeDaysForAmount,
  buildProfileSupporter,
  applyActiveSupport,
  applyInactiveSupport,
  applyOneTimeSupport,
  revokeOneTimeSupport,
};
