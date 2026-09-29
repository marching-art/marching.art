// The Admin console's shared context object, its hook, and the pure helpers
// derived from it. The provider component lives in AdminContext.tsx (kept
// apart so that file exports only components, for fast refresh).

import { createContext, useContext } from 'react';
import type { DocumentData } from 'firebase/firestore';
import type { AdminInbox } from '../../api/admin';
import type { AdminJob } from './adminJobs';
import type { AdminSectionId } from './adminSections';

export type StatsKey = NonNullable<AdminJob['refreshes']>;

export interface AdminFunctionResult {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface AdminContextValue {
  seasonData: DocumentData | null;
  reloadSeason: () => Promise<void>;
  inbox: AdminInbox | null;
  inboxLoading: boolean;
  refreshInbox: () => Promise<void>;
  /**
   * Call an admin callable by name, toast its message, and reload the season
   * doc (most jobs change it). Toasts and rethrows on failure.
   */
  runAdminFunction: (
    functionName: string,
    data?: Record<string, unknown>
  ) => Promise<AdminFunctionResult | undefined>;
  /** Confirm and run a registry job through `manualTrigger`. Resolves true on success. */
  runJob: (job: AdminJob) => Promise<boolean>;
  runningJob: string | null;
  statsVersion: Record<StatsKey, number>;
  bumpStats: (key: StatsKey) => void;
  goTo: (section: AdminSectionId) => void;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside <AdminProvider>');
  return value;
}

/** Nav badge counts derived from the inbox. */
export function inboxBadges(inbox: AdminInbox | null): Record<string, number> {
  if (!inbox) return {};
  const unhealthy = inbox.health.unhealthyRuns?.length ?? 0;
  const canaryDown = inbox.health.scrapeCanary && !inbox.health.scrapeCanary.healthy ? 1 : 0;
  return {
    moderation: inbox.queues.reports + inbox.queues.comments,
    newsroom: inbox.queues.submissions,
    health: unhealthy + canaryDown,
  };
}
