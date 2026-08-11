// =============================================================================
// WRITER BADGE — automatic press credential on a director's profile
// =============================================================================
// Renders the writer tier a director has earned from their news-hub
// contributions (src/utils/writerTier.ts). Shows nothing until they reach the
// first tier, so it never clutters a non-writer's profile. Purely derived from
// the profile's articleStats counters — no admin grant, no separate state.

import React from 'react';
import { PenLine } from 'lucide-react';
import { getWriterTier, type WriterContribution } from '../../utils/writerTier';

export interface WriterBadgeProps {
  contribution?: WriterContribution | null;
  className?: string;
}

const WriterBadge: React.FC<WriterBadgeProps> = ({ contribution, className = '' }) => {
  const tier = getWriterTier(contribution);
  if (!tier) return null;

  return (
    <span
      title={`${tier.label} — earned by contributing to the news hub`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${tier.textClass} ${tier.bgClass} ${tier.borderClass} ${className}`}
    >
      <PenLine className="w-3 h-3" aria-hidden="true" />
      {tier.label}
    </span>
  );
};

export default WriterBadge;
