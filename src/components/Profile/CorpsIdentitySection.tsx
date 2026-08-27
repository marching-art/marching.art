// =============================================================================
// CORPS IDENTITY — the profile's uniform section
// =============================================================================
// The Uniform Studio's home on the profile (docs/UNIFORM_STUDIO.md §5.1):
// each registered corps shows its equipped uniform figure with colorway
// swatches; the owner gets an "Open Studio" path. Public profiles render it
// read-only — the profile doc is world-readable, and the figure is pure data.
// A corps with only a v1 written description shows a client-side migrated
// draft so the section is never empty for existing directors.

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Shirt } from 'lucide-react';
import { Section } from './DirectorProfileParts';
import UniformFigure from '../uniform/UniformFigure';
import { PROFILE_CORPS_CLASS_ORDER, resolveCorpsForClass } from '../../utils/corps';
import { migrateV1Design } from '../../utils/uniform';
import type { CorpsData } from '../../types';
import type { EquippedUniform, UniformColorway } from '../../types/uniform';

interface CorpsIdentitySectionProps {
  corps: Record<string, CorpsData | undefined> | undefined;
  isOwnProfile: boolean;
}

interface IdentityCard {
  /** Unique card key — `${classKey}` or `${classKey}-alt`. */
  cardKey: string;
  classKey: string;
  corpsName: string;
  figure: EquippedUniform['figure'];
  colorway: UniformColorway;
  lookName: string;
  isDraft: boolean;
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span
      title={label}
      style={{ backgroundColor: hex }}
      className="inline-block w-3.5 h-3.5 border border-line-strong"
    />
  );
}

export default function CorpsIdentitySection({ corps, isOwnProfile }: CorpsIdentitySectionProps) {
  const cards: IdentityCard[] = useMemo(() => {
    const out: IdentityCard[] = [];
    for (const classKey of PROFILE_CORPS_CLASS_ORDER) {
      const entry = resolveCorpsForClass(corps, classKey) as
        | (CorpsData & {
            uniform?: EquippedUniform;
            uniformAlt?: EquippedUniform;
            uniformGuard?: EquippedUniform;
          })
        | undefined;
      if (!entry?.corpsName) continue;
      if (entry.uniform) {
        out.push({
          cardKey: classKey,
          classKey,
          corpsName: entry.corpsName,
          figure: entry.uniform.figure,
          colorway: entry.uniform.colorway,
          lookName: entry.uniform.name,
          isDraft: false,
        });
      } else if (entry.uniformDesign?.primaryColor) {
        const draft = migrateV1Design(entry.uniformDesign, entry.corpsName);
        out.push({
          cardKey: classKey,
          classKey,
          corpsName: entry.corpsName,
          figure: draft.figure,
          colorway: draft.colorway,
          lookName: 'Draft from written design',
          isDraft: true,
        });
      }
      // The optional second look (finals week / exhibition) rides beside the
      // identity uniform as its own card.
      if (entry.uniformAlt) {
        out.push({
          cardKey: `${classKey}-alt`,
          classKey,
          corpsName: entry.corpsName,
          figure: entry.uniformAlt.figure,
          colorway: entry.uniformAlt.colorway,
          lookName: `Alt · ${entry.uniformAlt.name}`,
          isDraft: false,
        });
      }
      // The guard's show look (per-season; resets with the show at rollover).
      if (entry.uniformGuard) {
        out.push({
          cardKey: `${classKey}-guard`,
          classKey,
          corpsName: entry.corpsName,
          figure: entry.uniformGuard.figure,
          colorway: entry.uniformGuard.colorway,
          lookName: `Guard · ${entry.uniformGuard.name}`,
          isDraft: false,
        });
      }
    }
    return out;
  }, [corps]);

  if (cards.length === 0 && !isOwnProfile) return null;

  return (
    <div className="px-3 pb-3">
      <Section
        icon={Shirt}
        title="Corps Identity"
        action={
          isOwnProfile ? (
            <Link
              to="/studio"
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-interactive hover:text-white"
            >
              <Palette className="w-3 h-3" />
              Open Studio
            </Link>
          ) : undefined
        }
      >
        {cards.length === 0 ? (
          <div className="p-4 text-xs text-muted">
            No uniforms designed yet —{' '}
            <Link to="/studio" className="text-interactive hover:underline">
              open the Uniform Studio
            </Link>{' '}
            to build your corps&rsquo; identity.
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((card) => {
              const body = (
                <>
                  <div className="max-w-[96px] mx-auto">
                    <UniformFigure
                      figure={card.figure}
                      label={`${card.corpsName} uniform${card.isDraft ? ' draft' : ''}`}
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white truncate">
                      {card.corpsName}
                    </span>
                    <span className="block text-[9px] uppercase tracking-wider text-muted truncate">
                      {card.lookName}
                    </span>
                    <span className="inline-flex gap-0.5 mt-1">
                      <Swatch hex={card.colorway.primary} label="Primary" />
                      <Swatch hex={card.colorway.secondary} label="Secondary" />
                      <Swatch hex={card.colorway.accent} label="Accent" />
                    </span>
                  </div>
                </>
              );
              return isOwnProfile ? (
                <Link
                  key={card.cardKey}
                  to={`/studio?corps=${card.classKey}`}
                  className="block bg-background border border-line hover:border-interactive p-2"
                >
                  {body}
                </Link>
              ) : (
                <div key={card.cardKey} className="bg-background border border-line p-2">
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
