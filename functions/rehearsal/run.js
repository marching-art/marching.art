/**
 * Championship-week dress rehearsal.
 *
 * Plays a whole season against the Firestore emulator through the real nightly
 * pipeline, rolls it over, and then checks the things that only happen once a
 * year and cannot be un-happened: who won each league, what the prize pools
 * paid, which achievements minted, what the rollover carried forward and what
 * it cleared.
 *
 * Usage (from the repo root):
 *   npm run rehearse
 *
 * Flags:
 *   --seed=N     deterministic seed for the synthetic corpus (default 20260808)
 *   --quiet      only print the summary and any failures
 *   --keep       leave the emulator data in place (for poking at afterwards)
 */

process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "rehearsal";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rehearsal";

const admin = require("firebase-admin");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value === undefined ? true : value];
  })
);
const QUIET = Boolean(args.get("quiet"));
const SEED = Number(args.get("seed")) || 20260808;

function log(message) {
  if (!QUIET) console.log(message);
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is unset — the rehearsal only ever runs against " +
        "the emulator. Start it with `npm run rehearse` from the repo root."
    );
  }

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  // Mirror the deployed runtime's Firestore configuration (functions/index.js).
  // Not cosmetic: without ignoreUndefinedProperties the very first show of the
  // season fails to write, because a recap row carries `location: corps.location`
  // and most corps have no location. Production tolerates that only because of
  // this setting, so a rehearsal without it would be testing a different runtime.
  admin.firestore().settings({ ignoreUndefinedProperties: true });

  const { getDb } = require("../src/config");
  const db = getDb();

  // Before any pipeline module loads (see stubs.js for what is faked and why).
  require("./stubs").installStubs();

  if (args.get("scale")) {
    return runScaleProbe(db);
  }

  const { seedWorld } = require("./world");
  const { playSeason } = require("./drive");
  const { runChecks } = require("./checks");
  const { report } = require("./report");

  log(`Seeding the world (seed ${SEED})...`);
  const world = await seedWorld(db, { seed: SEED });

  log(`Playing ${world.seasonUid}, days 1-49...`);
  const started = Date.now();
  const played = await playSeason(db, world, {
    onDay: (day, result) => {
      if (day % 7 === 0 || day >= 43) {
        log(`  day ${String(day).padStart(2)}  ${result.status}${result.note ? ` (${result.note})` : ""}`);
      }
    },
    log: (message) => log(`  ${message}`),
  });
  log(
    `Season played in ${((Date.now() - started) / 1000).toFixed(1)}s; ` +
      `rolled ${played.rollover.oldSeasonUid} -> ${played.rollover.newSeasonUid}`
  );

  const findings = await runChecks(db, world, played);
  const failed = report(findings, { world, played, quiet: QUIET });

  if (!args.get("keep")) {
    // The emulator is torn down by emulators:exec anyway; this is only so a
    // --keep run reads as deliberate.
    log("Done.");
  }

  process.exit(failed > 0 ? 1 : 0);
}

/**
 * The archival-batch scale probe (`--scale`). Separate from the season
 * rehearsal because it answers a different question — not "is the logic right"
 * but "does the commit survive the player base" — and because seeding hundreds
 * of league memberships is slow enough that it should be opt-in.
 */
async function runScaleProbe(db) {
  const { probeArchivalScale, opsForLeague } = require("./scale");
  const leagues = Number(args.get("leagues")) || 20;
  const members = Number(args.get("members")) || 20;

  console.log(
    `Archival batch probe: ${leagues} leagues x ${members} members ` +
      `(~${leagues * opsForLeague(members)} operations in one commit)\n` +
      "Note: the emulator does not enforce Firestore's request limits, so a green result here\n" +
      "means archival RAN correctly at this size, not that production would accept the commit.\n"
  );

  const result = await probeArchivalScale(db, { leagues, members, log });

  console.log(`\n${"=".repeat(78)}`);
  if (result.error) {
    console.log(
      `ARCHIVAL FAILED at ~${result.projectedOps} ops: ${result.error.message}\n\n` +
        `  ${result.crowned} of ${result.leagues} leagues were crowned. Because the batch is\n` +
        "  committed once at the end of archiveSeasonResultsLogic, a season this size loses\n" +
        "  EVERY champion and EVERY prize-pool payout, and the rollover marks itself failed.\n" +
        "  The fix is the one resetLeaguesForNewSeason already uses next door: chunk the batch\n" +
        "  (or switch to ChunkedWriter, as commitDailyScoring does)."
    );
    console.log("=".repeat(78));
    process.exit(1);
  }

  console.log(
    `Archival ran clean at ~${result.projectedOps} operations: ` +
      `${result.crowned}/${result.leagues} leagues crowned, every one of them paid.`
  );
  console.log("=".repeat(78));
  process.exit(0);
}

main().catch((error) => {
  console.error("\nREHEARSAL CRASHED — this is itself a finding.\n");
  console.error(error);
  process.exit(2);
});
