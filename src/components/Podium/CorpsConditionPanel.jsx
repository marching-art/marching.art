// CorpsConditionPanel — logistics for the tour (Phase 3, design §5.3):
// weekly food plan, the assistant-director plan template, the upcoming route
// with travel tiers + heat, and the Family Day diagnostic when present.

import React, { useState } from 'react';
import {
  Bus,
  UtensilsCrossed,
  UserCog,
  Loader2,
  Sun,
  Coins,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  Moon,
} from 'lucide-react';
import { BLOCKS } from './podiumConstants';

// Costs mirror functions balanceConfig condition.foodTiers — charged from
// the Corps Budget once per week (never your CorpsCoin wallet directly).
const FOOD_TIERS = [
  { id: 'gasStation', label: 'Gas station', detail: 'Free · slower recovery, morale risk' },
  { id: 'standard', label: 'Standard', detail: '60 Budget/week · baseline recovery' },
  { id: 'fullKitchen', label: 'Full kitchen', detail: '150 Budget/week · best recovery + morale' },
];

const TIER_LABELS = {
  local: 'Local',
  dayTrip: 'Day trip',
  overnightHaul: 'Overnight haul',
  longHaul: 'Long haul',
  crossCountry: 'Cross-country',
};

// Shared section header — icon + uppercase label, matches the panel's tone.
function SectionLabel({ icon: Icon, children, className = '' }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 ${className}`}
    >
      <Icon className="w-3 h-3" /> {children}
    </div>
  );
}

// Route itinerary shares one column template between its header and rows so
// the day / show / travel / heat / stamina columns line up across the width.
const ROUTE_COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto_auto] gap-x-3 items-center';

export default function CorpsConditionPanel({ podium }) {
  const state = podium.data?.state;
  const routePreview = podium.data?.routePreview || [];
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState([]);
  const [topUp, setTopUp] = useState(100);
  const [clinicianBlock, setClinicianBlock] = useState('brassSectionals');

  if (!state) return null;

  const act = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const template = state.planTemplate || [];
  const budget = state.budget || { balance: 0, committed: 0, earned: 0, spent: 0 };
  const commitmentCap = podium.data?.commitmentCap || 2500;

  const blockLabel = (id) => BLOCKS.find((x) => x.id === id)?.label || id;
  const addBlock = (id) =>
    setTemplateDraft((prev) => (prev.length < 20 ? [...prev, id] : prev));
  const removeBlock = (index) =>
    setTemplateDraft((prev) => prev.filter((_, i) => i !== index));
  const moveBlock = (index, dir) =>
    setTemplateDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        Tour Logistics
      </h3>

      {/* Budget + Clinician — the two "spend now" controls, side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Corps Budget ledger */}
        <div className="rounded-sm border border-[#333] bg-[#161616] p-3 space-y-2">
          <SectionLabel icon={Coins}>Corps Budget</SectionLabel>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white tabular-nums leading-none">
              {budget.balance}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-gray-600">balance</span>
          </div>
          <div className="text-[10px] text-gray-500 tabular-nums">
            committed {budget.committed || 0}/{commitmentCap.toLocaleString()} · earned{' '}
            {budget.earned || 0} · spent {budget.spent || 0}
          </div>
          {(budget.committed || 0) < commitmentCap && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                type="number"
                min={50}
                max={commitmentCap - (budget.committed || 0)}
                step={50}
                value={topUp}
                onChange={(e) => setTopUp(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 bg-[#111] border border-[#333] rounded-sm px-2 py-1 text-[11px] text-white focus:border-[#0057B8] outline-none tabular-nums"
              />
              <button
                disabled={busy !== null || topUp <= 0}
                onClick={() => act('commit', () => podium.commitBudget(topUp))}
                className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-50 press-feedback"
              >
                {busy === 'commit' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Commit CC'}
              </button>
            </div>
          )}
        </div>

        {/* Clinician */}
        <div className="rounded-sm border border-[#333] bg-[#161616] p-3 space-y-2">
          <SectionLabel icon={Sparkles}>Clinician</SectionLabel>
          {state.clinician ? (
            <p className="text-[11px] text-gray-400">
              <span className="text-[#4d9fff] font-bold">
                {BLOCKS.find((b) => b.id === state.clinician.block)?.label || state.clinician.block}
              </span>{' '}
              engagement active through day {state.clinician.expiresDay} (+30% yield).
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-500">
                Book a specialist to boost one block by +30% for 3 days.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={clinicianBlock}
                  onChange={(e) => setClinicianBlock(e.target.value)}
                  className="bg-[#111] border border-[#333] rounded-sm px-2 py-1 text-[11px] text-white focus:border-[#0057B8] outline-none"
                >
                  {BLOCKS.filter((b) => b.id !== 'warmup').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busy !== null}
                  onClick={() => act('clinician', () => podium.hireClinician(clinicianBlock))}
                  className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-[#0057B8] disabled:opacity-50 press-feedback"
                >
                  {busy === 'clinician' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Hire · 120 Budget / 3 days'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Food plan */}
      <div>
        <SectionLabel icon={UtensilsCrossed} className="mb-1.5">
          Food plan
        </SectionLabel>
        <div className="flex flex-col sm:flex-row gap-2">
          {FOOD_TIERS.map((tier) => (
            <button
              key={tier.id}
              disabled={busy !== null}
              onClick={() => act(tier.id, () => podium.setFoodPlan(tier.id))}
              className={`flex-1 text-left px-3 py-2 rounded-sm border transition-colors press-feedback disabled:opacity-50 ${
                (state.foodTier || 'standard') === tier.id
                  ? 'border-[#0057B8] bg-[#0057B8]/10'
                  : 'border-[#333] hover:border-gray-500'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white">{tier.label}</span>
                {busy === tier.id && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              </span>
              <span className="block text-[9px] text-gray-500">{tier.detail}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Assistant director — the fallback plan for days you don't log in.
          Mirrors the daily Rehearsal Planner: block palette + running order. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel icon={UserCog}>Assistant director</SectionLabel>
          <button
            onClick={() => {
              setEditingTemplate((v) => !v);
              setTemplateDraft(template);
            }}
            className="text-[10px] font-bold uppercase text-gray-500 hover:text-white press-feedback"
          >
            {editingTemplate ? 'Cancel' : template.length > 0 ? 'Edit plan' : 'Set a plan'}
          </button>
        </div>

        {!editingTemplate ? (
          template.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {template.map((b, i) => (
                  <span
                    key={`${b}-${i}`}
                    className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-sm border border-[#333] bg-[#141414]"
                  >
                    <span className="text-gray-600 tabular-nums">{i + 1}</span>
                    <span className="text-gray-200">{blockLabel(b)}</span>
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-gray-500">
                Runs this order at 85% yield on days you don&apos;t log in.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <Moon className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                No plan set — days you miss are lost entirely. Set a default plan and the assistant
                rehearses it at 85% yield while you&apos;re away.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Block palette — click to append, mirrors the daily planner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 content-start">
                {BLOCKS.map((block) => {
                  const count = templateDraft.filter((b) => b === block.id).length;
                  return (
                    <button
                      key={block.id}
                      onClick={() => addBlock(block.id)}
                      className="text-left px-3 py-2 rounded-sm border border-[#333] hover:border-[#0057B8] hover:bg-[#0057B8]/10 transition-colors press-feedback"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-white">{block.label}</span>
                        {count > 0 && (
                          <span className="text-[10px] font-bold text-[#4d9fff] tabular-nums shrink-0">
                            ×{count}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{block.detail}</div>
                    </button>
                  );
                })}
              </div>

              {/* Running order — numbered, reorderable, removable */}
              <div className="lg:w-56 shrink-0 flex flex-col rounded-sm border border-[#333] bg-[#141414] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                    Running order
                  </span>
                  <span className="text-lg font-bold text-white tabular-nums leading-none">
                    {templateDraft.length}
                  </span>
                </div>

                <div className="mt-2 flex-1 space-y-1 min-h-[3rem]">
                  {templateDraft.length === 0 ? (
                    <div className="text-[10px] text-gray-600 italic">
                      Click blocks to build the plan
                    </div>
                  ) : (
                    templateDraft.map((blockId, index) => (
                      <div
                        key={`${blockId}-${index}`}
                        className="flex items-center gap-1 text-[10px] text-gray-300"
                      >
                        <span className="text-gray-600 tabular-nums w-4 text-right shrink-0">
                          {index + 1}.
                        </span>
                        <span className="truncate flex-1">{blockLabel(blockId)}</span>
                        <button
                          onClick={() => moveBlock(index, -1)}
                          disabled={index === 0}
                          title="Move earlier"
                          className="text-gray-600 hover:text-white disabled:opacity-30 disabled:hover:text-gray-600 press-feedback"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveBlock(index, 1)}
                          disabled={index === templateDraft.length - 1}
                          title="Move later"
                          className="text-gray-600 hover:text-white disabled:opacity-30 disabled:hover:text-gray-600 press-feedback"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeBlock(index)}
                          title="Remove"
                          className="text-gray-600 hover:text-red-400 press-feedback"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex gap-1.5">
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      act('template', async () => {
                        await podium.savePlanTemplate(templateDraft);
                        setEditingTemplate(false);
                      })
                    }
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-60 press-feedback"
                  >
                    {busy === 'template' && <Loader2 className="w-3 h-3 animate-spin" />} Save plan
                  </button>
                  {templateDraft.length > 0 && (
                    <button
                      onClick={() => setTemplateDraft([])}
                      className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 press-feedback"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[9px] text-gray-600 leading-relaxed">
              Lead with Stretch / PT to cut the stamina cost of the blocks that follow, and avoid
              repeating a block back-to-back — repeats yield less.
            </p>
          </div>
        )}
      </div>

      {/* Route preview — aligned itinerary table */}
      {routePreview.length > 0 && (
        <div>
          <SectionLabel icon={Bus} className="mb-1.5">
            Upcoming route
          </SectionLabel>
          <div className="rounded-sm border border-[#333] overflow-hidden">
            <div
              className={`${ROUTE_COLS} px-3 py-1 bg-[#161616] text-[8px] uppercase tracking-wider text-gray-600`}
            >
              <span>Day</span>
              <span>Show · City</span>
              <span className="text-right">Travel</span>
              <span className="text-right" title="Heat index — extra stamina">
                Heat
              </span>
              <span className="text-right" title="Travel stamina cost">
                Stam
              </span>
            </div>
            {routePreview.map((leg) => (
              <div
                key={leg.day}
                className={`${ROUTE_COLS} px-3 py-1 border-t border-[#242424] text-[10px] tabular-nums`}
              >
                <span className="text-gray-500">D{leg.day}</span>
                <span
                  className={`truncate ${leg.isMajor ? 'text-[#c9a227] font-bold' : 'text-gray-300'}`}
                  title={leg.label ? `${leg.label} — ${leg.city}` : leg.city}
                >
                  {leg.label ? `${leg.label} · ${leg.city}` : leg.city}
                </span>
                <span className="text-right text-gray-500">
                  {leg.miles != null && leg.miles > 0
                    ? `${TIER_LABELS[leg.tier] || leg.tier} · ${leg.miles} mi`
                    : ''}
                </span>
                <span className="text-right text-orange-400">
                  {leg.heat > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Sun className="w-3 h-3" /> {leg.heat}
                    </span>
                  ) : (
                    ''
                  )}
                </span>
                <span className="text-right text-red-400/80">
                  {leg.staminaCost > 0 ? `−${leg.staminaCost}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Day diagnostic */}
      {state.familyDay && (
        <div className="border border-[#2f3f5f] bg-[#0f1a2e] rounded-sm px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#4d9fff] mb-0.5">
            Family Day exhibition — private diagnostic
          </div>
          <div className="text-[11px] text-gray-300 tabular-nums">
            Total <span className="font-bold text-white">{state.familyDay.total?.toFixed(3)}</span>
            {' · '}GE {state.familyDay.geScore?.toFixed(2)} · Vis{' '}
            {state.familyDay.visualScore?.toFixed(2)} · Mus {state.familyDay.musicScore?.toFixed(2)}
          </div>
        </div>
      )}

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
