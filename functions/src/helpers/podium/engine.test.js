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

  test("a full flawless newcomer season beats an absent dynasty (rehearsal dominates by finals)", () => {
    // Legacy carries an absent dynasty early, but a newcomer who rehearses the
    // WHOLE season overtakes it by finals — reputation is an edge, not a wall.
    const newcomer = corps(6, 1);
    for (let day = 1; day <= 48; day++) rehearse(newcomer, day, 12);
    const dynasty = corps(6, 7); // tier 7 but never rehearsed past day-1 install
    const nc = engine.scoreCorps(newcomer, 49, "s|49|showA|nc", curves, cfg);
    const dy = engine.scoreCorps(dynasty, 49, "s|49|showB|dy", curves, cfg);
    assert.ok(nc.total > dy.total, `flawless newcomer ${nc.total} must beat absent dynasty ${dy.total} at finals`);
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
    const dx = [];
    const dy = [];
    let prevX = null;
    let prevY = null;
    for (let day = 10; day <= 49; day++) {
      engine.updateForm(x, day, "seasonX|x", curves, cfg);
      engine.updateForm(y, day, "seasonX|y", curves, cfg);
      const tx = engine.scoreCorps(x, day, `seasonX|${day}|showX|x`, curves, cfg).total;
      const ty = engine.scoreCorps(y, day, `seasonX|${day}|showY|y`, curves, cfg).total;
      if (prevX != null) {
        dx.push(tx - prevX);
        dy.push(ty - prevY);
      }
      prevX = tx;
      prevY = ty;
    }
    // Pearson correlation of the two corps' daily deltas. A lockstep model (the
    // old shared-band bug) sits near 1.0; independent corps sit near 0.
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const mx = mean(dx);
    const my = mean(dy);
    let num = 0;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < dx.length; i++) {
      num += (dx[i] - mx) * (dy[i] - my);
      vx += (dx[i] - mx) ** 2;
      vy += (dy[i] - my) ** 2;
    }
    const correlation = num / Math.max(1e-9, Math.sqrt(vx * vy));
    assert.ok(
      correlation < 0.5,
      `two corps must not move in lockstep; delta-correlation was ${correlation.toFixed(3)}`
    );
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

describe("blocksAvailable — the daily cap is a start-of-day property", () => {
  const day = { isShowDay: false, isSpringTraining: false };

  test("rested corps gets the full rehearsal-day cap", () => {
    const c = corps(4, 1);
    c.condition.stamina = 100;
    assert.equal(engine.blocksAvailable(c, day, cfg), cfg.rehearsal.blocksPerDay);
  });

  test("a corps that woke tired gets the low-stamina penalty", () => {
    const c = corps(4, 1);
    c.condition.stamina = cfg.condition.lowStaminaThreshold - 1;
    assert.equal(
      engine.blocksAvailable(c, day, cfg),
      cfg.rehearsal.blocksPerDay - cfg.condition.lowStaminaBlockPenalty
    );
  });

  test("draining stamina mid-day does NOT shrink the cap when a start-of-day snapshot is supplied", () => {
    // The launch bug: a corps starts the day rested (cap 12), rehearses enough
    // blocks to drop live stamina below the threshold, then the cap recomputed
    // to 8 — stranding a player who had already used 10 blocks with
    // "All 8 blocks are used". staminaForCap pins the cap to the day's start.
    const c = corps(4, 1);
    c.condition.stamina = cfg.condition.lowStaminaThreshold - 1; // tired NOW
    const startStamina = 100; // but rested when the day began
    assert.equal(
      engine.blocksAvailable(c, { ...day, staminaForCap: startStamina }, cfg),
      cfg.rehearsal.blocksPerDay
    );
    // Without the snapshot it falls back to live stamina — the old behavior.
    assert.equal(
      engine.blocksAvailable(c, day, cfg),
      cfg.rehearsal.blocksPerDay - cfg.condition.lowStaminaBlockPenalty
    );
  });
});

describe("veteran head-start (last-season engagement lifts only the early game)", () => {
  test("fraction is 0 below the pivot, 1 at/above full, linear between", () => {
    assert.equal(engine.veteranStartFraction(null, cfg), 0, "no percentile -> nothing");
    assert.equal(engine.veteranStartFraction(cfg.veteranStart.pivotPercentile, cfg), 0, "pivot -> 0");
    assert.equal(engine.veteranStartFraction(cfg.veteranStart.fullPercentile, cfg), 1, "full -> 1");
    assert.equal(engine.veteranStartFraction(100, cfg), 1, "above full clamps to 1");
    const mid = (cfg.veteranStart.pivotPercentile + cfg.veteranStart.fullPercentile) / 2;
    assert.ok(
      Math.abs(engine.veteranStartFraction(mid, cfg) - 0.5) < 1e-9,
      "midpoint percentile -> ~0.5"
    );
  });

  test("an engaged returner starts with more content/clean; a newcomer does not", () => {
    const challenge = {};
    for (const caption of engine.CAPTIONS) challenge[caption] = 5;
    const newcomer = engine.createSeasonState({ challenge, repTier: 1 }, curves, cfg);
    const iron = engine.createSeasonState(
      { challenge, repTier: 1, activityPercentile: cfg.veteranStart.fullPercentile },
      curves,
      cfg
    );
    assert.ok(
      iron.captions.GE1.content > newcomer.captions.GE1.content,
      "returner starts with more content installed"
    );
    assert.ok(
      iron.captions.GE1.clean > newcomer.captions.GE1.clean,
      "returner starts cleaner"
    );
    assert.ok(
      iron.captions.GE1.content <= newcomer.captions.GE1.content + cfg.veteranStart.maxContentBonus + 1e-9,
      "bonus never exceeds the configured max"
    );
  });

  test("the head-start nearly washes out by finals — residual is a fraction of a point (no promotion leverage)", () => {
    const challenge = {};
    for (const caption of engine.CAPTIONS) challenge[caption] = 5;
    const run = (activityPercentile) => {
      const state = engine.createSeasonState(
        { challenge, repTier: 5, activityPercentile },
        curves,
        cfg
      );
      for (let d = 1; d <= 49; d++) rehearse(state, d, 12);
      // Same varianceSeed for both: in the real game the seed is
      // seasonUid|day|uid, independent of the head-start, so the only thing that
      // could differ at finals is the installed book — which has saturated.
      return engine.scoreCorps(state, 49, "finals|show", curves, cfg).total;
    };
    const newcomerFinals = run(null);
    const ironFinals = run(cfg.veteranStart.fullPercentile);
    // Both rehearsed to saturation, so the installed book has all but converged;
    // the sub-point residual is dwarfed by the ~20-pt tier spreads promotion
    // cutoffs live on, so the head-start cannot leapfrog a corps at finals. (For
    // a top corps the soft-cap absorbs it entirely — this is the mid-field case.)
    assert.ok(
      Math.abs(ironFinals - newcomerFinals) < 0.5,
      `finals must nearly converge (newcomer ${newcomerFinals}, iron ${ironFinals}) so the ` +
        "head-start cannot move a promotion cutoff"
    );
  });

  test("early-season: an engaged returner clearly leads an identical newcomer on show one", () => {
    const challenge = {};
    for (const caption of engine.CAPTIONS) challenge[caption] = 5;
    const newcomer = engine.createSeasonState({ challenge, repTier: 1 }, curves, cfg);
    const iron = engine.createSeasonState(
      { challenge, repTier: 1, activityPercentile: cfg.veteranStart.fullPercentile },
      curves,
      cfg
    );
    for (let d = 1; d <= 4; d++) {
      rehearse(newcomer, d, 12);
      rehearse(iron, d, 12);
    }
    const n = engine.scoreCorps(newcomer, 4, "early|new", curves, cfg).total;
    const i = engine.scoreCorps(iron, 4, "early|iron", curves, cfg).total;
    assert.ok(i > n, `returner (${i}) should lead newcomer (${n}) early`);
  });
});

describe("assistant director fades with consecutive days away", () => {
  const { assistantYieldFor, assistantStreakAfter } = engine;
  const base = cfg.rehearsal.assistantYield;
  const decay = cfg.rehearsal.assistantDecay;

  test("full assistant yield through the grace window", () => {
    for (let streak = 1; streak <= decay.graceDays; streak++) {
      assert.equal(assistantYieldFor(streak, cfg), base);
    }
  });

  test("loses perDay for every day past the grace window, never below the floor", () => {
    assert.ok(Math.abs(assistantYieldFor(decay.graceDays + 1, cfg) - (base - decay.perDay)) < 1e-9);
    assert.ok(Math.abs(assistantYieldFor(decay.graceDays + 2, cfg) - (base - 2 * decay.perDay)) < 1e-9);
    assert.equal(assistantYieldFor(200, cfg), decay.floor);
    assert.ok(assistantYieldFor(200, cfg) > 0, "the assistant never stops entirely");
  });

  test("a config without decay keeps the flat assistant yield", () => {
    const flat = { rehearsal: { assistantYield: 0.85 } };
    assert.equal(assistantYieldFor(30, flat), 0.85);
  });

  test("the streak grows on assistant days and resets when the director shows up", () => {
    const auto = { playedSelf: false, restDay: false, assistant: true };
    assert.equal(assistantStreakAfter(undefined, auto), 1);
    assert.equal(assistantStreakAfter(4, auto), 5);
    assert.equal(assistantStreakAfter(4, { playedSelf: true, restDay: false, assistant: false }), 0);
    assert.equal(assistantStreakAfter(4, { playedSelf: false, restDay: true, assistant: false }), 0);
    // No plan → nothing ran: the streak neither grows nor resets.
    assert.equal(assistantStreakAfter(4, { playedSelf: false, restDay: false, assistant: false }), 4);
  });
});

describe("challenge model v2 — the challenge level is a bet, not a dominant pick", () => {
  /** A corps at a uniform challenge with every caption at the given content/clean. */
  function corpsAt(challengeLevel, content, clean, challengeModel) {
    const challenge = {};
    for (const caption of engine.CAPTIONS) challenge[caption] = challengeLevel;
    const state = engine.createSeasonState({ challenge, repTier: 4, challengeModel }, curves, cfg);
    for (const caption of engine.CAPTIONS) {
      state.captions[caption].content = content;
      state.captions[caption].clean = clean;
    }
    state.condition.stamina = 80;
    state.condition.morale = 80;
    return state;
  }
  // The same seed adds the same judge wiggle to both corps (it depends on the
  // caption and seed, never the challenge), so the comparison isolates the model.
  const total = (state, day) => engine.scoreCorps(state, day, `bet|${day}`, curves, cfg).total;

  test("fresh states are stamped with the configured model", () => {
    assert.equal(engine.currentChallengeModel(cfg), cfg.scoring.challengeModel.version);
    assert.equal(corps(5, 4).challengeModel, cfg.scoring.challengeModel.version);
  });

  test("a v2 curve stands at its configured day-one share of the finals ceiling", () => {
    for (const level of [1, 4, 8]) {
      const curve = engine.curveForChallenge("B", level, curves, cfg, 2);
      const at = (day) => (curve.L / (1 + Math.exp(-curve.k * (day - curve.d0)))) / curve.norm;
      const want = cfg.scoring.challengeModel.dayOneShareByChallenge[String(level)];
      assert.ok(Math.abs(at(1) / at(49) - want) < 1e-6, `level ${level}: ${at(1) / at(49)} vs ${want}`);
      assert.ok(Math.abs(at(49) - curve.L) < 1e-9, "a realized curve reaches its ceiling at finals");
    }
  });

  test("onsetDayForShare inverts the day-one share", () => {
    const k = 0.05;
    for (const share of [0.3, 0.62, 0.8, 0.95]) {
      const d0 = engine.onsetDayForShare(k, share);
      const got = (1 + Math.exp(-k * (49 - d0))) / (1 + Math.exp(-k * (1 - d0)));
      assert.ok(Math.abs(got - share) < 1e-9, `${share} -> ${got}`);
    }
  });

  test("an easy book leads the opening show at equal rehearsal", () => {
    assert.ok(total(corpsAt(1, 0.4, 0.25), 4) > total(corpsAt(8, 0.4, 0.25), 4));
  });

  test("a cleaned hard book wins finals", () => {
    assert.ok(total(corpsAt(8, 1, 1), 49) > total(corpsAt(5, 1, 1), 49));
    assert.ok(total(corpsAt(5, 1, 1), 49) > total(corpsAt(1, 1, 1), 49));
  });

  /**
   * A corps abandoned at registration: the assistant director runs a full
   * rotation every day at its streak-decayed yield, the processor's real
   * absence path. Returns its finals total.
   */
  function abandonedFinals(challengeLevel, challengeModel) {
    const state = corpsAt(challengeLevel, 0.28, 0.2, challengeModel);
    const rotation = [
      "warmup",
      "fullEnsemble",
      "brassSectionals",
      "percussionSectionals",
      "visualEnsemble",
      "guardSectionals",
      "visualBasics",
    ];
    for (let day = 1; day <= 49; day++) {
      const blocksSoFar = {};
      for (let i = 0; i < cfg.rehearsal.blocksPerDay; i++) {
        const bt = rotation[i % rotation.length];
        engine.allocateBlock(state, bt, day, i, blocksSoFar, curves, cfg, {
          yieldMultiplier: engine.assistantYieldFor(day, cfg),
        });
        blocksSoFar[bt] = (blocksSoFar[bt] || 0) + 1;
      }
      engine.endOfDay(
        state,
        day,
        { restDay: false, blocksUsedToday: cfg.rehearsal.blocksPerDay, maxBlocksToday: 12, warmupUsed: true },
        cfg
      );
    }
    state.condition.stamina = 80;
    state.condition.morale = 80;
    return total(state, 49);
  }

  test("a hard book nobody cleans loses finals to an easier one (and did not under v1)", () => {
    assert.ok(abandonedFinals(5) > abandonedFinals(8));
    const legacy = engine.LEGACY_CHALLENGE_MODEL;
    assert.ok(abandonedFinals(8, legacy) > abandonedFinals(5, legacy), "v1 had no risk at 8");
  });

  test("legacy (unstamped) states keep the v1 shape, floor, and realization for life", () => {
    const legacy = engine.LEGACY_CHALLENGE_MODEL;
    assert.equal(engine.perfFloorFor(8, legacy, cfg), cfg.scoring.perfFloorFraction);
    assert.equal(engine.fullRealizationFor(8, legacy, cfg), cfg.scoring.attainmentFullRealization);
    assert.equal(engine.perfFloorFor(8, undefined, cfg), cfg.scoring.perfFloorFraction);
    // v1 shape: the archetype with the ceiling nearest the target.
    const curve = engine.curveForChallenge("GE1", 8, curves, cfg, legacy);
    const nearest = [...curves.archetypes.GE1].sort(
      (a, b) => Math.abs(a.L - curve.L) - Math.abs(b.L - curve.L)
    )[0];
    assert.equal(curve.k, nearest.k);
    assert.equal(curve.d0, nearest.d0);
    // A v1 state reproduces the old ordering: all-8 led even on the opener.
    assert.ok(total(corpsAt(8, 0.4, 0.25, legacy), 4) > total(corpsAt(1, 0.4, 0.25, legacy), 4));
  });

  test("hydrating a stored state honors its stamp (missing stamp = legacy)", () => {
    const store = require("./store");
    const stamped = store.dehydrateState(corps(8, 4));
    assert.equal(stamped.challengeModel, cfg.scoring.challengeModel.version);
    const v2 = store.hydrateState(stamped).captions.GE1.curve;
    assert.deepEqual(v2, engine.curveForChallenge("GE1", 8, curves, cfg, stamped.challengeModel));
    const { challengeModel: _drop, ...unstamped } = stamped;
    const v1 = store.hydrateState(unstamped).captions.GE1.curve;
    assert.deepEqual(v1, engine.curveForChallenge("GE1", 8, curves, cfg, engine.LEGACY_CHALLENGE_MODEL));
    assert.notDeepEqual(v1, v2);
  });
});

describe("rehearsal depth — ensemble readiness and the repeat ladder", () => {
  const fe = cfg.blocks.fullEnsemble;

  test("an ensemble block is gated on its sections' installed content", () => {
    const state = corps(8, 4);
    const rule = fe.readiness;
    for (const caption of rule.captions) state.captions[caption].content = 0;
    assert.equal(engine.ensembleReadiness(state, fe), rule.floor, "never below the floor");
    for (const caption of rule.captions) state.captions[caption].content = rule.fullAt / 2;
    assert.ok(Math.abs(engine.ensembleReadiness(state, fe) - Math.max(rule.floor, 0.5)) < 1e-9);
    for (const caption of rule.captions) state.captions[caption].content = rule.fullAt;
    assert.equal(engine.ensembleReadiness(state, fe), 1, "full value once the parts are learned");
  });

  test("ungated blocks and rule-less configs rehearse at full value", () => {
    const state = corps(8, 4);
    assert.equal(engine.ensembleReadiness(state, cfg.blocks.brassSectionals), 1);
    assert.equal(engine.ensembleReadiness(state, { captions: { GE1: 1 } }), 1);
    assert.equal(engine.ensembleReadiness(state, undefined), 1);
  });

  test("allocateBlock applies readiness to growth (not stamina) and reports it", () => {
    const ready = corps(8, 4);
    const raw = corps(8, 4);
    for (const caption of fe.readiness.captions) ready.captions[caption].content = 1;
    const readyPanel = engine.allocateBlock(ready, "fullEnsemble", 5, 0, {}, curves, cfg, {});
    const rawPanel = engine.allocateBlock(raw, "fullEnsemble", 5, 0, {}, curves, cfg, {});
    assert.equal(readyPanel.readinessMult, 1);
    assert.ok(rawPanel.readinessMult < 1);
    // GE1 sits outside the gate's captions, so both start equal there.
    assert.ok(rawPanel.gains.GE1.content < readyPanel.gains.GE1.content);
    assert.equal(rawPanel.staminaCost, readyPanel.staminaCost);
  });

  test("the repeat ladder keeps two full-value reps, then tapers", () => {
    const ladder = cfg.rehearsal.repeatBlockMultipliers;
    assert.equal(ladder[0], 1);
    assert.equal(ladder[1], 1);
    for (let i = 2; i < ladder.length; i++) assert.ok(ladder[i] <= ladder[i - 1]);
    assert.ok(ladder[2] < 1, "a third rep of the same block already costs yield");
  });

  test("store.blockReadiness lists only gated blocks", () => {
    const store = require("./store");
    const readiness = store.blockReadiness(corps(8, 4));
    for (const [blockType, block] of Object.entries(cfg.blocks)) {
      assert.equal(blockType in readiness, Boolean(block.readiness), blockType);
    }
    assert.ok(readiness.fullEnsemble > 0 && readiness.fullEnsemble <= 1);
  });
});

describe("judges' tapes — performing teaches (2026-10)", () => {
  const attainment = (/** @type {any} */ cap) =>
    cap.content * (cfg.scoring.cleanFloor + cfg.scoring.cleanWeight * cap.clean);

  test("cleans the weakest captions after a show, counting as rehearsal", () => {
    const state = corps(6, 4);
    engine.CAPTIONS.forEach((caption, i) => {
      state.captions[caption].content = 0.5 + i * 0.05;
      state.captions[caption].clean = 0.4;
      state.captions[caption].lastRehearsedDay = 2;
    });
    const before = JSON.parse(JSON.stringify(state.captions));
    const tapes = engine.applyJudgesTapes(state, 10, cfg);
    assert.ok(tapes);
    const want = [...engine.CAPTIONS]
      .sort((a, b) => attainment(before[a]) - attainment(before[b]))
      .slice(0, cfg.shows.judgesTapes.captions);
    assert.deepEqual(tapes.captions, want);
    for (const caption of engine.CAPTIONS) {
      const taped = want.includes(caption);
      assert.equal(state.captions[caption].clean > before[caption].clean, taped, caption);
      assert.equal(state.captions[caption].lastRehearsedDay, taped ? 10 : 2, caption);
    }
  });

  test("a harder book cleans slower from the same tapes", () => {
    const easy = corps(2, 4);
    const hard = corps(8, 4);
    const caption = engine.applyJudgesTapes(easy, 10, cfg).captions[0];
    engine.applyJudgesTapes(hard, 10, cfg);
    assert.ok(easy.captions[caption].clean > hard.captions[caption].clean);
  });

  test("no tapes config means no change", () => {
    const state = corps(5, 4);
    const before = JSON.stringify(state);
    assert.equal(engine.applyJudgesTapes(state, 10, { ...cfg, shows: undefined }), null);
    assert.equal(JSON.stringify(state), before);
  });

  test("a show-day block is worth less than a rehearsal-day block, but more than half", () => {
    assert.ok(cfg.rehearsal.showDayYieldMultiplier > 0.5 && cfg.rehearsal.showDayYieldMultiplier < 1);
  });
});

describe("morale v2 — graded fatigue, morale-led form, attrition (2026-10)", () => {
  const day = (/** @type {any} */ state, /** @type {number} */ used, restDay = false) => {
    engine.endOfDay(state, 10, { restDay, blocksUsedToday: used, maxBlocksToday: 12, warmupUsed: true }, cfg);
    return state.condition.morale;
  };
  const freshAt = (/** @type {number} */ morale) => {
    const state = corps(8, 4);
    state.condition.morale = morale;
    return state;
  };

  test("a full day drains, a sustainable day recovers, a rest day restores", () => {
    assert.ok(day(freshAt(60), 12) < 60, "full load drains");
    assert.ok(day(freshAt(60), 8) > 60, "sustainable load recovers");
    assert.equal(day(freshAt(60), 0, true), 60 + cfg.condition.restDayMoraleRecovery);
  });

  test("leaving one block unused is no longer a free pass", () => {
    assert.ok(day(freshAt(60), 11) < 60, "11 of 12 still wears the corps down");
    assert.ok(day(freshAt(60), 11) > day(freshAt(60), 12), "but less than a full day");
  });

  test("morale pulls form: a happy corps trends hotter than a miserable one", () => {
    const happy = freshAt(100);
    const miserable = freshAt(0);
    for (let d = 1; d <= 10; d++) {
      engine.updateForm(happy, d, "same-seed", curves, cfg);
      engine.updateForm(miserable, d, "same-seed", curves, cfg);
    }
    assert.ok(happy.form > miserable.form);
  });

  test("members quit only when morale collapses, and the loss is seeded", () => {
    const rule = cfg.condition.attrition;
    let healthyEvents = 0;
    let collapsedEvents = 0;
    for (let d = 1; d <= 40; d++) {
      if (engine.applyAttrition(freshAt(rule.moraleBelow + 5), d, "corps", cfg)) healthyEvents++;
      const collapsed = freshAt(0);
      const event = engine.applyAttrition(collapsed, d, "corps", cfg);
      if (event) {
        collapsedEvents++;
        assert.ok(event.contentLoss > 0);
        assert.equal(collapsed.captions[event.caption].content, corps(8, 4).captions[event.caption].content - event.contentLoss);
      }
    }
    assert.equal(healthyEvents, 0, "a corps above the line never loses members");
    assert.ok(collapsedEvents > 0, "a collapsed corps does");
    assert.deepEqual(
      engine.applyAttrition(freshAt(0), 7, "corps", cfg),
      engine.applyAttrition(freshAt(0), 7, "corps", cfg),
      "deterministic per seed and day"
    );
  });

  test("store.moraleOutlook reports today's sustainable load and the rest gain", () => {
    const store = require("./store");
    const outlook = store.moraleOutlook({ foodTier: "standard" }, 12);
    assert.ok(outlook);
    assert.equal(outlook.sustainableBlocks, Math.floor(cfg.condition.moraleModel.sustainableShare * 12 + 1e-9));
    assert.ok(outlook.fullDayChange < 0);
    assert.equal(outlook.restDayGain, cfg.condition.restDayMoraleRecovery);
    assert.equal(outlook.attritionBelow, cfg.condition.attrition.moraleBelow);
  });
});

describe("money buys real choices (2026-10)", () => {
  test("a full kitchen lifts morale every night, not just on rest days", () => {
    const night = (/** @type {string} */ foodTier) => {
      const state = corps(8, 4);
      state.foodTier = foodTier;
      state.condition.morale = 60;
      engine.endOfDay(state, 10, { restDay: false, blocksUsedToday: 8, maxBlocksToday: 12, warmupUsed: true }, cfg);
      return state.condition.morale;
    };
    assert.ok(night("fullKitchen") > night("standard"));
    assert.equal(night("gasStation"), night("standard"), "the free floor costs no nightly morale");
  });

  test("a clinician residency outvalues a few days of +30%", () => {
    assert.ok(cfg.clinician.durationDays >= 5);
    assert.ok(cfg.clinician.yieldBoost >= 1.5);
  });
});

describe("book learned — the safe-book cap made visible (decision 43)", () => {
  test("realization caps at 1 and matches the per-caption readout", () => {
    const state = corps(5, 4);
    state.captions.B.content = 1;
    state.captions.B.clean = 1;
    const readout = engine.captionRealization(state, cfg);
    assert.equal(readout.B, 1);
    assert.ok(readout.P < 1);
    assert.equal(readout.P, Number(engine.realizedFor(state.captions.P, state.challengeModel, cfg).toFixed(3)));
  });

  test("store.recordBookLearned keeps the FIRST day a caption maxed", () => {
    const store = require("./store");
    const state = corps(5, 4);
    state.captions.B.content = 1;
    state.captions.B.clean = 1;
    state.bookLearnedDay = store.recordBookLearned(state, 20);
    assert.deepEqual(state.bookLearnedDay, { B: 20 });
    state.captions.P.content = 1;
    state.captions.P.clean = 1;
    state.bookLearnedDay = store.recordBookLearned(state, 24);
    assert.deepEqual(state.bookLearnedDay, { B: 20, P: 24 });
  });
});

describe("book rewrite — once a season, a timing bet (decision 44)", () => {
  const rule = cfg.bookRewrite;

  test("refuses a second rewrite, a late one, too many captions, or a no-op", () => {
    const state = corps(5, 4);
    assert.equal(engine.bookRewriteRefusal(state, ["B", "MA", "P"], 8, 10, cfg), null);
    assert.match(engine.bookRewriteRefusal(state, ["B"], 8, rule.lastDay + 1, cfg) || "", /close after/);
    assert.match(engine.bookRewriteRefusal(state, ["B", "MA", "P", "VP"], 8, 10, cfg) || "", /at most/);
    assert.match(engine.bookRewriteRefusal(state, ["B"], 5, 10, cfg) || "", /already at level 5/);
    assert.match(engine.bookRewriteRefusal(state, ["XX"], 8, 10, cfg) || "", /Unknown caption/);
    assert.match(engine.bookRewriteRefusal(state, ["B"], 9, 10, cfg) || "", /1 to 8/);
    engine.applyBookRewrite(state, ["B"], 8, 10, cfg);
    assert.match(engine.bookRewriteRefusal(state, ["P"], 8, 12, cfg) || "", /already used/);
  });

  test("raising costs more of the installed book than simplifying", () => {
    const state = corps(5, 4);
    for (const c of ["B", "P"]) {
      state.captions[c].content = 0.8;
      state.captions[c].clean = 0.6;
    }
    state.bookLearnedDay = { B: 9 };
    engine.applyBookRewrite(state, ["B"], 8, 10, cfg);
    assert.equal(state.captions.B.challenge, 8);
    assert.ok(Math.abs(state.captions.B.content - 0.8 * rule.raise.keepContent) < 1e-9);
    assert.ok(Math.abs(state.captions.B.clean - 0.6 * rule.raise.keepClean) < 1e-9);
    assert.deepEqual(state.bookRewrite, { day: 10, toLevel: 8, from: { B: 5 } });
    assert.equal(state.bookLearnedDay.B, undefined, "a rewritten caption has a new book to learn");

    const simpler = corps(8, 4);
    simpler.captions.P.content = 0.8;
    simpler.captions.P.clean = 0.6;
    engine.applyBookRewrite(simpler, ["P"], 5, 10, cfg);
    assert.ok(simpler.captions.P.content > state.captions.B.content);
  });

  test("a rewritten caption scores on its new curve once hydrated", () => {
    const store = require("./store");
    const state = store.dehydrateState(corps(5, 4));
    engine.applyBookRewrite(state, ["B"], 8, 10, cfg);
    const hydrated = store.hydrateState(state);
    assert.deepEqual(
      hydrated.captions.B.curve,
      engine.curveForChallenge("B", 8, curves, cfg, state.challengeModel)
    );
  });
});
