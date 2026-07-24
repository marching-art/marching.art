// Tests for the public results pages: aggregation (caption sums, legacy
// degradation, SoundSport score suppression), page building, and the
// /results route parsing that guards the public endpoint.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  aggregateDayResults,
  buildDayResultsHtml,
  buildSeasonIndexHtml,
  parseResultsPath,
} = require("./resultsPages");

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
          geScore: 27.5,
          visualScore: 31.9,
          musicScore: 31.95,
        },
        {
          uid: "u2",
          corpsClass: "worldClass",
          corpsName: "Golden Empire",
          totalScore: 89.9,
          geScore: 27.0,
          visualScore: 31.5,
          musicScore: 31.4,
        },
        {
          uid: "u3",
          corpsClass: "aClass",
          corpsName: "Steel City Sound",
          totalScore: 55.2,
          // Legacy era: no caption fields.
        },
        {
          uid: "u4",
          corpsClass: "soundSport",
          corpsName: "Bayou Brigade",
          totalScore: 82,
          medal: "Gold",
        },
      ],
    },
  ],
};

describe("aggregateDayResults", () => {
  test("ranks classes by summed total with caption sums", () => {
    const { byClass } = aggregateDayResults(RECAP);
    const world = byClass.get("worldClass");
    assert.equal(world.length, 2);
    assert.equal(world[0].corpsName, "Crimson Cadence");
    assert.equal(world[0].rank, 1);
    assert.equal(world[0].ge, 27.5);
    assert.equal(world[1].rank, 2);
  });

  test("degrades caption-less legacy rows to total-only", () => {
    const { byClass } = aggregateDayResults(RECAP);
    const aClass = byClass.get("aClass")[0];
    assert.equal(aClass.total, 55.2);
    assert.equal(aClass.ge, null);
    assert.equal(aClass.vis, null);
    assert.equal(aClass.mus, null);
  });

  test("collects SoundSport as a scoreless medal list", () => {
    const { soundSport, byClass } = aggregateDayResults(RECAP);
    assert.equal(byClass.has("soundSport"), false);
    assert.deepEqual(soundSport, [
      { corpsName: "Bayou Brigade", displayName: "", medal: "Gold" },
    ]);
  });
});

describe("buildDayResultsHtml", () => {
  const html = buildDayResultsHtml({
    seasonUid: "season42",
    seasonName: "Scherzo 2026",
    day: 12,
    recap: RECAP,
    days: [10, 12, 13],
  });

  test("renders standings tables with canonical, OG card, and nav links", () => {
    assert.ok(html.includes("Day 12 — Scherzo 2026"));
    assert.ok(html.includes("Crimson Cadence"));
    assert.ok(html.includes("91.350"));
    assert.ok(html.includes('href="https://marching.art/results/season42/12"')); // canonical
    assert.ok(html.includes("/api/og/scores/season42/12/worldClass.png"));
    assert.ok(html.includes('href="/results/season42/10"')); // prev day
    assert.ok(html.includes('href="/results/season42/13"')); // next day
    assert.ok(html.includes('href="/results/season42"')); // season index
  });

  test("never prints a numeric SoundSport score", () => {
    assert.ok(html.includes("Bayou Brigade"));
    assert.ok(html.includes("Gold"));
    assert.ok(!html.includes("82.000"));
  });

  test("returns null for an empty recap", () => {
    assert.equal(
      buildDayResultsHtml({ seasonUid: "s", day: 1, recap: { shows: [] }, days: [] }),
      null
    );
  });

  test("escapes user-authored names", () => {
    const evil = {
      shows: [
        {
          eventName: "Show",
          results: [
            {
              uid: "u1",
              corpsClass: "worldClass",
              corpsName: `<script>alert(1)</script>`,
              totalScore: 90,
              geScore: 30,
              visualScore: 30,
              musicScore: 30,
            },
          ],
        },
      ],
    };
    const page = buildDayResultsHtml({ seasonUid: "s", day: 1, recap: evil, days: [1] });
    assert.ok(!page.includes("<script>alert(1)</script>"));
    assert.ok(page.includes("&lt;script&gt;"));
  });
});

describe("buildSeasonIndexHtml", () => {
  test("lists days and champions, marking SoundSport as Best in Show", () => {
    const html = buildSeasonIndexHtml({
      seasonUid: "overture_2026",
      seasonName: "Overture 2026",
      days: [1, 2, 3],
      champions: {
        seasonName: "Overture 2026",
        classes: {
          worldClass: [{ corpsName: "Crimson Cadence", username: "DirectorDan", score: 97.825 }],
          soundSport: [{ corpsName: "Bayou Brigade", score: 88 }],
        },
      },
    });
    assert.ok(html.includes("Overture 2026"));
    assert.ok(html.includes('href="/results/overture_2026/2"'));
    assert.ok(html.includes("97.825"));
    assert.ok(html.includes("Best in Show"));
    assert.ok(!html.includes("88.000"));
  });

  test("renders a days-only index for the active season", () => {
    const html = buildSeasonIndexHtml({ seasonUid: "s1", seasonName: "", days: [1], champions: null });
    assert.ok(html.includes('href="/results/s1/1"'));
    assert.ok(!html.includes("Season Champions"));
  });

  test("returns null with neither days nor champions", () => {
    assert.equal(buildSeasonIndexHtml({ seasonUid: "s1", days: [], champions: null }), null);
  });
});

describe("parseResultsPath", () => {
  test("parses bare, index, and day routes", () => {
    assert.deepEqual(parseResultsPath("/results"), { seasonUid: null, day: null });
    assert.deepEqual(parseResultsPath("/results/season42"), { seasonUid: "season42", day: null });
    assert.deepEqual(parseResultsPath("/results/season42/12"), { seasonUid: "season42", day: 12 });
  });

  test("rejects bad seasons, days, and extra segments", () => {
    assert.equal(parseResultsPath("/results/bad season"), null);
    assert.equal(parseResultsPath("/results/s1/0"), null);
    assert.equal(parseResultsPath("/results/s1/50"), null);
    assert.equal(parseResultsPath("/results/s1/12/extra"), null);
    assert.equal(parseResultsPath("/elsewhere/s1"), null);
  });
});
