const { getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");

const dataNamespaceParam = defineString("DATA_NAMESPACE");

let db = null;

const getDb = () => {
  if (!db) {
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
};

module.exports = {
  getDb,
  dataNamespaceParam,
};