// One-time free hometown correction card on the Podium dashboard.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HometownCorrectionCard from './HometownCorrectionCard';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const makePodium = (canCorrect: boolean) => ({
  data: {
    hometown: { city: 'Canton, OH', canCorrect },
    currentLocation: { atHome: true },
    state: { seasonUid: 'live_2026-26' },
  },
  correctHometown: vi.fn(async (location: string) => ({
    home: location,
    previous: 'Canton, OH',
    touring: false,
  })),
});

describe('HometownCorrectionCard', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders nothing once the correction is used (or was never needed)', () => {
    const { container } = render(<HometownCorrectionCard podium={makePodium(false)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('moves the home to a picked town', async () => {
    const podium = makePodium(true);
    render(<HometownCorrectionCard podium={podium} />);
    expect(screen.getByText(/can be any town now/i)).toBeInTheDocument();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Brownsburg, IN' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Brownsburg, IN' }));
    fireEvent.click(screen.getByRole('button', { name: /Move home to Brownsburg, IN/ }));
    await vi.waitFor(() => expect(podium.correctHometown).toHaveBeenCalledWith('Brownsburg, IN'));
  });

  it('"Keep" collapses to a one-line reminder that reopens', () => {
    render(<HometownCorrectionCard podium={makePodium(true)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Canton, OH' }));
    expect(screen.getByText(/one free\s+change available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByText(/can be any town now/i)).toBeInTheDocument();
  });
});
