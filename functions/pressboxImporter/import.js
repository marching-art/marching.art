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
//
// Requires functions/serviceAccountKey.json (same as masterParser.js).
//
// Usage: node import.js --dry-run   (then without the flag once it looks right)

const fs = require("fs");
const path = require("path");
const { OUTPUT_DIR, YEARS } = require("./config");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MERGE = args.includes("--merge");
const REPLACE = args.includes("--replace");
const yearsArg = args[args.indexOf("--years") + 1];
const yearFilter = args.includes("--years") ? yearsArg.split(",") : YEARS;

function loadJson(file) {
  const p = path.join(OUTPUT_DIR, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

async function main() {
  const admin = require("firebase-admin");
  const serviceAccount = require("../serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  for (const year of yearFilter) {
    const scores = loadJson(`historical_scores_${year}.json`);
    if (!scores) {
      console.log(`${year}: no parsed output, skipping.`);
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
      const seen = new Set(existingData.map((e) =>
        `${e.eventName}|${new Date(e.date).getTime()}`));
      const additions = scores.data.filter((e) =>
        !seen.has(`${e.eventName}|${new Date(e.date).getTime()}`));
      console.log(`${year}: merge - ${additions.length} of ${scores.data.length} ` +
        `events are new (doc already has ${existingData.length}).`);
      if (!DRY_RUN && additions.length > 0) {
        await scoresRef.set({ data: [...existingData, ...additions] });
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
