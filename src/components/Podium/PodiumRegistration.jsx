// PodiumRegistration — the four-step FMA-style setup (design §5.13):
// 1) corps identity, 2) show concept, 3) design (challenge sliders + one-tap
// audition presets), 4) march. No payments anywhere.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import {
  PODIUM_CAPTIONS,
  CAPTION_LABELS,
  AUDITION_PRESETS,
  SPECIALTY_LABELS,
  TIER_LABELS,
} from './podiumConstants';

const STEPS = ['Corps', 'Show', 'Design', 'March'];

export default function PodiumRegistration({ podium }) {
  const [step, setStep] = useState(0);
  const [corpsName, setCorpsName] = useState('');
  const [location, setLocation] = useState('');
  const [showConcept, setShowConcept] = useState('');
  const [challenge, setChallenge] = useState(
    Object.fromEntries(PODIUM_CAPTIONS.map((c) => [c, 5]))
  );
  const [auditionPreset, setAuditionPreset] = useState('balanced');
  const [budgetCommitment, setBudgetCommitment] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  // Between-seasons funding preview (design §5.6): carried staff and what they
  // cost next season vs. the CC the director can commit. Absent for a
  // first-time corps — the preview call reports hasCarriedStaff:false.
  const [preview, setPreview] = useState(null);
  // Specialties the director chooses to keep; unchecked = voluntarily released.
  const [keptStaff, setKeptStaff] = useState(null); // Set, initialized from preview

  const loadPreview = podium.loadRegistrationPreview;
  useEffect(() => {
    let cancelled = false;
    if (!loadPreview) return undefined;
    loadPreview()
      .then((data) => {
        if (cancelled || !data) return;
        setPreview(data);
        const active = (data.staff || []).filter((s) => !s.retiring);
        setKeptStaff(new Set(active.map((s) => s.specialty)));
        // Pre-fund to cover the whole payroll when the director can afford it,
        // so an affordable roster needs no intervention; otherwise offer the
        // most they could commit and let them choose who to shed.
        const maxCommit = Math.min(data.commitmentCap || 0, data.corpsCoin || 0);
        if (data.hasCarriedStaff) {
          setBudgetCommitment(Math.min(maxCommit, data.payroll || 0));
        }
      })
      .catch(() => {
        /* preview is advisory — registration still works without it */
      });
    return () => {
      cancelled = true;
    };
  }, [loadPreview]);

  const auditions = useMemo(() => {
    const preset = AUDITION_PRESETS.find((p) => p.id === auditionPreset);
    return preset && Object.keys(preset.points).length > 0 ? preset.points : null;
  }, [auditionPreset]);

  const hasCarried = Boolean(preview?.hasCarriedStaff);
  const activeStaff = useMemo(() => (preview?.staff || []).filter((s) => !s.retiring), [preview]);
  const retiringStaff = useMemo(() => (preview?.staff || []).filter((s) => s.retiring), [preview]);
  const maxCommit = preview ? Math.min(preview.commitmentCap || 0, preview.corpsCoin || 0) : 2500;
  // A carried-staff director can commit at most what they hold; a first-time
  // corps is bounded only by the division cap (the wallet debit is enforced
  // server-side either way).
  const commitmentMax = hasCarried ? maxCommit : (preview?.commitmentCap ?? 2500);
  // Payroll of the staff the director has chosen to keep — the number that
  // must fit inside the commitment before the corps can be founded.
  const keptPayroll = useMemo(() => {
    if (!keptStaff) return 0;
    return activeStaff
      .filter((s) => keptStaff.has(s.specialty))
      .reduce((sum, s) => sum + (s.nextSalary || 0), 0);
  }, [activeStaff, keptStaff]);
  const shortfall = Math.max(0, keptPayroll - budgetCommitment);
  const overBudget = hasCarried && shortfall > 0;

  const canNext = step === 0 ? corpsName.trim().length >= 3 : true;

  const toggleKeep = (specialty) => {
    setKeptStaff((prev) => {
      const next = new Set(prev);
      if (next.has(specialty)) next.delete(specialty);
      else next.add(specialty);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Keep list in priciest-first order so, in the rare event the server's
      // aged salaries differ from the preview, the cheapest is shed first.
      const staffPriority =
        hasCarried && keptStaff
          ? activeStaff
              .filter((s) => keptStaff.has(s.specialty))
              .sort((a, b) => (b.nextSalary || 0) - (a.nextSalary || 0))
              .map((s) => s.specialty)
          : undefined;
      const result = await podium.register({
        corpsName: corpsName.trim(),
        location: location.trim(),
        showConcept: showConcept.trim(),
        challenge,
        auditions,
        budgetCommitment: budgetCommitment > 0 ? budgetCommitment : undefined,
        staffPriority,
      });
      setDone(result);
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const retained = done.retainedStaff || [];
    const lapsed = done.lapsedStaff || [];
    const reasonWord = { unaffordable: 'unfunded', released: 'released', retired: 'retired' };
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-none p-6 text-center space-y-2">
        <div className="text-lg font-bold text-white">{done.corpsName} is on tour.</div>
        <div className="text-xs text-gray-400">
          Competing in{' '}
          <span className="text-yellow-400 font-bold">{done.divisionLabel || 'A Class'}</span>. Your
          provisional Eastern Classic night:{' '}
          <span className="text-white font-bold">Day {done.easternNight}</span> (night lineups
          publish Day 39). First rehearsal block is waiting below.
        </div>
        {(retained.length > 0 || lapsed.length > 0) && (
          <div className="text-[11px] text-gray-400 pt-1">
            {retained.length > 0 && (
              <div>
                Staff retained:{' '}
                <span className="text-gray-200">
                  {retained.map((s) => SPECIALTY_LABELS[s] || s).join(', ')}
                </span>
              </div>
            )}
            {lapsed.length > 0 && (
              <div>
                Left the corps:{' '}
                <span className="text-gray-300">
                  {lapsed
                    .map(
                      (s) =>
                        `${SPECIALTY_LABELS[s.specialty] || s.specialty} (${reasonWord[s.reason] || s.reason})`
                    )
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-none p-4 md:p-6 space-y-5 max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <React.Fragment key={label}>
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${index === step ? 'text-[#4d9fff]' : index < step ? 'text-gray-300' : 'text-gray-600'}`}
            >
              {index + 1}. {label}
            </div>
            {index < STEPS.length - 1 && <div className="flex-1 h-px bg-[#333]" />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">Found your corps</h2>
          <p className="text-xs text-gray-400">
            One drum corps, yours for as long as you keep marching it. Reputation attaches to the
            corps — its name is the thing you&apos;ll spend seasons building.{' '}
            <a
              href="/podium-guide"
              target="_blank"
              rel="noreferrer"
              className="text-[#c9a227] hover:underline"
            >
              Read the guide →
            </a>
          </p>
          <input
            value={corpsName}
            onChange={(e) => setCorpsName(e.target.value)}
            maxLength={40}
            placeholder="Corps name"
            className="w-full bg-[#111] border border-[#333] rounded-none px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={80}
            placeholder="Hometown (e.g., Canton, Ohio) — your tour starts here"
            className="w-full bg-[#111] border border-[#333] rounded-none px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none"
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">This season&apos;s show</h2>
          <p className="text-xs text-gray-400">
            Title and concept — pure identity, zero mechanics.
          </p>
          <textarea
            value={showConcept}
            onChange={(e) => setShowConcept(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder={'e.g., "The Weight of Water" — Debussy, Glass, and a flooded stage'}
            className="w-full bg-[#111] border border-[#333] rounded-none px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none resize-none"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Challenge levels</h2>
            <p className="text-xs text-gray-400">
              Per caption, 1–8. Low = earlier, safer, capped. High = later, riskier, higher ceiling.
              Locked for the season.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {PODIUM_CAPTIONS.map((caption) => (
              <label key={caption} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] font-bold text-white">
                  {caption}
                  <span className="block text-[9px] font-normal text-gray-600 truncate">
                    {CAPTION_LABELS[caption]}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={challenge[caption]}
                  onChange={(e) =>
                    setChallenge((prev) => ({ ...prev, [caption]: Number(e.target.value) }))
                  }
                  className="flex-1 accent-[#0057B8]"
                />
                <span className="w-5 text-right text-xs font-bold text-[#4d9fff] tabular-nums">
                  {challenge[caption]}
                </span>
              </label>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold text-white mb-1">Auditions</h3>
            <p className="text-[11px] text-gray-400 mb-2">
              Where did your recruiting focus land? Shifts your starting distribution, never its
              total.
            </p>
            <div className="flex gap-2">
              {AUDITION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAuditionPreset(preset.id)}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-none border transition-colors press-feedback ${
                    auditionPreset === preset.id
                      ? 'border-[#0057B8] bg-[#0057B8]/15 text-white'
                      : 'border-[#333] text-gray-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">Ready to march</h2>
          <div className="text-xs text-gray-400 space-y-1">
            <div>
              <span className="text-white font-bold">{corpsName.trim()}</span>
              {location.trim() && <> · {location.trim()}</>}
            </div>
            {showConcept.trim() && <div className="italic">&ldquo;{showConcept.trim()}&rdquo;</div>}
            <div>Challenge: {PODIUM_CAPTIONS.map((c) => `${c} ${challenge[c]}`).join(' · ')}</div>
            <div>
              You&apos;re auto-registered at the majors — Southwestern (Day 28), Southeastern (Day
              35), the Eastern Classic, and Championship Week.
            </div>
          </div>

          {/* Optional CC -> Corps Budget commitment (decision 24: capped,
              buys margin — food, travel, staff — never caption points).
              Server validates the cap; zero is always playable. */}
          <div className="pt-2 border-t border-[#333]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Fund the season {hasCarried ? '' : '(optional)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={commitmentMax}
                step={50}
                value={budgetCommitment}
                onChange={(e) =>
                  setBudgetCommitment(
                    Math.max(0, Math.min(commitmentMax, Math.floor(Number(e.target.value) || 0)))
                  )
                }
                className="w-28 bg-[#111] border border-[#333] rounded-none px-3 py-2 text-sm text-white focus:border-[#0057B8] outline-none tabular-nums"
              />
              <span className="text-[10px] text-gray-500">
                {hasCarried ? (
                  <>
                    CorpsCoin into this season&apos;s Corps Budget. You hold{' '}
                    <span className="text-gray-300 tabular-nums">{preview.corpsCoin}</span> CC;{' '}
                    {preview.divisionLabel} caps a commitment at{' '}
                    <span className="text-gray-300 tabular-nums">{preview.commitmentCap}</span>.
                  </>
                ) : (
                  <>
                    CorpsCoin into your Corps Budget — food, travel, staff. Never scores. ~1,000 CC
                    funds a comfortable season; you can top up later, and a 0-CC corps is always
                    playable.
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Carried-staff payroll vs. the commitment (design §5.6). Staff only
              lapse at the season boundary, so THIS is where a director decides
              who to keep when the CC won't cover the whole aged payroll —
              rather than discovering a silent lapse afterward. */}
          {hasCarried && keptStaff && (
            <div className="pt-3 border-t border-[#333] space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Staff payroll — who marches next season
                </label>
                <span
                  className={`text-[11px] font-bold tabular-nums ${overBudget ? 'text-red-400' : 'text-green-400'}`}
                >
                  {keptPayroll} / {budgetCommitment} CC
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                Tenure raised your staff&apos;s salaries. Uncheck anyone you&apos;re letting go —
                their seat reopens and their tenure ends. Whatever you keep must fit your
                commitment.
              </p>

              {activeStaff.map((s) => {
                const kept = keptStaff.has(s.specialty);
                const promoted = s.nextTier && s.nextTier !== s.tier;
                return (
                  <label
                    key={s.specialty}
                    className={`flex items-center gap-2 px-2 py-1.5 border rounded-none cursor-pointer press-feedback ${
                      kept ? 'border-[#333] bg-[#111]' : 'border-[#2a1a1a] bg-[#160f0f] opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={kept}
                      onChange={() => toggleKeep(s.specialty)}
                      className="accent-[#0057B8]"
                    />
                    <span className="flex-1 text-[11px] font-bold text-white">
                      {SPECIALTY_LABELS[s.specialty] || s.specialty}
                      <span className="ml-2 text-[9px] font-normal text-gray-500">
                        {TIER_LABELS[s.nextTier] || TIER_LABELS[s.tier]}
                        {promoted && (
                          <span className="text-[#c9a227]">
                            {' '}
                            · promoted from {TIER_LABELS[s.tier]}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums text-gray-300">
                      {s.nextSalary} CC
                      {s.nextSalary > s.salary && (
                        <span className="text-gray-600"> (was {s.salary})</span>
                      )}
                    </span>
                  </label>
                );
              })}

              {retiringStaff.map((s) => (
                <div
                  key={s.specialty}
                  className="flex items-center gap-2 px-2 py-1.5 border border-[#222] rounded-none opacity-50"
                >
                  <span className="flex-1 text-[11px] text-gray-400">
                    {SPECIALTY_LABELS[s.specialty] || s.specialty}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">
                    Retiring · 30-season career
                  </span>
                </div>
              ))}

              {overBudget && (
                <div className="flex items-start gap-2 text-[11px] text-red-400 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    You&apos;re <span className="font-bold tabular-nums">{shortfall}</span> CC
                    short. Commit more (up to {maxCommit}) or release a staffer to found the corps.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div className="text-[11px] text-red-400">{error}</div>}

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
          className="flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-2 rounded-none border border-[#333] text-gray-400 hover:text-white disabled:opacity-40 press-feedback"
        >
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-1 text-[10px] font-bold uppercase px-4 py-2 rounded-none bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-40 press-feedback"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting || overBudget}
            title={overBudget ? 'Your staff payroll exceeds your commitment.' : undefined}
            className="flex items-center gap-2 text-[10px] font-bold uppercase px-4 py-2 rounded-none bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-60 press-feedback"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />} Found the corps
          </button>
        )}
      </div>
    </div>
  );
}
