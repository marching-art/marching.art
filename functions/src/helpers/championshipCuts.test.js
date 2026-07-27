// Championship-week cuts → the score-drop embed: which nights carry a cut,
// that the advancing list matches the one the SCORER will use, and the copy.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const championshipCuts = require("./championshipCuts");
const { buildChampionshipConfig } = require("./scoringAwards");

/** A recap whose single show carries `results`. */
function recap(results, eventName = "Prelims") {
  return { shows: [{ eventName, results }] };
}

/** `count` corps of one class, scored descending from `top`. */
function field(corpsClass, count, top = 95, prefix = "Corps") {
  return Array.from({ length: count }, (_, i) => ({
    uid: `${corpsClass}-${i + 1}`,
    corpsClass,
    corpsName: `${prefix} ${i + 1}`,
    totalScore: Number((top - i * 0.5).toFixed(3)),
  }));
}

describe("which nights end in a cut", () => {
  test("only the three championship nights that decide a field", () => {
    const day47 = recap(field("worldClass", 30));
    for (const day of [1, 20, 44, 46, 49]) {
      assert.equal(
        championshipCuts.cutForDrop(day47, day),
        null,
        `day ${day} should decide nothing`
      );
    }
    // 45 -> Open/A Finals, 47 -> Semis, 48 -> Finals.
    assert.ok(championshipCuts.cutForDrop(recap([...field("openClass", 10), ...field("aClass", 6)]), 45));
    assert.ok(championshipCuts.cutForDrop(day47, 47));
    assert.ok(championshipCuts.cutForDrop(recap(field("worldClass", 25)), 48));
  });

  test("day 47 prelims decide nothing themselves — everyone is auto-enrolled", () => {
    // Day 46's field comes from day 45; day 47 is open to all, so the night
    // BEFORE it (46) has no cut to announce.
    assert.equal(championshipCuts.cutForDrop(recap(field("openClass", 10)), 46), null);
  });

  test("an empty or dark recap announces nothing", () => {
    assert.equal(championshipCuts.cutForDrop(recap([]), 47), null);
    assert.equal(championshipCuts.cutForDrop({}, 47), null);
    assert.equal(championshipCuts.cutForDrop(null, 47), null);
  });
});

describe("the announced field matches the scorer's", () => {
  test("top 25 to semifinals, exactly the uids the scorer will enroll", () => {
    const results = field("worldClass", 30);
    const cut = championshipCuts.cutForDrop(recap(results), 47);

    // The same call the scoring pipeline makes for day 48.
    const config = buildChampionshipConfig(48, new Map([[47, recap(results)]]), []);
    const scorerUids = config["marching.art World Championship Semifinals"].participants
      .map((p) => p.uid)
      .sort();

    assert.deepEqual(cut.advancing.map((e) => e.uid).sort(), scorerUids);
    assert.equal(cut.advancing.length, 25);
    assert.equal(cut.missed, 5);
    assert.equal(cut.cutLine, results[24].totalScore);
  });

  test("a tie on the cut line advances everyone tied, and the post says so", () => {
    // 26 corps where 25th and 26th are level: the scorer's tie-inclusive
    // cutoff takes 26, and the announcement must not name only 25.
    const results = field("worldClass", 26);
    results[25].totalScore = results[24].totalScore;

    const cut = championshipCuts.cutForDrop(recap(results), 47);
    assert.equal(cut.advancing.length, 26);
    assert.equal(cut.missed, 0);
  });

  test("top 12 to finals, off the semifinals recap", () => {
    const cut = championshipCuts.cutForDrop(recap(field("worldClass", 25)), 48);
    assert.equal(cut.announcedDay, 49);
    assert.match(cut.eventName, /World Championship Finals/);
    assert.equal(cut.advancing.length, 12);
    assert.equal(cut.missed, 13);
  });

  test("Open and A Class are cut separately: top 8 and top 4", () => {
    const results = [
      ...field("openClass", 12, 90, "Open"),
      ...field("aClass", 9, 80, "A"),
    ];
    const cut = championshipCuts.cutForDrop(recap(results), 45);
    assert.equal(cut.perClass, true);
    assert.equal(cut.advancing.filter((e) => e.corpsClass === "openClass").length, 8);
    assert.equal(cut.advancing.filter((e) => e.corpsClass === "aClass").length, 4);
    assert.equal(cut.missed, 9); // 4 Open + 5 A
  });

  // SoundSport does not march Prelims, Semifinals or Finals — it has its own
  // festival on day 49 — so a SoundSport row in a day-45/47/48 recap should
  // never occur. This is defense in depth for if one ever does: SoundSport is
  // ratings-only and its scores are never revealed anywhere in the product,
  // so the one thing that must not happen is a SoundSport score reaching a
  // public embed.
  test("a stray SoundSport row can never reach the cut, or leak a score", () => {
    const results = [...field("worldClass", 30), ...field("soundSport", 5, 99, "SS")];
    const cut = championshipCuts.cutForDrop(recap(results), 47);
    assert.ok(cut.advancing.every((e) => e.corpsClass !== "soundSport"));

    // Those rows top the raw ranking (99.000), and buildChampionshipConfig ranks
    // BEFORE applying classFilter — so they really would consume 5 of the
    // scorer's 25 participant slots, leaving 20 corps to actually march. 20 is
    // the truthful count and it is what the post says; announcing 25 would name
    // corps the scorer then leaves out.
    assert.equal(cut.advancing.length, 20);
    assert.equal(cut.missed, 10);
  });
});

describe("the cut embed", () => {
  test("ranks the advancing corps with their scores", () => {
    const cut = championshipCuts.cutForDrop(recap(field("worldClass", 30)), 47);
    const embed = championshipCuts.buildCutsEmbed(cut, { seasonName: "Season 12" });

    assert.match(embed.title, /The field is set/);
    assert.match(embed.title, /World Championship Semifinals/);
    assert.match(embed.description, /Season 12 — Day 48/);
    assert.match(embed.description, /Top 25 from Prelims/);
    assert.match(embed.description, /25 advance\. 5 corps miss the cut, at 83\.000\./);
    assert.equal(embed.fields.length, 1);
    assert.match(embed.fields[0].name, /Advancing \(25\)/);
    assert.match(embed.fields[0].value, /^1\. \*\*Corps 1\*\* — 95\.000$/m);
    assert.ok(embed.fields[0].value.length <= 1024);
  });

  test("one field per class when the classes run separate finals", () => {
    const cut = championshipCuts.cutForDrop(
      recap([...field("openClass", 12, 90, "Open"), ...field("aClass", 9, 80, "A")]),
      45
    );
    const embed = championshipCuts.buildCutsEmbed(cut, { seasonName: "Season 12" });
    assert.equal(embed.fields.length, 2);
    assert.match(embed.fields[0].name, /Open Class \(8 advance\)/);
    assert.match(embed.fields[1].name, /A Class \(4 advance\)/);
    assert.match(embed.fields[0].value, /Open 1/);
    assert.ok(!embed.fields[0].value.includes("A 1"));
  });

  test("singular copy when exactly one corps misses", () => {
    const cut = championshipCuts.cutForDrop(recap(field("worldClass", 26)), 47);
    const embed = championshipCuts.buildCutsEmbed(cut, { seasonName: "S" });
    assert.match(embed.description, /1 corps misses the cut/);
  });

  test("no 'missed the cut' clause when nobody did", () => {
    const cut = championshipCuts.cutForDrop(recap(field("worldClass", 25)), 47);
    const embed = championshipCuts.buildCutsEmbed(cut, { seasonName: "S" });
    assert.equal(cut.missed, 0);
    assert.ok(!/miss/.test(embed.description));
  });

  test("null for a night with no cut", () => {
    assert.equal(championshipCuts.buildCutsEmbed(null, { seasonName: "S" }), null);
    assert.equal(championshipCuts.buildCutsPayload(null, { seasonName: "S" }), null);
  });

  test("the standalone payload sends no pings", () => {
    const cut = championshipCuts.cutForDrop(recap(field("worldClass", 30)), 47);
    const payload = championshipCuts.buildCutsPayload(cut, { seasonName: "S" });
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });

  test("a long advancing list stays inside Discord's field limit", () => {
    const results = field("worldClass", 30, 95, "A Corps With A Really Long Name Indeed");
    const cut = championshipCuts.cutForDrop(recap(results), 47);
    const embed = championshipCuts.buildCutsEmbed(cut, { seasonName: "S" });
    assert.ok(
      embed.fields[0].value.length <= 1024,
      `field value was ${embed.fields[0].value.length} chars`
    );
    assert.match(embed.fields[0].value, /and \d+ more$/);
  });
});
