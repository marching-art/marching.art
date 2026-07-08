// Tests for off-season heritage enrichment: matching a regular show to its
// historical_schedules record and rebasing times onto the off-season date
// (preserving local wall-clock), and synthesizing championship running orders
// from the pool. Pure functions — no Firestore.
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  enrichRegularShow,
  buildChampionshipLineup,
  pickHeritage,
  offSeasonDateFor,
  enrichOffSeasonSchedule,
} = require("./offSeasonHeritage");

// Local hour-of-day (0-23.99) for an instant in a timezone.
function localHour(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", hour: "numeric", minute: "numeric",
  }).formatToParts(new Date(iso));
  const h = +parts.find((p) => p.type === "hour").value;
  const m = +parts.find((p) => p.type === "minute").value;
  return h + m / 60;
}
function localDateStr(iso, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

describe("enrichRegularShow — match + rebase", () => {
  // Heritage: 2015 Capital Classic, first performer 6:40 PM PT (=01:40Z next day).
  const heritage = {
    eventName: "DCI Capital Classic",
    date: "2015-07-01T00:00:00.000Z",
    location: "Sacramento, CA",
    timezone: "America/Los_Angeles",
    venue: "Sac High",
    source: "scraped",
    gatesAt: "2015-07-02T00:20:00.000Z", // 5:20 PM PT
    startsAt: "2015-07-02T01:40:00.000Z", // 6:40 PM PT
    scoresAt: "2015-07-02T04:41:00.000Z", // 9:41 PM PT
    lineup: [
      { order: 1, corps: "Gold", hometown: "San Diego, CA", performanceTime: "6:40 PM", performsAt: "2015-07-02T01:40:00.000Z" },
      { order: 2, corps: "Mandarins", hometown: "Sacramento, CA", performanceTime: "6:57 PM", performsAt: "2015-07-02T01:57:00.000Z" },
    ],
  };

  test("matches by unbranded name + date and rebases onto the off-season date", () => {
    const show = { eventName: "marching.art Capital Classic", date: heritage.date, location: "Sacramento, CA" };
    const offSeasonDate = new Date("2026-06-15T00:00:00.000Z");
    const ok = enrichRegularShow(show, [heritage], offSeasonDate);
    assert.equal(ok, true);
    assert.equal(show.heritageSource, "scraped");
    assert.equal(show.lineup.length, 2);
    assert.equal(show.lineup[0].corps, "Gold");

    // Local wall-clock is preserved (both dates are in PDT).
    assert.equal(localHour(show.startsAt, show.timezone), 18 + 40 / 60); // still 6:40 PM
    assert.equal(localHour(show.lineup[1].performsAt, show.timezone), 18 + 57 / 60); // 6:57 PM
    // And the show now lands on the off-season calendar date (local).
    assert.equal(localDateStr(show.startsAt, show.timezone), "2026-06-15");
  });

  test("returns false when no heritage record matches", () => {
    const show = { eventName: "marching.art Nonexistent", date: "2015-07-01T00:00:00.000Z", location: "Nowhere, ZZ" };
    assert.equal(enrichRegularShow(show, [heritage], new Date("2026-06-15Z")), false);
  });
});

describe("pickHeritage — precedence", () => {
  const day = "2019-07-10T00:00:00.000Z";
  const scraped = { eventName: "DCI Something", date: day, location: "Akron, OH", source: "scraped", lineup: [{}] };
  const learned = { eventName: "DCI Something", date: day, location: "Akron, OH", source: "learned", lineup: [{}] };

  test("prefers scraped over learned for the same event", () => {
    const show = { eventName: "marching.art Something", date: day, location: "Akron, OH" };
    assert.equal(pickHeritage([learned, scraped], show).source, "scraped");
  });

  test("prefers an exact name match over a mere same-day event", () => {
    const other = { eventName: "DCI Other", date: day, location: "Elsewhere, OH", source: "scraped", lineup: [{}] };
    const show = { eventName: "marching.art Something", date: day, location: "Akron, OH" };
    assert.equal(pickHeritage([other, learned], show).eventName, "DCI Something");
  });
});

describe("buildChampionshipLineup", () => {
  const pool = [
    { corpsName: "Blue Devils", sourceYear: 2025 },
    { corpsName: "Bluecoats", sourceYear: 2024 },
    { corpsName: "Carolina Crown", sourceYear: 2012 },
    { corpsName: "Phantom Regiment", sourceYear: 2008 },
    { corpsName: "The Cavaliers", sourceYear: 2002 },
  ];
  // Deterministic stub: fixed total per corps regardless of day.
  const totals = { "Blue Devils": 98, "Bluecoats": 95, "Carolina Crown": 90, "Phantom Regiment": 85, "The Cavaliers": 80 };
  const corpsTotalAtDay = (name) => totals[name] ?? 0;

  test("orders the pool worst-to-best and stamps times on the off-season date", () => {
    const show = { eventName: "marching.art World Championship Finals", location: "Indianapolis, IN", eligibleClasses: ["worldClass", "openClass", "aClass"] };
    const offSeasonDate = new Date("2026-08-08T00:00:00.000Z");
    const ok = buildChampionshipLineup(show, pool, 49, offSeasonDate, { corpsTotalAtDay });
    assert.equal(ok, true);
    assert.equal(show.heritageSource, "learned-championship");
    assert.equal(show.lineup[0].corps, "The Cavaliers"); // lowest performs first
    assert.equal(show.lineup[show.lineup.length - 1].corps, "Blue Devils"); // highest last
    assert.equal(localDateStr(show.startsAt, show.timezone), "2026-08-08");
  });

  test("skips a SoundSport-only stage", () => {
    const show = { eventName: "SoundSport Festival", location: "Indianapolis, IN", eligibleClasses: ["soundSport"] };
    assert.equal(buildChampionshipLineup(show, pool, 49, new Date("2026-08-08Z"), { corpsTotalAtDay }), false);
    assert.equal(show.lineup, undefined);
  });

  test("skips when too few pool corps have a positive score", () => {
    const show = { eventName: "marching.art World Championship Finals", location: "Indianapolis, IN", eligibleClasses: ["worldClass"] };
    assert.equal(buildChampionshipLineup(show, pool, 49, new Date("2026-08-08Z"), { corpsTotalAtDay: () => 0 }), false);
  });
});

describe("enrichOffSeasonSchedule — orchestration dry run", () => {
  test("enriches matched regular shows and leaves unmatched ones bare", async () => {
    const docs = {
      "historical_schedules/2015": {
        data: [{
          eventName: "DCI Capital Classic", date: "2015-07-01T00:00:00Z", location: "Sacramento, CA",
          timezone: "America/Los_Angeles", source: "scraped",
          startsAt: "2015-07-02T01:40:00Z", gatesAt: "2015-07-02T00:20:00Z", scoresAt: "2015-07-02T04:41:00Z",
          lineup: [{ order: 1, corps: "Gold", hometown: "San Diego, CA", performanceTime: "6:40 PM", performsAt: "2015-07-02T01:40:00Z" }],
        }],
      },
    };
    const db = { doc: (p) => ({ get: async () => ({ exists: p in docs, data: () => docs[p] }) }) };

    const schedule = [
      { offSeasonDay: 12, shows: [{ eventName: "marching.art Capital Classic", date: "2015-07-01T00:00:00Z", location: "Sacramento, CA" }] },
      { offSeasonDay: 13, shows: [{ eventName: "marching.art Ghost Show", date: "2015-07-05T00:00:00Z", location: "Nowhere, ZZ" }] },
    ];

    const counts = await enrichOffSeasonSchedule(db, schedule, {
      startDate: new Date("2026-06-15T00:00:00Z"), pool: [], dataDocId: "x",
    });

    assert.equal(counts.regular, 1);
    assert.equal(counts.unmatched, 1);

    const matched = schedule[0].shows[0];
    assert.equal(matched.heritageSource, "scraped");
    assert.equal(matched.lineup[0].corps, "Gold");
    assert.equal(matched.date, "2026-06-26T00:00:00.000Z"); // day 12 = start + 11

    const bare = schedule[1].shows[0];
    assert.equal(bare.lineup, undefined); // no heritage -> left as-is
    assert.equal(bare.date, "2015-07-05T00:00:00Z");
  });
});

describe("offSeasonDateFor", () => {
  test("day 1 is the start date; day N is start + (N-1) days", () => {
    const start = new Date("2026-06-15T00:00:00.000Z");
    assert.equal(offSeasonDateFor(start, 1).toISOString(), "2026-06-15T00:00:00.000Z");
    assert.equal(offSeasonDateFor(start, 12).toISOString(), "2026-06-26T00:00:00.000Z");
  });
});
