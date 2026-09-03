// landing_scores/{seasonUid} — the one-doc replacement for the landing
// page's 25-year historical fan-out (F-H1).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  totalFromCaptions,
  landingYearsNeeded,
  buildLandingScores,
} = require("./landingScoresMaterializer");

const captions = (ge, vis, mus) => ({
  GE1: ge / 2, GE2: ge / 2, VP: vis / 3, VA: vis / 3, CG: vis / 3, B: mus / 3, MA: mus / 3, P: mus / 3,
});

const pool = [
  { corpsName: "Blue Devils", sourceYear: 2014, points: 25 },
  { corpsName: "Madison Scouts", sourceYear: "1999", points: 12 },
  { corpsName: "Ghost Corps", sourceYear: 2005, points: 3 },
];

const history = {
  2014: [
    { offSeasonDay: 3, eventName: "Opener", scores: [{ corps: "Blue Devils", captions: captions(40, 30, 30) }] },
    { offSeasonDay: 1, eventName: "Preview", scores: [{ corps: "Blue Devils", captions: captions(38, 28, 28) }] },
    { offSeasonDay: 5, eventName: "Blank night", scores: [{ corps: "Blue Devils", captions: captions(0, 0, 0) }] },
  ],
  1999: [
    { offSeasonDay: 2, eventName: "Drums Along", scores: [{ corps: "Madison Scouts", captions: captions(30, 20, 20) }] },
    { offSeasonDay: 49, eventName: "Finals", scores: [{ corps: "Cavaliers", captions: captions(39, 29, 29) }] },
  ],
};

describe("totalFromCaptions", () => {
  test("GE in full, visual and music halved", () => {
    assert.equal(totalFromCaptions(captions(40, 30, 30)), 70);
    assert.equal(totalFromCaptions(null), 0);
  });
});

describe("landingYearsNeeded", () => {
  test("off-season: every distinct pool source year, as strings", () => {
    assert.deepEqual(landingYearsNeeded({ status: "off-season" }, pool), ["1999", "2005", "2014"]);
  });
  test("live season: only the live year", () => {
    assert.deepEqual(landingYearsNeeded({ status: "live-season", seasonYear: 2026 }, pool), ["2026"]);
  });
});

describe("buildLandingScores", () => {
  test("off-season doc: pool corps with chronological non-zero history, blanks and no-data corps dropped", () => {
    const doc = buildLandingScores({
      seasonData: { seasonUid: "off_2026", status: "off-season" },
      poolCorps: pool,
      historicalByYear: history,
      now: new Date("2026-09-03T06:00:00Z"),
    });
    assert.equal(doc.seasonUid, "off_2026");
    assert.equal(doc.generatedAt, "2026-09-03T06:00:00.000Z");
    assert.equal(doc.lastDay, 3);
    assert.deepEqual(
      doc.corps.map((c) => c.corpsName),
      ["Blue Devils", "Madison Scouts"] // Ghost Corps has no 2005 data
    );
    const bd = doc.corps[0];
    assert.equal(bd.sourceYear, "2014");
    assert.equal(bd.points, 25);
    assert.deepEqual(bd.history, [
      { day: 1, totalScore: 66, eventName: "Preview" },
      { day: 3, totalScore: 70, eventName: "Opener" },
    ]);
  });

  test("live season: scraped corps present in the pool, pool names filter, points null", () => {
    const doc = buildLandingScores({
      seasonData: { seasonUid: "live_2026", status: "live-season", seasonYear: 2026 },
      poolCorps: [{ corpsName: "Blue Devils", sourceYear: 2025, points: 25 }],
      historicalByYear: {
        2026: [
          {
            offSeasonDay: 7,
            eventName: "Tour Premiere",
            scores: [
              { corps: "Blue Devils", captions: captions(40, 30, 30) },
              { corps: "Not In Pool", captions: captions(40, 30, 30) },
            ],
          },
        ],
      },
    });
    assert.deepEqual(
      doc.corps.map((c) => [c.corpsName, c.sourceYear, c.points]),
      [["Blue Devils", "2026", null]]
    );
    assert.equal(doc.lastDay, 7);
  });

  test("empty inputs give an empty, well-formed doc", () => {
    const doc = buildLandingScores({ seasonData: { seasonUid: "s" }, poolCorps: [], historicalByYear: {} });
    assert.deepEqual(doc.corps, []);
    assert.equal(doc.lastDay, 0);
    assert.equal(doc.status, null);
  });
});
