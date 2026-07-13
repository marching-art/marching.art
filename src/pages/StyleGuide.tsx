// =============================================================================
// STYLE GUIDE — living reference for the unified visual identity
// =============================================================================
// Renders the actual design tokens and primitives so the system stays in sync
// with the code (docs/DESIGN_SYSTEM.md). Route: /styleguide.
// Token-only by construction — it is its own conformance test.

import React from 'react';
import { Trophy, Link2, AlertTriangle, Medal } from 'lucide-react';
import { Heading, type HeadingLevel } from '../components/ui/Heading';
import { headingRecipes } from '../components/ui/headingRecipes';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const Swatch: React.FC<{ token: string; bg: string; note?: string; dark?: boolean }> = ({
  token,
  bg,
  note,
  dark,
}) => (
  <div className="flex items-center gap-3">
    <div className={`w-12 h-12 flex-shrink-0 border border-line ${bg}`} />
    <div className="min-w-0">
      <div className={`text-sm font-bold ${dark ? 'text-muted' : 'text-main'}`}>{token}</div>
      {note && <div className="text-xs text-muted tabular-nums">{note}</div>}
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border border-line bg-surface-card p-5">
    <Heading level="section" className="mb-4">
      {title}
    </Heading>
    {children}
  </section>
);

const typeSamples: { level: HeadingLevel; sample: string }[] = [
  { level: 'display', sample: 'Draft your dream corps' },
  { level: 'title', sample: 'Season Standings' },
  { level: 'section', sample: 'Your Lineup' },
  { level: 'eyebrow', sample: 'World Class' },
];

const StyleGuide: React.FC = () => (
  <div className="min-h-screen bg-background text-main px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-line pb-5">
        <Heading level="display">Visual Identity</Heading>
        <p className="mt-2 text-secondary">
          The token vocabulary and primitives every screen is built from. Gold is identity and
          reward; azure is interaction and self; green/red/amber are data; everything else is quiet
          charcoal.
        </p>
      </header>

      <Section title="Brand & Interaction">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Swatch token="brand (gold)" bg="bg-brand" note="10.3:1 · logo, reward, #1, currency" />
          <Swatch
            token="interactive (azure)"
            bg="bg-interactive"
            note="5.4:1 · links, actions, active, you"
          />
        </div>
      </Section>

      <Section title="Status — data only">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch token="success" bg="bg-success" note="8.8:1" />
          <Swatch token="warning" bg="bg-warning" note="9.2:1" />
          <Swatch token="error" bg="bg-error" note="6.2:1" />
          <Swatch token="trend-up" bg="bg-trend-up" note="up / win" />
        </div>
      </Section>

      <Section title="Neutral surface ramp">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Swatch token="background" bg="bg-background" dark />
          <Swatch token="surface-sunken" bg="bg-surface-sunken" dark />
          <Swatch token="surface-card" bg="bg-surface-card" dark />
          <Swatch token="surface-raised" bg="bg-surface-raised" dark />
          <Swatch token="surface-elevated" bg="bg-surface-elevated" dark />
          <Swatch token="line (hairline)" bg="bg-line" dark />
        </div>
      </Section>

      <Section title="Text tokens">
        <div className="space-y-1">
          <p className="text-main">text-main — primary content (19.8:1)</p>
          <p className="text-secondary">text-secondary — supporting copy (9.4:1)</p>
          <p className="text-muted">text-muted — labels &amp; captions (6.9:1)</p>
          <p className="text-brand">text-brand — reward emphasis</p>
          <p className="text-interactive">text-interactive — links &amp; actions</p>
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-4">
          {typeSamples.map(({ level, sample }) => (
            <div
              key={level}
              className="flex flex-col gap-1 border-b border-line pb-3 last:border-0"
            >
              <span className="text-xs text-muted">
                &lt;Heading level=&quot;{level}&quot;&gt; · {headingRecipes[level]}
              </span>
              <Heading level={level}>{sample}</Heading>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Corners are square">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center border border-line bg-surface-raised text-xs text-muted">
            box
          </div>
          <span className="text-muted">rounded-none on boxes</span>
          <div className="ml-4 h-10 w-10 rounded-full border border-line bg-surface-raised" />
          <span className="text-muted">rounded-full only for circles/pills</span>
        </div>
      </Section>

      <Section title="Primitives">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <Card>
            <Card.Header>
              <Card.Title>Card Title</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="p-4 text-secondary">
                Flat fill, one hairline border, square corners. No glow, no gradient.
              </div>
            </Card.Body>
          </Card>
        </div>
      </Section>

      <Section title="Gold: do &amp; don't">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border border-line bg-surface-raised p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-success">Do</div>
            <div className="flex items-center gap-2 text-brand">
              <Trophy className="h-5 w-5" />
              <Medal className="h-5 w-5" />
              <span className="font-bold">Champion · #1 · 1,200 CorpsCoin</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Reward &amp; identity — gold earns its meaning.
            </p>
          </div>
          <div className="border border-line bg-surface-raised p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-error">Don't</div>
            <div className="flex items-center gap-2 text-interactive">
              <Link2 className="h-5 w-5" />
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span className="font-bold">Links use azure · warnings use amber</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Never spend gold on generic links, buttons, or icons.
            </p>
          </div>
        </div>
      </Section>

      <footer className="border-t border-line pt-4 text-xs text-muted">
        Reference for docs/DESIGN_SYSTEM.md. Enforced by{' '}
        <span className="text-secondary">npm run census:check</span>.
      </footer>
    </div>
  </div>
);

export default StyleGuide;
