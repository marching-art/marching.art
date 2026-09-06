// The Admin panel's top-level tabs. Shared by the NavTabs segmented control
// (AdminUI.jsx) and pages/Admin.jsx, which keeps the active tab in the URL
// (`/admin?tab=content`) so admin emails can deep link to a panel.

export interface AdminTab {
  id: string;
  label: string;
}

export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'season', label: 'Season Ops' },
  { id: 'livescores', label: 'Live Scores' },
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Content' },
  { id: 'jobs', label: 'Jobs' },
];

/** Tab ids NavTabs renders; any other `?tab=` value should fall back to overview. */
export const ADMIN_TAB_IDS: ReadonlySet<string> = new Set(ADMIN_TABS.map((tab) => tab.id));
