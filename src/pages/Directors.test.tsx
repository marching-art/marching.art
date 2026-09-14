import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-bob' } }),
}));
vi.mock('../api/directors', () => ({
  searchDirectors: vi.fn(),
}));

import Directors from './Directors';
import { searchDirectors, type DirectorSearchEntry } from '../api/directors';
import { toDirectorQuery } from '../utils/directorSearch';

const entry = (overrides: Partial<DirectorSearchEntry>): DirectorSearchEntry => ({
  uid: 'u-x',
  username: 'x',
  displayName: 'X',
  photoURL: null,
  xpLevel: 1,
  userTitle: '',
  location: '',
  seasonsPlayed: 0,
  corps: [],
  ...overrides,
});

const ALICE = entry({
  uid: 'u-alice',
  username: 'Alice',
  displayName: 'Alice A.',
  xpLevel: 7,
  userTitle: 'Field Marshal',
  location: 'Denver, CO',
  seasonsPlayed: 3,
  corps: [
    { classKey: 'worldClass', corpsName: 'Blue Horizon' },
    { classKey: 'podiumClass', corpsName: 'Granite Line' },
  ],
});
const BOB = entry({ uid: 'u-bob', username: 'Bob', displayName: 'Bob' });

const mockedSearch = vi.mocked(searchDirectors);
const page = (directors: DirectorSearchEntry[], nextCursor: string | null = null) =>
  ({ data: { directors, nextCursor } }) as Awaited<ReturnType<typeof searchDirectors>>;

function renderDirectors() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/directors']}>
        <Directors />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('toDirectorQuery', () => {
  it('normalizes the way the server matches', () => {
    expect(toDirectorQuery('  @MaestroMax ')).toBe('maestromax');
    expect(toDirectorQuery('')).toBe('');
  });
});

describe('Directors page', () => {
  afterEach(() => vi.clearAllMocks());

  it('browses the directory on load and links each row to the profile', async () => {
    mockedSearch.mockResolvedValueOnce(page([ALICE, BOB]));
    renderDirectors();

    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenCalledWith({ query: '', cursor: null, limit: 25 });
    expect(screen.getByRole('link', { name: /Alice A\./ })).toHaveAttribute(
      'href',
      '/profile/u-alice'
    );
    expect(screen.getByText('@Alice')).toBeInTheDocument();
    expect(screen.getByText('Field Marshal')).toBeInTheDocument();
    expect(screen.getByText('Blue Horizon')).toBeInTheDocument();
    expect(screen.getByText('Granite Line')).toBeInTheDocument();
    expect(screen.getByText('Podium')).toBeInTheDocument();
    expect(screen.getByText('3 seasons')).toBeInTheDocument();
    // The viewer's own row is tagged.
    expect(screen.getByRole('link', { name: /Bob/ })).toHaveTextContent('You');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('searches by username prefix after a pause and shows the empty state', async () => {
    mockedSearch.mockResolvedValueOnce(page([ALICE, BOB]));
    mockedSearch.mockResolvedValueOnce(page([]));
    renderDirectors();
    await screen.findByText('Alice A.');

    fireEvent.change(screen.getByRole('searchbox', { name: /Search directors/ }), {
      target: { value: '@Zed' },
    });
    await waitFor(() =>
      expect(mockedSearch).toHaveBeenLastCalledWith({ query: 'zed', cursor: null, limit: 25 })
    );
    expect(await screen.findByText(/No director.s username starts with/)).toBeInTheDocument();
    expect(screen.getByText('“zed”')).toBeInTheDocument();
  });

  it('never sends a query the server would reject', async () => {
    mockedSearch.mockResolvedValueOnce(page([ALICE]));
    renderDirectors();
    await screen.findByText('Alice A.');

    const box = screen.getByRole('searchbox', { name: /Search directors/ });
    fireEvent.change(box, { target: { value: 'a b' } });
    expect(await screen.findByText(/letters, numbers and underscores/)).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it('loads the next page with the server cursor', async () => {
    mockedSearch.mockResolvedValueOnce(page([ALICE], 'alice'));
    mockedSearch.mockResolvedValueOnce(page([BOB]));
    renderDirectors();
    await screen.findByText('Alice A.');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('@Bob')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenLastCalledWith({ query: '', cursor: 'alice', limit: 25 });
    expect(screen.getByText('Alice A.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('offers a retry when the callable fails', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('boom'));
    mockedSearch.mockResolvedValueOnce(page([ALICE]));
    renderDirectors();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
  });
});
