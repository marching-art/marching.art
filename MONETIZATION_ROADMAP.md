# Monetization Roadmap
## marching.art — Premium Features Without Pay-to-Win

**Created:** December 30, 2025
**Philosophy:** Enhance, don't gate. Delight, don't exploit.
**Models:** Discord Nitro, Sleeper Premium, Duolingo Super

---

## Executive Summary

This roadmap outlines a **freemium monetization strategy** that:

1. **Preserves core gameplay** — All fantasy mechanics remain free forever
2. **Offers cosmetic enhancements** — Visual customization, not competitive advantage
3. **Provides convenience upgrades** — Quality-of-life, not must-haves
4. **Creates sustainable revenue** — Multiple small purchases vs. one-time payments

**Revenue Projection (Year 1):**
| Source | Conversion | ARPU | Monthly |
|--------|------------|------|---------|
| Battle Pass | 5% of 1000 users | $4.99 | $250 |
| CorpsCoin Bundles | 2% | $5 avg | $100 |
| Cosmetics Store | 3% | $3 avg | $90 |
| Premium Subscription | 2% | $3.99/mo | $80 |
| **Total** | — | — | **~$520/mo** |

At 10,000 users: **~$5,200/month** ($62K/year)

---

## Part 1: Monetization Philosophy

### The Discord Nitro Model

Discord's freemium success comes from:

| Principle | Discord Implementation | marching.art Application |
|-----------|------------------------|--------------------------|
| **Core is forever free** | All chat/voice free | All fantasy gameplay free |
| **Cosmetics are premium** | Animated avatars, custom emoji | Corps uniforms, profile badges |
| **Enhanced limits** | File size, stream quality | Extra streak freezes, lineup slots |
| **Social expression** | Profile banners, custom status | Season cards, achievement showcases |
| **No competitive advantage** | Nitro users can't "win" more | Premium users score the same |

### The Sleeper Premium Model

Sleeper's fantasy sports monetization:

| Feature | Free | Premium |
|---------|------|---------|
| Leagues | ✅ | ✅ |
| Live scoring | ✅ | ✅ |
| Custom team colors | ❌ | ✅ |
| Advanced projections | Basic | Detailed |
| Offline draft | ❌ | ✅ |
| No ads | ❌ | ✅ |

### The Duolingo Super Model

Gamification monetization:

| Feature | Free | Super |
|---------|------|-------|
| All lessons | ✅ | ✅ |
| Streak repair | 1 free | Unlimited |
| Streak freeze | Purchasable | Free monthly |
| Mistake protection | ❌ | ✅ |
| Progress insights | Basic | Detailed |

---

## Part 2: Product Catalog

### Tier 1: Battle Pass ($4.99/season)

**What it is:** 50-level progression track with exclusive rewards
**Duration:** One DCI season (~12 weeks live + off-season)
**Value proposition:** "Get more from every show you attend"

#### Reward Structure

| Level | Free Track | Premium Track |
|-------|------------|---------------|
| 1 | 50 CC | Animated Corps Card |
| 5 | Profile Badge | 100 CC + Exclusive Badge |
| 10 | 100 CC | Rare Uniform Color |
| 15 | — | Streak Freeze Token |
| 20 | 150 CC | Epic Profile Banner |
| 25 | Achievement | 250 CC + Title |
| 30 | — | Streak Freeze Token |
| 35 | 200 CC | Legendary Badge |
| 40 | — | Custom Season Card |
| 45 | 300 CC | Streak Freeze Token |
| 50 | Title | 500 CC + Exclusive Finale Reward |

**Total Free Track Value:** 800 CC + badges
**Total Premium Track Value:** 850 CC + 3 Streak Freezes + cosmetics worth ~$15

#### Progression System

```javascript
// XP sources for Battle Pass (separate from profile XP)
const BATTLE_PASS_XP = {
  dailyLogin: 50,
  showAttendance: 100,
  leagueMatchupWin: 75,
  weeklyChallenge: 200,
  achievementUnlock: 150,
};

// 50 levels, 500 XP each = 25,000 total XP needed
// Active player earns ~500-700 XP/day = ~5-7 weeks to complete
```

---

### Tier 2: CorpsCoin Bundles (Direct Purchase)

**What it is:** Skip the grind, buy currency directly
**Philosophy:** Time-savers, not power-ups

| Bundle | Price | CC Amount | Bonus | CC/$ |
|--------|-------|-----------|-------|------|
| Starter | $2.99 | 500 | — | 167 |
| Standard | $7.99 | 1,750 | +250 (17%) | 219 |
| Value | $14.99 | 4,000 | +1,000 (33%) | 267 |
| Ultimate | $29.99 | 10,000 | +4,000 (67%) | 333 |

**Use Cases:**
- Faster class unlocks (A: 1000 CC, Open: 2500 CC, World: 5000 CC)
- Streak freeze purchases (300 CC each)
- Future cosmetics store purchases

**No Pay-to-Win Safeguard:**
- CorpsCoin cannot buy better scores
- CorpsCoin cannot buy exclusive gameplay content
- CorpsCoin can only buy convenience + cosmetics

---

### Tier 3: Cosmetics Store (Individual Items)

**What it is:** À la carte visual customization
**Revenue model:** Micro-transactions ($0.99 - $4.99)

#### Corps Customization

| Item | Price | Description |
|------|-------|-------------|
| **Uniform Colors** | $1.99 | 12 premium color palettes |
| **Corps Emblem** | $2.99 | 20 emblem designs |
| **Corps Badge** | $0.99 | Display badge on leaderboard |
| **Animated Corps Card** | $2.99 | Motion effects on your card |
| **Corps Theme** | $3.99 | Complete visual package |

#### Profile Customization

| Item | Price | Description |
|------|-------|-------------|
| **Profile Banner** | $1.99 | Custom banner image |
| **Profile Frame** | $0.99 | Border around avatar |
| **Achievement Showcase** | $1.99 | Featured achievement display |
| **Title/Flair** | $0.99 | Custom text under name |
| **Season Card Style** | $2.99 | Shareable card design |

#### Social Items

| Item | Price | Description |
|------|-------|-------------|
| **League Badge** | $0.99 | Display in league standings |
| **Celebration Effect** | $1.99 | Custom win celebration |
| **Chat Emoji Pack** | $2.99 | Exclusive emoji set |

---

### Tier 4: Premium Subscription ($3.99/month)

**What it is:** Ongoing enhanced experience
**Philosophy:** Convenience + expression, not advantage

#### Premium Benefits

| Feature | Free | Premium |
|---------|------|---------|
| **Streak Freezes** | 300 CC each | 2 free/month |
| **Lineup Presets** | 1 saved | 5 saved |
| **Advanced Stats** | Basic | Detailed breakdowns |
| **Season Recaps** | Text summary | Rich visual recap |
| **Profile Analytics** | — | Performance trends |
| **Custom Season Card** | Basic | Premium templates |
| **Early Feature Access** | — | Beta features |
| **Support Priority** | Standard | Priority queue |
| **Ad-Free** | Potential ads | Never |

**What Premium Does NOT Include:**
- ❌ Better scores
- ❌ Exclusive corps
- ❌ Point multipliers
- ❌ Gameplay advantages
- ❌ Earlier access to shows

---

## Part 3: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Wire Stripe to actually fulfill purchases

#### Step 1.1: Complete Stripe Webhook Handler

**File:** `functions/src/webhooks/stripe.js`

```javascript
// Replace placeholder with real fulfillment
const handlePaymentSucceeded = async (paymentIntent) => {
  const { metadata } = paymentIntent;
  const { userId, productType, productId } = metadata;

  switch (productType) {
    case 'battle_pass':
      await grantBattlePass(userId, productId);
      break;
    case 'corpscoin_bundle':
      await grantCorpsCoin(userId, BUNDLES[productId].amount);
      break;
    case 'cosmetic':
      await grantCosmetic(userId, productId);
      break;
    case 'premium_subscription':
      await activatePremium(userId);
      break;
  }

  // Log for analytics
  await logPurchase(userId, productType, paymentIntent.amount);
};
```

#### Step 1.2: Create Purchase Cloud Functions

**File:** `functions/src/callable/purchases.js`

```javascript
// Create Stripe checkout session
exports.createCheckoutSession = onCall(async (request) => {
  const { userId, productType, productId } = request.data;

  const session = await stripe.checkout.sessions.create({
    mode: productType === 'premium_subscription' ? 'subscription' : 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: PRODUCTS[productType][productId].priceId, quantity: 1 }],
    success_url: `${FRONTEND_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/purchase/cancelled`,
    metadata: { userId, productType, productId },
  });

  return { sessionId: session.id };
});
```

#### Step 1.3: Add Frontend Stripe Integration

**File:** `src/lib/stripe.ts`

```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const initiateCheckout = async (productType: string, productId: string) => {
  const { sessionId } = await createCheckoutSession({ productType, productId });
  const stripe = await stripePromise;
  await stripe?.redirectToCheckout({ sessionId });
};
```

#### Step 1.4: Create Product Configuration

**File:** `src/config/products.ts`

```typescript
export const PRODUCTS = {
  battlePass: {
    current: {
      id: 'battle_pass_2025',
      name: 'Season 2025 Battle Pass',
      price: 499, // cents
      priceId: 'price_xxx', // From Stripe dashboard
    },
  },
  corpsCoinBundles: {
    starter: { id: 'cc_500', name: '500 CorpsCoin', amount: 500, price: 299 },
    standard: { id: 'cc_1750', name: '1,750 CorpsCoin', amount: 1750, price: 799 },
    value: { id: 'cc_4000', name: '4,000 CorpsCoin', amount: 4000, price: 1499 },
    ultimate: { id: 'cc_10000', name: '10,000 CorpsCoin', amount: 10000, price: 2999 },
  },
};
```

---

### Phase 2: Battle Pass (Week 3-4)
**Goal:** Launch first paid product

#### Step 2.1: Add Battle Pass Types

**File:** `src/types/battlePass.ts`

```typescript
export interface BattlePassReward {
  level: number;
  track: 'free' | 'premium';
  type: 'corpsCoin' | 'badge' | 'cosmetic' | 'streakFreeze' | 'title';
  value: string | number;
  claimed: boolean;
}

export interface BattlePassProgress {
  seasonId: string;
  currentLevel: number;
  currentXP: number;
  xpToNextLevel: number;
  hasPremium: boolean;
  rewards: BattlePassReward[];
  claimedRewards: string[];
}

export interface BattlePassSeason {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  totalLevels: number;
  xpPerLevel: number;
  freeRewards: BattlePassReward[];
  premiumRewards: BattlePassReward[];
}
```

#### Step 2.2: Create Battle Pass Store

**File:** `src/store/battlePassStore.ts`

```typescript
import { create } from 'zustand';

interface BattlePassState {
  progress: BattlePassProgress | null;
  loading: boolean;
  error: string | null;
  fetchProgress: (userId: string) => Promise<void>;
  addXP: (amount: number) => void;
  claimReward: (level: number, track: 'free' | 'premium') => Promise<void>;
}

export const useBattlePassStore = create<BattlePassState>((set, get) => ({
  // Implementation
}));
```

#### Step 2.3: Build Battle Pass UI

**File:** `src/pages/BattlePass.jsx`

```jsx
export default function BattlePass() {
  return (
    <div className="min-h-screen bg-charcoal">
      {/* Hero section with current season */}
      <BattlePassHero />

      {/* Progress bar */}
      <BattlePassProgress />

      {/* Rewards track - horizontal scroll */}
      <div className="overflow-x-auto">
        <BattlePassTrack />
      </div>

      {/* Purchase CTA for non-premium */}
      {!hasPremium && <BattlePassPurchaseCTA />}

      {/* Daily/Weekly challenges */}
      <BattlePassChallenges />
    </div>
  );
}
```

#### Step 2.4: Integrate XP Earning

**File:** `functions/src/callable/battlePass.js`

```javascript
// Award Battle Pass XP on game actions
exports.awardBattlePassXP = async (userId, source) => {
  const XP_AMOUNTS = {
    dailyLogin: 50,
    showAttendance: 100,
    leagueWin: 75,
    achievementUnlock: 150,
  };

  const xp = XP_AMOUNTS[source] || 0;
  if (xp === 0) return;

  const progressRef = doc(db, `users/${userId}/battlePass/current`);
  await runTransaction(db, async (tx) => {
    const progress = await tx.get(progressRef);
    const currentXP = progress.data()?.currentXP || 0;
    const currentLevel = progress.data()?.currentLevel || 1;

    const newXP = currentXP + xp;
    const xpPerLevel = 500;

    if (newXP >= xpPerLevel) {
      tx.update(progressRef, {
        currentXP: newXP - xpPerLevel,
        currentLevel: currentLevel + 1,
      });
      // Notify frontend of level up
    } else {
      tx.update(progressRef, { currentXP: newXP });
    }
  });
};
```

---

### Phase 3: CorpsCoin Bundles (Week 5)
**Goal:** Enable direct currency purchase

#### Step 3.1: Add Purchase UI to Store

**File:** `src/components/Store/CorpsCoinBundles.jsx`

```jsx
export function CorpsCoinBundles() {
  const bundles = [
    { id: 'starter', amount: 500, price: '$2.99', bonus: null },
    { id: 'standard', amount: 1750, price: '$7.99', bonus: '+250 (17%)' },
    { id: 'value', amount: 4000, price: '$14.99', bonus: '+1,000 (33%)', popular: true },
    { id: 'ultimate', amount: 10000, price: '$29.99', bonus: '+4,000 (67%)' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {bundles.map(bundle => (
        <BundleCard
          key={bundle.id}
          {...bundle}
          onPurchase={() => initiateCheckout('corpsCoinBundles', bundle.id)}
        />
      ))}
    </div>
  );
}
```

#### Step 3.2: Handle CorpsCoin Grant

**File:** `functions/src/callable/economy.js` (extend existing)

```javascript
// Add to existing economy.js
exports.grantPurchasedCorpsCoin = async (userId, bundleId) => {
  const BUNDLES = {
    starter: 500,
    standard: 1750,
    value: 4000,
    ultimate: 10000,
  };

  const amount = BUNDLES[bundleId];
  await addCorpsCoinTransaction(userId, {
    type: 'PURCHASE',
    amount,
    description: `Purchased ${amount.toLocaleString()} CorpsCoin bundle`,
  });
};
```

---

### Phase 4: Cosmetics System (Week 6-7)
**Goal:** Launch visual customization store

#### Step 4.1: Define Cosmetics Types

**File:** `src/types/cosmetics.ts`

```typescript
export type CosmeticType =
  | 'uniform_color'
  | 'corps_emblem'
  | 'corps_badge'
  | 'profile_banner'
  | 'profile_frame'
  | 'title'
  | 'celebration_effect';

export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number; // In cents for real money, or CC for in-game
  priceType: 'usd' | 'corpsCoin';
  previewUrl: string;
  data: Record<string, unknown>; // Type-specific data
}

export interface UserCosmetics {
  owned: string[]; // Cosmetic IDs
  equipped: {
    uniformColor?: string;
    corpsEmblem?: string;
    corpsBadge?: string;
    profileBanner?: string;
    profileFrame?: string;
    title?: string;
    celebrationEffect?: string;
  };
}
```

#### Step 4.2: Create Cosmetics Store

**File:** `src/store/cosmeticsStore.ts`

```typescript
import { create } from 'zustand';

interface CosmeticsState {
  owned: string[];
  equipped: Record<string, string>;
  catalog: Cosmetic[];
  fetchOwned: (userId: string) => Promise<void>;
  purchaseCosmetic: (cosmeticId: string) => Promise<void>;
  equipCosmetic: (type: CosmeticType, cosmeticId: string) => Promise<void>;
}
```

#### Step 4.3: Build Store UI

**File:** `src/pages/Store.jsx`

```jsx
export default function Store() {
  return (
    <GameShell title="Store">
      <Tabs defaultValue="featured">
        <TabsList>
          <Tab value="featured">Featured</Tab>
          <Tab value="corpsCoin">CorpsCoin</Tab>
          <Tab value="battlePass">Battle Pass</Tab>
          <Tab value="cosmetics">Cosmetics</Tab>
        </TabsList>

        <TabsContent value="featured">
          <FeaturedItems />
        </TabsContent>

        <TabsContent value="corpsCoin">
          <CorpsCoinBundles />
        </TabsContent>

        <TabsContent value="battlePass">
          <BattlePassPurchase />
        </TabsContent>

        <TabsContent value="cosmetics">
          <CosmeticsGrid />
        </TabsContent>
      </Tabs>
    </GameShell>
  );
}
```

#### Step 4.4: Integrate Cosmetics Display

**File:** `src/components/CorpsCard.jsx` (extend existing)

```jsx
// Apply cosmetics to corps display
export function CorpsCard({ corps, cosmetics }) {
  const uniformColor = cosmetics?.equipped?.uniformColor || 'default';
  const emblem = cosmetics?.equipped?.corpsEmblem;
  const badge = cosmetics?.equipped?.corpsBadge;

  return (
    <Card className={`bg-gradient-to-br ${UNIFORM_COLORS[uniformColor]}`}>
      {emblem && <CorpsEmblem id={emblem} />}
      {badge && <CorpsBadge id={badge} />}
      {/* Rest of card */}
    </Card>
  );
}
```

---

### Phase 5: Premium Subscription (Week 8-9)
**Goal:** Recurring revenue stream

#### Step 5.1: Create Subscription Webhook Handler

**File:** `functions/src/webhooks/stripe.js` (extend)

```javascript
case 'customer.subscription.created':
case 'customer.subscription.updated':
  await handleSubscriptionChange(event.data.object);
  break;

case 'customer.subscription.deleted':
  await handleSubscriptionCancellation(event.data.object);
  break;

const handleSubscriptionChange = async (subscription) => {
  const userId = subscription.metadata.userId;
  const status = subscription.status;

  if (status === 'active') {
    await updateDoc(doc(db, `users/${userId}/profile/data`), {
      isPremium: true,
      premiumSince: new Date(),
      premiumExpiresAt: new Date(subscription.current_period_end * 1000),
    });

    // Grant monthly benefits
    await grantMonthlyPremiumBenefits(userId);
  }
};

const grantMonthlyPremiumBenefits = async (userId) => {
  // 2 free streak freezes per month
  await updateDoc(doc(db, `users/${userId}/profile/data`), {
    freeStreakFreezes: increment(2),
  });
};
```

#### Step 5.2: Add Premium Feature Checks

**File:** `src/hooks/usePremium.ts`

```typescript
export function usePremium() {
  const { profile } = useProfileStore();

  const isPremium = profile?.isPremium &&
    new Date(profile.premiumExpiresAt) > new Date();

  const premiumFeatures = {
    freeStreakFreezes: isPremium ? 2 : 0,
    lineupPresets: isPremium ? 5 : 1,
    advancedStats: isPremium,
    richRecaps: isPremium,
    prioritySupport: isPremium,
  };

  return { isPremium, premiumFeatures };
}
```

#### Step 5.3: Gate Premium Features

**File:** `src/components/AdvancedStats.jsx` (example)

```jsx
export function AdvancedStats() {
  const { isPremium } = usePremium();

  if (!isPremium) {
    return (
      <PremiumUpsell
        feature="Advanced Stats"
        description="See detailed breakdowns of your performance"
      />
    );
  }

  return <AdvancedStatsContent />;
}
```

---

### Phase 6: Analytics & Optimization (Week 10)
**Goal:** Track and improve conversion

#### Step 6.1: Add Purchase Analytics

**File:** `src/lib/analytics.ts`

```typescript
export const trackPurchaseEvent = (event: string, data: Record<string, unknown>) => {
  // Firebase Analytics
  logEvent(analytics, event, data);

  // Custom analytics
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({ event, data, timestamp: new Date() }),
  });
};

// Track funnel
trackPurchaseEvent('store_viewed', { source: 'dashboard' });
trackPurchaseEvent('product_viewed', { productId, productType });
trackPurchaseEvent('checkout_initiated', { productId, productType });
trackPurchaseEvent('purchase_completed', { productId, amount });
```

#### Step 6.2: Add Admin Revenue Dashboard

**File:** `src/pages/Admin.jsx` (extend)

```jsx
// Add revenue stats to admin panel
const RevenueStats = () => {
  const { stats } = useAdminStats();

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="Total Revenue" value={`$${stats.totalRevenue}`} />
      <StatCard title="Battle Pass Sales" value={stats.battlePassSales} />
      <StatCard title="CorpsCoin Revenue" value={`$${stats.corpsCoinRevenue}`} />
      <StatCard title="Premium Subscribers" value={stats.premiumUsers} />
    </div>
  );
};
```

---

## Part 4: Pricing Psychology

### Anchoring Strategy

Display prices with clear value comparison:

```
┌─────────────────────────────────────────────────────┐
│  ULTIMATE BUNDLE                    BEST VALUE! 🔥  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                     │
│  10,000 CorpsCoin                   $29.99          │
│  + 4,000 BONUS (67% extra!)                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ That's only $0.0021 per CorpsCoin!          │   │
│  │ Compare to Starter: $0.0060 per CorpsCoin   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [    Purchase Now    ]                             │
└─────────────────────────────────────────────────────┘
```

### Loss Aversion (Battle Pass)

Show what users are missing:

```
┌─────────────────────────────────────────────────────┐
│  You're on Level 23 of the FREE track              │
│                                                     │
│  ⚠️ You've passed 12 PREMIUM rewards:              │
│                                                     │
│  ❌ Animated Corps Card (Level 1)                   │
│  ❌ 100 CorpsCoin + Badge (Level 5)                 │
│  ❌ Rare Uniform Color (Level 10)                   │
│  ❌ Streak Freeze Token (Level 15)                  │
│  ❌ Epic Profile Banner (Level 20)                  │
│  ... and 7 more                                     │
│                                                     │
│  Unlock ALL past rewards + future ones for $4.99   │
│                                                     │
│  [    Upgrade to Premium    ]                       │
└─────────────────────────────────────────────────────┘
```

### Social Proof

Show what others are buying:

```
🔥 Popular this week:
• 847 directors upgraded to Premium Battle Pass
• Most purchased: Value CorpsCoin Bundle (4,000 CC)
• New: "World Champion" title unlocked by 23 players
```

---

## Part 5: No Pay-to-Win Safeguards

### What Money Can NEVER Buy

| Protected Element | Why It's Protected |
|-------------------|-------------------|
| **Better scores** | Core gameplay integrity |
| **Exclusive corps** | Everyone competes on same field |
| **Point multipliers** | Unfair competitive advantage |
| **Earlier show access** | Time-based advantage |
| **Better draft picks** | Lineup fairness |
| **League advantages** | Fair competition |
| **Skip progression** | Undermines achievement |

### What Money CAN Buy

| Purchasable | Why It's OK |
|-------------|-------------|
| **Visual cosmetics** | No gameplay impact |
| **Convenience items** | Saves time, not power |
| **Extra customization** | Self-expression |
| **Premium analytics** | Information, not advantage |
| **Social features** | Enhanced sharing |

### Competitive Integrity Statement

Add to Terms of Service and display in store:

> **Our Promise:** marching.art will never sell competitive advantages.
> Free players and premium players score the same. The only difference
> is how you look doing it.

---

## Part 6: Implementation Checklist

### Week 1: Stripe Foundation
- [ ] Complete webhook handler with fulfillment logic
- [ ] Create checkout session Cloud Function
- [ ] Add Stripe.js to frontend
- [ ] Create product configuration
- [ ] Test end-to-end purchase flow

### Week 2: Database & Types
- [ ] Add BattlePass types
- [ ] Add Cosmetics types
- [ ] Add Premium subscription fields to user profile
- [ ] Create Firestore security rules for purchases
- [ ] Set up purchase analytics events

### Week 3: Battle Pass Backend
- [ ] Create Battle Pass Cloud Functions
- [ ] Implement XP earning triggers
- [ ] Create reward claiming logic
- [ ] Add season configuration
- [ ] Test level-up flow

### Week 4: Battle Pass Frontend
- [ ] Build Battle Pass page
- [ ] Create progress visualization
- [ ] Build reward track component
- [ ] Add purchase CTA
- [ ] Integrate with navigation

### Week 5: CorpsCoin Bundles
- [ ] Create bundle purchase UI
- [ ] Wire to Stripe checkout
- [ ] Add success/failure handling
- [ ] Update CorpsCoin display after purchase
- [ ] Add purchase history

### Week 6: Cosmetics Backend
- [ ] Create cosmetics catalog in Firestore
- [ ] Build purchase + equip Cloud Functions
- [ ] Add cosmetics to user profile
- [ ] Create inventory management

### Week 7: Cosmetics Frontend
- [ ] Build Store page
- [ ] Create cosmetic preview components
- [ ] Build inventory/wardrobe UI
- [ ] Integrate cosmetics into corps display
- [ ] Add equipped indicator to profile

### Week 8: Premium Subscription
- [ ] Configure Stripe subscription product
- [ ] Handle subscription webhooks
- [ ] Create premium feature checks
- [ ] Build subscription management UI
- [ ] Add cancellation flow

### Week 9: Premium Features
- [ ] Implement free streak freezes
- [ ] Add lineup preset expansion
- [ ] Build advanced stats component
- [ ] Create rich season recap
- [ ] Add premium badge/indicator

### Week 10: Polish & Analytics
- [ ] Add purchase funnel analytics
- [ ] Build admin revenue dashboard
- [ ] A/B test pricing display
- [ ] Add promotional banners
- [ ] Launch marketing campaign

---

## Part 7: Revenue Projections

### Conservative Estimate (Year 1)

**Assumptions:**
- 1,000 active users by month 6
- 5,000 active users by month 12
- Industry-standard conversion rates

| Month | Users | Battle Pass | Bundles | Premium | Total |
|-------|-------|-------------|---------|---------|-------|
| 1 | 500 | $125 | $30 | $20 | $175 |
| 3 | 1,000 | $250 | $80 | $40 | $370 |
| 6 | 2,500 | $625 | $200 | $100 | $925 |
| 12 | 5,000 | $1,250 | $500 | $200 | $1,950 |

**Year 1 Total: ~$10,000-15,000**

### Optimistic Estimate (Year 1)

With strong retention and word-of-mouth:

| Month | Users | Battle Pass | Bundles | Premium | Cosmetics | Total |
|-------|-------|-------------|---------|---------|-----------|-------|
| 6 | 5,000 | $1,250 | $400 | $200 | $300 | $2,150 |
| 12 | 15,000 | $3,750 | $1,200 | $600 | $900 | $6,450 |

**Year 1 Total: ~$40,000-50,000**

---

## Part 8: Competitive Analysis

### How Others Monetize Fantasy Sports

| Platform | Model | ARPU | Key Lesson |
|----------|-------|------|------------|
| **Sleeper** | Premium tier ($50/yr) + cosmetics | $8-12/yr | Cosmetics drive 60% of revenue |
| **ESPN** | ESPN+ bundle ($10/mo) | $15-20/yr | Content + features combined |
| **Yahoo** | Minimal monetization | $2-3/yr | Missed opportunity |
| **DraftKings** | Entry fees (gambling) | $200+/yr | Different model (regulated) |
| **Duolingo** | Super ($7/mo) + hearts | $25-30/yr | Streak protection is powerful |

### marching.art Opportunity

- **Niche market** = less competition, more loyalty
- **Passionate users** = higher willingness to pay for expression
- **DCI tie-in** = unique content opportunities
- **Community focus** = social features drive purchases

---

## Appendix A: Stripe Product Setup

### Products to Create in Stripe Dashboard

```
1. Battle Pass 2025
   - Type: One-time
   - Price: $4.99
   - Product ID: prod_battlepass_2025
   - Price ID: price_battlepass_2025

2. CorpsCoin Starter
   - Type: One-time
   - Price: $2.99
   - Metadata: { bundleId: "starter", amount: 500 }

3. CorpsCoin Standard
   - Type: One-time
   - Price: $7.99
   - Metadata: { bundleId: "standard", amount: 1750 }

4. CorpsCoin Value
   - Type: One-time
   - Price: $14.99
   - Metadata: { bundleId: "value", amount: 4000 }

5. CorpsCoin Ultimate
   - Type: One-time
   - Price: $29.99
   - Metadata: { bundleId: "ultimate", amount: 10000 }

6. Premium Monthly
   - Type: Subscription
   - Price: $3.99/month
   - Product ID: prod_premium
   - Price ID: price_premium_monthly
```

### Webhook Events to Handle

```
payment_intent.succeeded
payment_intent.payment_failed
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

---

## Appendix B: Database Schema Updates

### User Profile Extensions

```typescript
// Add to users/{uid}/profile/data
{
  // Existing fields...

  // Premium
  isPremium: boolean,
  premiumSince: Timestamp | null,
  premiumExpiresAt: Timestamp | null,

  // Battle Pass
  battlePass: {
    seasonId: string,
    hasPremium: boolean,
    purchasedAt: Timestamp | null,
  },

  // Cosmetics
  cosmetics: {
    owned: string[],
    equipped: {
      uniformColor: string | null,
      corpsEmblem: string | null,
      // ...
    },
  },

  // Convenience items
  freeStreakFreezes: number,
  lineupPresets: LineupPreset[],
}
```

### New Collections

```
purchases/{purchaseId}
  userId: string
  productType: string
  productId: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  stripePaymentIntentId: string
  createdAt: Timestamp
  completedAt: Timestamp | null

cosmetics/{cosmeticId}
  name: string
  type: CosmeticType
  rarity: string
  price: number
  priceType: 'usd' | 'corpsCoin'
  previewUrl: string
  data: Record<string, unknown>
  releaseDate: Timestamp
  isLimited: boolean
  limitedUntil: Timestamp | null
```

---

*Roadmap created: December 30, 2025*
*Version: 1.0*
*Next review: After Phase 1 completion*
