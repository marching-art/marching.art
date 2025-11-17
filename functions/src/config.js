const { getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");

const dataNamespaceParam = defineString("DATA_NAMESPACE");

const getDb = () => getFirestore();

module.exports = {
  getDb,
  dataNamespaceParam,
};