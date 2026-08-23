// Tests for the "your corps takes the field" push builder: imminent-only,
// once-per-slot (dedup), and it only ever targets a real registered corps (uid).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildTakeTheFieldPushes, pushKey } = require("./performancePush");

const T0 = Date.parse("2026-06-18T20:00:00.000Z");
const min = (n) => new Date(T0 + n * 60000).toISOString();

const comp = (day, name, lineup) => ({ day, name, fantasySchedule: { lineup } });

describe("buildTakeTheFieldPushes", () => {
  const competitions = [
    comp(18, "Show A", [
      { uid: "u1", corpsClass: "worldClass", corps: "Soon Corps", performsAt: min(10) }, // 10 min out
      { uid: "u2", corpsClass: "worldClass", corps: "Later Corps", performsAt: min(45) }, // too far
      { uid: "u3", corpsClass: "worldClass", corps: "Past Corps", performsAt: min(-5) }, // already went
      { uid: null, corpsClass: "worldClass", corps: "Ghost", performsAt: min(5) }, // no uid
    ]),
  ];

  test("fires only for imminent slots with a real uid", () => {
    const pushes = buildTakeTheFieldPushes({ competitions, nowMs: T0 });
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].corps, "Soon Corps");
    assert.equal(pushes[0].minutesUntil, 10);
  });

  test("respects the already-sent dedup set", () => {
    const alreadySent = new Set([pushKey("u1", "worldClass", 18, "Show A")]);
    assert.equal(buildTakeTheFieldPushes({ competitions, nowMs: T0, alreadySent }).length, 0);
  });

  test("a slot just under the lead window fires; over it does not", () => {
    const c = [
      comp(1, "Edge", [
        { uid: "a", corpsClass: "openClass", corps: "In", performsAt: min(18) },
        { uid: "b", corpsClass: "openClass", corps: "Out", performsAt: min(19) },
      ]),
    ];
    const pushes = buildTakeTheFieldPushes({ competitions: c, nowMs: T0, leadMaxMin: 18 });
    assert.deepEqual(pushes.map((p) => p.corps), ["In"]);
  });

  test("no fantasySchedule → nothing", () => {
    assert.deepEqual(
      buildTakeTheFieldPushes({ competitions: [{ day: 1, name: "X" }], nowMs: T0 }),
      []
    );
  });
});
