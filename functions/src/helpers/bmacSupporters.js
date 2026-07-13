// Buy Me a Coffee supporter helpers — PURE module (no firebase imports) so the
// node:test suite can exercise it directly and CI fails if the client tier
// mirror (src/utils/supporterTiers.ts) drifts.
//
// marching.art is donation-only: CorpsCoin is never bought, and competitive
// flair is earned. Supporter tiers therefore grant ONLY cosmetic recognition
// (a profile heart/frame/badge + a spot on the Supporters wall) and a Discord
// role handled natively by BMAC — never CorpsCoin, XP, unlocks, or any
// competitive edge. Keep it that way.
//
// BMAC's membership webhook/API does NOT send a tier NAME — only the monthly
// coffee price and count. We derive the tier from the monthly USD amount, so
// the tier prices below must stay distinct and match the BMAC membership
// levels the creator configures.

const crypto = require("crypto");

// Ordered low→high. `minAmount` is the monthly USD floor for the tier; an
// amount is mapped to the highest tier whose floor it clears.
const SUPPORTER_TIERS = [
  { id: "rookie", name: "Rookie", minAmount: 3 },
  { id: "veteran", name: "Veteran", minAmount: 6 },
  { id: "staff", name: "Staff", minAmount: 12 },
  { id: "corps_angel", name: "Corps Angel", minAmount: 25 },
];

const TIER_RANK = SUPPORTER_TIERS.reduce((acc, t, i) => {
  acc[t.id] = i;
  return acc;
}, {});

/**
 * Map a monthly USD amount to a supporter tier id, or null if it clears no
 * tier floor (e.g. a sub-$3 legacy membership).
 * @param {number} usd
 * @returns {string|null}
 */
function tierFromMonthlyAmount(usd) {
  const amount = Number(usd);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let match = null;
  for (const tier of SUPPORTER_TIERS) {
    if (amount + 1e-9 >= tier.minAmount) match = tier.id;
  }
  return match;
}

/** Lowercase + trim an email for stable hashing/matching. */
function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * SHA-256 hex of the normalized email. We key supporter docs by this hash and
 * avoid storing raw emails in any client-readable place (PII hygiene).
 * @returns {string|null} null when the email is empty/invalid.
 */
function hashEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Constant-time verify of a BMAC webhook. BMAC signs the raw request body with
 * HMAC-SHA256 and sends the hex digest in the `x-signature-sha256` header.
 * @param {Buffer|string} rawBody exact bytes of the request body
 * @param {string} signatureHeader value of x-signature-sha256
 * @param {string} secret webhook signing secret
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret || rawBody == null) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(String(signatureHeader), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Event types that mean "this person is (still) an active recurring supporter".
const ACTIVE_EVENTS = new Set([
  "membership.started",
  "membership.updated",
  "recurring_donation.started",
  "recurring_donation.updated",
]);

// Event types that end a recurring supporter's flair.
const ENDED_EVENTS = new Set([
  "membership.cancelled",
  "membership.paused",
  "recurring_donation.cancelled",
]);

/** month | year — webhook uses `duration_type`, the REST record uses `subscription_duration_type`. */
function extractDurationType(data) {
  return data.duration_type || data.subscription_duration_type || "month";
}

/**
 * Monthly-equivalent USD for a subscription. Two payload shapes are handled:
 *  - Webhook membership/recurring_donation events send `amount` (the per-period
 *    charge) directly (see the BMAC webhook OpenAPI SubscriptionFields).
 *  - REST /subscriptions records send coffee price × count.
 * Yearly plans are normalized to a monthly figure so they compare against the
 * same tier floors. @returns {number} 0 when nothing parseable is found.
 */
function extractMonthlyAmount(data) {
  if (!data || typeof data !== "object") return 0;
  let total;
  if (data.amount != null) {
    // Webhook subscription events: `amount` is the full per-period charge.
    total = Number(data.amount);
  } else {
    // REST subscription record: per-coffee price × number of coffees.
    const price = Number(data.subscription_coffee_price ?? data.coffee_price ?? 0);
    const num = Number(data.subscription_coffee_num ?? data.coffee_num ?? 1);
    const count = Number.isFinite(num) && num > 0 ? num : 1;
    total = price * count;
  }
  if (!Number.isFinite(total) || total <= 0) return 0;
  // A yearly plan's charge covers 12 months — compare its monthly-equivalent.
  if (extractDurationType(data) === "year") total = total / 12;
  return total;
}

function extractEmail(data) {
  if (!data || typeof data !== "object") return "";
  // Webhook payloads use `supporter_email`; REST records use `payer_email`.
  return normalizeEmail(
    data.supporter_email || data.payer_email || data.email || data.support_email || ""
  );
}

function extractPayerName(data) {
  const name = data.supporter_name || data.payer_name || "";
  return typeof name === "string" ? name.slice(0, 120) : "";
}

/**
 * Whether a subscription payload represents a currently-active supporter. The
 * explicit status/flags on the payload win when present (so a `membership.updated`
 * that is really a cancellation or pause is treated as inactive); otherwise we
 * fall back to the event-type classification. Note: `cancel_at_period_end` is
 * NOT treated as inactive — the supporter keeps flair until the period actually
 * ends and the `membership.cancelled` event fires.
 */
function isActiveSubscription(type, data) {
  const status = data.status; // active | canceled | paused
  if (status === "canceled" || status === "paused") return false;
  if (
    data.canceled === "true" ||
    data.paused === "true" ||
    data.subscription_is_cancelled === "true"
  ) {
    return false;
  }
  if (status === "active") return true;
  if (ENDED_EVENTS.has(type)) return false;
  return ACTIVE_EVENTS.has(type);
}

/**
 * Normalize a raw BMAC webhook body (or a REST subscription record wrapped in a
 * synthetic envelope) into the fields our upsert needs, or null when the event
 * isn't a recurring-support lifecycle event we act on.
 *
 * @param {object} body parsed webhook envelope { type, event_id, data }
 * @returns {null | {
 *   type: string, eventId: number|null, active: boolean,
 *   email: string, emailHash: string|null, payerName: string,
 *   monthlyAmount: number, tier: string|null, currency: string,
 *   levelName: string|null,
 * }}
 */
function parseSupporterEvent(body) {
  if (!body || typeof body !== "object") return null;
  const type = body.type;
  if (!ACTIVE_EVENTS.has(type) && !ENDED_EVENTS.has(type)) return null;

  const data = body.data || {};
  const email = extractEmail(data);
  const emailHash = hashEmail(email);
  if (!emailHash) return null; // can't key/match without an email

  const active = isActiveSubscription(type, data);
  const monthlyAmount = extractMonthlyAmount(data);
  return {
    type,
    eventId: Number.isFinite(Number(body.event_id)) ? Number(body.event_id) : null,
    active,
    email,
    emailHash,
    payerName: extractPayerName(data),
    monthlyAmount,
    tier: active ? tierFromMonthlyAmount(monthlyAmount) : null,
    currency:
      typeof (data.currency || data.subscription_currency) === "string"
        ? (data.currency || data.subscription_currency).toUpperCase()
        : "USD",
    levelName:
      typeof data.membership_level_name === "string"
        ? data.membership_level_name
        : null,
  };
}

module.exports = {
  SUPPORTER_TIERS,
  TIER_RANK,
  ACTIVE_EVENTS,
  ENDED_EVENTS,
  tierFromMonthlyAmount,
  normalizeEmail,
  hashEmail,
  verifyWebhookSignature,
  extractMonthlyAmount,
  parseSupporterEvent,
};
