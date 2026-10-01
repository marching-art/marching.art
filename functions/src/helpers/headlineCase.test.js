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

test("toApTitleCase takes shouting out but keeps real acronyms", () => {
  assert.equal(toApTitleCase("BLUE DEVILS WIN BIG AT DCI FINALS"), "Blue Devils Win Big at DCI Finals");
  assert.equal(toApTitleCase("SCV TAKES 3RD IN MARION, IN"), "SCV Takes 3rd in Marion, IN");
  assert.equal(toApTitleCase("WIN OR LOSE, IN OR OUT"), "Win or Lose, in or Out");
  assert.equal(toApTitleCase("I AM BACK FOR THE 8 PM SHOW"), "I Am Back for the 8 PM Show");
});

test("toApTitleCase tolerates non-strings and is idempotent", () => {
  assert.equal(toApTitleCase(undefined), "");
  assert.equal(toApTitleCase("   "), "");
  const once = toApTitleCase("the best of the best");
  assert.equal(toApTitleCase(once), once);
});
