// =============================================================================
// CREATE LEAGUE MODAL TESTS
// =============================================================================
// The success screen's invite code is what the creator shares with friends, so
// these tests pin the one behavior that must never regress: the code shown is
// the SERVER's code, and when the server doesn't return one we point at the
// Settings tab instead of fabricating a random (dead) code — which is exactly
// the bug this file was written against.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateLeagueModal from './CreateLeagueModal';

const fillNameAndSubmit = async (name = 'Test League') => {
  fireEvent.change(screen.getByPlaceholderText('e.g., DCI Fantasy Champions'), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
};

describe('CreateLeagueModal', () => {
  it('shows the server-issued invite code on the success screen', async () => {
    const onCreate = vi.fn().mockResolvedValue({
      success: true,
      inviteCode: 'REAL42',
      leagueId: 'league-1',
    });
    render(<CreateLeagueModal onClose={() => {}} onCreate={onCreate} />);

    await fillNameAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('League Created')).toBeInTheDocument();
    });
    expect(screen.getByText('REAL42')).toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test League' }));
  });

  it('never fabricates a code — points at Settings when the server returns none', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateLeagueModal onClose={() => {}} onCreate={onCreate} />);

    await fillNameAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('League Created')).toBeInTheDocument();
    });
    // No invite-code block, no share buttons for a code we don't have…
    expect(screen.queryByText('Invite Code')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();
    // …just directions to where the real code lives.
    expect(screen.getByText(/Settings tab/)).toBeInTheDocument();
  });

  it('opens the new league from the success screen when it has an id', async () => {
    const onCreate = vi.fn().mockResolvedValue({
      success: true,
      inviteCode: 'REAL42',
      leagueId: 'league-1',
    });
    const onOpenLeague = vi.fn();
    render(
      <CreateLeagueModal onClose={() => {}} onCreate={onCreate} onOpenLeague={onOpenLeague} />
    );

    await fillNameAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('League Created')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to League' }));
    expect(onOpenLeague).toHaveBeenCalledWith('league-1');
  });

  it('stays on the form when creation fails', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('League name already taken'));
    render(<CreateLeagueModal onClose={() => {}} onCreate={onCreate} />);

    await fillNameAndSubmit();

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
    });
    expect(screen.queryByText('League Created')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
