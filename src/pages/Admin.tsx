// src/pages/Admin.tsx
// =============================================================================
// ADMIN CONSOLE
// =============================================================================
// One management tool organized by domain: Home (what needs attention),
// Moderation, Newsroom, Season & Scoring, Players, Podium, Insights, System.
// The section lives in the URL (`?tab=`) so admin emails and ops alerts deep
// link straight to a panel; legacy tab ids are aliased (adminSections.ts).
// Nav badges come from one getAdminInbox call, refreshed after moderation
// actions and on demand.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DocumentData } from 'firebase/firestore';
import { RefreshCw, Shield } from 'lucide-react';
import { adminHelpers } from '../api';
import { getAdminInbox, getSeasonSettings } from '../api/admin';
import type { AdminInbox } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { formatRelativeTime } from '../utils/notifications';
import {
  ADMIN_SECTIONS,
  getAdminSection,
  resolveAdminSection,
} from '../components/Admin/adminSections';
import type { AdminSection, AdminSectionId } from '../components/Admin/adminSections';
import { AdminProvider } from '../components/Admin/AdminContext';
import { inboxBadges } from '../components/Admin/adminContextCore';
import HomeSection from '../components/Admin/HomeSection';
import {
  InsightsSection,
  ModerationSection,
  NewsroomSection,
  PlayersSection,
  PodiumSection,
  SeasonSection,
  SystemSection,
} from '../components/Admin/AdminSectionViews';

const SECTION_VIEWS: Record<AdminSectionId, ComponentType> = {
  home: HomeSection,
  moderation: ModerationSection,
  newsroom: NewsroomSection,
  season: SeasonSection,
  players: PlayersSection,
  podium: PodiumSection,
  insights: InsightsSection,
  system: SystemSection,
};

/** Deep-link params minted for one panel (SubmissionsManagement's status/submission). */
const PANEL_PARAMS = ['status', 'submission'];

interface NavItemProps {
  section: AdminSection;
  active: boolean;
  badge: number;
  compact?: boolean;
  onSelect: (id: AdminSectionId) => void;
}

function NavItem({ section, active, badge, compact, onSelect }: NavItemProps) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      aria-current={active ? 'page' : undefined}
      title={section.description}
      className={`flex items-center gap-2 text-left transition-colors whitespace-nowrap ${
        compact ? 'px-3 py-1.5 text-[11px] shrink-0' : 'w-full px-3 py-2 text-xs'
      } font-bold ${
        active ? 'bg-interactive text-white' : 'text-muted hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className={compact ? '' : 'flex-1 truncate'}>{section.label}</span>
      {badge > 0 && (
        <span
          aria-label={`${badge} need attention`}
          className={`min-w-[1.25rem] px-1 text-center text-[10px] font-data tabular-nums ${
            active ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

const Admin = () => {
  const user = useAuth()?.user;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seasonData, setSeasonData] = useState<DocumentData | null>(null);
  const [inbox, setInbox] = useState<AdminInbox | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeId = resolveAdminSection(urlTab);
  const active = getAdminSection(activeId);

  const goTo = useCallback(
    (section: AdminSectionId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (section === 'home') next.delete('tab');
          else next.set('tab', section);
          if (section !== resolveAdminSection(prev.get('tab'))) {
            PANEL_PARAMS.forEach((param) => next.delete(param));
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // New section → start at its top (the content pane scrolls, not the window).
  useEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0 });
  }, [activeId]);

  const reloadSeason = useCallback(async () => {
    try {
      setSeasonData(await getSeasonSettings());
    } catch (error) {
      console.error('Error loading season:', error);
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const { data } = await getAdminInbox();
      setInbox(data);
    } catch (error) {
      console.error('Error loading admin inbox:', error);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        if (cancelled) return;
        setIsAdmin(adminStatus);
        if (adminStatus) {
          void reloadSeason();
          void refreshInbox();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadSeason, refreshInbox]);

  if (loading) return <LoadingScreen />;

  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 bg-red-500/20 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm font-bold text-white mb-1">ACCESS DENIED</p>
        <p className="text-xs text-muted">Administrator privileges required</p>
      </div>
    );
  }

  const badges = inboxBadges(inbox);
  const badgeFor = (section: AdminSection) => (section.badge ? badges[section.badge] || 0 : 0);
  const SectionView = SECTION_VIEWS[activeId];
  const ActiveIcon = active.icon;

  return (
    <AdminProvider
      seasonData={seasonData}
      reloadSeason={reloadSeason}
      inbox={inbox}
      inboxLoading={inboxLoading}
      refreshInbox={refreshInbox}
      goTo={goTo}
    >
      <div className="h-full flex flex-col md:flex-row overflow-hidden bg-background">
        {/* Sidebar (md+) */}
        <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-surface-card border-r border-line">
          <div className="px-4 py-4 border-b border-line flex items-center gap-2">
            <div className="w-8 h-8 bg-surface-raised flex items-center justify-center">
              <Shield className="w-4 h-4 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Admin</p>
              <p className="text-[10px] text-muted">marching.art console</p>
            </div>
          </div>
          <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {ADMIN_SECTIONS.map((section) => (
              <NavItem
                key={section.id}
                section={section}
                active={section.id === activeId}
                badge={badgeFor(section)}
                onSelect={goTo}
              />
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Section header */}
          <header className="bg-surface-card border-b border-line px-4 py-3">
            <div className="flex items-start gap-3">
              <ActiveIcon className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold text-white">{active.label}</h1>
                <p className="text-[11px] text-muted leading-snug">{active.description}</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshInbox()}
                disabled={inboxLoading}
                aria-label="Refresh attention counts"
                title={
                  inbox?.checkedAt
                    ? `Counts updated ${formatRelativeTime(inbox.checkedAt)}`
                    : 'Refresh counts'
                }
                className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${inboxLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {inbox?.checkedAt ? formatRelativeTime(inbox.checkedAt) : 'Refresh'}
                </span>
              </button>
            </div>
          </header>

          {/* Section nav (mobile) */}
          <nav
            aria-label="Admin sections"
            className="md:hidden flex gap-1 overflow-x-auto px-2 py-2 bg-surface-card border-b border-line"
          >
            {ADMIN_SECTIONS.map((section) => (
              <NavItem
                key={section.id}
                section={section}
                active={section.id === activeId}
                badge={badgeFor(section)}
                compact
                onSelect={goTo}
              />
            ))}
          </nav>

          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-6"
            role="region"
            aria-label={`${active.label} section`}
          >
            <div className="p-3 md:p-5 max-w-6xl">
              <SectionView />
            </div>
          </div>
        </div>
      </div>
    </AdminProvider>
  );
};

export default Admin;
