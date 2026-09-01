// Tests for the share-card layer: route parsing (the security boundary for
// two public unauthenticated endpoints), SVG card building, and the share
// page's meta tags.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCardSvg,
  buildScoresCardSvg,
  buildChampionCardSvg,
  buildUniformCardSvg,
  buildShareHtml,
  parseOgPath,
  parseSharePath,
} = require("./shareCards");

const RECAP = {
  shows: [
    {
      eventName: "Midwest Classic",
      results: [
        {
          uid: "u1",
          corpsClass: "worldClass",
          corpsName: "Crimson Cadence",
          displayName: "DirectorDan",
          totalScore: 91.35,
        },
        { uid: "u2", corpsClass: "worldClass", corpsName: "Golden Empire", totalScore: 89.9 },
        { uid: "u3", corpsClass: "aClass", corpsName: "Steel City Sound", totalScore: 61.2 },
        { uid: "u4", corpsClass: "soundSport", corpsName: "Bayou Brigade", totalScore: 80 },
      ],
    },
  ],
};

describe("parseOgPath", () => {
  test("parses a scores card path", () => {
    assert.deepEqual(parseOgPath("/api/og/scores/season42/12/worldClass.png"), {
      type: "scores",
      seasonUid: "season42",
      day: 12,
      classKey: "worldClass",
    });
  });

  test("parses a champion card path", () => {
    assert.deepEqual(parseOgPath("/api/og/champion/scherzo_2026/openClass.png"), {
      type: "champion",
      seasonId: "scherzo_2026",
      classKey: "openClass",
    });
  });

  test("rejects unknown classes, bad days, and traversal attempts", () => {
    assert.equal(parseOgPath("/api/og/scores/season42/12/notAClass.png"), null);
    assert.equal(parseOgPath("/api/og/scores/season42/0/worldClass.png"), null);
    assert.equal(parseOgPath("/api/og/scores/season42/50/worldClass.png"), null);
    assert.equal(parseOgPath("/api/og/scores/season42/abc/worldClass.png"), null);
    assert.equal(parseOgPath("/api/og/champion/..%2F..%2Fetc/worldClass.png"), null);
    assert.equal(parseOgPath("/api/og/unknown/x.png"), null);
    assert.equal(parseOgPath("/totally/else"), null);
  });
});

describe("parseSharePath", () => {
  test("parses article, scores, and champion share paths", () => {
    assert.deepEqual(parseSharePath("/share/article/season42_day_12_fantasy_recap"), {
      type: "article",
      articleId: "season42_day_12_fantasy_recap",
    });
    assert.deepEqual(parseSharePath("/share/scores/season42/7/aClass"), {
      type: "scores",
      seasonUid: "season42",
      day: 7,
      classKey: "aClass",
    });
    assert.deepEqual(parseSharePath("/share/champion/overture_2026/worldClass"), {
      type: "champion",
      seasonId: "overture_2026",
      classKey: "worldClass",
    });
  });

  test("rejects malformed paths", () => {
    assert.equal(parseSharePath("/share"), null);
    assert.equal(parseSharePath("/share/article"), null);
    assert.equal(parseSharePath("/share/article/has/extra/segments"), null);
    assert.equal(parseSharePath("/share/scores/s1/12/podClass"), null);
    assert.equal(parseSharePath("/other/article/x"), null);
  });
});

describe("buildScoresCardSvg", () => {
  test("ranks the requested class only, with formatted scores", () => {
    const svg = buildScoresCardSvg({
      recap: RECAP,
      day: 12,
      classKey: "worldClass",
      seasonName: "Scherzo 2026",
    });
    assert.ok(svg.includes("Day 12 — World Class"));
    assert.ok(svg.includes("Crimson Cadence"));
    assert.ok(svg.includes("91.350"));
    assert.ok(svg.includes("DirectorDan"));
    assert.ok(svg.includes("Scherzo 2026"));
    // Other classes stay off this card.
    assert.ok(!svg.includes("Steel City Sound"));
  });

  test("returns null when the class has no results", () => {
    assert.equal(
      buildScoresCardSvg({ recap: RECAP, day: 12, classKey: "openClass" }),
      null
    );
    assert.equal(buildScoresCardSvg({ recap: { shows: [] }, day: 1, classKey: "worldClass" }), null);
  });

  test("never renders SoundSport scores", () => {
    // SoundSport is participation-focused: ratings are never exposed, so no
    // card exists for it (aggregateNightlyStandings excludes it from byClass).
    assert.equal(buildScoresCardSvg({ recap: RECAP, day: 12, classKey: "soundSport" }), null);
  });
});

describe("buildChampionCardSvg", () => {
  const CHAMPIONS = {
    seasonName: "Overture 2026",
    classes: {
      worldClass: [{ rank: 1, corpsName: "Crimson Cadence", username: "DirectorDan", score: 97.825 }],
    },
  };

  test("renders the season name, class, and champion", () => {
    const svg = buildChampionCardSvg({ champions: CHAMPIONS, classKey: "worldClass" });
    assert.ok(svg.includes("Overture 2026 Champions"));
    assert.ok(svg.includes("World Class"));
    assert.ok(svg.includes("Crimson Cadence"));
    assert.ok(svg.includes("97.825"));
  });

  test("returns null for a class with no archived champions", () => {
    assert.equal(buildChampionCardSvg({ champions: CHAMPIONS, classKey: "aClass" }), null);
    assert.equal(buildChampionCardSvg({ champions: {}, classKey: "worldClass" }), null);
  });
});

describe("buildCardSvg", () => {
  test("escapes XML-significant characters in user-authored names", () => {
    const svg = buildCardSvg({
      kicker: "Test",
      title: `Corps <script>&"'`,
      rows: [{ rank: 1, name: `Evil <img> & "quotes"`, detail: "<b>dir</b>" }],
    });
    assert.ok(!svg.includes("<script>"));
    assert.ok(!svg.includes("<img>"));
    assert.ok(!svg.includes("<b>dir</b>"));
    assert.ok(svg.includes("&amp;"));
  });

  test("caps rows at five", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ rank: i + 1, name: `Corps ${i + 1}` }));
    const svg = buildCardSvg({ kicker: "K", title: "T", rows });
    assert.ok(svg.includes("Corps 5"));
    assert.ok(!svg.includes("Corps 6"));
  });
});

describe("uniform share routes + card", () => {
  test("parses /share/uniform and /api/og/uniform, case-insensitively", () => {
    assert.deepEqual(parseSharePath("/share/uniform/MA-7K3F-Q2"), {
      type: "uniform",
      code: "MA-7K3F-Q2",
    });
    assert.deepEqual(parseSharePath("/share/uniform/ma-7k3f-q2"), {
      type: "uniform",
      code: "MA-7K3F-Q2",
    });
    assert.deepEqual(parseOgPath("/api/og/uniform/MA-7K3F-Q2.png"), {
      type: "uniform",
      code: "MA-7K3F-Q2",
    });
    // wrong shape / ambiguous charset (O, 1) never resolves
    assert.equal(parseSharePath("/share/uniform/MA-XXXX"), null);
    assert.equal(parseSharePath("/share/uniform/MA-O1O1-O1"), null);
    assert.equal(parseOgPath("/api/og/uniform/../etc.png"), null);
  });

  test("uniform card carries name, creator, code, and the design's colors", () => {
    const svg = buildUniformCardSvg({
      code: "MA-7K3F-Q2",
      codeDoc: {
        designName: "Ivory Blade",
        creatorName: "MaestroMax",
        design: {
          schema: 2,
          name: "Ivory Blade",
          colorway: { primary: "#ece2cc", secondary: "#17171a", accent: "#d9a41c", metal: "gold" },
          figure: {
            skin: "#e0b48e",
            jacket: "#ece2cc",
            chest: "baldric",
            baldric: "#17171a",
            hatType: "shako",
            hat: { body: "#ece2cc", band: "#17171a" },
            plume: { type: "fountain", color: "#f7f5f0" },
          },
        },
      },
    });
    assert.ok(svg.includes("Ivory Blade"));
    assert.ok(svg.includes("MaestroMax"));
    assert.ok(svg.includes("MA-7K3F-Q2"));
    assert.ok(svg.includes('"#ece2cc"')); // jacket/primary drives the glyph
    assert.ok(svg.includes('"#f7f5f0"')); // plume stroke
  });

  test("uniform card escapes hostile names and rejects invalid colors", () => {
    const svg = buildUniformCardSvg({
      code: "MA-7K3F-Q2",
      codeDoc: {
        designName: `<script>alert(1)</script>`,
        creatorName: "x",
        design: {
          schema: 2,
          name: "n",
          colorway: { primary: "url(javascript:x)", secondary: "#17171a", accent: "#d9a41c" },
          figure: { skin: "#c9a074", jacket: 'red" onload="x' },
        },
      },
    });
    assert.ok(!svg.includes("<script>"));
    assert.ok(!svg.includes("javascript:"));
    assert.ok(!svg.includes("onload"));
  });

  test("uniform card is null without a design snapshot", () => {
    assert.equal(buildUniformCardSvg({ code: "MA-7K3F-Q2", codeDoc: null }), null);
    assert.equal(buildUniformCardSvg({ code: "MA-7K3F-Q2", codeDoc: {} }), null);
  });
});

describe("buildShareHtml", () => {
  test("carries the full OG/Twitter tag set and redirects humans", () => {
    const html = buildShareHtml({
      title: "Day 12 World Class scores | marching.art",
      description: "Crimson Cadence leads.",
      imageUrl: "https://marching.art/api/og/scores/s1/12/worldClass.png",
      redirectPath: "/",
    });
    assert.ok(html.includes('property="og:title" content="Day 12 World Class scores | marching.art"'));
    assert.ok(html.includes('property="og:image" content="https://marching.art/api/og/scores/s1/12/worldClass.png"'));
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
    assert.ok(html.includes('link rel="canonical" href="https://marching.art/"'));
    assert.ok(html.includes('http-equiv="refresh" content="0;url=https://marching.art/"'));
    assert.ok(html.includes("window.location.replace"));
  });

  test("escapes user-authored titles and descriptions", () => {
    const html = buildShareHtml({
      title: `"><script>alert(1)</script>`,
      description: `desc & <more>`,
      imageUrl: "https://marching.art/og-image.jpg",
      redirectPath: "/article/x",
    });
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("desc &amp; &lt;more&gt;"));
  });
});

describe("corps program card", () => {
  const { buildCorpsCardSvg, parseOgPath: parseOg } = require("./shareCards");

  test("parseOgPath accepts /api/og/corps/{username}/{slug}.png", () => {
    assert.deepEqual(parseOg("/api/og/corps/alice/world-class.png"), {
      type: "corps",
      username: "alice",
      classKey: "worldClass",
    });
    assert.deepEqual(parseOg("/api/og/corps/Rohn_99/soundsport.png"), {
      type: "corps",
      username: "Rohn_99",
      classKey: "soundSport",
    });
  });

  test("parseOgPath rejects unknown slugs and bad usernames", () => {
    assert.equal(parseOg("/api/og/corps/alice/worldClass.png"), null);
    assert.equal(parseOg("/api/og/corps/alice/nope.png"), null);
    assert.equal(parseOg("/api/og/corps/a!/world-class.png"), null);
    assert.equal(parseOg("/api/og/corps/alice.png"), null);
  });

  test("renders the corps, director, show title and program URL — escaped", () => {
    const svg = buildCorpsCardSvg({
      corpsName: 'Aurora <Vanguard> & Co',
      classKey: "worldClass",
      displayName: "Alice",
      username: "alice",
      showName: "Beneath the Static",
      uniform: { colorway: { primary: "#112233", secondary: "#445566", accent: "#778899" } },
    });
    assert.ok(svg.includes("Aurora &lt;Vanguard&gt; &amp; Co"));
    assert.ok(!svg.includes("<Vanguard>"));
    assert.ok(svg.includes("Beneath the Static"));
    assert.ok(svg.includes("marching.art/d/alice/world-class"));
    // The design's own palette drives the swatches.
    assert.ok(svg.includes("#112233"));
  });

  test("a corps with no uniform still gets a card, on fallback colors", () => {
    const svg = buildCorpsCardSvg({
      corpsName: "Plain Corps",
      classKey: "aClass",
      displayName: "Bob",
      username: "bob",
    });
    assert.ok(svg.includes("Plain Corps"));
    assert.ok(svg.includes("A CLASS"));
  });

  test("no corps name or username -> no card", () => {
    assert.equal(buildCorpsCardSvg({ corpsName: "", classKey: "aClass", username: "b" }), null);
    assert.equal(buildCorpsCardSvg({ corpsName: "X", classKey: "aClass", username: "" }), null);
  });
});
