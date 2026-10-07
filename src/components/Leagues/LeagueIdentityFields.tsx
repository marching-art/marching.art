// LeagueIdentityFields — the pickers for which game a league plays, how
// roleplay fits in, and (in Settings) its lore; plus LeagueTagField, the
// league's bold acronym. Shared by CreateLeagueModal and
// the commissioner's LeagueSettingsForm so both doors ask the same questions in
// the same words (utils/leagueIdentity).

import React from 'react';
import type { LeagueGameMode, RoleplayLevel } from '../../types';
import {
  GAME_MODE_OPTIONS,
  MAX_LEAGUE_TAG,
  MAX_LORE,
  MAX_ROLEPLAY_EXPECTATIONS,
  MIN_LEAGUE_TAG,
  ROLEPLAY_LEVEL_OPTIONS,
  isValidLeagueTag,
  normalizeLeagueTagInput,
  suggestLeagueTag,
} from '../../utils/leagueIdentity';
import { LeagueTag } from './LeagueIdentity';

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

/**
 * The league tag: a 2–5 character acronym the league wears as its crest and
 * every member wears on their profile and ensembles. Optional — leaving it
 * blank keeps the league off member profiles entirely.
 */
export const LeagueTagField = ({
  value,
  onChange,
  leagueName,
  idPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Seeds the one-tap suggestion. */
  leagueName: string;
  idPrefix: string;
}) => {
  const suggestion = suggestLeagueTag(leagueName);
  const incomplete = !isValidLeagueTag(value);
  return (
    <div>
      <label htmlFor={`${idPrefix}-tag`} className={labelClass}>
        League Tag
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-tag`}
          type="text"
          value={value}
          maxLength={MAX_LEAGUE_TAG}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(normalizeLeagueTagInput(e.target.value))}
          placeholder={suggestion || 'DCFL'}
          aria-describedby={`${idPrefix}-tag-hint`}
          aria-invalid={incomplete}
          className="w-28 h-10 px-3 bg-background border border-line-strong text-base font-black tracking-wider text-white uppercase font-data focus:outline-none focus:border-interactive placeholder:text-muted placeholder:font-normal"
        />
        {value && isValidLeagueTag(value) ? (
          <LeagueTag abbreviation={value} name={leagueName || undefined} size="md" />
        ) : (
          suggestion &&
          !value && (
            <button
              type="button"
              onClick={() => onChange(suggestion)}
              className="min-h-touch px-2 text-[10px] font-bold uppercase tracking-wider text-interactive hover:text-white"
            >
              Use {suggestion}
            </button>
          )
        )}
      </div>
      <p
        id={`${idPrefix}-tag-hint`}
        className={`text-[10px] mt-1 ${incomplete ? 'text-red-400' : 'text-muted'}`}
      >
        {incomplete
          ? `Tags are ${MIN_LEAGUE_TAG}–${MAX_LEAGUE_TAG} letters or numbers.`
          : `Optional. ${MIN_LEAGUE_TAG}–${MAX_LEAGUE_TAG} letters or numbers — your league's crest, and the badge every member wears on their profile and ensembles. Leave blank to keep the league off profiles.`}
      </p>
    </div>
  );
};

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
