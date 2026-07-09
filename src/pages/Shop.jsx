// =============================================================================
// SHOP - Corps Identity Shop (v1)
// =============================================================================
// CorpsCoin-only cosmetic store: director titles, profile frames, corps card
// themes, plus the streak freeze consumable. Purchases and equips are
// validated server-side (functions/src/callable/shop.js); this page renders
// the client catalog mirror in src/utils/cosmetics.js.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useScheduleStore } from '../store/scheduleStore';
import { useSeasonStore } from '../store/seasonStore';
import {
  purchaseShopItem,
  equipShopItem,
  purchaseStreakFreeze,
  getStreakStatus,
  sponsorShow,
} from '../api/functions';
import { SHOP_ITEMS, SHOP_SECTIONS, isOwned } from '../utils/cosmetics';

// Mirror of getSponsorshipPrice in functions/src/callable/shop.js
const SPONSORSHIP_REGIONAL_DAYS = [28, 35, 41, 42];
const getSponsorshipPrice = (show) => {
  if (show.isChampionship) return 25000;
  if (SPONSORSHIP_REGIONAL_DAYS.includes(show.day)) return 15000;
  return 10000;
};

// Sponsor as the director's highest-class named corps
const CLASS_PRIORITY = ['worldClass', 'openClass', 'aClass', 'soundSport'];
const getSponsorCorps = (profile) => {
  for (const corpsClass of CLASS_PRIORITY) {
    const corps = profile?.corps?.[corpsClass];
    if (corps?.corpsName) return { corpsClass, corpsName: corps.corpsName };
  }
  return null;
};

const SECTION_ICONS = { title: Shield, frame: User, cardTheme: CreditCard };

// Per-type preview rendering for an item card
const ItemPreview = ({ item }) => {
  if (item.type === 'title') {
    return (
      <div className="h-14 flex items-center justify-center bg-[#0a0a0a] border border-[#2a2a2a]">
        <span className={`text-sm font-bold ${item.textClass}`}>{item.name}</span>
      </div>
    );
  }
  if (item.type === 'frame') {
    return (
      <div className="h-14 flex items-center justify-center bg-[#0a0a0a] border border-[#2a2a2a]">
        <div
          className={`w-9 h-9 rounded-sm bg-[#222] ${item.frameClass} flex items-center justify-center`}
        >
          <User className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    );
  }
  return (
    <div className="h-14 flex items-center justify-center bg-[#0a0a0a] border border-[#2a2a2a] p-2">
      <div className={`w-full h-full rounded-sm ${item.swatchClass}`} />
    </div>
  );
};

const Shop = () => {
  const profile = useProfileStore((state) => state.profile);
  const showsByDay = useScheduleStore((state) => state.showsByDay);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const [busy, setBusy] = useState(null); // itemId currently purchasing/equipping
  const [freezeStatus, setFreezeStatus] = useState(null);

  const balance = profile?.corpsCoin || 0;
  const equipped = profile?.cosmetics?.equipped || {};
  const sponsorCorps = getSponsorCorps(profile);

  // Upcoming shows eligible for sponsorship (not yet performed)
  const upcomingShows = useMemo(() => {
    const shows = [];
    (showsByDay || []).forEach((dayEntry) => {
      (dayEntry.shows || []).forEach((show) => {
        if (show.day >= (currentDay || 1)) shows.push(show);
      });
    });
    return shows.sort((a, b) => a.day - b.day).slice(0, 21);
  }, [showsByDay, currentDay]);

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

  const handleSponsor = async (show) => {
    if (!sponsorCorps) return;
    const price = getSponsorshipPrice(show);
    if (
      !window.confirm(
        `Sponsor ${show.eventName} for ${price.toLocaleString()} CC?\n\n"Presented by ${sponsorCorps.corpsName}" will appear on the schedule for every director.`
      )
    ) {
      return;
    }
    setBusy(`sponsor_${show.day}_${show.eventName}`);
    try {
      const result = await sponsorShow({
        day: show.day,
        eventName: show.eventName,
        corpsClass: sponsorCorps.corpsClass,
      });
      toast.success(result.data.message || 'Show sponsored!');
    } catch (error) {
      toast.error(error.message || 'Could not sponsor show');
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
            <ShoppingBag className="w-6 h-6 text-yellow-500" />
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wider">Corps Shop</h1>
              <p className="text-xs text-gray-500">
                Identity and flair, earned by playing. Nothing here affects scores.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333]">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">
              {balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Consumables */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            Consumables
          </h2>
          <div className="bg-[#1a1a1a] border border-[#333] p-4 flex items-center gap-4">
            <Snowflake className="w-8 h-8 text-cyan-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Streak Freeze</p>
              <p className="text-xs text-gray-400">
                Protects your login streak for 24 hours if you miss a day. One per 7 days.
              </p>
            </div>
            {freezeStatus?.hasActiveFreeze ? (
              <span className="text-xs text-cyan-300 font-bold whitespace-nowrap">Active</span>
            ) : freezeStatus && !freezeStatus.canPurchaseFreeze ? (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Cooldown: {freezeStatus.freezeCooldownDays}d
              </span>
            ) : (
              <button
                onClick={handleBuyFreeze}
                disabled={busy === 'streak_freeze' || balance < (freezeStatus?.freezeCost ?? 300)}
                className={`h-9 px-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  balance >= (freezeStatus?.freezeCost ?? 300)
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-[#222] text-gray-600 cursor-not-allowed'
                }`}
              >
                {busy === 'streak_freeze' ? '...' : `${freezeStatus?.freezeCost ?? 300} CC`}
              </button>
            )}
          </div>
        </div>

        {/* Show sponsorship — the prestige sink */}
        {upcomingShows.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-2">
              <Megaphone className="w-3.5 h-3.5 text-yellow-500" />
              Show Sponsorship
            </h2>
            <p className="text-[10px] text-gray-600 mb-3">
              Put &ldquo;Presented by {sponsorCorps?.corpsName || 'your corps'}&rdquo; on a show —
              visible to every director on the schedule. One sponsor per show, first come.
            </p>
            <div className="bg-[#1a1a1a] border border-[#333] divide-y divide-[#222] max-h-80 overflow-y-auto">
              {upcomingShows.map((show) => {
                const price = getSponsorshipPrice(show);
                const busyKey = `sponsor_${show.day}_${show.eventName}`;
                return (
                  <div key={busyKey} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{show.eventName}</p>
                      <p className="text-[10px] text-gray-600">
                        Day {show.day}
                        {show.isChampionship ? ' · Championship' : ''}
                        {show.sponsor?.corpsName ? '' : ` · ${price.toLocaleString()} CC`}
                      </p>
                    </div>
                    {show.sponsor?.corpsName ? (
                      <span className="text-[10px] text-yellow-500/90 whitespace-nowrap">
                        ★ {show.sponsor.corpsName}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSponsor(show)}
                        disabled={busy === busyKey || balance < price || !sponsorCorps}
                        className={`h-8 px-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                          balance >= price && sponsorCorps
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                            : 'bg-[#222] text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {busy === busyKey ? '...' : 'Sponsor'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cosmetic sections */}
        {SHOP_SECTIONS.map((section) => {
          const SectionIcon = SECTION_ICONS[section.type];
          const items = SHOP_ITEMS.filter((item) => item.type === section.type);
          return (
            <div key={section.type} className="mb-8">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <SectionIcon className="w-3.5 h-3.5 text-[#0057B8]" />
                {section.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {items.map((item) => {
                  const owned = isOwned(profile, item.id);
                  const isEquipped = equipped[item.type] === item.id;
                  const canAfford = item.price != null && balance >= item.price;
                  return (
                    <div key={item.id} className="bg-[#1a1a1a] border border-[#333] flex flex-col">
                      <ItemPreview item={item} />
                      <div className="p-3 flex-1 flex flex-col">
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="text-[10px] text-gray-500 mb-3 flex-1">{item.description}</p>
                        {item.grantOnly && !owned ? (
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
                                : 'bg-[#0057B8] hover:bg-[#0066d6] text-white'
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
                                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                : 'bg-[#222] text-gray-600 cursor-not-allowed'
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

        <p className="text-[10px] text-gray-600 text-center">
          Our promise: the shop will never sell competitive advantages. Free players and collectors
          score exactly the same.
        </p>
      </div>
    </div>
  );
};

export default Shop;
