// =============================================================================
// UNIFORM HISTORY — the archived look on the Corps History timeline
// =============================================================================
// Season rollover stamps the equipped design into the season archive
// (docs/UNIFORM_STUDIO.md §6): a compact {designId, name, colors} row on the
// seasonHistory summary and the full renderable snapshot on the seasonDetail
// doc. The timeline list renders the swatches; the detail panel renders the
// figure itself — the corps' own pictorial history, season by season.

import React from 'react';
import { Shirt } from 'lucide-react';
import UniformFigure from './UniformFigure';
import type { FigureConfig, UniformColorway } from '../../types/uniform';

const HEX_RE = /^#[0-9a-f]{6}$/i;

export interface SeasonUniformCompact {
  designId?: string | null;
  name?: string;
  colors?: string[] | null;
}

export interface SeasonUniformSnapshot {
  name?: string | null;
  colorway?: UniformColorway | null;
  figure?: FigureConfig | null;
}

/** Tiny tricolor bar for a timeline row; nothing for pre-Studio seasons. */
export function SeasonLookSwatches({ uniform }: { uniform?: SeasonUniformCompact | null }) {
  const colors = uniform?.colors;
  if (!Array.isArray(colors) || colors.length !== 3 || !colors.every((c) => HEX_RE.test(c))) {
    return null;
  }
  return (
    <span
      className="inline-flex flex-shrink-0"
      title={uniform?.name ? `Uniform: ${uniform.name}` : 'Season uniform'}
      aria-hidden="true"
    >
      {colors.map((c, i) => (
        <span key={i} className="w-2 h-3.5" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

function LookTile({
  compact,
  snapshot,
  role,
}: {
  compact?: SeasonUniformCompact | null;
  snapshot?: SeasonUniformSnapshot | null;
  role: string;
}) {
  const figure = snapshot?.figure;
  const name = snapshot?.name || compact?.name;
  return (
    <div className="flex-1 bg-surface-raised border border-line rounded-none p-3 text-center">
      {figure ? (
        <div className="max-w-[110px] mx-auto">
          <UniformFigure figure={figure} label={`${name || 'Season'} ${role.toLowerCase()}`} />
        </div>
      ) : (
        <SeasonLookSwatches uniform={compact} />
      )}
      <p className="text-[9px] uppercase tracking-wider text-muted mt-2">{role}</p>
      {name && <p className="text-[10px] uppercase tracking-wider text-white truncate">{name}</p>}
    </div>
  );
}

/**
 * The detail-panel section: the season's full look when the detail doc
 * carries a snapshot, else the compact name + swatches, else nothing. When a
 * guard look was archived (docs/UNIFORM_STUDIO.md §6 — the show's costume,
 * reset at rollover), it stands beside the hornline's uniform.
 */
export default function SeasonUniformSection({
  compact,
  snapshot,
  guardCompact,
  guardSnapshot,
}: {
  compact?: SeasonUniformCompact | null;
  snapshot?: SeasonUniformSnapshot | null;
  guardCompact?: SeasonUniformCompact | null;
  guardSnapshot?: SeasonUniformSnapshot | null;
}) {
  const hasUniform = Boolean(snapshot?.figure || compact);
  const hasGuard = Boolean(guardSnapshot?.figure || guardCompact);
  if (!hasUniform && !hasGuard) return null;
  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <Shirt className="w-4 h-4 text-interactive" />
        Uniform
      </h4>
      <div className="flex gap-2">
        {hasUniform && (
          <LookTile compact={compact} snapshot={snapshot} role={hasGuard ? 'Corps' : 'Uniform'} />
        )}
        {hasGuard && <LookTile compact={guardCompact} snapshot={guardSnapshot} role="Guard" />}
      </div>
    </div>
  );
}
