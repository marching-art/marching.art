import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/designBrief', () => ({
  getDesignBrief: vi.fn(),
  submitDesignBrief: vi.fn(),
}));
vi.mock('../../api/uniformStudio', () => ({
  listWardrobe: vi.fn(),
}));

import DesignBriefCard from './DesignBriefCard';
import { getDesignBrief, submitDesignBrief } from '../../api/designBrief';
import { listWardrobe } from '../../api/uniformStudio';

const BRIEF = {
  weekId: '2026-W35',
  id: 'midnight-classic',
  title: 'Midnight Classic',
  blurb: 'Old-school and dark as the sky.',
  wants: [
    { label: 'A dark palette', points: 25 },
    { label: 'A shako up top', points: 20 },
  ],
};

function renderCard() {
  return render(
    <MemoryRouter>
      <DesignBriefCard uid="viewer-uid" />
    </MemoryRouter>
  );
}

describe('DesignBriefCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders the brief, the rubric, and the leaderboard', async () => {
    vi.mocked(getDesignBrief).mockResolvedValue({
      data: {
        brief: BRIEF,
        myEntry: { username: 'me', designName: 'X', colors: null, score: 45 },
        top: [
          {
            username: 'MaestroMax',
            designName: 'Night Watch',
            colors: ['#101c33', '#d7dde2', '#2f6fd0'],
            score: 85,
          },
        ],
      },
    } as never);
    vi.mocked(listWardrobe).mockResolvedValue([]);
    renderCard();

    expect(await screen.findByText('Midnight Classic')).toBeInTheDocument();
    expect(screen.getByText('A dark palette')).toBeInTheDocument();
    expect(screen.getByText('Your best: 45/100')).toBeInTheDocument();
    expect(screen.getByText('Night Watch')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('submits a wardrobe design and shows the matched/missed rubric', async () => {
    vi.mocked(getDesignBrief).mockResolvedValue({
      data: { brief: BRIEF, myEntry: null, top: [] },
    } as never);
    vi.mocked(listWardrobe).mockResolvedValue([
      { id: 'd1', name: 'Finals Look', schema: 2 },
    ] as never);
    vi.mocked(submitDesignBrief).mockResolvedValue({
      data: {
        brief: BRIEF,
        score: 25,
        best: 25,
        matched: [BRIEF.wants[0]],
        missed: [BRIEF.wants[1]],
        paid: true,
        message: 'Scored 25/100',
      },
    } as never);
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /Score it/i }));
    await waitFor(() => expect(submitDesignBrief).toHaveBeenCalledWith({ designId: 'd1' }));
    expect(await screen.findByText('Your best: 25/100')).toBeInTheDocument();
  });

  it('renders nothing while signed out or before the brief loads', () => {
    const { container } = render(
      <MemoryRouter>
        <DesignBriefCard uid={null} />
      </MemoryRouter>
    );
    expect(container.firstElementChild).toBeNull();
  });
});
