// LeagueIdentity — how a league says what it is: which game it plays and how
// roleplay fits in, as badges (discovery cards, the detail header) and as the
// full charter (the League tab, the discovery card's "About" drawer).
//
// Read-only. The pickers that set these live in LeagueIdentityFields; the
// field semantics live in utils/leagueIdentity.

import React from 'react';
import { Drama, Layers, Medal, BookOpen, ScrollText, Settings } from 'lucide-react';
import type { LeagueGameMode, RoleplayLevel } from '../../types';
import {
  type GameFilter,
  type IdentityLike,
  type RoleplayFilter,
  GAME_FILTERS,
  ROLEPLAY_FILTERS,
  gameModeOption,
  getLeagueGameMode,
  getLeagueRoleplayLevel,
  roleplayOption,
} from '../../utils/leagueIdentity';

type IdentityLeague = NonNullable<IdentityLike>;

const GAME_MODE_STYLE: Record<LeagueGameMode, string> = {
  fantasy: 'text-blue-400 bg-blue-500/10',
  podium: 'text-brand bg-brand/10',
  both: 'text-secondary bg-surface-raised',
};

const ROLEPLAY_STYLE: Record<RoleplayLevel, string> = {
  none: 'text-muted bg-white/5',
  optional: 'text-purple-300 bg-purple-500/10',
  encouraged: 'text-purple-400 bg-purple-500/15',
  immersive: 'text-purple-300 bg-purple-500/25',
};

const badgeClass = 'inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase';

/** Game-mode + roleplay badges. The roleplay badge is omitted when unstated. */
export const LeagueIdentityBadges = ({ league }: { league: IdentityLeague }) => {
  const mode = getLeagueGameMode(league);
  const rp = roleplayOption(getLeagueRoleplayLevel(league));
  const ModeIcon = mode === 'podium' ? Medal : Layers;
  return (
    <>
      <span className={`${badgeClass} ${GAME_MODE_STYLE[mode]}`} title={gameModeOption(mode).hint}>
        <ModeIcon className="w-2.5 h-2.5" aria-hidden="true" />
        {gameModeOption(mode).short}
      </span>
      {rp && (
        <span className={`${badgeClass} ${ROLEPLAY_STYLE[rp.id]}`} title={rp.hint}>
          <Drama className="w-2.5 h-2.5" aria-hidden="true" />
          {rp.short}
        </span>
      )}
    </>
  );
};

const CharterRow = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 flex-shrink-0 bg-surface-raised border border-line flex items-center justify-center">
      <Icon className="w-4 h-4 text-secondary" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  </div>
);

/**
 * The league's charter: game, roleplay style, the commissioner's expectations
 * and the lore. `compact` drops the lore to a short excerpt for the discovery
 * drawer, where it is a preview, not the reading copy.
 */
export const LeagueCharter = ({
  league,
  compact = false,
  onEdit,
}: {
  league: IdentityLeague;
  compact?: boolean;
  /** Commissioner-only: open the settings form. */
  onEdit?: () => void;
}) => {
  const mode = gameModeOption(getLeagueGameMode(league));
  const rp = roleplayOption(getLeagueRoleplayLevel(league));
  const expectations = league.roleplay?.expectations?.trim();
  const lore = league.lore?.trim();
  const loreText = compact && lore && lore.length > 280 ? `${lore.slice(0, 279)}…` : lore;

  return (
    <div className="space-y-4">
      {!compact && league.description?.trim() && (
        <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
          {league.description.trim()}
        </p>
      )}

      <div className="space-y-3">
        <CharterRow
          icon={mode.id === 'podium' ? Medal : Layers}
          label="Game"
          value={mode.label}
          hint={mode.hint}
        />
        <CharterRow
          icon={Drama}
          label="Roleplay"
          value={rp ? rp.label : 'Not specified'}
          hint={
            rp
              ? rp.hint
              : "The commissioner hasn't said how roleplay fits in — ask in chat before you join."
          }
        />
      </div>

      {expectations && (
        <div className="px-3 py-2.5 bg-purple-500/5 border-l-2 border-purple-500/50">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
            <ScrollText className="w-3 h-3" aria-hidden="true" />
            What participation means here
          </p>
          <p className="text-xs text-white leading-relaxed whitespace-pre-line">{expectations}</p>
        </div>
      )}

      {loreText && (
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
            <BookOpen className="w-3 h-3" aria-hidden="true" />
            League Lore
          </p>
          <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">{loreText}</p>
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="w-full min-h-touch flex items-center justify-center gap-2 border border-line text-xs font-bold uppercase tracking-wider text-muted hover:text-white hover:border-line-strong transition-colors"
        >
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
          {rp && lore ? 'Edit league identity' : 'Set game, roleplay style & lore'}
        </button>
      )}
    </div>
  );
};

/**
 * The discovery card's "what kind of league is this" section: the description
 * as a teaser, and an "About" drawer with the charter. The card used to show a
 * name and a Join button — a director could join an immersive roleplay league
 * wanting only to optimize a brass line, or the other way round, with nothing
 * on screen to tell them.
 */
export const LeagueCardAbout = ({ league }: { league: IdentityLeague }) => {
  const [open, setOpen] = React.useState(false);
  const description = league.description?.trim();
  const hasCharter =
    !!league.roleplay?.expectations?.trim() ||
    !!league.lore?.trim() ||
    getLeagueRoleplayLevel(league) !== null;
  if (!description && !hasCharter) return null;
  return (
    <div className="px-3 py-2 border-b border-line">
      {description && <p className="text-xs text-secondary line-clamp-2">{description}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-1 min-h-touch inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-interactive hover:text-white"
      >
        <BookOpen className="w-3 h-3" aria-hidden="true" />
        {open ? 'Hide details' : 'About this league'}
      </button>
      {open && (
        <div className="pt-2">
          <LeagueCharter league={{ ...league, description: undefined }} compact />
        </div>
      )}
    </div>
  );
};

/** Chip rows over the discover grid: which game, and how much roleplay. */
export const DiscoverIdentityFilters = ({
  gameFilter,
  roleplayFilter,
  onGameFilter,
  onRoleplayFilter,
}: {
  gameFilter: GameFilter | null;
  roleplayFilter: RoleplayFilter | null;
  onGameFilter: (next: GameFilter | null) => void;
  onRoleplayFilter: (next: RoleplayFilter | null) => void;
}) => {
  const chip = (active: boolean) =>
    `flex-shrink-0 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
      active
        ? 'border-interactive text-white bg-interactive/10'
        : 'border-line text-muted hover:border-line-strong hover:text-white'
    }`;
  return (
    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
      {GAME_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onGameFilter(gameFilter === f.id ? null : f.id)}
          aria-pressed={gameFilter === f.id}
          className={chip(gameFilter === f.id)}
        >
          {f.label}
        </button>
      ))}
      <span className="flex-shrink-0 w-px h-5 bg-line mx-0.5" aria-hidden="true" />
      {ROLEPLAY_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onRoleplayFilter(roleplayFilter === f.id ? null : f.id)}
          aria-pressed={roleplayFilter === f.id}
          className={chip(roleplayFilter === f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};
