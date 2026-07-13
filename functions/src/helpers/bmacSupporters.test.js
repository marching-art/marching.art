// Tests for the pure Buy Me a Coffee supporter helpers.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  tierFromMonthlyAmount,
  normalizeEmail,
  hashEmail,
  verifyWebhookSignature,
  extractMonthlyAmount,
  parseSupporterEvent,
} = require("./bmacSupporters");

describe("tierFromMonthlyAmount", () => {
  test("maps amounts to the highest cleared tier floor", () => {
    assert.equal(tierFromMonthlyAmount(3), "rookie");
    assert.equal(tierFromMonthlyAmount(5.99), "rookie");
    assert.equal(tierFromMonthlyAmount(6), "veteran");
    assert.equal(tierFromMonthlyAmount(11.99), "veteran");
    assert.equal(tierFromMonthlyAmount(12), "staff");
    assert.equal(tierFromMonthlyAmount(24), "staff");
    assert.equal(tierFromMonthlyAmount(25), "corps_angel");
    assert.equal(tierFromMonthlyAmount(100), "corps_angel");
  });

  test("returns null below the lowest floor or for junk", () => {
    assert.equal(tierFromMonthlyAmount(2.99), null);
    assert.equal(tierFromMonthlyAmount(0), null);
    assert.equal(tierFromMonthlyAmount(-5), null);
    assert.equal(tierFromMonthlyAmount("nope"), null);
    assert.equal(tierFromMonthlyAmount(undefined), null);
  });

  test("tolerates float rounding just under a floor", () => {
    assert.equal(tierFromMonthlyAmount(6 - 1e-12), "veteran");
  });
});

describe("normalizeEmail / hashEmail", () => {
  test("normalizes case and whitespace", () => {
    assert.equal(normalizeEmail("  Chris@Example.COM "), "chris@example.com");
    assert.equal(normalizeEmail(null), "");
  });

  test("hash is stable across case/whitespace and null-safe", () => {
    assert.equal(hashEmail(" A@B.com"), hashEmail("a@b.com"));
    assert.equal(hashEmail(""), null);
    assert.equal(hashEmail(null), null);
    assert.equal(hashEmail("a@b.com").length, 64);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "shhh-signing-secret";
  const body = JSON.stringify({ type: "membership.started", event_id: 1 });
  const sign = (b, s) =>
    crypto.createHmac("sha256", s).update(b).digest("hex");

  test("accepts a correct signature", () => {
    assert.equal(verifyWebhookSignature(body, sign(body, secret), secret), true);
  });

  test("rejects a wrong signature, secret, or tampered body", () => {
    assert.equal(verifyWebhookSignature(body, sign(body, "other"), secret), false);
    assert.equal(verifyWebhookSignature(body, sign(body, secret), "other"), false);
    assert.equal(
      verifyWebhookSignature(body + " ", sign(body, secret), secret),
      false
    );
  });

  test("rejects missing inputs", () => {
    assert.equal(verifyWebhookSignature(body, "", secret), false);
    assert.equal(verifyWebhookSignature(body, sign(body, secret), ""), false);
    assert.equal(verifyWebhookSignature(null, sign(body, secret), secret), false);
  });
});

describe("extractMonthlyAmount", () => {
  test("multiplies coffee price by count", () => {
    assert.equal(
      extractMonthlyAmount({ subscription_coffee_price: "3.00", subscription_coffee_num: 2 }),
      6
    );
    assert.equal(
      extractMonthlyAmount({ coffee_price: "5", coffee_num: 5 }),
      25
    );
  });

  test("defaults count to 1 and uses a bare amount as-is", () => {
    assert.equal(extractMonthlyAmount({ subscription_coffee_price: "12" }), 12);
    assert.equal(extractMonthlyAmount({ amount: 25 }), 25);
  });

  test("uses the webhook `amount` field directly (subscription events)", () => {
    assert.equal(extractMonthlyAmount({ amount: 6, duration_type: "month" }), 6);
  });

  test("normalizes a yearly plan to its monthly-equivalent", () => {
    assert.equal(extractMonthlyAmount({ amount: 72, duration_type: "year" }), 6);
    assert.equal(extractMonthlyAmount({ amount: 300, duration_type: "year" }), 25);
  });

  test("returns 0 for junk", () => {
    assert.equal(extractMonthlyAmount(null), 0);
    assert.equal(extractMonthlyAmount({}), 0);
    assert.equal(extractMonthlyAmount({ subscription_coffee_price: "0" }), 0);
  });
});

describe("parseSupporterEvent", () => {
  const startBody = {
    type: "membership.started",
    event_id: 42,
    data: {
      payer_email: "Fan@Example.com",
      payer_name: "A Fan",
      subscription_coffee_price: "6.00",
      subscription_coffee_num: 1,
      subscription_currency: "usd",
    },
  };

  test("parses an active membership into a tier", () => {
    const parsed = parseSupporterEvent(startBody);
    assert.equal(parsed.active, true);
    assert.equal(parsed.tier, "veteran");
    assert.equal(parsed.monthlyAmount, 6);
    assert.equal(parsed.email, "fan@example.com");
    assert.equal(parsed.emailHash, hashEmail("fan@example.com"));
    assert.equal(parsed.payerName, "A Fan");
    assert.equal(parsed.eventId, 42);
    assert.equal(parsed.currency, "USD");
  });

  test("cancellation is inactive with no tier", () => {
    const parsed = parseSupporterEvent({
      type: "membership.cancelled",
      event_id: 43,
      data: { payer_email: "fan@example.com" },
    });
    assert.equal(parsed.active, false);
    assert.equal(parsed.tier, null);
  });

  test("ignores unrelated events and missing email", () => {
    assert.equal(parseSupporterEvent({ type: "donation.created", data: {} }), null);
    assert.equal(parseSupporterEvent({ type: "extra_purchase.created" }), null);
    assert.equal(
      parseSupporterEvent({ type: "membership.started", data: {} }),
      null
    );
    assert.equal(parseSupporterEvent(null), null);
  });

  // Real BMAC webhook payload shape (SubscriptionFields): supporter_email,
  // amount, status, membership_level_name — distinct from the REST record.
  const webhookStart = {
    type: "membership.started",
    event_id: 7,
    live_mode: true,
    data: {
      object: "membership",
      supporter_email: "Angel@Example.com",
      supporter_name: "Big Angel",
      amount: 25,
      currency: "USD",
      duration_type: "month",
      status: "active",
      membership_level_id: 3,
      membership_level_name: "Corps Angel",
    },
  };

  test("parses the real webhook membership payload", () => {
    const parsed = parseSupporterEvent(webhookStart);
    assert.equal(parsed.active, true);
    assert.equal(parsed.tier, "corps_angel");
    assert.equal(parsed.monthlyAmount, 25);
    assert.equal(parsed.email, "angel@example.com");
    assert.equal(parsed.payerName, "Big Angel");
    assert.equal(parsed.levelName, "Corps Angel");
    assert.equal(parsed.currency, "USD");
  });

  test("a yearly membership maps by monthly-equivalent", () => {
    const parsed = parseSupporterEvent({
      type: "membership.started",
      data: { supporter_email: "y@example.com", amount: 72, duration_type: "year", status: "active" },
    });
    assert.equal(parsed.tier, "veteran");
  });

  test("membership.updated with a canceled status is inactive", () => {
    const parsed = parseSupporterEvent({
      type: "membership.updated",
      data: { supporter_email: "x@example.com", amount: 12, status: "canceled" },
    });
    assert.equal(parsed.active, false);
    assert.equal(parsed.tier, null);
  });

  test("cancel_at_period_end while still active keeps flair", () => {
    const parsed = parseSupporterEvent({
      type: "membership.updated",
      data: {
        supporter_email: "x@example.com",
        amount: 12,
        status: "active",
        cancel_at_period_end: "true",
      },
    });
    assert.equal(parsed.active, true);
    assert.equal(parsed.tier, "staff");
  });
});
