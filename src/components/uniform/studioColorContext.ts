// =============================================================================
// STUDIO COLORWAY CONTEXT
// =============================================================================
// StudioEditor provides the draft's corps colorway here so every ChannelRow's
// color popover can offer the corps palette as first-class quick picks — the
// GW2/Destiny "dye channel" model (docs/UNIFORM_STUDIO.md §4.3) that nudges
// coherent designs without gating hues. Kept in its own module (not a
// component file) so react-refresh stays happy.

import { createContext } from 'react';
import type { UniformColorway } from '../../types/uniform';

/** Null outside the editor — the popover then simply omits the chips row. */
export const StudioColorwayContext = createContext<UniformColorway | null>(null);
