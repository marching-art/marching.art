// @ts-nocheck -- presentational wrapper; see RunningOrder for the typed contract
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import RunningOrder from './RunningOrder';

/**
 * DualRunningOrder
 *
 * One event, two running orders (docs/EVENT_SCHEDULES_AND_SLOTS.md): the fantasy
 * field and the podium field share a venue/date but each has its own order and
 * score-drop time. Renders a Fantasy/Podium toggle when both fields exist, and
 * falls back to whichever single field is present. The director's own corps is
 * highlighted (by uid) in either view.
 *
 * @param {Object} props
 * @param {Object} props.show - transformed show ({ lineup, overflow, ...,
 *   podiumSchedule }). `lineup`/`overflow`/times reflect the fantasy schedule.
 * @param {string} [props.myUid]
 * @param {Map} [props.highlights] - caption-pick highlights (fantasy view only).
 * @param {boolean} [props.compact]
 */
const DualRunningOrder = ({ show, myUid, highlights, compact = false }) => {
  const podium = show?.podiumSchedule;
  const fantasyHasField = Array.isArray(show?.lineup) && show.lineup.length > 0;
  const podiumHasField = Array.isArray(podium?.lineup) && podium.lineup.length > 0;

  const [view, setView] = useState(fantasyHasField ? 'fantasy' : 'podium');
  const active =
    view === 'podium' && podiumHasField ? 'podium' : fantasyHasField ? 'fantasy' : view;

  if (!fantasyHasField && !podiumHasField) return null;

  // In podium view, project the podium schedule onto the fields RunningOrder reads.
  const shown =
    active === 'podium'
      ? {
          ...show,
          lineup: podium.lineup,
          overflow: podium.overflow,
          startsAt: podium.startsAt,
          scoresAt: podium.scoresAt,
          gatesAt: podium.gatesAt,
          timezone: podium.timezone,
          encore: show.podiumEncore || null, // the podium field's own encore
        }
      : show;

  const showToggle = fantasyHasField && podiumHasField;

  return (
    <div>
      {showToggle && (
        <div
          className="flex items-stretch mb-2 border border-line"
          role="tablist"
          aria-label="Running order"
        >
          {[
            { id: 'fantasy', label: 'Fantasy', count: show.lineup.length },
            { id: 'podium', label: 'Podium', count: podium.lineup.length },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setView(t.id)}
              className={`flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                active === t.id
                  ? 'bg-interactive/15 text-interactive'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              {t.label}
              <span className="inline-flex items-center gap-0.5 font-data normal-case">
                <Users className="w-3 h-3" />
                {t.count}
              </span>
            </button>
          ))}
        </div>
      )}
      <RunningOrder
        show={shown}
        myUid={myUid}
        highlights={active === 'fantasy' ? highlights : undefined}
        compact={compact}
      />
    </div>
  );
};

export default DualRunningOrder;
