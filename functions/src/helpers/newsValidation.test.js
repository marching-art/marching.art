// Tests for the AI-output JSON parsing and fact-check guard helpers.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  cleanJsonResponse,
  repairJson,
  parseAiJson,
  collectArticleText,
  detectBannedPhrases,
  extractDataBlockNumbers,
  detectHallucinatedCorps,
  detectUnsourcedNumbers,
} = require("./newsValidation");

describe("cleanJsonResponse", () => {
  test("strips ```json fences", () => {
    assert.equal(cleanJsonResponse('```json\n{"a":1}\n```'), '{"a":1}');
  });
  test("strips plain ``` fences", () => {
    assert.equal(cleanJsonResponse('```\n{"a":1}\n```'), '{"a":1}');
  });
  test("trims plain text unchanged", () => {
    assert.equal(cleanJsonResponse('  {"a":1}  '), '{"a":1}');
  });
});

describe("repairJson", () => {
  test("removes trailing commas before } and ]", () => {
    assert.equal(repairJson('{"a":1,}'), '{"a":1}');
    assert.equal(repairJson('[1,2,]'), '[1,2]');
  });
  test("escapes raw newlines inside strings", () => {
    const repaired = repairJson('{"a":"line1\nline2"}');
    assert.doesNotThrow(() => JSON.parse(repaired));
    assert.equal(JSON.parse(repaired).a, "line1\nline2");
  });
});

describe("parseAiJson", () => {
  test("parses clean JSON", () => {
    assert.deepEqual(parseAiJson('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] });
  });
  test("parses fenced JSON", () => {
    assert.deepEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
  });
  test("repairs a trailing comma", () => {
    assert.deepEqual(parseAiJson('{"a":1,}'), { a: 1 });
  });
  test("extracts a JSON object embedded in surrounding prose", () => {
    assert.deepEqual(parseAiJson('Here you go: {"a":1} thanks!'), { a: 1 });
  });
  test("throws on unrecoverable garbage", () => {
    assert.throws(() => parseAiJson("not json at all"));
  });
});

describe("collectArticleText", () => {
  test("joins the user-visible fields", () => {
    const text = collectArticleText({
      headline: "H",
      summary: "S",
      narrative: "N",
      captionInsights: { geInsight: "GE" },
      recommendations: [{ reasoning: "R" }],
    });
    for (const part of ["H", "S", "N", "GE", "R"]) assert.ok(text.includes(part));
  });
  test("returns empty string for non-objects", () => {
    assert.equal(collectArticleText(null), "");
    assert.equal(collectArticleText("x"), "");
  });
});

describe("detectBannedPhrases", () => {
  test("flags a banned cliché", () => {
    const hits = detectBannedPhrases({ summary: "This was a captivating performance." });
    assert.ok(hits.some((h) => /captivating/i.test(h)));
  });
  test("returns [] for clean copy", () => {
    assert.deepEqual(detectBannedPhrases({ summary: "Blue Devils scored 97.2." }), []);
  });
});

describe("extractDataBlockNumbers", () => {
  test("extracts decimals from the DATA block only", () => {
    const prompt = "intro 11.11\n===== DATA =====\n77.85 and 88.90\n===== END DATA =====\nafter 99.99";
    const nums = extractDataBlockNumbers(prompt);
    assert.ok(nums.has(77.85) && nums.has(88.9));
    assert.ok(!nums.has(11.11) && !nums.has(99.99));
  });
  test("returns null when there is no DATA block", () => {
    assert.equal(extractDataBlockNumbers("no markers 1.23"), null);
  });
});

describe("detectHallucinatedCorps", () => {
  test("flags a canon corps not in tonight's field", () => {
    const content = { narrative: "The Cavaliers dazzled the crowd." };
    const hits = detectHallucinatedCorps(content, ["Blue Devils"]);
    assert.deepEqual(hits, ["The Cavaliers"]);
  });
  test("does not flag corps that are in the field", () => {
    const content = { narrative: "Blue Devils dazzled." };
    assert.deepEqual(detectHallucinatedCorps(content, ["Blue Devils"]), []);
  });
  test("skips the check when no field list is provided", () => {
    assert.deepEqual(detectHallucinatedCorps({ narrative: "The Cavaliers" }, null), []);
  });
});

describe("detectUnsourcedNumbers", () => {
  test("flags numbers absent from the data set", () => {
    const content = { summary: "They scored 99.99 tonight." };
    const hits = detectUnsourcedNumbers(content, new Set([77.85]));
    assert.deepEqual(hits, ["99.99"]);
  });
  test("accepts numbers within rounding tolerance", () => {
    const content = { summary: "They scored 77.85 tonight." };
    assert.deepEqual(detectUnsourcedNumbers(content, new Set([77.85])), []);
  });
  test("skips the check when no data numbers are provided", () => {
    assert.deepEqual(detectUnsourcedNumbers({ summary: "12.34" }, null), []);
  });
});
