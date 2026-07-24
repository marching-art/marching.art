// Scrape schema-drift canary: the pure audit layer.
//
// Every fantasy score in the game flows through one fragile dependency —
// parsing dci.org HTML with hand-written selectors (helpers/scraping.js,
// scheduled/liveScraper.js). The nightly pipeline is well-guarded (0-row
// detection, attempt budgets, watchdog), but all of those fire at ~2 AM,
// turning a dci.org redesign into a scoring-night incident. The canary runs
// in the AFTERNOON against live pages and asserts the structures the scraper
// depends on, so markup drift becomes a daytime heads-up instead.
//
// These auditors are pure (HTML in, findings out) so the exact selector
// contracts pin down in unit tests. The selectors here MUST mirror the
// scraper's — when the scraper's selectors change, change these with them.

/**
 * Audit the scores LISTING page (https://www.dci.org/scores/) — the surface
 * scheduled/liveScraper.fetchScoresListing depends on: one `.tbl-row` per
 * event carrying an M/D/YYYY date and a /scores/final-scores/ link.
 *
 * An empty listing is only a soft finding (deep off-season pages can list
 * nothing) — hard problems are structural: links without parseable rows.
 *
 * @param {string} html
 * @returns {{problems: string[], warnings: string[], eventCount: number}}
 */
function auditScoresListing(html) {
  const $ = require("cheerio").load(html);
  const problems = [];
  const warnings = [];

  const links = $('a[href*="/scores/final-scores/"]');
  let parseableRows = 0;
  links.each((_i, el) => {
    const row = $(el).closest(".tbl-row");
    const rowText = row.length ? row.text() : "";
    if (/(\d{1,2})\/(\d{1,2})\/(\d{4})/.test(rowText)) parseableRows += 1;
  });

  if (links.length === 0) {
    warnings.push(
      "scores listing has no /scores/final-scores/ links (off-season lull, or the listing markup changed)"
    );
  } else if (parseableRows === 0) {
    problems.push(
      `scores listing has ${links.length} final-scores link(s) but ZERO rows with a parseable ` +
        "M/D/YYYY date — the .tbl-row layout the live scraper reads has drifted"
    );
  }

  return { problems, warnings, eventCount: parseableRows };
}

// Caption titles scrapeDciScoresLogic maps into the game's 8 captions.
const KNOWN_CAPTIONS = [
  "General Effect 1",
  "General Effect 2",
  "Visual Proficiency",
  "Visual Analysis",
  "Color Guard",
  "Music Brass",
  "Music Analysis",
  "Music Percussion",
];

/**
 * Audit a recap (final scores) page — the structure scrapeDciScoresLogic
 * parses: event title, date/location block, and the #effect-table-0 score
 * table with recognizable caption headers, corps rows, and numeric totals.
 *
 * @param {string} html
 * @returns {{problems: string[], warnings: string[], corpsCount: number,
 *   recognizedCaptions: number, eventName: string}}
 */
function auditRecapPage(html) {
  const $ = require("cheerio").load(html);
  const problems = [];
  const warnings = [];

  const eventName = $(
    'div[data-widget_type="theme-post-title.default"] h1.elementor-heading-title'
  )
    .text()
    .trim();
  if (!eventName) {
    problems.push("event title selector matched nothing (theme-post-title h1 drifted)");
  }

  const dateLocationPs = $(
    'div[data-widget_type="shortcode.default"] div.score-date-location'
  ).find("p");
  if (dateLocationPs.length < 1) {
    warnings.push("date/location block missing — event dates would fall back to scrape time");
  }

  const table = $("table#effect-table-0");
  if (table.length === 0) {
    problems.push("score table #effect-table-0 not found — the core score parse is broken");
    return { problems, warnings, corpsCount: 0, recognizedCaptions: 0, eventName };
  }

  const captionTitles = [];
  table.find("> tbody > tr.table-top td.type").each((_i, el) => {
    captionTitles.push($(el).text().replace(/\s-\s/g, " ").trim());
  });
  const recognizedCaptions = captionTitles.filter((t) => KNOWN_CAPTIONS.includes(t)).length;
  if (recognizedCaptions < 6) {
    problems.push(
      `only ${recognizedCaptions}/8 caption headers recognized (${JSON.stringify(captionTitles)}) — ` +
        "caption titles or the header row markup drifted"
    );
  }

  let corpsCount = 0;
  let parseableTotals = 0;
  table
    .find("> tbody > tr")
    .not(".table-top")
    .each((_i, row) => {
      const corpsName = $(row).find("td.sticky-td").first().text().trim();
      if (!corpsName) return;
      corpsCount += 1;
      const total = parseFloat(
        $(row).find("td.data-total").last().find("span").first().text().trim()
      );
      if (!Number.isNaN(total)) parseableTotals += 1;
    });

  if (corpsCount === 0) {
    problems.push("zero corps rows parsed (td.sticky-td names missing) — row markup drifted");
  } else if (parseableTotals === 0) {
    problems.push(
      `${corpsCount} corps rows found but zero parseable totals (td.data-total span) — ` +
        "the total-score cell markup drifted"
    );
  }

  return { problems, warnings, corpsCount, recognizedCaptions, eventName };
}

module.exports = { auditScoresListing, auditRecapPage, KNOWN_CAPTIONS };
