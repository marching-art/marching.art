/**
 * The seeded world the rehearsal plays a season in.
 *
 * Everything here is INPUT — the season, its schedule, the historical corpus
 * the scorer regresses on, the directors and the leagues. Nothing here is a
 * result: recaps, standings, matchups, champions and the rollover state are all
 * produced by the real pipeline in drive.js, which is the whole point. Seeding
 * a recap or a standings row would mean the rehearsal grades its own homework.
 *
 * The cast is picked for the edges, not for realism at scale:
 *
 *  - LG_MAIN has 14 members against a 12-deep finals field, so 12 qualify and
 *    exactly 2 fall below the cut — the MIN_CONSOLATION_FIELD boundary in
 *    helpers/leagueChampion.js.
 *  - LG_SMALL has 3 against the same field, so everyone qualifies and there is
 *    no consolation race at all.
 *  - LG_CAPTIONS is running Caption Wars, bought for THIS season, so the
 *    rollover has a paid format to clear.
 *  - LG_MIXED spans four classes, which is the case the normalized standings
 *    column exists for.
 *  - LG_GHOST's members have no profile documents: a league of directors who
 *    never registered must crown nobody and must not throw.
 *  - LG_POOL carries both an escrowed prize pool and unclaimed pool carry, so
 *    the payout has a number the checks can predict exactly.
 *
 * Two directors are deliberately broken: `dq_lineup` never finishes its lineup
 * (must never be scored), and `dq_finals` skips championship week entirely
 * (must forfeit rather than carry a stale score into the title).
 */

const admin = require("firebase-admin");
const { paths } = require("../src/helpers/paths");
const { writeScheduleToCollection } = require("../src/helpers/seasonSchedule");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The season the rehearsal plays. Live-season shaped, like the one running. */
const SEASON_UID = "live_2026-26";
const SEASON_YEAR = 2026;
const SPRING_TRAINING_DAYS = 21;
const SOURCE_YEAR = "2025";

/** The eight lineup captions, exactly as helpers/scoring.js reads them. */
const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

/**
 * The corps pool directors draft from. Points are the lineup budget values;
 * the strength figure drives the synthetic corpus below so the field has a
 * real spread instead of sixteen directors tied at the same score.
 */
const POOL = [
  { corpsName: "Blue Devils", points: 25, strength: 1.0 },
  { corpsName: "Bluecoats", points: 24, strength: 0.97 },
  { corpsName: "Carolina Crown", points: 23, strength: 0.95 },
  { corpsName: "Santa Clara Vanguard", points: 22, strength: 0.93 },
  { corpsName: "Boston Crusaders", points: 21, strength: 0.91 },
  { corpsName: "The Cavaliers", points: 20, strength: 0.88 },
  { corpsName: "Phantom Regiment", points: 19, strength: 0.85 },
  { corpsName: "Blue Knights", points: 18, strength: 0.82 },
  { corpsName: "Blue Stars", points: 17, strength: 0.79 },
  { corpsName: "Madison Scouts", points: 16, strength: 0.76 },
  { corpsName: "Colts", points: 15, strength: 0.73 },
  { corpsName: "Mandarins", points: 14, strength: 0.7 },
  { corpsName: "Crossmen", points: 13, strength: 0.67 },
  { corpsName: "Spirit of Atlanta", points: 12, strength: 0.64 },
  { corpsName: "Genesis", points: 11, strength: 0.61 },
  { corpsName: "Seattle Cascades", points: 10, strength: 0.58 },
];

/**
 * A deterministic pseudo-random source.
 *
 * The rehearsal must be reproducible: a failure that only shows up on some runs
 * is worse than no rehearsal, because it teaches the team to re-run until
 * green. Every jitter below draws from here, seeded per run and printed in the
 * report so a red run can be replayed exactly.
 *
 * (helpers/scoringMath.js adds its own ±0.25 Math.random jitter to regressed
 * captions, which the checks account for by never asserting an exact score —
 * only orderings and invariants.)
 */
function makeRng(seed) {
  let state = seed >>> 0 || 1;
  return function next() {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

/**
 * The historical corpus the scorer regresses on: `historical_scores/{year}`,
 * shaped exactly as helpers/scoringMath.js reads it — a flat array of events,
 * each carrying per-corps caption maps.
 *
 * Scores climb across the season the way a real corps does (that is what makes
 * the logarithmic regression well-behaved) and every corps has a data point on
 * enough days that no caption falls through to the "no data, return 0" branch.
 */
function buildHistoricalCorpus(rng) {
  const events = [];
  for (let day = 2; day <= 49; day += 3) {
    const scores = POOL.map((corps) => {
      const captions = {};
      for (const caption of CAPTIONS) {
        // A season-long climb from ~55% to ~97% of the corps' ceiling, plus a
        // little per-caption texture so captions are not carbon copies.
        const progress = 0.55 + 0.42 * (day / 49);
        const texture = 0.96 + 0.08 * rng();
        captions[caption] = Number((20 * corps.strength * progress * texture).toFixed(3));
      }
      return { corps: corps.corpsName, captions };
    });
    events.push({
      offSeasonDay: day,
      eventName: `Rehearsal Regional ${day}`,
      scores,
    });
  }
  return events;
}

/**
 * The season's shows: two regular shows a week on days 2 and 6 of each week
 * through day 44, then championship week exactly as the real generators write
 * it (helpers/scheduleGeneration.js days 45-49).
 *
 * Day 41/42 are the Eastern Classic two-night split, which the scorer resolves
 * through helpers/easternSplit.js — included because it is the last thing that
 * happens before championship week and it feeds the day-38 preview.
 */
function buildSchedule(startDate) {
  const schedule = [];
  const dateFor = (day) =>
    new Date(startDate.getTime() + (SPRING_TRAINING_DAYS + day - 1) * MS_PER_DAY);

  for (let day = 1; day <= 49; day++) {
    schedule.push({ offSeasonDay: day, shows: [] });
  }
  const dayEntry = (day) => schedule[day - 1];

  for (let week = 1; week <= 6; week++) {
    const first = (week - 1) * 7 + 2;
    const second = (week - 1) * 7 + 6;
    for (const [index, day] of [first, second].entries()) {
      if (day > 44) continue;
      dayEntry(day).shows.push({
        eventName: `Week ${week} ${index === 0 ? "Regional" : "Classic"}`,
        location: "Rehearsal, IN",
        date: dateFor(day),
        isChampionship: false,
      });
    }
  }

  // The Eastern Classic two-night split (days 41 and 42), one event over two
  // nights. helpers/easternSplit.js persists the snake assignment on day 41
  // and day 42 must score its exact complement.
  const easternNights = { eventName: "marching.art Eastern Classic", nights: [41, 42] };
  for (const day of easternNights.nights) {
    dayEntry(day).shows.push({
      eventName: "marching.art Eastern Classic",
      location: "Allentown, PA",
      date: dateFor(day),
      isChampionship: false,
      eventTier: "major",
      multiNight: { eventKey: "eastern-classic", night: day === 41 ? 1 : 2, nights: 2 },
    });
  }

  dayEntry(45).shows.push({
    eventName: "Open and A Class Prelims",
    location: "Marion, IN",
    date: dateFor(45),
    isChampionship: true,
    eligibleClasses: ["openClass", "aClass"],
    mandatory: true,
  });
  dayEntry(46).shows.push({
    eventName: "Open and A Class Finals",
    location: "Marion, IN",
    date: dateFor(46),
    isChampionship: true,
    eligibleClasses: ["openClass", "aClass"],
    advancementRules: { openClass: 8, aClass: 4 },
    mandatory: true,
  });
  dayEntry(47).shows.push({
    eventName: "marching.art World Championship Prelims",
    location: "Indianapolis, IN",
    date: dateFor(47),
    isChampionship: true,
    eligibleClasses: ["worldClass", "openClass", "aClass"],
    mandatory: true,
  });
  dayEntry(48).shows.push({
    eventName: "marching.art World Championship Semifinals",
    location: "Indianapolis, IN",
    date: dateFor(48),
    isChampionship: true,
    eligibleClasses: ["worldClass", "openClass", "aClass"],
    advancementRules: { all: 25 },
    mandatory: true,
  });
  dayEntry(49).shows.push({
    eventName: "marching.art World Championship Finals",
    location: "Indianapolis, IN",
    date: dateFor(49),
    isChampionship: true,
    eligibleClasses: ["worldClass", "openClass", "aClass"],
    advancementRules: { all: 12 },
    mandatory: true,
  });
  dayEntry(49).shows.push({
    eventName: "SoundSport International Music & Food Festival",
    location: "Indianapolis, IN",
    date: dateFor(49),
    isChampionship: true,
    eligibleClasses: ["soundSport"],
    mandatory: true,
  });

  return schedule;
}

/** A complete eight-caption lineup drawn from the pool, offset per director. */
function buildLineup(offset) {
  const lineup = {};
  CAPTIONS.forEach((caption, index) => {
    const corps = POOL[(offset + index) % POOL.length];
    lineup[caption] = `${corps.corpsName}|${SOURCE_YEAR}`;
  });
  return lineup;
}

/**
 * Every show the director attends, keyed by week the way
 * `corps.{class}.selectedShows` is written by callable/lineups.js.
 *
 * `skipWeeks` is how a director sits a week out — championship week for
 * `dq_finals`, which is the case the champion selector's `anyFinalsScore`
 * branch exists for.
 */
function buildSelectedShows(schedule, { skipWeeks = [] } = {}) {
  const selected = {};
  for (let week = 1; week <= 7; week++) {
    if (skipWeeks.includes(week)) continue;
    const shows = [];
    for (let day = (week - 1) * 7 + 1; day <= week * 7; day++) {
      for (const show of schedule[day - 1].shows) {
        shows.push({ eventName: show.eventName, date: show.date, day });
      }
    }
    selected[`week${week}`] = shows;
  }
  return selected;
}

/** The cast. `classes` maps a corps class to the pool offset its lineup uses. */
const DIRECTORS = [
  { uid: "d01", username: "Avery", classes: { worldClass: 0 } },
  { uid: "d02", username: "Blake", classes: { worldClass: 1 } },
  { uid: "d03", username: "Casey", classes: { worldClass: 2 } },
  { uid: "d04", username: "Devon", classes: { worldClass: 3 } },
  { uid: "d05", username: "Ellis", classes: { worldClass: 4 } },
  { uid: "d06", username: "Frankie", classes: { worldClass: 5 } },
  { uid: "d07", username: "Gray", classes: { worldClass: 6 } },
  { uid: "d08", username: "Harper", classes: { worldClass: 7 } },
  { uid: "d09", username: "Indigo", classes: { worldClass: 8 } },
  { uid: "d10", username: "Jules", classes: { worldClass: 9 } },
  { uid: "d11", username: "Kai", classes: { worldClass: 10 } },
  { uid: "d12", username: "Lennon", classes: { worldClass: 11 } },
  { uid: "d13", username: "Marlow", classes: { worldClass: 12 } },
  { uid: "d14", username: "Nico", classes: { worldClass: 13 } },
  { uid: "d_multi", username: "Onyx", classes: { openClass: 2, aClass: 5 } },
  { uid: "d_sound", username: "Piper", classes: { soundSport: 9 } },
  // Sits out a whole regular week: must forfeit it 0-0 rather than carry an
  // earlier week's score into the matchup, which is the bug leagueScoring.js
  // was written to fix.
  { uid: "d_absent", username: "Quinn", classes: { worldClass: 4 }, skipWeeks: [6] },
  // Selects nothing for championship week. Championship shows are `mandatory`
  // with auto-enrollment, so this director SHOULD still be scored — the check
  // pins that down, because "I forgot to pick shows" landing on finals night
  // would be the most expensive way to discover otherwise.
  { uid: "d_nopicks", username: "Rowan", classes: { worldClass: 10 }, skipWeeks: [7] },
  // Never finishes a lineup: must never appear in a recap at all.
  { uid: "dq_lineup", username: "Sage", classes: { worldClass: 6 }, incompleteLineup: true },
  // Played last season and has not come back. Holds a profile and a named
  // corps, but nothing that belongs to THIS season — the case league
  // eligibility (helpers/leagueActivity.js) exists to answer.
  { uid: "dorm_a", username: "Tatum", classes: { worldClass: 1 }, dormant: true },
  { uid: "dorm_b", username: "Umber", classes: { worldClass: 3 }, dormant: true },
  { uid: "dorm_c", username: "Vale", classes: { worldClass: 5 }, dormant: true },
];

/** The season a dormant director last played, for their stale corps stamp. */
const PREVIOUS_SEASON_UID = "live_2025-25";

/** The leagues, and what each one is here to prove. */
const LEAGUES = [
  {
    id: "LG_MAIN",
    name: "Marion Music Circuit",
    members: DIRECTORS.filter((d) => /^d\d\d$/.test(d.uid)).map((d) => d.uid),
    finalsSize: 12,
    entryFee: 100,
    purpose: "14 members against a 12-deep field: 12 qualify, 2 below the cut",
  },
  {
    id: "LG_SMALL",
    name: "Three Corps Circuit",
    members: ["d01", "d02", "d03"],
    finalsSize: 12,
    purpose: "field deeper than the roster: everyone qualifies, no consolation",
  },
  {
    id: "LG_CAPTIONS",
    name: "Caption Wars Invitational",
    members: ["d04", "d05", "d06", "d07", "d08", "d09"],
    finalsSize: 4,
    captionWars: true,
    purpose: "a paid alternate format the rollover has to clear",
  },
  {
    id: "LG_MIXED",
    name: "All Classes Open",
    members: ["d01", "d_multi", "d_sound", "d10"],
    finalsSize: 12,
    purpose: "four classes in one table: the normalized column's reason to exist",
  },
  {
    id: "LG_DORMANT",
    name: "League of Ghosts",
    members: ["dorm_a", "dorm_b", "dorm_c"],
    finalsSize: 12,
    dormant: true,
    purpose: "nobody came back this season: crown nobody, throw nothing",
  },
  {
    id: "LG_POOL",
    name: "Escrow Test Circuit",
    members: ["d10", "d11", "d12", "d_absent"],
    finalsSize: 2,
    entryFee: 50,
    poolCarry: 125,
    purpose: "prize pool + unclaimed pool carry: an exact payout to predict",
  },
];

/**
 * Write the whole world. Returns the description the driver and the checks
 * share, so neither of them re-derives what was seeded.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{seed?: number, startingCoin?: number}} [options]
 */
async function seedWorld(db, { seed = 20260808, startingCoin = 5000 } = {}) {
  const rng = makeRng(seed);

  // Season start is pinned relative to the wall clock by the driver's clock
  // (clock.js) before each day is scored; this initial value only has to be a
  // valid UTC-midnight date for the schedule builder.
  const today = new Date();
  const startDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
      (SPRING_TRAINING_DAYS + 49) * MS_PER_DAY
  );
  const endDate = new Date(startDate.getTime() + (SPRING_TRAINING_DAYS + 49) * MS_PER_DAY);

  const schedule = buildSchedule(startDate);

  await db.doc("game-settings/season").set({
    name: SEASON_UID,
    status: "live-season",
    seasonUid: SEASON_UID,
    seasonYear: SEASON_YEAR,
    currentPointCap: 150,
    dataDocId: SEASON_UID,
    schedule: {
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      springTrainingDays: SPRING_TRAINING_DAYS,
    },
  });

  // Podium and the drop dispatcher are separate subsystems with their own
  // season-boundary work; this rehearsal covers the fantasy and league paths,
  // so both stay off and the legacy 2 AM ordering applies.
  await db.doc("game-settings/features").set({ podiumClass: false, dropScheduling: false });

  await db.doc(`dci-data/${SEASON_UID}`).set({
    corpsValues: POOL.map((c) => ({
      corpsName: c.corpsName,
      sourceYear: SOURCE_YEAR,
      points: c.points,
    })),
  });

  await db.doc(`historical_scores/${SOURCE_YEAR}`).set({ data: buildHistoricalCorpus(rng) });
  // The live strategy also looks up the season's own year for scraped results.
  // Leaving it absent is the honest state for a season still in progress: every
  // caption falls through to prior-year regression, which is the path that runs
  // whenever the scraper has nothing for a corps.
  await writeScheduleToCollection(SEASON_UID, schedule);

  // startNewOffSeason (the rollover trigger) builds the next season's pool from
  // these, and refuses to start without them.
  await db.doc("final_rankings/2025").set({
    data: POOL.map((c) => ({ corps: c.corpsName, points: c.points })),
  });

  for (const director of DIRECTORS) {
    const corps = {};
    for (const [corpsClass, offset] of Object.entries(director.classes)) {
      if (director.dormant) {
        // Exactly what archiveAndResetProfiles leaves behind: the corps keeps
        // its name, everything season-scoped is gone, and the stamp still names
        // the season that ended.
        corps[corpsClass] = {
          corpsName: `${director.username} ${corpsClass}`,
          seasonUid: PREVIOUS_SEASON_UID,
          lineup: null,
          selectedShows: {},
          totalSeasonScore: 0,
          weeklyScores: {},
        };
        continue;
      }
      const lineup = buildLineup(offset);
      if (director.incompleteLineup) delete lineup.P;
      corps[corpsClass] = {
        corpsName: `${director.username} ${corpsClass}`,
        lineup,
        // The explicit per-corps season stamp (signal 1 in
        // helpers/leagueActivity.js).
        seasonUid: SEASON_UID,
        selectedShows: buildSelectedShows(schedule, { skipWeeks: director.skipWeeks }),
        totalSeasonScore: 0,
        weeklyScores: {},
      };
    }
    await db.doc(paths.userProfile(director.uid)).set({
      username: director.username,
      displayName: director.username,
      activeSeasonId: director.dormant ? PREVIOUS_SEASON_UID : SEASON_UID,
      corpsCoin: startingCoin,
      xp: 0,
      achievements: [],
      corps,
      lifetimeStats: { totalSeasons: director.dormant ? 1 : 0 },
    });
  }

  const leagues = await createLeagues(db);

  return {
    seed,
    seasonUid: SEASON_UID,
    seasonName: SEASON_UID,
    springTrainingDays: SPRING_TRAINING_DAYS,
    startDate,
    startingCoin,
    schedule,
    directors: DIRECTORS,
    leagues,
    pool: POOL,
  };
}

/**
 * Build the leagues through the callables players actually use.
 *
 * The first draft of this seeded league documents directly, and the whole
 * rehearsal came back with no champion in any league. The cause was that
 * `createLeague` also writes `standings/current`, and nothing else ever creates
 * it: `updateStandings` returns silently when the document is missing
 * (helpers/leagueStandings.js applyStandingsInTransaction), so seven weeks of
 * resolved matchups folded into nothing and archival found an empty table.
 *
 * That is a good argument for never hand-rolling the state under test. Every
 * league here is now created by `createLeague`, joined by `joinLeague`, and —
 * where it runs an alternate format — bought through `setLeagueScoringFormat`,
 * which means the entry fees are really debited and the prize pool really is
 * escrow rather than a number the harness asserted into existence.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<Object>>} the seeds, each with the real leagueId.
 */
async function createLeagues(db) {
  const functionsTest = require("firebase-functions-test")();
  const leagueCallables = require("../src/callable/leagues");
  const formatCallables = require("../src/callable/leagueFormat");
  const createLeague = functionsTest.wrap(leagueCallables.createLeague);
  const joinLeague = functionsTest.wrap(leagueCallables.joinLeague);
  const setFormat = functionsTest.wrap(formatCallables.setLeagueScoringFormat);

  const created = [];
  for (const league of LEAGUES) {
    const [commissioner, ...joiners] = league.members;
    const result = await createLeague({
      data: {
        name: league.name,
        description: league.purpose,
        isPublic: true,
        maxMembers: 50,
        settings: { finalsSize: league.finalsSize, entryFee: league.entryFee || 0 },
      },
      auth: { uid: commissioner, token: {} },
    });
    const leagueId = result.leagueId;

    for (const member of joiners) {
      await joinLeague({ data: { leagueId }, auth: { uid: member, token: {} } });
    }

    if (league.captionWars) {
      await setFormat({
        data: { leagueId, format: "captionWars" },
        auth: { uid: commissioner, token: {} },
      });
    }

    const extras = {};
    if (league.poolCarry) {
      // Unclaimed prediction-pool escrow. Written directly because reaching it
      // through the pools callables would mean staking and losing a pool on a
      // seeded day — a lot of machinery to produce one number the rollover
      // simply has to pay out.
      extras.poolCarry = league.poolCarry;
    }
    // Both are cleared by the rollover; seeded so the checks can prove it.
    extras.announcement = { message: "Draft night moved to Thursday", postedAt: new Date() };
    await db.doc(paths.league(leagueId)).set(extras, { merge: true });

    // Rivalries are within-season state and must not survive the rollover.
    await db.doc(paths.leagueMeta(leagueId, "rivalries")).set({
      pairs: [{ a: commissioner, b: joiners[0] || commissioner, meetings: 3 }],
    });

    created.push({ ...league, leagueId });
  }
  return created;
}

module.exports = {
  seedWorld,
  SEASON_UID,
  SPRING_TRAINING_DAYS,
  SOURCE_YEAR,
  CAPTIONS,
  DIRECTORS,
  LEAGUES,
  POOL,
  makeRng,
};
