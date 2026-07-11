/**
 * Harvest distinct show locations from dci.org for the years the local
 * fromthepressbox importer does not cover (2013-present).
 *
 * The venue gazetteer (helpers/podium/venueGazetteer.json) geocodes every
 * distinct historical `location` string so Podium Class can price travel legs.
 * The bundled 2000-2012 data comes from pressboxImporter; 2013+ scores live in
 * Firestore. When the gazetteer is rebuilt offline (no Firestore credentials)
 * those recent years are missing, so newer show cities resolve to null and the
 * route assessment has no coordinates to work with. This script closes that gap
 * from a public, credential-free source.
 *
 * Method: dci.org is WordPress; its competition-sitemap enumerates every
 * /scores/final-scores/{year}-{slug}/ event page across all years, and each
 * page's <meta name="description"> reads "Corps Results at {Event}, {City},
 * {ST}. Official Final score ...". We pull the "City, ST" from each, aggregate
 * distinct locations with event counts + years, and write the committed
 * dciDotOrgLocations.json that buildVenueGazetteer.js folds into every build.
 *
 * Run:
 *   cd functions
 *   node src/scripts/harvestDciLocations.js   # writes src/scripts/dciDotOrgLocations.json
 *
 * Re-run when new seasons land, then rebuild the gazetteer + client venues.
 */

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join(__dirname, "dciDotOrgLocations.json");
const SITEMAPS = [
  "https://www.dci.org/competition-sitemap.xml",
  "https://www.dci.org/competition-sitemap2.xml",
];
const CONCURRENCY = 10;

// A handful of event pages store a malformed location (comma-less, a source
// typo, a stadium name, or a spelled-out state) that the strict "City, ST"
// extractor misses. These four are the real events among them; the rest are
// dev/test events with no real venue and are dropped.
const MANUAL = {
  "2014-legends-drum-corps-open": "Paw Paw, MI", // page reads "Paw Paw MI" (no comma)
  "2014-moonlight-classic": "Sacramento, CA", // source typo "Scaramento CA"
  "2015-dci-louisville-presented-by-demoulin-bros": "Louisville, KY", // stadium name in field
  "2018-dicarlo-invitational": "Old Orchard Beach, ME", // "Old Orchard Beach, Maine"
};
const SKIP = new Set([
  "2017-happy-dance",
  "2017-score-release-test",
  "2022-dev-test-event",
  "2023-web-test-2023",
]);

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Extract "City, ST" from an event page's meta description, or null. */
function locationFromPage(html) {
  const meta = html.match(/<meta name="description" content="([^"]*)"/i);
  if (!meta) return null;
  const desc = meta[1].replace(/&#039;/g, "'").replace(/&amp;/g, "&");
  const m = desc.match(/Corps Results at .*?, ([A-Za-z.][A-Za-z. '&/-]*,\s*[A-Z]{2})\. Official/);
  return m ? m[1].trim() : null;
}

/** Run an async mapper over items with bounded concurrency. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const urls = new Set();
  for (const sm of SITEMAPS) {
    const xml = await fetchText(sm);
    for (const m of xml.matchAll(/https:\/\/www\.dci\.org\/scores\/final-scores\/[^<\s]+/gi)) {
      urls.add(m[0].replace(/\/?$/, "/"));
    }
  }
  const urlList = [...urls].sort();
  console.log(`Found ${urlList.length} competition event pages.`);

  const rows = await mapPool(urlList, CONCURRENCY, async (url) => {
    const slug = url.replace(/\/$/, "").split("/").pop();
    try {
      const html = await fetchText(url);
      return { slug, location: MANUAL[slug] || locationFromPage(html) };
    } catch (err) {
      console.warn(`FETCH FAILED: ${slug} (${err.message})`);
      return { slug, location: null };
    }
  });

  const yearOf = (slug) => (slug.match(/^(\d{4})-/) || [])[1] || null;
  const agg = new Map(); // "City, ST" -> { count, years:Set, sampleEvents:[] }
  let used = 0;
  let skipped = 0;
  for (const { slug, location } of rows) {
    if (SKIP.has(slug) || !location) {
      skipped++;
      continue;
    }
    used++;
    if (!agg.has(location)) agg.set(location, { count: 0, years: new Set(), sampleEvents: [] });
    const e = agg.get(location);
    e.count++;
    const y = yearOf(slug);
    if (y) e.years.add(y);
    if (e.sampleEvents.length < 3) e.sampleEvents.push(slug);
  }

  const locations = [...agg.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([location, v]) => ({
      location,
      count: v.count,
      years: [...v.years].sort(),
      sampleEvents: v.sampleEvents,
    }));

  const years = [...new Set(locations.flatMap((l) => l.years))].sort();
  const output = {
    meta: {
      source: "dci.org/scores/final-scores (competition sitemap enumeration)",
      yearRange: years.length ? `${years[0]}-${years[years.length - 1]}` : "",
      eventsWithLocation: used,
      eventsSkipped: skipped,
      distinctLocations: locations.length,
      note:
        "Location = the City, ST from each event page meta description. Fills the " +
        "2013+ gap the 2000-2012 fromthepressbox importer does not cover, so the venue " +
        "gazetteer spans the full historical archive.",
    },
    locations,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Wrote ${locations.length} distinct locations (${used} events, skipped ${skipped}) -> ${OUTPUT_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
