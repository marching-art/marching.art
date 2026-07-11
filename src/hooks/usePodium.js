/**
 * Podium Class state + actions hook (Phase 2).
 *
 * Loads podium/state through the getPodiumState callable (the subcollection
 * is owner-read via rules, but the callable also derives the server's day
 * context — the client never trusts its own clock for "today").
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getPodiumState,
  allocateRehearsalBlock,
  setPodiumRestDay,
  registerPodiumCorps,
  setPodiumShows,
  setPodiumFoodPlan,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
} from '../api/podium';

export function usePodium(enabled) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // PodiumStateResponse
  const [lastPanel, setLastPanel] = useState(null); // most recent Action Complete panel

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPodiumState();
      setData(result.data);
    } catch (err) {
      setError(err?.message || 'Failed to load Podium state.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  const allocate = useCallback(
    async (blockType) => {
      const blockIndex = data?.state?.today?.blocksUsed ?? undefined;
      const result = await allocateRehearsalBlock({ blockType, blockIndex });
      const payload = result.data;
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
            }
          : previous
      );
      return payload;
    },
    [data]
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

  const savePlanTemplate = useCallback(
    async (blocks) => {
      const result = await setPodiumPlanTemplate({ blocks });
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

  return {
    loading,
    error,
    data,
    lastPanel,
    reload,
    allocate,
    declareRestDay,
    register,
    selectShows,
    setFoodPlan,
    savePlanTemplate,
    commitBudget,
    hireClinician,
  };
}
