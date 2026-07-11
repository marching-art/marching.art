// JointRehearsalPanel — the human handshake (Phase 7.1, design §5.12).
// Propose a shared rehearsal day to another Podium corps; accepting freezes
// the Full Ensemble bonus (repeat pairings decay) and books the scrimmage
// report: a PRIVATE caption-by-caption head-to-head — the only scouting
// outside a shared floor. The assistant director never accepts for you.

import React, { useCallback, useEffect, useState } from 'react';
import { Handshake, Loader2, ChevronDown, ChevronUp, MapPin, Flag } from 'lucide-react';
import { getJointRehearsals, proposeJointRehearsal, respondJointRehearsal } from '../../api/podium';
import { PODIUM_CAPTIONS, CAPTION_LABELS } from './podiumConstants';

// A season runs 49 days — seven weeks of seven. Championship Week is Days
// 45–49; the "one joint per week" rule maps cleanly onto these rows.
const SEASON_DAYS = 49;
const DAYS_PER_WEEK = 7;
const CHAMPIONSHIP_START = 45;

// Visual day picker — replaces guessing a day number. Selectable days are
// tomorrow (competitionDay + 1) through the finals; past days dim out, show
// days carry a gold marker, and each row is a tour week so the weekly cap
// reads at a glance.
function DayCalendar({ competitionDay, showDays, value, onChange }) {
  const weeks = [];
  for (let w = 0; w < SEASON_DAYS / DAYS_PER_WEEK; w += 1) {
    weeks.push(Array.from({ length: DAYS_PER_WEEK }, (_, i) => w * DAYS_PER_WEEK + i + 1));
  }
  return (
    <div className="space-y-1">
      {weeks.map((days, i) => {
        const isChampWeek = days[days.length - 1] >= CHAMPIONSHIP_START;
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`w-7 shrink-0 text-[8px] font-bold uppercase tracking-wider text-right ${
                isChampWeek ? 'text-[#c9a227]' : 'text-gray-600'
              }`}
            >
              {isChampWeek ? 'Wk7' : `Wk${i + 1}`}
            </span>
            <div className="grid grid-cols-7 gap-1 flex-1">
              {days.map((day) => {
                const past = day <= competitionDay;
                const isToday = day === competitionDay;
                const show = showDays.get(day);
                const selected = value === day;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => onChange(day)}
                    title={show || (isToday ? 'Today' : undefined)}
                    className={`relative flex items-center justify-center h-7 rounded-sm border text-[10px] tabular-nums transition-colors press-feedback ${
                      selected
                        ? 'border-[#0057B8] bg-[#0057B8] text-white font-bold'
                        : past
                          ? 'border-transparent text-gray-700 cursor-not-allowed'
                          : isToday
                            ? 'border-gray-500 text-gray-400'
                            : show
                              ? 'border-[#c9a227]/40 text-[#c9a227] hover:border-[#c9a227] hover:text-white'
                              : 'border-[#333] text-gray-300 hover:border-[#0057B8] hover:text-white'
                    }`}
                  >
                    {day}
                    {show && !selected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c9a227]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 pl-9 pt-0.5 text-[8px] uppercase tracking-wider text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227]" /> Show day
        </span>
        <span className="flex items-center gap-1">
          <Flag className="w-2.5 h-2.5 text-[#c9a227]" /> Championship
        </span>
      </div>
    </div>
  );
}

const ScrimmageSheet = ({ scrimmage }) => {
  if (!scrimmage) return null;
  const diff = (mine, theirs) => {
    const d = (mine || 0) - (theirs || 0);
    return { d, cls: d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-gray-500' };
  };
  const total = diff(scrimmage.mine?.total, scrimmage.theirs?.total);
  return (
    <div className="border border-[#333] rounded-sm overflow-hidden">
      <div className="bg-[#222] px-3 py-2 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#c9a227]">
          Scrimmage Report · Day {scrimmage.day}
        </span>
        <span className="text-[9px] text-gray-600 uppercase">Private — never published</span>
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
          <span className="text-gray-600 uppercase text-[9px]">Caption</span>
          <span className="text-gray-600 uppercase text-[9px] text-right">You</span>
          <span className="text-gray-600 uppercase text-[9px] text-right">
            {scrimmage.partnerCorpsName || 'Them'}
          </span>
          <span className="text-gray-600 uppercase text-[9px] text-right">±</span>
          {PODIUM_CAPTIONS.map((caption) => {
            const mine = scrimmage.mine?.captions?.[caption];
            const theirs = scrimmage.theirs?.captions?.[caption];
            const { d, cls } = diff(mine, theirs);
            return (
              <React.Fragment key={caption}>
                <span className="text-gray-400" title={CAPTION_LABELS[caption]}>
                  {caption}
                </span>
                <span className="text-white text-right">{mine?.toFixed(2) ?? '—'}</span>
                <span className="text-gray-300 text-right">{theirs?.toFixed(2) ?? '—'}</span>
                <span className={`${cls} text-right`}>
                  {d > 0 ? '+' : ''}
                  {d.toFixed(2)}
                </span>
              </React.Fragment>
            );
          })}
          <span className="text-white font-bold border-t border-[#333] pt-1">Total</span>
          <span className="text-white font-bold text-right border-t border-[#333] pt-1">
            {scrimmage.mine?.total?.toFixed(3) ?? '—'}
          </span>
          <span className="text-gray-300 font-bold text-right border-t border-[#333] pt-1">
            {scrimmage.theirs?.total?.toFixed(3) ?? '—'}
          </span>
          <span className={`${total.cls} font-bold text-right border-t border-[#333] pt-1`}>
            {total.d > 0 ? '+' : ''}
            {total.d.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function JointRehearsalPanel({ podium }) {
  const competitionDay = podium.data?.competitionDay ?? 0;
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [toUid, setToUid] = useState('');
  const [day, setDay] = useState('');

  const reload = useCallback(async () => {
    try {
      const result = await getJointRehearsals();
      setData(result.data);
    } catch (err) {
      setError(err?.message || 'Could not load joint rehearsals.');
    }
  }, []);

  useEffect(() => {
    if (open && data === null) reload();
  }, [open, data, reload]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      await reload();
    } catch (err) {
      setError(err?.message || 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const propose = (e) => {
    e.preventDefault();
    act(
      () => proposeJointRehearsal({ toUid, day: Number(day) }),
      'Proposal sent — they have until that morning to accept.'
    ).then(() => {
      setToUid('');
      setDay('');
    });
  };

  const upcoming = data?.upcoming;
  const scrimmage = data?.scrimmage;
  const incomingCount = data?.incoming?.length || 0;

  // Mark scheduled shows on the calendar from the tour route.
  const showDays = new Map();
  (podium.data?.routePreview || []).forEach((leg) => {
    if (leg?.day && leg.label) {
      showDays.set(leg.day, leg.city ? `${leg.label} · ${leg.city}` : leg.label);
    }
  });

  const selectedShow = day ? showDays.get(Number(day)) : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between press-feedback"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <Handshake className="w-3 h-3" /> Joint Rehearsals
          {incomingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[#c9a227] text-black rounded-sm text-[9px]">
              {incomingCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Share a rehearsal day with another corps: Full Ensemble sharpens (+25%, decaying for
            repeat partners), morale lifts, and both directors get a private caption-by-caption
            scrimmage report — the only scouting outside a shared floor. One per week; within a day
            trip of each other on tour, or the proposer pays the travel.
          </p>

          {!data && !error && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          )}

          {/* Upcoming accepted joint */}
          {upcoming && (
            <div className="px-3 py-2 bg-[#c9a227]/10 border border-[#c9a227]/30 text-[10px] text-[#c9a227] flex items-center gap-2">
              <Handshake className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Day {upcoming.day}: joint rehearsal with{' '}
                <span className="font-bold">{upcoming.partnerCorpsName}</span>
                {upcoming.city && (
                  <span className="text-[#c9a227]/70">
                    {' '}
                    <MapPin className="w-2.5 h-2.5 inline" /> {upcoming.city}
                  </span>
                )}
                {upcoming.travelTier && (
                  <span className="text-amber-400"> · you cover the {upcoming.travelTier} leg</span>
                )}
              </span>
            </div>
          )}

          {/* Incoming proposals */}
          {(data?.incoming || []).map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-center justify-between gap-2 px-3 py-2 border border-[#333] rounded-sm"
            >
              <span className="text-[11px] text-gray-300 min-w-0 truncate">
                <span className="font-bold text-white">{proposal.fromCorpsName}</span> proposes Day{' '}
                {proposal.day}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => respondJointRehearsal({ proposalId: proposal.id, accept: true }),
                      'Joint rehearsal booked.'
                    )
                  }
                  className="px-2 py-1 text-[10px] font-bold uppercase bg-green-600 text-white rounded-sm press-feedback disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() => respondJointRehearsal({ proposalId: proposal.id, accept: false }))
                  }
                  className="px-2 py-1 text-[10px] font-bold uppercase bg-[#333] text-gray-300 rounded-sm press-feedback disabled:opacity-50"
                >
                  Decline
                </button>
              </span>
            </div>
          ))}

          {/* Outgoing pending */}
          {(data?.outgoing || []).map((proposal) => (
            <div key={proposal.id} className="px-3 py-1.5 text-[10px] text-gray-500">
              Awaiting <span className="text-gray-300">{proposal.toCorpsName}</span> for Day{' '}
              {proposal.day} — expires unanswered that morning.
            </div>
          ))}

          {/* Propose form — pick a partner, then a day off the calendar */}
          {data && !upcoming && (
            <form
              onSubmit={propose}
              className="space-y-3 border border-[#333] rounded-sm p-3 bg-[#161616]"
            >
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Partner corps
                </label>
                <select
                  value={toUid}
                  onChange={(e) => setToUid(e.target.value)}
                  required
                  className="w-full bg-[#0f0f0f] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white focus:border-[#0057B8] focus:outline-none"
                >
                  <option value="">Propose to…</option>
                  {(data.roster || []).map((corps) => (
                    <option key={corps.uid} value={corps.uid}>
                      {corps.corpsName || corps.uid}
                      {corps.city ? ` · ${corps.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Choose a day
                </label>
                <DayCalendar
                  competitionDay={competitionDay}
                  showDays={showDays}
                  value={day ? Number(day) : null}
                  onChange={(d) => setDay(d)}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-[#2a2a2a]">
                <span className="text-[10px] text-gray-500 min-w-0 truncate">
                  {day ? (
                    <>
                      <span className="text-gray-300 font-bold">Day {day}</span>
                      {selectedShow && (
                        <span className="text-[#c9a227]"> · same day as {selectedShow}</span>
                      )}
                    </>
                  ) : (
                    'Select a partner and a day to propose.'
                  )}
                </span>
                <button
                  type="submit"
                  disabled={busy || !toUid || !day}
                  className="shrink-0 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-[#0057B8] text-white disabled:bg-[#333] disabled:text-gray-600 press-feedback"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Propose'}
                </button>
              </div>
            </form>
          )}

          {/* Latest scrimmage report */}
          <ScrimmageSheet scrimmage={scrimmage} />

          {error && <div className="text-[11px] text-red-400">{error}</div>}
          {notice && <div className="text-[11px] text-green-400">{notice}</div>}
        </>
      )}
    </div>
  );
}
