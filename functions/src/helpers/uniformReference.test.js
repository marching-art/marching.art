// The rendered-figure reference loader must never throw and must only turn
// our own https preview URLs into image parts, each with its caption.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  loadUniformReferenceImages,
  fetchImageAsBase64,
  CORPS_CAPTION,
  GUARD_CAPTION,
  MAX_REFERENCE_BYTES,
} = require("./uniformReference");

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

/** A fake fetch serving one fixed response shape. */
function stubFetch({ ok = true, contentType = "image/png", body = "PNGDATA", contentLength } = {}) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return {
      ok,
      headers: {
        get: (name) => {
          const key = name.toLowerCase();
          if (key === "content-type") return contentType;
          if (key === "content-length") return contentLength == null ? null : String(contentLength);
          return null;
        },
      },
      arrayBuffer: async () => Buffer.from(body),
    };
  };
  return calls;
}

test("fetchImageAsBase64 only accepts https URLs", async () => {
  const calls = stubFetch();
  assert.equal(await fetchImageAsBase64("http://example.com/a.png"), null);
  assert.equal(await fetchImageAsBase64("data:image/png;base64,AAAA"), null);
  assert.equal(await fetchImageAsBase64(null), null);
  assert.equal(calls.length, 0);
});

test("fetchImageAsBase64 returns base64 + mime for an image response", async () => {
  stubFetch({ contentType: "image/jpg; charset=binary", body: "hello" });
  const ref = await fetchImageAsBase64("https://res.cloudinary.com/x/uniform.png");
  assert.deepEqual(ref, { data: Buffer.from("hello").toString("base64"), mimeType: "image/jpeg" });
});

test("fetchImageAsBase64 rejects non-images, errors, and oversized bodies", async () => {
  stubFetch({ contentType: "text/html" });
  assert.equal(await fetchImageAsBase64("https://example.com/a"), null);
  stubFetch({ ok: false });
  assert.equal(await fetchImageAsBase64("https://example.com/a.png"), null);
  stubFetch({ contentLength: MAX_REFERENCE_BYTES + 1 });
  assert.equal(await fetchImageAsBase64("https://example.com/big.png"), null);
  global.fetch = async () => {
    throw new Error("network down");
  };
  assert.equal(await fetchImageAsBase64("https://example.com/a.png"), null);
});

test("loadUniformReferenceImages attaches corps + guard previews with captions", async () => {
  const calls = stubFetch();
  const refs = await loadUniformReferenceImages({
    previewUrl: "https://res.cloudinary.com/x/corps.png",
    guard: { previewUrl: "https://res.cloudinary.com/x/guard.png" },
  });
  assert.equal(refs.length, 2);
  assert.equal(refs[0].caption, CORPS_CAPTION);
  assert.equal(refs[1].caption, GUARD_CAPTION);
  assert.equal(refs[0].mimeType, "image/png");
  assert.deepEqual(calls, [
    "https://res.cloudinary.com/x/corps.png",
    "https://res.cloudinary.com/x/guard.png",
  ]);
});

test("loadUniformReferenceImages is empty for designs without previews", async () => {
  const calls = stubFetch();
  assert.deepEqual(await loadUniformReferenceImages(null), []);
  assert.deepEqual(await loadUniformReferenceImages({ colorway: {}, figure: {} }), []);
  assert.deepEqual(await loadUniformReferenceImages({ guard: {} }), []);
  assert.equal(calls.length, 0);
});
