import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'viewer-uid' } }),
}));
// The Brief card has its own test (DesignBriefCard.test.tsx); stubbing it
// keeps this file about the gallery.
vi.mock('../components/uniform/DesignBriefCard', () => ({ default: () => null }));
vi.mock('../components/uniform/ShowcaseCard', () => ({ default: () => null }));
vi.mock('../api/designExchange', () => ({
  listExchange: vi.fn(),
  fetchMyLikes: vi.fn().mockResolvedValue(new Set()),
  likeExchangeDesign: vi.fn().mockResolvedValue({ data: { liked: true } }),
  saveExchangeDesign: vi.fn().mockResolvedValue({
    data: { designId: 'copy1', message: 'Saved to your wardrobe — design by MaestroMax.' },
  }),
  reportExchangeDesign: vi.fn(),
  unpublishUniformDesign: vi.fn(),
}));

import Exchange from './Exchange';
import { listExchange, likeExchangeDesign, saveExchangeDesign } from '../api/designExchange';

const ENTRY = {
  id: 'creator_d1',
  design: {
    schema: 2 as const,
    name: 'Finals Look',
    colorway: {
      primary: '#6d1a26',
      secondary: '#d9a41c',
      accent: '#ece2cc',
      metal: 'gold' as const,
    },
    figure: { skin: '#c9a074', jacket: '#6d1a26' },
  },
  designName: 'Finals Look',
  creatorUid: 'creator',
  creatorName: 'MaestroMax',
  likes: 4,
  saves: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function renderExchange() {
  return render(
    <MemoryRouter initialEntries={['/exchange']}>
      <Exchange />
    </MemoryRouter>
  );
}

describe('Exchange page', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders gallery entries with attribution and counters', async () => {
    vi.mocked(listExchange).mockResolvedValue([ENTRY]);
    renderExchange();
    expect(await screen.findByText('Finals Look')).toBeInTheDocument();
    expect(screen.getByText('by MaestroMax')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save · 2/ })).toBeInTheDocument();
    // the design itself renders as the figure svg
    expect(screen.getByRole('img', { name: 'Finals Look design' })).toBeInTheDocument();
  });

  it('likes optimistically and saves a copy through the callable', async () => {
    vi.mocked(listExchange).mockResolvedValue([ENTRY]);
    renderExchange();
    const like = await screen.findByRole('button', { name: /4/ });
    fireEvent.click(like);
    await waitFor(() =>
      expect(likeExchangeDesign).toHaveBeenCalledWith({ entryId: 'creator_d1', liked: true })
    );
    expect(screen.getByRole('button', { name: /5/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save · 2/ }));
    await waitFor(() => expect(saveExchangeDesign).toHaveBeenCalledWith({ entryId: 'creator_d1' }));
    expect(await screen.findByRole('button', { name: /Save · 3/ })).toBeInTheDocument();
  });

  it('shows the empty state with a path to the Studio', async () => {
    vi.mocked(listExchange).mockResolvedValue([]);
    renderExchange();
    expect(await screen.findByText(/be the first/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the Studio/i })).toHaveAttribute(
      'href',
      '/studio'
    );
  });
});
