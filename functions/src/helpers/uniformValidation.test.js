// Unit tests for the Uniform Studio server-side design validation — the
// single gate every wardrobe write passes through. Uses node:test like the
// other functions suites.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateDesign,
  sanitizeDesign,
  deriveV1Compat,
  proseColorName,
  generateUniformCode,
  MAX_WARDROBE_DESIGNS,
  DESIGN_ID_RE,
  UNIFORM_CODE_RE,
} = require("./uniformValidation");

/** A minimal valid design (Classic Cadet reduced). */
function validDesign() {
  return {
    schema: 2,
    name: "Identity Uniform",
    colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
    figure: {
      skin: "#c9a074",
      jacket: "#6d1a26",
      chest: "braid",
      braid: "#efe9dc",
      metal: "#d9a41c",
      belt: "#d9a41c",
      pants: "#ece2cc",
      stripe: "#6d1a26",
      shoe: "#141414",
      spats: true,
      hatType: "shako",
      hat: { body: "#17171a", band: "#6d1a26" },
      plume: { type: "upright", color: "#f4f1ea" },
    },
  };
}

describe("validateDesign", () => {
  test("accepts a well-formed design", () => {
    assert.deepEqual(validateDesign(validDesign()), []);
  });

  test("accepts per-side configs, grads, and print references", () => {
    const d = validDesign();
    d.figure.grads = { ombre: [["0", "#16161a"], ["1", "#e8c25a"]] };
    d.figure.armL = { type: "bare" };
    d.figure.armR = { type: "sleeve", fill: "url:ombre", detached: true };
    d.figure.legL = { fill: "url:foil", foil: true };
    d.figure.legR = { color: "#17161c", tattered: true };
    d.figure.foilLeg = true;
    assert.deepEqual(validateDesign(d), []);
  });

  test("rejects non-hex colors and script-ish values", () => {
    const d = validDesign();
    d.figure.jacket = "javascript:alert(1)";
    assert.match(validateDesign(d).join(";"), /figure\.jacket/);

    const d2 = validDesign();
    d2.colorway.primary = "crimson";
    assert.match(validateDesign(d2).join(";"), /colorway/);
  });

  test("rejects unknown figure fields (whitelist)", () => {
    const d = validDesign();
    d.figure.__proto__pollution = true;
    d.figure.customHtml = "<img src=x>";
    const errors = validateDesign(d);
    assert.ok(errors.some((e) => e.includes("not a recognized field")));
  });

  test("rejects gradient references that were never declared", () => {
    const d = validDesign();
    d.figure.torsoFill = "url:notdeclared";
    assert.match(validateDesign(d).join(";"), /torsoFill/);
  });

  test("accepts hat emblem color, ornaments, and the aussie hat", () => {
    const d = validDesign();
    d.figure.hatType = "aussie";
    d.figure.hat = { body: "#17171a", band: "#8a1a1a", emblem: "#e01010", ornament: "star" };
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.hat = { body: "#17171a", emblem: "javascript:x" };
    assert.match(validateDesign(d2).join(";"), /figure\.hat/);

    const d3 = validDesign();
    d3.figure.hat = { body: "#17171a", ornament: "fleur" };
    assert.match(validateDesign(d3).join(";"), /figure\.hat/);
  });

  test("accepts the chest direction flag, two-tone baldric, and chest fade", () => {
    const d = validDesign();
    d.figure.chest = "baldric";
    d.figure.baldric = "#8a1a1a";
    d.figure.baldricCenter = "#101014";
    d.figure.chestReverse = true;
    d.figure.chestFade = ["#8a1a1a", "#101014"];
    d.figure.buttonColor = "#c0c0c0";
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.chestReverse = "yes";
    assert.match(validateDesign(d2).join(";"), /chestReverse/);

    const d3 = validDesign();
    d3.figure.chestFade = ["#8a1a1a"];
    assert.match(validateDesign(d3).join(";"), /chestFade/);
  });

  test("accepts printColors overrides for every procedural surface", () => {
    const d = validDesign();
    d.figure.printColors = {
      sunburst: ["#112233", "#445566", "#778899"],
      opart: ["#204020", "#80c080", "#103010"],
      pinstripe: ["#101018", "#c0c0d0"],
      plaid: ["#222a44", "#4a5a8a", "#c8d0e8"],
      foil: ["#8a2a3a", "#f0c0c8"],
      opart2: null, // wrong key below exercises the reject path separately
    };
    delete d.figure.printColors.opart2;
    assert.deepEqual(validateDesign(d), []);
    // null clears an override
    d.figure.printColors = { plaid: null };
    assert.deepEqual(validateDesign(d), []);
  });

  test("rejects malformed printColors (bad key, wrong length, junk colors)", () => {
    const d = validDesign();
    d.figure.printColors = { paisley: ["#112233"] };
    assert.match(validateDesign(d).join(";"), /printColors\.paisley/);

    const d2 = validDesign();
    d2.figure.printColors = { pinstripe: ["#112233"] }; // needs 2
    assert.match(validateDesign(d2).join(";"), /printColors\.pinstripe/);

    const d3 = validDesign();
    d3.figure.printColors = { sunburst: ["#112233", "javascript:x", "#778899"] };
    assert.match(validateDesign(d3).join(";"), /printColors\.sunburst/);

    const d4 = validDesign();
    d4.figure.printColors = ["#112233"];
    assert.match(validateDesign(d4).join(";"), /printColors must be an object/);
  });

  test("bounds the name and total payload size", () => {
    const d = validDesign();
    d.name = "x".repeat(61);
    assert.match(validateDesign(d).join(";"), /name/);

    const d2 = validDesign();
    d2.aiHints = { additionalNotes: "y".repeat(301) };
    assert.match(validateDesign(d2).join(";"), /additionalNotes/);

    const d3 = validDesign();
    d3.figure.grads = { big: [["0", "#111111"], ["1", "#222222"]] };
    // inflate via many gradient entries beyond the cap
    d3.figure.grads = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`g${i}`, [["0", "#111111"], ["1", "#222222"]]])
    );
    assert.match(validateDesign(d3).join(";"), /at most 4/);
  });

  test("rejects malformed containers outright", () => {
    assert.notDeepEqual(validateDesign(null), []);
    assert.notDeepEqual(validateDesign([]), []);
    assert.notDeepEqual(validateDesign({ schema: 1 }), []);
  });
});

describe("sanitizeDesign", () => {
  test("strips unknown keys and deep-copies", () => {
    const d = validDesign();
    d.extraTopLevel = "strip me";
    d.figure.rogue = "strip me too";
    // sanitize is called after validation in the callable; here we exercise
    // the stripping contract directly
    const clean = sanitizeDesign(d);
    assert.equal(clean.extraTopLevel, undefined);
    assert.equal(clean.figure.rogue, undefined);
    assert.equal(clean.figure.jacket, "#6d1a26");
    clean.figure.hat.body = "#000000";
    assert.equal(d.figure.hat.body, "#17171a"); // deep copy, no aliasing
  });

  test("keeps printColors through sanitize", () => {
    const d = validDesign();
    d.figure.printColors = { plaid: ["#222a44", "#4a5a8a", "#c8d0e8"] };
    const clean = sanitizeDesign(d);
    assert.deepEqual(clean.figure.printColors.plaid, ["#222a44", "#4a5a8a", "#c8d0e8"]);
  });

  test("keeps aiHints only when present", () => {
    const clean = sanitizeDesign(validDesign());
    assert.equal(clean.aiHints, undefined);
    const withHints = { ...validDesign(), aiHints: { mascotOrEmblem: "phoenix" } };
    assert.equal(sanitizeDesign(withHints).aiHints.mascotOrEmblem, "phoenix");
  });
});

describe("deriveV1Compat", () => {
  test("maps a classic design to traditional prose the AI pipeline can read", () => {
    const v1 = deriveV1Compat(sanitizeDesign(validDesign()), null);
    assert.equal(v1.style, "traditional");
    assert.equal(v1.helmetStyle, "shako");
    assert.equal(v1.primaryColor, "maroon");
    assert.match(v1.plumeDescription, /upright plume/);
  });

  test("preserves existing avatar preferences on merge", () => {
    const existing = { avatarStyle: "performer", avatarSection: "drumline" };
    const v1 = deriveV1Compat(sanitizeDesign(validDesign()), existing);
    assert.equal(v1.avatarStyle, "performer");
    assert.equal(v1.avatarSection, "drumline");
  });

  test("classifies modern designs and bare heads", () => {
    const d = validDesign();
    d.figure.hatType = null;
    d.figure.hat = null;
    d.figure.plume = null;
    d.figure.streamers = ["#2b3fbf", "#5fd0e8"];
    const v1 = deriveV1Compat(sanitizeDesign(d), null);
    assert.equal(v1.helmetStyle, "none");
    assert.equal(v1.style, "theatrical");
    assert.equal(v1.plumeDescription, "");
  });

  test("proseColorName picks sensible nearest names", () => {
    assert.equal(proseColorName("#6d1a26"), "maroon");
    assert.equal(proseColorName("#f7f5f0"), "arctic white");
    assert.equal(proseColorName("not-a-color"), "blue");
  });
});

describe("constants", () => {
  test("uniform codes: format, charset, and determinism under an injected rng", () => {
    // deterministic rng → deterministic code
    let i = 0;
    const seq = [0, 0.1, 0.5, 0.9, 0.3, 0.7];
    const code = generateUniformCode(() => seq[i++ % seq.length]);
    assert.match(code, UNIFORM_CODE_RE);
    assert.equal(code, generateUniformCode(((i = 0), () => seq[i++ % seq.length])));
    // random codes always match the shape and never use ambiguous glyphs
    for (let n = 0; n < 200; n++) {
      const c = generateUniformCode();
      assert.match(c, UNIFORM_CODE_RE);
      assert.doesNotMatch(c.slice(3), /[01OIL]/);
    }
    assert.ok(!UNIFORM_CODE_RE.test("MA-0OIL-1I")); // ambiguous glyphs rejected
    assert.ok(!UNIFORM_CODE_RE.test("ma-abcd-ef")); // lowercase rejected
  });

  test("wardrobe cap and id shape are what the client expects", () => {
    assert.equal(MAX_WARDROBE_DESIGNS, 24);
    assert.ok(DESIGN_ID_RE.test("abc123-XYZ_9"));
    assert.ok(!DESIGN_ID_RE.test("../evil"));
    assert.ok(!DESIGN_ID_RE.test(""));
  });
});
