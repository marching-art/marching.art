// =============================================================================
// UNIFORM STUDIO — /studio
// =============================================================================
// The corps-identity fashion surface (docs/UNIFORM_STUDIO.md §5): a live
// UniformFigure canvas beside the StudioEditor controls. Deep-linkable via
// ?corps={class}. Save/equip are explicit callable-mediated actions — saving
// never fires AI generation and never switches the profile picture (the
// entanglements the old modal had). The press-box toggle previews the design
// at field distance, which doubles as a legibility check.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Eye, Loader2, Save, Shirt, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import { PROFILE_CORPS_CLASS_ORDER, resolveCorpsForClass } from '../utils/corps';
import { CLASS_DISPLAY } from '../components/modals/uniformDesignOptions';
import UniformFigure from '../components/uniform/UniformFigure';
import StudioEditor from '../components/uniform/StudioEditor';
import { designFromPreset, UNIFORM_PRESETS } from '../data/uniformCatalog';
import { migrateV1Design, WARDROBE_LIMITS } from '../utils/uniform';
import type { EquippedUniform, UniformDesignV2 } from '../types/uniform';
import type { CorpsData } from '../types';
import {
  deleteUniformDesign,
  equipUniformDesign,
  listWardrobe,
  saveUniformDesign,
  type WardrobeDesign,
} from '../api/uniformStudio';
import { generateCorpsAvatar } from '../api/articleAdmin';
import { useSEO } from '../hooks/useSEO';
import Heading from '../components/ui/Heading';

interface CorpsOption {
  classKey: string;
  corps: CorpsData & { uniform?: EquippedUniform };
}

function initialDesignFor(option: CorpsOption | undefined): {
  design: UniformDesignV2;
  migrated: boolean;
} {
  if (option?.corps.uniform) {
    const { designId: _id, equippedAt: _at, ...rest } = option.corps.uniform;
    return { design: { ...rest, schema: 2 }, migrated: false };
  }
  if (option?.corps.uniformDesign?.primaryColor) {
    return {
      design: migrateV1Design(option.corps.uniformDesign, option.corps.corpsName),
      migrated: true,
    };
  }
  return { design: designFromPreset(UNIFORM_PRESETS[0]), migrated: false };
}

export default function Studio() {
  useSEO({
    title: 'Uniform Studio | marching.art',
    description: 'Design your corps identity: uniforms, colorways, and wardrobe.',
  });
  const { user } = useAuth() || {};
  const profile = useProfileStore((s) => s.profile);
  const [searchParams, setSearchParams] = useSearchParams();

  const corpsOptions: CorpsOption[] = useMemo(() => {
    const corpsMap = (profile?.corps || {}) as Record<string, CorpsData>;
    return (PROFILE_CORPS_CLASS_ORDER as readonly string[])
      .map((classKey) => ({
        classKey,
        corps: resolveCorpsForClass(corpsMap, classKey) as CorpsOption['corps'],
      }))
      .filter((o): o is CorpsOption => Boolean(o.corps?.corpsName));
  }, [profile?.corps]);

  const paramClass = searchParams.get('corps');
  const activeClass =
    corpsOptions.find((o) => o.classKey === paramClass)?.classKey || corpsOptions[0]?.classKey;
  const activeOption = corpsOptions.find((o) => o.classKey === activeClass);

  const [draft, setDraft] = useState<UniformDesignV2 | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeDesign[]>([]);
  const [pressBox, setPressBox] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const savedJson = useRef<string>('');

  // (Re)initialize the draft when the active corps changes.
  const initKey = `${activeClass || ''}:${Boolean(activeOption?.corps.uniform)}`;
  useEffect(() => {
    const { design, migrated: wasMigrated } = initialDesignFor(activeOption);
    setDraft(design);
    setMigrated(wasMigrated);
    setLoadedId(activeOption?.corps.uniform?.designId || null);
    savedJson.current = JSON.stringify(design);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey]);

  const refreshWardrobe = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setWardrobe(await listWardrobe(user.uid));
    } catch {
      // non-fatal: the strip just stays empty
    }
  }, [user?.uid]);

  useEffect(() => {
    void refreshWardrobe();
  }, [refreshWardrobe]);

  const dirty = draft ? JSON.stringify(draft) !== savedJson.current : false;

  const doSave = async (asNew: boolean): Promise<string | null> => {
    if (!draft) return null;
    const name = draft.name?.trim() || 'Untitled design';
    setBusy(asNew ? 'saveNew' : 'save');
    try {
      const result = await saveUniformDesign({
        designId: asNew ? undefined : loadedId || undefined,
        design: { ...draft, name },
      });
      setLoadedId(result.data.designId);
      savedJson.current = JSON.stringify({ ...draft, name });
      toast.success(asNew ? 'Saved as a new design' : 'Design saved');
      void refreshWardrobe();
      return result.data.designId;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const doEquip = async () => {
    if (!draft || !activeClass) return;
    setBusy('equip');
    try {
      // equip always works from a saved design; save first when needed
      let id = loadedId;
      if (!id || dirty) {
        const saved = await saveUniformDesign({
          designId: loadedId || undefined,
          design: draft,
        });
        id = saved.data.designId;
        setLoadedId(id);
        savedJson.current = JSON.stringify(draft);
        void refreshWardrobe();
      }
      await equipUniformDesign({ designId: id!, corpsClass: activeClass });
      // the profile store's realtime listener picks up the new snapshot
      toast.success(`Equipped on ${activeOption?.corps.corpsName || 'your corps'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to equip design');
    } finally {
      setBusy(null);
    }
  };

  const doGenerateAvatar = async () => {
    if (!activeClass) return;
    setBusy('avatar');
    try {
      await toast.promise(generateCorpsAvatar({ corpsClass: activeClass }), {
        loading: 'Generating AI avatar…',
        success: 'Avatar updated',
        error: (e: unknown) => (e instanceof Error ? e.message : 'Avatar generation failed'),
      });
    } finally {
      setBusy(null);
    }
  };

  const loadFromWardrobe = (w: WardrobeDesign) => {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = w;
    const design: UniformDesignV2 = { ...rest, schema: 2 };
    setDraft(design);
    setLoadedId(id);
    setMigrated(false);
    savedJson.current = JSON.stringify(design);
  };

  const doDelete = async (w: WardrobeDesign) => {
    setBusy(`del:${w.id}`);
    try {
      await deleteUniformDesign({ designId: w.id });
      if (loadedId === w.id) setLoadedId(null);
      toast.success('Design deleted');
      void refreshWardrobe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete design');
    } finally {
      setBusy(null);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (corpsOptions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Shirt className="w-8 h-8 mx-auto text-muted mb-3" />
        <Heading level="title" as="h1" className="mb-2">
          Uniform Studio
        </Heading>
        <p className="text-sm text-muted">
          Register a corps from the dashboard first — then come back to design its identity.
        </p>
      </div>
    );
  }

  return (
    // GameShell's <main> is fixed with overflow-hidden, so each page must own
    // its scroll container (Shop.jsx idiom) — without this wrapper the Studio
    // is clipped to the first viewport and can't scroll at all on mobile.
    <div className="h-full overflow-y-auto scroll-momentum">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-24">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 py-4 border-b border-line">
          <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Shirt className="w-4 h-4 text-interactive" />
            Uniform Studio
          </h1>
          <div className="flex gap-1 ml-auto overflow-x-auto">
            {corpsOptions.map((o) => (
              <button
                key={o.classKey}
                type="button"
                onClick={() => setSearchParams({ corps: o.classKey }, { replace: true })}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border rounded-none whitespace-nowrap min-h-touch sm:min-h-0 ${
                  o.classKey === activeClass
                    ? 'bg-interactive border-interactive text-white'
                    : 'bg-background border-line text-muted hover:border-interactive hover:text-white'
                }`}
              >
                {o.corps.corpsName}
                <span
                  className={`ml-1.5 ${CLASS_DISPLAY[o.classKey as keyof typeof CLASS_DISPLAY]?.color || ''}`}
                >
                  {CLASS_DISPLAY[o.classKey as keyof typeof CLASS_DISPLAY]?.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {migrated && (
          <div className="bg-interactive/10 border border-interactive/30 p-3 mt-3 text-xs text-muted">
            <span className="text-interactive font-bold uppercase mr-2">Rebuilt in the Studio</span>
            Your written uniform description was translated into a starting design — refine it, then
            save and equip. Your current avatar is untouched.
          </div>
        )}

        {draft && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-6 mt-4">
            {/* Canvas column */}
            <div className="lg:sticky lg:top-4 self-start">
              <div className="bg-surface-card border border-line p-4">
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    value={draft.name}
                    maxLength={WARDROBE_LIMITS.maxNameLength}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    aria-label="Design name"
                    className="flex-1 h-9 px-2 bg-background border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
                  />
                  <button
                    type="button"
                    onClick={() => setPressBox((v) => !v)}
                    title="Press-box view — does it read from the stands?"
                    className={`ml-2 h-9 px-2.5 border rounded-none ${
                      pressBox
                        ? 'bg-interactive border-interactive text-white'
                        : 'border-line text-muted hover:text-white hover:border-interactive'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {pressBox ? (
                  <div className="h-64 sm:h-80 flex items-end justify-center gap-4 bg-surface-sunken border border-line p-4">
                    {[0, 1, 2].map((i) => (
                      <UniformFigure
                        key={i}
                        figure={draft.figure}
                        label="Press-box preview figure"
                        width={34}
                      />
                    ))}
                  </div>
                ) : (
                  // Sized down on phones so the canvas card (figure + actions)
                  // stays near one screenful and the controls are a short scroll
                  // away; full size from sm up.
                  <div className="max-w-[210px] sm:max-w-[280px] mx-auto">
                    <UniformFigure
                      figure={draft.figure}
                      label={`${draft.name || 'Uniform'} preview`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => void doSave(false)}
                    disabled={busy !== null || !dirty}
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {busy === 'save' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void doEquip()}
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
                    onClick={() => void doSave(true)}
                    disabled={busy !== null}
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40"
                  >
                    Save as new
                  </button>
                  <button
                    type="button"
                    onClick={() => void doGenerateAvatar()}
                    disabled={busy !== null}
                    title="Optional: regenerate the AI avatar from this corps' saved design"
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI avatar
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-2">
                  Saving stores the design in your wardrobe. Equipping puts it on{' '}
                  {activeOption?.corps.corpsName} everywhere. The AI avatar is optional and never
                  automatic.
                </p>
              </div>

              {/* Wardrobe strip */}
              <div className="bg-surface-card border border-line p-4 mt-4">
                <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 mb-3">
                  Wardrobe ({wardrobe.length}/{WARDROBE_LIMITS.maxDesigns})
                </h3>
                {wardrobe.length === 0 ? (
                  <p className="text-xs text-muted">
                    No saved designs yet — save your first look to start a wardrobe.
                  </p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {wardrobe.map((w) => (
                      <div
                        key={w.id}
                        className={`flex-shrink-0 w-20 border p-1 ${
                          w.id === loadedId ? 'border-interactive' : 'border-line'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => loadFromWardrobe(w)}
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
                            onClick={() => void doDelete(w)}
                            disabled={busy !== null}
                            aria-label={`Delete ${w.name}`}
                            className="text-muted hover:text-red-400"
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
              </div>
            </div>

            {/* Controls column */}
            <div className="bg-surface-card border border-line p-4">
              <StudioEditor design={draft} onChange={setDraft} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
