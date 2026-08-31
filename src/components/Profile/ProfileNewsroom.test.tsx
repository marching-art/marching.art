import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ProfileNewsroom from './ProfileNewsroom';

// Mock the whole api module so its Firebase-client import never loads in tests.
vi.mock('../../api/directorArticles', () => ({ getDirectorArticles: vi.fn() }));
vi.mock('../../api/articleAdmin', () => ({ getMyNewsSubmissions: vi.fn() }));
import { getDirectorArticles } from '../../api/directorArticles';
import { getMyNewsSubmissions, type MyNewsSubmission } from '../../api/articleAdmin';

const mockGetDirectorArticles = vi.mocked(getDirectorArticles);
const mockGetMyNewsSubmissions = vi.mocked(getMyNewsSubmissions);

function mockSubmissions(submissions: MyNewsSubmission[]) {
  mockGetMyNewsSubmissions.mockResolvedValue({
    data: { success: true, submissions },
  } as Awaited<ReturnType<typeof getMyNewsSubmissions>>);
}

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProfileNewsroom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmissions([]);
  });

  it('lists a director’s published articles, linking to each', async () => {
    mockGetDirectorArticles.mockResolvedValue([
      {
        id: 's_day_3_press_x',
        headline: 'Aurora unveils its 2026 production',
        summary: 'A bold reveal.',
        category: 'press',
        createdAt: '2026-08-11T18:00:00.000Z',
        imageUrl: null,
        corpsName: 'Aurora',
      },
    ]);

    renderWithProviders(<ProfileNewsroom uid="u1" />);

    const link = await screen.findByRole('link', { name: /Aurora unveils its 2026 production/i });
    expect(link).toHaveAttribute('href', '/article/s_day_3_press_x');
    expect(screen.getByText('PRESS RELEASE')).toBeInTheDocument();
  });

  it('shows a prompt on your own empty newsroom', async () => {
    mockGetDirectorArticles.mockResolvedValue([]);
    renderWithProviders(<ProfileNewsroom uid="u1" isOwnProfile />);
    expect(await screen.findByText(/Press releases you publish/i)).toBeInTheDocument();
  });

  it('renders nothing on someone else’s empty newsroom', async () => {
    mockGetDirectorArticles.mockResolvedValue([]);
    const { container } = renderWithProviders(<ProfileNewsroom uid="u2" isOwnProfile={false} />);
    // Give the query a tick to resolve, then assert nothing rendered.
    await Promise.resolve();
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing without a uid', () => {
    mockGetDirectorArticles.mockResolvedValue([]);
    const { container } = renderWithProviders(<ProfileNewsroom uid={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(mockGetDirectorArticles).not.toHaveBeenCalled();
  });

  it('shows a queued press release under "In review" instead of the first-time prompt', async () => {
    mockGetDirectorArticles.mockResolvedValue([]);
    mockSubmissions([
      {
        id: 'sub-1',
        kind: 'press_release',
        status: 'pending',
        headline: 'Aurora Announces 2026 Program',
        summary: 'The reveal.',
        category: 'press',
        corpsName: 'Aurora',
        createdAt: '2026-08-30T12:00:00.000Z',
        scheduledPublishAt: null,
        rejectionReason: null,
      },
    ]);

    renderWithProviders(<ProfileNewsroom uid="u1" isOwnProfile />);

    expect(await screen.findByText('Aurora Announces 2026 Program')).toBeInTheDocument();
    // Appears as both the section header and the item's status badge.
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    expect(screen.getByText(/Waiting for an admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/Press releases you publish/i)).not.toBeInTheDocument();
  });

  it('shows the rejection reason on a rejected submission', async () => {
    mockGetDirectorArticles.mockResolvedValue([]);
    mockSubmissions([
      {
        id: 'sub-2',
        kind: 'news',
        status: 'rejected',
        headline: 'Circuit Week 6 Analysis',
        summary: 'Who moved and why.',
        category: 'fantasy',
        corpsName: null,
        createdAt: '2026-08-29T15:00:00.000Z',
        scheduledPublishAt: null,
        rejectionReason: 'Needs sources',
      },
    ]);

    renderWithProviders(<ProfileNewsroom uid="u1" isOwnProfile />);

    expect(await screen.findByText('Not approved')).toBeInTheDocument();
    expect(screen.getByText('Needs sources')).toBeInTheDocument();
  });

  it('never fetches submissions on someone else’s profile', async () => {
    mockGetDirectorArticles.mockResolvedValue([
      {
        id: 's_day_3_press_x',
        headline: 'Aurora unveils its 2026 production',
        summary: 'A bold reveal.',
        category: 'press',
        createdAt: '2026-08-11T18:00:00.000Z',
        imageUrl: null,
        corpsName: 'Aurora',
      },
    ]);

    renderWithProviders(<ProfileNewsroom uid="u2" isOwnProfile={false} />);

    await screen.findByRole('link', { name: /Aurora unveils its 2026 production/i });
    expect(mockGetMyNewsSubmissions).not.toHaveBeenCalled();
  });
});
