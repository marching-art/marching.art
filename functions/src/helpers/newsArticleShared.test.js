// Pins the local Type mirror to the real @google/genai enum. The mirror
// exists so schema literals don't pull the whole SDK into every cold start;
// if a future SDK bump ever changes the enum values, this test fails instead
// of the schemas silently drifting.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

test("local Type mirror matches @google/genai's enum values", () => {
  const { Type: sdkType } = require("@google/genai");
  const { Type: mirror } = require("./newsArticleShared");
  for (const [key, value] of Object.entries(mirror)) {
    assert.equal(sdkType[key], value, `Type.${key} drifted from the SDK`);
  }
});

test("news modules do not load @google/genai at require time", () => {
  const sdkPath = require.resolve("@google/genai");
  // Evaluate in a fresh cache state for the SDK entry.
  delete require.cache[sdkPath];
  require("./newsArticleShared");
  require("./newsDciArticles");
  require("./newsFantasyArticles");
  assert.equal(
    require.cache[sdkPath],
    undefined,
    "@google/genai must only load lazily inside the generation paths"
  );
});
