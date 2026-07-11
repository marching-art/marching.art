// RehearsalPlanner — the Podium Class daily verb (Phase 2, design §6.1).
// One screen, 12 clicks: pick today's rehearsal blocks, watch the Action
// Complete panel, or declare a rest day. Condition strip included.

import React, { useState } from 'react';
import { Flame, BatteryCharging, Moon, Loader2, Coins } from 'lucide-react';
import { BLOCKS, CAPTION_LABELS } from './podiumConstants';

function ConditionBar({ label, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-[120px]">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <div className="flex-1">
        <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(value)}</span>
        </div>
        <div className="h-1.5 bg-[#2a2a2a] rounded-sm overflow-hidden">
          <div
            className={`h-full rounded-sm ${value >= 50 ? 'bg-green-500' : value >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RehearsalPlanner({ podium }) {
  const { data, lastPanel, allocate, declareRestDay } = podium;
  const [busy, setBusy] = useState(null); // blockType being allocated
  const [actionError, setActionError] = useState(null);

  const state = data?.state;
  if (!state) return null;

  const today = state.today || { blocksUsed: 0, blocks: [], restDay: false };
  const condition = state.condition || { stamina: 0, morale: 0 };
  const budget = state.budget || { balance: 0 };
  const competitionDay = data.competitionDay;
  const isSpringTraining = competitionDay < 1;
  const seasonOver = competitionDay > 49;
  const dayType = seasonOver
    ? 'Season complete'
    : today.restDay
      ? 'Rest day'
      : data.isShowDay
        ? 'Show day'
        : isSpringTraining
          ? 'Spring training'
          : 'Rehearsal day';

  const handleAllocate = async (blockType) => {
    setBusy(blockType);
    setActionError(null);
    try {
      await allocate(blockType);
    } catch (err) {
      setActionError(err?.message || 'Could not allocate block.');
    } finally {
      setBusy(null);
    }
  };

  const handleRest = async () => {
    setBusy('rest');
    setActionError(null);
    try {
      await declareRestDay();
    } catch (err) {
      setActionError(err?.message || 'Could not declare a rest day.');
    } finally {
      setBusy(null);
    }
  };

  const exhausted = seasonOver || today.restDay;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-4">
      {/* Header: day type + condition strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {isSpringTraining
              ? `Spring training · Day ${data.calendarDay}`
              : seasonOver
                ? 'Post-season'
                : `Day ${competitionDay} of 49`}
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-3">
            {dayType}
            {data.divisionLabel && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-yellow-400/15 text-yellow-400">
                {data.divisionLabel}
              </span>
            )}
            <span
              className="flex items-center gap-1 text-[10px] font-bold text-[#c9a227] tabular-nums"
              title="Corps Budget"
            >
              <Coins className="w-3 h-3" /> {budget.balance}
            </span>
          </div>
        </div>
        <div className="flex gap-4 flex-1 sm:max-w-xs">
          <ConditionBar
            label="Stamina"
            value={condition.stamina}
            icon={BatteryCharging}
            color="text-green-400"
          />
          <ConditionBar
            label="Morale"
            value={condition.morale}
            icon={Flame}
            color="text-orange-400"
          />
        </div>
      </div>

      {/* Block allocator + schedule panel */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Block grid (fundraiser lives inside the grid) */}
        {!exhausted && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 content-start">
            {BLOCKS.map((block) => {
              const usedCount = (today.blocks || []).filter((b) => b === block.id).length;
              return (
                <button
                  key={block.id}
                  disabled={busy !== null}
                  onClick={() => handleAllocate(block.id)}
                  className="text-left px-3 py-2.5 rounded-sm border border-[#333] hover:border-[#0057B8] hover:bg-[#0057B8]/10 transition-colors press-feedback disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{block.label}</span>
                    <span className="flex items-center gap-1">
                      {usedCount > 0 && (
                        <span className="text-[10px] font-bold text-[#4d9fff] tabular-nums">
                          ×{usedCount}
                        </span>
                      )}
                      {busy === block.id && (
                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{block.detail}</div>
                </button>
              );
            })}
            <button
              disabled={busy !== null}
              onClick={() => handleAllocate('fundraiser')}
              className="text-left px-3 py-2.5 rounded-sm border border-[#5a4a12] hover:border-[#c9a227] hover:bg-[#c9a227]/10 transition-colors press-feedback disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#c9a227]">Fundraiser</span>
                {busy === 'fundraiser' && (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Convert a block to Corps Budget income (+3 Budget per block) — no caption growth
              </div>
            </button>
          </div>
        )}

        {/* Schedule panel: today's block count + running order */}
        <div className="lg:w-56 shrink-0 flex flex-col rounded-sm border border-[#333] bg-[#141414] p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Blocks today
            </span>
            <span className="text-lg font-bold text-white tabular-nums leading-none">
              {today.blocksUsed || 0}
            </span>
          </div>

          <div className="mt-2 flex-1 space-y-1 min-h-[2rem]">
            {today.blocks?.length > 0 ? (
              today.blocks.map((b, i) => (
                <div
                  key={`${b}-${i}`}
                  className="flex items-center gap-1.5 text-[10px] text-gray-300"
                >
                  <span className="text-gray-600 tabular-nums w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="truncate">
                    {BLOCKS.find((x) => x.id === b)?.label ||
                      (b === 'fundraiser' ? 'Fundraiser' : b)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[10px] text-gray-600 italic">
                {today.restDay ? 'Rest day declared' : 'No blocks yet'}
              </div>
            )}
          </div>

          {!exhausted && (today.blocksUsed || 0) === 0 && (
            <button
              onClick={handleRest}
              disabled={busy !== null}
              className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors press-feedback disabled:opacity-50"
            >
              <Moon className="w-3 h-3" /> Rest day
            </button>
          )}
          {today.restDay && (
            <span className="mt-3 text-center text-[10px] font-bold uppercase text-blue-300">
              Resting — recovery tonight
            </span>
          )}
        </div>
      </div>

      {/* Action Complete panel */}
      {lastPanel && (
        <div className="border border-[#2f4f2f] bg-[#12240f] rounded-sm px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">
            Action complete — {BLOCKS.find((b) => b.id === lastPanel.blockType)?.label}
            {lastPanel.repeatMult < 1 && (
              <span className="text-yellow-500"> · repeat yield ×{lastPanel.repeatMult}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {lastPanel.budgetEarned > 0 && (
              <span className="text-[11px] text-[#c9a227] tabular-nums font-bold">
                +{lastPanel.budgetEarned} Corps Budget
              </span>
            )}
            {Object.entries(lastPanel.gains || {}).map(([caption, gain]) => (
              <span key={caption} className="text-[11px] text-gray-300 tabular-nums">
                {CAPTION_LABELS[caption] || caption}:{' '}
                <span className="text-green-400">+{(gain.content * 100).toFixed(1)}%</span> content
                {gain.clean > 0.0005 && (
                  <>
                    {' · '}
                    <span className="text-blue-300">+{(gain.clean * 100).toFixed(1)}%</span> clean
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {actionError && <div className="text-[11px] text-red-400">{actionError}</div>}
    </div>
  );
}
