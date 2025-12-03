const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

/**
 * CorpsCoin earning amounts by class
 */
const CORPSCOIN_REWARDS = {
  soundSport: 0,
  aClass: 50,
  open: 100,
  world: 200,
};

/**
 * Class unlock costs with CorpsCoin
 */
const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000,
};

/**
 * Award CorpsCoin after performance (called by scoring functions)
 */
const awardCorpsCoin = async (uid, corpsClass, showName) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const amount = CORPSCOIN_REWARDS[corpsClass] || 0;
    if (amount === 0) return;

    await profileRef.update({
      corpsCoin: admin.firestore.FieldValue.increment(amount),
    });

    logger.info(`Awarded ${amount} CorpsCoin to user ${uid} for ${corpsClass} performance at ${showName}`);
  } catch (error) {
    logger.error(`Error awarding CorpsCoin to user ${uid}:`, error);
  }
};

/**
 * Unlock a class with CorpsCoin
 */
const unlockClassWithCorpsCoin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { classToUnlock } = request.data;
  const uid = request.auth.uid;

  if (!['aClass', 'open', 'world'].includes(classToUnlock)) {
    throw new HttpsError("invalid-argument", "Invalid class specified.");
  }

  const cost = CLASS_UNLOCK_COSTS[classToUnlock];
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const currentCoin = profileData.corpsCoin || 0;
      const unlockedClasses = profileData.unlockedClasses || ['soundSport'];

      if (unlockedClasses.includes(classToUnlock)) {
        throw new HttpsError("already-exists", "Class already unlocked.");
      }

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      unlockedClasses.push(classToUnlock);
      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        unlockedClasses: unlockedClasses,
      });
    });

    logger.info(`User ${uid} unlocked ${classToUnlock} with ${cost} CorpsCoin`);
    return {
      success: true,
      message: `${classToUnlock} unlocked!`,
      classUnlocked: classToUnlock,
    };
  } catch (error) {
    logger.error(`Error unlocking class for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to unlock class.");
  }
});

/**
 * Purchase staff member
 */
const purchaseStaff = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId } = request.data;
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const staffRef = db.doc(`staff_database/${staffId}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      const staffDoc = await transaction.get(staffRef);

      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      if (!staffDoc.exists) {
        throw new HttpsError("not-found", "Staff member not found.");
      }

      const profileData = profileDoc.data();
      const staffData = staffDoc.data();

      // Check if already owned
      const userStaff = profileData.staff || [];
      if (userStaff.some(s => s.staffId === staffId)) {
        throw new HttpsError("already-exists", "You already own this staff member.");
      }

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      const cost = staffData.baseValue || 100;

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      // Add staff to user's roster
      // Note: Cannot use FieldValue.serverTimestamp() inside arrays, so use Timestamp.now()
      const newStaffEntry = {
        staffId: staffId,
        name: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        biography: staffData.biography || '',
        baseValue: cost,
        purchaseDate: admin.firestore.Timestamp.now(),
        seasonsCompleted: 0,
        currentValue: cost,
        assignedTo: null, // Not assigned to any corps yet
      };

      userStaff.push(newStaffEntry);

      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        staff: userStaff,
      });

      return { staffData, cost };
    });

    logger.info(`User ${uid} purchased staff ${staffId} for ${result.cost} CorpsCoin`);
    return {
      success: true,
      message: `${result.staffData.name} added to your staff!`,
      staff: result.staffData,
    };
  } catch (error) {
    logger.error(`Error purchasing staff for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to purchase staff.");
  }
});

/**
 * Assign staff member to a corps
 * Caption is automatically derived from the staff member's specialty
 */
const assignStaff = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID is required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    let resultMessage;
    let corpsName = null;

    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const userStaff = profileData.staff || [];
      const staffMember = userStaff.find(s => s.staffId === staffId);

      if (!staffMember) {
        throw new HttpsError("not-found", "Staff member not found in your roster.");
      }

      // If corpsClass is null/undefined, unassign the staff member
      if (!corpsClass) {
        staffMember.assignedTo = null;
        resultMessage = "Staff member unassigned successfully!";
      } else {
        // Get the corps data to include corps name
        const userCorps = profileData.corps || {};
        const targetCorps = userCorps[corpsClass];

        if (!targetCorps) {
          throw new HttpsError("not-found", `No corps found for class ${corpsClass}.`);
        }

        corpsName = targetCorps.corpsName || targetCorps.name || corpsClass;

        // Assign to corps - includes corps name for display/history
        staffMember.assignedTo = {
          corpsClass: corpsClass,
          corpsName: corpsName,
          caption: staffMember.caption,
        };
        resultMessage = `Staff member assigned to ${corpsName}!`;
      }

      // Save updated staff array
      transaction.update(profileRef, {
        staff: userStaff,
      });
    });

    logger.info(`User ${uid} ${corpsClass ? 'assigned' : 'unassigned'} staff ${staffId}${corpsClass ? ` to ${corpsName || corpsClass}` : ''}`);
    return {
      success: true,
      message: resultMessage,
    };
  } catch (error) {
    logger.error(`Error assigning staff for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to assign staff.");
  }
});

/**
 * List available staff in marketplace (admin creates entries in staff_database)
 */
const getStaffMarketplace = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { caption } = request.data; // Optional filter by caption
  const db = getDb();

  try {
    let query = db.collection("staff_database");

    if (caption) {
      query = query.where("caption", "==", caption);
    }

    const snapshot = await query.get();
    const staffList = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Include staff that are explicitly available OR don't have the field set (legacy data)
      // Exclude only if available is explicitly set to false
      if (data.available !== false) {
        staffList.push({
          id: doc.id,
          ...data,
        });
      }
    });

    return {
      success: true,
      staff: staffList,
    };
  } catch (error) {
    logger.error("Error fetching staff marketplace:", error);
    throw new HttpsError("internal", "Failed to fetch staff marketplace.");
  }
});

/**
 * List a staff member for auction
 */
const listStaffForAuction = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, startingPrice, duration = 24 } = request.data; // duration in hours
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID is required.");
  }

  if (!startingPrice || startingPrice < 10) {
    throw new HttpsError("invalid-argument", "Starting price must be at least 10 CorpsCoin.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const auctionsRef = db.collection("staff_auctions");

  try {
    let auctionData;

    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const userStaff = profileData.staff || [];
      const staffIndex = userStaff.findIndex(s => s.staffId === staffId);

      if (staffIndex === -1) {
        throw new HttpsError("not-found", "Staff member not found in your roster.");
      }

      const staffMember = userStaff[staffIndex];

      if (staffMember.assignedTo) {
        throw new HttpsError("failed-precondition", "Staff member must be unassigned before listing.");
      }

      if (staffMember.forAuction) {
        throw new HttpsError("failed-precondition", "Staff member is already listed for auction.");
      }

      // Mark staff as for auction
      userStaff[staffIndex].forAuction = true;
      userStaff[staffIndex].auctionDate = admin.firestore.Timestamp.now();

      // Create auction listing
      const endsAt = new Date(Date.now() + duration * 60 * 60 * 1000);
      auctionData = {
        staffId,
        sellerId: uid,
        sellerUsername: profileData.username || profileData.displayName || 'Unknown',
        staffName: staffMember.name,
        staffCaption: staffMember.caption,
        staffValue: staffMember.currentValue || staffMember.baseValue,
        startingPrice,
        currentBid: null,
        currentBidderId: null,
        currentBidderName: null,
        bidHistory: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        endsAt: admin.firestore.Timestamp.fromDate(endsAt),
        status: 'active'
      };

      const auctionRef = auctionsRef.doc();
      transaction.set(auctionRef, auctionData);
      transaction.update(profileRef, { staff: userStaff });

      auctionData.auctionId = auctionRef.id;
    });

    logger.info(`User ${uid} listed staff ${staffId} for auction at ${startingPrice} CorpsCoin`);
    return {
      success: true,
      message: "Staff member listed for auction!",
      auction: auctionData
    };
  } catch (error) {
    logger.error(`Error listing staff for auction:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to list staff for auction.");
  }
});

/**
 * Place a bid on a staff auction
 */
const bidOnStaff = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { auctionId, bidAmount } = request.data;
  const uid = request.auth.uid;

  if (!auctionId || !bidAmount) {
    throw new HttpsError("invalid-argument", "Auction ID and bid amount are required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const auctionRef = db.doc(`staff_auctions/${auctionId}`);

  try {
    await db.runTransaction(async (transaction) => {
      const [profileDoc, auctionDoc] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(auctionRef)
      ]);

      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      if (!auctionDoc.exists) {
        throw new HttpsError("not-found", "Auction not found.");
      }

      const profileData = profileDoc.data();
      const auctionData = auctionDoc.data();

      // Check auction status
      if (auctionData.status !== 'active') {
        throw new HttpsError("failed-precondition", "This auction has ended.");
      }

      // Check auction hasn't expired
      if (auctionData.endsAt.toDate() < new Date()) {
        throw new HttpsError("failed-precondition", "This auction has expired.");
      }

      // Can't bid on own auction
      if (auctionData.sellerId === uid) {
        throw new HttpsError("failed-precondition", "You cannot bid on your own auction.");
      }

      // Check bid amount
      const minBid = auctionData.currentBid
        ? auctionData.currentBid + 10
        : auctionData.startingPrice;

      if (bidAmount < minBid) {
        throw new HttpsError("failed-precondition", `Minimum bid is ${minBid} CorpsCoin.`);
      }

      // Check balance
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < bidAmount) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${bidAmount}, have ${currentCoin}.`);
      }

      // Add to bid history
      const bidHistory = auctionData.bidHistory || [];
      bidHistory.push({
        bidderId: uid,
        bidderName: profileData.username || profileData.displayName || 'Unknown',
        amount: bidAmount,
        timestamp: admin.firestore.Timestamp.now()
      });

      // Update auction
      transaction.update(auctionRef, {
        currentBid: bidAmount,
        currentBidderId: uid,
        currentBidderName: profileData.username || profileData.displayName || 'Unknown',
        bidHistory
      });
    });

    logger.info(`User ${uid} bid ${bidAmount} CorpsCoin on auction ${auctionId}`);
    return {
      success: true,
      message: `Bid of ${bidAmount} CorpsCoin placed!`
    };
  } catch (error) {
    logger.error(`Error placing bid:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to place bid.");
  }
});

/**
 * Complete an auction (called when auction ends)
 */
const completeAuction = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { auctionId } = request.data;
  const uid = request.auth.uid;

  if (!auctionId) {
    throw new HttpsError("invalid-argument", "Auction ID is required.");
  }

  const db = getDb();
  const auctionRef = db.doc(`staff_auctions/${auctionId}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const auctionDoc = await transaction.get(auctionRef);

      if (!auctionDoc.exists) {
        throw new HttpsError("not-found", "Auction not found.");
      }

      const auctionData = auctionDoc.data();

      // Only seller can complete (or system for auto-complete)
      if (auctionData.sellerId !== uid) {
        throw new HttpsError("permission-denied", "Only the seller can complete this auction.");
      }

      if (auctionData.status !== 'active') {
        throw new HttpsError("failed-precondition", "Auction already completed.");
      }

      // Check if auction time has passed
      if (auctionData.endsAt.toDate() > new Date()) {
        throw new HttpsError("failed-precondition", "Auction has not ended yet.");
      }

      const sellerRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${auctionData.sellerId}/profile/data`);

      if (auctionData.currentBidderId) {
        // There's a winner - transfer staff and coins
        const buyerRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${auctionData.currentBidderId}/profile/data`);

        const [sellerDoc, buyerDoc] = await Promise.all([
          transaction.get(sellerRef),
          transaction.get(buyerRef)
        ]);

        const sellerData = sellerDoc.data();
        const buyerData = buyerDoc.data();

        // Remove staff from seller
        const sellerStaff = sellerData.staff || [];
        const staffIndex = sellerStaff.findIndex(s => s.staffId === auctionData.staffId);
        let staffMember = null;

        if (staffIndex !== -1) {
          staffMember = { ...sellerStaff[staffIndex] };
          staffMember.forAuction = false;
          staffMember.auctionDate = null;
          sellerStaff.splice(staffIndex, 1);
        }

        // Add staff to buyer
        const buyerStaff = buyerData.staff || [];
        if (staffMember) {
          staffMember.purchaseDate = admin.firestore.Timestamp.now();
          buyerStaff.push(staffMember);
        }

        // Transfer coins
        const sellerCoin = (sellerData.corpsCoin || 0) + auctionData.currentBid;
        const buyerCoin = (buyerData.corpsCoin || 0) - auctionData.currentBid;

        transaction.update(sellerRef, {
          staff: sellerStaff,
          corpsCoin: sellerCoin
        });

        transaction.update(buyerRef, {
          staff: buyerStaff,
          corpsCoin: buyerCoin
        });

        transaction.update(auctionRef, {
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          sold: true,
          winner: auctionData.currentBidderName,
          amount: auctionData.currentBid
        };
      } else {
        // No bids - return staff to seller
        const sellerDoc = await transaction.get(sellerRef);
        const sellerData = sellerDoc.data();
        const sellerStaff = sellerData.staff || [];
        const staffIndex = sellerStaff.findIndex(s => s.staffId === auctionData.staffId);

        if (staffIndex !== -1) {
          sellerStaff[staffIndex].forAuction = false;
          sellerStaff[staffIndex].auctionDate = null;
        }

        transaction.update(sellerRef, { staff: sellerStaff });
        transaction.update(auctionRef, {
          status: 'expired',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { sold: false };
      }
    });

    if (result.sold) {
      logger.info(`Auction ${auctionId} completed - sold to ${result.winner} for ${result.amount}`);
      return {
        success: true,
        message: `Auction complete! Sold to ${result.winner} for ${result.amount} CorpsCoin.`
      };
    } else {
      logger.info(`Auction ${auctionId} expired with no bids`);
      return {
        success: true,
        message: "Auction ended with no bids. Staff returned to your roster."
      };
    }
  } catch (error) {
    logger.error(`Error completing auction:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete auction.");
  }
});

/**
 * Get active auctions
 */
const getActiveAuctions = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { caption } = request.data; // Optional filter
  const db = getDb();

  try {
    let query = db.collection("staff_auctions")
      .where("status", "==", "active")
      .where("endsAt", ">", admin.firestore.Timestamp.now());

    if (caption) {
      query = query.where("staffCaption", "==", caption);
    }

    const snapshot = await query.orderBy("endsAt", "asc").get();
    const auctions = [];

    snapshot.forEach(doc => {
      auctions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      auctions
    };
  } catch (error) {
    logger.error("Error fetching auctions:", error);
    throw new HttpsError("internal", "Failed to fetch auctions.");
  }
});

/**
 * Cancel an auction (only if no bids)
 */
const cancelAuction = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { auctionId } = request.data;
  const uid = request.auth.uid;

  if (!auctionId) {
    throw new HttpsError("invalid-argument", "Auction ID is required.");
  }

  const db = getDb();
  const auctionRef = db.doc(`staff_auctions/${auctionId}`);
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const auctionDoc = await transaction.get(auctionRef);

      if (!auctionDoc.exists) {
        throw new HttpsError("not-found", "Auction not found.");
      }

      const auctionData = auctionDoc.data();

      if (auctionData.sellerId !== uid) {
        throw new HttpsError("permission-denied", "You can only cancel your own auctions.");
      }

      if (auctionData.status !== 'active') {
        throw new HttpsError("failed-precondition", "Auction is not active.");
      }

      if (auctionData.currentBid) {
        throw new HttpsError("failed-precondition", "Cannot cancel auction with existing bids.");
      }

      // Return staff to seller
      const profileDoc = await transaction.get(profileRef);
      const profileData = profileDoc.data();
      const userStaff = profileData.staff || [];
      const staffIndex = userStaff.findIndex(s => s.staffId === auctionData.staffId);

      if (staffIndex !== -1) {
        userStaff[staffIndex].forAuction = false;
        userStaff[staffIndex].auctionDate = null;
      }

      transaction.update(profileRef, { staff: userStaff });
      transaction.update(auctionRef, {
        status: 'cancelled',
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    logger.info(`User ${uid} cancelled auction ${auctionId}`);
    return {
      success: true,
      message: "Auction cancelled. Staff returned to your roster."
    };
  } catch (error) {
    logger.error(`Error cancelling auction:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to cancel auction.");
  }
});

module.exports = {
  awardCorpsCoin,
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
  listStaffForAuction,
  bidOnStaff,
  completeAuction,
  getActiveAuctions,
  cancelAuction,
};
