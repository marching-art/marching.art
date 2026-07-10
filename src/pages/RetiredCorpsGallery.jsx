import React, { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  MapPin,
  Star,
  Archive,
  RefreshCw,
  X,
  Music,
  Award,
  Coins,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToProfile } from '../api/profile';
import { unretireCorps, purchaseRetirementPlaque } from '../api/functions';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import Portal from '../components/Portal';
import { PageHeader } from '../components/ui';
import { getSoundSportRating, RATING_CONFIG } from '../utils/scoresUtils';
import { PLAQUE_TIERS, PLAQUE_STYLES, availablePlaqueUpgrades } from '../utils/prestige';

// Class styling matches the site's design system (see Schedule CLASS_CONFIG):
// sharp, flat color tints rather than gradients.
const CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    accent: 'bg-yellow-500',
  },
  openClass: {
    name: 'Open Class',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    accent: 'bg-purple-400',
  },
  aClass: {
    name: 'A Class',
    color: 'text-[#0057B8]',
    bg: 'bg-[#0057B8]/10',
    accent: 'bg-[#0057B8]',
  },
  soundSport: {
    name: 'SoundSport',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    accent: 'bg-green-500',
  },
};

const CLASS_FILTERS = [
  { id: 'all', label: 'All Classes' },
  { id: 'worldClass', label: 'World' },
  { id: 'openClass', label: 'Open' },
  { id: 'aClass', label: 'A Class' },
  { id: 'soundSport', label: 'SoundSport' },
];

const RetiredCorpsGallery = () => {
  const { user } = useAuth();
  const [retiredCorps, setRetiredCorps] = useState([]);
  const [corpsCoin, setCorpsCoin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCorps, setSelectedCorps] = useState(null);
  const [showUnretireModal, setShowUnretireModal] = useState(false);
  const [showPlaqueModal, setShowPlaqueModal] = useState(false);
  const [purchasingTier, setPurchasingTier] = useState(null);
  const [unretiring, setUnretiring] = useState(false);
  const [filterClass, setFilterClass] = useState('all');
  const [sortBy, setSortBy] = useState('retiredAt'); // retiredAt, totalSeasons, bestScore

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToProfile(user.uid, (profileData) => {
      if (profileData) {
        setRetiredCorps(profileData.retiredCorps || []);
        setCorpsCoin(profileData.corpsCoin || 0);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getClassConfig = (corpsClass) =>
    CLASS_CONFIG[corpsClass] || {
      name: corpsClass,
      color: 'text-gray-400',
      bg: 'bg-gray-500/10',
      accent: 'bg-gray-500',
    };

  const handleUnretire = async (corpsClass, retiredIndex) => {
    setUnretiring(true);
    try {
      const result = await unretireCorps({ corpsClass, retiredIndex });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowUnretireModal(false);
        setSelectedCorps(null);
      }
    } catch (error) {
      console.error('Error unretiring corps:', error);
      toast.error(error.message || 'Failed to unretire corps');
    } finally {
      setUnretiring(false);
    }
  };

  const handlePurchasePlaque = async (tier) => {
    if (!selectedCorps) return;
    setPurchasingTier(tier);
    try {
      const result = await purchaseRetirementPlaque({
        retiredIndex: selectedCorps.index,
        corpsName: selectedCorps.corpsName,
        tier,
      });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowPlaqueModal(false);
        setSelectedCorps(null);
      }
    } catch (error) {
      console.error('Error commissioning plaque:', error);
      toast.error(error.message || 'Failed to commission plaque');
    } finally {
      setPurchasingTier(null);
    }
  };

  // Filter and sort retired corps. originalIndex MUST be captured before the
  // filter runs — it is the index into the raw profile.retiredCorps array
  // that unretireCorps/purchaseRetirementPlaque receive, and mapping after
  // the filter made it the filtered position (wrong corps when a class
  // filter was active).
  const filteredCorps = retiredCorps
    .map((corps, index) => ({ ...corps, originalIndex: index }))
    .filter((corps) => filterClass === 'all' || corps.corpsClass === filterClass)
    .sort((a, b) => {
      switch (sortBy) {
        case 'totalSeasons':
          return b.totalSeasons - a.totalSeasons;
        case 'bestScore':
          return b.bestSeasonScore - a.bestSeasonScore;
        case 'retiredAt':
        default:
          return (b.retiredAt?.seconds || 0) - (a.retiredAt?.seconds || 0);
      }
    });

  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
        <PageHeader icon={Archive} title="Retired Corps" subtitle="Career legacy" />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <LoadingScreen fullScreen={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* FIXED HEADER */}
      <PageHeader
        icon={Archive}
        title="Retired Corps"
        subtitle="Honor the legacy of your past corps"
        stats={[{ label: 'Retired', value: retiredCorps.length }]}
      />

      {/* FILTER / SORT BAR - Fixed */}
      <div className="flex-shrink-0 bg-[#111] border-b border-[#333] px-3 py-2">
        <div className="flex items-center gap-2 justify-between flex-wrap">
          {/* Class Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {CLASS_FILTERS.map((filter) => {
              const isActive = filterClass === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setFilterClass(filter.id)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap rounded-sm transition-all ${
                    isActive
                      ? 'bg-[#0057B8] text-white'
                      : 'bg-[#1a1a1a] text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm bg-[#1a1a1a] text-gray-300 border border-[#333] focus:outline-none focus:border-[#0057B8]"
          >
            <option value="retiredAt">Recently Retired</option>
            <option value="totalSeasons">Most Seasons</option>
            <option value="bestScore">Best Score</option>
          </select>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        {/* Empty State */}
        {filteredCorps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Archive className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">
              {filterClass === 'all'
                ? 'No Retired Corps Yet'
                : `No Retired ${getClassConfig(filterClass).name} Corps`}
            </h3>
            <p className="text-xs text-gray-500 max-w-[280px]">
              Retired corps will appear here when you retire them from your active roster.
            </p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {filteredCorps.map((corps, index) => {
                const config = getClassConfig(corps.corpsClass);
                // SoundSport is ratings-only — surface the best rating tier
                // instead of the numeric best score.
                const isSoundSport = corps.corpsClass === 'soundSport';
                const bestRating =
                  isSoundSport && corps.bestSeasonScore > 0
                    ? getSoundSportRating(corps.bestSeasonScore)
                    : null;
                return (
                  <m.div
                    key={`${corps.corpsClass}-${corps.originalIndex}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden hover:border-[#444] transition-all cursor-pointer"
                    onClick={() => setSelectedCorps({ ...corps, index: corps.originalIndex })}
                  >
                    {/* Class Accent Line */}
                    <div className={`h-1 ${config.accent}`} />

                    <div className="p-4">
                      {/* Corps Name + Class Badge */}
                      <div className="mb-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Music className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <div className="flex items-center gap-1.5">
                            {corps.plaque && PLAQUE_STYLES[corps.plaque.tier] && (
                              <span
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${PLAQUE_STYLES[corps.plaque.tier].bg} ${PLAQUE_STYLES[corps.plaque.tier].text} ${PLAQUE_STYLES[corps.plaque.tier].border}`}
                              >
                                <Award className="w-3 h-3" />
                                {corps.plaque.tier}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}
                            >
                              {config.name}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white leading-tight truncate">
                          {corps.corpsName}
                        </h3>
                        {corps.location && (
                          <div className="flex items-center gap-1 text-gray-500 text-[11px] mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{corps.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-[#111] border border-[#333] rounded-sm p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-[#0057B8]" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              Seasons
                            </span>
                          </div>
                          <div className="text-xl font-bold text-white font-data tabular-nums">
                            {corps.totalSeasons || 0}
                          </div>
                        </div>

                        <div className="bg-[#111] border border-[#333] rounded-sm p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              Best
                            </span>
                          </div>
                          {isSoundSport ? (
                            <div
                              className={`inline-block text-xs font-bold uppercase px-2 py-1 rounded-sm ${
                                bestRating ? RATING_CONFIG[bestRating].badge : 'text-gray-500'
                              }`}
                            >
                              {bestRating || '—'}
                            </div>
                          ) : (
                            <div className="text-xl font-bold text-white font-data tabular-nums">
                              {corps.bestSeasonScore?.toFixed(1) || '0.0'}
                            </div>
                          )}
                        </div>

                        <div className="bg-[#111] border border-[#333] rounded-sm p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Star className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              Shows
                            </span>
                          </div>
                          <div className="text-xl font-bold text-white font-data tabular-nums">
                            {corps.totalShows || 0}
                          </div>
                        </div>

                        <div className="bg-[#111] border border-[#333] rounded-sm p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Archive className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              Retired
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-white font-data">
                            {corps.retiredAt
                              ? new Date(corps.retiredAt.seconds * 1000).toLocaleDateString()
                              : 'Unknown'}
                          </div>
                        </div>
                      </div>

                      {/* Bring Out of Retirement Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCorps({ ...corps, index: corps.originalIndex });
                          setShowUnretireModal(true);
                        }}
                        className="w-full py-2 px-4 bg-[#0057B8] hover:bg-[#0066d6] text-white font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Bring Out of Retirement
                      </button>

                      {/* Commission Plaque Button — hidden once gold hangs */}
                      {availablePlaqueUpgrades(corps).length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCorps({ ...corps, index: corps.originalIndex });
                            setShowPlaqueModal(true);
                          }}
                          className="w-full mt-2 py-2 px-4 bg-[#1a1a1a] hover:bg-[#222] border border-yellow-500/40 text-yellow-500 font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2"
                        >
                          <Award className="w-3.5 h-3.5" />
                          {corps.plaque ? 'Upgrade Plaque' : 'Commission Plaque'}
                        </button>
                      )}
                    </div>
                  </m.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Commission Plaque Modal */}
      <AnimatePresence>
        {showPlaqueModal && selectedCorps && (
          <Portal>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => !purchasingTier && setShowPlaqueModal(false)}
            >
              <m.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-md w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    Commission a Plaque
                  </h3>
                  <button
                    onClick={() => setShowPlaqueModal(false)}
                    disabled={!!purchasingTier}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">
                    Honor the legacy of{' '}
                    <span className="text-white font-bold">{selectedCorps.corpsName}</span> with a
                    memorial plaque, displayed forever on its gallery card.
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-4">
                    <Coins className="w-3 h-3 text-yellow-500" />
                    <span className="font-data tabular-nums">
                      {corpsCoin.toLocaleString()}
                    </span>{' '}
                    CorpsCoin available
                  </div>

                  <div className="space-y-2">
                    {availablePlaqueUpgrades(selectedCorps).map((tier) => {
                      const style = PLAQUE_STYLES[tier.id];
                      const affordable = corpsCoin >= tier.price;
                      const busy = purchasingTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          onClick={() => handlePurchasePlaque(tier.id)}
                          disabled={!affordable || !!purchasingTier}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm border transition-all ${style.bg} ${style.border} ${
                            affordable ? 'hover:brightness-125' : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <span
                            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${style.text}`}
                          >
                            {busy ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Award className="w-4 h-4" />
                            )}
                            {tier.name}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-white font-data tabular-nums">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                            {tier.price.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCorps.plaque && (
                    <p className="text-[10px] text-gray-500 mt-3">
                      Upgrading replaces the current {PLAQUE_TIERS[selectedCorps.plaque.tier]?.name}{' '}
                      and pays the full price of the new tier.
                    </p>
                  )}
                </div>
              </m.div>
            </m.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Unretire Confirmation Modal */}
      <AnimatePresence>
        {showUnretireModal && selectedCorps && (
          <Portal>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => !unretiring && setShowUnretireModal(false)}
            >
              <m.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-md w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Bring Out of Retirement?
                  </h3>
                  <button
                    onClick={() => setShowUnretireModal(false)}
                    disabled={unretiring}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4">
                  <div className="bg-[#111] border border-[#333] rounded-sm p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Music className="w-5 h-5 text-purple-400" />
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {selectedCorps.corpsName}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {getClassConfig(selectedCorps.corpsClass).name}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Seasons
                        </div>
                        <div className="text-base font-bold text-white font-data tabular-nums">
                          {selectedCorps.totalSeasons}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Best
                        </div>
                        {selectedCorps.corpsClass === 'soundSport' ? (
                          <div className="text-base font-bold text-white">
                            {selectedCorps.bestSeasonScore > 0
                              ? getSoundSportRating(selectedCorps.bestSeasonScore)
                              : '—'}
                          </div>
                        ) : (
                          <div className="text-base font-bold text-white font-data tabular-nums">
                            {selectedCorps.bestSeasonScore?.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Shows
                        </div>
                        <div className="text-base font-bold text-white font-data tabular-nums">
                          {selectedCorps.totalShows}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-sm p-3 mb-4">
                    <p className="text-xs text-yellow-200">
                      <strong>Note:</strong> This corps will become your active{' '}
                      {getClassConfig(selectedCorps.corpsClass).name} corps. All season history will
                      be preserved, but you'll start fresh for the current season.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowUnretireModal(false)}
                      disabled={unretiring}
                      className="flex-1 py-2.5 px-4 bg-[#222] hover:bg-[#333] border border-[#333] text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUnretire(selectedCorps.corpsClass, selectedCorps.index)}
                      disabled={unretiring}
                      className="flex-1 py-2.5 px-4 bg-[#0057B8] hover:bg-[#0066d6] text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {unretiring ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Unretiring...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Confirm
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </m.div>
            </m.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetiredCorpsGallery;
