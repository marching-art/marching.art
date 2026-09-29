import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// The queue talks to two admin callables and reads the shared admin context
// (refreshInbox). Mock the API module, the Firebase client the context imports,
// and toast so nothing real loads.
vi.mock('../../api/client', () => ({ functions: {} }));
vi.mock('../../api/admin', () => ({ listReports: vi.fn(), resolveReport: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { listReports, resolveReport } from '../../api/admin';
import type { PlayerReport } from '../../api/admin';
import { AdminProvider } from './AdminContext';
import ReportsQueue from './ReportsQueue';

const mockList = vi.mocked(listReports);
const mockResolve = vi.mocked(resolveReport);
const refreshInbox = vi.fn(async () => undefined);

const report = (over: Partial<PlayerReport> = {}): PlayerReport => ({
  id: 'r1',
  source: 'reports',
  type: 'league_message',
  status: 'new',
  reason: 'spam links',
  text: 'buy cheap valve oil',
  contentId: 'm1',
  authorUid: 'author',
  authorName: 'loudhorn',
  reporterUid: 'reporter',
  reporterName: 'Quiet Snare',
  context: { leagueId: 'L1', leagueName: 'Drum Line' },
  contentLive: true,
  createdAt: new Date().toISOString(),
  resolution: null,
  adminNote: null,
  resolvedAt: null,
  resolvedBy: null,
  ...over,
});

const listResult = (reports: PlayerReport[]) =>
  ({
    data: {
      success: true,
      reports,
      hasMore: false,
      counts: { new: reports.length, reviewed: 0, resolved: 0 },
    },
  }) as never;

function wrap(children: ReactNode) {
  return (
    <MemoryRouter>
      <AdminProvider
        seasonData={null}
        reloadSeason={async () => undefined}
        inbox={null}
        inboxLoading={false}
        refreshInbox={refreshInbox}
        goTo={() => undefined}
      >
        {children}
      </AdminProvider>
    </MemoryRouter>
  );
}

describe('ReportsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders a report with its context link and counts', async () => {
    mockList.mockResolvedValue(listResult([report()]));
    render(wrap(<ReportsQueue />));
    expect(await screen.findByText('buy cheap valve oil')).toBeInTheDocument();
    expect(screen.getByText('loudhorn')).toBeInTheDocument();
    expect(screen.getByText('Quiet Snare')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Drum Line' })).toHaveAttribute(
      'href',
      '/leagues/L1/chat'
    );
    expect(screen.getByRole('tab', { name: /^New\s*1$/ })).toHaveAttribute('aria-selected', 'true');
    expect(mockList).toHaveBeenCalledWith({ status: 'new', type: 'all', limit: 50 });
  });

  it('shows the empty state', async () => {
    mockList.mockResolvedValue(listResult([]));
    render(wrap(<ReportsQueue />));
    expect(await screen.findByText(/No new reports/)).toBeInTheDocument();
  });

  it('dismisses with a note and drops the row from the New view', async () => {
    mockList.mockResolvedValue(listResult([report()]));
    mockResolve.mockResolvedValue({
      data: {
        success: true,
        status: 'resolved',
        resolution: 'no_action',
        contentRemoved: false,
        siblingsResolved: 0,
      },
    } as never);
    render(wrap(<ReportsQueue />));
    await screen.findByText('buy cheap valve oil');
    fireEvent.change(screen.getByLabelText('Moderator note'), { target: { value: 'banter' } });
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith({
        reportId: 'r1',
        source: 'reports',
        status: 'resolved',
        note: 'banter',
      })
    );
    await waitFor(() => expect(screen.queryByText('buy cheap valve oil')).not.toBeInTheDocument());
    expect(refreshInbox).toHaveBeenCalled();
  });

  it('removes content only after confirmation', async () => {
    mockList.mockResolvedValue(listResult([report()]));
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    render(wrap(<ReportsQueue />));
    await screen.findByText('buy cheap valve oil');
    fireEvent.click(screen.getByRole('button', { name: /Remove content/ }));
    expect(mockResolve).not.toHaveBeenCalled();

    mockResolve.mockResolvedValue({
      data: {
        success: true,
        status: 'resolved',
        resolution: 'content_removed',
        contentRemoved: true,
        siblingsResolved: 0,
      },
    } as never);
    fireEvent.click(screen.getByRole('button', { name: /Remove content/ }));
    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith({
        reportId: 'r1',
        source: 'reports',
        removeContent: true,
      })
    );
  });

  it('offers Reopen on resolved reports and hides Remove for removed content', async () => {
    mockList.mockResolvedValue(
      listResult([
        report({ status: 'resolved', resolution: 'content_removed', contentLive: false }),
      ])
    );
    render(wrap(<ReportsQueue />));
    expect(await screen.findByRole('button', { name: /Reopen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove content/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Content removed/)).toBeInTheDocument();
  });
});
