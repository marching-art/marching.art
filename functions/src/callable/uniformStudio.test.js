// Behavior tests for the wardrobe save callable's design-house pack gate
// (helpers/uniformEntitlements). Previewing gated content is free; KEEPING it
// is what requires the pack — so the gate must hold on create and on
// overwrite, read the buyer's profile only when the design is gated, and let
// the whole free floor through with no profile at all.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { saveUniformDesign, equipUniformDesign } = require("./uniformStudio");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const wardrobePrefix = (uid) => `artifacts/${NS}/users/${uid}/wardrobe/`;

/** A valid free-floor design; add gated pieces per test. */
function freeDesign() {
  return {
    schema: 2,
    name: "Finals Look",
    colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
    figure: {
      skin: "#c9a074",
      jacket: "#6d1a26",
      hatType: "shako",
      hat: { body: "#17171a", band: "#6d1a26" },
      plume: { type: "upright", color: "#f4f1ea" },
    },
  };
}

/** The same design wearing both houses' content. */
function gatedDesign() {
  const d = freeDesign();
  d.figure.hatType = "busby";
  d.figure.hat = { body: "#17171a", band: "#8a1a1a", ornament: "none" };
  d.figure.cape = { color: "#22355c", lining: "#d9a41c" };
  d.figure.lame = true;
  return d;
}

/** Minimal fake Firestore for the save path: doc get/set, collection
 *  doc()/count(), auto-ids. Same shape as the designExchange harness. */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data, id: path.split("/").pop() };
    },
    async set(data, options) {
      writes.push({ type: "set", path, data, options });
      docs.set(
        path,
        options && options.merge ? { ...(docs.get(path) || {}), ...data } : data
      );
    },
    async update(data) {
      writes.push({ type: "update", path, data });
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
    get id() {
      return path.split("/").pop();
    },
  });
  const makeCollection = (path) => ({
    doc(id) {
      return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
    },
    count() {
      return {
        async get() {
          let n = 0;
          for (const p of docs.keys()) {
            if (p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/")) n += 1;
          }
          return { data: () => ({ count: n }) };
        },
      };
    },
  });
  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return makeCollection(path);
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
          docs.set(ref.path, data);
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes, docs };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

after(() => setDbForTesting(null));

describe("saveUniformDesign pack gate", () => {
  beforeEach(() => setDbForTesting(null));

  test("a free-floor design saves with no profile doc at all", async () => {
    const docs = new Map();
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await saveUniformDesign.run(
      authedRequest("director", { design: freeDesign() })
    );
    assert.ok(result.designId);
    const saved = [...docs.keys()].find((p) => p.startsWith(wardrobePrefix("director")));
    assert.ok(saved, "wardrobe doc written");
  });

  test("a gated design without the packs is refused by name", async () => {
    const docs = new Map([[profilePath("director"), { cosmetics: { owned: [] } }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveUniformDesign.run(authedRequest("director", { design: gatedDesign() })),
      (err) => {
        assert.equal(err.code, "failed-precondition");
        assert.match(err.message, /Texture Atelier \(Maison Verdier\)/);
        assert.match(err.message, /Military Outfitters Collection/);
        assert.match(err.message, /Previewing in the Studio is always free/);
        return true;
      }
    );
    const saved = [...docs.keys()].find((p) => p.startsWith(wardrobePrefix("director")));
    assert.equal(saved, undefined, "nothing written past the gate");
  });

  test("owning one pack of two is still refused", async () => {
    const docs = new Map([
      [profilePath("director"), { cosmetics: { owned: ["pack_texture_atelier"] } }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveUniformDesign.run(authedRequest("director", { design: gatedDesign() })),
      /Military Outfitters Collection/
    );
  });

  test("owning both packs lets the gated design save", async () => {
    const docs = new Map([
      [
        profilePath("director"),
        { cosmetics: { owned: ["pack_texture_atelier", "pack_military_outfitters"] } },
      ],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await saveUniformDesign.run(
      authedRequest("director", { design: gatedDesign() })
    );
    assert.ok(result.designId);
    const saved = [...docs.entries()].find(([p]) => p.startsWith(wardrobePrefix("director")));
    assert.equal(saved[1].figure.hatType, "busby");
    assert.equal(saved[1].figure.lame, true);
  });

  test("the gate holds on overwrites of an existing design too", async () => {
    const docs = new Map([
      [profilePath("director"), { cosmetics: { owned: [] } }],
      [`${wardrobePrefix("director")}d1`, { ...freeDesign(), createdAt: "2026-08-01" }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveUniformDesign.run(authedRequest("director", { designId: "d1", design: gatedDesign() })),
      /unlock them in the Shop/
    );
    assert.equal(docs.get(`${wardrobePrefix("director")}d1`).figure.cape, undefined);
  });

  test("the aiguillette needs the Drum Major title; the title unlocks it", async () => {
    const design = freeDesign();
    design.figure.aiguillette = "#d9a41c";
    const docs = new Map([[profilePath("director"), { cosmetics: { owned: [] } }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveUniformDesign.run(authedRequest("director", { design })),
      /Drum Major's aiguillette \(requires the Drum Major title\)/
    );

    docs.set(profilePath("director"), { cosmetics: { owned: ["title_drum_major"] } });
    const result = await saveUniformDesign.run(authedRequest("director", { design }));
    assert.ok(result.designId);
    const saved = [...docs.entries()].find(([p]) => p.startsWith(wardrobePrefix("director")));
    assert.equal(saved[1].figure.aiguillette, "#d9a41c");
  });
});

describe("equipUniformDesign guard slot", () => {
  beforeEach(() => setDbForTesting(null));

  /** A profile with one registered corps and one saved wardrobe design. */
  function seededDocs() {
    return new Map([
      [
        profilePath("director"),
        { corps: { worldClass: { corpsName: "Guard Test Corps" } } },
      ],
      [`${wardrobePrefix("director")}d1`, { ...freeDesign(), createdAt: "2026-08-01" }],
    ]);
  }

  test("slot 'guard' writes uniformGuard and leaves the identity fields alone", async () => {
    const docs = seededDocs();
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await equipUniformDesign.run(
      authedRequest("director", { designId: "d1", corpsClass: "worldClass", slot: "guard" })
    );
    assert.match(result.message, /Guard look equipped/);

    const update = writes.find((w) => w.type === "update" && w.path === profilePath("director"));
    const keys = Object.keys(update.data);
    assert.deepEqual(keys, ["corps.worldClass.uniformGuard"]);
    assert.equal(update.data["corps.worldClass.uniformGuard"].designId, "d1");
    assert.equal(update.data["corps.worldClass.uniformGuard"].name, "Finals Look");
  });

  test("designId null with slot 'guard' clears the slot", async () => {
    const docs = seededDocs();
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await equipUniformDesign.run(
      authedRequest("director", { designId: null, corpsClass: "worldClass", slot: "guard" })
    );
    assert.match(result.message, /Guard look cleared/);
    const update = writes.find((w) => w.type === "update" && w.path === profilePath("director"));
    assert.deepEqual(Object.keys(update.data), ["corps.worldClass.uniformGuard"]);
  });

  test("an unknown slot is rejected; primary equips the v2 snapshot and drops legacy v1", async () => {
    const docs = seededDocs();
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      equipUniformDesign.run(
        authedRequest("director", { designId: "d1", corpsClass: "worldClass", slot: "drumline" })
      ),
      /Invalid uniform slot/
    );

    await equipUniformDesign.run(
      authedRequest("director", { designId: "d1", corpsClass: "worldClass" })
    );
    const update = writes.find((w) => w.type === "update" && w.path === profilePath("director"));
    // Writes the equipped v2 snapshot (with an aiHints field, the single source
    // of truth for the look) and deletes any legacy v1 prose design.
    assert.deepEqual(Object.keys(update.data).sort(), [
      "corps.worldClass.uniform",
      "corps.worldClass.uniformDesign",
    ]);
    assert.ok("aiHints" in update.data["corps.worldClass.uniform"]);
  });
});
