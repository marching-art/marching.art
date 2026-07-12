// Engine scoring guards for the trajectory-anchored model (2026-07). These
// lock in the fixes for the launch-week report: every corps scoring the same,
// and the whole field dropping together on the same day.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const engine = require("./engine");
const curves = require("./curveData.json");
const cfg = require("./balanceConfig.json");

/** A fresh corps at a uniform challenge and reputation tier. */
function corps(challengeLevel, repTier) {
  const challenge = {};
  for (const caption of engine.CAPTIONS) challenge[caption] = challengeLevel;
  return engine.createSeasonState({ challenge, repTier }, curves, cfg);
}

/** Rehearse `n` blocks on `day`, rotating through the block types. */
function rehearse(state, day, n) {
  const rotation = [
    "warmup",
    "fullEnsemble",
    "brassSectionals",
    "percussionSectionals",
    "visualEnsemble",
    "guardSectionals",
    "visualBasics",
  ];
  const blocksSoFar = {};
  for (let i = 0; i < n; i++) {
    const bt = rotation[i % rotation.length];
    engine.allocateBlock(state, bt, day, i, blocksSoFar, curves, cfg, {});
    blocksSoFar[bt] = (blocksSoFar[bt] || 0) + 1;
  }
  engine.endOfDay(
    state,
    day,
    { restDay: false, blocksUsedToday: n, maxBlocksToday: 12, warmupUsed: true },
    cfg
  );
}

describe("rehearsal drives the score (the launch-week 'everyone identical' bug)", () => {
  test("two same-challenge, same-tier corps that rehearsed differently score differently", () => {
    const heavy = corps(5, 1);
    const light = corps(5, 1);
    for (let day = 1; day <= 4; day++) {
      rehearse(heavy, day, 12);
      rehearse(light, day, 3);
    }
    const h = engine.scoreCorps(heavy, 5, "s|5|showA|heavy", curves, cfg);
    const l = engine.scoreCorps(light, 5, "s|5|showB|light", curves, cfg);
    assert.ok(
      h.total > l.total + 0.5,
      `heavy rehearsal (${h.total}) must clearly beat light (${l.total})`
    );
  });

  test("well-rehearsed corps are NOT collapsed to one identical ceiling value", () => {
    // Old model: any corps past the tier-1 p25 ceiling was clamped to the exact
    // band number, so a whole field of good corps printed identical captions.
    const totals = new Set();
    for (let i = 0; i < 6; i++) {
      const c = corps(5, 1);
      // Each corps rehearses a slightly different amount — small real
      // differences must survive as distinct scores, never clamp-collapse.
      for (let day = 1; day <= 6; day++) rehearse(c, day, 8 + i);
      totals.add(engine.scoreCorps(c, 7, `s|7|show|${i}`, curves, cfg).total);
    }
    assert.equal(totals.size, 6, "six differently-rehearsed corps must yield six distinct totals");
  });
});

describe("reputation is a tailwind, not a wall", () => {
  test("same rehearsal scores higher at a higher tier", () => {
    const mk = (tier) => {
      const c = corps(6, tier);
      for (let day = 1; day <= 6; day++) rehearse(c, day, 10);
      return engine.scoreCorps(c, 7, "s|7|show|x", curves, cfg).total;
    };
    assert.ok(mk(7) > mk(1), "a dynasty edges a newcomer at equal rehearsal");
  });

  test("a flawless newcomer still beats an absent dynasty (rehearsal dominates)", () => {
    const newcomer = corps(6, 1);
    for (let day = 1; day <= 8; day++) rehearse(newcomer, day, 12);
    const dynasty = corps(6, 7); // tier 7 but never rehearsed past day-1 install
    const nc = engine.scoreCorps(newcomer, 9, "s|9|showA|nc", curves, cfg);
    const dy = engine.scoreCorps(dynasty, 9, "s|9|showB|dy", curves, cfg);
    assert.ok(nc.total > dy.total, `flawless newcomer ${nc.total} must beat absent dynasty ${dy.total}`);
  });
});

describe("independent fluctuation (the 'everyone drops together' bug)", () => {
  test("updateForm is deterministic per seed but independent across corps", () => {
    const a1 = corps(5, 4);
    const a2 = corps(5, 4);
    const b = corps(5, 4);
    for (let day = 1; day <= 10; day++) {
      engine.updateForm(a1, day, "seasonX|alice", curves, cfg);
      engine.updateForm(a2, day, "seasonX|alice", curves, cfg); // same seed as a1
      engine.updateForm(b, day, "seasonX|bob", curves, cfg); // different seed
    }
    assert.equal(a1.form, a2.form, "same seed -> identical form (deterministic, replayable)");
    assert.notEqual(a1.form, b.form, "different corps -> independent form");
  });

  test("form stays bounded", () => {
    const c = corps(5, 4);
    for (let day = 1; day <= 60; day++) engine.updateForm(c, day, "seasonX|drift", curves, cfg);
    assert.ok(Math.abs(c.form) <= cfg.scoring.form.max + 1e-9, `form ${c.form} within ±${cfg.scoring.form.max}`);
  });

  test("two identical corps at different shows move independently, not in lockstep", () => {
    // Plateau both so any day-to-day movement is pure fluctuation, then walk
    // their form on independent seeds and confirm the daily deltas disagree.
    const mk = () => {
      const c = corps(5, 4);
      for (const caption of engine.CAPTIONS) {
        c.captions[caption].content = 1;
        c.captions[caption].clean = 1;
      }
      return c;
    };
    const x = mk();
    const y = mk();
    let disagreements = 0;
    let prevX = null;
    let prevY = null;
    for (let day = 20; day <= 45; day++) {
      engine.updateForm(x, day, "seasonX|x", curves, cfg);
      engine.updateForm(y, day, "seasonX|y", curves, cfg);
      const tx = engine.scoreCorps(x, day, `seasonX|${day}|showX|x`, curves, cfg).total;
      const ty = engine.scoreCorps(y, day, `seasonX|${day}|showY|y`, curves, cfg).total;
      if (prevX != null && Math.sign(tx - prevX) !== Math.sign(ty - prevY)) disagreements++;
      prevX = tx;
      prevY = ty;
    }
    // A lockstep model moves the two corps the same direction every day
    // (0 disagreements). Independent corps disagree on plenty of days.
    assert.ok(disagreements >= 5, `expected frequent independent moves, got ${disagreements} disagreements`);
  });
});

describe("realism guardrails", () => {
  test("no caption reaches its day-max and no total reaches 100", () => {
    const c = corps(8, 7);
    for (const caption of engine.CAPTIONS) {
      c.captions[caption].content = 1;
      c.captions[caption].clean = 1;
    }
    c.condition.stamina = 100;
    c.condition.morale = 100;
    c.form = cfg.scoring.form.max;
    const sheet = engine.scoreCorps(c, 49, "seasonX|49|finals|elite", curves, cfg);
    assert.ok(sheet.total < 100, `total ${sheet.total} must stay under 100`);
    for (const caption of engine.CAPTIONS) {
      const dayMax = curves.bands[caption][48].max;
      assert.ok(sheet.captions[caption] < dayMax, `${caption} ${sheet.captions[caption]} < day-max ${dayMax}`);
    }
  });
});
