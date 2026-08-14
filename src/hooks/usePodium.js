// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
/**
 * Podium Class state + actions hook (Phase 2).
 *
 * Loads podium/state through the getPodiumState callable (the subcollection
 * is owner-read via rules, but the callable also derives the server's day
 * context — the client never trusts its own clock for "today").
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPodiumState,
  getPodiumRegistrationPreview,
  allocateRehearsalBlock,
  setPodiumRestDay,
  registerPodiumCorps,
  setPodiumShows,
  setPodiumFoodPlan,
  setPodiumAirfare,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
  acknowledgePodiumStaffOutlook,
  retirePodiumCorps,
  unretirePodiumCorps,
} from '../api/podium';

export function usePodium(enabled) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  // Widened deliberately: the getPodiumState response has no declared type
  // yet, and leaving this as `useState(null)` infers `null`, which breaks
  // every consumer that reads `podium.data?.x`.
  const [data, setData] = useState(/** @type {any} */ (null)); // PodiumStateResponse
  const [lastPanel, setLastPanel] = useState(null); // most recent Action Complete panel
  // Optimistic block queue (see queueAllocate). `pending` is a per-block-type
  // count of taps accepted but not yet confirmed by the server, so the grid can
  // stay live while allocations drain one at a time in the background.
  const [pending, setPending] = useState(/** @type {Record<string, number>} */ ({}));
  const queueRef = useRef(/** @type {string[]} */ ([]));
  const drainingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPodiumState();
      setData(result.data);
      // The fetched state is the truth; drop any optimistic block queue so the
      // grid reflects it rather than double-counting confirmed taps.
      queueRef.current = [];
      setPending({});
    } catch (err) {
      setError(err?.message || 'Failed to load Podium state.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Latest data, readable synchronously inside the drain loop (which runs
  // between renders, so it can't rely on the `data` closure being current).
  const dataRef = useRef(data);
  dataRef.current = data;

  // Apply one confirmed allocation's payload to the state. Shared by the
  // direct `allocate` and the queue drain.
  const applyAllocation = useCallback((payload) => {
    setLastPanel(payload.panel);
    setData((previous) =>
      previous && previous.state
        ? {
            ...previous,
            state: {
              ...previous.state,
              today: payload.today,
              condition: payload.condition,
            },
            // Server-authoritative budget moves with each confirmed block.
            blocksUsedToday: payload.today?.blocksUsed ?? previous.blocksUsedToday,
            blocksRemainingToday:
              typeof payload.blocksRemaining === 'number'
                ? payload.blocksRemaining
                : previous.blocksRemainingToday,
          }
        : previous
    );
  }, []);

  const allocate = useCallback(
    async (blockType, blockIndex) => {
      // The server validates blockIndex against the live blocksUsed. When not
      // told explicitly (a direct call), read the latest confirmed count.
      const index =
        typeof blockIndex === 'number'
          ? blockIndex
          : (dataRef.current?.state?.today?.blocksUsed ?? undefined);
      const result = await allocateRehearsalBlock({ blockType, blockIndex: index });
      applyAllocation(result.data);
      return result.data;
    },
    [applyAllocation]
  );

  // Serialized allocation queue — the one-thumb path (design §6.1). Each tap is
  // accepted instantly (optimistic `pending` bump) and drained one at a time in
  // the background, so the grid never freezes for a round-trip. Strictly
  // sequential: the server validates blockIndex against the live blocksUsed, so
  // only one allocate is ever in flight and the index advances from each
  // server confirmation (not from React state, which lags the loop). A rejected
  // block clears the rest of the optimistic queue and resyncs to the truth.
  const allocateRef = useRef(allocate);
  allocateRef.current = allocate;

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      // Seed the index from the confirmed count at drain start; advance it from
      // each server response so queued blocks get consecutive indices even
      // though React's `data` hasn't re-rendered between iterations.
      let nextIndex = dataRef.current?.state?.today?.blocksUsed ?? 0;
      while (queueRef.current.length > 0) {
        const blockType = queueRef.current[0];
        try {
          const payload = await allocateRef.current(blockType, nextIndex);
          nextIndex =
            typeof payload.today?.blocksUsed === 'number'
              ? payload.today.blocksUsed
              : nextIndex + 1;
        } catch (err) {
          queueRef.current = [];
          setPending({});
          // Resync first (reload clears `error` on entry), then surface the
          // bounce reason so it survives the refetch and stays visible.
          await reload();
          setError(err?.message || 'Could not allocate that block.');
          return;
        }
        queueRef.current.shift();
        setPending((prev) => {
          const next = { ...prev };
          if (next[blockType] > 1) next[blockType] -= 1;
          else delete next[blockType];
          return next;
        });
      }
    } finally {
      drainingRef.current = false;
    }
  }, [reload]);

  const queueAllocate = useCallback(
    (blockType) => {
      queueRef.current.push(blockType);
      setPending((prev) => ({ ...prev, [blockType]: (prev[blockType] || 0) + 1 }));
      drainQueue();
    },
    [drainQueue]
  );

  const declareRestDay = useCallback(async () => {
    await setPodiumRestDay();
    await reload();
  }, [reload]);

  const register = useCallback(
    async (payload) => {
      const result = await registerPodiumCorps(payload);
      await reload();
      return result.data;
    },
    [reload]
  );

  // Between-seasons funding preview: what next season's carried staff will
  // cost vs. the CC the director can commit (design §5.6). Fetched on demand
  // by the registration screen, not part of the main state load.
  const loadRegistrationPreview = useCallback(async () => {
    const result = await getPodiumRegistrationPreview();
    return result.data;
  }, []);

  const selectShows = useCallback(
    async (week, shows) => {
      const result = await setPodiumShows({ week, shows });
      await reload();
      return result.data;
    },
    [reload]
  );

  const setFoodPlan = useCallback(
    async (tier) => {
      const result = await setPodiumFoodPlan({ tier });
      await reload();
      return result.data;
    },
    [reload]
  );

  // Book / cancel airfare on an upcoming show leg (design §5.3). Reversible and
  // free until the nightly processor prices it against the realized leg.
  const setAirfare = useCallback(
    async (day, fly) => {
      const result = await setPodiumAirfare({ day, fly });
      await reload();
      return result.data;
    },
    [reload]
  );

  const savePlanTemplate = useCallback(
    async (blocks, planType = 'rehearsal') => {
      const result = await setPodiumPlanTemplate({ blocks, planType });
      await reload();
      return result.data;
    },
    [reload]
  );

  const commitBudget = useCallback(
    async (amount) => {
      const result = await commitPodiumBudget({ amount });
      await reload();
      return result.data;
    },
    [reload]
  );

  const hireClinician = useCallback(
    async (block) => {
      const result = await hirePodiumClinician({ block });
      await reload();
      return result.data;
    },
    [reload]
  );

  const acknowledgeStaffOutlook = useCallback(async () => {
    const result = await acknowledgePodiumStaffOutlook();
    await reload();
    return result.data;
  }, [reload]);

  // Retire the active corps (banks the lineage; recoverable via un-retire). The
  // caller confirms first — this is a status change.
  const retireCorps = useCallback(async () => {
    const result = await retirePodiumCorps({ confirm: true });
    await reload();
    return result.data;
  }, [reload]);

  // Un-retire a banked lineage. Called first without confirm to PREVIEW the
  // resulting status (the "are you sure?" surface), then again with confirm to
  // commit the restore.
  const previewUnretire = useCallback(async (lineageIndex) => {
    const result = await unretirePodiumCorps({ lineageIndex, confirm: false });
    return result.data;
  }, []);

  const unretireCorps = useCallback(
    async (lineageIndex) => {
      const result = await unretirePodiumCorps({ lineageIndex, confirm: true });
      await reload();
      return result.data;
    },
    [reload]
  );

  return {
    loading,
    error,
    data,
    lastPanel,
    pending,
    reload,
    allocate,
    queueAllocate,
    declareRestDay,
    register,
    loadRegistrationPreview,
    selectShows,
    setFoodPlan,
    setAirfare,
    savePlanTemplate,
    commitBudget,
    hireClinician,
    acknowledgeStaffOutlook,
    retireCorps,
    previewUnretire,
    unretireCorps,
  };
}
