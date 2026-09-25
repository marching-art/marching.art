// LeagueIdentityFields — the pickers for which game a league plays, how
// roleplay fits in, and (in Settings) its lore. Shared by CreateLeagueModal and
// the commissioner's LeagueSettingsForm so both doors ask the same questions in
// the same words (utils/leagueIdentity).

import React from 'react';
import type { LeagueGameMode, RoleplayLevel } from '../../types';
import {
  GAME_MODE_OPTIONS,
  MAX_LORE,
  MAX_ROLEPLAY_EXPECTATIONS,
  ROLEPLAY_LEVEL_OPTIONS,
} from '../../utils/leagueIdentity';

export interface LeagueIdentityValue {
  gameMode: LeagueGameMode;
  /** null = the commissioner hasn't said. */
  roleplayLevel: RoleplayLevel | null;
  expectations: string;
  lore: string;
}

interface LeagueIdentityFieldsProps {
  value: LeagueIdentityValue;
  onChange: (patch: Partial<LeagueIdentityValue>) => void;
  /** The lore editor is Settings-only: creation stays a one-screen form. */
  showLore?: boolean;
  /** Shown under the game picker, e.g. when a change applies mid-season. */
  gameModeNote?: string;
  idPrefix: string;
  /** One option per row, for narrow containers like the create modal. */
  stacked?: boolean;
}

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5';
const optionClass = (active: boolean) =>
  `px-3 py-2 min-h-touch text-left border transition-colors ${
    active ? 'border-interactive bg-interactive/10' : 'border-line hover:border-line-strong'
  }`;

const LeagueIdentityFields = ({
  value,
  onChange,
  showLore = false,
  gameModeNote,
  idPrefix,
  stacked = false,
}: LeagueIdentityFieldsProps) => (
  <>
    <div role="radiogroup" aria-labelledby={`${idPrefix}-game-label`}>
      <span id={`${idPrefix}-game-label`} className={labelClass}>
        Game
      </span>
      <div className={`grid grid-cols-1 gap-2 ${stacked ? '' : 'sm:grid-cols-3'}`}>
        {GAME_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value.gameMode === option.id}
            onClick={() => onChange({ gameMode: option.id })}
            className={optionClass(value.gameMode === option.id)}
          >
            <span className="block text-xs font-bold text-white">{option.label}</span>
            <span className="block text-[10px] text-muted">{option.hint}</span>
          </button>
        ))}
      </div>
      {gameModeNote && <p className="text-[10px] text-muted mt-1">{gameModeNote}</p>}
    </div>

    <div role="radiogroup" aria-labelledby={`${idPrefix}-rp-label`}>
      <span id={`${idPrefix}-rp-label`} className={labelClass}>
        Roleplay
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ROLEPLAY_LEVEL_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value.roleplayLevel === option.id}
            onClick={() => onChange({ roleplayLevel: option.id })}
            className={optionClass(value.roleplayLevel === option.id)}
          >
            <span className="block text-xs font-bold text-white">{option.label}</span>
            <span className="block text-[10px] text-muted">{option.hint}</span>
          </button>
        ))}
      </div>
    </div>

    {/* A storytelling focus doesn't necessarily mean mandatory participation,
        so the commissioner spells it out in their own words. */}
    {value.roleplayLevel && value.roleplayLevel !== 'none' && (
      <div>
        <label htmlFor={`${idPrefix}-expectations`} className={labelClass}>
          What participation means
        </label>
        <textarea
          id={`${idPrefix}-expectations`}
          rows={3}
          value={value.expectations}
          maxLength={MAX_ROLEPLAY_EXPECTATIONS}
          onChange={(e) => onChange({ expectations: e.target.value })}
          placeholder="e.g. Storylines run in chat on show nights. Jump in whenever you like — sitting them out never costs you anything."
          className="w-full px-3 py-2 bg-background border border-line-strong text-sm text-white focus:outline-none focus:border-interactive placeholder:text-muted resize-none"
        />
        <p className="text-[10px] text-muted mt-1 text-right tabular-nums">
          {value.expectations.length}/{MAX_ROLEPLAY_EXPECTATIONS}
        </p>
      </div>
    )}

    {showLore && (
      <div>
        <label htmlFor={`${idPrefix}-lore`} className={labelClass}>
          League Lore
        </label>
        <textarea
          id={`${idPrefix}-lore`}
          rows={6}
          value={value.lore}
          maxLength={MAX_LORE}
          onChange={(e) => onChange({ lore: e.target.value })}
          placeholder="The setting, the rivalries, the story so far. Members read it on the League tab; prospects see a preview before joining."
          className="w-full px-3 py-2 bg-background border border-line-strong text-sm text-white focus:outline-none focus:border-interactive placeholder:text-muted resize-y"
        />
        <p className="text-[10px] text-muted mt-1 text-right tabular-nums">
          {value.lore.length}/{MAX_LORE}
        </p>
      </div>
    )}
  </>
);

export default LeagueIdentityFields;
