/**
 * DCI Event Detail Enrichment
 *
 * The upcoming-events scraper (functions-scraper) returns the base fields for
 * each event — name, date, location, and the detail-page `url`. It does NOT open
 * the detail page. Those detail pages, however, are plain server-rendered HTML
 * (no AJAX) and carry the two things the game was missing:
 *
 *   - Real timing: gates-open, show start, and scores-announced clock times.
 *   - The running order: every corps, its hometown, and the exact minute it
 *     takes the field.
 *
 * This helper fetches each detail page with axios + cheerio (no Puppeteer/Chromium
 * needed — kept out of the main codebase on purpose) and parses that data into
 * absolute ISO instants plus a structured lineup, so the rest of the app can show
 * honest "live now" messaging and an interactive running order.
 *
 * The DOM shape parsed (dci.org, 2026):
 *   <div class="lineup-times-section ...">
 *     <p>All times PT and subject to change</p>
 *     <table><tbody>
 *       <tr><td>4:00 PM</td><td><strong>Gates Open</strong></td></tr>
 *       <tr><td>6:30 PM</td><td><strong>Welcome & National Anthem</strong></td></tr>
 *       <tr><td>6:40 PM</td><td><strong>Sparta Ignite</strong> - San Jose, CA</td></tr>
 *       ...
 *       <tr><td>9:41 PM</td><td><strong>Scores Announced</strong></td></tr>
 *     </tbody></table>
 *   <div class="event-location"> ... <address>Venue<br>Street<br>City, ST ZIP</address>
 *
 * Parsing is defensive: a page whose markup drifts (or that has no lineup table
 * yet) simply yields no enrichment for that event, and the caller keeps the base
 * fields — mirroring the "degrade gracefully" contract in season.js.
 */

const { logger } = require("firebase-functions/v2");
const axios = require("axios");
const cheerio = require("cheerio");

const SCRAPER_USER_AGENT = "Mozilla/5.0 (compatible; MarchingArtBot/1.0)";

// Rows in the lineup table that are ceremony/logistics markers, not performing
// corps. Matched case-insensitively against the row's bold label.
const NON_CORPS_LABEL = new RegExp(
  "^(gates?\\s*open|scores?\\s*announced|intermission|welcome|national anthem|" +
  "opening|pre-?show|retreat|awards?|finale|standstill|dinner break)", "i");
const GATES_LABEL = /gates?\s*open/i;
const SCORES_LABEL = /scores?\s*announced/i;

// US state / territory -> IANA timezone. DCI detail pages print local wall-clock
// times ("6:30 PM PT"); to build an absolute instant we need the venue's zone,
// which we derive from the two-letter state in the event location/address. States
// spanning multiple zones are mapped to their most populous / most common DCI-venue
// zone — good enough for evening show windows.
const STATE_TIMEZONE = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise",
  IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/Detroit", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York",
  NM: "America/Denver", NY: "America/New_York", NC: "America/New_York",
  ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago",
  TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York",
  VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver", DC: "America/New_York",
};

// Fallback: map a printed timezone abbreviation ("PT", "EDT", ...) to an IANA zone.
const TZ_ABBREV = {
  ET: "America/New_York", EST: "America/New_York", EDT: "America/New_York",
  CT: "America/Chicago", CST: "America/Chicago", CDT: "America/Chicago",
  MT: "America/Denver", MST: "America/Denver", MDT: "America/Denver",
  PT: "America/Los_Angeles", PST: "America/Los_Angeles", PDT: "America/Los_Angeles",
};

const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Pull the two-letter US state out of a "City, ST" or "..., ST 95762" string.
 * @param {string} text
 * @returns {string|null}
 */
function extractState(text) {
  if (!text) return null;
  const match = String(text).match(/,\s*([A-Z]{2})(?:\s+\d{5})?\s*$/);
  return match ? match[1] : null;
}

/**
 * Resolve the IANA timezone for an event from its location/address, falling back
 * to a printed abbreviation, then to Eastern.
 * @param {string} location - e.g. "El Dorado Hills, CA"
 * @param {string|null} abbrevHint - e.g. "PT" from "All times PT"
 * @returns {string}
 */
function resolveTimezone(location, abbrevHint) {
  const state = extractState(location);
  if (state && STATE_TIMEZONE[state]) return STATE_TIMEZONE[state];
  if (abbrevHint && TZ_ABBREV[abbrevHint.toUpperCase()]) return TZ_ABBREV[abbrevHint.toUpperCase()];
  return DEFAULT_TIMEZONE;
}

/**
 * Offset (ms) that `timeZone` is ahead of UTC at the given instant.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {number}
 */
function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second
  );
  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock time in a timezone to an absolute UTC Date.
 * Two-pass technique using Intl — accurate outside the ~1hr DST transition
 * window (show times never land there).
 * @returns {Date}
 */
function zonedWallTimeToUtc(year, monthIndex, day, hour, minute, timeZone) {
  const guessUtc = Date.UTC(year, monthIndex, day, hour, minute);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset);
}

/**
 * Parse a "6:40 PM" style clock string into { hour24, minute }.
 * @param {string} text
 * @returns {{hour: number, minute: number}|null}
 */
function parseClock(text) {
  const match = String(text).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const isPm = /p/i.test(match[3]);
  if (hour === 12) hour = isPm ? 12 : 0;
  else if (isPm) hour += 12;
  return { hour, minute };
}

/**
 * Parse a DCI event detail page's HTML into timing + lineup fields.
 * Exposed separately from the fetch so it can be unit-tested against a fixture.
 *
 * @param {string} html - Raw detail-page HTML.
 * @param {object} event - Base event ({ date, location }) used for date + tz.
 * @returns {object} Enrichment fields (may be mostly null if no lineup found).
 */
function parseEventDetail(html, event) {
  const $ = cheerio.load(html);
  const result = {
    timezone: null,
    startsAt: null,
    gatesAt: null,
    scoresAt: null,
    venue: null,
    lineup: [],
  };

  // Anchor date: the event's calendar date (stored at local midnight by the
  // list scraper). We only need its Y/M/D to combine with each row's clock time.
  const baseDate = event.date ? new Date(event.date) : null;

  // Venue name + address (for state -> timezone and future surfacing).
  const addressText = $(".event-location address").first().text().replace(/\s+/g, " ").trim();
  const venueName = $(".event-location address").first().html();
  if (venueName) {
    result.venue = venueName.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, "").trim() || null;
  }

  // Timezone abbreviation hint from "All times PT and subject to change".
  const timesNote = $(".lineup-times-section p").filter((_i, el) =>
    /all times/i.test($(el).text())).first().text();
  const abbrevMatch = timesNote.match(/all times\s+([A-Za-z]{2,3})/i);
  const abbrevHint = abbrevMatch ? abbrevMatch[1] : null;

  // Prefer the address's state (most reliable), then the list location, then hint.
  result.timezone = resolveTimezone(addressText || event.location, abbrevHint);

  const toIso = (clock) => {
    if (!clock || !baseDate) return null;
    return zonedWallTimeToUtc(
      baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(),
      clock.hour, clock.minute, result.timezone
    ).toISOString();
  };

  let order = 0;
  $(".lineup-times-section table tbody tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const clock = parseClock($(cells[0]).text());
    if (!clock) return;

    const labelCell = $(cells[1]);
    const boldLabel = labelCell.find("strong").first().text().trim() ||
      labelCell.text().trim();
    const iso = toIso(clock);

    if (GATES_LABEL.test(boldLabel)) {
      result.gatesAt = iso;
      return;
    }
    if (SCORES_LABEL.test(boldLabel)) {
      result.scoresAt = iso;
      return;
    }
    // Show start = the first timed, non-gates ceremony/performance row.
    if (result.startsAt === null && !GATES_LABEL.test(boldLabel)) {
      result.startsAt = iso;
    }
    if (NON_CORPS_LABEL.test(boldLabel)) return;

    // A performing corps. Hometown is the text after "- " in the label cell.
    const fullText = labelCell.text().replace(/\s+/g, " ").trim();
    let hometown = null;
    const dashIdx = fullText.indexOf(" - ");
    if (dashIdx !== -1) hometown = fullText.slice(dashIdx + 3).trim() || null;

    order += 1;
    result.lineup.push({
      order,
      corps: boldLabel,
      hometown,
      performanceTime: $(cells[0]).text().trim(),
      performsAt: iso,
    });
  });

  return result;
}

/**
 * Fetch + parse one event detail page. Never throws — returns null on failure so
 * one bad page can't abort a schedule build.
 * @param {object} event - { url, date, location }
 * @returns {Promise<object|null>} Enrichment fields, or null.
 */
async function fetchEventDetail(event) {
  if (!event?.url) return null;
  try {
    const { data } = await axios.get(event.url, {
      timeout: 20000,
      headers: { "User-Agent": SCRAPER_USER_AGENT },
    });
    const parsed = parseEventDetail(data, event);
    // Only consider it "enriched" if we actually found timing or a lineup.
    if (!parsed.startsAt && parsed.lineup.length === 0) return null;
    return parsed;
  } catch (error) {
    logger.warn(`[EventDetails] Failed to enrich ${event.url}: ${error.message}`);
    return null;
  }
}

/**
 * Enrich an array of scraped events with detail-page timing + lineup, in place.
 * Runs with bounded concurrency to be gentle on dci.org. Events that fail to
 * enrich are returned unchanged (base fields only).
 *
 * @param {Array<object>} events - Scraped events with a `url` each.
 * @param {object} [options]
 * @param {number} [options.concurrency=5]
 * @returns {Promise<Array<object>>} The same events, some with added fields.
 */
async function enrichEventsWithDetails(events, { concurrency = 5 } = {}) {
  if (!Array.isArray(events) || events.length === 0) return events || [];

  let enriched = 0;
  const queue = [...events];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const event = queue.shift();
      const detail = await fetchEventDetail(event);
      if (detail) {
        Object.assign(event, detail);
        enriched += 1;
      }
    }
  });
  await Promise.all(workers);

  logger.info(`[EventDetails] Enriched ${enriched}/${events.length} events with timing + lineup.`);
  return events;
}

module.exports = {
  enrichEventsWithDetails,
  fetchEventDetail,
  parseEventDetail,
  resolveTimezone,
  zonedWallTimeToUtc,
  parseClock,
  STATE_TIMEZONE,
};
