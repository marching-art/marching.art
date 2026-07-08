// Tests for the DCI archive.org show-name importer: city normalization, the
// CFM dropdown label parser, and the exact + ±1-day rename matcher. No network
// or Firestore — pure functions against inline fixtures.
//
// Run with `npm test` (from functions/) or `node --test dciArchiveImporter.test.js`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCity, cityFromLocation, matchKey, matchKeyForEvent,
  expandCityDisplay, canonicalCity, canonicalLocation,
} = require("./config");
const { parseLabel, parseCfmDropdown, parseShowmonth, buildLocation } = require("./parse");
const { buildIndex, planRenames } = require("./apply");

describe("normalizeCity", () => {
  test("expands Saint/Fort/Port and compass abbreviations", () => {
    assert.equal(normalizeCity("St. Peter"), "saint peter");
    assert.equal(normalizeCity("Ft. Wayne"), "fort wayne");
    assert.equal(normalizeCity("Pt Huron"), "port huron");
    assert.equal(normalizeCity("E Rutherford"), "east rutherford");
    assert.equal(normalizeCity("Pt. Huron"), normalizeCity("Port Huron"));
    assert.equal(normalizeCity("E Rutherford"), normalizeCity("East Rutherford"));
  });
  test("strips punctuation, doubleheader qualifiers, and case", () => {
    assert.equal(normalizeCity("Indianapolis II"), "indianapolis");
    assert.equal(normalizeCity("DeKalb"), "dekalb");
  });
});

describe("cityFromLocation + matchKey", () => {
  test("pressbox 'City, FullState' -> normalized city key", () => {
    assert.equal(cityFromLocation("Menasha, Wisconsin"), "menasha");
  });
  test("matchKeyForEvent pads and combines date + city", () => {
    const key = matchKeyForEvent({ date: "2004-06-18T00:00:00.000Z", location: "Menasha, Wisconsin" });
    assert.equal(key, matchKey(2004, 6, 18, "menasha"));
    assert.equal(key, "2004-06-18|menasha");
  });
});

describe("parseLabel", () => {
  test("splits date, division, show name, and trailing City, ST", () => {
    const r = parseLabel("7/28/04 - (DCI) SUMMER MUSIC GAMES in Cincinnati, Fairfield, OH", 2004);
    assert.deepEqual(r, {
      month: 7, day: 28, year: 2004, division: "DCI",
      showName: "SUMMER MUSIC GAMES in Cincinnati", city: "Fairfield", state: "OH",
    });
  });
  test("location-only rows yield a city but no show name", () => {
    const r = parseLabel("8/01/04 - (Div II & III) Pueblo, CO", 2004);
    assert.equal(r.city, "Pueblo");
    assert.equal(r.showName, "");
  });
  test("rejects rows whose year != the snapshot's season", () => {
    assert.equal(parseLabel("7/28/03 - (DCI) X, Y, OH", 2004), null);
  });
  test("format B (2007+): 'City, ST (Show) - M/D/YY'", () => {
    const r = parseLabel("Pasadena, CA (DCI World Championships Finals) - 8/11/07", 2007);
    assert.equal(r.showName, "DCI World Championships Finals");
    assert.equal(r.city, "Pasadena");
    assert.equal(r.state, "CA");
    assert.equal(r.month, 8);
  });
  test("format C (2000-2003): '(CLASS) Show, City, ST -- Month DD, YYYY'", () => {
    const r = parseLabel("(DCI) Eastern Classic, Philadelphia, PA -- August 4, 2001", 2001);
    assert.equal(r.division, "DCI");
    assert.equal(r.showName, "Eastern Classic");
    assert.equal(r.city, "Philadelphia");
    assert.equal(r.state, "PA");
    assert.deepEqual([r.month, r.day, r.year], [8, 4, 2001]);
  });
  test("format C handles Ontario (3-letter) and hyphenated show names", () => {
    const r = parseLabel("(DCI Division II & III) Coast Guard Open - Prelims, Grand Haven, MI -- August 3, 2001", 2001);
    assert.equal(r.showName, "Coast Guard Open - Prelims");
    assert.equal(r.city, "Grand Haven");
  });
});

describe("parseShowmonth", () => {
  const page = `
    <a href="recap.php?xId=230">Contest Recap&gt;&gt;</a>
    <a href="/scores/results.php?xId=230">(DCI) World Championships Finals, Madison, WI --  August 10, 2002</a>
    <a href="/scores/results.php?xId=227">(DCI) Eastern Classic, Philadelphia, PA --  August 3, 2002</a>`;
  // Same event id appears again on an overlapping month page -> deduped once.
  const overlap = `<a href="/scores/results.php?xId=227">(DCI) Eastern Classic, Philadelphia, PA --  August 3, 2002</a>`;
  const records = parseShowmonth([page, overlap], 2002);

  test("parses results.php links, ignores recap links, dedups by xId", () => {
    assert.equal(records.length, 2);
    const finals = records.find((r) => r.eventId === "230");
    assert.equal(finals.showName, "World Championships Finals");
    assert.equal(finals.location, "Madison, Wisconsin");
    assert.equal(finals.key, "2002-08-10|madison");
  });
});

describe("parseCfmDropdown", () => {
  const html = `
    <select name="listboxmenu">
      <option value="/scores/?event_id=aaa">6/18/04 - (DCI Central) Flag Day Fiesta, Menasha, WI</option>
      <option value="/scores/?event_id=bbb">8/06/04 - (DCI) DCI World Championships, Denver, CO</option>
      <option value="/scores/?event_id=ccc">8/01/04 - (Div II &amp; III) Pueblo, CO</option>
    </select>`;
  const records = parseCfmDropdown(html, 2004);

  test("parses one record per titled option with the right key + location", () => {
    const fiesta = records.find((r) => r.key === "2004-06-18|menasha");
    assert.ok(fiesta);
    assert.equal(fiesta.showName, "Flag Day Fiesta");
    assert.equal(fiesta.location, "Menasha, Wisconsin");
    assert.equal(fiesta.eventId, "aaa");
  });
  test("decodes entities and keeps location-only rows with null showName", () => {
    const pueblo = records.find((r) => r.key === "2004-08-01|pueblo");
    assert.equal(pueblo.showName, null);
  });
});

describe("buildLocation", () => {
  test("abbreviation -> full state matching pressbox convention", () => {
    assert.equal(buildLocation("Denver", "CO"), "Denver, Colorado");
  });
});

describe("expandCityDisplay / canonicalCity / canonicalLocation", () => {
  test("expands unambiguous abbreviations, preserves other casing", () => {
    assert.equal(expandCityDisplay("E Rutherford"), "East Rutherford");
    assert.equal(expandCityDisplay("St. Peter"), "Saint Peter");
    assert.equal(expandCityDisplay("Ft. Wayne"), "Fort Wayne");
    assert.equal(expandCityDisplay("DeKalb"), "DeKalb");
  });
  test("does NOT guess the ambiguous Pt (Port vs Point)", () => {
    assert.equal(expandCityDisplay("Pt Huron"), "Pt Huron");
  });
  test("canonicalCity keeps the more complete spelling", () => {
    assert.equal(canonicalCity("Port Huron", "Pt Huron"), "Port Huron");
    assert.equal(canonicalCity("Pt Huron", "Port Huron"), "Port Huron");
    assert.equal(canonicalCity("E Rutherford", "E Rutherford"), "East Rutherford");
  });
  test("canonicalLocation rebuilds only when the city actually changes", () => {
    assert.equal(canonicalLocation("E Rutherford, New Jersey", "E Rutherford"),
      "East Rutherford, New Jersey");
    assert.equal(canonicalLocation("Port Huron, Michigan", "Pt Huron"), null);
  });
});

describe("planRenames", () => {
  const records = [
    { key: "2004-06-18|menasha", date: "2004-06-18T00:00:00.000Z", showName: "Flag Day Fiesta", city: "Menasha" },
    { key: "2004-06-27|lima", date: "2004-06-27T00:00:00.000Z", showName: "Summer Serenade", city: "Lima" },
    { key: "2004-08-06|denver", date: "2004-08-06T00:00:00.000Z", showName: "DCI World Championships", city: "Denver" },
    { key: "2004-07-22|east rutherford", date: "2004-07-22T00:00:00.000Z", showName: "Big Apple", city: "E Rutherford" },
    { key: "2004-07-10|kalamazoo", date: "2004-07-10T00:00:00.000Z", showName: "Central Division", city: "Kalamazoo", ignoredDivision: true },
  ];
  const index = buildIndex(records);

  test("exact match renames a placeholder", () => {
    const events = [{ eventName: "DCI Competition - Menasha, Wisconsin", date: "2004-06-18T00:00:00.000Z", location: "Menasha, Wisconsin" }];
    const { renames } = planRenames(events, index);
    assert.equal(renames.length, 1);
    assert.equal(renames[0].to, "Flag Day Fiesta");
    assert.equal(renames[0].via, "exact");
  });

  test("±1-day fallback recovers an off-by-one date", () => {
    const events = [{ eventName: "DCI Competition - Lima, Ohio", date: "2004-06-28T00:00:00.000Z", location: "Lima, Ohio" }];
    const { renames } = planRenames(events, index);
    assert.equal(renames.length, 1);
    assert.equal(renames[0].to, "Summer Serenade");
    assert.equal(renames[0].via, "±1day");
  });

  test("already-titled events are never touched", () => {
    const events = [{ eventName: "DCI World Championships", date: "2004-08-06T00:00:00.000Z", location: "Denver, Colorado" }];
    const { renames } = planRenames(events, index);
    assert.equal(renames.length, 0);
  });

  test("ignored-division archive names are excluded from the index", () => {
    const events = [{ eventName: "DCI Competition - Kalamazoo, Michigan", date: "2004-07-10T00:00:00.000Z", location: "Kalamazoo, Michigan" }];
    const { renames, unmatched } = planRenames(events, index);
    assert.equal(renames.length, 0);
    assert.equal(unmatched.length, 1);
  });

  test("unmatched placeholder with no archive counterpart stays unmatched", () => {
    const events = [{ eventName: "DCI Competition - Nowhere, Kansas", date: "2004-07-01T00:00:00.000Z", location: "Nowhere, Kansas" }];
    const { renames, unmatched } = planRenames(events, index);
    assert.equal(renames.length, 0);
    assert.equal(unmatched.length, 1);
  });

  test("completes an abbreviated city on a matched event via compass expansion", () => {
    const events = [{ eventName: "DCI Competition - E Rutherford, New Jersey", date: "2004-07-22T00:00:00.000Z", location: "E Rutherford, New Jersey" }];
    const { renames, locationFixes } = planRenames(events, index);
    assert.equal(renames.length, 1); // placeholder also renamed to "Big Apple"
    assert.equal(locationFixes.length, 1);
    assert.equal(locationFixes[0].to, "East Rutherford, New Jersey");
  });

  test("no location fix when the city is already complete", () => {
    const events = [{ eventName: "Flag Day Fiesta", date: "2004-06-18T00:00:00.000Z", location: "Menasha, Wisconsin" }];
    const { locationFixes } = planRenames(events, index);
    assert.equal(locationFixes.length, 0);
  });
});
