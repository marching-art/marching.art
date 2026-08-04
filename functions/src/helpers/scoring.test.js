// Unit tests for the pure scoring math in scoring.js.
// Uses Node's built-in test runner (node:test) so no extra dependency is
// needed in the functions codebase. Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  simpleLinearRegression,
  getScoreForDay,
  getRealisticCaptionScore,
  projectCaptionScore,
  normalizeCorpsName,
  countRealScoresForDay,
  liveSeasonYear,
} = require("./scoring");

describe("simpleLinearRegression", () => {
  test("fits a perfect line (slope 2, intercept 0)", () => {
    const { m, c } = simpleLinearRegression([
      [0, 0],
      [1, 2],
      [2, 4],
    ]);
    assert.equal(m, 2);
    assert.equal(c, 0);
  });

  test("fits a line with a non-zero intercept", () => {
    const { m, c } = simpleLinearRegression([
      [0, 3],
      [1, 5],
      [2, 7],
    ]);
    assert.equal(m, 2);
    assert.equal(c, 3);
  });

  test("returns a flat line for a horizontal series", () => {
    const { m, c } = simpleLinearRegression([
      [0, 5],
      [1, 5],
      [2, 5],
    ]);
    assert.equal(m, 0);
    assert.equal(c, 5);
  });

  test("falls back to the single point's y with <2 points", () => {
    assert.deepEqual(simpleLinearRegression([[5, 7]]), { m: 0, c: 7 });
  });

  test("returns zeros for empty input", () => {
    assert.deepEqual(simpleLinearRegression([]), { m: 0, c: 0 });
  });
});

describe("getScoreForDay", () => {
  const historicalData = {
    2019: [
      {
        offSeasonDay: 5,
        scores: [
          { corps: "Blue Devils", captions: { GE1: 19.5, GE2: 19.0 } },
          { corps: "Bluecoats", captions: { GE1: 19.2 } },
        ],
      },
      {
        offSeasonDay: 6,
        scores: [{ corps: "Blue Devils", captions: { GE1: 19.7 } }],
      },
    ],
  };

  test("returns the caption score for the matching day and corps", () => {
    assert.equal(getScoreForDay(5, "Blue Devils", 2019, "GE1", historicalData), 19.5);
    assert.equal(getScoreForDay(5, "Blue Devils", 2019, "GE2", historicalData), 19.0);
    assert.equal(getScoreForDay(6, "Blue Devils", 2019, "GE1", historicalData), 19.7);
  });

  test("returns null when the day has no events", () => {
    assert.equal(getScoreForDay(99, "Blue Devils", 2019, "GE1", historicalData), null);
  });

  test("returns null when the corps did not compete", () => {
    assert.equal(getScoreForDay(5, "Phantom Regiment", 2019, "GE1", historicalData), null);
  });

  test("returns null when the year is absent", () => {
    assert.equal(getScoreForDay(5, "Blue Devils", 1999, "GE1", historicalData), null);
  });

  test("treats a zero caption score as missing (returns null)", () => {
    const withZero = {
      2019: [{ offSeasonDay: 1, scores: [{ corps: "X", captions: { GE1: 0 } }] }],
    };
    assert.equal(getScoreForDay(1, "X", 2019, "GE1", withZero), null);
  });
});

describe("liveSeasonYear", () => {
  // The live strategy used the wall clock for the scraped-scores year, which
  // broke reprocessing across New Year and archived-season runs — the season
  // doc, not today's date, must decide which historical_scores/{year} to read.
  test("prefers the season doc's seasonYear (finals year)", () => {
    assert.equal(liveSeasonYear({ seasonYear: 2025 }), 2025);
  });

  test("coerces a string seasonYear", () => {
    assert.equal(liveSeasonYear({ seasonYear: "2024" }), 2024);
  });

  test("falls back to the schedule start date's UTC year", () => {
    const seasonData = {
      schedule: { startDate: { toDate: () => new Date(Date.UTC(2023, 5, 1)) } },
    };
    assert.equal(liveSeasonYear(seasonData), 2023);
  });

  test("seasonYear wins over the schedule start date", () => {
    const seasonData = {
      seasonYear: 2025,
      schedule: { startDate: { toDate: () => new Date(Date.UTC(2023, 5, 1)) } },
    };
    assert.equal(liveSeasonYear(seasonData), 2025);
  });

  test("uses the wall clock only when the season carries neither", () => {
    assert.equal(liveSeasonYear({}), new Date().getFullYear());
    assert.equal(liveSeasonYear(undefined), new Date().getFullYear());
  });
});

describe("getRealisticCaptionScore", () => {
  test("returns the real score verbatim when one exists (deterministic path)", () => {
    const historicalData = {
      2019: [
        { offSeasonDay: 5, scores: [{ corps: "Blue Devils", captions: { GE1: 19.5 } }] },
      ],
    };
    assert.equal(
      getRealisticCaptionScore("Blue Devils", 2019, "GE1", 5, historicalData),
      19.5
    );
  });

  // The rule the whole scoring run rests on: a published score is the score.
  // No jitter, no rounding to the 0.05 grid projections use, no averaging.
  test("never perturbs a real score, however awkward its precision", () => {
    const historicalData = {
      2026: [
        { offSeasonDay: 44, scores: [{ corps: "Bluecoats", captions: { GE1: 19.637 } }] },
      ],
    };
    for (let i = 0; i < 25; i++) {
      assert.equal(
        getRealisticCaptionScore("Bluecoats", 2026, "GE1", 44, historicalData),
        19.637
      );
    }
  });

  test("projects (never returns 0) when the corps' name spelling drifted", () => {
    const historicalData = {
      2025: [
        { offSeasonDay: 10, scores: [{ corps: "The Cavaliers", captions: { GE1: 15.0 } }] },
        { offSeasonDay: 20, scores: [{ corps: "The Cavaliers", captions: { GE1: 16.2 } }] },
        { offSeasonDay: 30, scores: [{ corps: "The Cavaliers", captions: { GE1: 17.1 } }] },
      ],
    };
    const score = getRealisticCaptionScore("Cavaliers", 2025, "GE1", 35, historicalData);
    assert.ok(score > 16 && score < 18.5, `expected a projection near the trend, got ${score}`);
  });
});

describe("projectCaptionScore", () => {
  // A top corps' real season: strong, improving, topping out just over 19.
  // The old exponential-on-score fit projected 20+ for this shape from about
  // day 45 on, and scoring.js's Math.min(20, ...) flattened every one of them
  // to exactly 20.000 — so every lineup with a top corps in GE1 and GE2 read
  // a perfect 40.0 General Effect.
  //
  // (Accuracy is guarded separately, against 23 seasons of real results —
  // see scoringMath.corpus.test.js. These tests pin the contract.)
  const TOP_CORPS = [
    [3, 14.2], [8, 15.1], [13, 16.0], [18, 16.8], [23, 17.4],
    [28, 17.9], [33, 18.4], [38, 18.8], [41, 19.0],
  ];

  test("never reaches the 20-point caption ceiling, even at finals", () => {
    for (let day = 41; day <= 49; day++) {
      const score = projectCaptionScore(TOP_CORPS, day, `Bluecoats|2026|GE1|${day}`);
      assert.ok(score < 20, `day ${day} projected ${score}`);
    }
  });

  test("stays close to what the corps has actually scored", () => {
    // Day 44 is three days past the last real result of 19.0. A projection
    // is allowed to inch up, not to leap a full point.
    const score = projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE1|44");
    assert.ok(score >= 18.5 && score <= 19.2, `projected ${score}`);
  });

  test("is deterministic — re-scoring a day reproduces the same number", () => {
    const first = projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE1|44");
    for (let i = 0; i < 10; i++) {
      assert.equal(projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE1|44"), first);
    }
  });

  test("varies between captions rather than returning one flat value", () => {
    const ge1 = projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE1|44");
    const ge2 = projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE2|44");
    // Same history, different caption seeds: within one jitter tick of each
    // other, but not mechanically identical.
    assert.ok(Math.abs(ge1 - ge2) <= 0.15);
  });

  test("lands on the 0.05 grid real caption scores use", () => {
    const score = projectCaptionScore(TOP_CORPS, 44, "Bluecoats|2026|GE1|44");
    assert.equal(Math.round(score * 100) % 5, 0, `${score} is off-grid`);
  });

  test("a struggling corps is not dragged up toward the ceiling", () => {
    const midCorps = [[3, 10.0], [17, 12.8], [31, 14.6], [41, 15.5]];
    const score = projectCaptionScore(midCorps, 49, "Some Corps|2026|GE1|49");
    assert.ok(score > 14.5 && score < 16.6, `projected ${score}`);
  });

  test("a declining corps projects down, never below zero", () => {
    const declining = [[10, 12.0], [20, 11.0], [30, 9.5], [40, 8.0]];
    const score = projectCaptionScore(declining, 49, "Some Corps|2026|GE1|49");
    assert.ok(score >= 0 && score < 8.5, `projected ${score}`);
  });

  test("a single data point projects from that point, bounded", () => {
    const score = projectCaptionScore([[10, 15.0]], 44, "Some Corps|2026|GE1|44");
    assert.ok(score >= 14.0 && score <= 16.0, `projected ${score}`);
  });

  // Inside the range of days a corps actually competed in, its neighbouring
  // shows carry most of the signal — a corps that sat at 17.5 on day 20 and
  // 17.6 on day 24 was not somewhere else on day 22, whatever the season-long
  // trend through its early shows suggests.
  test("a day inside the season reads off the shows either side of it", () => {
    const dipped = [[5, 12.0], [10, 14.0], [20, 17.5], [24, 17.6], [30, 18.4]];
    const score = projectCaptionScore(dipped, 22, "Some Corps|2026|GE1|22");
    assert.ok(score >= 17.2 && score <= 17.9, `projected ${score} between 17.5 and 17.6`);
  });

  // A trend is evidence about tomorrow, not about three weeks out. Without
  // damping, extending a fit that far compounds into a runaway number.
  test("extending a trend a long way does not run away", () => {
    const early = [[3, 13.0], [6, 14.2], [9, 15.1], [12, 15.8]];
    const near = projectCaptionScore(early, 14, "Some Corps|2026|GE1|14");
    const far = projectCaptionScore(early, 45, "Some Corps|2026|GE1|45");
    assert.ok(near >= 15.5 && near <= 16.5, `day 14 projected ${near}`);
    // 33 days past the last real show: still bounded by the band, and still
    // recognisably this corps rather than a finalist.
    assert.ok(far > near, `day 45 (${far}) should not fall below day 14 (${near})`);
    assert.ok(far <= 18.9, `day 45 projected ${far} — too far above a 15.8 corps`);
  });

  // The band widens with distance because real corps do: they beat their own
  // prior best ~40% of the time, by more the longer they have been off.
  test("the band opens up with distance from the corps' real season", () => {
    const flat = [[10, 15.0], [12, 15.0], [14, 15.0]];
    const nextDay = projectCaptionScore(flat, 15, "Some Corps|2026|GE1|15");
    const weeksLater = projectCaptionScore(flat, 40, "Some Corps|2026|GE1|40");
    assert.ok(nextDay <= 15.0 + 0.95, `day 15 projected ${nextDay}`);
    assert.ok(weeksLater <= 15.0 + 3.0, `day 40 projected ${weeksLater}`);
  });

  test("returns 0 with no data", () => {
    assert.equal(projectCaptionScore([], 44, "x"), 0);
  });

  test("clamps source data that already sits at the ceiling", () => {
    const perfect = [[10, 20], [20, 20], [30, 20]];
    const score = projectCaptionScore(perfect, 44, "Some Corps|2026|GE1|44");
    assert.ok(score < 20, `projected ${score}`);
  });
});

describe("normalizeCorpsName", () => {
  test("collapses casing, punctuation, accents and a leading 'The'", () => {
    assert.equal(normalizeCorpsName("The Cavaliers"), "cavaliers");
    assert.equal(normalizeCorpsName("Blue Devils"), "blue devils");
    assert.equal(normalizeCorpsName("  BLUE   devils "), "blue devils");
    assert.equal(normalizeCorpsName("Genesis"), "genesis");
  });

  test("keeps distinct corps distinct", () => {
    assert.notEqual(normalizeCorpsName("Blue Devils B"), normalizeCorpsName("Blue Devils"));
    assert.notEqual(normalizeCorpsName("Blue Stars"), normalizeCorpsName("Blue Knights"));
  });

  test("survives empty/missing input", () => {
    assert.equal(normalizeCorpsName(undefined), "");
    assert.equal(normalizeCorpsName(null), "");
  });
});

describe("getScoreForDay name matching", () => {
  const historicalData = {
    2026: [
      {
        offSeasonDay: 44,
        scores: [
          { corps: "The Cavaliers", captions: { GE1: 17.5 } },
          { corps: "Blue Devils", captions: { GE1: 19.4 } },
        ],
      },
    ],
  };

  test("an exact match always wins", () => {
    assert.equal(getScoreForDay(44, "Blue Devils", 2026, "GE1", historicalData), 19.4);
  });

  test("falls back to a normalized match when nothing matches exactly", () => {
    assert.equal(getScoreForDay(44, "Cavaliers", 2026, "GE1", historicalData), 17.5);
  });

  test("does not match a different corps", () => {
    assert.equal(getScoreForDay(44, "Blue Stars", 2026, "GE1", historicalData), null);
  });

  test("tolerates an event row with no scores array", () => {
    const malformed = { 2026: [{ offSeasonDay: 44, scores: undefined }] };
    assert.equal(getScoreForDay(44, "Blue Devils", 2026, "GE1", malformed), null);
  });
});

describe("countRealScoresForDay", () => {
  const historicalData = {
    2026: [
      { offSeasonDay: 44, scores: [{ corps: "Bluecoats" }, { corps: "Blue Devils" }] },
      { offSeasonDay: 44, scores: [{ corps: "Bluecoats" }, { corps: "Crossmen" }] },
      { offSeasonDay: 45, scores: [{ corps: "Boston Crusaders" }] },
    ],
  };

  test("counts events and distinct corps for the day", () => {
    assert.deepEqual(countRealScoresForDay(44, 2026, historicalData), { events: 2, corps: 3 });
  });

  test("reports nothing for a day with no scraped results", () => {
    assert.deepEqual(countRealScoresForDay(48, 2026, historicalData), { events: 0, corps: 0 });
  });

  test("reports nothing for a year that was never fetched", () => {
    assert.deepEqual(countRealScoresForDay(44, 1999, historicalData), { events: 0, corps: 0 });
  });
});
