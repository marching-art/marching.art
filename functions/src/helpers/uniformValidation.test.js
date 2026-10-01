// Unit tests for the Uniform Studio server-side design validation — the
// single gate every wardrobe write passes through. Uses node:test like the
// other functions suites.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateDesign,
  sanitizeDesign,
  proseColorName,
  generateUniformCode,
  MAX_WARDROBE_DESIGNS,
  DESIGN_ID_RE,
  UNIFORM_CODE_RE,
  colorwayStrip,
} = require("./uniformValidation");

/**
 * True if `value` contains an array nested directly inside another array — the
 * exact shape Firestore refuses to store ("Cannot convert an array value in an
 * array value"). Walks plain objects and arrays.
 * @param {unknown} value
 * @param {boolean} [insideArray] - true when `value` is itself an array element
 */
function hasNestedArray(value, insideArray = false) {
  if (Array.isArray(value)) {
    if (insideArray) return true;
    return value.some((el) => hasNestedArray(el, true));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => hasNestedArray(v, false));
  }
  return false;
}

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
    d.figure.grads = { ombre: [{ o: "0", c: "#16161a" }, { o: "1", c: "#e8c25a" }] };
    d.figure.armL = { type: "bare" };
    d.figure.armR = { type: "sleeve", fill: "url:ombre", detached: true };
    d.figure.legL = { fill: "url:foil", foil: true };
    d.figure.legR = { color: "#17161c", tattered: true };
    d.figure.foilLeg = true;
    assert.deepEqual(validateDesign(d), []);
  });

  test("accepts legacy [offset, hex] tuple stops for co-deploy tolerance", () => {
    const d = validDesign();
    d.figure.grads = { ombre: [["0", "#16161a"], ["1", "#e8c25a"]] };
    d.figure.armR = { type: "sleeve", fill: "url:ombre" };
    assert.deepEqual(validateDesign(d), []);
  });

  test("rejects malformed gradient stops", () => {
    const d = validDesign();
    d.figure.grads = { ombre: [{ o: "0", c: "not-a-hex" }, { o: "1", c: "#e8c25a" }] };
    assert.match(validateDesign(d).join(";"), /grads\.ombre/);

    const d2 = validDesign();
    d2.figure.grads = { ombre: [{ c: "#16161a" }, { o: "1", c: "#e8c25a" }] };
    assert.match(validateDesign(d2).join(";"), /grads\.ombre/);
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

  test("accepts the contour hat and the swash part/sequin/leg-color fields", () => {
    const d = validDesign();
    d.figure.hatType = "contour";
    d.figure.hat = { body: "#f4f2ec", band: "#101014", ornament: "none" };
    d.figure.chest = "swash";
    d.figure.swash = "#f4f2ec";
    d.figure.swashSequin = false;
    d.figure.swashTop = true;
    d.figure.swashBottom = false;
    d.figure.swashLegColor = "#e01010";
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.swashLegColor = "not-a-color";
    assert.match(validateDesign(d2).join(";"), /swashLegColor/);

    const d3 = validDesign();
    d3.figure.plume = { type: "upright", color: "#f7f5f0", accent: "#2f6fd0" };
    assert.deepEqual(validateDesign(d3), []);
    d3.figure.plume.accent = "blue";
    assert.match(validateDesign(d3).join(";"), /figure\.plume/);
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

    const d4 = validDesign();
    d4.figure.hat = { body: "#17171a", flip: true };
    d4.figure.plume = { type: "sideFeather", color: "#f4f2ec", accent: "#b3121c" };
    assert.deepEqual(validateDesign(d4), []);
    d4.figure.hat.flip = "yes";
    assert.match(validateDesign(d4).join(";"), /figure\.hat/);
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

  test("accepts the chest badge, its flip, and the band shapes", () => {
    const d = validDesign();
    d.figure.chestBadge = { shape: "rect", color: "#8a1a1a", accent: "#101014", flip: true };
    d.figure.chest = "baldric";
    d.figure.baldric = "#17171a";
    d.figure.chestShape = "triangles";
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.chestShape = "zigzag";
    assert.match(validateDesign(d2).join(";"), /chestShape/);

    const d3 = validDesign();
    d3.figure.chestBadge = { shape: "fleur", color: "#8a1a1a" };
    assert.match(validateDesign(d3).join(";"), /chestBadge/);

    const d4 = validDesign();
    d4.figure.chestBadge = { shape: "star", color: "#8a1a1a", onclick: "x()" };
    assert.match(validateDesign(d4).join(";"), /chestBadge/);

    const d5 = validDesign();
    d5.figure.chestBadge = { shape: "star", color: "#8a1a1a", flip: "yes" };
    assert.match(validateDesign(d5).join(";"), /chestBadge/);

    // 'rect' also joined the hat-ornament enum
    const d6 = validDesign();
    d6.figure.hat = { body: "#17171a", ornament: "rect" };
    assert.deepEqual(validateDesign(d6), []);
  });

  test("accepts the guard dress torso style and rejects unknown styles", () => {
    const d = validDesign();
    d.figure.torsoStyle = "dress";
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.torsoStyle = "toga";
    assert.match(validateDesign(d2).join(";"), /torsoStyle/);
  });

  test("accepts sleeve sequins and rejects non-boolean values", () => {
    const d = validDesign();
    d.figure.armL = { type: "sleeve", sequin: true };
    d.figure.armR = { type: "half", sequin: false };
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.armL = { type: "sleeve", sequin: "yes" };
    assert.match(validateDesign(d2).join(";"), /armL\.sequin is invalid/);
  });

  test("accepts the long coat and the Plumassier plume types", () => {
    const d = validDesign();
    d.figure.torsoStyle = "longcoat";
    d.figure.plume = { type: "fan", color: "#b3121c", accent: "#d9a41c" };
    assert.deepEqual(validateDesign(d), []);

    d.figure.plume = { type: "cascade", color: "#f4f1ea" };
    assert.deepEqual(validateDesign(d), []);

    const d2 = validDesign();
    d2.figure.plume = { type: "peacock", color: "#f4f1ea" };
    assert.match(validateDesign(d2).join(";"), /figure\.plume/);
  });

  test("accepts the design-house pieces: busby, cape, iridescent, lamé", () => {
    const d = validDesign();
    d.figure.hatType = "busby";
    d.figure.hat = { body: "#17171a", band: "#8a1a1a", ornament: "none" };
    d.figure.iridescent = true;
    d.figure.lame = true;
    d.figure.cape = { color: "#22355c", lining: "#d9a41c", side: "right" };
    assert.deepEqual(validateDesign(d), []);

    // drum-major regalia: the aiguillette is a plain hex channel
    const dm = validDesign();
    dm.figure.aiguillette = "#d9a41c";
    assert.deepEqual(validateDesign(dm), []);
    dm.figure.aiguillette = "gold braid";
    assert.match(validateDesign(dm).join(";"), /aiguillette/);

    // cape needs only its color; side defaults to left
    const d2 = validDesign();
    d2.figure.cape = { color: "#22355c" };
    assert.deepEqual(validateDesign(d2), []);
  });

  test("rejects malformed capes and non-boolean finishes", () => {
    const d = validDesign();
    d.figure.cape = { color: "navy" };
    assert.match(validateDesign(d).join(";"), /figure\.cape/);

    const d2 = validDesign();
    d2.figure.cape = { color: "#22355c", side: "back" };
    assert.match(validateDesign(d2).join(";"), /figure\.cape/);

    const d3 = validDesign();
    d3.figure.cape = { color: "#22355c", onclick: "x()" };
    assert.match(validateDesign(d3).join(";"), /figure\.cape/);

    const d4 = validDesign();
    d4.figure.cape = "#22355c";
    assert.match(validateDesign(d4).join(";"), /figure\.cape/);

    const d5 = validDesign();
    d5.figure.iridescent = "yes";
    assert.match(validateDesign(d5).join(";"), /iridescent/);

    const d6 = validDesign();
    d6.figure.lame = 1;
    assert.match(validateDesign(d6).join(";"), /lame/);
  });

  test("colorwayStrip emits a validated hex triple or null", () => {
    assert.deepEqual(colorwayStrip({ primary: "#6D1A26", secondary: "#d9a41c", accent: "#ece2cc" }), [
      "#6d1a26",
      "#d9a41c",
      "#ece2cc",
    ]);
    assert.equal(colorwayStrip(null), null);
    assert.equal(colorwayStrip("maroon"), null);
    assert.equal(colorwayStrip({ primary: "#6d1a26", secondary: "gold", accent: "#ece2cc" }), null);
    assert.equal(colorwayStrip({ primary: "#6d1a26", secondary: "#d9a41c" }), null);
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
    // inflate via many gradient entries beyond the cap
    d3.figure.grads = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [
        `g${i}`,
        [{ o: "0", c: "#111111" }, { o: "1", c: "#222222" }],
      ])
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

  test("stores gradient stops as objects, never Firestore-illegal nested arrays", () => {
    // Regression: Firestore rejects an array nested directly inside another
    // array, so a design with tuple stops threw a bare 500 on save. Stops must
    // come out of sanitize as { o, c } objects — and NOTHING in the sanitized
    // design may be an array whose elements are themselves arrays.
    const d = validDesign();
    d.figure.grads = {
      ombre: [
        { o: "0", c: "#16161a" },
        { o: "1", c: "#e8c25a" },
      ],
    };
    const clean = sanitizeDesign(d);
    assert.deepEqual(clean.figure.grads.ombre, [
      { o: "0", c: "#16161a" },
      { o: "1", c: "#e8c25a" },
    ]);
    assert.ok(!hasNestedArray(clean), "sanitized design must not nest an array inside an array");
  });

  test("normalizes legacy tuple stops to objects on sanitize", () => {
    const d = validDesign();
    d.figure.grads = { ombre: [["0", "#16161a"], ["1", "#e8c25a"]] };
    const clean = sanitizeDesign(d);
    assert.deepEqual(clean.figure.grads.ombre, [
      { o: "0", c: "#16161a" },
      { o: "1", c: "#e8c25a" },
    ]);
    assert.ok(!hasNestedArray(clean));
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

describe("proseColorName", () => {
  test("picks sensible nearest names", () => {
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

describe("Prism Forge fields", () => {
  const pair = ["#7cc4ff", "#f2c14e"];
  function lightCut() {
    const d = validDesign();
    Object.assign(d.figure, {
      torsoFill: "url:shatter",
      shatter: true,
      printColors: { shatter: ["#16181d", "#aeb6c2"] },
      torsoSplit: { color: "#c3c9d1", fill: null, flip: true },
      chest: "streak",
      streak: "#7cc4ff",
      streakCore: "#ffffff",
      chestFade: pair,
      glow: true,
      armL: { type: "sleeve", fill: "url:shatter", cuffGlow: pair, glove: "#101013" },
      armR: { type: "sleeve", color: "#c3c9d1", cuffGlow: pair, glove: "#101013" },
      legL: { color: "#2a2d33", seams: "#aeb6c2", kneePlate: "#cfd4da", hemGlow: pair },
      legR: { color: "#2a2d33", seams: "#aeb6c2", kneePlate: "#cfd4da", hemGlow: pair },
    });
    return d;
  }

  test("accepts and round-trips the full light-cut look", () => {
    const d = lightCut();
    assert.deepEqual(validateDesign(d), []);
    const clean = sanitizeDesign(d);
    assert.deepEqual(clean.figure.torsoSplit, d.figure.torsoSplit);
    assert.deepEqual(clean.figure.legL, d.figure.legL);
    assert.equal(clean.figure.chest, "streak");
    assert.equal(clean.figure.streakCore, "#ffffff");
    assert.ok(!hasNestedArray(clean), "glow pairs must stay Firestore-storable");
  });

  test("rejects malformed Prism pieces", () => {
    const bad = [
      (f) => (f.torsoSplit = { color: "silver" }),
      (f) => (f.torsoSplit = { color: "#c3c9d1", fill: "url:nope" }),
      (f) => (f.torsoSplit = { color: "#c3c9d1", side: "left" }),
      (f) => (f.printColors = { shatter: ["#16181d"] }),
      (f) => (f.streak = "blue"),
      (f) => (f.armL = { type: "sleeve", cuffGlow: ["#7cc4ff"] }),
      (f) => (f.legL = { hemGlow: ["#7cc4ff", "gold"] }),
      (f) => (f.legR = { kneePlate: "shiny" }),
      (f) => (f.legR = { seams: 3 }),
    ];
    for (const mutate of bad) {
      const d = lightCut();
      mutate(d.figure);
      assert.ok(validateDesign(d).length > 0, mutate.toString());
    }
  });
});

describe("Wildwood fields", () => {
  function grove() {
    const d = validDesign();
    Object.assign(d.figure, {
      torsoFill: "url:brocade",
      brocade: true,
      printColors: { brocade: ["#1d4a4f", "#3f7f78", "#b88a4a"] },
      veins: { color: "#e4dccb", flip: true },
      veinGlow: "#5ff0dc",
      glow: true,
      chest: "gill",
      gill: "#b06a3a",
      chestReverse: true,
      drape: { color: "#5c4960", flip: false },
      armL: { type: "sleeve", color: "#2b231d", veins: "#e4dccb", glove: "#141414" },
      armR: { type: "bare", veins: "#e4dccb", gauntlet: { color: "#b06a3a" } },
      legL: { color: "#141414", veins: "#e4dccb" },
      legR: { fill: "url:brocade" },
    });
    return d;
  }

  test("accepts and round-trips the full living-forest look", () => {
    const d = grove();
    assert.deepEqual(validateDesign(d), []);
    const clean = sanitizeDesign(d);
    assert.deepEqual(clean.figure.veins, d.figure.veins);
    assert.deepEqual(clean.figure.drape, d.figure.drape);
    assert.deepEqual(clean.figure.armR, d.figure.armR);
    assert.equal(clean.figure.chest, "gill");
    assert.equal(clean.figure.veinGlow, "#5ff0dc");
    assert.ok(!hasNestedArray(clean));
  });

  test("rejects malformed Wildwood pieces", () => {
    const bad = [
      (f) => (f.veins = "#e4dccb"),
      (f) => (f.veins = { color: "bark" }),
      (f) => (f.veins = { color: "#e4dccb", side: "left" }),
      (f) => (f.drape = { color: "#5c4960", flip: "yes" }),
      (f) => (f.veinGlow = "aqua"),
      (f) => (f.gill = 12),
      (f) => (f.printColors = { brocade: ["#1d4a4f", "#3f7f78"] }),
      (f) => (f.torsoFill = "url:brocades"),
      (f) => (f.armL = { type: "sleeve", veins: "gold" }),
      (f) => (f.legL = { veins: ["#e4dccb"] }),
    ];
    for (const mutate of bad) {
      const d = grove();
      mutate(d.figure);
      assert.ok(validateDesign(d).length > 0, mutate.toString());
    }
  });
});

describe("Ember Glass fields", () => {
  function lantern() {
    const d = validDesign();
    Object.assign(d.figure, {
      torsoFill: "url:ember",
      ember: true,
      printColors: { ember: ["#e2540f", "#fbc02d", "#111114"] },
      chest: "yoke",
      yoke: "#111114",
      yokePiping: "#f4f2ec",
      chestReverse: true,
      armR: { type: "sleeve", fill: "url:ember", glove: "#111114" },
      hatType: "shako",
      hat: { body: "#111114", panel: "url:ember", ornament: "none" },
    });
    return d;
  }

  test("accepts and round-trips the full lit-glass look", () => {
    const d = lantern();
    assert.deepEqual(validateDesign(d), []);
    const clean = sanitizeDesign(d);
    assert.equal(clean.figure.chest, "yoke");
    assert.equal(clean.figure.yokePiping, "#f4f2ec");
    assert.deepEqual(clean.figure.hat, d.figure.hat);
    assert.deepEqual(clean.figure.printColors, d.figure.printColors);
    assert.ok(!hasNestedArray(clean));
  });

  test("accepts a solid or gradient hat panel", () => {
    const solid = lantern();
    solid.figure.hat.panel = "#e2540f";
    assert.deepEqual(validateDesign(solid), []);
    const fade = lantern();
    fade.figure.grads = { blaze: [{ o: "0", c: "#e2540f" }, { o: "1", c: "#fbc02d" }] };
    fade.figure.hat.panel = "url:blaze";
    assert.deepEqual(validateDesign(fade), []);
  });

  test("rejects malformed Ember Glass pieces", () => {
    const bad = [
      (f) => (f.yoke = "black"),
      (f) => (f.yokePiping = 7),
      (f) => (f.ember = "yes"),
      (f) => (f.printColors = { ember: ["#e2540f", "#fbc02d"] }),
      (f) => (f.torsoFill = "url:embers"),
      (f) => (f.hat = { body: "#111114", panel: "url:emberSm" }),
      (f) => (f.hat = { body: "#111114", panel: "url:nope" }),
      (f) => (f.hat = { body: "#111114", panel: 12 }),
    ];
    for (const mutate of bad) {
      const d = lantern();
      mutate(d.figure);
      assert.ok(validateDesign(d).length > 0, mutate.toString());
    }
  });
});
