// Tests for the v2 uniform → image-details pipeline. The equipped Uniform Studio
// (v2) design is the single source of truth for a corps' look; these cover the
// resolver, the details mapper, and the separate guard-look handling.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveCorpsUniform,
  getUniformDetailsFromDesign,
  getFantasyUniformDetails,
} = require("./newsUniforms");

// A green-and-gold, shako-wearing design like the reference share card.
const greenGoldSnapshot = () => ({
  designId: "abc",
  name: "Unspecified",
  colorway: { primary: "#1f6b3a", secondary: "#14532d", accent: "#e0a516", metal: "gold" },
  figure: { hatType: "shako", plume: { type: "upright", color: "#1f6b3a" }, chest: "buttons" },
  aiHints: { mascotOrEmblem: "laurel crest", additionalNotes: "regal, disciplined" },
});

// A guard show look in a contrasting palette (crimson dress).
const guardSnapshot = () => ({
  designId: "guard1",
  name: "Show Guard",
  colorway: { primary: "#b3121c", secondary: "#ece2cc", accent: "#141414", metal: "silver" },
  figure: { torsoStyle: "dress" },
});

test("resolveCorpsUniform returns the equipped v2 snapshot", () => {
  const snap = greenGoldSnapshot();
  assert.equal(resolveCorpsUniform({ uniform: snap }), snap);
});

test("resolveCorpsUniform returns null when no design is equipped", () => {
  assert.equal(resolveCorpsUniform(null), null);
  assert.equal(resolveCorpsUniform({}), null);
  assert.equal(resolveCorpsUniform({ uniform: { name: "x" } }), null);
});

test("resolveCorpsUniform bundles the guard look on as .guard when present", () => {
  const uniform = greenGoldSnapshot();
  const uniformGuard = guardSnapshot();
  const resolved = resolveCorpsUniform({ uniform, uniformGuard });
  assert.equal(resolved.colorway.primary, "#1f6b3a");
  assert.equal(resolved.guard.colorway.primary, "#b3121c");
});

test("getUniformDetailsFromDesign names + hex-pins the colorway and reads the hat/plume", () => {
  const details = getUniformDetailsFromDesign(greenGoldSnapshot(), "Unspecified", "Lexington, KY");
  assert.equal(details.matchedTheme, "director-custom");
  assert.equal(details.primaryColor, "forest green");
  assert.equal(details.accentColor, "gold");
  assert.equal(details.primaryHex, "#1f6b3a");
  assert.ok(details.colors.includes("forest green (#1f6b3a)"));
  assert.ok(details.colors.includes("gold (#e0a516)"));
  assert.ok(details.helmet.includes("shako"));
  assert.ok(details.helmet.includes("plume"));
  assert.equal(details.mascotOrEmblem, "laurel crest");
  assert.equal(details.additionalNotes, "regal, disciplined");
  assert.equal(details.style, "traditional");
});

test("getUniformDetailsFromDesign describes the guard from its own look when set", () => {
  const design = { ...greenGoldSnapshot(), guard: guardSnapshot() };
  const details = getUniformDetailsFromDesign(design, "Unspecified", null);
  assert.equal(details.hasDistinctGuardLook, true);
  // Guard costume uses the guard palette (crimson), not the hornline green.
  assert.ok(details.guard.includes("crimson red (#b3121c)"));
  assert.ok(details.guard.includes("dress"));
  // Brass/percussion still use the corps identity (green).
  assert.ok(details.brass.includes("forest green"));
});

test("getUniformDetailsFromDesign coordinates the guard to corps colors with no guard look", () => {
  const details = getUniformDetailsFromDesign(greenGoldSnapshot(), "Unspecified", null);
  assert.equal(details.hasDistinctGuardLook, false);
  assert.ok(details.guard.includes("forest green"));
});

test("getUniformDetailsFromDesign handles a bareheaded (no hat) design", () => {
  const snap = greenGoldSnapshot();
  snap.figure = { chest: "swash", sneaker: true };
  const details = getUniformDetailsFromDesign(snap, "Unspecified", null);
  assert.ok(details.helmet.includes("no traditional headwear"));
  assert.equal(details.style, "athletic");
});

test("getFantasyUniformDetails uses the v2 design when present, else falls back to theme", () => {
  const fromDesign = getFantasyUniformDetails("Anything", null, greenGoldSnapshot());
  assert.equal(fromDesign.matchedTheme, "director-custom");

  // No design → name-based theme matching (e.g. 'fire' theme).
  const themed = getFantasyUniformDetails("Fire Storm", null, null);
  assert.notEqual(themed.matchedTheme, "director-custom");
});
