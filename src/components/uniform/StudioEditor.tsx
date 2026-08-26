// =============================================================================
// STUDIO EDITOR — the Uniform Studio control surface
// =============================================================================
// Operates on a draft UniformDesignV2 immutably via onChange. Sections follow
// the app's uppercase-label grammar. Every option cross-combines (no item
// families); hues are always free. Derived figure flags (which procedural
// print is defined, plaid/foil defs, the glow filter, hair visibility) are
// recomputed after every edit so the stored design never carries stale defs.

import React, { useState } from 'react';
import { Shuffle } from 'lucide-react';
import type {
  ArmConfig,
  FigureConfig,
  LegConfig,
  PrintColorKey,
  UniformColorway,
  UniformDesignV2,
} from '../../types/uniform';
import {
  HAT_TYPE_OPTIONS,
  NAMED_COLORS,
  NECK_OPTIONS,
  PLUME_TYPE_OPTIONS,
  TORSO_PRINT_OPTIONS,
  TORSO_STYLE_OPTIONS,
  UNIFORM_PRESETS,
  designFromPreset,
} from '../../data/uniformCatalog';
import { FIGURE_HAIR_COLORS, FIGURE_SKIN_TONES } from '../../data/uniformRenderTheme';
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
}

export default function StudioEditor({ design, onChange }: StudioEditorProps) {
  const [armsLinked, setArmsLinked] = useState(true);
  const [legsLinked, setLegsLinked] = useState(true);
  const figure = design.figure;

  const setFigure = (patch: Partial<FigureConfig>) =>
    onChange({ ...design, figure: withDerivedFlags({ ...figure, ...patch }) });

  const setColorway = (patch: Partial<UniformColorway>) =>
    onChange({ ...design, colorway: { ...design.colorway, ...patch } });

  const setArm = (side: 'armL' | 'armR', patch: Partial<ArmConfig>) => {
    const current = armForEdit(figure, side);
    const next: ArmConfig = { ...current, ...patch };
    const both = armsLinked
      ? { armL: next, armR: { ...armForEdit(figure, 'armR'), ...patch } }
      : { [side]: next };
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
    const both = legsLinked
      ? { legL: next, legR: { ...legForEdit(figure, 'legR'), ...patch } }
      : { [side]: next };
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

  return (
    <div className="space-y-6">
      {/* Presets */}
      <section>
        <h3 className={SECTION_LABEL}>Presets — load, then swap anything</h3>
        <PresetStrip onLoad={loadPreset} />
      </section>

      {/* Colorway */}
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

      {/* Headwear */}
      <section>
        <h3 className={SECTION_LABEL}>Headwear</h3>
        <Pills
          options={HAT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={figure.hatType ?? null}
          onSelect={(v) =>
            setFigure(
              v
                ? {
                    hatType: v,
                    hat: figure.hat || {
                      body: darkenHex(design.colorway.primary, 0.55),
                      band: design.colorway.secondary,
                    },
                    plume:
                      v === 'campaign'
                        ? null
                        : figure.plume || { type: 'upright', color: design.colorway.accent },
                  }
                : { hatType: null, hat: null, plume: null }
            )
          }
        />
        {figure.hatType && figure.hat && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <ChannelRow
              label="Hat body"
              value={figure.hat.body}
              onChange={(v) => setFigure({ hat: { ...figure.hat!, body: v || '' } })}
            />
            <ChannelRow
              label="Hat band"
              value={figure.hat.band}
              onChange={(v) => setFigure({ hat: { ...figure.hat!, band: v } })}
              clearable
            />
          </div>
        )}
        {figure.hatType && figure.hatType !== 'campaign' && (
          <div className="mt-2 space-y-1">
            <Pills
              options={PLUME_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={figure.plume?.type ?? null}
              onSelect={(v) =>
                setFigure({
                  plume: v
                    ? { type: v, color: figure.plume?.color || design.colorway.accent }
                    : null,
                })
              }
            />
            {figure.plume && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <ChannelRow
                    label="Plume"
                    value={figure.plume.color}
                    onChange={(v) => setFigure({ plume: { ...figure.plume!, color: v || '' } })}
                  />
                </div>
                {figure.plume.type === 'upright' && (
                  <Toggle
                    label="Mylar sparkle"
                    checked={Boolean(figure.plume.mylar)}
                    onChange={(v) => setFigure({ plume: { ...figure.plume!, mylar: v } })}
                  />
                )}
              </div>
            )}
          </div>
        )}
        {!figure.hatType && (
          <div className="mt-2">
            <SwatchRow
              label="Hair"
              colors={FIGURE_HAIR_COLORS}
              value={figure.hair}
              onSelect={(hex) => setFigure({ hair: hex })}
            />
          </div>
        )}
      </section>

      {/* Torso */}
      <section>
        <h3 className={SECTION_LABEL}>Torso</h3>
        <Pills
          options={TORSO_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={figure.torsoStyle === 'tunic' ? 'tunic' : 'jacket'}
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

      {/* Chest */}
      <ChestSection figure={figure} colorway={design.colorway} onPatch={setFigure} />

      {/* Neck & extras */}
      <section>
        <h3 className={SECTION_LABEL}>Neck &amp; extras</h3>
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
            <ChannelRow label="Cowl" value={figure.cowl} onChange={(v) => setFigure({ cowl: v })} />
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
            <ChannelRow label="Tie" value={figure.tie} onChange={(v) => setFigure({ tie: v })} />
          )}
        </div>
      </section>

      {/* Waist */}
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
                v === 'band' ? figure.waistBand || darkenHex(design.colorway.primary, 0.6) : null,
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

      {/* Arms */}
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

      {/* Legs */}
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

      {/* Feet & figure */}
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
          <ChannelRow label="Shoes" value={figure.shoe} onChange={(v) => setFigure({ shoe: v })} />
        )}
        <SwatchRow
          label="Skin tone (previewed member)"
          colors={FIGURE_SKIN_TONES}
          value={figure.skin}
          onSelect={(hex) => setFigure({ skin: hex })}
        />
      </section>
    </div>
  );
}
