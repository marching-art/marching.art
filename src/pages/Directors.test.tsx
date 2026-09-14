import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-bob' } }),
}));
vi.mock('../api/directors', () => ({
  DIRECTORY_PAGE_SIZE: 50,
  fetchDirectoryPage: vi.fn(),
  searchDirectory: vi.fn(),
  fetchDirectoryCount: vi.fn(),
}));

import Directors from './Directors';
import {
  fetchDirectoryCount,
  fetchDirectoryPage,
  searchDirectory,
  type DirectorSearchEntry,
} from '../api/directors';
import {
  matchesAllWords,
  queryWords,
  searchTokenFor,
  sortByUsername,
  toDirectorQuery,
} from '../utils/directorSearch';

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
const CAROL = entry({ uid: 'u-carol', username: 'carol', displayName: 'Carol' });

const mockedPage = vi.mocked(fetchDirectoryPage);
const mockedSearch = vi.mocked(searchDirectory);
const mockedCount = vi.mocked(fetchDirectoryCount);
const cursorFor = (uid: string) => ({ id: uid }) as never;

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
  it('normalizes a typed handle and splits words', () => {
    expect(toDirectorQuery('  @MaestroMax ')).toBe('maestromax');
    expect(queryWords('Blue Horizon (2026)')).toEqual(['blue', 'horizon', '2026']);
  });

  it('picks the longest typed word as the index token, truncated to the stored length', () => {
    expect(searchTokenFor('blue horizon')).toBe('horizon');
    expect(searchTokenFor('@Bob')).toBe('bob');
    expect(searchTokenFor('abcdefghijklmnop')).toBe('abcdefghijkl');
    expect(searchTokenFor('j')).toBe('j');
    expect(searchTokenFor('a b')).toBe('');
    expect(searchTokenFor('   ')).toBe('');
  });

  it('checks every typed word as a prefix of some word of the row', () => {
    expect(matchesAllWords(ALICE, ['blue', 'hor'])).toBe(true);
    expect(matchesAllWords(ALICE, ['ali', 'granite'])).toBe(true);
    expect(matchesAllWords(ALICE, ['blue', 'zed'])).toBe(false);
    expect(matchesAllWords(ALICE, [])).toBe(true);
  });

  it('sorts by username case-insensitively without mutating', () => {
    const list = [CAROL, BOB, ALICE];
    expect(sortByUsername(list).map((e) => e.uid)).toEqual(['u-alice', 'u-bob', 'u-carol']);
    expect(list[0]).toBe(CAROL);
  });
});

describe('Directors page', () => {
  afterEach(() => vi.clearAllMocks());

  it('browses the first page, shows the total, and links each row to the profile', async () => {
    mockedPage.mockResolvedValueOnce({ directors: [ALICE, BOB], cursor: null });
    mockedCount.mockResolvedValueOnce(1234);
    renderDirectors();

    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
    expect(mockedPage).toHaveBeenCalledWith(null);
    expect(await screen.findByText('1234')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alice A\./ })).toHaveAttribute(
      'href',
      '/profile/u-alice'
    );
    expect(screen.getByText('@Alice')).toBeInTheDocument();
    expect(screen.getByText('Blue Horizon')).toBeInTheDocument();
    expect(screen.getByText('Granite Line')).toBeInTheDocument();
    expect(screen.getByText('Podium')).toBeInTheDocument();
    expect(screen.getByText('3 seasons')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Robert/ })).toHaveTextContent('You');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('pages with the cursor the previous page returned', async () => {
    mockedPage.mockResolvedValueOnce({ directors: [ALICE], cursor: cursorFor('u-alice') });
    mockedPage.mockResolvedValueOnce({ directors: [BOB], cursor: null });
    mockedCount.mockResolvedValueOnce(2);
    renderDirectors();
    await screen.findByText('Alice A.');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Robert')).toBeInTheDocument();
    expect(mockedPage).toHaveBeenLastCalledWith(cursorFor('u-alice'));
    expect(screen.getByText('Alice A.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('searches with one token after a pause and narrows the page by every typed word', async () => {
    mockedPage.mockResolvedValue({ directors: [ALICE, BOB, CAROL], cursor: null });
    mockedCount.mockResolvedValue(3);
    // The index returns everyone with a word starting "horizon"; a second
    // director shares the corps word but not the other typed word.
    mockedSearch.mockResolvedValueOnce([
      ALICE,
      entry({
        uid: 'u-dan',
        username: 'dan',
        displayName: 'Dan',
        corps: [{ classKey: 'aClass', corpsName: 'Red Horizon' }],
      }),
    ]);
    renderDirectors();
    await screen.findByText('Alice A.');

    const box = screen.getByRole('searchbox', { name: 'Search directors' });
    fireEvent.change(box, { target: { value: 'blue horizon' } });
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('horizon'));
    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
    expect(screen.queryByText('Dan')).not.toBeInTheDocument();
    expect(screen.queryByText('Robert')).not.toBeInTheDocument();
    expect(screen.getByText('Matches')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Robert')).toBeInTheDocument();
  });

  it('asks for more letters instead of querying on a one-letter search', async () => {
    mockedPage.mockResolvedValue({ directors: [ALICE], cursor: null });
    mockedCount.mockResolvedValue(1);
    renderDirectors();
    await screen.findByText('Alice A.');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search directors' }), {
      target: { value: 'a b' },
    });
    expect(await screen.findByText(/Keep typing/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('shows the empty state for a search with no matches', async () => {
    mockedPage.mockResolvedValue({ directors: [ALICE], cursor: null });
    mockedCount.mockResolvedValue(1);
    mockedSearch.mockResolvedValueOnce([]);
    renderDirectors();
    await screen.findByText('Alice A.');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search directors' }), {
      target: { value: '@Zed' },
    });
    expect(await screen.findByText(/No director matches/)).toBeInTheDocument();
    expect(screen.getByText('“@Zed”')).toBeInTheDocument();
  });

  it('offers a retry when the first page fails', async () => {
    mockedPage.mockRejectedValueOnce(new Error('boom'));
    mockedPage.mockResolvedValueOnce({ directors: [ALICE], cursor: null });
    mockedCount.mockResolvedValue(1);
    renderDirectors();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice A.')).toBeInTheDocument();
  });
});
