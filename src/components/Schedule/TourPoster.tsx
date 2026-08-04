// =============================================================================
// TOUR POSTER — the shareable artifact
// =============================================================================
// One self-contained SVG: corps identity, the projected route across the lower
// 48, the numbered itinerary, and the season's tour stats. Self-contained is a
// requirement, not a preference — utils/posterExport.ts serializes this node
// and rasterizes it, so nothing here may depend on a stylesheet, a webfont, or
// a CSS variable. Colors come from src/data/tourPosterTheme.ts (the design
// tokens, transcribed) and every one is written as an attribute.
//
// The map paths (src/data/tourMapGeo.json) are pre-projected to a 960x600 box
// and dropped in at 1:1, so stroke widths never need rescaling.

import React, { useMemo } from 'react';
import {
  MAP_STATES,
  MAP_NEIGHBORS,
  MAP_VIEW,
  legPath,
  legMidpoint,
  placeLabels,
  type LabelPlacement,
  type VenuePoint,
} from '../../utils/tourMap';
import {
  POSTER,
  POSTER_COLORS as C,
  POSTER_FONTS as F,
  STOP_STYLES,
} from '../../data/tourPosterTheme';
import type { TourStop } from '../../utils/tourStops';

// Beyond this many stops the city labels collide into mush no matter how they
// are nudged — the itinerary column carries the names instead.
const MAX_MAP_LABELS = 20;

/** A stop decorated by the modal with everything both views render. */
export interface PosterStop extends TourStop {
  index: number;
  /** Event name as the site presents it (DCI → marching.art). */
  displayName: string;
  dateLabel: string;
  locationLabel: string;
  isPast: boolean;
}

/** A plotted stop — same shape, but known to carry map coordinates. */
type PlottedStop = PosterStop & { point: VenuePoint };

/**
 * One marker, which may stand for several stops. A corps plays Indianapolis
 * three nights running at championships and returns to a regional host city
 * later in the season; drawn per-stop those markers sit exactly on top of one
 * another and only the last one is visible.
 */
interface StopCluster {
  point: VenuePoint;
  /** Display number of the first visit — what the marker prints. */
  index: number;
  count: number;
  /** Highest tier among the visits: a championship outranks a major. */
  kind: TourStop['kind'];
  /** Filled only when every visit is behind the corps. */
  isPast: boolean;
  /** True when any of the clustered stops is the one being hovered. */
  indices: number[];
}

const KIND_RANK: Record<TourStop['kind'], number> = { show: 0, major: 1, championship: 2 };

/** Collapse stops that share a venue into one marker, in first-visit order. */
function clusterStops(plotted: PlottedStop[]): StopCluster[] {
  const byVenue = new Map<string, StopCluster>();
  for (const stop of plotted) {
    const existing = byVenue.get(stop.point.venueId);
    if (!existing) {
      byVenue.set(stop.point.venueId, {
        point: stop.point,
        index: stop.index,
        count: 1,
        kind: stop.kind,
        isPast: stop.isPast,
        indices: [stop.index],
      });
      continue;
    }
    existing.count += 1;
    existing.indices.push(stop.index);
    existing.isPast = existing.isPast && stop.isPast;
    if (KIND_RANK[stop.kind] > KIND_RANK[existing.kind]) existing.kind = stop.kind;
  }
  return [...byVenue.values()].sort((a, b) => a.index - b.index);
}

export interface PosterStat {
  label: string;
  value: string;
  accent?: string;
}

export interface TourPosterProps {
  corpsName: string;
  classLabel: string;
  showTitle?: string;
  seasonName?: string;
  directorName?: string;
  stops: PosterStop[];
  stats: PosterStat[];
  /** Stop number currently hovered in the itinerary list, if any. */
  activeIndex?: number | null;
  /** Accessible name for the whole poster. */
  title: string;
}

/** Clip a proportional-font string to an approximate character budget. */
const clip = (text: string | undefined, maxChars: number): string =>
  text && text.length > maxChars
    ? `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
    : text || '';

const styleFor = (kind: TourStop['kind']) => STOP_STYLES[kind] || STOP_STYLES.show;

// -----------------------------------------------------------------------------
// Map layer
// -----------------------------------------------------------------------------

const MapBase: React.FC<{ visitedRegions: Set<string> }> = ({ visitedRegions }) => (
  <g>
    {/* Neighbors first: Canada and Mexico sit behind the states, dimmer, so a
        stop just over the border still reads as landing on land. */}
    {MAP_NEIGHBORS.map((n) => (
      <path key={n.name} d={n.d} fill={C.panel} stroke={C.lineSubtle} strokeWidth="0.75" />
    ))}
    {MAP_STATES.map((s) => {
      // States the corps actually toured take a faint wash of the route color —
      // "where you went" in the same interactive/self azure as the route, so
      // the reach of a tour reads at a glance without adding a new hue.
      const visited = visitedRegions.has(s.code);
      return (
        <g key={s.id}>
          <path d={s.d} fill={C.card} stroke={visited ? C.line : C.lineMuted} strokeWidth="0.75" />
          {visited && <path d={s.d} fill={C.route} opacity="0.1" stroke="none" />}
        </g>
      );
    })}
  </g>
);

/** Field-grid dots — the logo's 9-dot motif, at the threshold of visibility. */
const GridDots: React.FC = () => {
  const dots: React.ReactElement[] = [];
  for (let x = 40; x < MAP_VIEW.width; x += 48) {
    for (let y = 40; y < MAP_VIEW.height; y += 48) {
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill={C.lineSubtle} />);
    }
  }
  return <g>{dots}</g>;
};

/**
 * The route. Past legs are solid, upcoming legs dashed — the same "already
 * happened vs. still ahead" split the schedule cards use.
 */
const Route: React.FC<{ plotted: PlottedStop[] }> = ({ plotted }) => (
  <g fill="none" strokeLinecap="round">
    {plotted.slice(1).map((stop, i) => {
      const from = plotted[i];
      const d = legPath(from.point, stop.point);
      if (!d) return null;
      const done = from.isPast && stop.isPast;
      const mid = legMidpoint(from.point, stop.point);
      return (
        <g key={`leg-${from.day}-${stop.day}-${i}`}>
          <path
            d={d}
            stroke={done ? C.route : C.routeDim}
            strokeWidth={done ? 1.75 : 1.5}
            strokeDasharray={done ? undefined : '5 4'}
            opacity={done ? 0.95 : 0.7}
          />
          {mid && (
            <polygon
              points="-4,-3.2 4.5,0 -4,3.2"
              fill={done ? C.route : C.routeDim}
              opacity={done ? 0.95 : 0.7}
              transform={`translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${mid.angle.toFixed(1)})`}
            />
          )}
        </g>
      );
    })}
  </g>
);

/**
 * Numbered stop markers. Square, per the design language; filled when the show
 * has happened, hollow when it is still ahead. A city visited more than once
 * carries a small count badge instead of a second marker underneath.
 */
const Markers: React.FC<{
  clusters: StopCluster[];
  labels: LabelPlacement[];
  activeIndex?: number | null;
}> = ({ clusters, labels, activeIndex }) => (
  <g>
    {clusters.map((cluster, i) => {
      const { color } = styleFor(cluster.kind);
      const active = activeIndex != null && cluster.indices.includes(activeIndex);
      const size = active ? 22 : 18;
      const half = size / 2;
      const { x, y } = cluster.point;
      const label = labels[i];
      return (
        <g key={cluster.point.venueId}>
          {active && (
            <rect
              x={x - half - 5}
              y={y - half - 5}
              width={size + 10}
              height={size + 10}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.5"
            />
          )}
          <rect
            x={x - half}
            y={y - half}
            width={size}
            height={size}
            fill={cluster.isPast ? color : C.background}
            stroke={color}
            strokeWidth={active ? 2 : 1.5}
          />
          <text
            x={x}
            y={y + 3.6}
            textAnchor="middle"
            fontFamily={F.mono}
            fontSize="10.5"
            fontWeight="700"
            fill={cluster.isPast ? C.background : color}
          >
            {cluster.index}
          </text>
          {cluster.count > 1 && (
            <>
              <rect x={x + half - 3} y={y - half - 8} width="15" height="11" fill={color} />
              <text
                x={x + half + 4.5}
                y={y - half - 0.2}
                textAnchor="middle"
                fontFamily={F.mono}
                fontSize="8"
                fontWeight="700"
                fill={C.background}
              >
                ×{cluster.count}
              </text>
            </>
          )}
          {label?.placed && (
            <text
              x={x + label.dx}
              y={y + label.dy + 3.6}
              textAnchor={label.anchor}
              fontFamily={F.sans}
              fontSize="10.5"
              fontWeight="600"
              fill={active ? C.white : C.secondary}
            >
              {cluster.point.city}
            </text>
          )}
        </g>
      );
    })}
  </g>
);

const Legend: React.FC = () => {
  const entries: TourStop['kind'][] = ['show', 'major', 'championship'];
  return (
    <g transform={`translate(14 ${MAP_VIEW.height - 44})`}>
      <rect width="356" height="30" fill={C.background} stroke={C.line} opacity="0.92" />
      {entries.map((kind, i) => (
        <g key={kind} transform={`translate(${12 + i * 84} 15)`}>
          <rect
            x="0"
            y="-5"
            width="10"
            height="10"
            fill="none"
            stroke={STOP_STYLES[kind].color}
            strokeWidth="1.5"
          />
          <text x="15" y="3.5" fontFamily={F.sans} fontSize="9.5" fill={C.muted}>
            {STOP_STYLES[kind].label}
          </text>
        </g>
      ))}
      <g transform="translate(282 15)">
        <path d="M0 0 L22 0" stroke={C.route} strokeWidth="1.75" />
        <polygon points="22,-3 28,0 22,3" fill={C.route} />
        <text x="33" y="3.5" fontFamily={F.sans} fontSize="9.5" fill={C.muted}>
          Route
        </text>
      </g>
    </g>
  );
};

// -----------------------------------------------------------------------------
// Itinerary column
// -----------------------------------------------------------------------------

const Itinerary: React.FC<{ stops: PosterStop[]; activeIndex?: number | null }> = ({
  stops,
  activeIndex,
}) => {
  const { width, height } = POSTER.list;
  const headerH = 30;
  const available = height - headerH - 12;
  // Rows compress as the season fills up rather than overflowing the panel.
  const rowH = Math.max(15, Math.min(28, available / Math.max(stops.length, 1)));
  const fontSize = rowH >= 24 ? 11.5 : rowH >= 19 ? 10.5 : 9.5;
  const nameX = 96;
  // Bold Inter runs about 0.6em per character. Budget by width so a long event
  // name is elided; the panel clip below is the belt-and-braces backstop for
  // names whose glyphs are wider than the average.
  const nameChars = Math.floor((width - nameX - 12) / (fontSize * 0.6));

  return (
    <g clipPath="url(#tour-list-clip)">
      <rect width={width} height={height} fill={C.card} stroke={C.line} />
      <rect width={width} height={headerH} fill={C.raised} />
      <line x1="0" y1={headerH} x2={width} y2={headerH} stroke={C.line} />
      <text
        x="12"
        y={headerH / 2 + 3.5}
        fontFamily={F.mono}
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.6"
        fill={C.secondary}
      >
        TOUR ITINERARY
      </text>
      <text
        x={width - 12}
        y={headerH / 2 + 3.5}
        textAnchor="end"
        fontFamily={F.mono}
        fontSize="10"
        fontWeight="700"
        fill={C.muted}
      >
        {stops.length}
      </text>

      {stops.map((stop, i) => {
        const y = headerH + 20 + i * rowH;
        const { color } = styleFor(stop.kind);
        const active = activeIndex === stop.index;
        return (
          <g key={`row-${stop.day}-${stop.eventName}`}>
            {active && (
              <rect x="1" y={y - rowH + 4} width={width - 2} height={rowH} fill={C.raised} />
            )}
            <text
              x="12"
              y={y}
              fontFamily={F.mono}
              fontSize={fontSize - 0.5}
              fontWeight="700"
              fill={stop.point ? color : C.muted}
            >
              {String(stop.index).padStart(2, '0')}
            </text>
            <text x="38" y={y} fontFamily={F.mono} fontSize={fontSize - 0.5} fill={C.muted}>
              {stop.dateLabel}
            </text>
            <text
              x={nameX}
              y={y}
              fontFamily={F.sans}
              fontSize={fontSize}
              fontWeight={stop.kind === 'show' ? '500' : '700'}
              fill={stop.isPast ? C.secondary : C.white}
            >
              {clip(stop.displayName, nameChars)}
            </text>
            {rowH >= 24 && (
              <text x={nameX} y={y + 11} fontFamily={F.sans} fontSize="9.5" fill={C.muted}>
                {clip(stop.locationLabel, nameChars + 4)}
              </text>
            )}
          </g>
        );
      })}

      {stops.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fontFamily={F.sans}
          fontSize="12"
          fill={C.muted}
        >
          No shows registered yet
        </text>
      )}
    </g>
  );
};

// -----------------------------------------------------------------------------
// Header / footer
// -----------------------------------------------------------------------------

const Header: React.FC<
  Pick<TourPosterProps, 'corpsName' | 'classLabel' | 'showTitle' | 'seasonName' | 'directorName'>
> = ({ corpsName, classLabel, showTitle, seasonName, directorName }) => {
  const { pad } = POSTER;
  const rightEdge = POSTER.width - pad * 2;
  return (
    <g transform={`translate(${pad} ${POSTER.header.y})`}>
      <text
        fontFamily={F.mono}
        fontSize="10"
        fontWeight="700"
        letterSpacing="3.4"
        fill={C.muted}
        y="12"
      >
        TOUR MAP
      </text>
      <text fontFamily={F.sans} fontSize="30" fontWeight="800" fill={C.white} y="46">
        {clip(corpsName, 38)}
      </text>
      {showTitle && (
        <text fontFamily={F.sans} fontSize="13.5" fill={C.secondary} y="68">
          {clip(showTitle, 72)}
        </text>
      )}

      <g transform={`translate(${rightEdge} 0)`}>
        <text
          textAnchor="end"
          fontFamily={F.mono}
          fontSize="10"
          fontWeight="700"
          letterSpacing="1.8"
          fill={C.route}
          y="12"
        >
          {classLabel.toUpperCase()}
        </text>
        <text
          textAnchor="end"
          fontFamily={F.sans}
          fontSize="16"
          fontWeight="700"
          fill={C.white}
          y="40"
        >
          {seasonName}
        </text>
        {directorName && (
          <text textAnchor="end" fontFamily={F.mono} fontSize="11" fill={C.muted} y="62">
            {clip(directorName, 30)}
          </text>
        )}
      </g>
    </g>
  );
};

const Footer: React.FC<{ stats: PosterStat[] }> = ({ stats }) => {
  const { pad } = POSTER;
  const cellW = 168;
  return (
    <g transform={`translate(${pad} ${POSTER.footer.y})`}>
      <line x1="0" y1="0" x2={POSTER.width - pad * 2} y2="0" stroke={C.line} />
      {stats.map((stat, i) => (
        <g key={stat.label} transform={`translate(${i * cellW} 0)`}>
          <text
            fontFamily={F.mono}
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.6"
            fill={C.muted}
            y="20"
          >
            {stat.label}
          </text>
          <text
            fontFamily={F.mono}
            fontSize="20"
            fontWeight="700"
            fill={stat.accent || C.white}
            y="44"
          >
            {stat.value}
          </text>
        </g>
      ))}
      <text
        x={POSTER.width - pad * 2}
        y="34"
        textAnchor="end"
        fontFamily={F.sans}
        fontSize="15"
        fontWeight="800"
        fill={C.brand}
      >
        marching.art
      </text>
    </g>
  );
};

// -----------------------------------------------------------------------------
// Poster
// -----------------------------------------------------------------------------

const TourPoster = React.forwardRef<SVGSVGElement, TourPosterProps>(
  (
    {
      corpsName,
      classLabel,
      showTitle,
      seasonName,
      directorName,
      stops,
      stats,
      activeIndex,
      title,
    },
    ref
  ) => {
    const plotted = useMemo(() => stops.filter((s): s is PlottedStop => s.point !== null), [stops]);
    const clusters = useMemo(() => clusterStops(plotted), [plotted]);
    const visitedRegions = useMemo(() => new Set(clusters.map((c) => c.point.region)), [clusters]);
    const labels = useMemo(() => {
      // Below the label threshold the map is a shape, not a gazetteer — the
      // itinerary column carries the names.
      if (clusters.length > MAX_MAP_LABELS) return [];
      // Inter at 10.5px semibold averages ~0.55em per character; the placer
      // only needs the box to be about right.
      const widths = clusters.map((c) => c.point.city.length * 5.8);
      return placeLabels(
        clusters.map((c) => c.point),
        widths
      );
    }, [clusters]);
    const unmapped = stops.length - plotted.length;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${POSTER.width} ${POSTER.height}`}
        width="100%"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <defs>
          <clipPath id="tour-map-clip">
            <rect width={MAP_VIEW.width} height={MAP_VIEW.height} />
          </clipPath>
          {/* Backstop for the itinerary: an unusually wide event name is
              elided by character budget first, and cut at the panel edge here
              if that estimate ever comes up short. */}
          <clipPath id="tour-list-clip">
            <rect width={POSTER.list.width} height={POSTER.list.height} />
          </clipPath>
        </defs>

        <rect width={POSTER.width} height={POSTER.height} fill={C.background} />

        <Header
          corpsName={corpsName}
          classLabel={classLabel}
          showTitle={showTitle}
          seasonName={seasonName}
          directorName={directorName}
        />

        {/* Map block — 1:1 with the tourMapGeo canvas */}
        <g transform={`translate(${POSTER.map.x} ${POSTER.map.y})`}>
          <rect
            width={MAP_VIEW.width}
            height={MAP_VIEW.height}
            fill={C.background}
            stroke={C.line}
          />
          <g clipPath="url(#tour-map-clip)">
            <GridDots />
            <MapBase visitedRegions={visitedRegions} />
            <Route plotted={plotted} />
            <Markers clusters={clusters} labels={labels} activeIndex={activeIndex} />
          </g>
          <Legend />
          {unmapped > 0 && (
            <text
              x={MAP_VIEW.width - 14}
              y={MAP_VIEW.height - 16}
              textAnchor="end"
              fontFamily={F.sans}
              fontSize="10"
              fill={C.muted}
            >
              {unmapped} stop{unmapped === 1 ? '' : 's'} not mapped
            </text>
          )}
        </g>

        <g transform={`translate(${POSTER.list.x} ${POSTER.list.y})`}>
          <Itinerary stops={stops} activeIndex={activeIndex} />
        </g>

        <Footer stats={stats} />
      </svg>
    );
  }
);

TourPoster.displayName = 'TourPoster';

export default TourPoster;
