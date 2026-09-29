// The Admin console's domain sections (Home lives in HomeSection.tsx). Each
// section opens with a jump bar to its panels, then lays out the queues,
// tools, dashboards and jobs that belong to that domain — so an operator goes
// to where the work is, not to a tab named after how it was built.

import type { ReactNode } from 'react';
import {
  Calculator,
  CalendarClock,
  FileText,
  Inbox,
  MessageSquare,
  Table2,
  UserRoundPen,
} from 'lucide-react';
import {
  ArticleManagement,
  CommentsModeration,
  CorpsValuesEditor,
  ScoresSpreadsheet,
  StaffNamesModeration,
  SubmissionsManagement,
} from './index';
import IntegrityPanel from './IntegrityPanel';
import LiveScoresTab from './LiveScoresTab';
import UsersTab from './UsersTab';
import ReportsQueue from './ReportsQueue';
import JobList from './JobList';
import { JumpBar, Panel } from './AdminUI';
import type { JumpLink } from './AdminUI';
import { useAdmin } from './adminContextCore';
import { EconomyPanel, RefreshStatsButton, RetentionPanel } from './InsightsPanels';
import { PodiumFunnelPanel, PodiumLaunchPanel } from './PodiumPanels';
import {
  DuplicateSweepPanel,
  FinalsDateOverridePanel,
  NewsGenerationPanel,
  RescoreDayPanel,
  SeasonLifecyclePanel,
  SeasonSummaryPanel,
  TestEmailPanel,
} from './AdminTools';

const SectionBody = ({ links, children }: { links?: JumpLink[]; children: ReactNode }) => (
  <div className="space-y-4">
    {links && links.length > 1 && <JumpBar links={links} />}
    {children}
  </div>
);

// =============================================================================
// MODERATION
// =============================================================================

export function ModerationSection() {
  const { statsVersion } = useAdmin();
  return (
    <SectionBody
      links={[
        { id: 'mod-reports', label: 'Reports' },
        { id: 'mod-comments', label: 'Article comments' },
        { id: 'mod-staff', label: 'Staff names' },
        { id: 'mod-integrity', label: 'Integrity' },
      ]}
    >
      <ReportsQueue id="mod-reports" />
      <Panel
        id="mod-comments"
        title="Article Comments"
        icon={MessageSquare}
        description="Comments held for approval, plus approved, rejected and hidden history. Approving or hiding a comment also answers every report filed on it."
      >
        <CommentsModeration />
      </Panel>
      <Panel
        id="mod-staff"
        title="Podium Staff Names"
        icon={UserRoundPen}
        description="The game-wide staff-name registry, with strike and revoke controls."
      >
        <StaffNamesModeration />
      </Panel>
      <IntegrityPanel
        id="mod-integrity"
        refreshKey={statsVersion.integrity}
        headerActions={<RefreshStatsButton jobId="updateIntegrityStats" />}
      />
    </SectionBody>
  );
}

// =============================================================================
// NEWSROOM
// =============================================================================

export function NewsroomSection() {
  return (
    <SectionBody
      links={[
        { id: 'news-submissions', label: 'Submissions' },
        { id: 'news-articles', label: 'Articles' },
        { id: 'news-generate', label: 'Generate news' },
        { id: 'news-summary', label: 'Season summary' },
      ]}
    >
      <Panel
        id="news-submissions"
        title="Director Submissions"
        icon={Inbox}
        description="Articles and press releases directors submitted for editorial review."
      >
        <SubmissionsManagement />
      </Panel>
      <Panel
        id="news-articles"
        title="Published Articles"
        icon={FileText}
        description="Edit, archive or reorder articles already on the news hub."
      >
        <ArticleManagement />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <NewsGenerationPanel id="news-generate" />
        <SeasonSummaryPanel id="news-summary" />
      </div>
    </SectionBody>
  );
}

// =============================================================================
// SEASON & SCORING
// =============================================================================

export function SeasonSection() {
  return (
    <SectionBody
      links={[
        { id: 'season-jobs', label: 'Scoring & schedule' },
        { id: 'season-rescore', label: 'Re-score a day' },
        { id: 'live-feed', label: 'Live DCI feed' },
        { id: 'season-values', label: 'Caption values' },
        { id: 'season-reference', label: 'Scores reference' },
        { id: 'season-finals', label: 'Finals date' },
        { id: 'season-lifecycle', label: 'Lifecycle' },
      ]}
    >
      <JobList
        id="season-jobs"
        domain="season"
        title="Scoring & Schedule Jobs"
        icon={CalendarClock}
        description="Nightly jobs are lease-guarded: running one for a day that already scored is a no-op. Warning-marked jobs change player-visible data."
      />
      <RescoreDayPanel id="season-rescore" />
      <LiveScoresTab />
      <Panel
        id="season-values"
        title="Corps Point Values"
        icon={Calculator}
        description="The caption prices directors draft against this season."
      >
        <CorpsValuesEditor />
      </Panel>
      <Panel
        id="season-reference"
        title="Scores Reference"
        icon={Table2}
        description="Prior-year scores for the selectable corps pool."
      >
        <ScoresSpreadsheet />
      </Panel>
      <FinalsDateOverridePanel id="season-finals" />
      <SeasonLifecyclePanel id="season-lifecycle" />
    </SectionBody>
  );
}

// =============================================================================
// PLAYERS
// =============================================================================

export function PlayersSection() {
  return (
    <SectionBody
      links={[
        { id: 'players-directory', label: 'Directors' },
        { id: 'players-jobs', label: 'Selections & leagues' },
        { id: 'players-duplicates', label: 'Duplicate names' },
      ]}
    >
      <div id="players-directory" className="scroll-mt-4">
        <UsersTab />
      </div>
      <JobList
        id="players-jobs"
        domain="players"
        title="Show Selections & Leagues"
        description="Audit first — it changes nothing — then repair if the audit finds stale picks."
      />
      <DuplicateSweepPanel id="players-duplicates" />
    </SectionBody>
  );
}

// =============================================================================
// PODIUM
// =============================================================================

export function PodiumSection() {
  return (
    <SectionBody>
      <PodiumLaunchPanel />
      <PodiumFunnelPanel />
      <JobList domain="podium" title="Podium Jobs" />
    </SectionBody>
  );
}

// =============================================================================
// INSIGHTS
// =============================================================================

export function InsightsSection() {
  return (
    <SectionBody>
      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <RetentionPanel />
        <EconomyPanel />
      </div>
    </SectionBody>
  );
}

// =============================================================================
// SYSTEM
// =============================================================================

export function SystemSection() {
  return (
    <SectionBody>
      <JobList description="Every background job the console can run, grouped by the section that owns it. Warning-marked jobs change player-visible data." />
      <TestEmailPanel />
    </SectionBody>
  );
}
