// Shared Admin panel UI primitives: the panel card, its header, the job/process
// row, key-value rows, stat tiles, and the in-section jump bar. Every Admin
// section is composed from these so the whole console reads as one tool.

import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, Play, RefreshCw } from 'lucide-react';

type IconComponent = ComponentType<{ className?: string }>;

// =============================================================================
// SECTION HEADER
// =============================================================================

interface SectionHeaderProps {
  title: string;
  icon?: IconComponent;
  /** Right-aligned controls (refresh buttons, filters). */
  actions?: ReactNode;
}

export const SectionHeader = ({ title, icon: Icon, actions }: SectionHeaderProps) => (
  <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center gap-2">
    {Icon && <Icon className="w-3.5 h-3.5 text-muted" />}
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">{title}</h3>
    {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
  </div>
);

// =============================================================================
// PANEL — the card every tool lives in
// =============================================================================

interface PanelProps {
  title: string;
  icon?: IconComponent;
  /** Anchor id: the section jump bar scrolls here. */
  id?: string;
  /** One or two lines of "what this is for", under the header. */
  description?: ReactNode;
  actions?: ReactNode;
  /** Renders children flush (tables, process rows) instead of padded. */
  flush?: boolean;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

export const Panel = ({
  title,
  icon,
  id,
  description,
  actions,
  flush,
  tone = 'default',
  children,
}: PanelProps) => (
  <section
    id={id}
    aria-label={title}
    className={`bg-surface-card border overflow-hidden scroll-mt-4 ${
      tone === 'danger' ? 'border-red-500/40' : 'border-line'
    }`}
  >
    <SectionHeader title={title} icon={icon} actions={actions} />
    {description && (
      <p className="px-4 pt-3 text-[11px] text-muted leading-relaxed">{description}</p>
    )}
    <div className={flush ? (description ? 'mt-3' : '') : 'p-4'}>{children}</div>
  </section>
);

// =============================================================================
// PROCESS ROW — one runnable job
// =============================================================================

interface ProcessRowProps {
  name: string;
  description: string;
  icon?: IconComponent;
  loading?: boolean;
  caution?: boolean;
  onExecute: () => void;
  /** Button text; defaults to "Run". */
  actionLabel?: string;
}

export const ProcessRow = ({
  name,
  description,
  icon: Icon,
  loading,
  caution,
  onExecute,
  actionLabel = 'Run',
}: ProcessRowProps) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-surface-sunken transition-colors">
    <div className="flex items-start gap-3 min-w-0">
      {caution ? (
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" aria-hidden />
      ) : (
        Icon && <Icon className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[11px] text-muted leading-snug">{description}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onExecute}
      disabled={loading}
      aria-label={`${actionLabel} ${name}`}
      className={`flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase border disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 ${
        caution
          ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning hover:text-black'
          : 'bg-interactive/10 text-interactive border-interactive/20 hover:bg-interactive hover:text-white'
      }`}
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
      {loading ? 'Running' : actionLabel}
    </button>
  </div>
);

// =============================================================================
// INFO ROW — label / value
// =============================================================================

interface InfoRowProps {
  label: string;
  value?: ReactNode;
  badge?: boolean;
  mono?: boolean;
}

export const InfoRow = ({ label, value, badge, mono }: InfoRowProps) => (
  <div className="flex justify-between items-center gap-3 px-4 py-2.5 border-b border-line-subtle last:border-b-0">
    <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
    {badge ? (
      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-bold uppercase">
        {value}
      </span>
    ) : (
      <span
        className={`text-sm text-white text-right truncate ${mono ? 'font-data tabular-nums' : 'font-medium'}`}
      >
        {value ?? '—'}
      </span>
    )}
  </div>
);

// =============================================================================
// STAT TILE
// =============================================================================

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
}

const STAT_TONES: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'text-white',
  good: 'text-green-500',
  warn: 'text-warning',
  bad: 'text-red-500',
  accent: 'text-interactive',
};

export const StatTile = ({ label, value, hint, tone = 'default' }: StatTileProps) => (
  <div className="bg-surface-sunken border border-line p-3 min-w-0">
    <p className="text-[9px] uppercase tracking-wider text-muted truncate">{label}</p>
    <p className={`text-lg font-bold font-data tabular-nums ${STAT_TONES[tone]}`}>{value}</p>
    {hint && <p className="text-[10px] text-muted truncate">{hint}</p>}
  </div>
);

// =============================================================================
// SECTION JUMP BAR — anchors to the panels of a long section
// =============================================================================

export interface JumpLink {
  id: string;
  label: string;
}

export const JumpBar = ({ links }: { links: JumpLink[] }) => (
  <nav aria-label="Jump to panel" className="flex flex-wrap gap-1.5">
    {links.map((link) => (
      <a
        key={link.id}
        href={`#${link.id}`}
        onClick={(event) => {
          // The admin content scrolls inside its own container, so let the
          // browser scroll the target into view instead of changing the hash
          // (which would fight the router's ?tab= state).
          const target = document.getElementById(link.id);
          if (!target) return;
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border border-line text-muted hover:text-white hover:border-interactive transition-colors"
      >
        {link.label}
      </a>
    ))}
  </nav>
);

// =============================================================================
// SMALL INPUT + BUTTON ROW (day pickers, email boxes)
// =============================================================================

export const inputClass =
  'px-3 py-2 bg-surface-sunken border border-line text-xs text-white focus:outline-none focus:border-interactive';

export const actionButtonClass =
  'flex items-center justify-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/20 hover:bg-interactive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
