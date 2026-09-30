// The design-house pack gate (docs/UNIFORM_STUDIO.md §8.4). These are the
// invariants the shop sells against: the free floor never requires a pack,
// each gated feature maps to exactly one pack, and the error message names
// what to buy. Enforcement call sites live in callable/uniformStudio.js and
// callable/designExchange.js.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  UNIFORM_PACKS,
  PRESTIGE_UNLOCKS,
  requiredPacksFor,
  missingPacksFor,
  missingPacksMessage,
} = require("./uniformEntitlements");
const { getShopItem } = require("./shopCatalog");

const FREE = { skin: "#c9a074", jacket: "#6d1a26", hatType: "shako", satin: true, velvet: true };

describe("requiredPacksFor", () => {
  test("the free floor never needs a pack", () => {
    assert.deepEqual(requiredPacksFor(FREE), []);
    assert.deepEqual(requiredPacksFor({}), []);
    assert.deepEqual(requiredPacksFor(null), []);
    assert.deepEqual(requiredPacksFor(undefined), []);
  });

  test("finishes need the Texture Atelier; busby and cape need the Outfitters", () => {
    assert.deepEqual(requiredPacksFor({ iridescent: true }), ["pack_texture_atelier"]);
    assert.deepEqual(requiredPacksFor({ lame: true }), ["pack_texture_atelier"]);
    assert.deepEqual(requiredPacksFor({ hatType: "busby" }), ["pack_military_outfitters"]);
    assert.deepEqual(requiredPacksFor({ cape: { color: "#22355c" } }), [
      "pack_military_outfitters",
    ]);
  });

  test("features from one house dedupe; both houses list both packs", () => {
    assert.deepEqual(requiredPacksFor({ iridescent: true, lame: true }), ["pack_texture_atelier"]);
    assert.deepEqual(
      requiredPacksFor({ lame: true, hatType: "busby", cape: { color: "#22355c" } }).sort(),
      ["pack_military_outfitters", "pack_texture_atelier"]
    );
  });

  test("the long coat needs the Tailors' Cut; premium plumes need the Plumassier", () => {
    assert.deepEqual(requiredPacksFor({ torsoStyle: "longcoat" }), ["pack_tailors_cut"]);
    assert.deepEqual(requiredPacksFor({ plume: { type: "fan", color: "#b3121c" } }), [
      "pack_plumassier",
    ]);
    assert.deepEqual(requiredPacksFor({ plume: { type: "cascade", color: "#f4f1ea" } }), [
      "pack_plumassier",
    ]);
    // free silhouettes and plumes stay free
    assert.deepEqual(requiredPacksFor({ torsoStyle: "dress" }), []);
    assert.deepEqual(requiredPacksFor({ plume: { type: "upright", color: "#f4f1ea" } }), []);
  });

  test("the aiguillette is prestige: it needs the Drum Major title", () => {
    assert.deepEqual(requiredPacksFor({ aiguillette: "#d9a41c" }), ["title_drum_major"]);
    assert.deepEqual(
      requiredPacksFor({ aiguillette: "#d9a41c", lame: true }).sort(),
      ["pack_texture_atelier", "title_drum_major"]
    );
  });
});

describe("missingPacksFor", () => {
  const gated = { iridescent: true, hatType: "busby" };

  test("owned packs drop out; a missing owned list means all are missing", () => {
    assert.deepEqual(missingPacksFor(gated, ["pack_texture_atelier"]), [
      "pack_military_outfitters",
    ]);
    assert.deepEqual(
      missingPacksFor(gated, ["pack_texture_atelier", "pack_military_outfitters"]),
      []
    );
    assert.equal(missingPacksFor(gated, undefined).length, 2);
    assert.equal(missingPacksFor(gated, "not-an-array").length, 2);
    assert.deepEqual(missingPacksFor(FREE, undefined), []);
  });
});

describe("missingPacksMessage", () => {
  test("names every missing pack with its house and points at the Shop", () => {
    const msg = missingPacksMessage(["pack_texture_atelier", "pack_military_outfitters"]);
    assert.match(msg, /Texture Atelier \(Maison Verdier\)/);
    assert.match(msg, /Military Outfitters Collection \(Blackwell & Sons\)/);
    assert.match(msg, /unlock them in the Shop/);
    assert.match(msg, /Previewing in the Studio is always free/);
  });

  test("a prestige unlock names the gating title, not a design house", () => {
    const msg = missingPacksMessage(["title_drum_major"]);
    assert.match(msg, /the Drum Major's aiguillette \(requires the Drum Major title\)/);
    assert.match(msg, /unlock it in the Shop/);
  });

  test("an unknown id falls back to the raw id instead of crashing", () => {
    assert.match(missingPacksMessage(["pack_future"]), /pack_future/);
  });
});

describe("shop catalog wiring", () => {
  test("every pack is a purchasable uniformPack shop item", () => {
    for (const [id, meta] of Object.entries(UNIFORM_PACKS)) {
      const item = getShopItem(id);
      assert.ok(item, `${id} missing from shopCatalog`);
      assert.equal(item.type, "uniformPack");
      assert.equal(item.name, meta.name);
      assert.ok(item.price > 0, `${id} must be buyable, not grant-only`);
      assert.ok(!item.grantOnly);
    }
  });

  test("every prestige unlock is gated on a real non-pack shop item", () => {
    for (const id of Object.keys(PRESTIGE_UNLOCKS)) {
      const item = getShopItem(id);
      assert.ok(item, `${id} missing from shopCatalog`);
      assert.notEqual(item.type, "uniformPack");
    }
  });
});

describe("Prism Forge Collection (Lumen & Vane)", () => {
  const pair = ["#7cc4ff", "#f2c14e"];
  test("every light-cut piece maps to the one pack", () => {
    const cases = [
      { torsoFill: "url:shatter" },
      { mockNeck: "url:shatter" },
      { torsoSplit: { color: "#c3c9d1" } },
      { torsoSplit: { color: "#c3c9d1", fill: "url:shatter" } },
      { chest: "streak", streak: "#7cc4ff" },
      { armL: { type: "sleeve", cuffGlow: pair } },
      { armR: { type: "sleeve", fill: "url:shatter" } },
      { legL: { hemGlow: pair } },
      { legR: { kneePlate: "#cfd4da" } },
      { legL: { seams: "#cfd4da" } },
      { legR: { fill: "url:shatter" } },
    ];
    for (const fig of cases) {
      assert.deepEqual(requiredPacksFor({ ...FREE, ...fig }), ["pack_prism_forge"], JSON.stringify(fig));
    }
  });

  test("the free floor and invisible leftovers stay free", () => {
    assert.deepEqual(requiredPacksFor({ ...FREE, chest: "swash", swash: "#cfd4da" }), []);
    // a cuff glow left on a half sleeve or bare arm draws nothing
    assert.deepEqual(requiredPacksFor({ ...FREE, armL: { type: "half", cuffGlow: pair } }), []);
    assert.deepEqual(requiredPacksFor({ ...FREE, armR: { type: "bare", cuffGlow: pair } }), []);
  });

  test("the missing-pack message names the house", () => {
    const missing = missingPacksFor({ ...FREE, chest: "streak" }, ["pack_plumassier"]);
    assert.deepEqual(missing, ["pack_prism_forge"]);
    assert.match(missingPacksMessage(missing), /Prism Forge Collection \(Lumen & Vane\)/);
  });
});

describe("Wildwood Collection (Alder & Moss)", () => {
  const vein = "#e4dccb";
  test("every living-forest piece maps to the one pack", () => {
    const cases = [
      { torsoFill: "url:brocade" },
      { mockNeck: "url:brocade" },
      { veins: { color: vein } },
      { chest: "gill", gill: "#b06a3a" },
      { drape: { color: "#5c4960", flip: true } },
      { armL: { type: "sleeve", veins: vein } },
      { armR: { type: "half", veins: vein } },
      { armL: { type: "sleeve", detached: true, veins: vein } },
      { armR: { type: "bare", veins: vein, gauntlet: { color: "#b06a3a" } } },
      { armL: { type: "bare", veins: vein, glove: "#141414" } },
      { legL: { veins: vein } },
      { legR: { fill: "url:brocade" } },
    ];
    for (const fig of cases) {
      assert.deepEqual(requiredPacksFor({ ...FREE, ...fig }), ["pack_wildwood"], JSON.stringify(fig));
    }
  });

  test("invisible leftovers stay free", () => {
    // a glow with no vein to carry it, and veins on bare skin, draw nothing
    assert.deepEqual(requiredPacksFor({ ...FREE, veinGlow: "#5ff0dc" }), []);
    assert.deepEqual(requiredPacksFor({ ...FREE, armL: { type: "bare", veins: vein } }), []);
    assert.deepEqual(requiredPacksFor({ ...FREE, armR: { type: "none", veins: vein } }), []);
  });

  test("a brocade split panel needs both houses", () => {
    const fig = { ...FREE, torsoSplit: { color: "#c3c9d1", fill: "url:brocade" } };
    assert.deepEqual(requiredPacksFor(fig).sort(), ["pack_prism_forge", "pack_wildwood"]);
  });

  test("the missing-pack message names the house", () => {
    const missing = missingPacksFor({ ...FREE, chest: "gill", gill: "#b06a3a" }, ["pack_prism_forge"]);
    assert.deepEqual(missing, ["pack_wildwood"]);
    assert.match(missingPacksMessage(missing), /Wildwood Collection \(Alder & Moss\)/);
  });
});
