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

/**
 * Pull the monthly USD amount out of a membership payload/record. BMAC's
 * membership object gives coffee price × count; we tolerate a few field-name
 * shapes because the webhook `data` schema and the REST record differ slightly.
 * @returns {number} 0 when nothing parseable is found.
 */
function extractMonthlyAmount(data) {
  if (!data || typeof data !== "object") return 0;
  const price = Number(
    data.subscription_coffee_price ?? data.coffee_price ?? data.amount ?? 0
  );
  const num = Number(
    data.subscription_coffee_num ?? data.coffee_num ?? 1
  );
  if (!Number.isFinite(price) || price <= 0) return 0;
  const count = Number.isFinite(num) && num > 0 ? num : 1;
  // `amount` (when present) is already the total; only multiply the per-coffee
  // price by the count.
  if (data.subscription_coffee_price == null && data.coffee_price == null) {
    return price;
  }
  return price * count;
}

function extractEmail(data) {
  if (!data || typeof data !== "object") return "";
  return normalizeEmail(
    data.payer_email || data.email || data.support_email || ""
  );
}

/**
 * Normalize a raw BMAC webhook body into the fields our upsert needs, or null
 * when the event isn't a recurring-support lifecycle event we act on.
 *
 * @param {object} body parsed webhook envelope { type, event_id, data }
 * @returns {null | {
 *   type: string, eventId: number|null, active: boolean,
 *   email: string, emailHash: string|null, payerName: string,
 *   monthlyAmount: number, tier: string|null, currency: string,
 * }}
 */
function parseSupporterEvent(body) {
  if (!body || typeof body !== "object") return null;
  const type = body.type;
  const isActive = ACTIVE_EVENTS.has(type);
  const isEnded = ENDED_EVENTS.has(type);
  if (!isActive && !isEnded) return null;

  const data = body.data || {};
  const email = extractEmail(data);
  const emailHash = hashEmail(email);
  if (!emailHash) return null; // can't key/match without an email

  const monthlyAmount = extractMonthlyAmount(data);
  return {
    type,
    eventId: Number.isFinite(Number(body.event_id))
      ? Number(body.event_id)
      : null,
    active: isActive,
    email,
    emailHash,
    payerName:
      typeof data.payer_name === "string" ? data.payer_name.slice(0, 120) : "",
    monthlyAmount,
    tier: isActive ? tierFromMonthlyAmount(monthlyAmount) : null,
    currency:
      typeof data.subscription_currency === "string"
        ? data.subscription_currency.toUpperCase()
        : "USD",
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
