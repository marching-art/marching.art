// =============================================================================
// STUDIO VIEW TOOLS — preview mode, zoom, and hold-to-compare
// =============================================================================
// Two skins over one control set (split out of Studio.tsx, max-lines
// guardrail): the labeled desktop row (Close-up / Press box segmented control
// + zoom + "Equipped" compare) and the compact icon cluster that overlays the
// mobile canvas corner (map-control idiom). Peek is hold-to-compare: pressed
// shows the equipped uniform, released returns to the draft — works for
// pointer and keyboard alike.

import React from 'react';
import { ArrowLeftRight, Eye, ZoomIn } from 'lucide-react';

const TOOL_BTN =
  'w-9 h-9 flex items-center justify-center border text-[11px] font-bold uppercase tracking-wider';
export const TOOL_INACTIVE = `${TOOL_BTN} border-line bg-background/90 text-muted hover:text-white hover:border-interactive`;
export const TOOL_ACTIVE = `${TOOL_BTN} border-interactive bg-interactive text-white`;

export interface StudioViewToolsProps {
  variant: 'overlay' | 'row';
  pressBox: boolean;
  onPressBox: (v: boolean) => void;
  zoom: number;
  onCycleZoom: () => void;
  canPeek: boolean;
  peeking: boolean;
  onPeekChange: (v: boolean) => void;
}

export default function StudioViewTools({
  variant,
  pressBox,
  onPressBox,
  zoom,
  onCycleZoom,
  canPeek,
  peeking,
  onPeekChange,
}: StudioViewToolsProps) {
  const peekHandlers = {
    onPointerDown: () => onPeekChange(true),
    onPointerUp: () => onPeekChange(false),
    onPointerLeave: () => onPeekChange(false),
    onPointerCancel: () => onPeekChange(false),
    onBlur: () => onPeekChange(false),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        onPeekChange(true);
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') onPeekChange(false);
    },
  };

  if (variant === 'overlay') {
    return (
      <>
        <button
          type="button"
          onClick={() => onPressBox(!pressBox)}
          aria-pressed={pressBox}
          aria-label="Press-box view — does it read from the stands?"
          title="Press-box view"
          className={pressBox ? TOOL_ACTIVE : TOOL_INACTIVE}
        >
          <Eye className="w-4 h-4" />
        </button>
        {!pressBox && (
          <button
            type="button"
            onClick={onCycleZoom}
            aria-label={`Zoom preview (currently ${zoom}×)`}
            title="Zoom"
            className={zoom > 1 ? TOOL_ACTIVE : TOOL_INACTIVE}
          >
            {zoom > 1 ? `${zoom}×` : <ZoomIn className="w-4 h-4" />}
          </button>
        )}
        {canPeek && !pressBox && (
          <button
            type="button"
            {...peekHandlers}
            aria-pressed={peeking}
            aria-label="Hold to compare with the equipped uniform"
            title="Hold to compare with the equipped uniform"
            className={peeking ? TOOL_ACTIVE : TOOL_INACTIVE}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}
      </>
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-2 mb-2">
      <div role="group" aria-label="Preview mode" className="flex border border-line">
        <button
          type="button"
          onClick={() => onPressBox(false)}
          aria-pressed={!pressBox}
          className={`px-2.5 h-8 text-[10px] font-bold uppercase tracking-wider ${
            !pressBox ? 'bg-interactive text-white' : 'text-muted hover:text-white'
          }`}
        >
          Close-up
        </button>
        <button
          type="button"
          onClick={() => onPressBox(true)}
          aria-pressed={pressBox}
          title="Does it read from the stands?"
          className={`px-2.5 h-8 text-[10px] font-bold uppercase tracking-wider ${
            pressBox ? 'bg-interactive text-white' : 'text-muted hover:text-white'
          }`}
        >
          Press box
        </button>
      </div>
      {!pressBox && (
        <button
          type="button"
          onClick={onCycleZoom}
          aria-label={`Zoom preview (currently ${zoom}×)`}
          title="Zoom"
          className={`${zoom > 1 ? TOOL_ACTIVE : TOOL_INACTIVE} h-8 w-auto px-2`}
        >
          {zoom > 1 ? `${zoom}×` : <ZoomIn className="w-4 h-4" />}
        </button>
      )}
      {canPeek && !pressBox && (
        <button
          type="button"
          {...peekHandlers}
          aria-pressed={peeking}
          aria-label="Hold to compare with the equipped uniform"
          title="Hold to compare with the equipped uniform"
          className={`${peeking ? TOOL_ACTIVE : TOOL_INACTIVE} h-8 w-auto px-2 text-[10px]`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
          Equipped
        </button>
      )}
    </div>
  );
}
