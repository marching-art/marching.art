// =============================================================================
// SHOP - Corps Identity Shop (v1)
// =============================================================================
// CorpsCoin-only cosmetic store: director titles, profile frames, corps card
// themes, plus the streak freeze consumable. Purchases and equips are
// validated server-side (functions/src/callable/shop.js); this page renders
// the client catalog mirror in src/utils/cosmetics.js.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Coins,
  ShoppingBag,
  Check,
  Snowflake,
  Shield,
  User,
  CreditCard,
  Megaphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import { useSeasonStore } from '../store/seasonStore';
import { Link } from 'react-router-dom';
import {
  purchaseShopItem,
  equipShopItem,
  purchaseStreakFreeze,
  getStreakStatus,
} from '../api/functions';
import {
  SHOP_ITEMS,
  SHOP_SECTIONS,
  isOwned,
  isSeasonallyAvailable,
  seasonalLabel,
} from '../utils/cosmetics';

const SECTION_ICONS = { title: Shield, frame: User, cardTheme: CreditCard };

// Per-type preview rendering for an item card
const ItemPreview = ({ item }) => {
  if (item.type === 'title') {
    return (
      <div className="h-14 flex items-center justify-center bg-background border border-line-muted">
        <span className={`text-sm font-bold ${item.textClass}`}>{item.name}</span>
      </div>
    );
  }
  if (item.type === 'frame') {
    return (
      <div className="h-14 flex items-center justify-center bg-background border border-line-muted">
        <div
          className={`w-9 h-9 rounded-none bg-surface-raised ${item.frameClass} flex items-center justify-center`}
        >
          <User className="w-4 h-4 text-muted" />
        </div>
      </div>
    );
  }
  return (
    <div className="h-14 flex items-center justify-center bg-background border border-line-muted p-2">
      <div className={`w-full h-full rounded-none ${item.swatchClass}`} />
    </div>
  );
};

const Shop = () => {
  const profile = useProfileStore((state) => state.profile);
  const seasonStatus = useSeasonStore((state) => state.seasonData?.status || null);
  const [busy, setBusy] = useState(null); // itemId currently purchasing/equipping
  const [freezeStatus, setFreezeStatus] = useState(null);

  const balance = profile?.corpsCoin || 0;
  const equipped = profile?.cosmetics?.equipped || {};

  const loadFreezeStatus = useCallback(() => {
    getStreakStatus()
      .then((result) => setFreezeStatus(result.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFreezeStatus();
  }, [loadFreezeStatus]);

  const handleBuy = async (item) => {
    setBusy(item.id);
    try {
      const result = await purchaseShopItem({ itemId: item.id });
      toast.success(result.data.message || `${item.name} purchased!`);
    } catch (error) {
      toast.error(error.message || 'Purchase failed');
    } finally {
      setBusy(null);
    }
  };

  const handleEquipToggle = async (item, isEquipped) => {
    setBusy(item.id);
    try {
      const result = await equipShopItem(
        isEquipped ? { itemId: null, slot: item.type } : { itemId: item.id }
      );
      toast.success(result.data.message);
    } catch (error) {
      toast.error(error.message || 'Could not equip item');
    } finally {
      setBusy(null);
    }
  };

  const handleBuyFreeze = async () => {
    setBusy('streak_freeze');
    try {
      const result = await purchaseStreakFreeze();
      toast.success(result.data.message || 'Streak freeze activated!');
      loadFreezeStatus();
    } catch (error) {
      toast.error(error.message || 'Could not purchase streak freeze');
    } finally {
      setBusy(null);
    }
  };

  return (
    // GameShell's <main> is fixed with overflow-hidden, so each page must own
    // its scroll container. Without this wrapper the shop's content is clipped
    // and can't scroll (notably on mobile, where the catalog runs long).
    <div className="h-full overflow-y-auto scroll-momentum">
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-secondary" />
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wider">Corps Shop</h1>
              <p className="text-xs text-muted">
                Identity and flair, earned by playing. Nothing here affects scores.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-line">
            <Coins className="w-4 h-4 text-brand" />
            <span className="text-sm font-bold text-brand font-data tabular-nums">
              {balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Consumables */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            Consumables
          </h2>
          <div className="bg-surface-card border border-line p-4 flex items-center gap-4">
            <Snowflake className="w-8 h-8 text-cyan-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Streak Freeze</p>
              <p className="text-xs text-muted">
                Protects your login streak for 24 hours if you miss a day. One per 7 days.
              </p>
            </div>
            {freezeStatus?.hasActiveFreeze ? (
              <span className="text-xs text-cyan-300 font-bold whitespace-nowrap">Active</span>
            ) : freezeStatus && !freezeStatus.canPurchaseFreeze ? (
              <span className="text-xs text-muted whitespace-nowrap">
                Cooldown: {freezeStatus.freezeCooldownDays}d
              </span>
            ) : (
              <button
                onClick={handleBuyFreeze}
                disabled={busy === 'streak_freeze' || balance < (freezeStatus?.freezeCost ?? 300)}
                className={`h-9 px-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  balance >= (freezeStatus?.freezeCost ?? 300)
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-surface-raised text-muted cursor-not-allowed'
                }`}
              >
                {busy === 'streak_freeze' ? '...' : `${freezeStatus?.freezeCost ?? 300} CC`}
              </button>
            )}
          </div>
        </div>

        {/* Hosting — sponsorship's replacement: run the show, don't just brand it */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 flex items-center gap-2">
            <Megaphone className="w-3.5 h-3.5 text-secondary" />
            Host Your Own Show
          </h2>
          <div className="bg-surface-card border border-line p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                Sponsorship retired — now you RUN the show.
              </p>
              <p className="text-xs text-muted mt-0.5">
                Rent a stadium from 150 CC, put your event on the season schedule with open
                enrollment for every class, and earn CC for every corps that performs. Run
                successful shows to climb from a high school field to an NFL stadium.
              </p>
            </div>
            <Link
              to="/schedule"
              className="shrink-0 h-9 px-4 flex items-center text-xs font-bold uppercase tracking-wider bg-interactive hover:bg-interactive-hover text-white"
            >
              Book a venue
            </Link>
          </div>
        </div>

        {/* Cosmetic sections */}
        {SHOP_SECTIONS.map((section) => {
          const SectionIcon = SECTION_ICONS[section.type];
          const items = SHOP_ITEMS.filter((item) => item.type === section.type);
          return (
            <div key={section.type} className="mb-8">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <SectionIcon className="w-3.5 h-3.5 text-interactive" />
                {section.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {items.map((item) => {
                  const owned = isOwned(profile, item.id);
                  const isEquipped = equipped[item.type] === item.id;
                  const canAfford = item.price != null && balance >= item.price;
                  const inSeason = isSeasonallyAvailable(item, seasonStatus);
                  return (
                    <div key={item.id} className="bg-surface-card border border-line flex flex-col">
                      <ItemPreview item={item} />
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-white">{item.name}</p>
                          {item.seasonal && (
                            <span
                              className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${
                                inSeason
                                  ? 'bg-warning/10 border-warning/40 text-warning'
                                  : 'bg-surface-raised border-line text-muted'
                              }`}
                            >
                              {seasonalLabel(item)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted mb-3 flex-1">{item.description}</p>
                        {!owned && !item.grantOnly && !inSeason ? (
                          <div className="h-8 w-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center bg-surface-raised border border-line text-muted">
                            Returns Next {item.seasonal === 'live-season' ? 'Summer' : 'Off-Season'}
                          </div>
                        ) : item.grantOnly && !owned ? (
                          <div className="h-8 w-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center bg-emerald-600/10 border border-emerald-500/30 text-emerald-400">
                            Earned, Not Bought
                          </div>
                        ) : owned ? (
                          <button
                            onClick={() => handleEquipToggle(item, isEquipped)}
                            disabled={busy === item.id}
                            className={`h-8 w-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${
                              isEquipped
                                ? 'bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30'
                                : 'bg-interactive hover:bg-interactive-hover text-white'
                            }`}
                          >
                            {isEquipped ? (
                              <>
                                <Check className="w-3 h-3" /> Equipped
                              </>
                            ) : (
                              'Equip'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={busy === item.id || !canAfford}
                            className={`h-8 w-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${
                              canAfford
                                ? 'bg-interactive hover:bg-interactive-hover text-white'
                                : 'bg-surface-raised text-muted cursor-not-allowed'
                            }`}
                          >
                            <Coins className="w-3 h-3" />
                            {item.price.toLocaleString()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-muted text-center">
          Our promise: the shop will never sell competitive advantages. Free players and collectors
          score exactly the same.
        </p>
      </div>
    </div>
  );
};

export default Shop;
