const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { championshipVenueFor, OPEN_A_VENUE, WORLD_VENUE } = require("./championshipVenues");

describe("championshipVenueFor", () => {
  test("World rounds and the SoundSport festival are always Indianapolis", () => {
    for (const name of [
      "marching.art World Championship Prelims",
      "marching.art World Championship Semifinals",
      "DCI World Championship Finals",
      "SoundSport International Music & Food Festival",
    ]) {
      // Even when the row copied an archive year's venue.
      assert.equal(championshipVenueFor({ type: "championship", name, location: "Madison, WI" }), WORLD_VENUE);
    }
  });
  test("Open & A Class rounds are always Marion", () => {
    assert.equal(championshipVenueFor({ mandatory: true, eventName: "Open and A Class Prelims" }), OPEN_A_VENUE);
    assert.equal(championshipVenueFor({ isChampionship: true, eventName: "Open & A Class Finals" }), OPEN_A_VENUE);
  });
  test("regular shows and unknown rounds keep their own venue", () => {
    assert.equal(championshipVenueFor({ type: "regular", name: "DCI World Championship Prelims" }), null);
    assert.equal(championshipVenueFor({ type: "championship", name: "Mystery Round" }), null);
    assert.equal(championshipVenueFor(null), null);
  });
});
