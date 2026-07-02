// Unit tests for the shared onCall request guards. Uses Node's built-in test
// runner (node:test). Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { assertAuth, assertAdmin } = require("./callableGuards");

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
