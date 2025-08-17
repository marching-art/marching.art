const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Security Check: Ensure the user calling the function is an admin.
  if (context.auth.token.admin !== true) {
    return {
      error: "Request not authorized. User must be an admin to fulfill this request.",
    };
  }

  const email = data.email;
  const makeAdmin = data.makeAdmin; // This will be true or false

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: makeAdmin,
    });
    return {
      message: `Success! ${email} has been ${makeAdmin ? "made" : "removed as"} an admin.`,
    };
  } catch (err) {
    console.error(err);
    return {
      error: err.message,
    };
  }
});

exports.saveSchedule = functions.https.onCall(async (data, context) => {
  // Security Check: Ensure the user calling the function is an admin.
  if (context.auth.token.admin !== true) {
    return {
      error: "Request not authorized. User must be an admin to save schedules.",
    };
  }

  const { scheduleId, scheduleData } = data;

  if (!scheduleId || !scheduleData) {
    return { error: "Invalid data provided." };
  }

  try {
    await db.collection("schedules").doc(scheduleId).set(scheduleData);
    return { message: `Successfully saved schedule: ${scheduleData.name}` };
  } catch (err) {
    console.error("Error saving schedule:", err);
    return { error: "Failed to save schedule." };
  }
});

// --- SCHEDULED FUNCTION (Corrected Syntax) ---
// This is the main game engine. It runs automatically every day.
exports.runGameLoop = onSchedule("every day 05:00", async (event) => {
    console.log("Starting the daily game loop...");

    // --- 1. Determine Current Season and Week ---
    const now = new Date();
    const year = now.getFullYear();

    // DCI Finals is the second Saturday of August.
    const getSecondSaturdayOfAugust = (year) => {
        const firstOfMonth = new Date(year, 7, 1); // August 1st
        let dayOfWeek = firstOfMonth.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        let firstSaturday = 1 + (6 - dayOfWeek + 7) % 7;
        return new Date(year, 7, firstSaturday + 7);
    };

    const dciFinalsDate = getSecondSaturdayOfAugust(year);
    const liveSeasonEndDate = new Date(dciFinalsDate);
    liveSeasonEndDate.setDate(liveSeasonEndDate.getDate() + 1); // Season ends the day after finals

    // Live season is 10 weeks long.
    const liveSeasonStartDate = new Date(liveSeasonEndDate);
    liveSeasonStartDate.setDate(liveSeasonStartDate.getDate() - (10 * 7));

    let currentSeasonType = 'Off';
    let currentWeek = 0;
    
    if (now >= liveSeasonStartDate && now < liveSeasonEndDate) {
        currentSeasonType = 'Live';
        const diffTime = Math.abs(now - liveSeasonStartDate);
        currentWeek = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    } else {
        // Off-Season Logic (52 week cycle)
        const cycleStartDate = new Date(liveSeasonEndDate); // Off-season starts when live season ends
        const diffTime = Math.abs(now - cycleStartDate);
        const daysIntoCycle = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        currentWeek = Math.floor(daysIntoCycle / 7) + 1;
    }

    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    console.log(`Today is ${dayOfWeek}. Season Type: ${currentSeasonType}, Week: ${currentWeek}`);

    // --- 2. Get Today's Scheduled Events ---
    const scheduleId = currentSeasonType === 'Live' ? 'live_season_template' : 'off_season_template';
    const scheduleDoc = await db.collection("schedules").doc(scheduleId).get();

    if (!scheduleDoc.exists) {
        console.error(`Schedule not found: ${scheduleId}`);
        return null;
    }

    const scheduleData = scheduleDoc.data();
    const todaysEvents = scheduleData.events.filter(event => event.week === currentWeek && event.day === dayOfWeek);

    if (todaysEvents.length === 0) {
        console.log("No events scheduled for today.");
        return null;
    }
    
    console.log(`Found ${todaysEvents.length} events for today:`, todaysEvents.map(e => e.name).join(', '));

    // --- 3. Placeholder: Fetch Scores for Today's Events ---
    // In a future step, we will add web scraping logic here to get scores from dci.org.
    // The scraper will look for the event names defined in the schedule.
    // It will need to parse the results to get scores for each caption:
    // GE, Music Analysis, Visual Analysis, Brass, Percussion, etc.
    console.log("--- TODO: Fetch scores for today's events ---");


    // --- 4. Placeholder: Calculate Fantasy Points and Update Users ---
    // After fetching scores, we will loop through all users.
    // For each user, we'll look at their selected corps for the week.
    // We'll calculate their fantasy points based on the fetched scores and a defined scoring rubric.
    // Finally, we'll update their user profile in Firestore with the new points and log the transaction.
    console.log("--- TODO: Calculate fantasy points and update all users ---");

    console.log("Daily game loop finished.");
    return null;
});
