import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/** @type {{ profile: Record<string, unknown> | null, loading: boolean }} */
const state = { profile: null, loading: false };
vi.mock('../../store/profileStore', () => ({
  useProfileStore: (/** @type {(s: typeof state) => unknown} */ selector) => selector(state),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-new' } }),
}));
vi.mock('../../api/functions', () => ({
  checkUsername: vi.fn(),
  updateUsername: vi.fn(),
}));
vi.mock('../Portal', () => ({
  default: (/** @type {{ children: React.ReactNode }} */ { children }) => children,
}));

import UsernamePromptModal from './UsernamePromptModal';

describe('UsernamePromptModal', () => {
  it('stays closed for a director with a settled username', () => {
    state.profile = { username: 'joesmith' };
    render(<UsernamePromptModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as the mandatory prompt when there is no username at all', () => {
    state.profile = { username: '' };
    render(<UsernamePromptModal />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Username')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Later/ })).not.toBeInTheDocument();
  });

  it('asks for a new name when the handle is temporary, names the stand-in, and can be deferred', () => {
    state.profile = { username: 'joesmith2', usernameTemporary: true };
    render(<UsernamePromptModal />);
    expect(screen.getByText('Pick a New Username')).toBeInTheDocument();
    expect(screen.getByText(/temporary handle @joesmith2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Later — keep @joesmith2/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
