// =============================================================================
// TOUR MAP MODAL
// =============================================================================
// A director's season as a route across the country: the shareable poster
// (TourPoster), the readable itinerary beneath it, and one tab per corps in the
// portfolio. The poster is the artifact — screenshot it, save the PNG, or push
// it through the native share sheet; the HTML list below is the accessible,
// tappable version of the same data and drives the poster's highlight.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Download, Map as MapIcon, MapPin, Share2, Trophy, X } from 'lucide-react';
import Portal from '../Portal';
import TourPoster, { type PosterStat, type PosterStop } from './TourPoster';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  buildTourStops,
  tourDistance,
  tourRegions,
  type PodiumAttendance,
  type TourSource,
} from '../../utils/tourStops';
import { downloadPoster, posterFilename, sharePoster } from '../../utils/posterExport';
import { shareOrCopy } from '../../utils/shareSheet';
import { formatEventName } from '../../utils/season';
import { isEventPast } from '../../utils/scheduleUtils';
import { describeConceptStyle } from '../../utils/showConcept';
import {
  CORPS_CLASS_LABELS,
  PROFILE_CORPS_CLASS_ORDER,
  resolveCorpsForClass,
} from '../../utils/corps';
import { CHAMPIONSHIP_EVENTS, CLASS_CONFIG } from '../../pages/scheduleConstants';

/** CLASS_CONFIG is an untyped JS constant map; look classes up by string key. */
const CLASS_STYLES: Record<string, { name?: string; color?: string }> = CLASS_CONFIG;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** The slice of a profile corps record this modal reads. */
interface TourCorps {
  corpsName?: string;
  selectedShows?: Record<string, TourSource[]>;
  showConcept?: unknown;
  seasonHighScore?: number;
}

export interface TourMapModalProps {
  userProfile?: {
    corps?: Record<string, TourCorps>;
    username?: string;
    displayName?: string;
  } | null;
  /** Every show of the season, transformed (scheduleUtils.transformCompetitionToShow). */
  competitions?: TourSource[];
  /** Competition day number → real calendar date. */
  getActualDate?: (day: number) => Date | null;
  seasonName?: string;
  podiumAttendance?: (PodiumAttendance & { corpsName?: string }) | null;
  onClose: () => void;
}

interface CorpsTab {
  corpsClass: string;
  corps: TourCorps | null;
  name: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** "Jun 21" — the compact date the poster and the list both use. */
const shortDate = (date: Date | null, day: number): string =>
  date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Day ${day}`;

/** The season's show title, when the director has named one. */
const showTitleFor = (corps: TourCorps | null): string => {
  const concept = corps?.showConcept;
  if (typeof concept === 'string') return concept;
  return (
    (concept as { showName?: string } | undefined)?.showName || describeConceptStyle(concept) || ''
  );
};

const formatScore = (value?: number): string =>
  typeof value === 'number' && value > 0 ? value.toFixed(3) : '—';

// -----------------------------------------------------------------------------
// Itinerary row
// -----------------------------------------------------------------------------

const StopRow: React.FC<{
  stop: PosterStop;
  isActive: boolean;
  onHover: (index: number | null) => void;
}> = ({ stop, isActive, onHover }) => {
  const accent =
    stop.kind === 'championship'
      ? 'text-brand border-brand/40'
      : stop.kind === 'major'
        ? 'text-brand-strong border-brand-strong/40'
        : 'text-interactive border-interactive/40';

  return (
    <li
      onMouseEnter={() => onHover(stop.index)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(stop.index)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      aria-current={isActive ? true : undefined}
      className={`flex items-center gap-3 px-3 py-2 border-b border-line-subtle last:border-b-0 ${
        isActive ? 'bg-surface-raised' : ''
      } ${stop.isPast ? 'opacity-70' : ''}`}
    >
      <span
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center border font-data text-[11px] font-bold rounded-none ${accent} ${
          stop.point ? '' : 'opacity-50'
        }`}
      >
        {String(stop.index).padStart(2, '0')}
      </span>

      <span className="flex-shrink-0 w-16 font-data text-[11px] text-muted tabular-nums">
        {stop.dateLabel}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-white truncate">{stop.displayName}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted truncate">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          {stop.locationLabel || 'Location TBA'}
          {!stop.point && stop.locationLabel && (
            <span className="text-[9px] uppercase tracking-wider">· not mapped</span>
          )}
        </span>
      </span>

      <span className="flex-shrink-0 flex items-center gap-1">
        {stop.kind !== 'show' && (
          <Trophy
            className={`w-3 h-3 ${stop.kind === 'championship' ? 'text-brand' : 'text-brand-strong'}`}
            aria-label={stop.kind === 'championship' ? 'Championship' : 'Major'}
          />
        )}
        {stop.auto && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Auto</span>
        )}
        {stop.isPast && <Check className="w-3 h-3 text-success" aria-label="Completed" />}
      </span>
    </li>
  );
};

// -----------------------------------------------------------------------------
// Modal
// -----------------------------------------------------------------------------

const TourMapModal: React.FC<TourMapModalProps> = ({
  userProfile,
  competitions = [],
  getActualDate,
  seasonName,
  podiumAttendance = null,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEscapeKey(onClose);
  useFocusTrap(dialogRef);

  // One tab per corps the director actually has, in portfolio order. The Podium
  // corps only appears when the Schedule page resolved its attendance.
  const corpsTabs = useMemo<CorpsTab[]>(() => {
    const tabs: CorpsTab[] = [];
    for (const corpsClass of PROFILE_CORPS_CLASS_ORDER) {
      if (corpsClass === 'podiumClass') {
        if (podiumAttendance) {
          tabs.push({
            corpsClass,
            corps: null,
            name: podiumAttendance.corpsName || 'Podium Corps',
          });
        }
        continue;
      }
      const corps = resolveCorpsForClass<TourCorps>(userProfile?.corps, corpsClass);
      if (corps?.corpsName) tabs.push({ corpsClass, corps, name: corps.corpsName });
    }
    return tabs;
  }, [userProfile, podiumAttendance]);

  const [selectedClass, setSelectedClass] = useState<string | null>(
    () => corpsTabs[0]?.corpsClass || null
  );
  const activeTab = corpsTabs.find((t) => t.corpsClass === selectedClass) || corpsTabs[0] || null;

  // The itinerary, decorated with everything both views need: display index,
  // real calendar date, and whether the show has already happened.
  const stops = useMemo<PosterStop[]>(() => {
    if (!activeTab) return [];
    const raw = buildTourStops({
      corps: activeTab.corps,
      corpsClass: activeTab.corpsClass,
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
      podiumAttendance,
    });
    return raw.map((stop, i) => {
      const date = getActualDate?.(stop.day) || null;
      return {
        ...stop,
        index: i + 1,
        displayName: formatEventName(stop.eventName),
        dateLabel: shortDate(date, stop.day),
        locationLabel: stop.point ? `${stop.point.city}, ${stop.point.region}` : stop.location,
        isPast: date ? isEventPast(date) : false,
      };
    });
  }, [activeTab, competitions, podiumAttendance, getActualDate]);

  const stats = useMemo<PosterStat[]>(
    () => [
      { label: 'STOPS', value: String(stops.length) },
      { label: 'STATES', value: String(tourRegions(stops).length) },
      { label: 'MILES', value: tourDistance(stops).toLocaleString() },
      { label: 'HIGH SCORE', value: formatScore(activeTab?.corps?.seasonHighScore) },
    ],
    [stops, activeTab]
  );

  const posterTitle = activeTab
    ? `${activeTab.name} — ${seasonName || ''} tour map, ${stops.length} stops`.replace('  ', ' ')
    : 'Tour map';

  // The text fallback: if rasterizing the poster fails, a director can still
  // paste their itinerary into Discord.
  const itineraryText = useMemo(() => {
    if (!activeTab) return '';
    const lines = stops.map(
      (stop) =>
        `${String(stop.index).padStart(2, '0')}  ${stop.dateLabel.padEnd(7)}  ${stop.displayName} — ${stop.locationLabel || 'TBA'}`
    );
    return [
      `${activeTab.name} · ${CORPS_CLASS_LABELS[activeTab.corpsClass] || ''} · ${seasonName || ''}`,
      `${stops.length} stops · ${tourRegions(stops).length} states · ${tourDistance(stops).toLocaleString()} miles`,
      '',
      ...lines,
    ].join('\n');
  }, [stops, activeTab, seasonName]);

  const handleShare = useCallback(async () => {
    if (!posterRef.current || busy) return;
    setBusy(true);
    try {
      const result = await sharePoster(posterRef.current, {
        filename: posterFilename(activeTab?.name),
        title: posterTitle,
        text: `${activeTab?.name} tour map — marching.art`,
      });
      if (result === 'downloaded') toast.success('Tour map saved');
    } catch {
      const copied = await shareOrCopy(itineraryText);
      toast[copied ? 'success' : 'error'](
        copied ? 'Itinerary copied' : 'Could not share the tour map'
      );
    } finally {
      setBusy(false);
    }
  }, [activeTab, posterTitle, itineraryText, busy]);

  const handleDownload = useCallback(async () => {
    if (!posterRef.current || busy) return;
    setBusy(true);
    try {
      await downloadPoster(posterRef.current, posterFilename(activeTab?.name));
      toast.success('Tour map saved');
    } catch {
      toast.error('Could not save the tour map');
    } finally {
      setBusy(false);
    }
  }, [activeTab, busy]);

  const classConfig = CLASS_STYLES[activeTab?.corpsClass || ''] || {};
  const performed = stops.filter((s) => s.isPast).length;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-map-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-7xl bg-surface-card border-t sm:border border-line rounded-none flex flex-col max-h-[92dvh] overflow-hidden"
        >
          {/* HEADER */}
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-surface-raised">
            <h2
              id="tour-map-title"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary"
            >
              <MapIcon className="w-4 h-4 text-interactive" aria-hidden="true" />
              Tour Map
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                disabled={busy || !activeTab}
                className="h-9 px-3 flex items-center gap-1.5 border border-line text-[10px] font-bold uppercase tracking-wider text-secondary hover:border-line-strong hover:text-white disabled:opacity-50 rounded-none transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                Share
              </button>
              <button
                onClick={handleDownload}
                disabled={busy || !activeTab}
                className="h-9 px-3 flex items-center gap-1.5 bg-interactive text-white text-[10px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50 rounded-none transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden xs:inline">Save</span> PNG
              </button>
              <button
                onClick={onClose}
                aria-label="Close tour map"
                className="p-2.5 -mr-2 text-muted hover:text-white min-w-touch min-h-touch flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CORPS TABS */}
          {corpsTabs.length > 1 && (
            <div className="flex-shrink-0 flex items-center gap-1 p-1 bg-surface-sunken border-b border-line overflow-x-auto scrollbar-hide">
              {corpsTabs.map((tab) => {
                const config = CLASS_STYLES[tab.corpsClass] || {};
                const selected = tab.corpsClass === activeTab?.corpsClass;
                return (
                  <button
                    key={tab.corpsClass}
                    onClick={() => {
                      setSelectedClass(tab.corpsClass);
                      setActiveIndex(null);
                    }}
                    aria-pressed={selected}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap rounded-none transition-colors ${
                      selected
                        ? 'bg-interactive text-white'
                        : 'text-muted hover:text-secondary hover:bg-white/5'
                    }`}
                  >
                    <span className={selected ? '' : config.color}>{config.name || 'Corps'}</span>
                    <span className="normal-case tracking-normal opacity-80">{tab.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* BODY */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!activeTab ? (
              <div className="py-16 px-4 text-center">
                <MapIcon className="w-12 h-12 text-muted mx-auto mb-3" aria-hidden="true" />
                <h3 className="text-sm font-bold text-white mb-1">No corps yet</h3>
                <p className="text-xs text-muted">
                  Register a corps and pick some shows — your tour map draws itself.
                </p>
              </div>
            ) : (
              <>
                {/* POSTER — pans horizontally on narrow screens rather than
                    shrinking the itinerary type into illegibility. */}
                <div className="overflow-x-auto bg-background border-b border-line">
                  <div className="min-w-[720px] p-3">
                    <TourPoster
                      ref={posterRef}
                      title={posterTitle}
                      corpsName={activeTab.name}
                      classLabel={CORPS_CLASS_LABELS[activeTab.corpsClass] || 'Corps'}
                      showTitle={showTitleFor(activeTab.corps)}
                      seasonName={seasonName || ''}
                      directorName={
                        userProfile?.username
                          ? `@${userProfile.username}`
                          : userProfile?.displayName || ''
                      }
                      stops={stops}
                      stats={stats}
                      activeIndex={activeIndex}
                    />
                  </div>
                </div>

                {/* ITINERARY (the readable, tappable copy) */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Tour Stops
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${classConfig.color || 'text-muted'}`}
                    >
                      {performed} of {stops.length} performed
                    </span>
                  </div>

                  {stops.length === 0 ? (
                    <div className="border border-line bg-surface-sunken py-10 px-4 text-center">
                      <p className="text-sm font-bold text-white mb-1">No stops booked</p>
                      <p className="text-xs text-muted">
                        Register {activeTab.name} for shows on the schedule and they will appear
                        here.
                      </p>
                    </div>
                  ) : (
                    <ul className="border border-line bg-surface-sunken">
                      {stops.map((stop) => (
                        <StopRow
                          key={`${stop.day}-${stop.eventName}`}
                          stop={stop}
                          isActive={activeIndex === stop.index}
                          onHover={setActiveIndex}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default TourMapModal;
