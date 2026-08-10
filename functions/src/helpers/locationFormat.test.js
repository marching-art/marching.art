// Unit tests for standardizeLocation in locationFormat.js.
// Uses Node's built-in test runner (node:test). Run with `npm test` in functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { standardizeLocation } = require("./locationFormat");

describe("standardizeLocation", () => {
  test("folds a full US state name to its two-letter code", () => {
    assert.equal(standardizeLocation("Rockford, Illinois"), "Rockford, IL");
    assert.equal(standardizeLocation("Dallas, Texas"), "Dallas, TX");
    assert.equal(standardizeLocation("Atlanta, Georgia"), "Atlanta, GA");
    assert.equal(standardizeLocation("Allentown, Pennsylvania"), "Allentown, PA");
  });

  test("collapses the two spellings of one venue to a single string (the de-dup fix)", () => {
    assert.equal(
      standardizeLocation("Rockford, Illinois"),
      standardizeLocation("Rockford, IL")
    );
  });

  test("leaves an already-abbreviated location unchanged (idempotent)", () => {
    assert.equal(standardizeLocation("Marion, IN"), "Marion, IN");
    assert.equal(standardizeLocation("Indianapolis, IN"), "Indianapolis, IN");
    const once = standardizeLocation("Rockford, Illinois");
    assert.equal(standardizeLocation(once), once);
  });

  test("upper-cases a lower/mixed-case code", () => {
    assert.equal(standardizeLocation("Marion, in"), "Marion, IN");
    assert.equal(standardizeLocation("Marion, In"), "Marion, IN");
  });

  test("handles a period used instead of a comma (historical archive dirt)", () => {
    assert.equal(standardizeLocation("Allentown. Pennsylvania"), "Allentown, PA");
    assert.equal(standardizeLocation("Bloomington-Normal. Illinois"), "Bloomington-Normal, IL");
  });

  test("handles a comma-less 'City StateName' form", () => {
    assert.equal(standardizeLocation("Rockford Illinois"), "Rockford, IL");
  });

  test("handles multi-word state names", () => {
    assert.equal(standardizeLocation("Fort Mill, South Carolina"), "Fort Mill, SC");
    assert.equal(standardizeLocation("Brick, New Jersey"), "Brick, NJ");
    assert.equal(standardizeLocation("Washington, District of Columbia"), "Washington, DC");
  });

  test("preserves multi-word city names", () => {
    assert.equal(standardizeLocation("San Diego, California"), "San Diego, CA");
    assert.equal(standardizeLocation("Michigan City, Indiana"), "Michigan City, IN");
  });

  test("handles dirty multi-comma region ('City, Rhode, Island')", () => {
    assert.equal(standardizeLocation("Bristol, Rhode, Island"), "Bristol, RI");
  });

  test("folds Canadian province names", () => {
    assert.equal(standardizeLocation("Montreal, Quebec"), "Montreal, QC");
    assert.equal(standardizeLocation("Toronto, Ontario"), "Toronto, ON");
  });

  test("returns the input unchanged when the region is unrecognized", () => {
    assert.equal(standardizeLocation("Somewhere, Freedonia"), "Somewhere, Freedonia");
    assert.equal(standardizeLocation("Just A City"), "Just A City");
  });

  test("handles empty / nullish input without throwing", () => {
    assert.equal(standardizeLocation(""), "");
    assert.equal(standardizeLocation("   "), "");
    assert.equal(standardizeLocation(null), null);
    assert.equal(standardizeLocation(undefined), undefined);
  });

  test("trims surrounding whitespace", () => {
    assert.equal(standardizeLocation("  Rockford, Illinois  "), "Rockford, IL");
  });
});
