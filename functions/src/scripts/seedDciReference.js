/**
 * DCI Reference Data Seed Script
 *
 * Populates Firestore with verified DCI corps and show data from DCX Museum (dcxmuseum.org).
 * This data is used for accurate image generation in news articles.
 *
 * Usage:
 *   node seedDciReference.js
 *
 * Or via Firebase Functions shell:
 *   firebase functions:shell
 *   > require('./src/scripts/seedDciReference').seedDciReference()
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// VERIFIED SHOW DATA FROM DCX MUSEUM (dcxmuseum.org)
// Corps data lives in dedicated modules so this script stays focused on the
// seed/read logic (and under the max-lines lint budget).
// =============================================================================

const { WORLD_CLASS_CORPS } = require("./dciCorpsWorldClass");
const { OPEN_CLASS_CORPS } = require("./dciCorpsOpenClass");

const DCI_CORPS_DATA = { ...WORLD_CLASS_CORPS, ...OPEN_CLASS_CORPS };

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

/**
 * Seeds the Firestore database with DCI reference data.
 * Creates/updates:
 * - dci-reference/corps - All corps metadata
 * - dci-reference/shows-{corpsId} - Shows by corps (hyphenated for valid doc path)
 */
async function seedDciReference() {
  console.log("Starting DCI reference data seed...\n");

  const batch = db.batch();
  const corpsRef = db.doc("dci-reference/corps");
  const corpsIndex = {};

  // Process each corps
  for (const [corpsName, corpsData] of Object.entries(DCI_CORPS_DATA)) {
    const { shows, ...corpsMeta } = corpsData;
    corpsIndex[corpsData.id] = {
      name: corpsName,
      ...corpsMeta,
    };

    // Write shows document for this corps (using shows-{id} format for valid doc path)
    if (shows && Object.keys(shows).length > 0) {
      const showsRef = db.doc(`dci-reference/shows-${corpsData.id}`);
      batch.set(showsRef, {
        corpsName,
        shows,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  Prepared shows for ${corpsName} (${Object.keys(shows).length} shows)`);
    }
  }

  // Write corps index
  batch.set(corpsRef, {
    corps: corpsIndex,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "DCX Museum (dcxmuseum.org)",
    lastVerified: "2025-01",
  });
  console.log(`\nPrepared corps index with ${Object.keys(corpsIndex).length} corps`);

  // Commit all writes
  await batch.commit();
  console.log("\nDCI reference data seed completed successfully!");

  return {
    success: true,
    corpsCount: Object.keys(corpsIndex).length,
    showsCount: Object.values(DCI_CORPS_DATA).reduce(
      (acc, corps) => acc + Object.keys(corps.shows || {}).length,
      0
    ),
  };
}

/**
 * Reads corps data from Firestore.
 */
async function getCorpsData(corpsId) {
  const corpsDoc = await db.doc("dci-reference/corps").get();
  if (!corpsDoc.exists) return null;

  const data = corpsDoc.data();
  return data.corps?.[corpsId] || null;
}

/**
 * Reads show data for a specific corps and year.
 */
async function getShowData(corpsId, year) {
  const showsDoc = await db.doc(`dci-reference/shows-${corpsId}`).get();
  if (!showsDoc.exists) return null;

  const data = showsDoc.data();
  return data.shows?.[year] || null;
}

/**
 * Gets uniform description for a corps, optionally with year-specific details.
 */
async function getUniformForCorps(corpsName, year = null) {
  const corpsDoc = await db.doc("dci-reference/corps").get();
  if (!corpsDoc.exists) return null;

  const data = corpsDoc.data();
  const corpsEntry = Object.values(data.corps || {}).find(c => c.name === corpsName);

  if (!corpsEntry) return null;

  const uniform = corpsEntry.defaultUniform;

  // If year specified, get show title
  if (year) {
    const showsDoc = await db.doc(`dci-reference/shows-${corpsEntry.id}`).get();
    if (showsDoc.exists) {
      const showData = showsDoc.data().shows?.[year];
      if (showData) {
        return { ...uniform, showTitle: showData.title, year };
      }
    }
  }

  return uniform;
}

module.exports = {
  seedDciReference,
  getCorpsData,
  getShowData,
  getUniformForCorps,
  DCI_CORPS_DATA,
};

// Allow running directly: node seedDciReference.js
if (require.main === module) {
  seedDciReference()
    .then(result => {
      console.log("\nResult:", result);
      process.exit(0);
    })
    .catch(err => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
