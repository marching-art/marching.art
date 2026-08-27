// Tests for the Design Brief engine: the weekly rotation must be
// deterministic, the pool must stay internally consistent (briefs that can't
// total 100 would cap every week's ceiling), and the trait analysis is the
// scoring contract — a design's score must be reproducible from its data
// alone.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  BRIEF_POOL,
  weekIdFor,
  briefForWeek,
  analyzeDesign,
  scoreBrief,
} = require("./designBrief");

const CLASSIC_DESIGN = {
  colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
  figure: {
    skin: "#c9a074",
    jacket: "#6d1a26",
    chest: "baldric",
    baldric: "#17171a",
    baldricCenter: "#ece2cc",
    spats: true,
    hatType: "shako",
    hat: { body: "#17171a" },
    plume: { type: "upright", color: "#f4f1ea" },
  },
};

const MODERN_DESIGN = {
  colorway: { primary: "#101c33", secondary: "#2f6fd0", accent: "#4fc3ff", metal: "silver" },
  figure: {
    skin: "#c9a074",
    jacket: "#101c33",
    crew: true,
    chest: "swash",
    swash: "#2f6fd0",
    glow: true,
    glowArt: "#4fc3ff",
    sneaker: true,
    armL: { type: "bare" },
    armR: { type: "sleeve", detached: true },
  },
};

describe("weekIdFor / briefForWeek", () => {
  test("ISO weeks in UTC, Monday boundaries", () => {
    assert.equal(weekIdFor(new Date("2026-08-26T12:00:00Z")), "2026-W35");
    assert.equal(weekIdFor(new Date("2026-08-30T23:59:59Z")), "2026-W35"); // Sunday
    assert.equal(weekIdFor(new Date("2026-08-31T00:00:00Z")), "2026-W36"); // Monday flip
    assert.equal(weekIdFor(new Date("2026-01-01T00:00:00Z")), "2026-W01");
  });

  test("rotation is deterministic and always lands in the pool", () => {
    const a = briefForWeek("2026-W35");
    assert.equal(a, briefForWeek("2026-W35"));
    assert.ok(BRIEF_POOL.includes(a));
    // consecutive weeks pick different briefs at least sometimes
    const picks = new Set(
      ["2026-W35", "2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40"].map(
        (w) => briefForWeek(w).id
      )
    );
    assert.ok(picks.size > 1, "the rotation must actually rotate");
  });
});

describe("BRIEF_POOL integrity", () => {
  test("every brief totals exactly 100 points with unique ids", () => {
    const ids = new Set();
    for (const brief of BRIEF_POOL) {
      const total = brief.wants.reduce((s, w) => s + w.points, 0);
      assert.equal(total, 100, `${brief.id} wants must total 100 (got ${total})`);
      assert.ok(!ids.has(brief.id), `duplicate brief id ${brief.id}`);
      ids.add(brief.id);
      for (const want of brief.wants) {
        assert.ok(Array.isArray(want.tags) && want.tags.length > 0, `${brief.id} want without tags`);
        assert.ok(want.label && want.points > 0);
      }
    }
  });

  test("every tag a brief wants is one the analyzer can produce", () => {
    // A trait tag no design can carry would make its points unreachable
    // forever. The classic + modern probes below don't cover every tag, so
    // probe each tag with a design built to carry it.
    const probes = {
      dark: { colorway: { primary: "#101014", secondary: "#17171a", accent: "#1d2f66", metal: "gold" }, figure: { skin: "#c9a074" } },
      bright: { colorway: { primary: "#f4f2ec", secondary: "#ece2cc", accent: "#dfe6f2", metal: "gold" }, figure: { skin: "#c9a074" } },
      warm: { colorway: { primary: "#b3121c", secondary: "#e8641f", accent: "#d9a41c", metal: "gold" }, figure: { skin: "#c9a074" } },
      cool: { colorway: { primary: "#2f6fd0", secondary: "#1f6e63", accent: "#4b2a6b", metal: "gold" }, figure: { skin: "#c9a074" } },
      bold: { colorway: { primary: "#b3121c", secondary: "#2b3fbf", accent: "#e8952f", metal: "gold" }, figure: { skin: "#c9a074" } },
      muted: { colorway: { primary: "#9a9a94", secondary: "#cfd4da", accent: "#e5e4e2", metal: "gold" }, figure: { skin: "#c9a074" } },
      metalGold: { colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" }, figure: { skin: "#c9a074" } },
      metalSilver: { colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "silver" }, figure: { skin: "#c9a074" } },
      shako: { figure: { skin: "#c9a074", hatType: "shako", hat: { body: "#17171a" } } },
      aussie: { figure: { skin: "#c9a074", hatType: "aussie", hat: { body: "#ece2cc" } } },
      campaign: { figure: { skin: "#c9a074", hatType: "campaign", hat: { body: "#c9b287" } } },
      contour: { figure: { skin: "#c9a074", hatType: "contour", hat: { body: "#101c33" } } },
      plume: { figure: { skin: "#c9a074", plume: { type: "upright", color: "#f4f2ec" } } },
      fountain: { figure: { skin: "#c9a074", plume: { type: "fountain", color: "#f4f2ec" } } },
      sash: { figure: { skin: "#c9a074", chest: "sash", sash: "#b3121c" } },
      baldric: { figure: { skin: "#c9a074", chest: "baldric", baldric: "#17171a" } },
      braid: { figure: { skin: "#c9a074", chest: "braid", braid: "#d9a41c" } },
      buttons: { figure: { skin: "#c9a074", chest: "buttons" } },
      plastron: { figure: { skin: "#c9a074", chest: "plastron", panel: "#b3121c" } },
      vinylPanel: { figure: { skin: "#c9a074", chest: "vinylPanel", panel: "#17171a" } },
      triangles: { figure: { skin: "#c9a074", chest: "baldric", baldric: "#17171a", chestShape: "triangles" } },
      badge: { figure: { skin: "#c9a074", chestBadge: { shape: "rect", color: "#b3121c" } } },
      twoTone: { figure: { skin: "#c9a074", chest: "baldric", baldric: "#17171a", baldricCenter: "#ece2cc" } },
      fade: { figure: { skin: "#c9a074", chest: "sash", sash: "#b3121c", chestFade: ["#b3121c", "#101c33"] } },
      sequins: { figure: { skin: "#c9a074", torsoSequin: true } },
      print: { figure: { skin: "#c9a074", print: "opart", torsoFill: "url:opart" } },
      glow: { figure: { skin: "#c9a074", glow: true, glowArt: "#4fc3ff" } },
      velvet: { figure: { skin: "#c9a074", velvet: true } },
      patent: { figure: { skin: "#c9a074", patent: true } },
      spats: { figure: { skin: "#c9a074", spats: true } },
      sneakers: { figure: { skin: "#c9a074", sneaker: true } },
      crew: { figure: { skin: "#c9a074", crew: true } },
      gauntlet: { figure: { skin: "#c9a074", gauntlet: "#17171a" } },
      streamers: { figure: { skin: "#c9a074", streamers: ["#b3121c", "#d9a41c"] } },
      tattered: { figure: { skin: "#c9a074", legL: { color: "#17171a", tattered: true } } },
      bareArms: { figure: { skin: "#c9a074", armL: { type: "bare" } } },
      classic: CLASSIC_DESIGN,
      modern: MODERN_DESIGN,
    };
    const wanted = new Set(BRIEF_POOL.flatMap((b) => b.wants.flatMap((w) => w.tags)));
    for (const tag of wanted) {
      const probe = probes[tag];
      assert.ok(probe, `no probe design for wanted tag "${tag}" — is it producible?`);
      assert.ok(
        analyzeDesign(probe).has(tag),
        `analyzer never produces wanted tag "${tag}" for its probe design`
      );
    }
  });
});

describe("analyzeDesign", () => {
  test("reads era lean, palette, and treatments from the design itself", () => {
    const classic = analyzeDesign(CLASSIC_DESIGN);
    assert.ok(classic.has("classic"));
    assert.ok(!classic.has("modern"));
    assert.ok(classic.has("shako"));
    assert.ok(classic.has("twoTone")); // baldricCenter
    assert.ok(classic.has("metalGold"));

    const modern = analyzeDesign(MODERN_DESIGN);
    assert.ok(modern.has("modern"));
    assert.ok(!modern.has("classic"));
    assert.ok(modern.has("glow"));
    assert.ok(modern.has("cool"));
    assert.ok(modern.has("bareArms"));
  });

  test("tolerates an empty design", () => {
    assert.deepEqual([...analyzeDesign({})], []);
  });
});

describe("scoreBrief", () => {
  test("score is the sum of matched wants, with the full breakdown", () => {
    const brief = BRIEF_POOL.find((b) => b.id === "midnight-classic");
    const { score, matched, missed } = scoreBrief(brief, {
      colorway: { primary: "#101014", secondary: "#17171a", accent: "#1d2f66", metal: "silver" },
      figure: CLASSIC_DESIGN.figure,
    });
    // dark(25) + classic(25) + shako(20) + plume(15) + baldric(15) = 100
    assert.equal(score, 100);
    assert.equal(matched.length, 5);
    assert.equal(missed.length, 0);

    const partial = scoreBrief(brief, MODERN_DESIGN);
    assert.ok(partial.score < 100);
    assert.equal(
      partial.score,
      partial.matched.reduce((s, w) => s + w.points, 0)
    );
    assert.equal(partial.matched.length + partial.missed.length, brief.wants.length);
  });
});
