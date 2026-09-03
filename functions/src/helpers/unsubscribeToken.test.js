process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  deriveUnsubscribeKey,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} = require("./unsubscribeToken");

const key = deriveUnsubscribeKey("xkeysib-test-api-key");

describe("unsubscribe tokens", () => {
  test("a signed token verifies back to its uid", () => {
    const token = signUnsubscribeToken("uid_ABC-123", key);
    assert.equal(verifyUnsubscribeToken(token, key), "uid_ABC-123");
  });

  test("tampering with the uid or the signature fails", () => {
    const token = signUnsubscribeToken("alice", key);
    const [, sig] = token.split(".");
    assert.equal(verifyUnsubscribeToken(`bob.${sig}`, key), null);
    assert.equal(verifyUnsubscribeToken(`alice.${sig.slice(0, -1)}x`, key), null);
    assert.equal(verifyUnsubscribeToken("alice", key), null);
    assert.equal(verifyUnsubscribeToken("alice.", key), null);
    assert.equal(verifyUnsubscribeToken(".abc", key), null);
    assert.equal(verifyUnsubscribeToken(42, key), null);
  });

  test("a rotated API key invalidates old tokens", () => {
    const token = signUnsubscribeToken("alice", key);
    assert.equal(verifyUnsubscribeToken(token, deriveUnsubscribeKey("other-key")), null);
  });

  test("no API key means no key and nothing verifies", () => {
    assert.equal(deriveUnsubscribeKey(""), null);
    assert.equal(deriveUnsubscribeKey(undefined), null);
    assert.equal(verifyUnsubscribeToken("alice.sig", null), null);
  });

  test("the URL is absolute, on /unsubscribe, and needs no encoding", () => {
    const url = buildUnsubscribeUrl("alice", key, "https://marching.art");
    assert.match(url, /^https:\/\/marching\.art\/unsubscribe\?t=alice\.[A-Za-z0-9_-]+$/);
    assert.equal(encodeURIComponent(url.split("t=")[1]), url.split("t=")[1]);
  });
});
