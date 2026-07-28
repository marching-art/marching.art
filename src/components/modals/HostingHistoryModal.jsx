// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// HOSTING HISTORY MODAL - a director's cross-season hosting resume
// =============================================================================
// Backed by the getHostingHistory callable (podiumHost.js): every show this
// director has hosted across every season, each show's attendee roster, and
// the CorpsCoin it cost and returned. Design PODIUM.md §5.10 / decision 27.
//
// Before this, hosting history was effectively invisible: the Schedule page's
// hosting card listed the CURRENT season's events from ALL hosts, and payouts
// were only legible as untyped lines in the CorpsCoin wallet.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Landmark, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getHostingHistory } from '../../api/podium';
import { formatSeasonName } from '../../utils/season';
import { VENUE_TIERS } from '../Podium/podiumConstants';

const TIER_LABELS = Object.fromEntries(VENUE_TIERS.map((t) => [t.id, t.label]));

const CLASS_LABELS = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
  podiumClass: 'Podium',
};

const cc = (n) => `${(n || 0).toLocaleString()} CC`;

/** One show, expandable to its attendee roster. */
function HostedEventRow({ event }) {
  const [open, setOpen] = useState(false);
  const attendees = event.attendees || [];
  const net = (event.payout || 0) - (event.rentalCC || 0);
  // Capacity capped the payout: the roster drew more corps than the venue pays
  // for. Worth calling out — it's the signal to book a bigger venue.
  const cappedBy = event.paidOut && event.directorCount > (event.attendance || 0)
    ? event.directorCount - event.attendance
    : 0;

  return (
    <div className="bg-background border border-line-muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={attendees.length === 0}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-3 text-left disabled:cursor-default hover:bg-white/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{event.eventName}</div>
          <div className="text-[10px] text-muted truncate">
            {TIER_LABELS[event.venueTier] || event.venueTier} · {event.location} · Day {event.day}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {event.paidOut ? (
            <>
              <div
                className={`text-sm font-data tabular-nums ${net >= 0 ? 'text-green-500' : 'text-red-400'}`}
              >
                {net >= 0 ? '+' : '−'}
                {cc(Math.abs(net))}
              </div>
              <div className="text-[10px] text-muted font-data tabular-nums">
                {event.corpsCount != null ? event.corpsCount : event.attendance} corps
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-secondary font-data tabular-nums">−{cc(event.rentalCC)}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">Upcoming</div>
            </>
          )}
        </div>
        {attendees.length > 0 && (
          <ChevronDown
            className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && attendees.length > 0 && (
        <div className="border-t border-line-muted p-3 space-y-2">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-muted">
            <Users className="w-3 h-3" />
            Who came
          </div>
          {/* The two sides of a settled show, spelled out: rental paid up
              front, payout earned on attendance. */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-surface-card border border-line-muted p-2">
              <div className="text-muted uppercase tracking-wider text-[9px]">Rental</div>
              <div className="text-red-400 font-data tabular-nums">−{cc(event.rentalCC)}</div>
            </div>
            <div className="bg-surface-card border border-line-muted p-2">
              <div className="text-muted uppercase tracking-wider text-[9px]">
                Payout · {event.attendance} paid
              </div>
              <div className="text-green-500 font-data tabular-nums">+{cc(event.payout)}</div>
            </div>
          </div>
          {cappedBy > 0 && (
            <div className="text-[10px] text-brand">
              {cappedBy} more director{cappedBy === 1 ? '' : 's'} drew than this venue pays for —
              a bigger venue would have earned more.
            </div>
          )}
          <div className="space-y-1">
            {attendees.map((a, i) => (
              <div
                key={`${a.uid}_${a.corpsClass}`}
                className="flex items-center gap-2 text-[11px] py-1 border-b border-line-muted last:border-0"
              >
                <span className="text-muted font-data tabular-nums w-5 flex-shrink-0">{i + 1}</span>
                <span className="text-secondary truncate flex-1">{a.corpsName}</span>
                <span className="text-muted text-[10px] flex-shrink-0">
                  {CLASS_LABELS[a.corpsClass] || a.corpsClass}
                </span>
                {a.totalScore != null && (
                  <span className="text-white font-data tabular-nums flex-shrink-0 w-14 text-right">
                    {a.totalScore.toFixed(3)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const HostingHistoryModal = ({ onClose }) => {
  useEscapeKey(onClose);
  const dialogRef = useRef(null);
  // Trap keyboard focus inside the dialog (WCAG 2.4.3); restores on close
  useFocusTrap(dialogRef);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHostingHistory()
      .then((result) => {
        if (!cancelled) setData(result.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Shows group under the season they ran in; the callable already returns
  // them newest-first, so insertion order is the render order.
  const seasons = useMemo(() => {
    const grouped = new Map();
    for (const event of data?.events || []) {
      const key = event.seasonUid || 'unknown';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    }
    return [...grouped.entries()];
  }, [data]);

  const totals = data?.totals;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-hosting"
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg max-h-[80dvh] bg-surface-card border border-line rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex items-center gap-3">
              <Landmark className="w-5 h-5 text-brand" />
              <div>
                <h2
                  id="modal-title-hosting"
                  className="text-xs font-bold uppercase tracking-wider text-secondary"
                >
                  Hosting History
                </h2>
                {totals && (
                  <p className="text-sm font-bold text-brand font-data tabular-nums">
                    {totals.eventsHosted} show{totals.eventsHosted === 1 ? '' : 's'} hosted
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted">Loading hosting history...</div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-muted">
                Could not load your hosting history. Try again in a moment.
              </div>
            ) : totals?.eventsHosted === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Landmark className="w-8 h-8 text-muted mx-auto" />
                <div className="text-sm text-secondary">You haven&apos;t hosted a show yet.</div>
                <div className="text-xs text-muted max-w-xs mx-auto">
                  Rent a venue from the Schedule page to put your name on the season. A well-drawn
                  show turns a profit.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Lifetime P&L — the number the wallet could never show. */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-background border border-line-muted p-3 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-muted">Earned</div>
                    <div className="text-sm font-bold text-green-500 font-data tabular-nums">
                      {cc(totals.earned)}
                    </div>
                  </div>
                  <div className="bg-background border border-line-muted p-3 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-muted">Rentals</div>
                    <div className="text-sm font-bold text-red-400 font-data tabular-nums">
                      {cc(totals.rentalSpent)}
                    </div>
                  </div>
                  <div className="bg-background border border-line-muted p-3 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-muted">Net</div>
                    <div
                      className={`text-sm font-bold font-data tabular-nums flex items-center justify-center gap-1 ${
                        totals.net >= 0 ? 'text-green-500' : 'text-red-400'
                      }`}
                    >
                      {totals.net >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {totals.net >= 0 ? '+' : '−'}
                      {cc(Math.abs(totals.net))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted px-1">
                  <span>
                    <span className="text-secondary font-data tabular-nums">
                      {totals.corpsDrawn}
                    </span>{' '}
                    corps drawn all-time
                  </span>
                  <span>
                    Best draw:{' '}
                    <span className="text-secondary font-data tabular-nums">
                      {totals.bestDraw}
                    </span>{' '}
                    · {totals.successful} successful
                  </span>
                </div>

                {seasons.map(([seasonUid, events]) => (
                  <div key={seasonUid} className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
                      {formatSeasonName(seasonUid)}
                    </div>
                    {events.map((event) => (
                      <HostedEventRow key={event.id} event={event} />
                    ))}
                  </div>
                ))}

                {totals.eventsSettled < totals.eventsHosted && (
                  <div className="text-[10px] text-muted text-center">
                    Upcoming shows settle the night they run — attendance and payout appear then.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default HostingHistoryModal;
