// =============================================================================
// STUDIO EDITOR — the Uniform Studio control surface
// =============================================================================
// Operates on a draft UniformDesignV2 immutably via onChange. Sections follow
// the app's uppercase-label grammar. Every option cross-combines (no item
// families); hues are always free. Derived figure flags (which procedural
// print is defined, plaid/foil defs, the glow filter, hair visibility) are
// recomputed after every edit so the stored design never carries stale defs.

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import type {
  ArmConfig,
  FigureConfig,
  LegConfig,
  PrintColorKey,
  UniformColorway,
  UniformDesignV2,
} from '../../types/uniform';
import {
  NAMED_COLORS,
  NECK_OPTIONS,
  TORSO_PRINT_OPTIONS,
  TORSO_STYLE_OPTIONS,
  UNIFORM_PRESETS,
  designFromPreset,
} from '../../data/uniformCatalog';
import { FIGURE_SKIN_TONES } from '../../data/uniformRenderTheme';
import {
  applyColorway,
  armFadeStops,
  darkenHex,
  normalizeFigure,
  printColorValues,
  safeHex,
  withArmFade,
  withDerivedFlags,
} from '../../utils/uniform';
import {
  ChannelRow,
  LABEL,
  Pills,
  PresetStrip,
  PrintColorRows,
  SECTION_LABEL,
  SwatchRow,
  Toggle,
} from './StudioControls';
import { ArmControls, LegControls } from './StudioLimbControls';
import ChestSection from './StudioChestControls';
import HeadwearSection from './StudioHeadwearControls';
import { StudioColorwayContext } from './studioColorContext';
import {
  STUDIO_SECTIONS,
  sectionAnchorId,
  type StudioSectionId,
  type StudioTabId,
} from './studioSections';

// ---------------------------------------------------------------------------
// per-side editors
// ---------------------------------------------------------------------------

function armForEdit(figure: FigureConfig, side: 'armL' | 'armR'): ArmConfig {
  return normalizeFigure(figure)[side];
}
function legForEdit(figure: FigureConfig, side: 'legL' | 'legR'): LegConfig {
  return normalizeFigure(figure)[side];
}

// ---------------------------------------------------------------------------
// the editor
// ---------------------------------------------------------------------------

export interface StudioEditorProps {
  design: UniformDesignV2;
  onChange: (next: UniformDesignV2) => void;
  /** Owned shop item ids (profile cosmetics.owned) — drives the 🔒 marks on
   *  design-house pack content. Previewing is always free; the lock only
   *  signals "own to save" (the server enforces it at write time). */
  ownedPacks?: string[];
  /**
   * The tab the section panel is showing — exactly one section renders at a
   * time on every breakpoint (the game-locker idiom; the tab strip and the
   * figure tap overlay do the navigating). The other sections stay mounted
   * but hidden, so per-side link state survives tab switches.
   * Null/undefined shows everything (legacy stack, kept for tests).
   */
  activeSection?: StudioTabId | null;
  /** Section navigation from inside the panel (the prev/next footer). */
  onSectionChange?: (id: StudioTabId) => void;
  /** Opens the full preset gallery (the "See all" affordance). */
  onBrowsePresets?: () => void;
}

export default function StudioEditor({
  design,
  onChange,
  ownedPacks,
  activeSection,
  onSectionChange,
  onBrowsePresets,
}: StudioEditorProps) {
  const [armsLinked, setArmsLinked] = useState(true);
  const [legsLinked, setLegsLinked] = useState(true);
  const figure = design.figure;

  const packLabel = (label: string, packId: string) =>
    (ownedPacks || []).includes(packId) ? label : `${label} 🔒`;

  const setFigure = (patch: Partial<FigureConfig>) =>
    onChange({ ...design, figure: withDerivedFlags({ ...figure, ...patch }) });

  const setColorway = (patch: Partial<UniformColorway>) =>
    onChange({ ...design, colorway: { ...design.colorway, ...patch } });

  const setArm = (side: 'armL' | 'armR', patch: Partial<ArmConfig>) => {
    const current = armForEdit(figure, side);
    const next: ArmConfig = { ...current, ...patch };
    // Always write BOTH sides. When unlinked, the untouched side is written as
    // its current (normalized) config rather than left out — omitting it once
    // cleared the symmetric shorthands and left that side `undefined`, which
    // crashed the renderer (see normalizeFigure).
    const both = armsLinked
      ? { armL: next, armR: { ...armForEdit(figure, 'armR'), ...patch } }
      : {
          armL: side === 'armL' ? next : armForEdit(figure, 'armL'),
          armR: side === 'armR' ? next : armForEdit(figure, 'armR'),
        };
    setFigure({
      ...both,
      // clear the symmetric shorthands so per-side configs are authoritative
      sleeve: undefined,
      gauntlet: undefined,
      gauntletSequin: undefined,
      glove: undefined,
    });
  };

  const setLeg = (side: 'legL' | 'legR', patch: Partial<LegConfig>) => {
    const current = legForEdit(figure, side);
    const next: LegConfig = { ...current, ...patch };
    // Same as setArm: write both sides so per-side editing never leaves the
    // untouched leg `undefined` after the symmetric shorthands are cleared.
    const both = legsLinked
      ? { legL: next, legR: { ...legForEdit(figure, 'legR'), ...patch } }
      : {
          legL: side === 'legL' ? next : legForEdit(figure, 'legL'),
          legR: side === 'legR' ? next : legForEdit(figure, 'legR'),
        };
    setFigure({ ...both, pants: undefined, stripe: undefined });
  };

  const loadPreset = (presetId: string) => {
    const preset = UNIFORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const fresh = designFromPreset(preset, design.name);
    onChange({ ...design, colorway: fresh.colorway, figure: withDerivedFlags(fresh.figure) });
  };

  const randomize = () => {
    const preset = UNIFORM_PRESETS[Math.floor(Math.random() * UNIFORM_PRESETS.length)];
    const pool = NAMED_COLORS.map((c) => c.hex);
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    const cw: UniformColorway = {
      primary: pick(),
      secondary: pick(),
      accent: pick(),
      metal: Math.random() < 0.5 ? 'gold' : 'silver',
    };
    const fresh = designFromPreset(preset, design.name);
    onChange({
      ...design,
      colorway: cw,
      figure: withDerivedFlags(applyColorway(fresh.figure, cw)),
    });
  };

  const neckValue = figure.cowl
    ? 'cowl'
    : figure.mockNeck
      ? 'mock'
      : figure.collar
        ? 'collar'
        : figure.crew
          ? 'crew'
          : 'none';

  const setNeck = (v: string) => {
    setFigure({
      collar: v === 'collar' ? safeHex(figure.jacket || design.colorway.primary) : null,
      collarTrim: v === 'collar' ? design.colorway.secondary : null,
      mockNeck: v === 'mock' ? safeHex(figure.jacket || design.colorway.primary) : null,
      cowl: v === 'cowl' ? darkenHex(design.colorway.primary, 0.25) : null,
      crew: v === 'crew',
    });
  };

  const torsoPrint = figure.torsoFill?.startsWith('url:')
    ? figure.torsoFill === 'url:sun'
      ? 'sunburst'
      : figure.torsoFill.slice(4)
    : null;

  const setTorsoPrint = (v: string | null) => {
    setFigure({
      torsoFill: v === null ? null : v === 'sunburst' ? 'url:sun' : `url:${v}`,
    });
  };

  const setPrintColor = (surface: PrintColorKey, index: number, hex: string) => {
    const next = printColorValues(figure, surface).map((c, i) => (i === index ? safeHex(hex) : c));
    setFigure({ printColors: { ...figure.printColors, [surface]: next } });
  };

  const waistValue = figure.waistBand ? 'band' : figure.belt ? 'belt' : 'none';

  // Section wrapper: addressable anchor + tab filtering (see the activeSection
  // prop). The active section re-enters with a short slide-up — toggling the
  // animation class off (hidden) and back on restarts it on each switch.
  const sec = (id: StudioSectionId, node: React.ReactNode) => (
    <div
      key={id}
      id={sectionAnchorId(id)}
      data-section={id}
      className={
        activeSection != null && activeSection !== id
          ? 'hidden'
          : activeSection != null
            ? 'motion-safe:animate-slide-in-bottom'
            : ''
      }
    >
      {node}
    </div>
  );

  // Prev/next footer — the head-to-feet walk without leaving the panel.
  const sectionIndex = STUDIO_SECTIONS.findIndex((s) => s.id === activeSection);
  const prevSection = sectionIndex > 0 ? STUDIO_SECTIONS[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex >= 0 && sectionIndex < STUDIO_SECTIONS.length - 1
      ? STUDIO_SECTIONS[sectionIndex + 1]
      : null;
  const stepBtn =
    'flex items-center gap-1 px-3 py-2 min-h-touch sm:min-h-0 text-[11px] font-bold uppercase tracking-wider border border-line text-muted hover:text-white hover:border-interactive';

  return (
    <StudioColorwayContext.Provider value={design.colorway}>
      <div className={activeSection == null ? 'space-y-6' : ''}>
        {sec(
          'presets',
          <section>
            <div className="flex items-center justify-between border-b border-line pb-1 mb-3">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Presets — load, then swap anything
              </h3>
              {onBrowsePresets && (
                <button
                  type="button"
                  onClick={onBrowsePresets}
                  className="text-[10px] font-bold uppercase tracking-wider text-interactive hover:text-white"
                >
                  See all
                </button>
              )}
            </div>
            <PresetStrip onLoad={loadPreset} />
          </section>
        )}

        {sec(
          'colorway',
          <section>
            <h3 className={SECTION_LABEL}>Corps colorway</h3>
            <div className="grid grid-cols-3 gap-2">
              <ChannelRow
                label="Primary"
                value={design.colorway.primary}
                onChange={(v) => setColorway({ primary: v || design.colorway.primary })}
              />
              <ChannelRow
                label="Secondary"
                value={design.colorway.secondary}
                onChange={(v) => setColorway({ secondary: v || design.colorway.secondary })}
              />
              <ChannelRow
                label="Accent"
                value={design.colorway.accent}
                onChange={(v) => setColorway({ accent: v || design.colorway.accent })}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Pills
                options={[
                  { value: 'gold', label: 'Gold hardware' },
                  { value: 'silver', label: 'Silver hardware' },
                ]}
                value={design.colorway.metal}
                onSelect={(v) => setColorway({ metal: v as UniformColorway['metal'] })}
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...design,
                    figure: withDerivedFlags(applyColorway(figure, design.colorway)),
                  })
                }
                className="ml-auto h-9 px-3 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover"
              >
                Apply to all
              </button>
              <button
                type="button"
                onClick={randomize}
                aria-label="Surprise me"
                className="h-9 px-3 border border-line text-muted hover:text-white hover:border-interactive"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {sec(
          'headwear',
          <HeadwearSection
            figure={figure}
            colorway={design.colorway}
            onPatch={setFigure}
            packLabel={packLabel}
          />
        )}

        {sec(
          'torso',
          <section>
            <h3 className={SECTION_LABEL}>Torso</h3>
            <Pills
              options={TORSO_STYLE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.value === 'longcoat' ? packLabel(o.label, 'pack_tailors_cut') : o.label,
              }))}
              value={
                figure.torsoStyle === 'tunic' ||
                figure.torsoStyle === 'dress' ||
                figure.torsoStyle === 'longcoat'
                  ? figure.torsoStyle
                  : 'jacket'
              }
              onSelect={(v) => setFigure({ torsoStyle: v as FigureConfig['torsoStyle'] })}
            />
            <div className="mt-2">
              <span className={LABEL}>Print</span>
              <Pills
                options={TORSO_PRINT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={torsoPrint}
                onSelect={(v) => setTorsoPrint(v)}
              />
            </div>
            {figure.print && (
              <div className="mt-2">
                <span className={LABEL}>Print colors</span>
                <PrintColorRows figure={figure} surface={figure.print} onSlot={setPrintColor} />
              </div>
            )}
            {!figure.torsoFill && (
              <ChannelRow
                label="Jacket"
                value={figure.jacket}
                onChange={(v) => setFigure({ jacket: v })}
              />
            )}
            <div className="flex flex-wrap gap-3 mt-1">
              <Toggle
                label="Satin sheen"
                checked={Boolean(figure.satin)}
                onChange={(v) => setFigure({ satin: v })}
              />
              <Toggle
                label="Velvet"
                checked={Boolean(figure.velvet)}
                onChange={(v) => setFigure({ velvet: v })}
              />
              <Toggle
                label={packLabel('Iridescent', 'pack_texture_atelier')}
                checked={Boolean(figure.iridescent)}
                onChange={(v) => setFigure({ iridescent: v })}
              />
              <Toggle
                label={packLabel('Lamé shimmer', 'pack_texture_atelier')}
                checked={Boolean(figure.lame)}
                onChange={(v) => setFigure({ lame: v })}
              />
              <Toggle
                label="Patent gloss"
                checked={Boolean(figure.patent)}
                onChange={(v) => setFigure({ patent: v })}
              />
              <Toggle
                label="Sequin field"
                checked={Boolean(figure.torsoSequin)}
                onChange={(v) => setFigure({ torsoSequin: v })}
              />
              <Toggle
                label="Glow line-art"
                checked={Boolean(figure.glowArt)}
                onChange={(v) => setFigure({ glowArt: v ? design.colorway.secondary : null })}
              />
            </div>
          </section>
        )}

        {sec(
          'chest',
          <ChestSection figure={figure} colorway={design.colorway} onPatch={setFigure} />
        )}

        {sec(
          'shoulders',
          <section>
            <h3 className={SECTION_LABEL}>Shoulders &amp; neck</h3>
            <Pills
              options={NECK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={neckValue}
              onSelect={setNeck}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {neckValue === 'collar' && (
                <>
                  <ChannelRow
                    label="Collar"
                    value={figure.collar}
                    onChange={(v) => setFigure({ collar: v })}
                  />
                  <ChannelRow
                    label="Collar trim"
                    value={figure.collarTrim}
                    onChange={(v) => setFigure({ collarTrim: v })}
                    clearable
                  />
                </>
              )}
              {neckValue === 'mock' && (
                <ChannelRow
                  label="Mock neck"
                  value={
                    typeof figure.mockNeck === 'string' && !figure.mockNeck.startsWith('url:')
                      ? figure.mockNeck
                      : null
                  }
                  onChange={(v) => setFigure({ mockNeck: v })}
                />
              )}
              {neckValue === 'cowl' && (
                <ChannelRow
                  label="Cowl"
                  value={figure.cowl}
                  onChange={(v) => setFigure({ cowl: v })}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1">
              <Toggle
                label="Epaulets"
                checked={Boolean(figure.epaulet)}
                onChange={(v) => setFigure({ epaulet: v ? design.colorway.secondary : null })}
              />
              <Toggle
                label="Suspenders"
                checked={Boolean(figure.suspenders)}
                onChange={(v) =>
                  setFigure({ suspenders: v ? darkenHex(design.colorway.secondary, 0.3) : null })
                }
              />
              <Toggle
                label="Neckerchief"
                checked={Boolean(figure.scarf)}
                onChange={(v) => setFigure({ scarf: v ? design.colorway.accent : null })}
              />
              <Toggle
                label="Sequin tie"
                checked={Boolean(figure.tie)}
                onChange={(v) => setFigure({ tie: v ? design.colorway.accent : null })}
              />
              <Toggle
                label={packLabel('Shoulder cape', 'pack_military_outfitters')}
                checked={Boolean(figure.cape)}
                onChange={(v) =>
                  setFigure({
                    cape: v
                      ? {
                          color: design.colorway.secondary,
                          lining: design.colorway.accent,
                        }
                      : null,
                  })
                }
              />
              {figure.cape && (
                <Toggle
                  label="Other shoulder"
                  checked={figure.cape.side === 'right'}
                  onChange={(v) =>
                    setFigure({ cape: { ...figure.cape!, side: v ? 'right' : 'left' } })
                  }
                />
              )}
              <Toggle
                label={packLabel('Drum major cord', 'title_drum_major')}
                checked={Boolean(figure.aiguillette)}
                onChange={(v) => setFigure({ aiguillette: v ? design.colorway.accent : null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {figure.epaulet && (
                <ChannelRow
                  label="Epaulets"
                  value={figure.epaulet}
                  onChange={(v) => setFigure({ epaulet: v })}
                />
              )}
              {figure.suspenders && (
                <ChannelRow
                  label="Suspenders"
                  value={figure.suspenders}
                  onChange={(v) => setFigure({ suspenders: v })}
                />
              )}
              {figure.scarf && (
                <ChannelRow
                  label="Neckerchief"
                  value={figure.scarf}
                  onChange={(v) => setFigure({ scarf: v })}
                />
              )}
              {figure.tie && (
                <ChannelRow
                  label="Tie"
                  value={figure.tie}
                  onChange={(v) => setFigure({ tie: v })}
                />
              )}
              {figure.aiguillette && (
                <ChannelRow
                  label="Cord"
                  value={figure.aiguillette}
                  onChange={(v) => setFigure({ aiguillette: v })}
                />
              )}
              {figure.cape && (
                <>
                  <ChannelRow
                    label="Cape"
                    value={figure.cape.color}
                    onChange={(v) => setFigure({ cape: { ...figure.cape!, color: v || '' } })}
                  />
                  <ChannelRow
                    label="Cape lining"
                    value={figure.cape.lining}
                    onChange={(v) => setFigure({ cape: { ...figure.cape!, lining: v } })}
                    clearable
                  />
                </>
              )}
            </div>
          </section>
        )}

        {sec(
          'waist',
          <section>
            <h3 className={SECTION_LABEL}>Waist &amp; flow</h3>
            <Pills
              options={[
                { value: 'none', label: 'None' },
                { value: 'belt', label: 'Belt / cummerbund' },
                { value: 'band', label: 'Angled band' },
              ]}
              value={waistValue}
              onSelect={(v) =>
                setFigure({
                  belt: v === 'belt' ? figure.belt || design.colorway.secondary : null,
                  buckle: v === 'belt' ? figure.buckle || design.colorway.accent : null,
                  waistBand:
                    v === 'band'
                      ? figure.waistBand || darkenHex(design.colorway.primary, 0.6)
                      : null,
                  waistBandEdge:
                    v === 'band' ? figure.waistBandEdge || design.colorway.secondary : null,
                })
              }
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {waistValue === 'belt' && (
                <>
                  <ChannelRow
                    label="Belt"
                    value={figure.belt}
                    onChange={(v) => setFigure({ belt: v })}
                  />
                  <ChannelRow
                    label="Buckle"
                    value={figure.buckle}
                    onChange={(v) => setFigure({ buckle: v })}
                    clearable
                  />
                </>
              )}
              {waistValue === 'band' && (
                <>
                  <ChannelRow
                    label="Band"
                    value={figure.waistBand}
                    onChange={(v) => setFigure({ waistBand: v })}
                  />
                  <ChannelRow
                    label="Band edge"
                    value={figure.waistBandEdge}
                    onChange={(v) => setFigure({ waistBandEdge: v })}
                    clearable
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1">
              <Toggle
                label="Hip fringe"
                checked={Boolean(figure.fringe)}
                onChange={(v) => setFigure({ fringe: v ? design.colorway.secondary : null })}
              />
              <Toggle
                label="Streamers"
                checked={Boolean(figure.streamers)}
                onChange={(v) =>
                  setFigure({
                    streamers: v ? [design.colorway.primary, design.colorway.accent] : null,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {figure.fringe && (
                <ChannelRow
                  label="Fringe"
                  value={figure.fringe}
                  onChange={(v) => setFigure({ fringe: v })}
                />
              )}
              {figure.streamers && (
                <>
                  <ChannelRow
                    label="Streamer outer"
                    value={figure.streamers[0]}
                    onChange={(v) => setFigure({ streamers: [v || '', figure.streamers![1]] })}
                  />
                  <ChannelRow
                    label="Streamer inner"
                    value={figure.streamers[1]}
                    onChange={(v) => setFigure({ streamers: [figure.streamers![0], v || ''] })}
                  />
                </>
              )}
            </div>
          </section>
        )}

        {sec(
          'arms',
          <section>
            <div className="flex items-center justify-between border-b border-line pb-1 mb-3">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider">Arms</h3>
              <Toggle label="Link sides" checked={armsLinked} onChange={setArmsLinked} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ArmControls
                title={armsLinked ? 'Both arms' : 'Left arm'}
                arm={armForEdit(figure, 'armL')}
                jacket={figure.jacket}
                colorway={design.colorway}
                fade={armFadeStops(figure, 'armL')}
                onPatch={(patch) => setArm('armL', patch)}
                onFade={(stops) => setFigure(withArmFade(figure, 'armL', stops, armsLinked))}
              />
              {!armsLinked && (
                <ArmControls
                  title="Right arm"
                  arm={armForEdit(figure, 'armR')}
                  jacket={figure.jacket}
                  colorway={design.colorway}
                  fade={armFadeStops(figure, 'armR')}
                  onPatch={(patch) => setArm('armR', patch)}
                  onFade={(stops) => setFigure(withArmFade(figure, 'armR', stops, false))}
                />
              )}
            </div>
          </section>
        )}

        {sec(
          'legs',
          <section>
            <div className="flex items-center justify-between border-b border-line pb-1 mb-3">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider">Legs</h3>
              <Toggle label="Link sides" checked={legsLinked} onChange={setLegsLinked} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LegControls
                title={legsLinked ? 'Both legs' : 'Left leg'}
                leg={legForEdit(figure, 'legL')}
                torsoPrint={torsoPrint}
                torsoFill={figure.torsoFill}
                onPatch={(patch) => setLeg('legL', patch)}
              />
              {!legsLinked && (
                <LegControls
                  title="Right leg"
                  leg={legForEdit(figure, 'legR')}
                  torsoPrint={torsoPrint}
                  torsoFill={figure.torsoFill}
                  onPatch={(patch) => setLeg('legR', patch)}
                />
              )}
            </div>
            {figure.plaid && (
              <div className="mt-3">
                <span className={LABEL}>Plaid colors</span>
                <PrintColorRows figure={figure} surface="plaid" onSlot={setPrintColor} />
              </div>
            )}
            {figure.foilLeg && (
              <div className="mt-3">
                <span className={LABEL}>Foil colors</span>
                <PrintColorRows figure={figure} surface="foil" onSlot={setPrintColor} />
              </div>
            )}
          </section>
        )}

        {sec(
          'feet',
          <section>
            <h3 className={SECTION_LABEL}>Feet &amp; figure</h3>
            <div className="flex flex-wrap gap-3">
              <Toggle
                label="Athletic sneakers"
                checked={Boolean(figure.sneaker)}
                onChange={(v) => setFigure({ sneaker: v })}
              />
              <Toggle
                label="Spats"
                checked={Boolean(figure.spats)}
                onChange={(v) => setFigure({ spats: v })}
              />
            </div>
            {!figure.sneaker && (
              <ChannelRow
                label="Shoes"
                value={figure.shoe}
                onChange={(v) => setFigure({ shoe: v })}
              />
            )}
            <SwatchRow
              label="Skin tone (previewed member)"
              colors={FIGURE_SKIN_TONES}
              value={figure.skin}
              onSelect={(hex) => setFigure({ skin: hex })}
            />
          </section>
        )}

        {sectionIndex >= 0 && onSectionChange && (
          <div className="flex items-center justify-between gap-2 border-t border-line mt-6 pt-3">
            {prevSection ? (
              <button
                type="button"
                onClick={() => onSectionChange(prevSection.id)}
                className={stepBtn}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {prevSection.label}
              </button>
            ) : (
              <span />
            )}
            {nextSection && (
              <button
                type="button"
                onClick={() => onSectionChange(nextSection.id)}
                className={stepBtn}
              >
                {nextSection.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </StudioColorwayContext.Provider>
  );
}
