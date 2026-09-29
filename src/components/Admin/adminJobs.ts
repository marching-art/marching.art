// Every `manualTrigger` job the Admin panel can run, tagged with the section
// that owns it. Each section renders its own jobs next to the dashboards they
// refresh; System lists the whole registry, searchable, so nothing is ever
// hidden. The ids are the backend `jobName` switch cases in
// functions/src/callable/admin.js — add a case there, add a row here.

import type { AdminSectionId } from './adminSections';

export type AdminJobDomain = Exclude<AdminSectionId, 'home' | 'newsroom'>;

export interface AdminJob {
  id: string;
  name: string;
  description: string;
  domain: AdminJobDomain;
  /** Writes player-visible state or re-applies awards: confirm with a warning. */
  caution?: boolean;
  /** Recomputes an `admin-stats/*` dashboard; the owning panel reloads after. */
  refreshes?: 'economy' | 'retention' | 'integrity' | 'canary';
}

export const ADMIN_JOBS: readonly AdminJob[] = [
  // Season & Scoring
  {
    id: 'processAndArchiveOffSeasonScores',
    name: 'Process Off-Season Scores',
    description: "Run tonight's off-season scoring now (lease-guarded: a scored day is skipped).",
    domain: 'season',
  },
  {
    id: 'processLiveSeasonScores',
    name: 'Process Live Season Scores',
    description: "Run tonight's live-season scoring now (lease-guarded: a scored day is skipped).",
    domain: 'season',
  },
  {
    id: 'refreshLiveSeasonSchedule',
    name: 'Refresh Live Schedule',
    description: 'Scrape DCI events and merge new shows, times and lineups into the schedule.',
    domain: 'season',
  },
  {
    id: 'regenerateOffSeasonSchedule',
    name: 'Regenerate Off-Season Schedule',
    description: "Rebuild the current off-season's schedule.",
    domain: 'season',
    caution: true,
  },
  {
    id: 'scrapeCanary',
    name: 'Run Scrape Canary',
    description:
      'Re-check dci.org markup for drift now instead of waiting for the 1 PM ET run — the verification step after a scraper fix.',
    domain: 'season',
    refreshes: 'canary',
  },
  {
    id: 'archiveSeasonResults',
    name: 'Archive Season Results',
    description: 'Archive results and crown champions.',
    domain: 'season',
    caution: true,
  },
  {
    id: 'calculateCorpsStatistics',
    name: 'Calculate Corps Statistics',
    description: 'Recalculate every corps statistic from historical data.',
    domain: 'season',
  },
  {
    id: 'rebuildGameRecords',
    name: 'Rebuild Records Book',
    description: 'Rebuild the all-time records (/records) from every archived recap.',
    domain: 'season',
  },

  // Players
  {
    id: 'auditShowSelections',
    name: 'Audit Show Selections',
    description: "Dry run: report directors' show picks that no longer match the schedule.",
    domain: 'players',
  },
  {
    id: 'repairShowSelections',
    name: 'Repair Show Selections',
    description:
      'Re-match picks to the schedule: rename or move stale entries, remove dead ones to free slots.',
    domain: 'players',
    caution: true,
  },
  {
    id: 'refreshLeagueActivity',
    name: 'Refresh League Activity',
    description:
      'Recompute which league members registered a corps this season (public league discovery filters on it). Runs nightly.',
    domain: 'players',
  },

  // Podium
  {
    id: 'processPodiumStage',
    name: 'Run Podium Stage',
    description: "Run tonight's Podium stage now (flag-gated; a completed day is skipped).",
    domain: 'podium',
  },
  {
    id: 'rebuildPodiumCurves',
    name: 'Rebuild Podium Curves',
    description:
      'Rebuild the scoring envelope from the full historical archive and publish to podium-config/curves. Delete that doc to revert.',
    domain: 'podium',
    caution: true,
  },

  // Insights
  {
    id: 'updateRetentionStats',
    name: 'Refresh Retention Stats',
    description: 'Recompute actives, cohorts and streaks (also nightly, 5 AM ET).',
    domain: 'insights',
    refreshes: 'retention',
  },
  {
    id: 'updateEconomyStats',
    name: 'Refresh Economy Stats',
    description: 'Recompute the mint-vs-sink aggregates (also weekly, Monday).',
    domain: 'insights',
    refreshes: 'economy',
  },

  // Moderation
  {
    id: 'updateIntegrityStats',
    name: 'Refresh Integrity Signals',
    description:
      'Recompute alt-account signals: email clusters, signup bursts, shared identities (also weekly). Detection only.',
    domain: 'moderation',
    refreshes: 'integrity',
  },

  // System — one-off migrations and reference seeding
  {
    id: 'seedDciReference',
    name: 'Seed DCI Reference Data',
    description: 'Write the bundled DCI corps and show reference data to dci-reference/*.',
    domain: 'system',
  },
  {
    id: 'patchChampionshipShows',
    name: 'Patch Championship Shows',
    description: "Migration: flag the active season's championship shows (isChampionship).",
    domain: 'system',
    caution: true,
  },
];

export const jobsForDomain = (domain: AdminJobDomain): AdminJob[] =>
  ADMIN_JOBS.filter((job) => job.domain === domain);
