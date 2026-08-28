import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    // primary equip is one tap away; the alternate-look and guard slots
    // (docs/UNIFORM_STUDIO.md §6) live in the "More" sheet
    expect(screen.getByRole('button', { name: /^Equip$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /More actions/i }));
    expect(await screen.findByRole('button', { name: /Equip as alt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Equip as guard/i })).toBeInTheDocument();
  });

  it('exposes the paper-doll navigation surfaces: section tabs and figure tap regions', async () => {
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
    await screen.findByText(/Rebuilt in the Studio/i);

    // the mobile tab strip lists every editor section plus the wardrobe
    const tablist = screen.getByRole('tablist', { name: /editor sections/i });
    for (const label of ['Presets', 'Colors', 'Head', 'Torso', 'Wardrobe']) {
      expect(within(tablist).getByRole('tab', { name: label })).toBeInTheDocument();
    }

    // the doll is the menu: tapping a region activates the matching tab
    fireEvent.click(screen.getAllByRole('button', { name: /Edit legs/i })[0]);
    expect(within(tablist).getByRole('tab', { name: 'Legs' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // undo starts disabled and arms after an edit (the name input is an edit)
    const undo = screen.getByRole('button', { name: /^Undo$/i });
    expect(undo).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Design name/i), { target: { value: 'New Look' } });
    expect(undo).toBeEnabled();
  });

  it('opens the first-run preset gallery for a corps with no design yet', async () => {
    useProfileStore.setState({
      profile: {
        uid: 'test-uid',
        corps: {
          worldClass: { corpsName: 'Fresh Corps', corpsClass: 'worldClass' },
        },
      },
    });
    renderStudio();
    const gallery = await screen.findByRole('dialog', { name: /choose a starting look/i });
    expect(
      within(gallery).getByRole('button', { name: /start from scratch/i })
    ).toBeInTheDocument();
    // picking a preset closes the gallery and keeps the editor mounted
    fireEvent.click(within(gallery).getAllByRole('button', { name: /preset/i })[0]);
    expect(
      screen.queryByRole('dialog', { name: /choose a starting look/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Corps colorway/i)).toBeInTheDocument();
  });
});
