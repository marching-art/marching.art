// =============================================================================
// STUDIO ACTION GRID — the canvas card's save / equip / share buttons
// =============================================================================
// Split out of Studio.tsx (max-lines guardrail) when the guard slot joined
// primary + alternate. Pure presentation: every action flows back through the
// page's handlers, and slot buttons for looks that aren't set simply hide
// their Clear counterpart.

import React from 'react';
import { Check, Copy, Loader2, Save, Share2, Sparkles, Store } from 'lucide-react';

const GHOST_BTN =
  'h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5';

export interface StudioActionGridProps {
  busy: string | null;
  dirty: boolean;
  /** Names of the currently-set optional looks; undefined hides Clear. */
  altName?: string;
  guardName?: string;
  onSave: (asNew: boolean) => void;
  onEquip: (slot: 'primary' | 'alternate' | 'guard') => void;
  onClearSlot: (slot: 'alternate' | 'guard') => void;
  onAvatar: () => void;
  onGetCode: () => void;
  onShareCard: () => void;
  onPublish: () => void;
}

function Spinner({ on, fallback }: { on: boolean; fallback?: React.ReactNode }) {
  return on ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (fallback ?? null);
}

export default function StudioActionGrid({
  busy,
  dirty,
  altName,
  guardName,
  onSave,
  onEquip,
  onClearSlot,
  onAvatar,
  onGetCode,
  onShareCard,
  onPublish,
}: StudioActionGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <button
        type="button"
        onClick={() => onSave(false)}
        disabled={busy !== null || !dirty}
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'save'} fallback={<Save className="w-3.5 h-3.5" />} />
        Save
      </button>
      <button
        type="button"
        onClick={() => onEquip('primary')}
        disabled={busy !== null}
        className="h-10 px-3 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        <Spinner on={busy === 'equip'} fallback={<Check className="w-3.5 h-3.5" />} />
        Equip
      </button>
      <button
        type="button"
        onClick={() => onSave(true)}
        disabled={busy !== null}
        className={GHOST_BTN}
      >
        Save as new
      </button>
      <button
        type="button"
        onClick={onAvatar}
        disabled={busy !== null}
        title="Optional: regenerate the AI avatar from this corps' saved design"
        className={GHOST_BTN}
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI avatar
      </button>
      <button
        type="button"
        onClick={onGetCode}
        disabled={busy !== null}
        title="Mint a shareable code — anyone can enter it to import this design"
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'code'} fallback={<Copy className="w-3.5 h-3.5" />} />
        Get code
      </button>
      <button
        type="button"
        onClick={onShareCard}
        disabled={busy !== null}
        title="Export a field-entrance share card with your uniform code on it"
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'card'} fallback={<Share2 className="w-3.5 h-3.5" />} />
        Share card
      </button>
      <button
        type="button"
        onClick={onPublish}
        disabled={busy !== null}
        title="Share this design in the public Design Exchange gallery"
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'publish'} fallback={<Store className="w-3.5 h-3.5" />} />
        Publish
      </button>
      <button
        type="button"
        onClick={() => onEquip('alternate')}
        disabled={busy !== null}
        title="Set this design as the corps' optional second look (finals week / exhibition)"
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'equipAlt'} fallback={<Check className="w-3.5 h-3.5" />} />
        Equip as alt
      </button>
      {altName && (
        <button
          type="button"
          onClick={() => onClearSlot('alternate')}
          disabled={busy !== null}
          title={`Remove the alternate look (currently ${altName})`}
          className={GHOST_BTN}
        >
          <Spinner on={busy === 'clearAlt'} />
          Clear alt
        </button>
      )}
      <button
        type="button"
        onClick={() => onEquip('guard')}
        disabled={busy !== null}
        title="Dress the color guard for this season's show — the guard look resets with the show at rollover and is archived in your season history"
        className={GHOST_BTN}
      >
        <Spinner on={busy === 'equipGuard'} fallback={<Check className="w-3.5 h-3.5" />} />
        Equip as guard
      </button>
      {guardName && (
        <button
          type="button"
          onClick={() => onClearSlot('guard')}
          disabled={busy !== null}
          title={`Remove the guard look (currently ${guardName})`}
          className={GHOST_BTN}
        >
          <Spinner on={busy === 'clearGuard'} />
          Clear guard
        </button>
      )}
    </div>
  );
}
