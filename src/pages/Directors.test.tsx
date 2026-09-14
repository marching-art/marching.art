import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-bob' } }),
}));
vi.mock('../api/directors', () => ({
  listDirectors: vi.fn(),
}));

import Directors from './Directors';
import { listDirectors, type DirectorSearchEntry } from '../api/directors';
import { filterDirectors, matchesDirector, toDirectorQuery } from '../utils/directorSearch';

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
const BOB = entry({ uid: 'u-bob', username: 'Bob', displayName: 'Robert' });

const mocked = vi.mocked(listDirectors);
const directory = (directors: DirectorSearchEntry[]) =>
  ({ data: { directors, total: directors.length, truncated: false } }) as Awaited<
    ReturnType<typeof listDirectors>
  >;

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

describe('directorSearch utils', () => {
  it('normalizes a typed handle', () => {
    expect(toDirectorQuery('  @MaestroMax ')).toBe('maestromax');
    expect(toDirectorQuery('')).toBe('');
  });

  it('matches username, display name and corps names, case-insensitively', () => {
    expect(matchesDirector(ALICE, 'ali')).toBe(true);
    expect(matchesDirector(ALICE, 'alice a')).toBe(true);
    expect(matchesDirector(ALICE, 'horizon')).toBe(true);
    expect(matchesDirector(ALICE, 'granite')).toBe(true);
    expect(matchesDirector(ALICE, 'zed')).toBe(false);
    expect(matchesDirector(ALICE, '')).toBe(true);
  });

  it('filterDirectors keeps order and returns the input untouched for a blank search', () => {
    const list = [ALICE, BOB];
    expect(filterDirectors(list, '  ')).toBe(list);
    expect(filterDirectors([ALICE, BOB], '@bob')).toEqual([BOB]);
    expect(filterDirectors([ALICE, BOB], 'ROBERT')).toEqual([BOB]);
  });
});

describe('Directors page', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists every director on load and links each row to the profile', async () => {
    mocked.mockResolvedValueOnce(directory([ALICE, BOB]));
    renderDirectors();

    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
    expect(mocked).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole('link', { name: /Robert/ })).toHaveTextContent('You');
  });

  it('filters locally as you type, by name or corps, without another call', async () => {
    mocked.mockResolvedValueOnce(directory([ALICE, BOB]));
    renderDirectors();
    await screen.findByText('Alice A.');

    const box = screen.getByRole('searchbox', { name: 'Search directors' });
    fireEvent.change(box, { target: { value: 'horizon' } });
    expect(screen.getByText('Alice A.')).toBeInTheDocument();
    expect(screen.queryByText('Robert')).not.toBeInTheDocument();

    fireEvent.change(box, { target: { value: '@Zed' } });
    expect(screen.getByText(/No director matches/)).toBeInTheDocument();
    expect(screen.getByText('“@Zed”')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Robert')).toBeInTheDocument();
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the callable fails', async () => {
    mocked.mockRejectedValueOnce(new Error('boom'));
    mocked.mockResolvedValueOnce(directory([ALICE]));
    renderDirectors();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
  });
});
