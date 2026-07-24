// Tests for the scrape canary's pure auditors. The fixtures mirror the exact
// structures helpers/scraping.js and scheduled/liveScraper.js parse — if the
// scraper's selectors change, these fixtures (and the auditors) change too.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { auditScoresListing, auditRecapPage } = require("./scrapeCanary");

const GOOD_LISTING = `
<div class="tbl-row"><span>7/20/2026</span>
  <a href="/scores/final-scores/2026-midwest-classic/">final scores</a></div>
<div class="tbl-row"><span>7/21/2026</span>
  <a href="https://www.dci.org/scores/final-scores/2026-tour-premiere/">final scores</a></div>
`;

const captionCell = (title) => `<td class="type">${title}</td>`;
const scoreTable = (score) =>
  `<table class="data"><tr><td>x</td><td>y</td><td>${score}</td></tr></table>`;

const GOOD_RECAP = `
<div data-widget_type="theme-post-title.default"><h1 class="elementor-heading-title">DCI Midwest Classic</h1></div>
<div data-widget_type="shortcode.default"><div class="score-date-location">
  <p>July 20, 2026</p><p>Akron, OH</p></div></div>
<table id="effect-table-0"><tbody>
  <tr class="table-top">
    ${captionCell("General Effect 1")}${captionCell("General Effect 2")}
    ${captionCell("Visual Proficiency")}${captionCell("Visual Analysis")}
    ${captionCell("Color Guard")}${captionCell("Music Brass")}
    ${captionCell("Music Analysis")}${captionCell("Music Percussion")}
  </tr>
  <tr>
    <td class="sticky-td">Blue Devils</td>
    <td>${scoreTable("19.2")}${scoreTable("19.1")}</td>
    <td class="data-total"><span>97.850</span></td>
  </tr>
  <tr>
    <td class="sticky-td">Bluecoats</td>
    <td>${scoreTable("19.0")}</td>
    <td class="data-total"><span>97.125</span></td>
  </tr>
</tbody></table>
`;

describe("auditScoresListing", () => {
  test("passes on the current listing structure", () => {
    const result = auditScoresListing(GOOD_LISTING);
    assert.deepEqual(result.problems, []);
    assert.equal(result.eventCount, 2);
  });

  test("warns (not fails) on an empty listing — off-season lull", () => {
    const result = auditScoresListing("<div>No events</div>");
    assert.deepEqual(result.problems, []);
    assert.equal(result.warnings.length, 1);
  });

  test("fails when links exist but the dated row layout is gone", () => {
    const drifted = `<a href="/scores/final-scores/2026-x/">final scores</a>`;
    const result = auditScoresListing(drifted);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /drifted/);
  });
});

describe("auditRecapPage", () => {
  test("passes on the current recap structure", () => {
    const result = auditRecapPage(GOOD_RECAP);
    assert.deepEqual(result.problems, []);
    assert.equal(result.corpsCount, 2);
    assert.equal(result.recognizedCaptions, 8);
    assert.equal(result.eventName, "DCI Midwest Classic");
  });

  test("fails when the score table is missing", () => {
    const result = auditRecapPage("<h1>hello</h1>");
    assert.ok(result.problems.some((p) => p.includes("#effect-table-0")));
  });

  test("fails when caption headers are unrecognizable", () => {
    const drifted = GOOD_RECAP.replaceAll('class="type"', 'class="kind"');
    const result = auditRecapPage(drifted);
    assert.ok(result.problems.some((p) => p.includes("caption headers")));
  });

  test("fails when corps rows lose their name cell", () => {
    const drifted = GOOD_RECAP.replaceAll("sticky-td", "name-td");
    const result = auditRecapPage(drifted);
    assert.ok(result.problems.some((p) => p.includes("zero corps rows")));
  });

  test("fails when totals stop parsing", () => {
    const drifted = GOOD_RECAP.replaceAll("data-total", "grand-total");
    const result = auditRecapPage(drifted);
    assert.ok(result.problems.some((p) => p.includes("parseable totals")));
  });

  test("normalizes hyphenated caption titles like the scraper does", () => {
    const hyphenated = GOOD_RECAP.replace("General Effect 1", "General - Effect 1");
    const result = auditRecapPage(hyphenated);
    // "General - Effect 1" normalizes to "General Effect 1" — still recognized.
    assert.equal(result.recognizedCaptions, 8);
  });
});
