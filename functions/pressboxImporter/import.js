// Step 3: Upload parsed output to Firestore.
//
// Safe by default: only creates historical_scores/{year} and
// final_rankings/{year} documents that don't exist yet, so it can never
// clobber the dci.org-scraped years (2013+) or a previous import.
//
// Flags:
//   --dry-run          show what would be written, write nothing
//   --years 2000,2001  limit to specific years
//   --merge            for years that already exist, append events that are
//                      missing (matched by eventName + date, same rule as
//                      processDciScores) instead of skipping the year
//   --replace          overwrite existing year documents entirely
//   --force-current-season  allow writing the ACTIVE live season's year
//                      (normally refused: the nightly scrape pipeline owns
//                      that document and an import could clobber fresh scores)
//
// Credentials: uses functions/serviceAccountKey.json when present (local runs,
// same as masterParser.js), otherwise falls back to application-default
// credentials (GOOGLE_APPLICATION_CREDENTIALS), which is how the
// deploy-functions.yml GitHub Actions job provides them.
//
// Usage: node import.js --dry-run   (then without the flag once it looks right)

const fs = require("fs");
const path = require("path");
const { OUTPUT_DIR, YEARS } = require("./config");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MERGE = args.includes("--merge");
const REPLACE = args.includes("--replace");
const FORCE_CURRENT_SEASON = args.includes("--force-current-season");
const yearsArg = args[args.indexOf("--years") + 1];
const yearFilter = args.includes("--years") ? yearsArg.split(",") : YEARS;

function loadJson(file) {
  const p = path.join(OUTPUT_DIR, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

async function main() {
  const admin = require("firebase-admin");
  const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  } else {
    admin.initializeApp();
  }
  const db = admin.firestore();

  // The ACTIVE live season's year is owned by the nightly scrape pipeline —
  // importing over it could clobber freshly scraped events, so it is refused
  // unless --force-current-season is passed.
  const seasonDoc = await db.doc("game-settings/season").get();
  const season = seasonDoc.exists ? seasonDoc.data() : null;
  const currentSeasonYear =
    season && season.status === "live-season" && season.seasonYear != null
      ? String(season.seasonYear)
      : null;

  for (const year of yearFilter) {
    const scores = loadJson(`historical_scores_${year}.json`);
    if (!scores) {
      console.log(`${year}: no parsed output, skipping.`);
      continue;
    }

    if (!FORCE_CURRENT_SEASON && String(year) === currentSeasonYear) {
      console.log(`${year}: REFUSED - this is the active live season's year (the nightly ` +
        "pipeline owns historical_scores/" + year + "). Pass --force-current-season to override.");
      continue;
    }

    const scoresRef = db.collection("historical_scores").doc(year);
    const existing = await scoresRef.get();

    if (!existing.exists || REPLACE) {
      const action = existing.exists ? "REPLACE" : "create";
      console.log(`${year}: ${action} historical_scores/${year} ` +
        `(${scores.data.length} events).`);
      if (!DRY_RUN) await scoresRef.set({ data: scores.data });
    } else if (MERGE) {
      const existingData = existing.data().data || [];
      const eventKey = (e) => `${e.eventName}|${new Date(e.date).getTime()}`;
      const seen = new Set(existingData.map(eventKey));
      const additions = scores.data.filter((e) => !seen.has(eventKey(e)));
      console.log(`${year}: merge - ${additions.length} of ${scores.data.length} ` +
        `events are new (doc already has ${existingData.length}).`);
      if (!DRY_RUN && additions.length > 0) {
        // Transactional re-read: the nightly pipeline merges into this same
        // document, so a plain read-then-set could clobber an event archived
        // between our read and write. update({data}) also leaves any other
        // top-level fields alone; set() only when the doc vanished.
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(scoresRef);
          if (!snap.exists) {
            tx.set(scoresRef, { data: scores.data });
            return;
          }
          const current = snap.data().data || [];
          const currentSeen = new Set(current.map(eventKey));
          const freshAdditions = scores.data.filter((e) => !currentSeen.has(eventKey(e)));
          if (freshAdditions.length > 0) {
            tx.update(scoresRef, { data: [...current, ...freshAdditions] });
          }
        });
      }
    } else {
      console.log(`${year}: historical_scores/${year} already exists, skipping ` +
        "(use --merge or --replace to change it).");
    }

    const rankings = loadJson(`final_rankings_${year}.json`);
    if (rankings) {
      const rankingsRef = db.collection("final_rankings").doc(year);
      const rankingsDoc = await rankingsRef.get();
      if (!rankingsDoc.exists || REPLACE) {
        console.log(`${year}: ${rankingsDoc.exists ? "REPLACE" : "create"} ` +
          `final_rankings/${year} (${rankings.data.length} corps).`);
        if (!DRY_RUN) await rankingsRef.set({ data: rankings.data });
      } else {
        console.log(`${year}: final_rankings/${year} already exists, skipping.`);
      }
    } else {
      console.log(`${year}: no final_rankings output (championship finals not in ` +
        "source data).");
    }
  }

  console.log(DRY_RUN ? "\nDry run complete - nothing written." : "\nImport complete.");
  console.log("Reminder: historical corps only become draftable once their year " +
    "has a final_rankings document (startNewOffSeason builds dci-data from " +
    "final_rankings).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
