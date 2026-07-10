// Tests for the Podium Rookie Journey verifications (Phase 7.2): each step
// checks the profile display copy and/or the server-only podium state, and
// the step lookup spans both quest lines.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  JOURNEY_STEPS,
  PODIUM_JOURNEY_STEPS,
  verifyJourneyStep,
  getJourneyStep,
} = require("./journey");

const stepById = (id) => getJourneyStep(id);

describe("podium rookie journey", () => {
  test("getJourneyStep resolves both quest lines; ids never collide", () => {
    assert.ok(getJourneyStep("full_lineup"));
    assert.ok(getJourneyStep("podium_found"));
    assert.equal(getJourneyStep("nope"), null);
    const ids = [...JOURNEY_STEPS, ...PODIUM_JOURNEY_STEPS].map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("podium_found requires the profile display copy", () => {
    const step = stepById("podium_found");
    assert.equal(verifyJourneyStep(step, {}), false);
    assert.equal(
      verifyJourneyStep(step, { corps: { podiumClass: { corpsName: "The Regiment" } } }),
      true
    );
  });

  test("state-backed steps fail without podium state and pass with it", () => {
    const profile = { corps: { podiumClass: { corpsName: "X" } } };
    assert.equal(verifyJourneyStep(stepById("podium_rehearse"), profile, null), false);
    assert.equal(
      verifyJourneyStep(stepById("podium_rehearse"), profile, {
        today: { blocksUsed: 2 },
        captions: {},
      }),
      true
    );
    assert.equal(
      verifyJourneyStep(stepById("podium_rehearse"), profile, {
        today: { blocksUsed: 0 },
        captions: { GE1: { lastRehearsedDay: 4 } },
      }),
      true
    );
    assert.equal(verifyJourneyStep(stepById("podium_template"), profile, { planTemplate: [] }), false);
    assert.equal(
      verifyJourneyStep(stepById("podium_template"), profile, { planTemplate: ["warmup"] }),
      true
    );
    assert.equal(
      verifyJourneyStep(stepById("podium_tour"), profile, { selectedShowDays: [24] }),
      true
    );
    assert.equal(
      verifyJourneyStep(stepById("podium_joint"), profile, {
        jointHistory: [{ day: 20, partnerUid: "b" }],
      }),
      true
    );
  });

  test("podium_score passes from state OR the profile display copy", () => {
    const step = stepById("podium_score");
    assert.equal(verifyJourneyStep(step, {}, { lastTotal: 71.2 }), true);
    assert.equal(
      verifyJourneyStep(step, { corps: { podiumClass: { totalSeasonScore: 71.2 } } }, null),
      true
    );
    assert.equal(verifyJourneyStep(step, { corps: { podiumClass: {} } }, null), false);
  });

  test("podium_season requires an archived season on the resume", () => {
    const step = stepById("podium_season");
    assert.equal(verifyJourneyStep(step, { corps: { podiumClass: {} } }), false);
    assert.equal(
      verifyJourneyStep(step, {
        corps: { podiumClass: { seasonHistory: [{ seasonId: "s1" }] } },
      }),
      true
    );
  });

  test("fantasy steps are unaffected by the new signature", () => {
    const step = stepById("full_lineup");
    const lineup = Object.fromEntries(
      ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"].map((c) => [c, "X|2023"])
    );
    assert.equal(verifyJourneyStep(step, { corps: { worldClass: { lineup } } }), true);
    assert.equal(verifyJourneyStep(step, { corps: {} }), false);
  });
});
