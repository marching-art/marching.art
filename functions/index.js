const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

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

// --- NEW FUNCTION ---
// This function saves a season schedule to Firestore.
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
    const db = admin.firestore();
    await db.collection("schedules").doc(scheduleId).set(scheduleData);
    return { message: `Successfully saved schedule: ${scheduleData.name}` };
  } catch (err) {
    console.error("Error saving schedule:", err);
    return { error: "Failed to save schedule." };
  }
});
