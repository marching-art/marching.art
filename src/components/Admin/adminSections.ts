// The Admin panel's information architecture: one section per domain an
// operator manages, each owning its tools, jobs and dashboards. The active
// section lives in the URL (`/admin?tab=moderation`) so admin emails and ops
// alerts can deep link to a panel.
//
// Section ids are part of that URL contract. Ids from the previous tab layout
// (overview, content, submissions, livescores, users, jobs) are aliased so
// already-sent emails keep landing in the right place.

import type { ComponentType } from 'react';
import {
  BarChart3,
  CalendarClock,
  Home,
  Newspaper,
  ShieldAlert,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';

export type AdminSectionId =
  'home' | 'moderation' | 'newsroom' | 'season' | 'players' | 'podium' | 'insights' | 'system';

/** Which live inbox counter a section's nav badge shows. */
export type AdminBadgeKey = 'moderation' | 'newsroom' | 'health';

export interface AdminSection {
  id: AdminSectionId;
  label: string;
  /** One line under the section title, and the nav tooltip. */
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: AdminBadgeKey;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'What needs attention right now, and the state of the game at a glance.',
    icon: Home,
  },
  {
    id: 'moderation',
    label: 'Moderation',
    description: 'Player reports, article comments, Podium staff names and account integrity.',
    icon: ShieldAlert,
    badge: 'moderation',
  },
  {
    id: 'newsroom',
    label: 'Newsroom',
    description: 'Director submissions, published articles and generated news.',
    icon: Newspaper,
    badge: 'newsroom',
  },
  {
    id: 'season',
    label: 'Season & Scoring',
    description:
      'Season lifecycle, nightly scoring, the live DCI feed, schedules and caption values.',
    icon: CalendarClock,
    badge: 'health',
  },
  {
    id: 'players',
    label: 'Players',
    description: 'Directors, roles, corps names, show selections and league activity.',
    icon: Users,
  },
  {
    id: 'podium',
    label: 'Podium',
    description: 'The Podium Division launch flag, funnel telemetry and its nightly stage.',
    icon: Trophy,
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Retention and economy dashboards — read before deciding what to build or price.',
    icon: BarChart3,
  },
  {
    id: 'system',
    label: 'System',
    description: 'Every background job in one searchable list, plus delivery checks.',
    icon: Wrench,
  },
];

const SECTION_IDS: ReadonlySet<string> = new Set(ADMIN_SECTIONS.map((s) => s.id));

/** Tab ids from the previous layout → the section that now owns that work. */
export const LEGACY_TAB_ALIASES: Readonly<Record<string, AdminSectionId>> = {
  overview: 'home',
  content: 'newsroom',
  submissions: 'newsroom',
  livescores: 'season',
  users: 'players',
  jobs: 'system',
};

/** Resolve a `?tab=` value (current or legacy) to a section; unknown → home. */
export function resolveAdminSection(tab: string | null | undefined): AdminSectionId {
  if (!tab) return 'home';
  if (SECTION_IDS.has(tab)) return tab as AdminSectionId;
  return LEGACY_TAB_ALIASES[tab] ?? 'home';
}

export function getAdminSection(id: AdminSectionId): AdminSection {
  return ADMIN_SECTIONS.find((s) => s.id === id) ?? ADMIN_SECTIONS[0];
}
