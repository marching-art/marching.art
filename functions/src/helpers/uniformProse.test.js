// Every Studio field must reach the image models. This test builds a design
// that sets EVERY key the server whitelist (FIGURE_FIELDS) accepts and checks
// that each distinct color and each option lands in the prose spec — so a new
// field added to the renderer without a line here fails loudly instead of
// silently vanishing from every generated image.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { describeFigure, normalizeFigure, fillProse } = require("./uniformProse");

const colorway = { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" };

/** Every FIGURE_FIELDS key set to a distinctive, greppable value. */
function maximalFigure() {
  return {
    skin: "#c9a074",
    hairShow: true,
    hair: "#3a2a1a",
    torsoStyle: "longcoat",
    torsoFill: "url:sun",
    jacket: "#111111",
    print: "sunburst",
    printColors: { sunburst: ["#aa0001", "#aa0002", "#aa0003"], foil: ["#aa0004", "#aa0005"] },
    plaid: true,
    grads: {
      ombre: [
        { o: "0", c: "#bb0001" },
        { o: "1", c: "#bb0002" },
      ],
    },
    foilLeg: true,
    glow: true,
    glowArt: "#cc0001",
    velvet: true,
    patent: true,
    satin: true,
    iridescent: true,
    lame: true,
    torsoSequin: true,
    chest: "baldric",
    chestBadge: { shape: "shield", color: "#dd0001", accent: "#dd0002", flip: true },
    chestShape: "triangles",
    chestReverse: true,
    chestFade: ["#ee0001", "#ee0002"],
    buttonColor: "#ff0001",
    braid: "#ff0002",
    sash: "#ff0003",
    sashSequin: true,
    baldric: "#ff0004",
    baldricCenter: "#ff0005",
    baldricSequin: true,
    panel: "#ff0006",
    panelTrim: "#ff0007",
    swash: "#ff0008",
    swashSequin: false,
    swashTop: true,
    swashBottom: true,
    swashLegColor: "#ff0009",
    metal: "#ab0001",
    collar: "#ab0002",
    collarTrim: "#ab0003",
    mockNeck: "url:opart",
    cowl: "#ab0004",
    crew: true,
    scarf: "#ab0005",
    tie: "#ab0006",
    epaulet: "#ab0007",
    aiguillette: "#ab0008",
    suspenders: "#ab0009",
    belt: "#ac0001",
    buckle: "#ac0002",
    waistBand: "#ac0003",
    waistBandEdge: "#ac0004",
    fringe: "#ac0005",
    streamers: ["#ac0006", "#ac0007"],
    armL: {
      type: "sleeve",
      fill: "url:ombre",
      detached: true,
      patent: true,
      glowLine: "#ad0001",
      gauntlet: { color: "#ad0002", sequin: true },
      glove: "#ad0003",
    },
    armR: { type: "half", color: "#ad0004", gauntlet: null, glove: null },
    legL: { fill: "url:plaid", stripe: "#ae0001", flare: true, sequin: true },
    legR: { color: "#ae0002", fill: "url:foil", tattered: true, foil: true },
    shoe: "#af0001",
    sneaker: false,
    spats: true,
    hatType: "busby",
    hat: { body: "#ba0001", band: "#ba0002", emblem: "#ba0003", ornament: "star", flip: true },
    plume: { type: "cascade", color: "#bc0001", accent: "#bc0002", mylar: true },
    cape: { color: "#bd0001", lining: "#bd0002", side: "right" },
  };
}

test("every color set on a maximal figure reaches the spec", () => {
  const figure = maximalFigure();
  const spec = describeFigure({ colorway, figure });
  const text = spec.block.toLowerCase();

  // Every hex that the renderer would paint. (jacket is overridden by
  // torsoFill; sash/braid/panel/swash belong to chest treatments not selected;
  // sunburst printColors drive the torso print; foil colors drive legR.)
  const painted = [
    "#aa0001", "#aa0002", "#aa0003", // sunburst print colors
    "#aa0004", "#aa0005", // foil print colors (legR)
    "#bb0001", "#bb0002", // ombré sleeve gradient
    "#cc0001", // glow art
    "#dd0001", "#dd0002", // chest badge
    "#ee0001", "#ee0002", // chest fade
    "#ff0004", "#ff0005", // baldric + center
    "#ab0001", // metal override
    "#ab0002", "#ab0003", "#ab0004", "#ab0005", "#ab0006", // neck
    "#ab0007", "#ab0008", "#ab0009", // shoulders
    "#ac0001", "#ac0002", "#ac0003", "#ac0004", "#ac0005", "#ac0006", "#ac0007", // waist
    "#ad0001", "#ad0002", "#ad0003", "#ad0004", // arms
    "#ae0001", // legL stripe (legR's solid color is overridden by its foil fill, as in the renderer)
    "#af0001", // shoe
    "#ba0001", "#ba0002", "#ba0003", // hat
    "#bc0001", "#bc0002", // plume
    "#bd0001", "#bd0002", // cape
    "#6d1a26", "#d9a41c", "#ece2cc", // colorway
  ];
  for (const hex of painted) {
    assert.ok(text.includes(hex), `spec is missing ${hex}`);
  }
});

test("every option on a maximal figure is described in words", () => {
  const spec = describeFigure({ colorway, figure: maximalFigure() });
  const text = spec.block;
  for (const phrase of [
    "long coat",
    "sunburst print",
    "velvet",
    "satin",
    "patent vinyl",
    "iridescent",
    "lamé",
    "sequins across the whole torso",
    "glowing",
    "TRIANGLE-BLADE baldric",
    "from the viewer's LEFT shoulder down to the viewer's RIGHT hip", // chestReverse on a baldric
    "fades top to bottom",
    "crest shield badge on the viewer's-left breast", // flip
    "standing collar",
    "mock neck",
    "op-art",
    "cowl scarf",
    "crew neckline",
    "neckerchief",
    "tie hanging",
    "epaulets",
    "aiguillette",
    "suspenders",
    "belt",
    "waistband",
    "fringe",
    "streamers",
    "ARMS ARE ASYMMETRIC",
    "DETACHED",
    "rolled half-sleeve",
    "gauntlet cuff",
    "covered in sequins",
    "BARE HAND (no glove)",
    "LEGS ARE ASYMMETRIC",
    "plaid",
    "side stripe",
    "flared hem",
    "tattered",
    "metallic foil",
    "sequin field across the leg",
    "marching shoes",
    "white spats",
    "busby",
    "draped bag",
    "a star",
    "chin chain",
    "cascade plume",
    "two-tone",
    "mylar",
    "cavalry cape",
    "viewer's-right shoulder",
  ]) {
    assert.ok(text.includes(phrase), `spec is missing "${phrase}"`);
  }
  assert.equal(spec.symmetric, false);
  assert.equal(spec.hasHat, true);
  assert.equal(spec.hasPlume, true);
  // Nothing on this figure is absent except gloves on one hand — which is
  // described per-arm, not in the absent list.
  assert.deepEqual(spec.absent, []);
});

test("a minimal bareheaded figure states what is NOT there", () => {
  const spec = describeFigure({ colorway, figure: { skin: "#c9a074", jacket: "#6d1a26" } });
  assert.ok(spec.block.includes("NO HEADWEAR"));
  assert.ok(spec.block.includes("Do not add a shako"));
  assert.ok(spec.block.includes("PLAIN front"));
  assert.ok(spec.block.includes("no epaulets"));
  assert.ok(spec.gloves.includes("NO gloves"));
  assert.ok(spec.absent.includes("headwear of any kind"));
  assert.ok(spec.absent.includes("gloves (hands are bare)"));
  assert.ok(spec.absent.includes("belt"));
  assert.equal(spec.hasHat, false);
  assert.equal(spec.symmetric, true);
  // The torso falls back to the colorway primary, shoes to black.
  assert.ok(spec.block.includes("maroon (#6d1a26)"));
  assert.ok(spec.footwear.includes("black (#141414)"));
});

test("legacy symmetric shorthands expand to both limbs (like the client)", () => {
  const figure = {
    skin: "#c9a074",
    jacket: "#6d1a26",
    sleeve: "#101010",
    gauntlet: "#202020",
    gauntletSequin: true,
    glove: "#303030",
    pants: "#404040",
    stripe: "#505050",
  };
  const n = normalizeFigure(figure);
  assert.equal(n.armL.color, "#101010");
  assert.equal(n.armR.gauntlet.color, "#202020");
  assert.equal(n.legR.stripe, "#505050");
  const spec = describeFigure({ colorway, figure });
  assert.ok(spec.block.includes("ARMS (both identical)"));
  assert.ok(spec.block.includes("#101010"));
  assert.ok(spec.block.includes("#202020"));
  assert.ok(spec.block.includes("covered in sequins"));
  assert.equal(spec.gloves, "charcoal gray (#303030) gloves");
  assert.ok(spec.block.includes("LEGS (both identical)"));
  assert.ok(spec.block.includes("#404040"));
  assert.ok(spec.block.includes("#505050"));
});

test("hat plume and ornament defaults follow the renderer", () => {
  const shako = describeFigure({
    colorway,
    figure: { skin: "#c9a074", hatType: "shako", hat: { body: "#17171a" } },
  });
  assert.ok(shako.block.includes("sunburst plate on the front"));
  assert.ok(shako.block.includes("PLUME: NO plume"));
  assert.ok(shako.absent.includes("plume"));

  const contour = describeFigure({
    colorway,
    figure: { skin: "#c9a074", hatType: "contour", hat: { body: "#17171a" } },
  });
  assert.ok(contour.block.includes("no front plate or badge"));

  const aussie = describeFigure({
    colorway,
    figure: {
      skin: "#c9a074",
      hatType: "aussie",
      hat: { body: "#f2f0ea", ornament: "disc", flip: true },
      plume: { type: "sideFeather", color: "#101010" },
    },
  });
  assert.ok(aussie.block.includes("pinned-up side of the brim"));
  assert.ok(aussie.block.includes("viewer's LEFT side"));
  assert.ok(aussie.block.includes("feather spray"));
});

test("every chest treatment has its own prose", () => {
  const base = { skin: "#c9a074", jacket: "#6d1a26" };
  const cases = {
    braid: [{ chest: "braid", braid: "#efe9dc" }, "five horizontal rows"],
    sash: [{ chest: "sash", sash: "#e8c25a" }, "diagonal sash band"],
    sashTapered: [{ chest: "sash", sash: "#e8c25a", chestShape: "tapered" }, "TAPERED diagonal sash"],
    baldric: [{ chest: "baldric", baldric: "#17171a", baldricCenter: "#ece2cc" }, "center stripe"],
    plastron: [{ chest: "plastron", panel: "#b3121c", panelTrim: "#0c0c0e" }, "plastron chest panel"],
    buttons: [{ chest: "buttons", buttonColor: "#ffffff" }, "two vertical columns of five"],
    swash: [{ chest: "swash", swash: "#2f6fd0" }, "modern SWASH"],
    swashLegOnly: [{ chest: "swash", swash: "#2f6fd0", swashTop: false }, "swash band across the viewer's-left upper leg"],
    vinyl: [{ chest: "vinylPanel", panel: "#b3121c" }, "vinyl front panel"],
  };
  for (const [name, [extra, phrase]] of Object.entries(cases)) {
    const spec = describeFigure({ colorway, figure: { ...base, ...extra } });
    assert.ok(spec.block.includes(phrase), `${name}: missing "${phrase}"`);
  }
});

test("fills describe prints with the director's colors and gradients with their stops", () => {
  const fig = {
    printColors: { opart: ["#000001", "#000002", "#000003"] },
    grads: { veil: [["0", "#100000"], ["1", "#200000"]] }, // legacy tuple stops
  };
  assert.ok(fillProse(fig, "url:opart").includes("#000002"));
  assert.ok(fillProse(fig, "url:pinstripe").includes("#efe3c8")); // stock palette
  const veil = fillProse(fig, "url:veil", "shoulder to wrist");
  assert.ok(veil.includes("ombré"));
  assert.ok(veil.includes("(#100000) → "));
  assert.ok(veil.includes("(#200000)"));
  assert.ok(veil.includes("shoulder to wrist"));
  assert.equal(fillProse(fig, "url:missing"), null);
  assert.ok(fillProse(fig, "#abcdef").startsWith("solid "));
  assert.ok(fillProse(fig, "#abcdef").endsWith("(#abcdef)"));
});

test("the guard dress silhouette is described for the guard look", () => {
  const spec = describeFigure({
    colorway: { primary: "#b3121c", secondary: "#ece2cc", accent: "#141414", metal: "silver" },
    figure: { skin: "#c9a074", torsoStyle: "dress", jacket: "#b3121c", satin: true },
  });
  assert.ok(spec.block.includes("guard dress"));
  assert.ok(spec.block.includes("A-line skirt"));
  assert.ok(spec.summary.includes("guard dress"));
});
