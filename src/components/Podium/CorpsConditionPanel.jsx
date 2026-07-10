// CorpsConditionPanel — logistics for the tour (Phase 3, design §5.3):
// weekly food plan, the assistant-director plan template, the upcoming route
// with travel tiers + heat, and the Family Day diagnostic when present.

import React, { useState } from 'react';
import { Bus, UtensilsCrossed, UserCog, Loader2, Sun } from 'lucide-react';
import { BLOCKS } from './podiumConstants';

const FOOD_TIERS = [
  { id: 'gasStation', label: 'Gas station', detail: 'Free · slower recovery, morale risk' },
  { id: 'standard', label: 'Standard', detail: 'Baseline recovery' },
  { id: 'fullKitchen', label: 'Full kitchen', detail: 'Best recovery + morale' },
];

const TIER_LABELS = {
  local: 'Local',
  dayTrip: 'Day trip',
  overnightHaul: 'Overnight haul',
  longHaul: 'Long haul',
  crossCountry: 'Cross-country',
};

export default function CorpsConditionPanel({ podium }) {
  const state = podium.data?.state;
  const routePreview = podium.data?.routePreview || [];
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState([]);

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

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        Tour Logistics
      </h3>

      {/* Food plan */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400 mb-1.5">
          <UtensilsCrossed className="w-3 h-3" /> Food plan
        </div>
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

      {/* Assistant director template */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400">
            <UserCog className="w-3 h-3" /> Assistant director
          </div>
          <button
            onClick={() => {
              setEditingTemplate((v) => !v);
              setTemplateDraft(template);
            }}
            className="text-[10px] font-bold uppercase text-gray-500 hover:text-white press-feedback"
          >
            {editingTemplate ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {!editingTemplate ? (
          <p className="text-[10px] text-gray-500">
            {template.length > 0 ? (
              <>
                Runs{' '}
                <span className="text-gray-300">
                  {template.map((b) => BLOCKS.find((x) => x.id === b)?.label || b).join(' → ')}
                </span>{' '}
                at 85% yield on days you don&apos;t log in.
              </>
            ) : (
              'No plan set — days you miss are lost entirely. Set a default plan and the assistant rehearses at 85% yield.'
            )}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {BLOCKS.map((block) => (
                <button
                  key={block.id}
                  onClick={() =>
                    setTemplateDraft((prev) => (prev.length < 5 ? [...prev, block.id] : prev))
                  }
                  className="text-[10px] font-bold px-2 py-1 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-[#0057B8] press-feedback"
                >
                  + {block.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 min-h-[24px]">
              <span className="text-[10px] text-gray-500">Plan:</span>
              {templateDraft.length === 0 ? (
                <span className="text-[10px] text-gray-600">empty</span>
              ) : (
                templateDraft.map((blockId, index) => (
                  <button
                    key={`${blockId}-${index}`}
                    onClick={() => setTemplateDraft((prev) => prev.filter((_, i) => i !== index))}
                    title="Remove"
                    className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#0057B8]/20 text-[#4d9fff] hover:bg-red-900/40 hover:text-red-300 press-feedback"
                  >
                    {BLOCKS.find((x) => x.id === blockId)?.label || blockId} ×
                  </button>
                ))
              )}
            </div>
            <button
              disabled={busy !== null}
              onClick={() =>
                act('template', async () => {
                  await podium.savePlanTemplate(templateDraft);
                  setEditingTemplate(false);
                })
              }
              className="flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-60 press-feedback"
            >
              {busy === 'template' && <Loader2 className="w-3 h-3 animate-spin" />} Save plan
            </button>
          </div>
        )}
      </div>

      {/* Route preview */}
      {routePreview.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400 mb-1.5">
            <Bus className="w-3 h-3" /> Upcoming route
          </div>
          <div className="space-y-1">
            {routePreview.map((leg) => (
              <div key={leg.day} className="flex items-center gap-2 text-[10px] tabular-nums">
                <span className="w-8 shrink-0 text-gray-500">D{leg.day}</span>
                <span
                  className={`flex-1 truncate ${leg.isMajor ? 'text-[#c9a227] font-bold' : 'text-gray-300'}`}
                >
                  {leg.city}
                </span>
                {leg.miles != null && leg.miles > 0 && (
                  <span className="text-gray-500">
                    {TIER_LABELS[leg.tier] || leg.tier} · {leg.miles} mi
                  </span>
                )}
                {leg.heat > 0 && (
                  <span
                    className="flex items-center gap-0.5 text-orange-400"
                    title="Heat index — extra stamina"
                  >
                    <Sun className="w-3 h-3" /> {leg.heat}
                  </span>
                )}
                {leg.staminaCost > 0 && (
                  <span className="text-red-400/80" title="Travel stamina">
                    −{leg.staminaCost}
                  </span>
                )}
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
