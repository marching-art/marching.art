// Presentational sections for the Scores page: pill tabs, recap box scores,
// SoundSport medal list, and class standings. Styled to match the Podium Class
// recap sheet (PodiumRecapSheet) — sheet cards, gold box-toppers, per-show
// mastheads, Podium-style sort pills, and a wordmark footer — so every scoring
// surface reads as one system.
//
// Rows use fit-to-width flex columns (not a horizontally-scrolling table): the
// fantasy classes only surface GE/VIS/MUS + Total, which fits a phone without
// horizontal scroll. Per the anti-lineup-harvesting rule (§5.4) the fantasy
// sheets stay condensed to GE/VIS/MUS; full per-caption columns are Podium-only.

import React, { useMemo, memo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Music,
  ChevronRight,
  MapPin,
  Medal,
  Users,
} from 'lucide-react';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { formatEventName } from '../utils/season';
import {
  RATING_CONFIG,
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  mergeTwoNightShows,
} from '../utils/scoresUtils';

// =============================================================================
// SHARED PODIUM-SHEET STYLE TOKENS + PRIMITIVES
// The Podium recap sheet is the reference: #1a1a1a card on a #333 border, gold
// (#c9a227) box-toppers/accents, blue (#0057B8 / #4d9fff) for the viewer's own
// corps, thin #242424 row dividers.
// =============================================================================

const SHEET_CARD = 'bg-surface-card border border-line rounded-none p-3 md:p-4';
const GOLD = 'text-brand';

// Fixed numeric-column widths so caption values line up across every row and
// card while the corps column flexes and truncates — the key to a box-score
// look that never forces horizontal scroll on mobile.
const CAP_W = 'w-[42px]';
const TOTAL_W = 'w-[52px]';

const BlueRibbonIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Ribbon circle/badge */}
    <circle cx="12" cy="9" r="7" fill="#0057B8" stroke="#003d82" strokeWidth="1" />
    {/* Inner circle highlight */}
    <circle cx="12" cy="9" r="4" fill="#0066d6" />
    {/* Star in center */}
    <path
      d="M12 5.5l1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.1l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.5z"
      fill="#FFD700"
    />
    {/* Ribbon tails */}
    <path d="M8 15l-2 7 4-2.5V15H8z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
    <path d="M16 15l2 7-4-2.5V15h2z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
  </svg>
);

// Per-sheet masthead — mirrors the Podium ShowTable header (event name left,
// location/date right, hairline underline).
const SheetMasthead = ({ title, location, date }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-line-muted pb-1.5">
    <div className="text-[13px] font-bold text-white truncate min-w-0">{title}</div>
    {(location || date) && (
      <div className="flex items-center gap-2 flex-shrink-0 pl-2 text-[10px] uppercase tracking-wider text-muted">
        {location && (
          <span className="hidden sm:flex items-center gap-1 truncate max-w-[160px]">
            <MapPin className="w-3 h-3" />
            {location}
          </span>
        )}
        {date && <span className="tabular-nums normal-case">{date}</span>}
      </div>
    )}
  </div>
);

// Column-header row for the flex box scores. `active` gold-highlights the
// caption currently being sorted on (parity with the Podium sheet).
const BoxScoreHead = ({ active, totalLabel = 'Total', trailing = null }) => (
  <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-line text-[9px] uppercase tracking-wider">
    <span className="flex-1 min-w-0 text-muted">Pl · Corps</span>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {['GE', 'VIS', 'MUS'].map((cap) => (
        <span key={cap} className={`${CAP_W} text-right ${active === cap ? GOLD : 'text-muted'}`}>
          {cap}
        </span>
      ))}
      <span className={`${TOTAL_W} text-right text-white`}>{totalLabel}</span>
      {trailing}
    </div>
  </div>
);

// Place · avatar · corps name · director credit (linked). The director line is
// the secondary row the fantasy sheets already carried, now styled to match the
// Podium sheet's understated credit.
const CorpsIdentity = ({ place, name, isMine, displayName, uid, tag, avatarUrl }) => (
  <div className="flex-1 min-w-0 flex items-center gap-2">
    <span className="text-[11px] text-muted tabular-nums flex-shrink-0">{place}.</span>
    <TeamAvatar name={name} logoUrl={avatarUrl} size="xs" />
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={`text-[11px] font-bold truncate ${isMine ? 'text-interactive' : 'text-white'}`}
        >
          {name}
        </span>
        {tag}
      </div>
      {displayName &&
        (uid ? (
          <Link
            to={`/profile/${uid}`}
            className="block text-[10px] text-muted hover:text-interactive truncate"
          >
            {displayName}
          </Link>
        ) : (
          <span className="block text-[10px] text-muted truncate">{displayName}</span>
        ))}
    </div>
  </div>
);

// A single GE/VIS/MUS value — gold + bold when it's the box-topper for its
// column, white when it's the active sort, muted otherwise.
const CaptionValue = ({ value, isTop, active, width = CAP_W }) => (
  <span
    className={`${width} text-right tabular-nums ${
      isTop ? `font-bold ${GOLD}` : active ? 'text-white' : 'text-secondary'
    }`}
  >
    {value !== null && value !== undefined ? value.toFixed(2) : '—'}
  </span>
);

// Wordmark / legend footer — echoes the Podium sheet's "screenshots are ads"
// footer and quietly documents why the fantasy sheets are GE/VIS/MUS only.
const SheetFooter = ({ note }) => (
  <div className="flex justify-between items-center gap-2 pt-1 text-[9px] uppercase tracking-wider text-muted">
    <span className="truncate">{note}</span>
    <span className="font-bold text-muted flex-shrink-0">marching.art</span>
  </div>
);

// Highest GE/VIS/MUS across a set of caption breakdowns (box-toppers).
const captionTops = (list) => {
  const tops = { ge: null, vis: null, mus: null };
  for (const caps of list) {
    if (!caps) continue;
    for (const key of ['ge', 'vis', 'mus']) {
      if (caps[key] != null && (tops[key] == null || caps[key] > tops[key])) {
        tops[key] = caps[key];
      }
    }
  }
  return tops;
};

// =============================================================================
// PILL TAB CONTROL (Design System) — unchanged shell chrome
// =============================================================================

const PillTabControl = ({ tabs, activeTab, onTabChange, haptic }) => {
  const scrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Right-edge fade hint when tabs overflow off-screen (matches DataTable's
  // scroll-hint pattern) — without it, off-screen tabs are undiscoverable.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const hasMore = el.scrollWidth > el.clientWidth;
      const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setCanScrollRight(hasMore && notAtEnd);
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    el.addEventListener('scroll', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      el.removeEventListener('scroll', checkScroll);
    };
  }, [tabs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-hide bg-transparent border-b border-line"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              haptic?.('medium');
              onTabChange(tab.id);
            }}
            className={`px-3 sm:px-4 py-2.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
              activeTab === tab.id
                ? tab.accent === 'green'
                  ? 'text-green-400 border-green-500'
                  : tab.accent === 'yellow'
                    ? 'text-interactive border-interactive'
                    : 'text-white border-interactive'
                : 'text-muted hover:text-secondary border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// =============================================================================
// SORT BAR — Podium-style gold pills (shared by the standings grid)
// =============================================================================

const SortPills = ({ options, value, onChange }) => (
  <div className="flex items-center gap-1 flex-shrink-0">
    {options.map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        aria-pressed={value === opt.id}
        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-none transition-colors ${
          value === opt.id
            ? 'bg-interactive text-white'
            : 'bg-surface-raised text-muted hover:text-secondary'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// =============================================================================
// RECAP BOX SCORE - one card per show (memoized: sibling recaps don't re-render)
// =============================================================================

const RecapDataGrid = memo(({ scores, eventName, location, date, userCorpsName }) => {
  // Pre-compute all caption breakdowns once (real data only, no synthetic values)
  const rows = useMemo(() => {
    if (!scores || scores.length === 0) return [];
    return scores.map((score) => ({ score, captions: getCaptionBreakdown(score) }));
  }, [scores]);
  const tops = useMemo(() => captionTops(rows.map((r) => r.captions)), [rows]);

  if (!scores || scores.length === 0) return null;

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      <SheetMasthead title={formatEventName(eventName)} location={location} date={date} />
      <BoxScoreHead />
      <div>
        {rows.map(({ score, captions }, idx) => {
          const isUserCorps =
            userCorpsName &&
            (score.corps?.toLowerCase() === userCorpsName.toLowerCase() ||
              score.corpsName?.toLowerCase() === userCorpsName.toLowerCase());

          return (
            <div
              key={idx}
              className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                isUserCorps ? 'bg-interactive/10' : ''
              }`}
            >
              <CorpsIdentity
                place={idx + 1}
                name={score.corpsName || score.corps}
                isMine={isUserCorps}
                displayName={score.displayName}
                uid={score.uid}
                avatarUrl={score.avatarUrl}
              />
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                <CaptionValue value={captions?.ge} isTop={captions?.ge === tops.ge} />
                <CaptionValue value={captions?.vis} isTop={captions?.vis === tops.vis} />
                <CaptionValue value={captions?.mus} isTop={captions?.mus === tops.mus} />
                <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                  {(score.score || score.totalScore || 0).toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// =============================================================================
// TWO-NIGHT COMBINED STANDINGS — the Eastern Classic (days 41-42, §5.11).
// One event, two nightly drops: once Saturday processes, this sheet merges
// both nights into per-class combined standings with Night 1/2 badges. The
// small uniform night-two growth bump is published, not hidden — that's the
// real DCI recap-thread experience.
// =============================================================================

const NIGHT_BADGE = {
  1: 'bg-interactive/15 text-interactive',
  2: 'bg-purple-500/15 text-purple-300',
};

const EasternCombinedSheet = memo(({ shows, userCorpsName }) => {
  const combined = useMemo(() => mergeTwoNightShows(shows || []), [shows]);
  if (!combined) return null;

  return (
    <div className={`${SHEET_CARD} space-y-3`}>
      {/* Masthead — gold-tinted to flag the marquee event */}
      <div className="flex items-baseline justify-between gap-2 border-b border-brand/40 pb-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand">
            Combined Standings · Both Nights
          </div>
          <div className="font-bold text-white text-[13px] truncate">
            {formatEventName(combined.eventName)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pl-2 text-[10px] uppercase tracking-wider text-muted">
          {combined.location && (
            <span className="hidden sm:flex items-center gap-1 truncate max-w-[140px]">
              <MapPin className="w-3 h-3" />
              {combined.location}
            </span>
          )}
          {combined.dateRange && (
            <span className="tabular-nums normal-case">{combined.dateRange}</span>
          )}
        </div>
      </div>

      {/* Per-class sections */}
      {combined.sections.map((section) => {
        const sectionTops = captionTops(section.rows.map((row) => getCaptionBreakdown(row)));
        return (
          <div key={section.corpsClass} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {section.label}
              </span>
              <span className="text-[9px] text-muted tabular-nums">
                {section.rows.length} corps
              </span>
            </div>
            <BoxScoreHead trailing={<span className="w-7 text-right text-muted">Night</span>} />
            <div>
              {section.rows.map((row, idx) => {
                const isUserCorps =
                  userCorpsName && row.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
                const captions = getCaptionBreakdown(row);
                return (
                  <div
                    key={`${row.corpsName}-${idx}`}
                    className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                      isUserCorps ? 'bg-interactive/10' : ''
                    }`}
                  >
                    <CorpsIdentity
                      place={idx + 1}
                      name={row.corpsName || row.corps}
                      isMine={isUserCorps}
                      displayName={row.displayName}
                      uid={row.uid}
                      avatarUrl={row.avatarUrl}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                      <CaptionValue value={captions?.ge} isTop={captions?.ge === sectionTops.ge} />
                      <CaptionValue
                        value={captions?.vis}
                        isTop={captions?.vis === sectionTops.vis}
                      />
                      <CaptionValue
                        value={captions?.mus}
                        isTop={captions?.mus === sectionTops.mus}
                      />
                      <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                        {(row.score || row.totalScore || 0).toFixed(3)}
                      </span>
                      <span
                        className={`w-7 flex-shrink-0 text-center text-[9px] font-bold uppercase rounded-none py-0.5 ${NIGHT_BADGE[row.night]}`}
                      >
                        N{row.night}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <SheetFooter note="Night 2 carries one extra day of growth · box-toppers in gold" />
    </div>
  );
});

// =============================================================================
// SOUNDSPORT MEDAL LIST - GROUPED BY EVENT (rating-based, no numeric scores)
// Keeps its green medal identity but adopts the Podium sheet card + masthead.
// =============================================================================

// Mock event names for shows that may not have proper names
const MOCK_EVENT_NAMES = [
  'SoundSport International Music & Food Festival',
  'DCI Indianapolis SoundSport',
  'Atlanta SoundSport Showcase',
  'Midwest SoundSport Classic',
  'SoundSport Championship Series',
  'Summer Music Games SoundSport',
];

const SoundSportMedalList = ({ shows }) => {
  // Group results by event, preserving show context
  const groupedResults = useMemo(() => {
    const groups = [];
    let mockNameIndex = 0;

    shows
      .filter((show) => show.scores?.some((s) => s.corpsClass === 'soundSport'))
      .forEach((show) => {
        const soundSportScores = show.scores
          .filter((s) => s.corpsClass === 'soundSport')
          .map((score) => ({
            ...score,
            rating: getSoundSportRating(score.score),
          }));

        if (soundSportScores.length > 0) {
          // Find best in show (highest score at this event)
          const maxScore = Math.max(...soundSportScores.map((s) => s.score || 0));
          const bestInShowCorps =
            soundSportScores.find((s) => s.score === maxScore)?.corps ||
            soundSportScores.find((s) => s.score === maxScore)?.corpsName;

          // Mark best in show
          soundSportScores.forEach((score) => {
            const corpsName = score.corps || score.corpsName;
            score.isBestInShow = corpsName === bestInShowCorps;
          });

          // Use show eventName or mock one for display
          const eventName =
            show.eventName || MOCK_EVENT_NAMES[mockNameIndex % MOCK_EVENT_NAMES.length];

          // Shuffle to avoid implied rankings (SoundSport is rating-based, not placement-based)
          // Use deterministic shuffle so order is consistent on re-renders
          const shuffledScores = seededShuffle(soundSportScores, eventName);
          mockNameIndex++;

          groups.push({
            eventName,
            date: show.date || 'TBD',
            location: show.location || 'Various Locations',
            scores: shuffledScores,
          });
        }
      });

    return groups;
  }, [shows]);

  // Aggregate stats across all groups
  const stats = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Bronze: 0, Participation: 0, total: 0 };
    groupedResults.forEach((group) => {
      group.scores.forEach((r) => {
        counts[r.rating]++;
        counts.total++;
      });
    });
    return counts;
  }, [groupedResults]);

  if (groupedResults.length === 0) {
    return (
      <div className="p-8 text-center">
        <Music className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-muted text-sm">No SoundSport results yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats summary card */}
      <div className={`${SHEET_CARD} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-green-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            SoundSport Results
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-brand">
            <Medal className="w-3 h-3" />
            {stats.Gold}
          </span>
          <span className="flex items-center gap-1 text-secondary">
            <Medal className="w-3 h-3" />
            {stats.Silver}
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <Medal className="w-3 h-3" />
            {stats.Bronze}
          </span>
          <span className="text-muted">
            <Users className="w-3 h-3 inline mr-1" />
            {stats.total}
          </span>
        </div>
      </div>

      {/* Grouped Results by Event — one sheet card per event */}
      {groupedResults.map((group, groupIdx) => (
        <div key={groupIdx} className={`${SHEET_CARD} space-y-2.5`}>
          <SheetMasthead
            title={formatEventName(group.eventName)}
            location={group.location}
            date={group.date}
          />
          <div>
            {group.scores.map((result, idx) => {
              const config = RATING_CONFIG[result.rating];
              return (
                <div
                  key={idx}
                  className="px-1 py-1.5 flex items-center justify-between gap-2 border-b border-line-subtle last:border-b-0"
                >
                  {/* Left: Medal Icon + Avatar + Ensemble Name + Director */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 ${config.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Medal className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <TeamAvatar
                      name={result.corps || result.corpsName}
                      logoUrl={result.avatarUrl}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-white text-[11px] block truncate">
                        {result.corps || result.corpsName}
                      </span>
                      {result.displayName &&
                        (result.uid ? (
                          <Link
                            to={`/profile/${result.uid}`}
                            className="text-[10px] text-muted hover:text-interactive block truncate"
                          >
                            {result.displayName}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-muted block truncate">
                            {result.displayName}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Right: Best in Show + Rating Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.isBestInShow && <BlueRibbonIcon className="w-5 h-5" />}
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 ${config.badge}`}>
                      {result.rating}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* One scoring-explainer link for the whole page, not per show */}
      <Link
        to="/guide"
        className="flex items-center gap-2 text-[10px] text-green-400 hover:text-green-300 font-bold uppercase tracking-wider transition-colors px-1 pt-1"
      >
        About SoundSport scoring
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

// =============================================================================
// STANDINGS SHEET FOR CLASS TABS
// =============================================================================

// Caption Leaders sorting (§5.4): the fantasy classes sort by the CONDENSED
// captions only (GE/VIS/MUS) — per-caption detail stays Podium-exclusive so
// lineups can't be harvested from the sheet.
const STANDINGS_SORTS = [
  { id: 'total', label: 'Score' },
  { id: 'GE', label: 'GE' },
  { id: 'VIS', label: 'VIS' },
  { id: 'MUS', label: 'MUS' },
];

const ClassStandingsGrid = ({ standings, className, userCorpsName }) => {
  const [sortBy, setSortBy] = useState('total');

  // Pre-compute breakdowns per entry (real data only, no synthetic values),
  // then order by the selected caption — corps without caption data sort last.
  const sorted = useMemo(() => {
    if (!standings || standings.length === 0) return [];
    const withCaptions = standings.map((entry) => ({
      entry,
      captions: getCaptionBreakdown(entry.scores?.[0] || entry),
    }));
    if (sortBy === 'total') return withCaptions;
    const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
    return [...withCaptions].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1));
  }, [standings, sortBy]);

  const tops = useMemo(() => captionTops(sorted.map((s) => s.captions)), [sorted]);

  if (!standings || standings.length === 0) {
    return (
      <div className="p-8 text-center">
        <Trophy className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-muted text-sm">No {className} standings yet</p>
      </div>
    );
  }

  const activeCap = sortBy === 'total' ? null : sortBy;

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      {/* Section header + Podium-style sort pills */}
      <div className="flex items-center justify-between gap-2 border-b border-line-muted pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
          {sortBy === 'total'
            ? `${className} · Season Standings`
            : `${className} · ${sortBy} Leaders`}
        </span>
        <SortPills options={STANDINGS_SORTS} value={sortBy} onChange={setSortBy} />
      </div>

      <BoxScoreHead
        active={activeCap}
        totalLabel="Score"
        trailing={<span className="w-4" aria-hidden="true" />}
      />

      <div>
        {sorted.map(({ entry, captions }, idx) => {
          const isUserCorps =
            userCorpsName && entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
          const trend = entry.trend?.direction || 0;

          return (
            <div
              key={entry.corpsName || idx}
              className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                isUserCorps ? 'bg-interactive/10' : ''
              }`}
            >
              {/* Rank — position under the active sort (caption rank when caption-sorted) */}
              <CorpsIdentity
                place={sortBy === 'total' ? entry.rank : idx + 1}
                name={entry.corpsName}
                isMine={isUserCorps}
                displayName={entry.displayName}
                uid={entry.uid}
                avatarUrl={entry.avatarUrl}
              />
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                <CaptionValue
                  value={captions?.ge}
                  isTop={captions?.ge === tops.ge}
                  active={activeCap === 'GE'}
                />
                <CaptionValue
                  value={captions?.vis}
                  isTop={captions?.vis === tops.vis}
                  active={activeCap === 'VIS'}
                />
                <CaptionValue
                  value={captions?.mus}
                  isTop={captions?.mus === tops.mus}
                  active={activeCap === 'MUS'}
                />
                <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                  {typeof entry.score === 'number' ? entry.score.toFixed(3) : '-'}
                </span>
                <span className="w-4 flex items-center justify-center flex-shrink-0">
                  {trend > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <SheetFooter note="GE/VIS/MUS shown · full captions are Podium Class only" />
    </div>
  );
};

export {
  BlueRibbonIcon,
  PillTabControl,
  RecapDataGrid,
  EasternCombinedSheet,
  SoundSportMedalList,
  ClassStandingsGrid,
};
