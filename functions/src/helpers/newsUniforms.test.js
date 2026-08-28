// Tests for resolveCorpsUniformDesign: the bridge that lets the news/image
// pipeline drive a corps' AI imagery from its equipped Uniform Studio (v2)
// design — accurate colors and hat — instead of the lossy/possibly-stale v1
// prose compat that made images drift to generic looks.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { resolveCorpsUniformDesign, getFantasyUniformDetails } = require("./newsUniforms");

// A green-and-gold, shako-wearing corps like the reference share card.
const equippedCorps = () => ({
  location: "Lexington, KY",
  uniformDesign: {
    style: "traditional",
    helmetStyle: "shako",
    mascotOrEmblem: "laurel crest",
    avatarStyle: "performer",
  },
  uniform: {
    name: "Unspecified",
    colorway: { primary: "#1f6b3a", secondary: "#14532d", accent: "#e0a516", metal: "gold" },
    figure: { hatType: "shako", plume: { type: "upright", color: "#1f6b3a" }, chest: "buttons" },
  },
});

test("resolveCorpsUniformDesign derives accurate colors from the equipped v2 snapshot", () => {
  const resolved = resolveCorpsUniformDesign(equippedCorps());
  assert.equal(resolved.primaryColor, "forest green");
  assert.equal(resolved.accentColor, "gold");
  // Exact hex channels are pinned so the prompt can target the true shade.
  assert.equal(resolved.primaryHex, "#1f6b3a");
  assert.equal(resolved.secondaryHex, "#14532d");
  assert.equal(resolved.accentHex, "#e0a516");
  // The shako reads through from the figure, not the (arbitrary) v1 field.
  assert.equal(resolved.helmetStyle, "shako");
});

test("resolveCorpsUniformDesign preserves v1-only enrichments (mascot, avatar prefs)", () => {
  const resolved = resolveCorpsUniformDesign(equippedCorps());
  assert.equal(resolved.mascotOrEmblem, "laurel crest");
  assert.equal(resolved.avatarStyle, "performer");
});

test("resolveCorpsUniformDesign feeds getFantasyUniformDetails a hex-pinned color string", () => {
  const resolved = resolveCorpsUniformDesign(equippedCorps());
  const details = getFantasyUniformDetails("Unspecified", "Lexington, KY", resolved);
  assert.equal(details.matchedTheme, "director-custom");
  assert.ok(details.colors.includes("forest green (#1f6b3a)"));
  assert.ok(details.colors.includes("gold (#e0a516)"));
  assert.ok(details.helmet.includes("shako"));
});

test("resolveCorpsUniformDesign falls back to the stored v1 design when no snapshot is equipped", () => {
  const v1 = { primaryColor: "red", secondaryColor: "silver", helmetStyle: "modern" };
  assert.deepEqual(resolveCorpsUniformDesign({ uniformDesign: v1 }), v1);
});

test("resolveCorpsUniformDesign returns null for missing/blank corps data", () => {
  assert.equal(resolveCorpsUniformDesign(null), null);
  assert.equal(resolveCorpsUniformDesign(undefined), null);
  assert.equal(resolveCorpsUniformDesign({}), null);
});

test("resolveCorpsUniformDesign ignores a snapshot with no colorway and uses v1", () => {
  const v1 = { primaryColor: "blue" };
  const resolved = resolveCorpsUniformDesign({ uniformDesign: v1, uniform: { name: "x" } });
  assert.deepEqual(resolved, v1);
});
