// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed
// Shared score-sheet primitives — the single source of truth for the DCI-style
// box-score look used by BOTH the Fantasy sheets (pages/ScoresParts) and the
// Podium Class sheets (components/Podium/*). Promoted out of ScoresParts so the
// two sides render from the same building blocks and read as one system.
//
// The Podium recap sheet is the visual reference: a #1a1a1a card on a #333
// border, gold (#c9a227) box-toppers/accents, blue for the viewer's own corps,
// thin row dividers. Numeric columns are fixed-width so caption values line up
// across every row and card while the corps column flexes and truncates — the
// key to a box-score look that never forces horizontal scroll on mobile.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Check, MapPin } from 'lucide-react';
import { TeamAvatar } from '../ui/TeamAvatar';
import { shareOrCopy } from '../../utils/shareSheet';
import { CAP_W, TOTAL_W, GOLD } from './sheetTokens';

export const BlueRibbonIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Ribbon circle/badge */}
    <circle cx="12" cy="9" r="7" fill="#0057B8" stroke="#003d82" strokeWidth="1" />
    {/* Inner circle highlight */}
    <circle cx="12" cy="9" r="4" fill="#0066d6" />
    {/* Star in center */}
    <path
      d="M12 5.5l1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.1l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.5z"
      fill="#FFD700"
    />
    {/* Ribbon tails */}
    <path d="M8 15l-2 7 4-2.5V15H8z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
    <path d="M16 15l2 7-4-2.5V15h2z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
  </svg>
);

// Per-sheet masthead — event name left, location/date right, hairline underline.
export const SheetMasthead = ({ title, location, date }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-line-muted pb-1.5">
    <div className="text-[13px] font-bold text-white truncate min-w-0">{title}</div>
    {(location || date) && (
      <div className="flex items-center gap-2 flex-shrink-0 pl-2 text-[10px] uppercase tracking-wider text-muted">
        {location && (
          <span className="hidden sm:flex items-center gap-1 truncate max-w-[160px]">
            <MapPin className="w-3 h-3" />
            {location}
          </span>
        )}
        {date && <span className="tabular-nums normal-case">{date}</span>}
      </div>
    )}
  </div>
);

// Column-header row for the flex box scores. `active` gold-highlights the
// caption currently being sorted on.
export const BoxScoreHead = ({ active, totalLabel = 'Total', trailing = null }) => (
  <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-line text-[9px] uppercase tracking-wider">
    <span className="flex-1 min-w-0 text-muted">Pl · Corps</span>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {['GE', 'VIS', 'MUS'].map((cap) => (
        <span key={cap} className={`${CAP_W} text-right ${active === cap ? GOLD : 'text-muted'}`}>
          {cap}
        </span>
      ))}
      <span className={`${TOTAL_W} text-right text-white`}>{totalLabel}</span>
      {trailing}
    </div>
  </div>
);

// Place · avatar · corps name · director credit (linked).
export const CorpsIdentity = ({ place, name, isMine, displayName, uid, tag, avatarUrl }) => (
  <div className="flex-1 min-w-0 flex items-center gap-2">
    <span className="text-[11px] text-muted tabular-nums flex-shrink-0">{place}.</span>
    <TeamAvatar name={name} logoUrl={avatarUrl} size="xs" />
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={`text-[11px] font-bold truncate ${isMine ? 'text-interactive' : 'text-white'}`}
        >
          {name}
        </span>
        {tag}
      </div>
      {displayName &&
        (uid ? (
          <Link
            to={`/profile/${uid}`}
            className="block text-[10px] text-muted hover:text-interactive truncate"
          >
            {displayName}
          </Link>
        ) : (
          <span className="block text-[10px] text-muted truncate">{displayName}</span>
        ))}
    </div>
  </div>
);

// A single GE/VIS/MUS value — gold + bold when it's the box-topper for its
// column, white when it's the active sort, muted otherwise.
export const CaptionValue = ({ value, isTop, active, width = CAP_W }) => (
  <span
    className={`${width} text-right tabular-nums ${
      isTop ? `font-bold ${GOLD}` : active ? 'text-white' : 'text-secondary'
    }`}
  >
    {value !== null && value !== undefined ? value.toFixed(2) : '—'}
  </span>
);

// Wordmark / legend footer — every screenshot is an advertisement. `action`
// renders on the right (the Share button lives here, so every sheet places it
// in the same spot).
export const SheetFooter = ({ note, action }) => (
  <div className="flex justify-between items-center gap-2 pt-1 text-[9px] uppercase tracking-wider text-muted">
    <span className="truncate">{note}</span>
    <div className="flex items-center gap-2 flex-shrink-0">
      {action}
      <span className="font-bold text-muted">marching.art</span>
    </div>
  </div>
);

// Podium-style gold sort pills (shared by the standings grids).
export const SortPills = ({ options, value, onChange }) => (
  <div className="flex items-center gap-1 flex-shrink-0">
    {options.map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        aria-pressed={value === opt.id}
        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-none transition-colors ${
          value === opt.id
            ? 'bg-interactive text-white'
            : 'bg-surface-raised text-muted hover:text-secondary'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// Share/copy button — native share sheet on mobile, Discord-ready text copied to
// the clipboard elsewhere (see utils/shareSheet). `getText` is called lazily on
// click so the (sometimes expensive) formatting only runs when the user shares.
export const ShareButton = ({ getText, title = 'Copy the sheet as Discord-ready text' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const didCopy = await shareOrCopy(getText());
        if (didCopy) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      title={title}
      aria-label="Share this sheet"
      className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-none border border-line text-muted hover:text-white hover:border-interactive press-feedback flex-shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Share2 className="w-3 h-3" />}
      {copied ? 'Copied' : 'Share'}
    </button>
  );
};
