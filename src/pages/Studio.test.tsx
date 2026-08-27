import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The page's data modules reach Firebase at import time, so each is mocked
// wholesale: auth, the profile store (a real zustand store so setState works),
// the wardrobe api, and the avatar callable.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' } }),
}));
vi.mock('../store/profileStore', async () => {
  const { create } = await import('zustand');
  const useProfileStore = create(() => ({ profile: null as unknown }));
  return { useProfileStore };
});
vi.mock('../api/uniformStudio', () => ({
  listWardrobe: vi.fn().mockResolvedValue([]),
  saveUniformDesign: vi.fn(),
  equipUniformDesign: vi.fn(),
  deleteUniformDesign: vi.fn(),
  mintUniformCode: vi.fn(),
  fetchUniformCode: vi.fn(),
}));
vi.mock('../api/designExchange', () => ({
  publishUniformDesign: vi.fn(),
}));
vi.mock('../api/articleAdmin', () => ({
  generateCorpsAvatar: vi.fn(),
}));

import Studio from './Studio';
import { useProfileStore } from '../store/profileStore';

function renderStudio() {
  return render(
    <MemoryRouter initialEntries={['/studio']}>
      <Studio />
    </MemoryRouter>
  );
}

describe('Studio page', () => {
  afterEach(() => {
    useProfileStore.setState({ profile: null });
  });

  it('shows the register-first empty state without corps', () => {
    useProfileStore.setState({ profile: { uid: 'test-uid', corps: {} } });
    renderStudio();
    expect(screen.getByText(/register a corps/i)).toBeInTheDocument();
  });

  it('mounts the editor for a registered corps, initializing from a v1 design', async () => {
    useProfileStore.setState({
      profile: {
        uid: 'test-uid',
        corps: {
          worldClass: {
            corpsName: 'Test Corps',
            corpsClass: 'worldClass',
            uniformDesign: { primaryColor: 'crimson red', secondaryColor: 'gold' },
          },
        },
      },
    });
    renderStudio();
    // corps tab, migration banner, live figure, and the editor sections mount
    expect(screen.getByRole('button', { name: /Test Corps/ })).toBeInTheDocument();
    expect(await screen.findByText(/Rebuilt in the Studio/i)).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getByText(/Corps colorway/i)).toBeInTheDocument();
    // primary equip plus the alternate-look and guard slots
    // (docs/UNIFORM_STUDIO.md §6)
    expect(screen.getByRole('button', { name: /^Equip$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Equip as alt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Equip as guard/i })).toBeInTheDocument();
  });
});
