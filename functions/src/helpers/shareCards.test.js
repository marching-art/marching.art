// Tests for the share-card layer: route parsing (the security boundary for
// two public unauthenticated endpoints), SVG card building, and the share
// page's meta tags.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCardSvg,
  buildScoresCardSvg,
  buildChampionCardSvg,
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
