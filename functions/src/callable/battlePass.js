const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

// Lazy-load Stripe to avoid initialization errors during deployment
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable not set");
    }
    _stripe = require("stripe")(stripeKey);
  }
  return _stripe;
}

/**
 * Battle Pass Configuration
 * Streamlined: 50 levels, entire season to complete, no daily pressure
 */
const BATTLE_PASS_CONFIG = {
  price: 4.99,
  levelCap: 50,
  xpPerLevel: 180, // Balanced for ~13 weeks of casual play
  seasonDuration: 91, // ~3 months per season
};

/**
 * XP Sources - Weekly/Seasonal only (NO daily requirements)
 * Designed to be completable with casual weekly participation
 */
const XP_SOURCES = {
  weeklyShowParticipation: 50,  // Participate in any weekly show
  leagueMatchupWin: 100,        // Win a league matchup
  seasonPlacementBonus: {       // End-of-season bonus based on placement
    top10: 500,
    top25: 300,
    top50: 150,
    participated: 50,
  },
};

/**
 * Simplified Reward Structure
 * Free: CorpsCoin + basic badges
 * Premium: More CC + exclusive cosmetics
 */
const REWARD_CONFIG = {
  free: {
    baseCorpsCoin: 25,      // Base CC per level
    milestoneMultiplier: 3, // 3x CC at milestones
  },
  premium: {
    baseCorpsCoin: 75,      // Premium gets 3x base CC
    milestoneMultiplier: 4, // 4x CC at milestones
  },
  milestones: [10, 25, 50], // Special reward levels
};

/**
 * Generate battle pass season rewards
 * Simplified: Clear free/premium tracks with milestone bonuses
 */
function generateSeasonRewards() {
  const rewards = [];

  for (let level = 1; level <= BATTLE_PASS_CONFIG.levelCap; level++) {
    const isMilestone = REWARD_CONFIG.milestones.includes(level);

    rewards.push({
      level,
      free: generateFreeReward(level, isMilestone),
      premium: generatePremiumReward(level, isMilestone),
    });
  }

  return rewards;
}

/**
 * Generate free track reward
 */
function generateFreeReward(level, isMilestone) {
  const { baseCorpsCoin, milestoneMultiplier } = REWARD_CONFIG.free;

  if (isMilestone) {
    // Milestone rewards: badge + bonus CC
    if (level === 10) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier },
          { type: 'badge', badgeId: 'bp_rookie', name: 'Season Rookie', rarity: 'uncommon' },
        ],
        rarity: 'uncommon',
      };
    } else if (level === 25) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier },
          { type: 'badge', badgeId: 'bp_veteran', name: 'Season Veteran', rarity: 'rare' },
        ],
        rarity: 'rare',
      };
    } else if (level === 50) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier * 2 },
          { type: 'badge', badgeId: 'bp_champion', name: 'Season Champion', rarity: 'epic' },
        ],
        rarity: 'epic',
      };
    }
  }

  // Regular levels: just CC
  return {
    type: 'corpscoin',
    amount: baseCorpsCoin,
    rarity: 'common',
  };
}

/**
 * Generate premium track reward
 */
function generatePremiumReward(level, isMilestone) {
  const { baseCorpsCoin, milestoneMultiplier } = REWARD_CONFIG.premium;

  if (isMilestone) {
    // Premium milestones: exclusive cosmetics + more CC
    if (level === 10) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier },
          { type: 'cosmetic', cosmeticId: 'field_gold_trim', name: 'Gold Field Trim', rarity: 'rare' },
        ],
        rarity: 'rare',
      };
    } else if (level === 25) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier },
          { type: 'cosmetic', cosmeticId: 'uniform_platinum', name: 'Platinum Uniform Set', rarity: 'epic' },
        ],
        rarity: 'epic',
      };
    } else if (level === 50) {
      return {
        type: 'milestone_bundle',
        rewards: [
          { type: 'corpscoin', amount: baseCorpsCoin * milestoneMultiplier * 2 },
          { type: 'cosmetic', cosmeticId: 'banner_legendary', name: 'Legendary Corps Banner', rarity: 'legendary' },
          { type: 'badge', badgeId: 'bp_elite', name: 'Elite Completionist', rarity: 'legendary' },
        ],
        rarity: 'legendary',
      };
    }
  }

  // Regular premium levels: bonus CC
  return {
    type: 'corpscoin',
    amount: baseCorpsCoin,
    rarity: 'uncommon',
  };
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
 * Non-pressuring: optional upgrade that enhances rewards
 */
const purchaseBattlePass = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
    if (!seasonDoc.exists) {
      throw new HttpsError("failed-precondition", "No active battle pass season.");
    }

    const currentSeason = seasonDoc.data();

    const profileDoc = await profileRef.get();
    const battlePass = profileDoc.data()?.battlePass;

    if (battlePass?.seasonId === currentSeason.seasonId && battlePass?.isPremium) {
      throw new HttpsError("already-exists", "You already own this season's battle pass!");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Premium Battle Pass - ${currentSeason.name}`,
              description: 'Unlock bonus rewards and exclusive cosmetics',
              images: ['https://marching.art/assets/battlepass-icon.png'],
            },
            unit_amount: Math.round(BATTLE_PASS_CONFIG.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.rawRequest.headers.origin || 'https://marching.art'}/battlepass?success=true`,
      cancel_url: `${request.rawRequest.headers.origin || 'https://marching.art'}/battlepass?canceled=true`,
      client_reference_id: uid,
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
 * Only from weekly/seasonal activities - no daily grind
 */
const awardBattlePassXP = async (uid, xpAmount, source) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) return;

      const battlePass = profileDoc.data()?.battlePass;
      if (!battlePass || !battlePass.seasonId) {
        const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
        if (!seasonDoc.exists) return;

        const currentSeason = seasonDoc.data();
        transaction.update(profileRef, {
          'battlePass': {
            seasonId: currentSeason.seasonId,
            seasonName: currentSeason.name,
            xp: xpAmount,
            totalXpEarned: xpAmount,
            level: calculateLevel(xpAmount),
            isPremium: false,
            claimedRewards: {
              free: [],
              premium: [],
            },
            xpHistory: [{
              amount: xpAmount,
              source,
              timestamp: new Date(),
            }],
          },
        });
        return;
      }

      const newXP = (battlePass.xp || 0) + xpAmount;
      const newLevel = calculateLevel(newXP);

      transaction.update(profileRef, {
        'battlePass.xp': newXP,
        'battlePass.totalXpEarned': (battlePass.totalXpEarned || 0) + xpAmount,
        'battlePass.level': newLevel,
        'battlePass.xpHistory': admin.firestore.FieldValue.arrayUnion({
          amount: xpAmount,
          source,
          timestamp: new Date(),
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
 * Handles both simple rewards and milestone bundles
 */
const claimBattlePassReward = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { level, tier } = request.data;
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
      let battlePass = profileData.battlePass;

      const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
      if (!seasonDoc.exists) {
        throw new HttpsError("failed-precondition", "No active battle pass season.");
      }
      const currentSeason = seasonDoc.data();

      if (!battlePass && tier === 'free') {
        battlePass = {
          seasonId: currentSeason.seasonId,
          seasonName: currentSeason.name,
          xp: 0,
          totalXpEarned: 0,
          level: 1,
          isPremium: false,
          claimedRewards: { free: [], premium: [] },
        };
        transaction.update(profileRef, { battlePass });
      }

      if (!battlePass) {
        throw new HttpsError("failed-precondition", "No active battle pass.");
      }

      if (battlePass.level < level) {
        throw new HttpsError("failed-precondition", `You must reach level ${level} first.`);
      }

      if (tier === 'premium' && !battlePass.isPremium) {
        throw new HttpsError("failed-precondition", "You must own the Battle Pass to claim premium rewards.");
      }

      const claimedRewards = battlePass.claimedRewards || { free: [], premium: [] };
      if (claimedRewards[tier]?.includes(level)) {
        throw new HttpsError("already-exists", "Reward already claimed.");
      }

      if (battlePass.seasonId !== currentSeason.seasonId) {
        throw new HttpsError("failed-precondition", "Season mismatch or expired.");
      }

      const seasonData = seasonDoc.data();
      const levelReward = seasonData.rewards.find(r => r.level === level);

      if (!levelReward) {
        throw new HttpsError("not-found", "Reward not found.");
      }

      const reward = levelReward[tier];
      const updates = {
        [`battlePass.claimedRewards.${tier}`]: admin.firestore.FieldValue.arrayUnion(level),
      };

      // Handle reward types
      if (reward.type === 'milestone_bundle') {
        // Process each reward in the bundle
        for (const r of reward.rewards) {
          applyReward(r, updates, battlePass);
        }
      } else {
        applyReward(reward, updates, battlePass);
      }

      transaction.update(profileRef, updates);

      return { reward, level, tier };
    });

    logger.info(`User ${uid} claimed ${tier} reward at level ${level}`);
    return {
      success: true,
      message: result.reward.type === 'milestone_bundle'
        ? 'Claimed milestone rewards!'
        : `Claimed ${result.reward.type}!`,
      reward: result.reward,
    };
  } catch (error) {
    logger.error(`Error claiming reward for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to claim reward.");
  }
});

/**
 * Apply a single reward to the user profile updates
 */
function applyReward(reward, updates, battlePass) {
  switch (reward.type) {
    case 'corpscoin':
      updates.corpsCoin = admin.firestore.FieldValue.increment(reward.amount);
      break;
    case 'badge':
      updates.badges = admin.firestore.FieldValue.arrayUnion({
        badgeId: reward.badgeId,
        name: reward.name,
        rarity: reward.rarity,
        earnedDate: new Date(),
        season: battlePass.seasonName,
      });
      break;
    case 'cosmetic':
      updates.cosmetics = admin.firestore.FieldValue.arrayUnion({
        cosmeticId: reward.cosmeticId,
        name: reward.name,
        rarity: reward.rarity,
        earnedDate: new Date(),
        season: battlePass.seasonName,
      });
      break;
  }
}

/**
 * Get Battle Pass Progress
 */
const getBattlePassProgress = onCall({ cors: true }, async (request) => {
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

    const now = new Date();
    const endDate = currentSeason.endDate.toDate();
    const startDate = currentSeason.startDate?.toDate() || new Date(endDate - BATTLE_PASS_CONFIG.seasonDuration * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const weeksRemaining = Math.ceil(daysRemaining / 7);

    if (!battlePass || battlePass.seasonId !== currentSeason.seasonId) {
      return {
        success: true,
        season: {
          ...currentSeason,
          daysRemaining,
          weeksRemaining,
          totalDays,
        },
        progress: {
          seasonId: currentSeason.seasonId,
          seasonName: currentSeason.name,
          xp: 0,
          totalXpEarned: 0,
          level: 1,
          isPremium: false,
          claimedRewards: { free: [], premium: [] },
          xpTowardsNextLevel: 0,
          xpNeededForNextLevel: BATTLE_PASS_CONFIG.xpPerLevel,
          progressPercentage: 0,
          overallProgress: 0,
        },
      };
    }

    const currentLevelXP = (battlePass.level - 1) * BATTLE_PASS_CONFIG.xpPerLevel;
    const xpTowardsNextLevel = battlePass.xp - currentLevelXP;
    const xpNeededForNextLevel = BATTLE_PASS_CONFIG.xpPerLevel;
    const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
    const overallProgress = ((battlePass.level - 1) / BATTLE_PASS_CONFIG.levelCap) * 100 + (progressPercentage / BATTLE_PASS_CONFIG.levelCap);

    return {
      success: true,
      season: {
        ...currentSeason,
        daysRemaining,
        weeksRemaining,
        totalDays,
      },
      progress: {
        ...battlePass,
        xpTowardsNextLevel,
        xpNeededForNextLevel,
        progressPercentage: Math.min(100, progressPercentage),
        overallProgress: Math.min(100, overallProgress),
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
const getAvailableRewards = onCall({ cors: true }, async (request) => {
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
  REWARD_CONFIG,
};
