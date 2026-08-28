// =============================================================================
// STUDIO ACTION BAR — Save · Equip · More
// =============================================================================
// Replaces the old flat 11-button StudioActionGrid. The two actions directors
// take every session (Save, Equip) stay one tap away; everything occasional
// (alternate/guard looks, sharing, publishing, the AI avatar) lives in a
// grouped "More" bottom sheet whose rows carry visible descriptions — the old
// grid explained itself only through hover tooltips, which phones never show.

import React, { useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  MoreHorizontal,
  Save,
  Share2,
  Shield,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react';
import BottomSheet from '../ui/BottomSheet';
import { triggerHaptic } from '../../hooks/useHaptic';

export interface StudioActionBarProps {
  busy: string | null;
  dirty: boolean;
  /** Draft design name + rename — surfaces in the More sheet below lg, where
   *  the pinned canvas card has no name input (that row is desktop-only). */
  name?: string;
  maxNameLength?: number;
  onRename?: (name: string) => void;
  /** Names of the currently-set optional looks; undefined hides Clear rows. */
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

/** Busy keys handled by rows inside the More sheet (spinner on the trigger). */
const SHEET_BUSY_KEYS = new Set([
  'saveNew',
  'equipAlt',
  'equipGuard',
  'clearAlt',
  'clearGuard',
  'code',
  'card',
  'publish',
  'avatar',
]);

function SheetRow({
  icon,
  title,
  desc,
  busy,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full flex items-start gap-3 p-3 border border-line text-left hover:border-interactive group"
    >
      <span className="mt-0.5 text-muted group-hover:text-white">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wider text-white">{title}</span>
        <span className="block text-[11px] text-muted mt-0.5">{desc}</span>
      </span>
    </button>
  );
}

function SheetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 mb-2">
        {label}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function StudioActionBar({
  busy,
  dirty,
  name,
  maxNameLength,
  onRename,
  altName,
  guardName,
  onSave,
  onEquip,
  onClearSlot,
  onAvatar,
  onGetCode,
  onShareCard,
  onPublish,
}: StudioActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Rows close the sheet before running so toasts/spinners read on the page.
  const run = (fn: () => void) => () => {
    setMoreOpen(false);
    fn();
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mt-3">
      <button
        type="button"
        onClick={() => onSave(false)}
        disabled={busy !== null || !dirty}
        className="relative h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        {busy === 'save' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        Save
        {dirty && busy === null && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-interactive"
            aria-hidden="true"
            title="Unsaved changes"
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onEquip('primary')}
        disabled={busy !== null}
        className="h-10 px-3 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        {busy === 'equip' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
        Equip
      </button>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('sheetOpen');
          setMoreOpen(true);
        }}
        disabled={busy !== null && !SHEET_BUSY_KEYS.has(busy)}
        aria-label="More actions"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className="h-10 w-10 border border-line text-muted hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center"
      >
        {busy !== null && SHEET_BUSY_KEYS.has(busy) ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreHorizontal className="w-4 h-4" />
        )}
      </button>

      <BottomSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More actions"
        snapPoints={[85]}
      >
        <div className="overflow-y-auto scroll-momentum p-4 space-y-5">
          {/* Mobile rename — desktop has the inline name row on the canvas card */}
          {onRename && (
            <div className="lg:hidden">
              <label
                htmlFor="studio-sheet-name"
                className="block text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 mb-2"
              >
                Design name
              </label>
              <input
                id="studio-sheet-name"
                type="text"
                value={name || ''}
                maxLength={maxNameLength}
                onChange={(e) => onRename(e.target.value)}
                className="w-full h-10 px-2 bg-background border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
              />
            </div>
          )}
          <SheetGroup label="This design">
            <SheetRow
              icon={<Save className="w-4 h-4" />}
              title="Save as new"
              desc="Keep the loaded design and store this as a separate wardrobe entry"
              busy={busy === 'saveNew'}
              onPress={run(() => onSave(true))}
            />
            <SheetRow
              icon={<Copy className="w-4 h-4" />}
              title="Get code"
              desc="Mint a shareable code — anyone can enter it to import this design"
              busy={busy === 'code'}
              onPress={run(onGetCode)}
            />
            <SheetRow
              icon={<Share2 className="w-4 h-4" />}
              title="Share card"
              desc="Export a field-entrance share card with your uniform code on it"
              busy={busy === 'card'}
              onPress={run(onShareCard)}
            />
            <SheetRow
              icon={<Store className="w-4 h-4" />}
              title="Publish to the Exchange"
              desc="Share this design in the public Design Exchange gallery"
              busy={busy === 'publish'}
              onPress={run(onPublish)}
            />
          </SheetGroup>

          <SheetGroup label="Corps looks">
            <SheetRow
              icon={<Check className="w-4 h-4" />}
              title="Equip as alt"
              desc="Set this as the corps' optional second look (finals week / exhibition)"
              busy={busy === 'equipAlt'}
              onPress={run(() => onEquip('alternate'))}
            />
            {altName && (
              <SheetRow
                icon={<Trash2 className="w-4 h-4" />}
                title="Clear alt"
                desc={`Remove the alternate look (currently ${altName})`}
                busy={busy === 'clearAlt'}
                onPress={run(() => onClearSlot('alternate'))}
              />
            )}
            <SheetRow
              icon={<Shield className="w-4 h-4" />}
              title="Equip as guard"
              desc="Dress the color guard for this season's show — resets at rollover"
              busy={busy === 'equipGuard'}
              onPress={run(() => onEquip('guard'))}
            />
            {guardName && (
              <SheetRow
                icon={<Trash2 className="w-4 h-4" />}
                title="Clear guard"
                desc={`Remove the guard look (currently ${guardName})`}
                busy={busy === 'clearGuard'}
                onPress={run(() => onClearSlot('guard'))}
              />
            )}
          </SheetGroup>

          <SheetGroup label="Avatar">
            <SheetRow
              icon={<Sparkles className="w-4 h-4" />}
              title="AI avatar"
              desc="Optional: regenerate the AI avatar from this corps' saved design — never automatic"
              busy={busy === 'avatar'}
              onPress={run(onAvatar)}
            />
          </SheetGroup>
        </div>
      </BottomSheet>
    </div>
  );
}
