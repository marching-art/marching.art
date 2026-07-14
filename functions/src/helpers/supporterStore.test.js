// Tests for the pure bits of the supporter store (the one-time duration math).
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { oneTimeDaysForAmount, ONE_TIME_DAYS_PER_DOLLAR } = require("./supporterStore");

describe("oneTimeDaysForAmount", () => {
  test("scales at the per-dollar rate", () => {
    assert.equal(oneTimeDaysForAmount(5), 5 * ONE_TIME_DAYS_PER_DOLLAR);
    assert.equal(oneTimeDaysForAmount(3), 3 * ONE_TIME_DAYS_PER_DOLLAR);
  });

  test("enforces a minimum of one week", () => {
    assert.equal(oneTimeDaysForAmount(0.5), 7);
    assert.equal(oneTimeDaysForAmount(0), 7);
    assert.equal(oneTimeDaysForAmount("junk"), 7);
  });

  test("caps at one year", () => {
    assert.equal(oneTimeDaysForAmount(1000), 365);
  });

  test("keeps recurring the better deal: $3 one-time < a $3 renewing month", () => {
    // 21 days of the lesser generic badge vs. 30 renewing days of Rookie.
    assert.ok(oneTimeDaysForAmount(3) < 30);
  });
});
