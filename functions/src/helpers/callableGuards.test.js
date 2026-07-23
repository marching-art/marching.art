// Unit tests for the shared onCall request guards. Uses Node's built-in test
// runner (node:test). Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { assertAuth, assertAdmin, hasAdminClaim, clampLimit } = require("./callableGuards");

describe("assertAuth", () => {
  test("throws unauthenticated when there is no auth context", () => {
    assert.throws(
      () => assertAuth({ data: {}, auth: null }),
      (err) => err.code === "functions/unauthenticated" || err.code === "unauthenticated"
    );
  });

  test("throws unauthenticated when auth is undefined", () => {
    assert.throws(() => assertAuth({ data: {} }), /logged in/);
  });

  test("returns the caller uid when authenticated", () => {
    const uid = assertAuth({ data: {}, auth: { uid: "user-1", token: {} } });
    assert.equal(uid, "user-1");
  });
});

describe("assertAdmin", () => {
  test("throws unauthenticated before checking the claim", () => {
    assert.throws(() => assertAdmin({ data: {}, auth: null }), /logged in/);
  });

  test("throws permission-denied for a non-admin user", () => {
    assert.throws(
      () => assertAdmin({ data: {}, auth: { uid: "user-1", token: {} } }),
      /admin/
    );
  });

  test("throws permission-denied when the claim is not exactly true", () => {
    assert.throws(
      () => assertAdmin({ data: {}, auth: { uid: "user-1", token: { admin: "yes" } } }),
      /admin/
    );
  });

  test("returns the caller uid for an admin", () => {
    const uid = assertAdmin({
      data: {},
      auth: { uid: "admin-1", token: { admin: true } },
    });
    assert.equal(uid, "admin-1");
  });
});

describe("hasAdminClaim", () => {
  test("true only when the claim is exactly true", () => {
    assert.equal(hasAdminClaim({ auth: { uid: "a", token: { admin: true } } }), true);
    assert.equal(hasAdminClaim({ auth: { uid: "a", token: { admin: "yes" } } }), false);
    assert.equal(hasAdminClaim({ auth: { uid: "a", token: {} } }), false);
  });

  test("is null-safe on missing auth or token (never throws)", () => {
    // This is the case the old `request.auth.token.admin` check crashed on.
    assert.equal(hasAdminClaim({ auth: null }), false);
    assert.equal(hasAdminClaim({}), false);
    assert.equal(hasAdminClaim({ auth: { uid: "a" } }), false);
  });
});

describe("clampLimit", () => {
  test("passes through an in-range integer", () => {
    assert.equal(clampLimit(25), 25);
  });

  test("caps above max and floors below min", () => {
    assert.equal(clampLimit(5_000_000), 100);
    assert.equal(clampLimit(0), 1);
    assert.equal(clampLimit(-10), 1);
  });

  test("respects custom bounds", () => {
    assert.equal(clampLimit(9999, { max: 500 }), 500);
    assert.equal(clampLimit(3, { min: 5 }), 5);
  });

  test("floors non-integers and coerces numeric strings", () => {
    assert.equal(clampLimit(12.9), 12);
    assert.equal(clampLimit("30"), 30);
  });

  test("falls back on absent / non-numeric / NaN / Infinity input", () => {
    assert.equal(clampLimit(undefined), 50);
    assert.equal(clampLimit(null, { fallback: 20 }), 20);
    assert.equal(clampLimit("abc"), 50);
    assert.equal(clampLimit(NaN), 50);
    assert.equal(clampLimit(Infinity), 50);
  });
});
