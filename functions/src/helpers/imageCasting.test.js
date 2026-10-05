// Casting tests: image prompts name a cast drawn fresh per image — gender a
// coin flip, background weighted to the U.S., neither tied to a section — so
// across many images the cast looks like the country and nothing is fixed.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { US_BACKGROUNDS, drawPerformer, dealCast, buildCastingBlock } = require("./imageCasting");
const {
  SCENE_ARCHETYPES,
  buildFantasyPerformersImagePrompt,
  buildStandingsImagePrompt,
  buildFantasyLeagueImagePrompt,
  buildArticleImagePrompt,
  buildCorpsAvatarPrompt,
} = require("./newsImagePrompts");

/** Deterministic RNG (mulberry32) so the statistical checks are stable. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const total = US_BACKGROUNDS.reduce((s, b) => s + b.weight, 0);

test("background weights sum to ~100% and white is about half, not three quarters", () => {
  assert.ok(Math.abs(total - 100) <= 1);
  const white = US_BACKGROUNDS.find(b => b.woman === "a white woman");
  assert.ok(white && white.weight / total < 0.6);
});

test("draws track U.S. shares and split gender evenly", () => {
  const rng = seeded(42);
  const N = 20000;
  const counts = new Map();
  let women = 0;
  for (let i = 0; i < N; i++) {
    const p = drawPerformer(rng);
    if (p.woman) women++;
    const key = p.who.replace(/ (woman|man)$/, "").replace(/Latina|Latino/, "Latin");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.ok(Math.abs(women / N - 0.5) < 0.02, `women ${women / N}`);
  for (const b of US_BACKGROUNDS) {
    const key = b.woman.replace(/ woman$/, "").replace(/Latina/, "Latin");
    const share = (counts.get(key) || 0) / N;
    assert.ok(Math.abs(share - b.weight / total) < 0.015, `${key}: ${share}`);
  }
});

test("no background or gender is pinned to a scene — every role sees variety", () => {
  const rng = seeded(7);
  for (const scene of SCENE_ARCHETYPES) {
    assert.ok([1, 2, 3].includes(scene.castSize), `${scene.id} castSize`);
    const leads = new Set();
    const genders = new Set();
    for (let i = 0; i < 60; i++) {
      const { lead } = dealCast(scene.castSize, rng);
      leads.add(lead.who);
      genders.add(lead.woman);
    }
    assert.equal(genders.size, 2, `${scene.id} gets women and men`);
    assert.ok(leads.size >= 5, `${scene.id} gets varied leads (${leads.size})`);
  }
});

test("consecutive images are not predictable from one another", () => {
  const rng = seeded(99);
  const seq = Array.from({ length: 200 }, () => drawPerformer(rng).who);
  const repeats = seq.slice(1).filter((who, i) => who === seq[i]).length;
  // Independent draws repeat often enough to rule out any fixed cycle...
  assert.ok(repeats > 5, `repeats ${repeats}`);
  // ...and the sequence has no short period.
  for (let period = 1; period <= 20; period++) {
    assert.ok(seq.slice(period).some((who, i) => who !== seq[i]), `period ${period}`);
  }
});

test("dealCast sizes the cast and flags women together", () => {
  const rng = seeded(3);
  let together = 0;
  for (let i = 0; i < 1000; i++) {
    const { lead, companions, womenTogether } = dealCast(3, rng);
    assert.equal(companions.length, 2);
    assert.equal(womenTogether, [lead, ...companions].filter(c => c.woman).length >= 2);
    if (womenTogether) together++;
  }
  assert.ok(together > 400 && together < 600, `women together ${together}/1000`);
  assert.deepEqual(dealCast(1, rng).companions, []);
  assert.equal(dealCast(/** @type {any} */ ("junk"), rng).companions.length, 0);
});

test("a broken RNG still yields a valid performer", () => {
  assert.ok(drawPerformer(() => NaN).who);
  assert.ok(drawPerformer(() => 1).who);
  assert.ok(drawPerformer(() => -5).who);
});

test("casting block names the cast and carries the standing rules", () => {
  const solo = buildCastingBlock({ size: 1, rng: seeded(1) });
  assert.match(solo, /FEATURED PERFORMER: an? [\w ]+ (woman|man), in the role this scene gives them/);
  assert.ok(solo.includes("women play brass and percussion and conduct as drum major"));
  assert.ok(solo.includes("Do not default to white men"));
  assert.ok(!solo.includes("Historical accuracy"));

  const group = buildCastingBlock({ size: 3, historicalCorps: "The Cavaliers", rng: seeded(1) });
  assert.ok(group.includes("LEAD (sharpest, most prominent)"));
  assert.ok(group.includes("ALONGSIDE THEM"));
  assert.ok(group.includes("if The Cavaliers was an all-male corps"));
});

test("every image prompt builder carries a CAST block", () => {
  const prompts = [
    buildFantasyPerformersImagePrompt("Fire Storm", "finale", null, null, 3, 4),
    buildStandingsImagePrompt("Blue Devils", 2024, "Indianapolis", "DCI Finals", null, null, 3, 0),
    buildFantasyLeagueImagePrompt(),
    buildArticleImagePrompt("fantasy", "Big night", "summary", {}),
    buildCorpsAvatarPrompt("Fire Storm", null, { avatarStyle: "performer" }),
  ];
  for (const prompt of prompts) assert.ok(prompt.includes("CAST — WHO IS IN THIS PICTURE"));
  // Real corps get the all-male-era caveat; fantasy corps don't.
  assert.ok(prompts[1].includes("if Blue Devils was an all-male corps"));
  assert.ok(!prompts[0].includes("all-male"));
});
