// Event-order independence for the caption projection model.
//
// The 2026 Overture regression: on 2026-08-27 historical_scores/{year} was
// sharded into a per-event subcollection whose document ids are content
// hashes. A subcollection read returns documents by id, so a year's events
// started arriving in an order unrelated to date. projectCaptionScore read the
// corps' "first" and "last" real results off the ends of that list, decided a
// mid-season night lay outside the corps' tour, and extrapolated it from a
// random anchor. A director with The Cadets 2013 in all three music captions
// saw a 25.5 on the dashboard and a 21 in the recap — a swing that had nothing
// to do with the ±0.05 tie-breaker the model is meant to add.
//
// These pin the invariant: a projection depends only on the SET of real
// results, never on the order the archive happens to return them in.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  clearRegressionCache,
  getRealisticCaptionScore,
  projectCaptionScore,
} = require("./scoringMath");
const { eventDocId } = require("./historicalScores");

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const CORPUS_DIR = path.join(__dirname, "../../pressboxImporter/output");

/** Deterministic Fisher–Yates so a failure reproduces. */
function shuffled(items, seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 0x100000000;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadCorpusYear(year) {
  const file = path.join(CORPUS_DIR, `historical_scores_${year}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")).data || [];
}

const chronological = (events) =>
  [...events].sort((a, b) => (a.offSeasonDay ?? -1) - (b.offSeasonDay ?? -1));

/** The order a Firestore subcollection `.get()` returns these events in. */
const documentIdOrder = (events) =>
  [...events].sort((a, b) =>
    eventDocId(a.eventName, a.date) < eventDocId(b.eventName, b.date) ? -1 : 1
  );

describe("projectCaptionScore is independent of data-point order", () => {
  const season = [
    [1, 15.1], [3, 15.9], [14, 16.1], [15, 17.1], [19, 17.1], [21, 17.2],
    [22, 17.3], [25, 17.2], [26, 17.3], [29, 17.9], [30, 18.3], [31, 18.4],
    [34, 18.3], [39, 18.7], [41, 19.0], [45, 19.3], [49, 19.7],
  ];

  test("inside the corps' real season", () => {
    const expected = projectCaptionScore(season, 23, "seed");
    for (let seed = 1; seed <= 25; seed++) {
      assert.equal(projectCaptionScore(shuffled(season, seed), 23, "seed"), expected);
    }
    // Sanity: the answer is the one the neighbours 22 (17.3) and 25 (17.2) imply.
    assert.ok(expected > 16.8 && expected < 17.8, `projected ${expected}`);
  });

  test("outside it, in both directions", () => {
    for (const day of [-3, 0, 52, 60]) {
      const expected = projectCaptionScore(season, day, "seed");
      for (let seed = 1; seed <= 25; seed++) {
        assert.equal(projectCaptionScore(shuffled(season, seed), day, "seed"), expected);
      }
    }
  });

  test("does not mutate the caller's array", () => {
    const points = shuffled(season, 7);
    const before = JSON.stringify(points);
    projectCaptionScore(points, 23, "seed");
    assert.equal(JSON.stringify(points), before);
  });
});

describe("getRealisticCaptionScore is independent of event order (real corpus)", () => {
  // The reported lineup: The Cadets 2013 in B, MA and P, scored on day 23 —
  // a night the corps has no real result for.
  test("The Cadets 2013 music on day 23 projects the same from any event order", () => {
    const events = loadCorpusYear(2013);
    const orders = {
      chronological: chronological(events),
      documentId: documentIdOrder(events),
      reversed: chronological(events).reverse(),
      shuffled: shuffled(events, 2026),
    };

    const music = {};
    for (const [name, ordered] of Object.entries(orders)) {
      clearRegressionCache();
      const data = { 2013: ordered };
      let total = 0;
      for (const caption of ["B", "MA", "P"]) {
        total += getRealisticCaptionScore("The Cadets", "2013", caption, 23, data);
      }
      music[name] = parseFloat((total / 2).toFixed(2));
    }

    assert.equal(music.documentId, music.chronological);
    assert.equal(music.reversed, music.chronological);
    assert.equal(music.shuffled, music.chronological);
    // The corps scored 25.55 on day 22 and 26.05 on day 25; the projection
    // has to sit between its neighbours, not two points above or below them.
    assert.ok(music.chronological > 25 && music.chronological < 27, `music ${music.chronological}`);
  });

  for (const year of [2013, 2019]) {
    test(`${year}: every corps, caption and day projects identically in hash order`, () => {
      const events = loadCorpusYear(year);
      const corpsNames = new Set();
      for (const event of events) for (const row of event.scores || []) corpsNames.add(row.corps);

      const inOrder = { [year]: chronological(events) };
      const byId = { [year]: documentIdOrder(events) };

      let compared = 0;
      for (const corps of corpsNames) {
        for (const caption of CAPTIONS) {
          for (let day = 1; day <= 49; day += 3) {
            clearRegressionCache();
            const expected = getRealisticCaptionScore(corps, String(year), caption, day, inOrder);
            clearRegressionCache();
            const actual = getRealisticCaptionScore(corps, String(year), caption, day, byId);
            assert.equal(actual, expected, `${corps} ${caption} day ${day}`);
            compared++;
          }
        }
      }
      assert.ok(compared > 1000, `only ${compared} comparisons`);
    });
  }
});
