// src/pages/HallOfChampions.jsx
// Championship record book — data-terminal layout
// Sidebar (Division → Class switcher + Seasons) + Main Stage (Champion plaque +
// finalists table). Both divisions are here with their classes — Fantasy:
// World, Open, A, SoundSport; Podium: World, Open, A — see hallOfChampionsMeta.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { m } from 'framer-motion';
import { Trophy, Crown, ArrowLeft, Users, Flag, Coins, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { shareLink, championShareUrl } from '../utils/shareSheet';
import { getSeasonChampions } from '../api/season';
import { queryClient, queryKeys } from '../lib/queryClient';
import { purchaseHallBanner } from '../api/functions';
import { getSoundSportRating, RATING_CONFIG } from '../utils/scoresUtils';
import { HALL_BANNER_PRICE } from '../utils/prestige';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { Heading } from '../components/ui';
import { BlueRibbonIcon, BannerModal, NoChampionsPanel } from './HallOfChampionsParts';
import { SeasonRow, FinalistsTable } from './HallOfChampionsTable';
import {
  CLASS_CONFIG,
  HALL_DIVISIONS,
  DEFAULT_HALL_CLASS,
  isHallClassKey,
  divisionOfClass,
  isSoundSportClass,
  parseSeasonName,
  formatDate,
  formatScore,
  formatDelta,
} from './hallOfChampionsMeta';

/** @typedef {import('../api/season').SeasonChampions} SeasonChampions */
/** @typedef {import('../api/season').SeasonChampionEntry} SeasonChampionEntry */
/** @typedef {import('./hallOfChampionsMeta').HallDivisionConfig} HallDivisionConfig */

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * The season's champion (or SoundSport Best in Show) for the active class.
 * @param {{
 *   champion: SeasonChampionEntry,
 *   season: SeasonChampions,
 *   classKey: string,
 *   fieldStats: { margin: number | null, gap: number | null },
 *   isOwner: boolean,
 *   onHangBanner: () => void,
 * }} props
 */
const ChampionPlaque = ({ champion, season, classKey, fieldStats, isOwner, onHangBanner }) => {
  const { type, year } = parseSeasonName(season.seasonName);
  const config = CLASS_CONFIG[classKey];
  const ClassIcon = config?.icon || Trophy;
  const corpsName = champion.corpsName || champion.username || '—';
  const soundSport = isSoundSportClass(classKey);
  const rating =
    soundSport && typeof champion.score === 'number' ? getSoundSportRating(champion.score) : null;
  const ratingStyle = rating ? RATING_CONFIG[rating] : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-surface-card border border-line mb-4"
    >
      {/* Top banner */}
      <div
        className={`px-4 py-2 flex items-center justify-between ${
          soundSport ? 'bg-interactive text-white' : 'bg-brand text-black'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {soundSport ? (
            <BlueRibbonIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Crown className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-widest truncate">
            {type} {year} {soundSport ? 'Best in Show' : 'Champion'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap">
            {config?.name}
          </span>
          {/* Shares the /share/champion URL so the link unfurls with the
              live champion card (see functions/src/helpers/shareCards.js). */}
          <button
            onClick={() =>
              shareLink({
                title: `${season.seasonName || 'Season'} ${config?.name || ''} — marching.art`,
                url: championShareUrl(season.id, classKey),
              })
            }
            className="p-1 opacity-80 hover:opacity-100 transition-opacity"
            title="Share this champion"
            aria-label="Share this champion"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Champion identity */}
      <div className="px-4 sm:px-6 py-5 flex items-center gap-4">
        {/* prettier-ignore */}
        <TeamAvatar name={corpsName} logoUrl={champion.avatarUrl} size="lg" className="!w-14 !h-14 sm:!w-16 sm:!h-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold text-white truncate">{corpsName}</div>
          {champion.uid ? (
            <Link
              to={`/profile/${champion.uid}`}
              className="text-xs text-muted hover:text-interactive transition-colors block truncate"
            >
              Director: {champion.username || 'Unknown'}
            </Link>
          ) : (
            <span className="text-xs text-muted block truncate">
              Director: {champion.username || 'Unknown'}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {soundSport ? (
            <>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Rating</div>
              {ratingStyle ? (
                <span
                  className={`inline-block text-sm font-bold uppercase px-3 py-1.5 ${ratingStyle.badge}`}
                >
                  {rating}
                </span>
              ) : (
                <span className="text-xl font-bold text-interactive">—</span>
              )}
            </>
          ) : (
            <>
              <div className="text-[10px] text-muted uppercase tracking-wider">Final Score</div>
              <div className="text-3xl sm:text-4xl font-bold text-brand font-data tabular-nums leading-none">
                {formatScore(champion.score)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Champion's banner — a purchased message that hangs here forever */}
      {champion.banner?.message && (
        <div className="px-4 sm:px-6 pb-4">
          <div
            className={`flex items-center gap-2.5 px-3 py-2.5 border ${
              soundSport ? 'border-interactive/40 bg-interactive/10' : 'border-brand/40 bg-brand/5'
            }`}
          >
            <Flag
              className={`w-4 h-4 flex-shrink-0 ${soundSport ? 'text-interactive' : 'text-brand'}`}
            />
            <span className="text-sm text-white italic leading-snug">
              “{champion.banner.message}”
            </span>
          </div>
        </div>
      )}
      {isOwner && !champion.banner && (
        <div className="px-4 sm:px-6 pb-4">
          <button
            onClick={onHangBanner}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-interactive/40 text-interactive hover:bg-interactive/5 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
            Hang Your Champion's Banner
            <span className="flex items-center gap-1 text-white font-data tabular-nums normal-case">
              <Coins className="w-3.5 h-3.5 text-brand" />
              {HALL_BANNER_PRICE.toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-muted uppercase tracking-wider">
            {soundSport ? 'Awarded' : 'Crowned'}
          </div>
          <div className="text-xs text-white font-data tabular-nums truncate">
            {formatDate(season.archivedAt)}
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-muted uppercase tracking-wider">
            {soundSport ? 'Rating' : 'Margin'}
          </div>
          {soundSport ? (
            // Ratings-only format: show the rating tier, never the numeric score.
            <div className="text-xs text-white truncate">{rating || '—'}</div>
          ) : (
            <div
              className={`text-xs font-data tabular-nums truncate ${fieldStats.margin != null && fieldStats.margin > 0 ? 'text-green-500' : 'text-muted'}`}
            >
              {formatDelta(fieldStats.margin)}
            </div>
          )}
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-muted uppercase tracking-wider">Class</div>
          <div className="text-xs text-white truncate flex items-center gap-1">
            <ClassIcon className={`w-3 h-3 ${soundSport ? 'text-interactive' : 'text-brand'}`} />
            {config?.short}
          </div>
        </div>
      </div>
    </m.div>
  );
};

/**
 * Two-tier switcher: the division (Fantasy / Podium), then that division's
 * classes. The Podium row only appears once at least one archived season has
 * a Podium podium (data-driven — no feature flag, history survives any flag
 * state); the Fantasy row shows every class even before it has history.
 * @param {{
 *   divisions: HallDivisionConfig[],
 *   selectedClass: string,
 *   onSelectClass: (classKey: string) => void,
 * }} props
 */
const DivisionSwitcher = ({ divisions, selectedClass, onSelectClass }) => {
  const activeDivision = divisionOfClass(selectedClass);
  return (
    <div className="flex-shrink-0 border-b border-line bg-background">
      {divisions.length > 1 && (
        <>
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            Division
          </div>
          <div className="flex border-t border-line" role="tablist" aria-label="Division">
            {divisions.map((division) => {
              const isSelected = division.id === activeDivision.id;
              return (
                <button
                  key={division.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectClass(division.classes[0])}
                  className={`flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-line last:border-r-0 ${
                    isSelected
                      ? 'bg-brand text-black'
                      : 'text-muted hover:bg-surface-card hover:text-white'
                  }`}
                >
                  {division.short}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted border-t border-line">
        {divisions.length > 1 ? `${activeDivision.name} · Class` : 'Class'}
      </div>
      <div
        className="flex border-t border-line"
        role="tablist"
        aria-label={`${activeDivision.name} class`}
      >
        {activeDivision.classes.map((classKey) => {
          const config = CLASS_CONFIG[classKey];
          const isSelected = selectedClass === classKey;
          return (
            <button
              key={classKey}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectClass(classKey)}
              className={`flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-line last:border-r-0 ${
                isSelected
                  ? 'bg-interactive text-white'
                  : 'text-muted hover:bg-surface-card hover:text-white'
              }`}
            >
              {config.short}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const HallOfChampions = () => {
  const auth = useAuth();
  const currentUid = auth?.user?.uid || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  /** @type {[SeasonChampions[], React.Dispatch<React.SetStateAction<SeasonChampions[]>>]} */
  const [seasons, setSeasons] = useState(/** @type {SeasonChampions[]} */ ([]));
  // `?class=` deep links (the /share/champion page lands here) pick the
  // opening class; anything unknown falls back to the World Championship.
  const [selectedClass, setSelectedClass] = useState(() => {
    const requested = searchParams.get('class');
    return requested && isHallClassKey(requested) ? requested : DEFAULT_HALL_CLASS;
  });
  /** @type {[SeasonChampions | null, React.Dispatch<React.SetStateAction<SeasonChampions | null>>]} */
  const [selectedSeason, setSelectedSeason] = useState(
    /** @type {SeasonChampions | null} */ (null)
  );
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [purchasingBanner, setPurchasingBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchSeasonChampions = async () => {
      try {
        setLoading(true);
        // Shared react-query entry with useScoresData's archived-season list —
        // whichever of the Scores page or this page loads first pays for the
        // season_champions collection read; the other is a cache hit.
        // getSeasonChampions already normalizes archivedAt and sorts newest
        // first.
        const seasonsData = await queryClient.fetchQuery({
          queryKey: queryKeys.archivedSeasons(),
          queryFn: getSeasonChampions,
        });

        if (cancelled) return;
        setSeasons(seasonsData);
        // `?season=` deep link: open that season if it crowned the opening
        // class (read once, on load — the list is the navigation after that).
        const requestedSeason = searchParams.get('season');
        if (requestedSeason) {
          const match = seasonsData.find((s) => s.id === requestedSeason);
          if (match && (match.classes?.[selectedClass]?.length || 0) > 0) setSelectedSeason(match);
        }
      } catch (error) {
        console.error('Error fetching season champions:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSeasonChampions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link params are read once, on load
  }, []);

  // Divisions shown in the switcher. Podium only appears once real Podium
  // champions exist in the archive (data-driven — no feature flag).
  const visibleDivisions = useMemo(
    () =>
      HALL_DIVISIONS.filter(
        (division) =>
          division.id === 'fantasy' ||
          seasons.some((s) =>
            division.classes.some((classKey) => (s.classes?.[classKey]?.length || 0) > 0)
          )
      ),
    [seasons]
  );

  // Keep the URL shareable: the active class rides in `?class=` (replace, so
  // tab-hopping never piles up history entries).
  const selectClass = useCallback(
    /** @param {string} classKey */
    (classKey) => {
      setSelectedClass(classKey);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (classKey === DEFAULT_HALL_CLASS) next.delete('class');
          else next.set('class', classKey);
          next.delete('season');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Only seasons that actually have a crowned champion in the active class
  const crownedSeasons = useMemo(() => {
    return seasons.filter((s) => (s.classes?.[selectedClass]?.length || 0) > 0);
  }, [seasons, selectedClass]);

  // Clear a selection that is no longer valid for the active class (e.g. after
  // switching classes to one the selected season has no champions in). We
  // never *force* a selection here — leaving it null lets mobile show the
  // season list, while desktop falls back to the newest season via
  // `displaySeason` below. Forcing a selection previously made the mobile
  // "Seasons" back button impossible: tapping it set the selection to null,
  // and this effect immediately snapped it back to the detail view.
  useEffect(() => {
    if (selectedSeason && !crownedSeasons.some((s) => s.id === selectedSeason.id)) {
      setSelectedSeason(null);
    }
  }, [crownedSeasons, selectedSeason]);

  // The season rendered in the main stage. On desktop (sidebar + stage shown
  // together) this defaults to the most recent crowned season so a champion is
  // always visible. On mobile the main stage is only revealed once the user
  // taps a season, so `selectedSeason` gates visibility while `displaySeason`
  // supplies the content.
  const displaySeason = selectedSeason || crownedSeasons[0] || null;

  const currentChampions = useMemo(() => {
    if (!displaySeason) return /** @type {SeasonChampionEntry[]} */ ([]);
    return displaySeason.classes?.[selectedClass] || [];
  }, [displaySeason, selectedClass]);

  const totalCrowns = crownedSeasons.length;
  const activeConfig = CLASS_CONFIG[selectedClass];
  const activeDivision = divisionOfClass(selectedClass);
  const soundSport = isSoundSportClass(selectedClass);

  // Margin / spread stats for the champion plaque
  const fieldStats = useMemo(() => {
    if (currentChampions.length === 0) return { margin: null, gap: null };
    const top = currentChampions[0]?.score;
    const second = currentChampions[1]?.score;
    const last = currentChampions[currentChampions.length - 1]?.score;
    return {
      margin: typeof top === 'number' && typeof last === 'number' ? top - last : null,
      gap: typeof top === 'number' && typeof second === 'number' ? top - second : null,
    };
  }, [currentChampions]);

  const handleHangBanner = async () => {
    if (!displaySeason || purchasingBanner) return;
    setPurchasingBanner(true);
    try {
      const result = await purchaseHallBanner({
        seasonId: displaySeason.id,
        corpsClass: selectedClass,
        message: bannerMessage,
      });
      if (result.data.success) {
        toast.success(result.data.message);
        // Patch local state so the banner appears without a refetch
        const seasonId = displaySeason.id;
        const message = bannerMessage.replace(/\s+/g, ' ').trim();
        setSeasons((prev) =>
          prev.map((s) =>
            s.id !== seasonId
              ? s
              : {
                  ...s,
                  classes: {
                    ...s.classes,
                    [selectedClass]: (s.classes[selectedClass] || []).map((e) =>
                      e.rank === 1 && e.uid === currentUid ? { ...e, banner: { message } } : e
                    ),
                  },
                }
          )
        );
        setShowBannerModal(false);
        setBannerMessage('');
      }
    } catch (error) {
      console.error('Error hanging banner:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to hang banner');
    } finally {
      setPurchasingBanner(false);
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  // Mobile: the sidebar (season list) shows until the user picks a season.
  const showSidebarOnly = !selectedSeason;
  const champion = currentChampions[0];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex-1 flex min-h-0">
        {/* ========================================================
            SIDEBAR — Division/Class switcher + Season list
            ======================================================== */}
        <div
          className={`flex flex-col min-h-0 border-r border-line bg-surface-sunken ${
            selectedSeason ? 'hidden lg:flex lg:w-72 xl:w-80' : 'w-full lg:w-72 xl:w-80'
          }`}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-line bg-surface-card">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-brand" />
              <h1 className="text-sm font-bold text-white uppercase tracking-widest">
                Hall of Champions
              </h1>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1 text-muted">
                <Crown className="w-3 h-3 text-brand" />
                <span className="font-data tabular-nums text-secondary">
                  {totalCrowns}
                </span> Crowned {totalCrowns === 1 ? 'Season' : 'Seasons'}
              </span>
              <Link
                to="/records"
                className="font-bold text-interactive hover:text-interactive-hover whitespace-nowrap"
              >
                Records Book →
              </Link>
            </div>
          </div>

          <DivisionSwitcher
            divisions={visibleDivisions}
            selectedClass={selectedClass}
            onSelectClass={selectClass}
          />

          {/* Section label */}
          <div className="flex-shrink-0 bg-background border-b border-line px-4 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
              {soundSport ? 'Best in Show' : 'Champions'} · Most Recent First
            </span>
          </div>

          {/* Season list */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum">
            {crownedSeasons.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Trophy className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-xs text-muted uppercase tracking-wider">
                  No {activeConfig?.name} champions recorded
                </p>
              </div>
            ) : (
              crownedSeasons.map((season) => (
                <SeasonRow
                  key={season.id}
                  season={season}
                  isSelected={displaySeason?.id === season.id}
                  classKey={selectedClass}
                  onSelect={setSelectedSeason}
                />
              ))
            )}
          </div>
        </div>

        {/* ========================================================
            MAIN STAGE — Champion plaque + finalists table
            ======================================================== */}
        <div
          className={`flex-1 min-w-0 flex flex-col min-h-0 ${showSidebarOnly ? 'hidden lg:flex' : 'flex'}`}
        >
          {!displaySeason ? (
            <div className="flex-1 flex items-center justify-center px-4">
              <NoChampionsPanel label={activeConfig?.name || 'Season'} />
            </div>
          ) : (
            <>
              {/* Mobile back bar */}
              <div className="lg:hidden flex-shrink-0 px-4 py-2.5 border-b border-line bg-surface-card">
                <button
                  onClick={() => setSelectedSeason(null)}
                  className="flex items-center gap-2 text-secondary hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Seasons</span>
                </button>
              </div>

              {/* Season header strip */}
              <div className="flex-shrink-0 bg-surface-card border-b border-line">
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted mb-0.5">
                      <span>{activeDivision.name} · Championship Record</span>
                    </div>
                    <Heading level="section" as="h2" className="truncate">
                      {parseSeasonName(displaySeason.seasonName).type}{' '}
                      <span className="text-muted font-data tabular-nums">
                        {parseSeasonName(displaySeason.seasonName).year}
                      </span>
                    </Heading>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-background border border-line text-secondary">
                      <Users className="w-3 h-3" />
                      {currentChampions.length} {soundSport ? 'Ensembles' : 'Finalists'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 font-bold ${
                        soundSport ? 'bg-interactive text-white' : 'bg-brand text-black'
                      }`}
                    >
                      {activeConfig?.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                  {champion && (
                    <ChampionPlaque
                      champion={champion}
                      season={displaySeason}
                      classKey={selectedClass}
                      fieldStats={fieldStats}
                      isOwner={!!currentUid && champion.uid === currentUid}
                      onHangBanner={() => setShowBannerModal(true)}
                    />
                  )}
                  <FinalistsTable champions={currentChampions} classKey={selectedClass} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hang-a-banner modal (extracted to HallOfChampionsParts) */}
      <BannerModal
        open={showBannerModal}
        message={bannerMessage}
        purchasing={purchasingBanner}
        onMessageChange={setBannerMessage}
        onClose={() => setShowBannerModal(false)}
        onConfirm={handleHangBanner}
      />
    </div>
  );
};

export default HallOfChampions;
