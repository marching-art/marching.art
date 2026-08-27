// =============================================================================
// PACK ADVISORY BANNER — "try on free, own to save"
// =============================================================================
// Shown under the Studio canvas when the draft wears design-house content the
// director doesn't own yet (utils/uniformPacks). Purely advisory — the save
// callable is the real gate — so a stale owned list can never lock anyone out
// of previewing, only surprise them at save time with the same message.

import React from 'react';
import { Link } from 'react-router-dom';
import type { FigureConfig } from '../../types/uniform';
import { missingPacksFor } from '../../utils/uniformPacks';

export interface PackAdvisoryBannerProps {
  figure: FigureConfig;
  /** profile cosmetics.owned (undefined while the profile loads). */
  owned: string[] | undefined;
}

export default function PackAdvisoryBanner({ figure, owned }: PackAdvisoryBannerProps) {
  const missing = missingPacksFor(figure, owned);
  if (missing.length === 0) return null;
  return (
    <div className="mt-3 border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning">
      {missing.map((p) =>
        p.kind === 'prestige' ? (
          <p key={p.id}>
            Wears <span className="font-bold">{p.name}</span> — it comes with {p.house}.
          </p>
        ) : (
          <p key={p.id}>
            Uses <span className="font-bold">{p.name}</span> by {p.house} ({p.features}).
          </p>
        )
      )}
      <p className="mt-1 text-muted">
        Trying it on is free — unlock it in the Shop to save or equip this look.{' '}
        <Link to="/shop" className="text-interactive hover:underline">
          Visit the Shop
        </Link>
      </p>
    </div>
  );
}
