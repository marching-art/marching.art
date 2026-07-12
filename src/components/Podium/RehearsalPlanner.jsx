// RehearsalPlanner — the Podium Class daily verb (Phase 2, design §6.1).
// One screen: pick today's rehearsal blocks (12 on a normal day, 20 in spring
// training, 8 on a show day at half value each), watch the Action Complete
// panel, or declare a rest day. Condition strip included.

import React, { useState } from 'react';
import { Flame, BatteryCharging, Moon, Loader2, Coins, Trophy } from 'lucide-react';
import { BLOCKS, CAPTION_LABELS } from './podiumConstants';

function ConditionBar({ label, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-[120px]">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <div className="flex-1">
        <div className="flex justify-between text-[10px] text-muted uppercase font-bold">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(value)}</span>
        </div>
        <div className="h-1.5 bg-surface-elevated rounded-none overflow-hidden">
          <div
            className={`h-full rounded-none ${value >= 50 ? 'bg-green-500' : value >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
  const isShowDay = Boolean(data.isShowDay) && !seasonOver;

  return (
    <div
      className={`bg-surface-card border rounded-none p-4 space-y-4 ${
        isShowDay
          ? 'border-[#c9a227] shadow-[0_0_0_1px_#c9a227] ring-1 ring-[#c9a227]/40'
          : 'border-line'
      }`}
    >
      {/* Show day is the payoff — make it unmissable. Banner sits above the
          whole planner so a returning FMA veteran never mistakes the lighter
          8-block run-through for a normal 12-click rehearsal day. */}
      {isShowDay && (
        <div className="flex items-center gap-2 -mx-4 -mt-4 mb-0 px-4 py-2 bg-gradient-to-r from-[#c9a227]/25 to-transparent border-b border-[#c9a227]/60">
          <Trophy className="w-4 h-4 text-[#c9a227] shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
            Show day — you compete tonight
          </span>
          <span className="text-[10px] text-[#e0c25a] ml-auto text-right leading-tight">
            {today.restDay
              ? 'Resting — you still perform with today’s book'
              : 'Light run-through: 8 blocks, half value each'}
          </span>
        </div>
      )}
      {/* Header: day type + condition strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {isSpringTraining
              ? `Spring training · Day ${data.calendarDay}`
              : seasonOver
                ? 'Post-season'
                : `Day ${competitionDay} of 49`}
          </div>
          <div
            className={`text-sm font-bold flex items-center gap-3 ${
              isShowDay ? 'text-[#c9a227]' : 'text-white'
            }`}
          >
            {dayType}
            {data.divisionLabel && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-none bg-yellow-400/15 text-yellow-400">
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
                  className="text-left px-3 py-2.5 rounded-none border border-line hover:border-interactive hover:bg-interactive/10 transition-colors press-feedback disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{block.label}</span>
                    <span className="flex items-center gap-1">
                      {usedCount > 0 && (
                        <span className="text-[10px] font-bold text-interactive tabular-nums">
                          ×{usedCount}
                        </span>
                      )}
                      {busy === block.id && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{block.detail}</div>
                </button>
              );
            })}
            <button
              disabled={busy !== null}
              onClick={() => handleAllocate('fundraiser')}
              className="text-left px-3 py-2.5 rounded-none border border-[#5a4a12] hover:border-[#c9a227] hover:bg-[#c9a227]/10 transition-colors press-feedback disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#c9a227]">Fundraiser</span>
                {busy === 'fundraiser' && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
              </div>
              <div className="text-[10px] text-muted mt-0.5">
                Convert a block to Corps Budget income (+3 Budget per block) — no caption growth
              </div>
            </button>
          </div>
        )}

        {/* Schedule panel: today's block count + running order */}
        <div className="lg:w-56 shrink-0 flex flex-col rounded-none border border-line bg-surface-sunken p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
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
                  className="flex items-center gap-1.5 text-[10px] text-secondary"
                >
                  <span className="text-muted tabular-nums w-4 text-right shrink-0">{i + 1}.</span>
                  <span className="truncate">
                    {BLOCKS.find((x) => x.id === b)?.label ||
                      (b === 'fundraiser' ? 'Fundraiser' : b)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[10px] text-muted italic">
                {today.restDay ? 'Rest day declared' : 'No blocks yet'}
              </div>
            )}
          </div>

          {!exhausted && (today.blocksUsed || 0) === 0 && (
            <button
              onClick={handleRest}
              disabled={busy !== null}
              className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-none border border-line text-muted hover:text-white hover:border-charcoal-500 transition-colors press-feedback disabled:opacity-50"
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
        <div className="border border-[#2f4f2f] bg-[#12240f] rounded-none px-3 py-2">
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
              <span key={caption} className="text-[11px] text-secondary tabular-nums">
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
