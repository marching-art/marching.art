// Shared state for the Admin console: the active season doc, the home inbox
// (queue counts that drive the nav badges), a generic admin-callable runner,
// and per-dashboard refresh counters so a "Refresh X" job reloads the panel
// that renders X. Provided once by pages/Admin; sections read it through
// useAdmin (adminContextCore.ts).

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import type { DocumentData } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { functions } from '../../api/client';
import type { AdminInbox } from '../../api/admin';
import { AdminContext } from './adminContextCore';
import type { AdminContextValue, AdminFunctionResult, StatsKey } from './adminContextCore';
import type { AdminSectionId } from './adminSections';

interface AdminProviderProps {
  seasonData: DocumentData | null;
  reloadSeason: () => Promise<void>;
  inbox: AdminInbox | null;
  inboxLoading: boolean;
  refreshInbox: () => Promise<void>;
  goTo: (section: AdminSectionId) => void;
  children: ReactNode;
}

export function AdminProvider({
  seasonData,
  reloadSeason,
  inbox,
  inboxLoading,
  refreshInbox,
  goTo,
  children,
}: AdminProviderProps) {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [statsVersion, setStatsVersion] = useState<Record<StatsKey, number>>({
    economy: 0,
    retention: 0,
    integrity: 0,
    canary: 0,
  });

  const bumpStats = useCallback((key: StatsKey) => {
    setStatsVersion((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  }, []);

  const runAdminFunction = useCallback<AdminContextValue['runAdminFunction']>(
    async (functionName, data = {}) => {
      try {
        // The function name is chosen at runtime, so this stays on a raw
        // callable rather than a static api/functions export.
        const callable = httpsCallable<Record<string, unknown>, AdminFunctionResult>(
          functions,
          functionName
        );
        const result = await callable(data);
        const payload = result.data ?? undefined;
        if (payload?.success === false) toast.error(payload.message || 'Completed with problems');
        else toast.success(payload?.message || 'Operation completed');
        await reloadSeason();
        return payload;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to execute ${functionName}`);
        throw error;
      }
    },
    [reloadSeason]
  );

  const runJob = useCallback<AdminContextValue['runJob']>(
    async (job) => {
      const prompt = job.caution
        ? `Run ${job.name}?\n\n${job.description}\n\nThis changes player-visible data.`
        : `Run ${job.name}?`;
      if (!window.confirm(prompt)) return false;
      setRunningJob(job.id);
      try {
        await runAdminFunction('manualTrigger', { jobName: job.id });
        if (job.refreshes) bumpStats(job.refreshes);
        if (job.refreshes === 'canary') await refreshInbox();
        return true;
      } catch {
        return false;
      } finally {
        setRunningJob(null);
      }
    },
    [runAdminFunction, bumpStats, refreshInbox]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      seasonData,
      reloadSeason,
      inbox,
      inboxLoading,
      refreshInbox,
      runAdminFunction,
      runJob,
      runningJob,
      statsVersion,
      bumpStats,
      goTo,
    }),
    [
      seasonData,
      reloadSeason,
      inbox,
      inboxLoading,
      refreshInbox,
      runAdminFunction,
      runJob,
      runningJob,
      statsVersion,
      bumpStats,
      goTo,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
