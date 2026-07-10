// PodiumRegistration — the four-step FMA-style setup (design §5.13):
// 1) corps identity, 2) show concept, 3) design (challenge sliders + one-tap
// audition presets), 4) march. No payments anywhere.

import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { PODIUM_CAPTIONS, CAPTION_LABELS, AUDITION_PRESETS } from './podiumConstants';

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

  const auditions = useMemo(() => {
    const preset = AUDITION_PRESETS.find((p) => p.id === auditionPreset);
    return preset && Object.keys(preset.points).length > 0 ? preset.points : null;
  }, [auditionPreset]);

  const canNext = step === 0 ? corpsName.trim().length >= 3 : true;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await podium.register({
        corpsName: corpsName.trim(),
        location: location.trim(),
        showConcept: showConcept.trim(),
        challenge,
        auditions,
        budgetCommitment: budgetCommitment > 0 ? budgetCommitment : undefined,
      });
      setDone(result);
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-6 text-center space-y-2">
        <div className="text-lg font-bold text-white">{done.corpsName} is on tour.</div>
        <div className="text-xs text-gray-400">
          Your Eastern Classic night:{' '}
          <span className="text-white font-bold">Day {done.easternNight}</span>. First rehearsal
          block is waiting below.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 md:p-6 space-y-5 max-w-2xl">
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
            className="w-full bg-[#111] border border-[#333] rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={80}
            placeholder="Hometown (e.g., Canton, Ohio) — your tour starts here"
            className="w-full bg-[#111] border border-[#333] rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none"
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
            className="w-full bg-[#111] border border-[#333] rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0057B8] outline-none resize-none"
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
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm border transition-colors press-feedback ${
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
        <div className="space-y-2">
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
        </div>
      )}

      {error && <div className="text-[11px] text-red-400">{error}</div>}

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
          className="flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-2 rounded-sm border border-[#333] text-gray-400 hover:text-white disabled:opacity-40 press-feedback"
        >
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-1 text-[10px] font-bold uppercase px-4 py-2 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-40 press-feedback"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 text-[10px] font-bold uppercase px-4 py-2 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-60 press-feedback"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />} Found the corps
          </button>
        )}
      </div>
    </div>
  );
}
