// The World Championship rounds are one field: these pin the round table every
// surface reads (the sheet, the drop, the results page, the share card) and
// that the client twin (src/utils/worldChampionship.ts) says the same thing.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  WORLD_CHAMPIONSHIP_ROUNDS,
  WORLD_CHAMPIONSHIP_DAYS,
  WORLD_FIELD_KEY,
  worldChampionshipRound,
  isWorldChampionshipRound,
  worldChampionshipTitle,
} = require("./worldChampionship");

describe("worldChampionshipRound", () => {
  test("names the three World nights and nothing else", () => {
    assert.deepEqual(WORLD_CHAMPIONSHIP_DAYS, [47, 48, 49]);
    assert.equal(worldChampionshipRound(47).participants, "World Prelims Performers");
    assert.equal(worldChampionshipRound(48).participants, "World Semifinalists");
    assert.equal(worldChampionshipRound(49).participants, "World Finalists");
    assert.equal(worldChampionshipRound(49).winner, "World Champion");
    assert.equal(worldChampionshipRound(48).winner, null);
    // The Open & A nights are two separate competitions and stay split by class.
    assert.equal(worldChampionshipRound(45), null);
    assert.equal(worldChampionshipRound(46), null);
    assert.equal(worldChampionshipRound(20), null);
    assert.equal(worldChampionshipRound(null), null);
    assert.equal(worldChampionshipRound("48").day, 48);
  });

  test("an event name has to be the World Championship show", () => {
    assert.ok(isWorldChampionshipRound(47, "marching.art World Championship Prelims"));
    assert.ok(isWorldChampionshipRound(48, "World Championship Semifinals"));
    assert.ok(isWorldChampionshipRound(49, null));
    // A live season can land an unrelated show on day 47 — it keeps its classes.
    assert.equal(isWorldChampionshipRound(47, "Drums Along the Rockies"), false);
    assert.equal(isWorldChampionshipRound(49, "SoundSport International Music & Food Festival"), false);
  });

  test("the title a placement carries", () => {
    assert.equal(worldChampionshipTitle(49, 1), "World Champion");
    assert.equal(worldChampionshipTitle(49, 2), "World Finalist");
    assert.equal(worldChampionshipTitle(48, 1), "World Semifinalist");
    assert.equal(worldChampionshipTitle(47, 30), "World Prelims Performer");
    assert.equal(worldChampionshipTitle(46, 1), null);
  });

  test("the client twin carries the same rounds", () => {
    // src/utils/worldChampionship.ts is TypeScript, so read it as text and
    // check every string the server prints appears there verbatim.
    const twin = fs.readFileSync(
      path.join(__dirname, "../../../src/utils/worldChampionship.ts"),
      "utf8"
    );
    for (const round of Object.values(WORLD_CHAMPIONSHIP_ROUNDS)) {
      for (const value of [round.eventName, round.title, round.participants, round.participant]) {
        assert.ok(twin.includes(`'${value}'`), `client twin is missing '${value}'`);
      }
      if (round.winner) assert.ok(twin.includes(`'${round.winner}'`));
    }
    assert.ok(twin.includes(`'${WORLD_FIELD_KEY}'`));
  });
});
