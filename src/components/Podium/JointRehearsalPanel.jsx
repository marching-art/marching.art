// JointRehearsalPanel — the human handshake (design §5.12, redesigned).
// Pick a rival and the system maps both tours and ranks the real overlap
// windows (open days for both corps) with their host city/stadium, distance,
// and the proposer's travel burden. The invitee decides with that burden in
// full view. Once booked it lives in the route; once scored it pays off as a
// Tale of the Tape with a season head-to-head record. The assistant director
// never accepts for you.

import React, { useCallback, useEffect, useState } from 'react';
import { Handshake, Loader2, MapPin, Search, X, Trophy, Copy, Check } from 'lucide-react';
import {
  getJointRehearsals,
  getJointOverlaps,
  proposeJointRehearsal,
  respondJointRehearsal,
} from '../../api/podium';
import { PODIUM_CAPTIONS, CAPTION_LABELS } from './podiumConstants';

// Travel-tier keys → human labels (mirror balanceConfig.travel.tiers).
const TIER_LABELS = {
  local: 'Local',
  dayTrip: 'Day Trip',
  overnightHaul: 'Overnight Haul',
  longHaul: 'Long Haul',
  crossCountry: 'Cross-Country',
};

const cityLine = (city, stadium) => (stadium ? `${city} · ${stadium}` : city || 'TBA');

// One ranked overlap window — day, host city/stadium, distance, fit, cost.
function WindowCard({ win, selected, onSelect }) {
  const fitColor = win.isFree ? 'text-green-400' : 'text-amber-400';
  return (
    <button
      type="button"
      onClick={() => onSelect(win.day)}
      className={`w-full text-left grid grid-cols-[46px_1fr_auto] gap-3 items-center px-3 py-2.5 rounded-none border transition-colors press-feedback ${
        selected
          ? 'border-interactive bg-interactive/10'
          : 'border-line bg-surface-sunken hover:border-line-strong'
      }`}
    >
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums leading-none">{win.day}</div>
        <div className="text-[8px] font-mono uppercase text-muted tracking-wider">
          Wk {win.week}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-white truncate">{win.city || 'TBA'}</div>
        {win.stadium && (
          <div className="text-[10px] font-mono text-[#c9a227] truncate">{win.stadium}</div>
        )}
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[9px] font-mono text-muted">
          {win.milesApart != null && <span>{win.milesApart} mi apart</span>}
          <span className={fitColor}>
            {win.isFree
              ? 'fits route — free'
              : `detour · ${TIER_LABELS[win.travelTier] || win.travelTier}`}
          </span>
        </div>
      </div>
      <div className="text-right space-y-1">
        <div
          className={`text-[11px] font-mono font-bold tabular-nums ${win.isFree ? 'text-green-400' : 'text-amber-400'}`}
        >
          {win.isFree ? 'Free' : `−${win.coinCost} CC · −${win.staminaCost}`}
        </div>
        <div className="text-[8px] font-mono uppercase tracking-wider text-[#c9a227] border border-[#8c7220] rounded-none px-1.5 py-0.5 inline-block">
          Ens +{win.ensembleBonusPct}%
        </div>
      </div>
    </button>
  );
}

// The invitee's informed-accept card: their burden (none — proposer covers the
// gap) vs. their gain (bonus + the private scrimmage).
function IncomingCard({ proposal, busy, blocked, onAccept, onDecline }) {
  const tier = proposal.proposerTravelTier;
  return (
    <div className="border border-line rounded-none overflow-hidden">
      <div className="px-3 py-2 bg-surface-raised flex items-center justify-between">
        <span className="text-[11px] text-secondary min-w-0 truncate">
          <span className="font-bold text-white">{proposal.fromCorpsName}</span> wants a joint
          rehearsal
        </span>
        <span className="text-[9px] font-mono text-muted uppercase shrink-0">
          Day {proposal.day}
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        <div className="text-[11px] text-secondary flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-[#c9a227] shrink-0" />
          <span className="truncate">{cityLine(proposal.city, proposal.stadium)}</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line border border-line">
          <div className="bg-surface-sunken px-2.5 py-2">
            <div className="text-[8px] font-mono uppercase tracking-wider text-muted mb-1">
              Your burden
            </div>
            <div className="text-[13px] font-bold text-green-400">No travel</div>
            <div className="text-[9px] text-muted mt-0.5">
              {tier
                ? `${proposal.fromCorpsName} covers the ${TIER_LABELS[tier] || tier} leg.`
                : 'You are already together on tour.'}
            </div>
          </div>
          <div className="bg-surface-sunken px-2.5 py-2">
            <div className="text-[8px] font-mono uppercase tracking-wider text-muted mb-1">
              Your gain
            </div>
            <div className="text-[13px] font-bold text-[#c9a227]">Ensemble +25%</div>
            <div className="text-[9px] text-muted mt-0.5">+ morale &amp; the scrimmage report.</div>
          </div>
        </div>
        {blocked && (
          <p className="text-[9px] font-mono text-amber-400/80">
            Week {Math.ceil(proposal.day / 7)} already has a joint — that week is full.
          </p>
        )}
        <div className="flex items-center justify-end gap-1.5">
          <button
            disabled={busy}
            onClick={onDecline}
            className="px-2.5 py-1 text-[10px] font-bold uppercase bg-line text-secondary rounded-none press-feedback disabled:opacity-50"
          >
            Decline
          </button>
          <button
            disabled={busy || blocked}
            onClick={onAccept}
            className="px-3 py-1 text-[10px] font-bold uppercase bg-green-600 text-white rounded-none press-feedback disabled:opacity-50 disabled:bg-line disabled:text-muted"
          >
            Accept — book Day {proposal.day}
          </button>
        </div>
      </div>
    </div>
  );
}

// The Tale of the Tape — the scored head-to-head, winner-highlighted, with a
// Discord-friendly copy. Private; never published.
function TaleOfTheTape({ scrimmage }) {
  const [copied, setCopied] = useState(false);
  if (!scrimmage) return null;

  const diff = (mine, theirs) => (mine || 0) - (theirs || 0);
  const totalDiff = diff(scrimmage.mine?.total, scrimmage.theirs?.total);

  const copyText = async () => {
    const rows = PODIUM_CAPTIONS.map((c) => {
      const m = scrimmage.mine?.captions?.[c];
      const t = scrimmage.theirs?.captions?.[c];
      return `${c.padEnd(4)} ${(m ?? 0).toFixed(2).padStart(6)}  ${(t ?? 0).toFixed(2).padStart(6)}`;
    }).join('\n');
    const text =
      `Tale of the Tape — Day ${scrimmage.day}${scrimmage.city ? ` · ${scrimmage.city}` : ''}\n` +
      `You vs ${scrimmage.partnerCorpsName || 'Them'}\n${rows}\n` +
      `TOT  ${(scrimmage.mine?.total ?? 0).toFixed(3).padStart(6)}  ${(scrimmage.theirs?.total ?? 0).toFixed(3).padStart(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="border border-line rounded-none overflow-hidden">
      <div className="px-3 py-2 text-center border-b border-line bg-gradient-to-b from-[#c9a227]/10 to-transparent">
        <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-[#c9a227]">
          Tale of the Tape
        </div>
        <div className="text-[9px] font-mono text-muted mt-1">
          Day {scrimmage.day}
          {scrimmage.city ? ` · ${cityLine(scrimmage.city, scrimmage.stadium)}` : ''} · private
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
          <span className="text-muted uppercase text-[9px]">Caption</span>
          <span className="text-muted uppercase text-[9px] text-right">You</span>
          <span className="text-muted uppercase text-[9px] text-right">
            {scrimmage.partnerCorpsName || 'Them'}
          </span>
          <span className="text-muted uppercase text-[9px] text-right">±</span>
          {PODIUM_CAPTIONS.map((caption) => {
            const mine = scrimmage.mine?.captions?.[caption];
            const theirs = scrimmage.theirs?.captions?.[caption];
            const d = diff(mine, theirs);
            const win = d > 0;
            return (
              <React.Fragment key={caption}>
                <span className="text-muted" title={CAPTION_LABELS[caption]}>
                  {caption}
                </span>
                <span className={`text-right ${win ? 'text-green-400 font-bold' : 'text-white'}`}>
                  {mine?.toFixed(2) ?? '—'}
                </span>
                <span className="text-secondary text-right">{theirs?.toFixed(2) ?? '—'}</span>
                <span
                  className={`text-right ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-muted'}`}
                >
                  {d > 0 ? '+' : ''}
                  {d.toFixed(2)}
                </span>
              </React.Fragment>
            );
          })}
          <span className="text-white font-bold border-t border-line pt-1">Total</span>
          <span className="text-white font-bold text-right border-t border-line pt-1">
            {scrimmage.mine?.total?.toFixed(3) ?? '—'}
          </span>
          <span className="text-secondary font-bold text-right border-t border-line pt-1">
            {scrimmage.theirs?.total?.toFixed(3) ?? '—'}
          </span>
          <span
            className={`font-bold text-right border-t border-line pt-1 ${
              totalDiff > 0 ? 'text-green-400' : totalDiff < 0 ? 'text-red-400' : 'text-muted'
            }`}
          >
            {totalDiff > 0 ? '+' : ''}
            {totalDiff.toFixed(3)}
          </span>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-line bg-surface-sunken flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted">
          {totalDiff > 0 ? 'You took it' : totalDiff < 0 ? 'They took it' : 'Dead heat'}
        </span>
        <button
          onClick={copyText}
          className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider border border-line text-secondary rounded-none press-feedback"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy for Discord'}
        </button>
      </div>
    </div>
  );
}

// Season head-to-head record — the profile-facing "who's been rehearsing with
// whom" log, rendered compactly in-panel.
function HeadToHead({ headToHead }) {
  const rows = Object.entries(headToHead || {});
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted">
        Head-to-head · this season
      </div>
      <div className="border border-line rounded-none divide-y divide-line-subtle">
        {rows.map(([uid, rec]) => {
          const lead = rec.wins - rec.losses;
          const cls = lead > 0 ? 'text-green-400' : lead < 0 ? 'text-red-400' : 'text-muted';
          return (
            <div key={uid} className="flex items-center justify-between px-2.5 py-1.5">
              <span className="text-[11px] text-secondary truncate flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-muted shrink-0" />
                {rec.partnerCorpsName || 'Unknown corps'}
              </span>
              <span className="flex items-center gap-2.5 shrink-0">
                <span className="text-[9px] font-mono text-muted">
                  {rec.joints} joint{rec.joints === 1 ? '' : 's'}
                </span>
                <span className={`text-[11px] font-mono font-bold tabular-nums ${cls}`}>
                  {rec.wins}–{rec.losses}
                  {rec.ties ? `–${rec.ties}` : ''}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JointRehearsalPanel() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [toUid, setToUid] = useState('');
  // Overlap search result + the day the director selected from it.
  const [overlaps, setOverlaps] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const reload = useCallback(async () => {
    try {
      const result = await getJointRehearsals();
      setData(result.data);
    } catch (err) {
      setError(err?.message || 'Could not load joint rehearsals.');
    }
  }, []);

  useEffect(() => {
    if (data === null) reload();
  }, [data, reload]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      await reload();
      return true;
    } catch (err) {
      setError(err?.message || 'Request failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const findOverlaps = async () => {
    if (!toUid) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setSelectedDay(null);
    try {
      const result = await getJointOverlaps({ toUid });
      setOverlaps(result.data);
    } catch (err) {
      setError(err?.message || 'Could not map the tours.');
    } finally {
      setBusy(false);
    }
  };

  const cancelOverlaps = () => {
    setOverlaps(null);
    setSelectedDay(null);
    setToUid('');
    setError(null);
  };

  const propose = async () => {
    if (!toUid || !selectedDay) return;
    const ok = await act(
      () => proposeJointRehearsal({ toUid, day: selectedDay }),
      'Proposal sent — they have until that morning to accept.'
    );
    if (ok) cancelOverlaps();
  };

  const upcoming = data?.upcoming || [];
  const incoming = data?.incoming || [];
  // Weeks already spent (a joint booked or scrimmaged) — those weeks are
  // unavailable; every other week of the season stays open.
  const weekOf = (d) => (d < 1 ? 0 : Math.ceil(d / 7));
  const usedWeeks = new Set([
    ...upcoming.map((j) => weekOf(j.day)),
    ...(data?.history || []).map((h) => h.week ?? weekOf(h.day)),
  ]);

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Handshake className="w-3 h-3" /> Joint Rehearsals
          {incoming.length > 0 && (
            <span className="px-1.5 py-0.5 bg-[#c9a227] text-black rounded-none text-[9px]">
              {incoming.length}
            </span>
          )}
        </span>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Pick a rival and the system maps both tours, then ranks the open days you could share — each
        with its host city, distance, and stamina cost. Full Ensemble sharpens (+25%, decaying for
        repeat partners), morale lifts, and both directors get a private scrimmage report. One per
        week; the proposer covers any travel.
      </p>

      {!data && !error && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted" />
        </div>
      )}

      {/* Upcoming accepted joints — one per booked week */}
      {upcoming.map((joint) => (
        <div
          key={joint.day}
          className="px-3 py-2 bg-[#c9a227]/10 border border-[#c9a227]/30 text-[10px] text-[#c9a227] flex items-start gap-2"
        >
          <Handshake className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Day {joint.day} (Wk {weekOf(joint.day)}): joint rehearsal with{' '}
            <span className="font-bold">{joint.partnerCorpsName}</span>
            {joint.city && (
              <span className="text-[#c9a227]/70">
                {' '}
                <MapPin className="w-2.5 h-2.5 inline" /> {cityLine(joint.city, joint.stadium)}
              </span>
            )}
            {joint.travelTier && (
              <span className="text-amber-400">
                {' '}
                · you cover the {TIER_LABELS[joint.travelTier] || joint.travelTier} leg
              </span>
            )}
          </span>
        </div>
      ))}

      {/* Incoming proposals — informed accept */}
      {incoming.map((proposal) => (
        <IncomingCard
          key={proposal.id}
          proposal={proposal}
          busy={busy}
          blocked={usedWeeks.has(weekOf(proposal.day))}
          onAccept={() =>
            act(
              () => respondJointRehearsal({ proposalId: proposal.id, accept: true }),
              'Joint rehearsal booked — it is on your route now.'
            )
          }
          onDecline={() =>
            act(() => respondJointRehearsal({ proposalId: proposal.id, accept: false }))
          }
        />
      ))}

      {/* Outgoing pending */}
      {(data?.outgoing || []).map((proposal) => (
        <div key={proposal.id} className="px-3 py-1.5 text-[10px] text-muted">
          Awaiting <span className="text-secondary">{proposal.toCorpsName}</span> for Day{' '}
          {proposal.day}
          {proposal.city ? ` · ${proposal.city}` : ''} — expires unanswered that morning.
        </div>
      ))}

      {/* Propose flow — partner select → find overlaps → ranked windows.
              Available even with joints booked; only booked weeks are excluded. */}
      {data && (
        <div className="space-y-3 border border-line rounded-none p-3 bg-surface-sunken">
          {!overlaps ? (
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted">
                Scout a corps
              </label>
              <div className="flex gap-2">
                <select
                  value={toUid}
                  onChange={(e) => setToUid(e.target.value)}
                  className="flex-1 bg-surface-sunken border border-line rounded-none px-2 py-1.5 text-xs text-white focus:border-interactive focus:outline-none"
                >
                  <option value="">Choose a corps…</option>
                  {(data.roster || []).map((corps) => (
                    <option key={corps.uid} value={corps.uid}>
                      {corps.corpsName || corps.uid}
                      {corps.city ? ` · ${corps.city}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !toUid}
                  onClick={findOverlaps}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider bg-[#c9a227] text-black disabled:bg-line disabled:text-muted press-feedback"
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                  Find overlaps
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white">
                  Overlaps with {overlaps.partnerCorpsName || 'corps'}
                </span>
                <button
                  type="button"
                  onClick={cancelOverlaps}
                  className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted hover:text-secondary press-feedback"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>

              {overlaps.windows.length === 0 ? (
                <p className="text-[10px] text-muted py-2">
                  No shared open week in the next two weeks — your tours never sit idle on the same
                  day, or the overlapping weeks are already booked. Try another partner.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {overlaps.windows.map((win) => (
                      <WindowCard
                        key={win.day}
                        win={win}
                        selected={selectedDay === win.day}
                        onSelect={setSelectedDay}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] font-mono text-muted">
                    Stadium shown when on file — otherwise the city stands alone.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-0.5 border-t border-line-muted">
                    <button
                      type="button"
                      onClick={cancelOverlaps}
                      className="px-2.5 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider border border-line text-muted press-feedback"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy || !selectedDay}
                      onClick={propose}
                      className="px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider bg-interactive text-white disabled:bg-line disabled:text-muted press-feedback"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : selectedDay ? (
                        `Propose Day ${selectedDay}`
                      ) : (
                        'Pick a day'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Latest Tale of the Tape */}
      <TaleOfTheTape scrimmage={data?.scrimmage} />

      {/* Season head-to-head record */}
      <HeadToHead headToHead={data?.headToHead} />

      {error && <div className="text-[11px] text-red-400">{error}</div>}
      {notice && <div className="text-[11px] text-green-400">{notice}</div>}
    </div>
  );
}
