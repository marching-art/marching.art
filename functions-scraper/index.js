const admin = require("firebase-admin");
admin.initializeApp();

// Helpers
const {
  testScraper,
  discoverAndQueueUrls,
  scrapeSingleRecap,
} = require("./helpers/scraping");

// Scheduled
const { scrapeDciScores } = require("./scheduled/liveScraper");

// Triggers
const { processPaginationPage } = require("./triggers/scoreProcessing");

module.exports = {
  testScraper,
  discoverAndQueueUrls,
  scrapeSingleRecap,
  scrapeDciScores,
  processPaginationPage,
};
