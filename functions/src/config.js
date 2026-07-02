const { getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");

const dataNamespaceParam = defineString("DATA_NAMESPACE");

// FOR TESTS ONLY: unit tests inject a fake Firestore here so callables can be
// exercised via .run() without an emulator. Never set in production code.
let testDbOverride = null;

const getDb = () => testDbOverride || getFirestore();

const setDbForTesting = (db) => {
  testDbOverride = db;
};

module.exports = {
  getDb,
  dataNamespaceParam,
  setDbForTesting,
};