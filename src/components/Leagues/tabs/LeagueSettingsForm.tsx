// LeagueSettingsForm - the commissioner's editable league settings.
//
// A league used to be immutable from the moment it was created: there was no
// updateLeague* callable in the backend at all, so a typo in the name, a stale
// description, a league that outgrew its member cap, or one that wanted to go
// private were all permanent. This is the form for the callable that fixes it
// (functions/src/callable/leagueAdmin.js).
//
// Entry fee is deliberately absent and read-only below: the prize pool is
// escrow, every member paid the fee advertised when they joined, and the
// removal refund is clamped to it.

import React, { useMemo, useState } from 'react';
import { Settings, Loader2, Save, Globe, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateLeagueSettings } from '../../../api/functions';

interface LeagueSettingsFormProps {
  league?: {
    id?: string;
    name?: string;
    description?: string;
    isPublic?: boolean;
    maxMembers?: number;
    tag?: string | null;
    settings?: { finalsSize?: number; entryFee?: number };
  } | null;
  memberCount: number;
  onSaved?: () => void;
}

interface FormState {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
  tag: string | null;
  finalsSize: number;
}

const LEAGUE_TAGS = [
  { id: 'competitive', label: 'Competitive', hint: 'Records matter, show up every week' },
  { id: 'casual', label: 'Casual', hint: 'Play at your own pace' },
  { id: 'roleplay', label: 'Roleplay', hint: 'In-character directors and corps lore' },
  { id: 'dynasty', label: 'Dynasty', hint: 'Carries across seasons' },
];

const MAX_NAME = 50;
const MAX_DESCRIPTION = 500;

const LeagueSettingsForm = ({ league, memberCount, onSaved }: LeagueSettingsFormProps) => {
  const initial = useMemo<FormState>(
    () => ({
      name: league?.name || '',
      description: league?.description || '',
      isPublic: league?.isPublic !== false,
      maxMembers: league?.maxMembers || 20,
      tag: league?.tag || null,
      finalsSize: league?.settings?.finalsSize || 12,
    }),
    [league]
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const dirty = useMemo(
    () =>
      (Object.keys(initial) as Array<keyof FormState>).some((key) => initial[key] !== form[key]),
    [initial, form]
  );

  // The server rejects a cap below the current roster (it would make the
  // league permanently "full" at an impossible count); say so before the round
  // trip rather than after it.
  const capTooLow = form.maxMembers < memberCount;
  const nameTooShort = form.name.trim().length < 3;
  const canSave = dirty && !saving && !capTooLow && !nameTooShort;

  const handleSave = async () => {
    if (!canSave || !league?.id) return;
    setSaving(true);
    try {
      const result = await updateLeagueSettings({
        leagueId: league.id,
        settings: {
          name: form.name.trim(),
          description: form.description.trim(),
          isPublic: form.isPublic,
          maxMembers: form.maxMembers,
          tag: form.tag,
          finalsSize: form.finalsSize,
        },
      });
      toast.success(result.data?.message || 'League settings updated.');
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update league settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            League Settings
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label
            htmlFor="league-name"
            className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5"
          >
            League Name
          </label>
          <input
            id="league-name"
            type="text"
            value={form.name}
            maxLength={MAX_NAME}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full h-11 px-3 bg-background border border-line-strong text-base text-white focus:outline-none focus:border-interactive"
          />
          {nameTooShort && (
            <p className="text-[10px] text-red-400 mt-1">
              League names must be at least 3 characters.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="league-description"
            className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5"
          >
            Description
          </label>
          <textarea
            id="league-description"
            rows={3}
            value={form.description}
            maxLength={MAX_DESCRIPTION}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What is this league about? House rules, vibe, expectations…"
            className="w-full px-3 py-2 bg-background border border-line-strong text-sm text-white focus:outline-none focus:border-interactive placeholder:text-muted resize-none"
          />
          <p className="text-[10px] text-muted mt-1 text-right tabular-nums">
            {form.description.length}/{MAX_DESCRIPTION}
          </p>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
            League Type
          </span>
          {/* Discovery renders these tags. They used to be read from
              league.isCompetitive / league.isDynasty / league.type — fields
              nothing ever wrote — so every league in the browse grid showed as
              "Casual" and search had no signal to filter on. */}
          <div className="grid grid-cols-2 gap-2">
            {LEAGUE_TAGS.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => set({ tag: form.tag === tag.id ? null : tag.id })}
                className={`px-3 py-2 min-h-touch text-left border transition-colors ${
                  form.tag === tag.id
                    ? 'border-interactive bg-interactive/10'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <span className="block text-xs font-bold text-white">{tag.label}</span>
                <span className="block text-[10px] text-muted">{tag.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
            Visibility
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set({ isPublic: true })}
              className={`px-3 py-2 min-h-touch flex items-center gap-2 border transition-colors ${
                form.isPublic
                  ? 'border-interactive bg-interactive/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-muted" />
              <span className="text-xs font-bold text-white">Public</span>
            </button>
            <button
              type="button"
              onClick={() => set({ isPublic: false })}
              className={`px-3 py-2 min-h-touch flex items-center gap-2 border transition-colors ${
                !form.isPublic
                  ? 'border-interactive bg-interactive/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-muted" />
              <span className="text-xs font-bold text-white">Invite Only</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="league-max-members"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5"
            >
              Max Members
            </label>
            <input
              id="league-max-members"
              type="number"
              min={Math.max(2, memberCount)}
              max={50}
              value={form.maxMembers}
              onChange={(e) => set({ maxMembers: parseInt(e.target.value, 10) || 0 })}
              className="w-full h-11 px-3 bg-background border border-line-strong text-base text-white font-data tabular-nums focus:outline-none focus:border-interactive"
            />
            {capTooLow && (
              <p className="text-[10px] text-red-400 mt-1">
                Can&apos;t go below the current roster ({memberCount}).
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="league-finals-size"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5"
            >
              Finals Spots
            </label>
            <input
              id="league-finals-size"
              type="number"
              min={1}
              max={50}
              value={form.finalsSize}
              onChange={(e) => set({ finalsSize: parseInt(e.target.value, 10) || 0 })}
              className="w-full h-11 px-3 bg-background border border-line-strong text-base text-white font-data tabular-nums focus:outline-none focus:border-interactive"
            />
            <p className="text-[10px] text-muted mt-1">
              Top seeds that reach Finals, where the title is decided.
            </p>
          </div>
        </div>

        <div className="px-3 py-2 bg-surface-sunken border border-line-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Entry Fee</span>
            <span className="text-xs font-bold text-white">
              {(league?.settings?.entryFee || 0).toLocaleString()} CC
            </span>
          </div>
          <p className="text-[10px] text-muted mt-1">
            Fixed for the life of the league — every member paid this on the way in, and the prize
            pool holds exactly what was collected.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-3 min-h-touch flex items-center justify-center gap-2 font-bold text-sm bg-interactive text-white hover:bg-interactive-hover disabled:bg-line disabled:text-muted disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : dirty ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </div>
  );
};

export default LeagueSettingsForm;
