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
import { Check, Copy, Eye, Loader2, Save, Share2, Shirt, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import { PROFILE_CORPS_CLASS_ORDER, resolveCorpsForClass } from '../utils/corps';
import { CLASS_DISPLAY } from '../components/modals/uniformDesignOptions';
import UniformFigure from '../components/uniform/UniformFigure';
import StudioEditor from '../components/uniform/StudioEditor';
import UniformShareCard from '../components/uniform/UniformShareCard';
import { designFromPreset, UNIFORM_PRESETS } from '../data/uniformCatalog';
import { migrateV1Design, WARDROBE_LIMITS, withDerivedFlags } from '../utils/uniform';
import { designNoteFor } from '../data/designNotes';
import { sharePoster } from '../utils/posterExport';
import type { EquippedUniform, UniformDesignV2 } from '../types/uniform';
import type { CorpsData } from '../types';
import {
  deleteUniformDesign,
  equipUniformDesign,
  fetchUniformCode,
  listWardrobe,
  mintUniformCode,
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

  const doEquip = async (slot: 'primary' | 'alternate' = 'primary') => {
    if (!draft || !activeClass) return;
    setBusy(slot === 'alternate' ? 'equipAlt' : 'equip');
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
      await equipUniformDesign({ designId: id!, corpsClass: activeClass, slot });
      // the profile store's realtime listener picks up the new snapshot
      const corpsName = activeOption?.corps.corpsName || 'your corps';
      toast.success(
        slot === 'alternate' ? `Alternate look set for ${corpsName}` : `Equipped on ${corpsName}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to equip design');
    } finally {
      setBusy(null);
    }
  };

  const doClearAlt = async () => {
    if (!activeClass) return;
    setBusy('clearAlt');
    try {
      await equipUniformDesign({ designId: null, corpsClass: activeClass, slot: 'alternate' });
      toast.success('Alternate look cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear the alternate look');
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
    // strip doc metadata (incl. the server-owned shareCode) so the draft is a
    // pure design the save callable's whitelist accepts
    const { id, createdAt: _c, updatedAt: _u, shareCode: _sc, ...rest } = w;
    const design: UniformDesignV2 = { ...rest, schema: 2 };
    setDraft(design);
    setLoadedId(id);
    setMigrated(false);
    savedJson.current = JSON.stringify(design);
  };

  /** Save first when needed, so codes and cards always reflect a saved look. */
  const ensureSavedId = async (): Promise<string | null> => {
    if (!draft) return null;
    if (loadedId && !dirty) return loadedId;
    const saved = await saveUniformDesign({
      designId: loadedId || undefined,
      design: { ...draft, name: draft.name?.trim() || 'Untitled design' },
    });
    setLoadedId(saved.data.designId);
    savedJson.current = JSON.stringify(draft);
    void refreshWardrobe();
    return saved.data.designId;
  };

  const doGetCode = async () => {
    if (!draft) return;
    setBusy('code');
    try {
      const id = await ensureSavedId();
      if (!id) return;
      const minted = await mintUniformCode({ designId: id });
      const code = minted.data.code;
      try {
        await navigator.clipboard.writeText(code);
        toast.success(`Code ${code} copied — anyone can enter it in their Studio`);
      } catch {
        toast.success(`Your uniform code: ${code}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mint a code');
    } finally {
      setBusy(null);
    }
  };

  const [importCode, setImportCode] = useState('');
  const doImportCode = async () => {
    const raw = importCode.trim();
    if (!raw) return;
    setBusy('import');
    try {
      const shared = await fetchUniformCode(raw);
      if (!shared) {
        toast.error('No design found for that code — check it and try again.');
        return;
      }
      const design: UniformDesignV2 = {
        ...shared.design,
        schema: 2,
        figure: withDerivedFlags(shared.design.figure),
      };
      setDraft(design);
      setLoadedId(null); // an import is a fresh draft — saving adds it to YOUR wardrobe
      setMigrated(false);
      savedJson.current = '';
      setImportCode('');
      toast.success(`Design by ${shared.creatorName} loaded — save it to keep it`);
    } catch {
      toast.error('Could not look up that code. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const [shareCard, setShareCard] = useState<{ design: UniformDesignV2; code: string } | null>(
    null
  );
  const shareCardRef = useRef<SVGSVGElement | null>(null);
  const doShareCard = async () => {
    if (!draft) return;
    setBusy('card');
    try {
      const id = await ensureSavedId();
      if (!id) return;
      const minted = await mintUniformCode({ designId: id });
      setShareCard({ design: draft, code: minted.data.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the share card');
      setBusy(null);
    }
  };
  useEffect(() => {
    if (!shareCard) return;
    // let the offscreen card commit before serializing it
    const frame = requestAnimationFrame(() => {
      const corps = activeOption?.corps.corpsName || 'corps';
      const slug = corps
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      sharePoster(shareCardRef.current, {
        filename: `${slug || 'corps'}-uniform-card.png`,
        title: `${corps} — marching.art`,
        text: `${corps}'s new look, designed in the marching.art Uniform Studio. Import it with code ${shareCard.code}.`,
      })
        .then((outcome) => {
          if (outcome === 'downloaded') toast.success('Share card saved as a PNG');
          if (outcome === 'shared') toast.success('Share card sent');
        })
        .catch(() => toast.error('Could not export the share card'))
        .finally(() => {
          setShareCard(null);
          setBusy(null);
        });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCard]);

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
                  <button
                    type="button"
                    onClick={() => void doGetCode()}
                    disabled={busy !== null}
                    title="Mint a shareable code — anyone can enter it to import this design"
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {busy === 'code' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Get code
                  </button>
                  <button
                    type="button"
                    onClick={() => void doShareCard()}
                    disabled={busy !== null}
                    title="Export a field-entrance share card with your uniform code on it"
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {busy === 'card' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    Share card
                  </button>
                  <button
                    type="button"
                    onClick={() => void doEquip('alternate')}
                    disabled={busy !== null}
                    title="Set this design as the corps' optional second look (finals week / exhibition)"
                    className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {busy === 'equipAlt' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Equip as alt
                  </button>
                  {activeOption?.corps.uniformAlt && (
                    <button
                      type="button"
                      onClick={() => void doClearAlt()}
                      disabled={busy !== null}
                      title={`Remove the alternate look (currently ${activeOption.corps.uniformAlt.name})`}
                      className="h-10 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {busy === 'clearAlt' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      Clear alt
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-2">
                  Saving stores the design in your wardrobe. Equipping puts it on{' '}
                  {activeOption?.corps.corpsName} everywhere; the alternate is an optional second
                  look shown on your profile. The AI avatar is optional and never automatic.
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
                {/* Import a shared design by its code (§7.1) */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-line">
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void doImportCode();
                    }}
                    placeholder="Have a code? MA-XXXX-XX"
                    aria-label="Import a uniform code"
                    className="flex-1 h-9 px-2 bg-background border border-line rounded-none text-xs text-white font-mono uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-interactive"
                  />
                  <button
                    type="button"
                    onClick={() => void doImportCode()}
                    disabled={busy !== null || !importCode.trim()}
                    className="h-9 px-3 border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive disabled:opacity-40"
                  >
                    {busy === 'import' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Import'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Controls column */}
            <div className="bg-surface-card border border-line p-4">
              {/* Design Note: a contextual principle from the craft (§ In-studio guidance) */}
              <p className="text-[11px] italic text-muted border-l-2 border-interactive/40 pl-2 mb-4">
                {designNoteFor(draft.figure)}
              </p>
              <StudioEditor design={draft} onChange={setDraft} />
            </div>
          </div>
        )}

        {/* Offscreen share card, mounted only while exporting */}
        {shareCard && activeOption && (
          <div className="fixed -left-[2000px] top-0 w-[1200px]" aria-hidden="true">
            <UniformShareCard
              ref={shareCardRef}
              design={shareCard.design}
              corpsName={activeOption.corps.corpsName}
              classLabel={
                CLASS_DISPLAY[activeClass as keyof typeof CLASS_DISPLAY]?.name || activeClass || ''
              }
              code={shareCard.code}
            />
          </div>
        )}
      </div>
    </div>
  );
}
