// =============================================================================
// INSTALL STEPS — renders a utils/installGuide InstallGuide
// =============================================================================
// Shared by the /install page, the Settings "Install App" entry and the
// transient nudge, so all three show the same numbered, browser-specific steps.
// The decision tree (which steps, for whom) is pure and lives in
// utils/installGuide.ts; this file only turns it into markup.

import React, { useCallback, useState } from 'react';
import {
  Share,
  MoreVertical,
  MoreHorizontal,
  Menu,
  Plus,
  SquarePlus,
  Download,
  Compass,
  Dock,
  Check,
  Copy,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { copyLink } from '../utils/shareSheet';
import {
  buildOpenInBrowserUrl,
  type InstallGuide,
  type InstallStep,
  type InstallStepIcon,
} from '../utils/installGuide';

const STEP_ICON: Record<InstallStepIcon, LucideIcon> = {
  share: Share,
  'menu-vertical': MoreVertical,
  'menu-horizontal': MoreHorizontal,
  'menu-lines': Menu,
  plus: Plus,
  'add-square': SquarePlus,
  download: Download,
  compass: Compass,
  dock: Dock,
  check: Check,
  copy: Copy,
  external: ExternalLink,
};

const currentHref = (): string => (typeof window === 'undefined' ? '' : window.location.href);

export interface InstallStepListProps {
  steps: InstallStep[];
  /** Compact: tighter spacing for the nudge / Settings. */
  compact?: boolean;
  className?: string;
}

/** Numbered steps with the icon the director is looking for. */
export const InstallStepList: React.FC<InstallStepListProps> = ({
  steps,
  compact = false,
  className = '',
}) => (
  <ol className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
    {steps.map((step, i) => {
      const Icon = STEP_ICON[step.icon];
      return (
        <li key={`${i}-${step.text}`} className="flex items-start gap-3">
          <span
            className={`flex-shrink-0 ${compact ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'} bg-interactive/15 border border-interactive/40 text-interactive font-bold rounded-none flex items-center justify-center tabular-nums`}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm text-white font-medium">
              <Icon
                className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-interactive flex-shrink-0`}
                aria-hidden="true"
              />
              <span>{step.text}</span>
            </div>
            {step.hint && !compact && <p className="text-xs text-muted mt-1">{step.hint}</p>}
          </div>
        </li>
      );
    })}
  </ol>
);

export interface OpenInBrowserCardProps {
  guide: InstallGuide;
  /** The URL to hand to the real browser (defaults to this page). */
  href?: string;
  compact?: boolean;
}

/**
 * The escape hatch for an in-app browser: a one-tap "Open in Safari/Chrome"
 * link where the platform supports it, the host app's own menu steps, and a
 * copy-link fallback that always works.
 */
export const OpenInBrowserCard: React.FC<OpenInBrowserCardProps> = ({
  guide,
  href = currentHref(),
  compact = false,
}) => {
  const escape = guide.openInBrowser;
  const [copied, setCopied] = useState(false);
  const url = buildOpenInBrowserUrl(guide.platform, href);

  const onCopy = useCallback(async () => {
    if (await copyLink(href)) setCopied(true);
  }, [href]);

  if (!escape) return null;

  return (
    <div className="bg-warning/10 border border-warning/40 rounded-none p-3 sm:p-4 space-y-3">
      <p className="text-sm text-white">
        <span className="font-bold">{guide.inApp?.name ?? 'This app'}</span> opened this page in its
        own mini browser, which can&apos;t install apps. Open it in{' '}
        <span className="font-bold">{escape.browserName}</span> first:
      </p>

      {url && (
        <a
          href={url}
          className="w-full min-h-[44px] px-4 py-2.5 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Open in {escape.browserName}
        </a>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
          {url ? 'If that button does nothing' : `From ${guide.inApp?.name ?? 'this app'}`}
        </p>
        <InstallStepList steps={escape.steps} compact={compact} />
      </div>

      <button
        type="button"
        onClick={onCopy}
        className="w-full min-h-[44px] px-4 py-2.5 border border-line text-secondary hover:text-white hover:border-line-strong text-sm font-medium rounded-none transition-colors flex items-center justify-center gap-2"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
        {copied
          ? 'Copied — paste it in ' + escape.browserName
          : 'Or copy the link and paste it in ' + escape.browserName}
      </button>
    </div>
  );
};

export interface InstallGuideBodyProps {
  guide: InstallGuide;
  compact?: boolean;
  href?: string;
}

/**
 * The whole guide, minus any headline: the in-app escape hatch first when it
 * applies, then the install steps for the target browser, then any note.
 */
export const InstallGuideBody: React.FC<InstallGuideBodyProps> = ({
  guide,
  compact = false,
  href,
}) => {
  if (guide.kind === 'installed') return null;
  const stepsTitle =
    guide.kind === 'open-in-browser'
      ? `Then, in ${guide.openInBrowser?.browserName ?? 'your browser'}`
      : guide.kind === 'unsupported'
        ? 'Then, in that browser'
        : guide.kind === 'native'
          ? 'Or install from the browser menu'
          : null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {guide.kind === 'open-in-browser' && (
        <OpenInBrowserCard guide={guide} compact={compact} href={href} />
      )}
      {guide.kind === 'unsupported' && <SwitchBrowserCard guide={guide} href={href} />}
      <div>
        {stepsTitle && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
            {stepsTitle}
          </p>
        )}
        <InstallStepList steps={guide.steps} compact={compact} />
      </div>
      {guide.note && !compact && (
        <p className="text-xs text-muted border-l-2 border-line pl-3">{guide.note}</p>
      )}
    </div>
  );
};

/**
 * For a browser that can't install: why, a one-tap "Open in Chrome/Safari"
 * where the platform supports the hand-off, and a copy-link fallback.
 */
const SwitchBrowserCard: React.FC<{ guide: InstallGuide; href?: string }> = ({
  guide,
  href = currentHref(),
}) => {
  const [copied, setCopied] = useState(false);
  const target = guide.switchTo;
  const url = target ? buildOpenInBrowserUrl(guide.platform, href) : null;
  return (
    <div className="bg-warning/10 border border-warning/40 rounded-none p-3 sm:p-4 space-y-3">
      {target && <p className="text-sm text-white">{target.reason}</p>}
      {url && target && (
        <a
          href={url}
          className="w-full min-h-[44px] px-4 py-2.5 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Open in {target.browserName}
        </a>
      )}
      <button
        type="button"
        onClick={async () => {
          if (await copyLink(href)) setCopied(true);
        }}
        className={`w-full min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-none transition-colors flex items-center justify-center gap-2 ${
          url
            ? 'border border-line text-secondary hover:text-white hover:border-line-strong'
            : 'bg-interactive text-white font-bold hover:bg-interactive-hover'
        }`}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
        {copied
          ? 'Link copied'
          : url
            ? `Or copy the link and paste it in ${target?.browserName ?? 'that browser'}`
            : 'Copy the link'}
      </button>
    </div>
  );
};

export default InstallGuideBody;
