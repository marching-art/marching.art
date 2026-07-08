// Step 3: Overwrite placeholder show names with the official archive.org names.
//
// Matches each parsed archive record to a pressbox event on date + normalized
// city (see config.matchKey) and, where the pressbox event still carries the
// "DCI Competition - {City, State}" placeholder, replaces its eventName with
// the official show name from dci.org. Scores, dates and locations are never
// touched; already-titled events are left alone.
//
// Two targets:
//   (default)     patch ../pressboxImporter/output/historical_scores_{year}.json
//                 in place, so the committed pressbox source becomes the merged
//                 truth and a normal `pressboxImporter/import.js --replace`
//                 pushes the official names.
//   --firestore   update eventName directly on the live historical_scores/{year}
//                 documents (for data already imported). Add-only: only rewrites
//                 events whose stored name is still a placeholder.
//
// Flags:
//   --dry-run          report matches, write nothing
//   --years 2004,2005  limit scope
//   --firestore        update Firestore instead of the pressbox JSON files
//
// Usage: node apply.js --dry-run   (then without --dry-run once it looks right)

const fs = require("fs");
const path = require("path");
const {
  YEARS, OUTPUT_DIR, PRESSBOX_OUTPUT_DIR, matchKeyForEvent, cityFromLocation,
  canonicalLocation,
} = require("./config");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FIRESTORE = args.includes("--firestore");
const yearFilter = args.includes("--years")
  ? args[args.indexOf("--years") + 1].split(",")
  : YEARS;

const PLACEHOLDER_RE = /^DCI Competition\s*-/i;

// Load the archive records for one year into two lookups, each value carrying
// the official show name AND the archive's city spelling:
//   exact    key ("YYYY-MM-DD|city") -> { showName, city }
//   byCity   normalized city -> [{ dateMs, showName, city }]  (±1-day pass)
// Only titled, game-relevant (non-ignored-division) records are indexed.
function buildIndex(records) {
  const exact = new Map();
  const byCity = new Map();
  for (const r of records) {
    if (!r.showName || r.ignoredDivision) continue;
    const entry = { showName: r.showName, city: r.city };
    if (!exact.has(r.key)) exact.set(r.key, entry);
    const cityKey = r.key.split("|")[1] || "";
    if (!byCity.has(cityKey)) byCity.set(cityKey, []);
    byCity.get(cityKey).push({ dateMs: new Date(r.date).getTime(), ...entry });
  }
  return { exact, byCity, size: exact.size };
}

function loadNameIndex(year) {
  const p = path.join(OUTPUT_DIR, `names_${year}.json`);
  if (!fs.existsSync(p)) return null;
  const { records } = JSON.parse(fs.readFileSync(p, "utf-8"));
  return buildIndex(records);
}

// Same city, date within one day, and exactly one such archive show -> a
// confident match. Ambiguous (2+ candidates) or absent -> null.
function fuzzyDateMatch(event, byCity) {
  const cityKey = cityFromLocation(event.location);
  const candidates = byCity.get(cityKey);
  if (!candidates) return null;
  const eventMs = new Date(event.date).getTime();
  const near = candidates.filter((c) => Math.abs(c.dateMs - eventMs) <= ONE_DAY_MS);
  return near.length === 1 ? { entry: near[0], via: "±1day" } : null;
}

// Resolve the archive record for a pressbox event: exact date+city first, then
// one conservative ±1-day retry. Returns { entry: {showName, city}, via } | null.
function lookupArchive(event, index) {
  const hit = index.exact.get(matchKeyForEvent(event));
  if (hit) return { entry: hit, via: "exact" };
  return fuzzyDateMatch(event, index.byCity);
}

// Walk a year's events, returning the plan without mutating anything:
//   renames        placeholder eventName -> official show name
//   locationFixes  abbreviated city completed from the archive spelling
//   unmatched      placeholders with no archive counterpart
//   unusedArchive  archive names that matched no pressbox event
// Every event is looked up (exact date+city, then a conservative ±1-day
// retry). Names are only overwritten on placeholders; locations are completed
// on any matched event, titled or not.
function planRenames(events, index) {
  const renames = [];
  const locationFixes = [];
  const unmatched = [];
  const usedKeys = new Set();
  for (const event of events) {
    const key = matchKeyForEvent(event);
    const isPlaceholder = PLACEHOLDER_RE.test(event.eventName || "");
    const match = lookupArchive(event, index);

    if (match) {
      usedKeys.add(key);
      if (isPlaceholder && match.entry.showName) {
        renames.push({ key, from: event.eventName, to: match.entry.showName, event, via: match.via });
      }
      const newLocation = canonicalLocation(event.location, match.entry.city);
      if (newLocation) {
        locationFixes.push({ key, from: event.location, to: newLocation, event });
      }
    } else if (isPlaceholder) {
      unmatched.push({ key, name: event.eventName, date: event.date });
    }
  }
  const unusedArchive = [...index.exact.keys()].filter((k) => !usedKeys.has(k));
  return { renames, locationFixes, unmatched, unusedArchive };
}

function loadPressboxYear(year) {
  const p = path.join(PRESSBOX_OUTPUT_DIR, `historical_scores_${year}.json`);
  if (!fs.existsSync(p)) return null;
  return { path: p, doc: JSON.parse(fs.readFileSync(p, "utf-8")) };
}

async function applyFirestore(year, index) {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
      admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
    } else {
      admin.initializeApp();
    }
  }
  const db = admin.firestore();
  const ref = db.collection("historical_scores").doc(year);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`  ${year}: historical_scores/${year} does not exist, skipping.`);
    return;
  }
  // Re-plan against the live documents (whose names/locations may differ from
  // the committed pressbox output) so the same add-only rules apply.
  const data = snap.data().data || [];
  const { renames, locationFixes } = planRenames(data, index);
  for (const r of renames) r.event.eventName = r.to;
  for (const f of locationFixes) f.event.location = f.to;
  if (renames.length || locationFixes.length) {
    await ref.set({ data });
    console.log(`  ${year}: updated ${renames.length} name(s) and ` +
      `${locationFixes.length} location(s) in Firestore.`);
  } else {
    console.log(`  ${year}: nothing to update in Firestore.`);
  }
}

async function main() {
  const totals = { renamed: 0, locationFixed: 0, unmatched: 0, unusedArchive: 0 };

  for (const year of yearFilter) {
    const index = loadNameIndex(year);
    if (!index || index.size === 0) {
      console.log(`${year}: no archive names parsed, skipping.`);
      continue;
    }
    const pressbox = loadPressboxYear(year);
    if (!pressbox) {
      console.log(`${year}: no pressbox output, skipping.`);
      continue;
    }

    const events = pressbox.doc.data || [];
    const { renames, locationFixes, unmatched, unusedArchive } =
      planRenames(events, index);
    totals.renamed += renames.length;
    totals.locationFixed += locationFixes.length;
    totals.unmatched += unmatched.length;
    totals.unusedArchive += unusedArchive.length;

    const fuzzy = renames.filter((r) => r.via === "±1day").length;
    console.log(`${year}: ${renames.length} placeholder(s) renamed ` +
      `(${fuzzy} via ±1-day), ${locationFixes.length} city name(s) completed, ` +
      `${unmatched.length} still unmatched, ` +
      `${unusedArchive.length} archive name(s) unused ` +
      `(of ${index.size} archive events).`);
    for (const r of renames.slice(0, 6)) {
      console.log(`    name: ${r.key}  "${r.from}" -> "${r.to}"`);
    }
    if (renames.length > 6) console.log(`    ... +${renames.length - 6} more names`);
    for (const f of locationFixes.slice(0, 6)) {
      console.log(`    city: "${f.from}" -> "${f.to}"`);
    }
    if (locationFixes.length > 6) console.log(`    ... +${locationFixes.length - 6} more cities`);

    if (DRY_RUN) continue;

    if (FIRESTORE) {
      await applyFirestore(year, index);
    } else {
      for (const r of renames) r.event.eventName = r.to;
      for (const f of locationFixes) f.event.location = f.to;
      // Match the pressbox importer's 1-space indentation (see its parse.js)
      // so the patch diff is limited to the changed eventName/location lines.
      fs.writeFileSync(pressbox.path, JSON.stringify(pressbox.doc, null, 1));
      console.log(`  ${year}: patched ${path.basename(pressbox.path)}.`);
    }
  }

  console.log(`\nTotal: ${totals.renamed} renamed, ${totals.locationFixed} ` +
    `cities completed, ${totals.unmatched} unmatched placeholders, ` +
    `${totals.unusedArchive} unused archive names.`);
  console.log(DRY_RUN ? "Dry run - nothing written." : "Done.");
  if (!DRY_RUN && !FIRESTORE) {
    console.log("Next: review the patched pressboxImporter/output diff, then " +
      "`cd ../pressboxImporter && node import.js --replace` (or the CI checkbox) " +
      "to push. Or re-run this with --firestore to update live docs directly.");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildIndex, planRenames, fuzzyDateMatch };
