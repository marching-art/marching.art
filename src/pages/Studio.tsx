// =============================================================================
// UNIFORM STUDIO — /studio
// =============================================================================
// The corps-identity fashion surface (docs/UNIFORM_STUDIO.md §5): a live
// UniformFigure canvas beside the StudioEditor controls. Deep-linkable via
// ?corps={class}. Save/equip are explicit callable-mediated actions — saving
// never fires AI generation and never switches the profile picture (the
// entanglements the old modal had). The press-box toggle previews the design
// at field distance, which doubles as a legibility check.
//
// Layout contract (the paper-doll loop): the Studio is a viewport-locked
// workstation — the page itself never scrolls, so the doll can never leave
// the screen (the game-locker idiom: fixed stage, fixed navigation, one
// panel that scrolls internally). Desktop: the canvas fills the left column
// while the controls column shows the tab strip over exactly one section.
// Mobile (<lg): canvas card + tab strip stack above the single scrolling
// section panel — every edit is visible the instant it lands, and nothing
// is sticky or floating over other content. The canvas runs a framing
// camera (StudioCanvas) so the doll region being edited fills the compact
// stage, and the pinned chrome stays minimal: undo/redo overlay the canvas
// and the design name lives in the More sheet. Tapping the figure jumps to
// the matching section (FigureTapOverlay); every draft edit is undoable
// (useDraftHistory).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Redo2, Shirt, Store, Undo2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import { PROFILE_CORPS_CLASS_ORDER, resolveCorpsForClass } from '../utils/corps';
import { getClassDisplay } from '../components/Profile/directorProfileHelpers';
import StudioEditor from '../components/uniform/StudioEditor';
import StudioActionBar from '../components/uniform/StudioActionBar';
import StudioCorpsPicker from '../components/uniform/StudioCorpsPicker';
import StudioCanvas from '../components/uniform/StudioCanvas';
import StudioSectionTabs from '../components/uniform/StudioSectionTabs';
import PresetGallery from '../components/uniform/PresetGallery';
import WardrobePanel from '../components/uniform/WardrobePanel';
import UniformShareCard from '../components/uniform/UniformShareCard';
import StudioViewTools, { TOOL_INACTIVE } from '../components/uniform/StudioViewTools';
import { initialDesignFor, isFreshCorps, type CorpsOption } from '../components/uniform/studioInit';
import { designFromPreset, type UniformPreset } from '../data/uniformCatalog';
import { WARDROBE_LIMITS, withDerivedFlags } from '../utils/uniform';
import PackAdvisoryBanner from '../components/uniform/PackAdvisoryBanner';
import { designNoteFor } from '../data/designNotes';
import { sharePoster } from '../utils/posterExport';
import type { StudioTabId } from '../components/uniform/studioSections';
import { useDraftHistory } from '../hooks/useDraftHistory';
import { triggerHaptic } from '../hooks/useHaptic';
import type { UniformDesignV2 } from '../types/uniform';
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
import { publishUniformDesign } from '../api/designExchange';
import { generateCorpsAvatar } from '../api/articleAdmin';
import { useSEO } from '../hooks/useSEO';
import Heading from '../components/ui/Heading';

const ZOOM_STEPS = [1, 1.5, 2];

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

  // The draft lives in an undo/redo history: editor changes go through
  // history.set (undoable, coalesced), context switches through history.reset.
  const history = useDraftHistory<UniformDesignV2>();
  const draft = history.present;
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeDesign[]>([]);
  const [pressBox, setPressBox] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [peeking, setPeeking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTabId>('presets');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryFirstRun = useRef(false);
  const gallerySeen = useRef(new Set<string>());
  const savedJson = useRef<string>('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Design-house packs: previewing gated pieces is free everywhere; the
  // server rejects the SAVE until the pack is owned. The advisory banner and
  // the editor's 🔒 marks mirror that gate client-side (utils/uniformPacks).
  const ownedPacks = profile?.cosmetics?.owned;

  // (Re)initialize the draft when the active corps changes. A corps with no
  // design at all gets the first-run preset gallery ("pick a starting look").
  const initKey = `${activeClass || ''}:${Boolean(activeOption?.corps.uniform)}`;
  useEffect(() => {
    const { design, migrated: wasMigrated } = initialDesignFor(activeOption);
    history.reset(design);
    setMigrated(wasMigrated);
    setLoadedId(activeOption?.corps.uniform?.designId || null);
    savedJson.current = JSON.stringify(design);
    setActiveTab('presets');
    if (isFreshCorps(activeOption) && activeClass && !gallerySeen.current.has(activeClass)) {
      galleryFirstRun.current = true;
      setGalleryOpen(true);
    }
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

  // /studio?code=MA-XXXX-XX — the /share/uniform landing path: import the
  // shared design as a fresh draft, once, then drop the param.
  const paramCode = searchParams.get('code');
  useEffect(() => {
    if (!paramCode) return;
    let cancelled = false;
    void (async () => {
      const shared = await fetchUniformCode(paramCode).catch(() => null);
      if (cancelled) return;
      if (!shared) {
        toast.error('No design found for that share link.');
      } else {
        history.reset({
          ...shared.design,
          schema: 2,
          figure: withDerivedFlags(shared.design.figure),
        });
        setLoadedId(null);
        setMigrated(false);
        savedJson.current = '';
        toast.success(`Design by ${shared.creatorName} loaded — save it to keep it`);
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('code');
          return next;
        },
        { replace: true }
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramCode]);

  const dirty = draft ? JSON.stringify(draft) !== savedJson.current : false;

  // Ctrl/Cmd+Z undo, +Shift redo — ignored while typing in a field.
  const { undo: undoDraft, redo: redoDraft } = history;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      if (e.shiftKey) redoDraft();
      else undoDraft();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redoDraft, undoDraft]);

  /**
   * Section navigation — shared by the tab strip, the figure tap overlay,
   * and the editor's prev/next footer. Switching sections is an instant
   * panel swap (no smooth-scrolling through a stack); the panel just starts
   * from its top like a fresh screen.
   */
  const handleSectionSelect = useCallback((id: StudioTabId) => {
    setActiveTab(id);
    triggerHaptic('light');
    const panel = panelRef.current;
    if (panel) {
      try {
        panel.scrollTo({ top: 0 });
      } catch {
        panel.scrollTop = 0; // jsdom / older engines
      }
    }
  }, []);

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
      triggerHaptic('success');
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

  const doEquip = async (slot: 'primary' | 'alternate' | 'guard' = 'primary') => {
    if (!draft || !activeClass) return;
    setBusy(slot === 'alternate' ? 'equipAlt' : slot === 'guard' ? 'equipGuard' : 'equip');
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
      triggerHaptic('success');
      toast.success(
        slot === 'alternate'
          ? `Alternate look set for ${corpsName}`
          : slot === 'guard'
            ? `Guard look set for ${corpsName}'s show`
            : `Equipped on ${corpsName}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to equip design');
    } finally {
      setBusy(null);
    }
  };

  const doPublish = async () => {
    if (!draft) return;
    setBusy('publish');
    try {
      // publishing always works from a saved design; save first when needed
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
      const result = await publishUniformDesign({ designId: id! });
      toast.success(result.data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish design');
    } finally {
      setBusy(null);
    }
  };

  const doClearSlot = async (slot: 'alternate' | 'guard') => {
    if (!activeClass) return;
    const noun = slot === 'guard' ? 'guard look' : 'alternate look';
    setBusy(slot === 'guard' ? 'clearGuard' : 'clearAlt');
    try {
      await equipUniformDesign({ designId: null, corpsClass: activeClass, slot });
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} cleared`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to clear the ${noun}`);
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

  /** Context switches replace the whole draft — confirm when work would be lost. */
  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes to this design?');

  const switchCorps = (classKey: string) => {
    if (classKey === activeClass) return;
    if (!confirmDiscard()) return;
    setSearchParams({ corps: classKey }, { replace: true });
  };

  const loadFromWardrobe = (w: WardrobeDesign) => {
    if (!confirmDiscard()) return;
    // strip doc metadata (incl. the server-owned shareCode) so the draft is a
    // pure design the save callable's whitelist accepts
    const { id, createdAt: _c, updatedAt: _u, shareCode: _sc, ...rest } = w;
    const design: UniformDesignV2 = { ...rest, schema: 2 };
    history.reset(design);
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
      // the /share link unfurls into a design card wherever it's pasted and
      // lands humans back here with the code pre-applied
      const shareLink = `https://marching.art/share/uniform/${code}`;
      try {
        await navigator.clipboard.writeText(`${code} — ${shareLink}`);
        toast.success(`Code ${code} + share link copied — paste it anywhere`);
      } catch {
        toast.success(`Your uniform code: ${code}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mint a code');
    } finally {
      setBusy(null);
    }
  };

  const doImportCode = async (raw: string): Promise<boolean> => {
    if (!raw) return false;
    if (!confirmDiscard()) return false;
    setBusy('import');
    try {
      const shared = await fetchUniformCode(raw);
      if (!shared) {
        toast.error('No design found for that code — check it and try again.');
        return false;
      }
      const design: UniformDesignV2 = {
        ...shared.design,
        schema: 2,
        figure: withDerivedFlags(shared.design.figure),
      };
      history.reset(design);
      setLoadedId(null); // an import is a fresh draft — saving adds it to YOUR wardrobe
      setMigrated(false);
      savedJson.current = '';
      toast.success(`Design by ${shared.creatorName} loaded — save it to keep it`);
      return true;
    } catch {
      toast.error('Could not look up that code. Please try again.');
      return false;
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

  const pickPreset = (preset: UniformPreset) => {
    const fresh = designFromPreset(preset);
    history.set({ ...fresh, figure: withDerivedFlags(fresh.figure) });
    if (activeClass) gallerySeen.current.add(activeClass);
    galleryFirstRun.current = false;
    setGalleryOpen(false);
    triggerHaptic('medium');
  };

  const closeGallery = () => {
    if (activeClass) gallerySeen.current.add(activeClass);
    galleryFirstRun.current = false;
    setGalleryOpen(false);
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

  const equippedFigure = activeOption?.corps.uniform?.figure || null;
  const displayFigure = peeking && equippedFigure ? equippedFigure : draft?.figure;
  const canPeek = Boolean(equippedFigure);

  const cycleZoom = () =>
    setZoom((z) => ZOOM_STEPS[(ZOOM_STEPS.indexOf(z) + 1) % ZOOM_STEPS.length]);

  const viewToolProps = {
    pressBox,
    onPressBox: setPressBox,
    zoom,
    onCycleZoom: cycleZoom,
    canPeek,
    peeking,
    onPeekChange: setPeeking,
  };

  return (
    // GameShell's <main> is fixed with overflow-hidden; the Studio fills it as
    // a locked workstation. Desktop never page-scrolls (only the section panel
    // and canvas column scroll internally); mobile keeps overflow-y-auto as a
    // relief valve for very short viewports where the fixed stack can't fit.
    <div className="h-full overflow-y-auto lg:overflow-hidden flex flex-col">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 py-3 border-b border-line">
          <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Shirt className="w-4 h-4 text-interactive" />
            Uniform Studio
          </h1>
          <Link
            to="/exchange"
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-interactive hover:text-white"
          >
            <Store className="w-3 h-3" />
            Design Exchange
          </Link>
          <div className="ml-auto min-w-0">
            <StudioCorpsPicker
              options={corpsOptions}
              activeClass={activeClass}
              onSelect={switchCorps}
            />
          </div>
        </div>

        {migrated && (
          <div className="shrink-0 bg-interactive/10 border border-interactive/30 p-3 mt-3 text-xs text-muted">
            <span className="text-interactive font-bold uppercase mr-2">Rebuilt in the Studio</span>
            Your written uniform description was translated into a starting design — refine it, then
            save and equip. Your current avatar is untouched.
          </div>
        )}

        {draft && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 pt-2 pb-3 lg:pt-4 lg:pb-4 lg:grid lg:grid-cols-[minmax(300px,380px)_1fr] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
            {/* Canvas column — the stage. Fixed in the flow (never sticky):
                on mobile it stacks above the tab strip + panel; on desktop
                the card stretches to the full grid row and the canvas takes
                whatever height is left after the fixed rows. overflow-y-auto
                is the relief valve for short desktop viewports. */}
            <div className="shrink-0 lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
              <div className="bg-surface-card border border-line p-3 sm:p-4 lg:h-full lg:flex lg:flex-col">
                {/* Name + undo/redo row — desktop only. On mobile the name
                    lives in the More sheet and undo/redo overlay the canvas,
                    so the pinned stack spends its pixels on the doll. */}
                <div className="hidden lg:flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={draft.name}
                    maxLength={WARDROBE_LIMITS.maxNameLength}
                    onChange={(e) => history.set({ ...draft, name: e.target.value })}
                    aria-label="Design name"
                    className="flex-1 min-w-0 h-9 px-2 bg-background border border-line rounded-none text-sm text-white focus:outline-none focus:border-interactive"
                  />
                  <button
                    type="button"
                    onClick={history.undo}
                    disabled={!history.canUndo}
                    aria-label="Undo"
                    title="Undo (Ctrl+Z)"
                    className={`${TOOL_INACTIVE} disabled:opacity-30`}
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={history.redo}
                    disabled={!history.canRedo}
                    aria-label="Redo"
                    title="Redo (Ctrl+Shift+Z)"
                    className={`${TOOL_INACTIVE} disabled:opacity-30`}
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Desktop view controls: labeled preview modes + zoom + peek */}
                <StudioViewTools variant="row" {...viewToolProps} />

                {displayFigure && (
                  <>
                    <div className="lg:hidden">
                      <StudioCanvas
                        mode="compact"
                        figure={displayFigure}
                        label={`${draft.name || 'Uniform'} preview`}
                        pressBox={pressBox}
                        zoom={zoom}
                        activeSection={activeTab}
                        onRegionSelect={handleSectionSelect}
                        tools={<StudioViewTools variant="overlay" {...viewToolProps} />}
                        toolsLeft={
                          <>
                            <button
                              type="button"
                              onClick={history.undo}
                              disabled={!history.canUndo}
                              aria-label="Undo"
                              className={`${TOOL_INACTIVE} disabled:opacity-30`}
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={history.redo}
                              disabled={!history.canRedo}
                              aria-label="Redo"
                              className={`${TOOL_INACTIVE} disabled:opacity-30`}
                            >
                              <Redo2 className="w-4 h-4" />
                            </button>
                          </>
                        }
                      />
                    </div>
                    {/* Desktop: the stage takes all the height the card's
                        fixed rows leave over, so the doll fills the column. */}
                    <div className="hidden lg:block lg:flex-1 lg:min-h-0">
                      <StudioCanvas
                        mode="full"
                        figure={displayFigure}
                        label={`${draft.name || 'Uniform'} preview`}
                        pressBox={pressBox}
                        zoom={zoom}
                        activeSection={activeTab}
                        onRegionSelect={handleSectionSelect}
                      />
                    </div>
                  </>
                )}

                <PackAdvisoryBanner figure={draft.figure} owned={ownedPacks} />

                <StudioActionBar
                  busy={busy}
                  dirty={dirty}
                  name={draft.name}
                  maxNameLength={WARDROBE_LIMITS.maxNameLength}
                  onRename={(name) => history.set({ ...draft, name })}
                  altName={activeOption?.corps.uniformAlt?.name}
                  guardName={activeOption?.corps.uniformGuard?.name}
                  onSave={(asNew) => void doSave(asNew)}
                  onEquip={(slot) => void doEquip(slot)}
                  onClearSlot={(slot) => void doClearSlot(slot)}
                  onAvatar={() => void doGenerateAvatar()}
                  onGetCode={() => void doGetCode()}
                  onShareCard={() => void doShareCard()}
                  onPublish={() => void doPublish()}
                />
                <p className="hidden lg:block text-[10px] text-muted mt-2">
                  Saving stores the design in your wardrobe. Equipping puts it on{' '}
                  {activeOption?.corps.corpsName} everywhere; the alternate is an optional second
                  look shown on your profile. The guard look dresses this season&rsquo;s show — try
                  the Guard dress silhouette — and resets with the show at rollover. The AI avatar
                  is optional and never automatic.
                </p>
              </div>
            </div>

            {/* Controls column: tab strip over exactly one section, in one
                card. Only the panel below the tabs scrolls — switching tabs
                swaps the panel content and resets it to the top, like a
                screen change, on every breakpoint. */}
            <div className="flex-1 min-h-[16rem] lg:min-h-0 min-w-0 flex flex-col bg-surface-card border border-line">
              <StudioSectionTabs
                className="shrink-0"
                active={activeTab}
                onSelect={handleSectionSelect}
              />
              <div
                ref={panelRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-momentum scrollbar-thin p-3 sm:p-4 pb-8"
              >
                {/* Design Note: a contextual principle from the craft (§ In-studio guidance) */}
                <p
                  className={`text-[11px] italic text-muted border-l-2 border-interactive/40 pl-2 mb-4 ${
                    activeTab === 'wardrobe' ? 'hidden' : ''
                  }`}
                >
                  {designNoteFor(draft.figure)}
                </p>
                <StudioEditor
                  design={draft}
                  onChange={history.set}
                  ownedPacks={ownedPacks}
                  activeSection={activeTab}
                  onSectionChange={handleSectionSelect}
                  onBrowsePresets={() => setGalleryOpen(true)}
                />
                {/* Mobile Wardrobe tab (desktop uses the shelf below) */}
                <WardrobePanel
                  frameless
                  className={`lg:hidden ${activeTab === 'wardrobe' ? '' : 'hidden'}`}
                  wardrobe={wardrobe}
                  loadedId={loadedId}
                  busy={busy}
                  maxDesigns={WARDROBE_LIMITS.maxDesigns}
                  onLoad={loadFromWardrobe}
                  onDelete={(w) => void doDelete(w)}
                  onImport={doImportCode}
                />
              </div>

              {/* Desktop wardrobe shelf: saved looks always one click away,
                  pinned under the section panel (the game-loadout idiom) —
                  which also keeps Wardrobe out of the section tab strip. */}
              <div className="hidden lg:block shrink-0 border-t border-line p-3 sm:p-4">
                <WardrobePanel
                  frameless
                  wardrobe={wardrobe}
                  loadedId={loadedId}
                  busy={busy}
                  maxDesigns={WARDROBE_LIMITS.maxDesigns}
                  onLoad={loadFromWardrobe}
                  onDelete={(w) => void doDelete(w)}
                  onImport={doImportCode}
                />
              </div>
            </div>
          </div>
        )}

        {/* Preset gallery: first run for a fresh corps, and "See all" after */}
        {galleryOpen && draft && (
          <PresetGallery
            firstRun={galleryFirstRun.current}
            onPick={pickPreset}
            onClose={closeGallery}
          />
        )}

        {/* Offscreen share card, mounted only while exporting */}
        {shareCard && activeOption && (
          <div className="fixed -left-[2000px] top-0 w-[1200px]" aria-hidden="true">
            <UniformShareCard
              ref={shareCardRef}
              design={shareCard.design}
              corpsName={activeOption.corps.corpsName}
              classLabel={activeClass ? getClassDisplay(activeClass).name : ''}
              code={shareCard.code}
            />
          </div>
        )}
      </div>
    </div>
  );
}
