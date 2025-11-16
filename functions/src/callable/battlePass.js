const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

/**
 * Battle Pass Configuration
 */
const BATTLE_PASS_CONFIG = {
  price: 4.99, // $4.99 per season
  levelCap: 50, // Maximum level
  xpPerLevel: 100, // XP needed per level
  seasonDuration: 49, // Days per season (matches DCI off-season)
};

/**
 * XP Sources and Amounts
 */
const XP_SOURCES = {
  dailyRehearsal: 25,
  performance: 50,
  trophyWin: 100,
  finalsParticipation: 200,
  dailyQuest: 50,
  weeklyQuest: 150,
};

/**
 * Reward tiers with probabilities
 */
const REWARD_TIERS = {
  common: { weight: 50, corpsCoinRange: [50, 100] },
  uncommon: { weight: 30, corpsCoinRange: [100, 250] },
  rare: { weight: 15, corpsCoinRange: [250, 500] },
  epic: { weight: 4, corpsCoinRange: [500, 1000] },
  legendary: { weight: 1, corpsCoinRange: [1000, 2500] },
};

/**
 * Generate battle pass season rewards
 */
function generateSeasonRewards() {
  const rewards = [];

  for (let level = 1; level <= BATTLE_PASS_CONFIG.levelCap; level++) {
    const freeReward = generateReward('common', level);
    const premiumReward = generateReward(
      level % 10 === 0 ? 'legendary' :
      level % 5 === 0 ? 'epic' :
      'rare',
      level
    );

    rewards.push({
      level,
      free: freeReward,
      premium: premiumReward,
    });
  }

  return rewards;
}

/**
 * Generate a single reward based on tier
 */
function generateReward(tierName, level) {
  const tier = REWARD_TIERS[tierName];
  const [min, max] = tier.corpsCoinRange;
  const corpsCoin = Math.floor(Math.random() * (max - min + 1)) + min;

  const reward = {
    type: 'corpscoin',
    amount: corpsCoin,
    rarity: tierName,
  };

  // Special rewards at milestones
  if (level === 10) {
    reward.type = 'staff_pack';
    reward.amount = 1;
    reward.description = 'Rare Staff Member';
  } else if (level === 25) {
    reward.type = 'equipment_upgrade';
    reward.amount = 1;
    reward.description = 'Premium Equipment Upgrade';
  } else if (level === 50) {
    reward.type = 'exclusive_badge';
    reward.amount = 1;
    reward.description = 'Battle Pass Champion Badge';
    reward.badgeId = `bp_champion_${Date.now()}`;
  }

  return reward;
}

/**
 * Calculate current level from XP
 */
function calculateLevel(xp) {
  const level = Math.floor(xp / BATTLE_PASS_CONFIG.xpPerLevel) + 1;
  return Math.min(level, BATTLE_PASS_CONFIG.levelCap);
}

/**
 * Purchase Battle Pass - Create Stripe Checkout Session
 */
exports.purchaseBattlePass = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // Get current season
    const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
    if (!seasonDoc.exists) {
      throw new HttpsError("failed-precondition", "No active battle pass season.");
    }

    const currentSeason = seasonDoc.data();

    // Check if user already owns battle pass for this season
    const profileDoc = await profileRef.get();
    const battlePass = profileDoc.data()?.battlePass;

    if (battlePass?.seasonId === currentSeason.seasonId && battlePass?.isPremium) {
      throw new HttpsError("already-exists", "You already own this season's battle pass!");
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Battle Pass - ${currentSeason.name}`,
              description: `Unlock premium rewards for ${currentSeason.name}`,
              images: ['https://marching.art/assets/battlepass-icon.png'],
            },
            unit_amount: Math.round(BATTLE_PASS_CONFIG.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.rawRequest.headers.origin || 'https://marching.art'}/battlepass?success=true`,
      cancel_url: `${request.rawRequest.headers.origin || 'https://marching.art'}/battlepass?canceled=true`,
      client_reference_id: uid, // Link payment to user
      metadata: {
        uid: uid,
        seasonId: currentSeason.seasonId,
        type: 'battle_pass_purchase',
      },
    });

    logger.info(`Created Stripe session for user ${uid}: ${session.id}`);

    return {
      success: true,
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    logger.error(`Error creating checkout session for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to create checkout session.");
  }
});

/**
 * Award XP to user (called by other systems)
 */
exports.awardBattlePassXP = async (uid, xpAmount, source) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) return;

      const battlePass = profileDoc.data()?.battlePass;
      if (!battlePass || !battlePass.seasonId) {
        // Initialize battle pass if not present
        const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
        if (!seasonDoc.exists) return;

        const currentSeason = seasonDoc.data();
        transaction.update(profileRef, {
          'battlePass': {
            seasonId: currentSeason.seasonId,
            seasonName: currentSeason.name,
            xp: xpAmount,
            level: calculateLevel(xpAmount),
            isPremium: false,
            claimedRewards: {
              free: [],
              premium: [],
            },
          },
        });
        return;
      }

      // Add XP
      const newXP = (battlePass.xp || 0) + xpAmount;
      const newLevel = calculateLevel(newXP);

      transaction.update(profileRef, {
        'battlePass.xp': newXP,
        'battlePass.level': newLevel,
      });

      // Log XP history
      transaction.update(profileRef, {
        'battlePass.xpHistory': admin.firestore.FieldValue.arrayUnion({
          amount: xpAmount,
          source,
          timestamp: new Date(),
          totalXP: newXP,
        }),
      });
    });

    logger.info(`Awarded ${xpAmount} XP to ${uid} from ${source}`);
  } catch (error) {
    logger.error(`Error awarding XP to ${uid}:`, error);
  }
};

/**
 * Claim Reward - Claim earned battle pass reward
 */
exports.claimBattlePassReward = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { level, tier } = request.data; // tier: 'free' or 'premium'
  const uid = request.auth.uid;

  if (!level || !tier || !['free', 'premium'].includes(tier)) {
    throw new HttpsError("invalid-argument", "Level and tier (free/premium) required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const battlePass = profileData.battlePass;

      if (!battlePass) {
        throw new HttpsError("failed-precondition", "No active battle pass.");
      }

      // Check if user has reached this level
      if (battlePass.level < level) {
        throw new HttpsError("failed-precondition", `You must reach level ${level} first.`);
      }

      // Check if premium tier and user doesn't own battle pass
      if (tier === 'premium' && !battlePass.isPremium) {
        throw new HttpsError("failed-precondition", "You must own the Battle Pass to claim premium rewards.");
      }

      // Check if already claimed
      const claimedRewards = battlePass.claimedRewards || { free: [], premium: [] };
      if (claimedRewards[tier]?.includes(level)) {
        throw new HttpsError("already-exists", "Reward already claimed.");
      }

      // Get season rewards
      const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
      if (!seasonDoc.exists || battlePass.seasonId !== seasonDoc.data().seasonId) {
        throw new HttpsError("failed-precondition", "Season mismatch or expired.");
      }

      const seasonData = seasonDoc.data();
      const levelReward = seasonData.rewards.find(r => r.level === level);

      if (!levelReward) {
        throw new HttpsError("not-found", "Reward not found.");
      }

      const reward = levelReward[tier];

      // Apply reward
      const updates = {
        [`battlePass.claimedRewards.${tier}`]: admin.firestore.FieldValue.arrayUnion(level),
      };

      switch (reward.type) {
        case 'corpscoin':
          updates.corpsCoin = admin.firestore.FieldValue.increment(reward.amount);
          break;

        case 'staff_pack':
          // Award a random rare staff member
          updates['battlePass.pendingStaffPacks'] = admin.firestore.FieldValue.increment(1);
          break;

        case 'equipment_upgrade':
          updates['battlePass.pendingEquipmentUpgrades'] = admin.firestore.FieldValue.increment(1);
          break;

        case 'exclusive_badge':
          updates.badges = admin.firestore.FieldValue.arrayUnion({
            badgeId: reward.badgeId,
            name: reward.description,
            earnedDate: new Date(),
            season: battlePass.seasonName,
          });
          break;
      }

      transaction.update(profileRef, updates);

      return {
        reward,
        level,
        tier,
      };
    });

    logger.info(`User ${uid} claimed ${tier} reward at level ${level}`);
    return {
      success: true,
      message: `Claimed ${result.reward.type}!`,
      reward: result.reward,
    };
  } catch (error) {
    logger.error(`Error claiming reward for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to claim reward.");
  }
});

/**
 * Get Battle Pass Progress
 */
exports.getBattlePassProgress = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const [profileDoc, seasonDoc] = await Promise.all([
      profileRef.get(),
      db.doc("game-settings/battlePassSeason").get(),
    ]);

    if (!seasonDoc.exists) {
      throw new HttpsError("failed-precondition", "No active battle pass season.");
    }

    const currentSeason = seasonDoc.data();
    const battlePass = profileDoc.data()?.battlePass;

    // Initialize if not present
    if (!battlePass || battlePass.seasonId !== currentSeason.seasonId) {
      return {
        success: true,
        season: currentSeason,
        progress: {
          seasonId: currentSeason.seasonId,
          seasonName: currentSeason.name,
          xp: 0,
          level: 1,
          isPremium: false,
          claimedRewards: {
            free: [],
            premium: [],
          },
        },
      };
    }

    // Calculate progress to next level
    const currentLevelXP = (battlePass.level - 1) * BATTLE_PASS_CONFIG.xpPerLevel;
    const xpTowardsNextLevel = battlePass.xp - currentLevelXP;
    const xpNeededForNextLevel = BATTLE_PASS_CONFIG.xpPerLevel;
    const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;

    return {
      success: true,
      season: currentSeason,
      progress: {
        ...battlePass,
        xpTowardsNextLevel,
        xpNeededForNextLevel,
        progressPercentage: Math.min(100, progressPercentage),
      },
    };
  } catch (error) {
    logger.error(`Error getting battle pass progress for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get battle pass progress.");
  }
});

/**
 * Get Available Rewards to Claim
 */
exports.getAvailableRewards = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileRef.get();
    const battlePass = profileDoc.data()?.battlePass;

    if (!battlePass) {
      return { success: true, rewards: [] };
    }

    const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
    if (!seasonDoc.exists || battlePass.seasonId !== seasonDoc.data().seasonId) {
      return { success: true, rewards: [] };
    }

    const seasonData = seasonDoc.data();
    const claimedRewards = battlePass.claimedRewards || { free: [], premium: [] };
    const availableRewards = [];

    // Find unclaimed rewards up to current level
    for (let level = 1; level <= battlePass.level; level++) {
      const levelReward = seasonData.rewards.find(r => r.level === level);
      if (!levelReward) continue;

      if (!claimedRewards.free.includes(level)) {
        availableRewards.push({
          level,
          tier: 'free',
          reward: levelReward.free,
        });
      }

      if (battlePass.isPremium && !claimedRewards.premium.includes(level)) {
        availableRewards.push({
          level,
          tier: 'premium',
          reward: levelReward.premium,
        });
      }
    }

    return {
      success: true,
      rewards: availableRewards,
    };
  } catch (error) {
    logger.error(`Error getting available rewards for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get available rewards.");
  }
});

module.exports = {
  purchaseBattlePass,
  awardBattlePassXP,
  claimBattlePassReward,
  getBattlePassProgress,
  getAvailableRewards,
  generateSeasonRewards,
  BATTLE_PASS_CONFIG,
  XP_SOURCES,
};
