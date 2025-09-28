const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config");

/**
 * Purchase a staff member from the hall of fame database
 */
exports.purchaseStaffMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId } = data;
  const uid = context.auth.uid;

  if (!staffId) {
    throw new functions.https.HttpsError("invalid-argument", "Staff ID is required.");
  }

  try {
    // Get the staff member details
    const staffRef = admin.firestore().doc(`staff/${staffId}`);
    const staffSnap = await staffRef.get();
    
    if (!staffSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Staff member not found.");
    }

    const staffData = staffSnap.data();
    const baseValue = calculateBaseValue(staffData.yearInducted);

    // Get user profile to check CorpsCoin balance
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    const userSnap = await userProfileRef.get();
    
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data();
    const currentCorpsCoin = userData.corpsCoin || 0;

    if (currentCorpsCoin < baseValue) {
      throw new functions.https.HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${baseValue}, have ${currentCorpsCoin}.`);
    }

    // Check if user already owns this staff member
    const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
    const existingStaff = await userStaffRef.get();
    
    if (existingStaff.exists) {
      throw new functions.https.HttpsError("already-exists", "You already own this staff member.");
    }

    // Perform the transaction
    await admin.firestore().runTransaction(async (transaction) => {
      // Deduct CorpsCoin
      transaction.update(userProfileRef, {
        corpsCoin: currentCorpsCoin - baseValue,
        lastPurchase: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add staff member to user's collection
      transaction.set(userStaffRef, {
        ...staffData,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        purchasePrice: baseValue,
        experienceLevel: 1,
        appliedToCaption: null,
        seasonStats: {
          performancesCompleted: 0,
          bonusPointsEarned: 0
        }
      });

      // Log the transaction
      const transactionRef = admin.firestore().collection('corpscoin_transactions').doc();
      transaction.set(transactionRef, {
        userId: uid,
        type: 'staff_purchase',
        amount: -baseValue,
        staffId: staffId,
        staffName: staffData.name,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        newBalance: currentCorpsCoin - baseValue
      });
    });

    return { 
      success: true, 
      message: `Successfully purchased ${staffData.name} for ${baseValue} CorpsCoin!`,
      newBalance: currentCorpsCoin - baseValue
    };

  } catch (error) {
    console.error("Error purchasing staff member:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while purchasing staff member.");
  }
});

/**
 * Apply a staff member to a caption
 */
exports.applyStaffToCaption = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, caption } = data;
  const uid = context.auth.uid;

  const validCaptions = ['GE1', 'GE2', 'Visual Proficiency', 'Visual Analysis', 'Color Guard', 'Brass', 'Music Analysis', 'Percussion'];
  
  if (!staffId || !caption || !validCaptions.includes(caption)) {
    throw new functions.https.HttpsError("invalid-argument", "Valid staff ID and caption are required.");
  }

  try {
    const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
    const staffSnap = await userStaffRef.get();
    
    if (!staffSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Staff member not found in your collection.");
    }

    const staffData = staffSnap.data();
    
    // Check if staff member's caption matches the requested caption
    if (staffData.caption && staffData.caption !== caption) {
      throw new functions.https.HttpsError("failed-precondition", 
        `This staff member specializes in ${staffData.caption}, not ${caption}.`);
    }

    // Update the lineup in the user's profile
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const profileSnap = await transaction.get(userProfileRef);
      
      if (!profileSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileSnap.data();
      const currentStaffAssignments = profileData.staffAssignments || {};

      // Remove staff from previous caption if assigned
      Object.keys(currentStaffAssignments).forEach(cap => {
        if (currentStaffAssignments[cap] === staffId) {
          delete currentStaffAssignments[cap];
        }
      });

      // Assign staff to new caption
      currentStaffAssignments[caption] = staffId;

      // Update profile
      transaction.update(userProfileRef, {
        staffAssignments: currentStaffAssignments
      });

      // Update staff member record
      transaction.update(userStaffRef, {
        appliedToCaption: caption,
        lastApplied: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { 
      success: true, 
      message: `${staffData.name} successfully applied to ${caption}!`
    };

  } catch (error) {
    console.error("Error applying staff to caption:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while applying staff member.");
  }
});

/**
 * List a staff member on the marketplace
 */
exports.listStaffOnMarketplace = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, price } = data;
  const uid = context.auth.uid;

  if (!staffId || !price || price < 100 || price > 50000) {
    throw new functions.https.HttpsError("invalid-argument", "Valid staff ID and price (100-50000) are required.");
  }

  try {
    const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
    const staffSnap = await userStaffRef.get();
    
    if (!staffSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Staff member not found in your collection.");
    }

    const staffData = staffSnap.data();

    // Get user profile for seller info
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    const userSnap = await userProfileRef.get();
    const userData = userSnap.data();

    // Create marketplace listing
    const listingRef = admin.firestore().collection('staff_marketplace').doc();
    
    await admin.firestore().runTransaction(async (transaction) => {
      // Create listing
      transaction.set(listingRef, {
        staffId: staffId,
        sellerId: uid,
        sellerName: userData.corps?.alias || userData.displayName || 'Anonymous',
        staffName: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        biography: staffData.biography,
        experienceLevel: staffData.experienceLevel || 1,
        price: price,
        listedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });

      // Remove staff from user's collection (they're selling it)
      transaction.delete(userStaffRef);

      // Remove from caption assignment if applied
      const profileData = userData;
      const currentStaffAssignments = profileData.staffAssignments || {};
      
      Object.keys(currentStaffAssignments).forEach(caption => {
        if (currentStaffAssignments[caption] === staffId) {
          delete currentStaffAssignments[caption];
        }
      });

      transaction.update(userProfileRef, {
        staffAssignments: currentStaffAssignments
      });
    });

    return { 
      success: true, 
      message: `${staffData.name} listed on marketplace for ${price} CorpsCoin!`
    };

  } catch (error) {
    console.error("Error listing staff on marketplace:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while listing staff member.");
  }
});

/**
 * Purchase a staff member from the marketplace
 */
exports.purchaseFromMarketplace = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { listingId } = data;
  const uid = context.auth.uid;

  if (!listingId) {
    throw new functions.https.HttpsError("invalid-argument", "Listing ID is required.");
  }

  try {
    const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
    const listingSnap = await listingRef.get();
    
    if (!listingSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Marketplace listing not found.");
    }

    const listingData = listingSnap.data();
    
    if (!listingData.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "This listing is no longer active.");
    }

    if (listingData.sellerId === uid) {
      throw new functions.https.HttpsError("failed-precondition", "You cannot purchase your own listing.");
    }

    // Get buyer profile
    const buyerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    const buyerSnap = await buyerProfileRef.get();
    
    if (!buyerSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Buyer profile not found.");
    }

    const buyerData = buyerSnap.data();
    const buyerCorpsCoin = buyerData.corpsCoin || 0;

    if (buyerCorpsCoin < listingData.price) {
      throw new functions.https.HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${listingData.price}, have ${buyerCorpsCoin}.`);
    }

    // Get seller profile
    const sellerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${listingData.sellerId}/profile/data`);

    // Perform the transaction
    await admin.firestore().runTransaction(async (transaction) => {
      const sellerSnap = await transaction.get(sellerProfileRef);
      const sellerData = sellerSnap.exists ? sellerSnap.data() : {};
      const sellerCorpsCoin = sellerData.corpsCoin || 0;

      // Transfer CorpsCoin
      transaction.update(buyerProfileRef, {
        corpsCoin: buyerCorpsCoin - listingData.price
      });

      transaction.update(sellerProfileRef, {
        corpsCoin: sellerCorpsCoin + listingData.price
      });

      // Add staff to buyer's collection
      const buyerStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${listingData.staffId}`);
      
      transaction.set(buyerStaffRef, {
        name: listingData.staffName,
        caption: listingData.caption,
        yearInducted: listingData.yearInducted,
        biography: listingData.biography,
        experienceLevel: listingData.experienceLevel,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        purchasePrice: listingData.price,
        purchaseSource: 'marketplace',
        appliedToCaption: null,
        seasonStats: {
          performancesCompleted: 0,
          bonusPointsEarned: 0
        }
      });

      // Deactivate the listing
      transaction.update(listingRef, {
        isActive: false,
        soldAt: admin.firestore.FieldValue.serverTimestamp(),
        buyerId: uid
      });

      // Log transactions
      const buyerTransactionRef = admin.firestore().collection('corpscoin_transactions').doc();
      transaction.set(buyerTransactionRef, {
        userId: uid,
        type: 'marketplace_purchase',
        amount: -listingData.price,
        staffId: listingData.staffId,
        staffName: listingData.staffName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        newBalance: buyerCorpsCoin - listingData.price
      });

      const sellerTransactionRef = admin.firestore().collection('corpscoin_transactions').doc();
      transaction.set(sellerTransactionRef, {
        userId: listingData.sellerId,
        type: 'marketplace_sale',
        amount: listingData.price,
        staffId: listingData.staffId,
        staffName: listingData.staffName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        newBalance: sellerCorpsCoin + listingData.price
      });
    });

    return { 
      success: true, 
      message: `Successfully purchased ${listingData.staffName} for ${listingData.price} CorpsCoin!`,
      newBalance: buyerCorpsCoin - listingData.price
    };

  } catch (error) {
    console.error("Error purchasing from marketplace:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while purchasing from marketplace.");
  }
});

/**
 * Helper function to calculate staff base value based on year inducted
 */
function calculateBaseValue(yearInducted) {
  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - (yearInducted || 2020);
  // More recent inductees are more valuable
  return Math.max(500, 2000 - (yearsAgo * 100));
}