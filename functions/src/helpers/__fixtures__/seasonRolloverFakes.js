// Shared fakes for the season-rollover tests (seasonRollover.test.js and
// seasonRollover.leagues.test.js). Not a test file itself — no `.test.js`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguesPath = `artifacts/${NS}/leagues`;

/**
 * Fake Firestore covering what the rollover pipeline touches:
 * collectionGroup("profile").where().get(), collection().get()/.where().get()/
 * .doc(), db.doc().get()/.set(), db.batch(), db.runTransaction() (for the
 * rollover lease). Docs live in a Map so transactional writes are visible to
 * later reads (the lease test depends on that).
 */
function makeFakeDb({ profiles = [], leagues = [], docs = new Map() } = {}) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    // profile docs live at artifacts/{ns}/users/{uid}/profile/data —
    // parent.parent is the uid doc, matching production refs.
    parent: { parent: { id: path.split("/")[3] } },
    async get() {
      return {
        exists: docs.has(path),
        data: () => docs.get(path),
        ref: makeDocRef(path),
      };
    },
    async set(data, options) {
      if (options?.merge && docs.has(path)) {
        docs.set(path, { ...docs.get(path), ...data });
      } else {
        docs.set(path, data);
      }
      writes.push({ type: "docSet", path, data, options });
    },
    // resetLeaguesForNewSeason reaches leagues/{id}/standings/{docId} and
    // leagues/{id}/matchups through the league ref, the same way createLeague
    // and joinLeague do.
    collection(sub) {
      const prefix = `${path}/${sub}/`;
      return {
        doc: (id) => makeDocRef(`${prefix}${id ?? `auto-${++autoId}`}`),
        async get() {
          const found = [...docs.keys()]
            .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
            .map((key) => ({
              id: key.slice(prefix.length),
              ref: makeDocRef(key),
              data: () => docs.get(key),
            }));
          return { empty: found.length === 0, size: found.length, docs: found };
        },
      };
    },
  });

  const makeQuery = (items) => ({
    async get() {
      return {
        empty: items.length === 0,
        size: items.length,
        docs: items,
      };
    },
    where() {
      return makeQuery(items);
    },
    limit() {
      return makeQuery(items);
    },
  });

  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      const items =
        path === leaguesPath
          ? leagues.map((l) => ({
              id: l.id,
              ref: makeDocRef(`${leaguesPath}/${l.id}`),
              data: () => l.data,
            }))
          : [];
      return {
        ...makeQuery(items),
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
        },
        async listDocuments() {
          return [];
        },
      };
    },
    collectionGroup(name) {
      const items =
        name === "profile"
          ? profiles.map((p) => ({
              ref: makeDocRef(profilePath(p.uid)),
              data: () => p.data,
            }))
          : [];
      return makeQuery(items);
    },
    batch() {
      return {
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        delete(ref) {
          writes.push({ type: "delete", path: ref.path });
        },
        async commit() {},
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data) => {
          docs.set(ref.path, data);
          writes.push({ type: "txnSet", path: ref.path, data });
        },
        update: (ref, data) => {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
          writes.push({ type: "txnUpdate", path: ref.path, data });
        },
      });
    },
  };

  return { db, writes, docs };
}

const participatingCorps = (score = 85) => ({
  corpsName: "The Regulars",
  lineup: { GE1: "Blue Devils|2024" },
  selectedShows: { 1: ["show-a"] },
  weeklyScores: { 1: score },
  totalSeasonScore: score,
});

const lineupOnlyCorps = () => ({
  corpsName: "The Ghosts",
  lineup: { GE1: "Phantom Regiment|2024" },
  selectedShows: {},
  weeklyScores: {},
  totalSeasonScore: 0,
});

module.exports = {
  NS,
  profilePath,
  leaguesPath,
  makeFakeDb,
  participatingCorps,
  lineupOnlyCorps,
};
