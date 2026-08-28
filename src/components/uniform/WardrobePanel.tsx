// =============================================================================
// WARDROBE PANEL — saved designs + import-by-code
// =============================================================================
// Extracted from Studio.tsx so the same panel can render in both homes: the
// canvas column on desktop (always visible under the doll) and the Wardrobe
// tab on mobile (out of the edit loop's way). The import-code input owns its
// local text state; the page owns the actual import.

import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import UniformFigure from './UniformFigure';
import type { WardrobeDesign } from '../../api/uniformStudio';

export interface WardrobePanelProps {
  wardrobe: WardrobeDesign[];
  loadedId: string | null;
  busy: string | null;
  maxDesigns: number;
  onLoad: (w: WardrobeDesign) => void;
  onDelete: (w: WardrobeDesign) => void;
  /** Resolves true when the code imported (the input clears itself). */
  onImport: (code: string) => Promise<boolean>;
  /** Skip the card chrome (border/padding) when embedded in another card. */
  frameless?: boolean;
  className?: string;
}

export default function WardrobePanel({
  wardrobe,
  loadedId,
  busy,
  maxDesigns,
  onLoad,
  onDelete,
  onImport,
  frameless = false,
  className = '',
}: WardrobePanelProps) {
  const [importCode, setImportCode] = useState('');

  const doImport = async () => {
    const raw = importCode.trim();
    if (!raw) return;
    if (await onImport(raw)) setImportCode('');
  };

  return (
    <div className={`${frameless ? '' : 'bg-surface-card border border-line p-4'} ${className}`}>
      <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 mb-3">
        Wardrobe ({wardrobe.length}/{maxDesigns})
      </h3>
      {wardrobe.length === 0 ? (
        <p className="text-xs text-muted">
          No saved designs yet — save your first look to start a wardrobe.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto scroll-momentum scrollbar-thin pb-1">
          {wardrobe.map((w) => (
            <div
              key={w.id}
              className={`flex-shrink-0 w-24 border p-1 ${
                w.id === loadedId ? 'border-interactive' : 'border-line'
              }`}
            >
              <button
                type="button"
                onClick={() => onLoad(w)}
                className="block w-full hover:opacity-80"
                title={`Load "${w.name}"`}
              >
                <UniformFigure figure={w.figure} label={`${w.name} saved design`} />
              </button>
              <div className="flex items-center gap-1 mt-1">
                <span className="flex-1 text-[8px] uppercase tracking-wider text-muted truncate">
                  {w.name}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(w)}
                  disabled={busy !== null}
                  aria-label={`Delete ${w.name}`}
                  className="text-muted hover:text-red-400 min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                >
                  {busy === `del:${w.id}` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Import a shared design by its code (docs/UNIFORM_STUDIO.md §7.1) */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-line">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void doImport();
          }}
          placeholder="Have a code? MA-XXXX-XX"
          aria-label="Import a uniform code"
          className="flex-1 h-9 px-2 bg-background border border-line rounded-none text-xs text-white font-mono uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-interactive"
        />
        <button
          type="button"
          onClick={() => void doImport()}
          disabled={busy !== null || !importCode.trim()}
          className="h-9 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40"
        >
          {busy === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Import'}
        </button>
      </div>
    </div>
  );
}
