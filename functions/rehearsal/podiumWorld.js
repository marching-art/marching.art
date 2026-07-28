/**
 * The Podium half of the seeded world, and the actions that drive it.
 *
 * Podium's season boundary is the largest block of once-a-year code the game
 * has never run: it launched mid-live-season 2026, so the rollover after
 * championship week is the FIRST time `archivePodiumSeason` will ever execute
 * against real directors. It archives careers, decides next season's divisions,
 * crowns a champion and a Fan Favorite, mints trophies — and sweeps every
 * corps' unspent Corps Budget back to its CorpsCoin wallet, which is the only
 * part that moves money.
 *
 * Everything here is either INPUT (the cast, their careers, the prior seasons
 * they played) or a REAL ACTION taken through a production callable. Nothing
 * asserts; nothing writes a result. As in world.js, no state under test is
 * hand-rolled: corps are registered through `registerPodiumCorps`, plans set
 * through `setPodiumPlanTemplate`, votes cast through `castFanFavoriteVote`.
 * The nightly stage is `runPodiumStage`, called exactly where
 * scheduled/dailyProcessors.js calls it — after the fantasy scorer, isolated.
 *
 * The cast is picked for what happens at the BOUNDARY, not for realism at
 * scale:
 *
 *  - 14 corps finish the season, one more than `minPoolForWorld` (12), so the
 *    division assessment has a pool deep enough to publish all three cutoffs.
 *  - `pd_ace` rehearses hardest and commits the division cap, so it should end
 *    the season on top with the largest unspent budget: the biggest refund is
 *    also the most expensive one to get wrong.
 *  - `pd_broke` commits nothing, so every travel leg, food week and camp day
 *    hits the free floor. Its refund must come out at exactly what it earned
 *    and never below zero.
 *  - `pd_late` registers after day 49 is scored: rostered, never performed. The
 *    `pct == null` branch of applySeasonResult and the `lastTotal == null`
 *    filter in buildFinalStandings both exist for it.
 *  - `pd_early` re-registers for the NEW season before the archival sweep runs
 *    — the rollover-night race the sweep's transaction is written against. It
 *    is refunded by registration; the sweep must not pay it again.
 *  - `pd_fresh` founds a new corps at re-registration (`freshStart`), retiring
 *    a career one night old.
 *  - `pd_vet` sits this season out entirely, holding a worldClass career from
 *    two season indices ago. Its return is the dormancy path: decayed
 *    reputation, and a seat one division below the one it left.
 */

const functionsTest = require("firebase-functions-test")();
const { paths } = require("../src/helpers/paths");
const { pinToCompletedCalendarDay } = require("./clock");

/**
 * The prior Podium seasons already on the books when this rehearsal starts.
 *
 * Podium did not launch at a season boundary, so the global season index is
 * never 1 in production. Seeding two prior seasons makes the rehearsal's live
 * season index 3 and the off-season it rolls into index 4 — which is the only
 * way to give a returning director a countable dormancy gap (index 4 minus a
 * last-played index of 1 is two missed seasons, one past the grace window).
 */
const PRIOR_SEASONS = {
  current: { seasonUid: "live_2025-25", index: 2 },
  history: { 1: { seasonUid: "live_2024-24", index: 1 } },
};

/** A full 12-block rehearsal day, sliced per director to vary effort. */
const PLAN_BLOCKS = [
  "warmup",
  "visualBasics",
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
  "visualEnsemble",
  "fullEnsemble",
  "fullEnsemble",
  "visualEnsemble",
  "brassSectionals",
  "percussionSectionals",
  "fullEnsemble",
];

/** Home cities, from the committed gazetteer, so travel legs really resolve. */
const HOMES = [
  "Bloomington, Indiana",
  "Rockford, Illinois",
  "Canton, Ohio",
  "Allentown, Pennsylvania",
  "Atlanta, Georgia",
  "Denver, Colorado",
  "San Antonio, Texas",
  "Boston, Massachusetts",
];

/**
 * The Podium cast. `blocks` is how many of PLAN_BLOCKS the assistant director
 * runs each day (the whole field is autoplayed — the nightly assistant path is
 * production code, and 49 days of hand-allocated blocks would test the harness
 * rather than the game). `challenge` is the flat difficulty level across all
 * eight captions; together they produce the score spread the divisions,
 * standings and championship cuts all need.
 */
const PODIUM_DIRECTORS = [
  { uid: "pd_ace", username: "Amara", corps: "Vanguard Ascent", blocks: 12, challenge: 7, commitment: 2500 },
  { uid: "pd_fan", username: "Bodhi", corps: "Cobalt Reverie", blocks: 12, challenge: 6, commitment: 2000 },
  { uid: "pd_early", username: "Cypress", corps: "Ember Court", blocks: 11, challenge: 6, commitment: 1800 },
  { uid: "pd_fresh", username: "Dara", corps: "Northern Lights", blocks: 11, challenge: 5, commitment: 1500 },
  { uid: "pd_05", username: "Eiko", corps: "Solstice", blocks: 10, challenge: 5, commitment: 1200 },
  { uid: "pd_06", username: "Fable", corps: "Iron Sonnet", blocks: 10, challenge: 4, commitment: 1000 },
  { uid: "pd_07", username: "Goldie", corps: "Meridian", blocks: 9, challenge: 4, commitment: 900 },
  { uid: "pd_08", username: "Hollis", corps: "Tidewater", blocks: 9, challenge: 4, commitment: 800 },
  { uid: "pd_09", username: "Ilya", corps: "Copper Sky", blocks: 8, challenge: 3, commitment: 700 },
  { uid: "pd_10", username: "Juno", corps: "Lantern Row", blocks: 8, challenge: 3, commitment: 600 },
  { uid: "pd_11", username: "Koa", corps: "Sable Creek", blocks: 7, challenge: 3, commitment: 500 },
  { uid: "pd_12", username: "Linden", corps: "Halcyon", blocks: 6, challenge: 2, commitment: 400 },
  { uid: "pd_13", username: "Mira", corps: "Foundry", blocks: 5, challenge: 2, commitment: 300 },
  // Commits nothing: every budget charge all season hits the free floor.
  { uid: "pd_broke", username: "Nadir", corps: "Shoestring", blocks: 8, challenge: 3, commitment: 0 },
  // Registers only after day 49 is scored — rostered, never performed.
  { uid: "pd_late", username: "Orin", corps: "Last Minute", blocks: 6, challenge: 3, commitment: 200, late: true },
];

/**
 * The director who sat this season out. Holds a career from season index 1 —
 * two indices before the off-season they come back in, which is one past the
 * demotion grace window, so their seat is decided by decayed reputation rather
 * than kept outright.
 *
 * The reputation is chosen to make the erosion visible: 62 sits above the
 * tier-5 gate worldClass re-entry needs (60), and the two-season decay
 * (dormancyDecayBySeason 5 + 9 = 14) drops it to 48 — below that gate, above
 * the tier-3 gate Open needs. A corps never returns stronger than it left, and
 * this one returns one division lower.
 */
const PODIUM_VETERAN = {
  uid: "pd_vet",
  username: "Perrin",
  corps: "Old Guard",
  blocks: 10,
  challenge: 5,
  commitment: 0,
  career: {
    reputation: 62,
    historicalPeak: 70,
    seasonsPlayed: 3,
    lastPlayedIndex: 1,
    lastSeasonUid: "live_2024-24",
    corpsName: "Old Guard",
    division: "worldClass",
    underCutoffSeasons: 0,
    history: [],
    retiredCareers: [],
  },
};

/** Everyone with a Podium profile, whether or not they field a corps. */
const ALL_PODIUM_DIRECTORS = [...PODIUM_DIRECTORS, PODIUM_VETERAN];

/** A flat challenge map across all eight captions. */
function challengeMap(level) {
  return { GE1: level, GE2: level, VP: level, VA: level, CG: level, B: level, MA: level, P: level };
}

/**
 * Write the Podium cast's profiles, the prior season index, and the veteran's
 * career. Documents only — no corps exists until `registerField` runs them
 * through the real registration callable.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{seasonUid: string, startingCoin: number}} options
 */
async function seedPodiumWorld(db, { seasonUid, startingCoin }) {
  await db.doc("podium-config/podiumSeasons").set(PRIOR_SEASONS);

  for (const [index, director] of ALL_PODIUM_DIRECTORS.entries()) {
    await db.doc(paths.userProfile(director.uid)).set({
      username: director.username,
      displayName: director.username,
      // Podium corps live in the same season as everyone else; the rollover's
      // profile sweep selects on this field, so a Podium-only director has to
      // carry it or archival would skip them entirely.
      activeSeasonId: seasonUid,
      corpsCoin: startingCoin,
      xp: 0,
      achievements: [],
      corps: {},
      lifetimeStats: { totalSeasons: 0 },
      // Home city, used by the travel model to price each leg of the tour.
      podiumHome: HOMES[index % HOMES.length],
    });
  }

  await db.doc(paths.userPodiumCareer(PODIUM_VETERAN.uid)).set(PODIUM_VETERAN.career);

  return { directors: PODIUM_DIRECTORS, veteran: PODIUM_VETERAN, priorSeasons: PRIOR_SEASONS };
}

/**
 * Register a corps through the real callable and set its assistant-director
 * plan. Returns the callable's own result, which is what the client shows the
 * director — including the prior-season refund it claims to have paid.
 */
async function registerCorps(db, director, { freshStart = false } = {}) {
  const podiumCallables = require("../src/callable/podium");
  const register = functionsTest.wrap(podiumCallables.registerPodiumCorps);
  const setPlan = functionsTest.wrap(podiumCallables.setPodiumPlanTemplate);

  const home = (await db.doc(paths.userProfile(director.uid)).get()).data().podiumHome;
  const result = await register({
    data: {
      corpsName: director.corps,
      location: home,
      showConcept: `${director.corps}: a rehearsal season`,
      challenge: challengeMap(director.challenge),
      budgetCommitment: director.commitment,
      ...(freshStart ? { freshStart: true } : {}),
    },
    auth: { uid: director.uid, token: {} },
  });

  await setPlan({
    data: { blocks: PLAN_BLOCKS.slice(0, director.blocks) },
    auth: { uid: director.uid, token: {} },
  });

  return result;
}

/**
 * Register the whole field for the season about to be played, on the eve of
 * calendar day 1 — where a director actually signs up, before a single night
 * has been processed.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<Object>>} the registration results, in cast order.
 */
async function registerField(db) {
  await pinToCompletedCalendarDay(db, 0);
  const registered = [];
  for (const director of PODIUM_DIRECTORS) {
    if (director.late) continue;
    registered.push({ uid: director.uid, ...(await registerCorps(db, director)) });
  }
  return registered;
}

/**
 * Run the nightly Podium stage for the completed calendar day, exactly where
 * scheduled/dailyProcessors.js runs it: after the fantasy scorer, and isolated,
 * so a Podium failure can never take the fantasy pipeline down with it. The
 * isolation is why the harness records the error instead of throwing — a stage
 * that threw in production would be swallowed there too, and a rehearsal that
 * crashed here would hide every check downstream of it.
 */
async function runPodiumNight(db) {
  const { runPodiumStage } = require("../src/scheduled/nightlyStages");
  try {
    return await runPodiumStage(db);
  } catch (error) {
    return { status: "threw", error: error.message };
  }
}

/**
 * The fan vote. Any signed-in user votes, so the voters are the FANTASY
 * directors — the Podium field is on stage, not in the stands.
 *
 * The split is fixed rather than random so the outcome is assertable: the
 * prelims ballots put `pd_ace` clearly ahead, and the finals ballot elects
 * `pd_fan` instead. A Fan Favorite that simply crowned the prelims leader
 * would pass a weaker check without anyone noticing the finals round did
 * nothing.
 */
const PRELIMS_VOTES = [
  ["d01", "pd_ace"], ["d02", "pd_ace"], ["d03", "pd_ace"], ["d04", "pd_ace"],
  ["d05", "pd_fan"], ["d06", "pd_fan"], ["d07", "pd_fan"],
  ["d08", "pd_early"], ["d09", "pd_early"],
  ["d10", "pd_fresh"],
];
const FINALS_VOTES = [
  ["d01", "pd_fan"], ["d02", "pd_fan"], ["d03", "pd_fan"], ["d04", "pd_fan"],
  ["d05", "pd_fan"], ["d06", "pd_fan"],
  ["d07", "pd_ace"], ["d08", "pd_ace"], ["d09", "pd_ace"],
  ["d10", "pd_early"],
];

/** The Fan Favorite winner the seeded ballots elect, for the checks to expect. */
const EXPECTED_FAN_WINNER = "pd_fan";
/** The corps that led the prelims — deliberately NOT the finals winner. */
const EXPECTED_PRELIMS_LEADER = "pd_ace";

/**
 * Cast one round of ballots through the real callable. Votes that the server
 * rejects (a closed window, a candidate that did not perform) are collected
 * rather than thrown: a rejected ballot is a finding for the checks to report,
 * not a reason to abandon the season.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<[string, string]>} ballots - [voterUid, corpsUid] pairs.
 */
async function castVotes(db, ballots) {
  const fanCallables = require("../src/callable/podiumFan");
  const castVote = functionsTest.wrap(fanCallables.castFanFavoriteVote);
  const rejected = [];
  for (const [voter, corpsUid] of ballots) {
    try {
      await castVote({ data: { corpsUid }, auth: { uid: voter, token: {} } });
    } catch (error) {
      rejected.push({ voter, corpsUid, message: error.message });
    }
  }
  return rejected;
}

module.exports = {
  PODIUM_DIRECTORS,
  PODIUM_VETERAN,
  ALL_PODIUM_DIRECTORS,
  PRIOR_SEASONS,
  PRELIMS_VOTES,
  FINALS_VOTES,
  EXPECTED_FAN_WINNER,
  EXPECTED_PRELIMS_LEADER,
  seedPodiumWorld,
  registerCorps,
  registerField,
  runPodiumNight,
  castVotes,
  challengeMap,
};
