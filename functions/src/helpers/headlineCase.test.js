const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toApTitleCase } = require("./headlineCase");

// The full corpus (and client parity) lives in src/utils/headlineCase.test.ts.
test("toApTitleCase applies AP composition-title rules", () => {
  assert.equal(
    toApTitleCase("day 12 recap: the race tightens as crown holds off the cadets"),
    "Day 12 Recap: The Race Tightens as Crown Holds Off the Cadets",
  );
  assert.equal(toApTitleCase("Open and A Class Prelims"), "Open and A Class Prelims");
  assert.equal(toApTitleCase("bluecoats post 98.425 in GE1 — a season best"), "Bluecoats Post 98.425 in GE1 — A Season Best");
  assert.equal(toApTitleCase("mid-season report: head-to-head"), "Mid-Season Report: Head-to-Head");
  assert.equal(toApTitleCase("what to look for"), "What to Look For");
});

test("toApTitleCase tolerates non-strings and is idempotent", () => {
  assert.equal(toApTitleCase(undefined), "");
  assert.equal(toApTitleCase("   "), "");
  const once = toApTitleCase("the best of the best");
  assert.equal(toApTitleCase(once), once);
});
