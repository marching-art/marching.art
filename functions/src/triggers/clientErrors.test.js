// Tests for the /api/errors intake: method/size/shape guards, the field
// allowlist, and the per-instance volume bucket. node:test; `npm test` in
// functions/.
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  reportClientErrorHttp,
  sanitizeClientError,
  resetBucketForTesting,
  MAX_BODY_BYTES,
  BUCKET_CAPACITY,
} = require("./clientErrors");

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    ended: false,
    on() {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
    set(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function post(payload, { raw } = {}) {
  const text = raw ?? JSON.stringify(payload);
  return { method: "POST", headers: {}, rawBody: Buffer.from(text, "utf8"), body: text, ip: "1.2.3.4" };
}

describe("sanitizeClientError", () => {
  test("keeps only allowlisted fields, capped", () => {
    const out = sanitizeClientError({
      message: "x".repeat(5000),
      name: "TypeError",
      stack: "at foo",
      line: 12,
      column: 3.5,
      corpsCoin: 999999,
      nested: { a: 1 },
      url: 42,
    });
    assert.equal(out.message.length, 1000);
    assert.equal(out.name, "TypeError");
    assert.equal(out.line, 12);
    assert.equal(out.column, 3.5);
    assert.equal("corpsCoin" in out, false);
    assert.equal("nested" in out, false);
    assert.equal("url" in out, false);
  });

  test("rejects payloads without a message, arrays, and primitives", () => {
    assert.equal(sanitizeClientError({ name: "Error" }), null);
    assert.equal(sanitizeClientError([{ message: "x" }]), null);
    assert.equal(sanitizeClientError("message"), null);
    assert.equal(sanitizeClientError(null), null);
  });
});

describe("reportClientErrorHttp", () => {
  beforeEach(() => resetBucketForTesting());

  test("accepts a well-formed report with 204 and no-store", async () => {
    const res = makeRes();
    await reportClientErrorHttp(post({ message: "boom", source: "unit" }), res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.ended, true);
  });

  test("rejects non-POST with 405", async () => {
    const res = makeRes();
    await reportClientErrorHttp({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, "POST");
  });

  test("rejects oversized bodies with 413", async () => {
    const res = makeRes();
    const big = JSON.stringify({ message: "m", stack: "s".repeat(MAX_BODY_BYTES) });
    await reportClientErrorHttp(post(null, { raw: big }), res);
    assert.equal(res.statusCode, 413);
  });

  test("rejects malformed JSON and message-less payloads with 400", async () => {
    let res = makeRes();
    await reportClientErrorHttp(post(null, { raw: "{not json" }), res);
    assert.equal(res.statusCode, 400);
    res = makeRes();
    await reportClientErrorHttp(post({ name: "Error" }), res);
    assert.equal(res.statusCode, 400);
  });

  test("returns 429 once the per-instance bucket is spent", async () => {
    for (let i = 0; i < BUCKET_CAPACITY; i += 1) {
      const res = makeRes();
      await reportClientErrorHttp(post({ message: `e${i}` }), res);
      assert.equal(res.statusCode, 204);
    }
    const res = makeRes();
    await reportClientErrorHttp(post({ message: "one too many" }), res);
    assert.equal(res.statusCode, 429);
  });
});
