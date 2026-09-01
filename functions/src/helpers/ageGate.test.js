const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { MIN_AGE_YEARS, parseBirthDate, ageInYears, checkBirthDate } = require("./ageGate");

const NOW = new Date("2026-09-01T12:00:00Z");

describe("ageGate", () => {
  test("parses only real YYYY-MM-DD dates in the past", () => {
    assert.ok(parseBirthDate("2010-02-28", NOW));
    assert.equal(parseBirthDate("2010-02-30", NOW), null);
    assert.equal(parseBirthDate("2027-01-01", NOW), null);
    assert.equal(parseBirthDate("1800-01-01", NOW), null);
    assert.equal(parseBirthDate("02/28/2010", NOW), null);
    assert.equal(parseBirthDate(2010, NOW), null);
    assert.equal(parseBirthDate(null, NOW), null);
  });

  test("counts whole years, birthday-aware", () => {
    assert.equal(ageInYears(new Date("2013-09-01T00:00:00Z"), NOW), 13);
    assert.equal(ageInYears(new Date("2013-09-02T00:00:00Z"), NOW), 12);
    assert.equal(ageInYears(new Date("2013-08-31T00:00:00Z"), NOW), 13);
  });

  test("checkBirthDate: exactly 13 today passes, a day younger fails, garbage is invalid", () => {
    assert.equal(MIN_AGE_YEARS, 13);
    assert.deepEqual(checkBirthDate("2013-09-01", NOW), { ok: true, birthDate: "2013-09-01", age: 13 });
    assert.deepEqual(checkBirthDate("2013-09-02", NOW), { ok: false, reason: "underage" });
    assert.deepEqual(checkBirthDate("not-a-date", NOW), { ok: false, reason: "invalid" });
  });
});
