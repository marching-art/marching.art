const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// --- Firebase Configuration ---
// Make sure the serviceAccountKey.json file is in the same directory
// or update the path accordingly.
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- Script Configuration ---
const RECAPS_DIRECTORY = path.join(__dirname, "recaps");
const OUTPUT_DIRECTORY = __dirname;

// --- Universal Caption Normalization ---
// This function maps the full caption names from the CSV header
// to the shorter keys used in the database (e.g., 'GE1').
const normalizeCaption = (raw) => {
  const text = String(raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (text === "general effect 1") return "GE1";
  if (text === "general effect 2") return "GE2";
  if (text === "visual proficiency") return "VP";
  if (text === "visual analysis") return "VA";
  if (text === "color guard") return "CG";
  if (text === "brass") return "B";
  if (text === "music analysis") return "MA";
  if (text === "percussion") return "P";
  // Handles 'Sub' or 'Total' for the final score column
  if (text === "sub" || text === "total") return "Total";
  return null;
};

// --- NEW CSV PARSING ENGINE ---
// This function reads a CSV file and extracts the structured score data.
const parseCsvFormat = (filePath) => {
  console.log(`\n--- Parsing ${path.basename(filePath)} ---`);
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const lines = csvContent.split("\n").filter(line => line.trim() !== "");
  const events = [];
  let currentEvent = null;

  // --- CORRECTED CSV PARSING FUNCTION ---
  const parseCsvRow = (rowStr) => {
    // Use a more robust regex to split by comma, but ignore commas inside double quotes.
    const cells = rowStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    // Clean up each cell by removing surrounding quotes and trimming whitespace.
    return cells.map(field => {
      // This regex removes quotes only if they are at the very start AND end of the string.
      return field.replace(/^"(.*)"$/, "$1").trim();
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    if (cells.length < 2) continue;

    const firstCellText = cells[0];
    // A new event is identified by a date in MM/DD/YYYY format.
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

    if (dateRegex.test(firstCellText)) {
      if (currentEvent && currentEvent.scores.length > 0) {
        events.push(currentEvent);
      }

      const location = cells[1] || "N/A";
      // Event name is in the 5th column (index 4). Use it if it exists, otherwise set to null.
      const title = cells[4] ? cells[4].trim() : null;
      const offSeasonDay = parseInt(cells[cells.length - 1], 10) || null;

      currentEvent = {
        eventName: title,
        date: firstCellText,
        location,
        offSeasonDay,
        scores: []
      };
      console.log(`Found event: ${currentEvent.eventName} on ${currentEvent.date}`);

      // The header row is always the next line.
      if (i + 1 < lines.length) {
        const headerRow = parseCsvRow(lines[i + 1]);
        let headerMap = {};
        let totalColumnIndex = -1;
        headerRow.forEach((cell, j) => {
          const caption = normalizeCaption(cell);
          if (caption) {
            if (caption === "Total") {
              totalColumnIndex = j;
            }
            headerMap[j] = caption;
          }
        });

        currentEvent.headerMap = headerMap;
        currentEvent.totalColumnIndex = totalColumnIndex;
        console.log("Header Map:", currentEvent.headerMap);
        i++; // Skip the header row.
      }
      continue;
    }

    if (!currentEvent || !currentEvent.headerMap) continue;

    const corpsNameText = cells[0];
    const totalScoreIndex = currentEvent.totalColumnIndex !== -1 ?
      currentEvent.totalColumnIndex : cells.length - 1;
    const potentialScore = parseFloat(cells[totalScoreIndex]);

    if (corpsNameText && !dateRegex.test(corpsNameText) &&
        !isNaN(potentialScore) && potentialScore > 0) {
      const corpsData = { corps: corpsNameText, score: potentialScore, captions: {} };

      Object.entries(currentEvent.headerMap).forEach(([colIndex, caption]) => {
        if (caption !== "Total") { // Don't process the total score as a caption
          const score = parseFloat(cells[colIndex]);
          if (!isNaN(score)) {
            if (!corpsData.captions[caption]) corpsData.captions[caption] = [];
            corpsData.captions[caption].push(score);
          }
        }
      });
      currentEvent.scores.push(corpsData);
    }
  }

  if (currentEvent && currentEvent.scores.length > 0) {
    events.push(currentEvent);
  }

  return events;
};


// --- Final Rankings Logic ---
// This logic remains unchanged.
const generateFinalRankingsForYear = (events) => {
  const findEvent = (keyword) => events.find(e => e.eventName && e.eventName.toLowerCase().includes(keyword));

  const finalsEvent = findEvent("finals");
  const semisEvent = findEvent("semi-finals") || findEvent("semi-final");
  const quartersEvent = findEvent("quarterfinals") || findEvent("quarterfinal");

  if (!finalsEvent) {
    console.warn("Could not find a 'Finals' event for this year. Skipping ranking.");
    return [];
  }

  let finalRankings = [];
  const rankedCorpsNames = new Set();

  const finalsCorps = [...finalsEvent.scores].sort((a, b) => b.score - a.score);
  finalRankings.push(...finalsCorps.slice(0, 12));
  finalsCorps.slice(0, 12).forEach(c => rankedCorpsNames.add(c.corps));

  if (semisEvent && finalRankings.length < 25) {
    const semisCorps = [...semisEvent.scores]
      .sort((a, b) => b.score - a.score)
      .filter(c => !rankedCorpsNames.has(c.corps));

    semisCorps.forEach(c => {
      if (finalRankings.length < 25) {
        finalRankings.push(c);
        rankedCorpsNames.add(c.corps);
      }
    });
  }

  if (quartersEvent && finalRankings.length < 25) {
    const quartersCorps = [...quartersEvent.scores]
      .sort((a, b) => b.score - a.score)
      .filter(c => !rankedCorpsNames.has(c.corps));

    quartersCorps.forEach(c => {
      if (finalRankings.length < 25) {
        finalRankings.push(c);
        rankedCorpsNames.add(c.corps);
      }
    });
  }

  return finalRankings
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map((corps, index) => ({
      rank: index + 1,
      corps: corps.corps,
      points: 25 - index,
      originalScore: corps.score
    }));
};

// --- Transform data for game logic ---
// This logic remains unchanged.
const transformToCaptionArchives = (historicalScores) => {
  const captionArchives = {};

  for (const year in historicalScores) {
    const events = historicalScores[year];
    events.forEach(event => {
      event.scores.forEach(corpsScore => {
        const corpsName = corpsScore.corps;
        const docId = `${year}_${corpsName.replace(/\s+/g, "-")}`;

        if (!captionArchives[docId]) {
          captionArchives[docId] = {
            year: year,
            corps: corpsName,
            GE1: [], GE2: [], VP: [], VA: [], CG: [], B: [], MA: [], P: []
          };
        }

        for (const caption in corpsScore.captions) {
          if (captionArchives[docId][caption]) {
            captionArchives[docId][caption].push({
              date: event.date,
              location: event.location,
              eventName: event.eventName,
              offSeasonDay: event.offSeasonDay || null,
              scores: corpsScore.captions[caption]
            });
          }
        }
      });
    });
  }
  return captionArchives;
};

// --- Firestore Upload Logic ---
// This logic remains unchanged.
const uploadCollection = async (collectionName, data) => {
  console.log(`\n--- Starting upload to '${collectionName}' collection ---`);
  const batch = db.batch();

  Object.keys(data).forEach(year => {
    if (data[year] && data[year].length > 0) {
      const docRef = db.collection(collectionName).doc(year);
      batch.set(docRef, { data: data[year] });
    }
  });

  try {
    await batch.commit();
    console.log(`Successfully uploaded all data to '${collectionName}'.`);
  } catch (error) {
    console.error(`Error uploading to '${collectionName}':`, error);
  }
};

const uploadCaptionArchives = async (collectionName, data) => {
  console.log(`\n--- Deleting old data in '${collectionName}' collection ---`);
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.docs.length > 0) {
    const deleteBatch = db.batch();
    snapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log("Old data deleted.");
  } else {
    console.log("No old data to delete.");
  }

  console.log(`\n--- Starting upload to '${collectionName}' collection ---`);
  let batch = db.batch();
  let batchCounter = 0;

  for (const docId in data) {
    const docRef = db.collection(collectionName).doc(docId);
    batch.set(docRef, data[docId]);
    batchCounter++;

    if (batchCounter >= 400) {
      console.log("Committing batch of 400 documents...");
      await batch.commit();
      batch = db.batch();
      batchCounter = 0;
    }
  }

  if (batchCounter > 0) {
    console.log(`Committing final batch of ${batchCounter} documents...`);
    await batch.commit();
  }
  console.log(`Successfully uploaded all data to '${collectionName}'.`);
};


// --- Main Execution ---
const main = async () => {
  if (!fs.existsSync(RECAPS_DIRECTORY)) {
    console.error("Error: 'recaps' directory does not exist. Please create it and place your .csv files inside.");
    return;
  }

  // MODIFIED: Look for .csv files.
  const allFiles = fs.readdirSync(RECAPS_DIRECTORY).filter(file => file.endsWith(".csv"));
  const historicalScores = {};
  const finalRankings = {};

  allFiles.forEach(file => {
    const yearMatch = file.match(/\d{4}/);
    if (!yearMatch) return;
    const year = yearMatch[0];
    const filePath = path.join(RECAPS_DIRECTORY, file);
    if (!historicalScores[year]) {
      historicalScores[year] = [];
    }
    // MODIFIED: Call the CSV parser.
    historicalScores[year].push(...parseCsvFormat(filePath));
  });

  const augustFiles = allFiles.filter(file => path.basename(file).includes("08.csv"));
  const augustScoresByYear = {};
  augustFiles.forEach(file => {
    const yearMatch = file.match(/\d{4}/);
    if (!yearMatch) return;
    const year = yearMatch[0];
    if (!augustScoresByYear[year]) {
      augustScoresByYear[year] = historicalScores[year];
    }
  });

  for (const year in augustScoresByYear) {
    finalRankings[year] = generateFinalRankingsForYear(augustScoresByYear[year]);
    if (finalRankings[year] && finalRankings[year].length > 0) {
      console.log(`\nGenerated final rankings for ${year} with ${finalRankings[year].length} corps.`);
    }
  }

  const captionArchives = transformToCaptionArchives(historicalScores);

  const hasData = Object.keys(historicalScores).length > 0;
  const hasScores = Object.values(historicalScores).some(yearData => yearData.length > 0);

  if (hasData && hasScores) {
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "historical_scores.json"), JSON.stringify(historicalScores, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "final_rankings.json"), JSON.stringify(finalRankings, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "caption_archives.json"), JSON.stringify(captionArchives, null, 2));
    console.log("\n--- Local file generation complete ---");
    console.log("Generated: historical_scores.json");
    console.log("Generated: final_rankings.json");
    console.log("Generated: caption_archives.json");

    await uploadCollection("historical_scores", historicalScores);
    await uploadCollection("final_rankings", finalRankings);
    await uploadCaptionArchives("caption_archives", captionArchives);
  } else {
    console.log("\n--- No data was parsed from the files. Check the file format and parser logic. ---");
  }

  console.log("\n--- All tasks complete ---");
};

main().catch(console.error);