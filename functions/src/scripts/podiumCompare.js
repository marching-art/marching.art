const path = require("path");
/**
 * Podium A/B — the CURRENT engine + balance vs a git ref (default origin/main),
 * same players, same seeds, same season loop (the nightly processor's order:
 * rehearse -> show stamina -> end of day -> attrition -> form -> score ->
 * judges' tapes). Each engine only gets the hooks it actually has, so the ref
 * plays exactly as it did. Reports decision relevance, skill vs luck, a
 * 192-strategy tournament, accessibility and calibration side by side.
 *
 * Run:  cd functions && node src/scripts/podiumCompare.js [--ref origin/main] [--seeds 24]
 * Informational (always exits 0) — the pass/fail guards live in podiumSim.js.
 */
// @ts-check
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

const argValue = (/** @type {string} */ flag, /** @type {string} */ fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const REF = argValue("--ref", "origin/main");
process.env.SEEDS = argValue("--seeds", "24");
const PODIUM = path.join(__dirname, "..", "helpers", "podium");
const FILES = ["engine.js", "balanceConfig.json", "curveData.json", "staffMarket.js"];
const refDir = fs.mkdtempSync(path.join(os.tmpdir(), "podium-ab-"));
for (const file of FILES) {
  const blob = execFileSync("git", ["show", `${REF}:functions/src/helpers/podium/${file}`], {
    cwd: path.join(__dirname, "..", ".."),
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(refDir, file), blob);
}
/**
 * @param {string} dir directory holding engine.js + its data
 * @param {string} name label for the report
 */
const load = (dir, name) => {
  const engine = require(path.join(dir, "engine"));
  return {
    name,
    engine,
    curves: require(path.join(dir, "curveData.json")),
    cfg: require(path.join(dir, "balanceConfig.json")),
    staff: require(path.join(dir, "staffMarket")),
  };
};
const ENGINES = [load(refDir, "ref"), load(PODIUM, "now")];

const ORDER = [
  "fullEnsemble",
  "visualBasics",
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
  "visualEnsemble",
];
const SECTIONS = [
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
  "visualBasics",
];
const cycle = (list, n) =>
  Array.from({ length: Math.max(0, n) }, (_, i) => list[i % list.length]);

const SCHEDULES = {
  auto: { days: [28, 35, 41, 47, 48, 49], travel: 4 },
  moderate: {
    days: [4, 10, 13, 17, 20, 24, 28, 31, 35, 38, 41, 47, 48, 49],
    travel: 4,
  },
  heavy: {
    days: [
      4, 6, 10, 13, 17, 20, 24, 27, 28, 31, 34, 35, 38, 41, 45, 47, 48, 49,
    ],
    travel: 5,
  },
  maxFar: {
    days: [
      2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 20, 21, 23, 25, 27, 28, 30, 32, 34, 35,
      37, 39, 40, 41, 43, 44, 47, 48, 49,
    ],
    travel: 9,
  },
};
const BIG = new Set([28, 35, 41, 47, 48, 49]);

/** Block plans (fixed patterns — no engine-specific helpers). */
const PLANS = {
  even: (s, d, n) => ["warmup", ...cycle(ORDER, n - 1)],
  feSpam: (s, d, n) => ["warmup", ...cycle(["fullEnsemble"], n - 1)],
  // sectionals for the first three weeks, then the even mix
  sectionsFirst: (s, d, n) => [
    "warmup",
    ...cycle(d <= 18 ? SECTIONS : ORDER, n - 1),
  ],
  // the pre-2026-10 sim "flawless": weakest-caption primary blocks, topped up with Full Ensemble
  weakest: (s, d, n, E) => {
    const order = Object.entries(s.captions)
      .map(([c, v]) => ({ c, v: v.content * (0.72 + 0.28 * v.clean) }))
      .sort((a, b) => a.v - b.v)
      .map((e) => e.c);
    const picks = [];
    for (const c of order) {
      for (const [bt, bk] of Object.entries(E.cfg.blocks)) {
        if (bt === "warmup") continue;
        if ((bk.captions[c] || 0) >= 1 && !picks.includes(bt)) {
          picks.push(bt);
          break;
        }
      }
      if (picks.length >= n - 1) break;
    }
    while (picks.length < n - 1) picks.push("fullEnsemble");
    return ["warmup", ...picks];
  },
};

/** Rest rhythms (never on a show night). */
const RESTS = {
  grind: (s, _d) => s.condition.stamina < 45,
  managed: (s, d) =>
    s.condition.stamina < 45 ||
    s.condition.morale < 50 ||
    (BIG.has(d + 1) && s.condition.morale < 80),
  weekly: (s, d) => d % 7 === 2 || s.condition.stamina < 45,
  twice: (s, d) => d % 7 === 2 || d % 7 === 5 || s.condition.stamina < 45,
};

const DEFAULT = {
  tier: 4,
  chal: 8,
  play: 1,
  plan: "even",
  rest: "managed",
  sched: "moderate",
  food: "standard",
  blocksFrac: 1,
  staff: null, // 'journeyman' roster
  clinician: null, // {block, from}
  rewrite: null, // {day, captions, toLevel}
};

function season(E, opts, seed) {
  const o = { ...DEFAULT, ...opts };
  const { engine, curves, cfg } = E;
  const C = engine.CAPTIONS;
  const challenge = {};
  for (const c of C)
    challenge[c] = typeof o.chal === "function" ? o.chal(c) : o.chal;
  const s = engine.createSeasonState(
    { challenge, repTier: o.tier, foodTier: o.food },
    curves,
    cfg,
  );
  const sched = SCHEDULES[o.sched];
  const shows = new Set(sched.days);
  const roster = o.staff
    ? Object.fromEntries(
        [...C, "programCoordinator"].map((sp) => [
          sp,
          {
            specialty: sp,
            tier: o.staff,
            boost: cfg.staff.tiers[o.staff].boost,
          },
        ]),
      )
    : null;
  const scores = {};
  let streak = 0;
  for (let d = 1; d <= 49; d++) {
    if (o.rewrite && d === o.rewrite.day && engine.applyBookRewrite) {
      engine.applyBookRewrite(s, o.rewrite.captions, o.rewrite.toLevel, d, cfg);
      for (const c of o.rewrite.captions)
        s.captions[c].curve = engine.curveForChallenge(
          c,
          o.rewrite.toLevel,
          curves,
          cfg,
          s.challengeModel,
        );
    }
    const isShowDay = shows.has(d);
    const mb = engine.blocksAvailable(
      s,
      { isShowDay, isSpringTraining: false },
      cfg,
    );
    const plays = engine.seededUnit(`${seed}|play|${d}`) < o.play;
    let rest = false;
    let blocks = [];
    let ym = 1;
    if (plays) {
      streak = 0;
      if (!isShowDay && RESTS[o.rest](s, d)) rest = true;
      else
        blocks = PLANS[o.plan](
          s,
          d,
          Math.max(1, Math.round(mb * o.blocksFrac)),
          E,
        );
    } else {
      streak += 1;
      ym = engine.assistantYieldFor(streak, cfg);
      blocks = PLANS.even(s, d, 12);
    }
    const so = {};
    let u = 0;
    for (const bt of blocks.slice(0, mb)) {
      let mult = ym;
      if (roster)
        mult *= E.staff.staffYieldMultiplier({ staff: roster }, bt, cfg);
      if (
        o.clinician &&
        bt === o.clinician.block &&
        d >= o.clinician.from &&
        d < o.clinician.from + cfg.clinician.durationDays
      )
        mult *= cfg.clinician.yieldBoost;
      engine.allocateBlock(s, bt, d, u, so, curves, cfg, {
        isShowDay,
        yieldMultiplier: mult,
      });
      so[bt] = (so[bt] || 0) + 1;
      u++;
    }
    if (isShowDay)
      s.condition.stamina = Math.max(
        0,
        s.condition.stamina - cfg.condition.showStaminaCost - sched.travel,
      );
    engine.endOfDay(
      s,
      d,
      {
        restDay: rest,
        blocksUsedToday: u,
        maxBlocksToday: mb,
        warmupUsed: (so.warmup || 0) > 0,
      },
      cfg,
    );
    if (engine.applyAttrition) engine.applyAttrition(s, d, `attr|${seed}`, cfg);
    engine.updateForm(s, d, `form|${seed}`, curves, cfg);
    if (isShowDay) {
      scores[d] = engine.scoreCorps(s, d, `${seed}|${d}`, curves, cfg).total;
      if (engine.applyJudgesTapes) engine.applyJudgesTapes(s, d, cfg);
    }
  }
  return { scores, finals: scores[49], morale: s.condition.morale };
}

const N = Number(process.env.SEEDS || 24);
function runs(E, opts, n = N, salt = "") {
  return Array.from({ length: n }, (_, i) =>
    season(E, opts, `cmp${salt}|${i}`),
  );
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const finals = (E, opts, n, salt) =>
  runs(E, opts, n, salt).map((r) => r.finals);
const at = (E, opts, day, n) =>
  mean(
    runs(E, opts, n)
      .map((r) => r.scores[day])
      .filter((v) => v != null),
  );
const winRate = (a, b) => {
  let w = 0;
  for (const x of a) for (const y of b) if (x > y) w++;
  return w / (a.length * b.length);
};


// ---------------------------------------------------------------------------
// The study
// ---------------------------------------------------------------------------
const [OLD, NEW] = ENGINES;
const f2 = (x) => (x >= 0 ? " " : "") + x.toFixed(2);
const row = (label, fn) => {
  const o = fn(OLD);
  const n = fn(NEW);
  console.log(`  ${label.padEnd(44)} ${REF.padEnd(11)} ${o}   now ${n}`);
};
const meanFinals = (E, opts) => mean(finals(E, opts));
const argBest = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0][0];

console.log(
  "\n=== 1. DECISIONS — does each choice matter, and does the right answer depend on context? (tier 4) ===",
);

console.log(
  "\n1a. Challenge level — best uniform level by player type (Finals) and early season (Day 10)",
);
for (const [label, play] of [
  ["daily", 1],
  ["plays 70% of days", 0.7],
  ["plays 35%", 0.35],
  ["plays 15%", 0.15],
  ["absent (assistant only)", 0],
]) {
  row(`best level at Finals — ${label}`, (E) => {
    const by = {};
    for (const lv of [1, 2, 3, 4, 5, 6, 7, 8])
      by[lv] = meanFinals(E, { chal: lv, play });
    return `${argBest(by)} (spread ${(Math.max(...Object.values(by)) - Math.min(...Object.values(by))).toFixed(1)})`;
  });
}
row("best level on Day 10 — daily", (E) => {
  const by = {};
  for (const lv of [1, 2, 3, 4, 5, 6, 7, 8]) by[lv] = at(E, { chal: lv }, 10);
  return argBest(by);
});

console.log("\n1b. Block plan (Finals | Day 10)");
const plans = ["even", "feSpam", "sectionsFirst", "weakest"];
for (const plan of plans)
  row(
    plan,
    (E) =>
      `${meanFinals(E, { plan }).toFixed(2)} | ${at(E, { plan }, 10).toFixed(2)}`,
  );

console.log("\n1c. Tour schedule (Finals)");
for (const sched of ["auto", "moderate", "heavy", "maxFar"])
  row(sched, (E) => meanFinals(E, { sched }).toFixed(2));

console.log("\n1d. Rest rhythm (Finals | morale at Finals)");
for (const [label, opts] of [
  ["grind (rest only when spent)", { rest: "grind" }],
  ["11 of 12 blocks, grind", { rest: "grind", blocksFrac: 11 / 12 }],
  ["managed (rest on low morale, before majors)", { rest: "managed" }],
  ["weekly rest day", { rest: "weekly" }],
  ["rest twice a week", { rest: "twice" }],
]) {
  row(label, (E) => {
    const r = runs(E, opts);
    return `${mean(r.map((x) => x.finals)).toFixed(2)} | m${mean(r.map((x) => x.morale)).toFixed(0)}`;
  });
}

console.log("\n1e. Corps Budget (Finals gain over spending nothing)");
const base = (E) => meanFinals(E, {});
row("full journeyman staff", (E) =>
  f2(meanFinals(E, { staff: "journeyman" }) - base(E)),
);
row("full kitchen all season", (E) =>
  f2(meanFinals(E, { food: "fullKitchen" }) - base(E)),
);
row("Full Ensemble clinician from Day 20 (Day 24)", (E) =>
  f2(
    at(E, { clinician: { block: "fullEnsemble", from: 20 } }, 24) -
      at(E, {}, 24),
  ),
);

console.log("\n=== 2. SKILL vs LUCK (tier 4, challenge 8) ===");
row("identical-play Finals spread p5-p95", (E) => {
  const xs = finals(E, {}, 60).sort((a, b) => a - b);
  return (xs[56] - xs[3]).toFixed(2);
});
console.log("  effort ladder — Finals by share of days played:");
for (const play of [1, 0.7, 0.5, 0.35, 0.15, 0])
  row(`    plays ${Math.round(play * 100)}%`, (E) =>
    meanFinals(E, { play }).toFixed(2),
  );
row(
  "daily beats a 70%-play director (pairings)",
  (E) =>
    `${Math.round(winRate(finals(E, {}), finals(E, { play: 0.7 }, undefined, "b")) * 100)}%`,
);
row("careful beats careless (same days, same tier)", (E) => {
  const careful = finals(E, {
    plan: "even",
    rest: "managed",
    sched: "moderate",
  });
  const careless = finals(
    E,
    { plan: "feSpam", rest: "grind", sched: "maxFar" },
    undefined,
    "c",
  );
  return `${Math.round(winRate(careful, careless) * 100)}%  (gap ${f2(mean(careful) - mean(careless))})`;
});

console.log(
  "\n=== 3. STRATEGY TOURNAMENT — 192 daily strategies (4 levels x 4 plans x 4 rests x 3 schedules) ===",
);
const grid = [];
for (const chal of [3, 5, 6, 8])
  for (const plan of plans)
    for (const rest of ["grind", "managed", "weekly", "twice"])
      for (const sched of ["auto", "moderate", "maxFar"])
        grid.push({ chal, plan, rest, sched });
const tournament = {};
for (const E of ENGINES) {
  const scored = grid
    .map((g) => ({ g, v: mean(finals(E, g, 12)) }))
    .sort((a, b) => b.v - a.v);
  tournament[E.name] = scored;
}
const name = (g) => `L${g.chal} ${g.plan}/${g.rest}/${g.sched}`;
for (const E of ENGINES) {
  const s = tournament[E.name];
  const best = s[0].v;
  const within = (d) => s.filter((x) => best - x.v <= d).length;
  const naive = s.find(
    (x) =>
      x.g.chal === 8 &&
      x.g.plan === "feSpam" &&
      x.g.rest === "grind" &&
      x.g.sched === "auto",
  );
  const sd = Math.sqrt(
    mean(s.map((x) => (x.v - mean(s.map((y) => y.v))) ** 2)),
  );
  console.log(
    `  [${E.name}] best ${best.toFixed(2)}  top: ${s
      .slice(0, 4)
      .map((x) => `${name(x.g)} ${x.v.toFixed(2)}`)
      .join(" · ")}`,
  );
  console.log(
    `         within 0.5 of best: ${within(0.5)}  within 1.0: ${within(1)}  naive (L8 spam/grind/auto) gap: ${(best - naive.v).toFixed(2)}  strategy spread (sd): ${sd.toFixed(2)}`,
  );
  const worst = s[s.length - 1];
  console.log(`         worst: ${name(worst.g)} ${worst.v.toFixed(2)}`);
}

console.log("\n=== 4. ACCESSIBILITY — rookies, part-timers, money ===");
for (const [label, opts] of [
  ["tier-1 rookie, daily", { tier: 1 }],
  ["tier-1 rookie, plays 35%", { tier: 1, play: 0.35 }],
  ["tier-4, plays 35% (vs daily gap)", { play: 0.35 }],
])
  row(label, (E) => meanFinals(E, opts).toFixed(2));
row("funded (staff+kitchen) minus unfunded", (E) =>
  f2(meanFinals(E, { staff: "journeyman", food: "fullKitchen" }) - base(E)),
);

console.log(
  "\n=== 5. CALIBRATION — flawless-style Finals by tier, highest score seen ===",
);
for (const tier of [1, 4, 7])
  row(`tier ${tier}`, (E) => meanFinals(E, { tier }).toFixed(2));
row("highest single score (tier 7, 60 seasons)", (E) =>
  Math.max(
    ...runs(E, { tier: 7 }, 60).flatMap((r) => Object.values(r.scores)),
  ).toFixed(2),
);

fs.rmSync(refDir, { recursive: true, force: true });
