import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ProfileNewsroom from './ProfileNewsroom';

// Mock the whole api module so its Firebase-client import never loads in tests.
vi.mock('../../api/directorArticles', () => ({ getDirectorArticles: vi.fn() }));
import { getDirectorArticles } from '../../api/directorArticles';

const mockGetDirectorArticles = vi.mocked(getDirectorArticles);

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProfileNewsroom', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
