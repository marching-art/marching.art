import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The page's own job is the shell: admin gate, section routing from ?tab=
// (including legacy aliases), and nav badges from getAdminInbox. The heavy
// section bodies are stubbed.
vi.mock('../api', () => ({ adminHelpers: { isAdmin: vi.fn() } }));
vi.mock('../api/client', () => ({ functions: {} }));
vi.mock('../api/admin', () => ({ getAdminInbox: vi.fn(), getSeasonSettings: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'a1' } }) }));
vi.mock('../components/LoadingScreen', () => ({ default: () => <p>loading</p> }));
vi.mock('../components/Admin/HomeSection', () => ({ default: () => <p>home body</p> }));
vi.mock('../components/Admin/AdminSectionViews', () => ({
  ModerationSection: () => <p>moderation body</p>,
  NewsroomSection: () => <p>newsroom body</p>,
  SeasonSection: () => <p>season body</p>,
  PlayersSection: () => <p>players body</p>,
  PodiumSection: () => <p>podium body</p>,
  InsightsSection: () => <p>insights body</p>,
  SystemSection: () => <p>system body</p>,
}));

import { adminHelpers } from '../api';
import { getAdminInbox, getSeasonSettings } from '../api/admin';
import Admin from './Admin';

const inbox = {
  success: true,
  queues: { submissions: 2, comments: 1, reports: 3, available: true },
  health: { unhealthyRuns: [], scrapeCanary: null },
  checkedAt: new Date().toISOString(),
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="search">{location.search}</p>;
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <>
              <Admin />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('Admin console shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminHelpers.isAdmin).mockResolvedValue(true);
    vi.mocked(getSeasonSettings).mockResolvedValue(null);
    vi.mocked(getAdminInbox).mockResolvedValue({ data: inbox } as never);
  });

  it('denies non-admins', async () => {
    vi.mocked(adminHelpers.isAdmin).mockResolvedValue(false);
    renderAt('/admin');
    expect(await screen.findByText('ACCESS DENIED')).toBeInTheDocument();
    expect(getAdminInbox).not.toHaveBeenCalled();
  });

  it('opens on Home and shows inbox badges on the owning sections', async () => {
    renderAt('/admin');
    expect(await screen.findByText('home body')).toBeInTheDocument();
    // moderation = reports + comments; newsroom = submissions
    expect((await screen.findAllByLabelText('4 need attention')).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('2 need attention').length).toBeGreaterThan(0);
  });

  it('honors legacy email links (?tab=content&status=pending)', async () => {
    renderAt('/admin?tab=content&status=pending');
    expect(await screen.findByText('newsroom body')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Newsroom' })).toBeInTheDocument();
  });

  it('navigates between sections and drops panel-only params', async () => {
    renderAt('/admin?tab=content&status=pending');
    await screen.findByText('newsroom body');
    const [sidebarModeration] = screen.getAllByRole('button', { name: /Moderation/ });
    fireEvent.click(sidebarModeration);
    expect(await screen.findByText('moderation body')).toBeInTheDocument();
    expect(screen.getByTestId('search').textContent).toBe('?tab=moderation');
  });
});
