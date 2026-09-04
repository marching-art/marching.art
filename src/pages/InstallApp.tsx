// =============================================================================
// INSTALL APP PAGE — /install
// =============================================================================
// The one place to send anyone who asks "how do I get the app?". Public and
// crawlable (it ranks for "marching.art app"), shareable to a phone from a
// desktop, and reachable from the footer, the site links menu, Settings and
// the install nudge.
//
// It detects the device, the browser AND whether the page is trapped inside
// another app's mini browser (Instagram, Facebook, Discord…) — the case that
// produced most "I can't find Add to Home Screen" reports — and shows only the
// steps that apply, with a one-tap native install where the browser offers it.
// A director can also switch the guide to a different device to help someone
// else. The decision tree is utils/installGuide.ts (pure, tested).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Tablet,
  Monitor,
  Laptop,
  Download,
  BellRing,
  Zap,
  Home,
  Send,
  CheckCircle2,
  ChevronDown,
  Wifi,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Heading } from '../components/ui';
import { DISCORD_URL } from '../utils/siteLinks';
import { useSEO } from '../hooks/useSEO';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallGuideBody } from '../components/InstallSteps';
import { shareLink } from '../utils/shareSheet';
import { trackFunnelEvent, CLIENT_FUNNEL_EVENTS } from '../api/funnel';
import {
  BROWSER_LABEL,
  BROWSERS_FOR_PLATFORM,
  PLATFORM_LABEL,
  getInstallGuide,
  type InstallBrowser,
  type InstallPlatform,
} from '../utils/installGuide';

const INSTALL_URL = 'https://marching.art/install';

const PLATFORM_OPTIONS: Array<{ id: InstallPlatform; label: string; icon: typeof Smartphone }> = [
  { id: 'ios', label: 'iPhone', icon: Smartphone },
  { id: 'ipados', label: 'iPad', icon: Tablet },
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'macos', label: 'Mac', icon: Laptop },
  { id: 'windows', label: 'Windows', icon: Monitor },
];

const BENEFITS = [
  {
    icon: BellRing,
    title: 'Score-drop notifications',
    text: 'Get told the moment tonight’s scores post. On iPhone, notifications only work from the installed app.',
  },
  {
    icon: Home,
    title: 'One tap from your home screen',
    text: 'Your own icon, no address bar, no browser tabs to dig through.',
  },
  {
    icon: Zap,
    title: 'Opens instantly, full screen',
    text: 'Launches like a native app and keeps working on a shaky venue connection.',
  },
];

const TROUBLESHOOTING: Array<{ q: string; a: string }> = [
  {
    q: 'I don’t see "Add to Home Screen" on my iPhone',
    a: 'Make sure you are in Safari or Chrome, not inside another app. In the share sheet, scroll DOWN past the row of app icons — "Add to Home Screen" is in the list of actions below them. If the option is missing entirely, the page was opened inside another app (Instagram, Facebook, Discord, Gmail…): tap its ··· menu and choose "Open in Safari", then try again.',
  },
  {
    q: 'Android shows "Open marching.art" instead of "Install"',
    a: 'That means it is already installed. Look for the marching.art icon on your home screen or in your app drawer and open it from there.',
  },
  {
    q: 'There is no install option on Android',
    a: 'Open the page in Chrome itself, not the mini browser inside Instagram, Facebook or Discord. Samsung Internet hides the option under ≡ → "Add page to" → "Home screen". Firefox lists it as "Install" in its ⋮ menu.',
  },
  {
    q: 'I installed it but I am not getting notifications',
    a: 'Open the installed app (the home-screen icon, not the browser), go to Profile → Settings → Notifications and turn them on. iPhone needs iOS 16.4 or newer and asks for permission the first time; if you declined, re-enable marching.art under iOS Settings → Notifications.',
  },
  {
    q: 'Do I need the App Store or Play Store?',
    a: 'No. marching.art installs straight from your browser as a web app. There is nothing to download from a store, it takes no space to speak of, and it updates itself.',
  },
  {
    q: 'How do I remove it?',
    a: 'Exactly like any other app: press and hold the icon and choose Remove / Uninstall on your phone, or use the app’s own menu (⋮ → Uninstall) on desktop. Your account and corps are untouched.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is there a marching.art app?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. marching.art installs as an app on iPhone, iPad, Android, Mac and Windows directly from your browser — no App Store or Play Store needed. Visit marching.art/install on your device for one-tap install or step-by-step instructions.',
      },
    },
    ...TROUBLESHOOTING.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  ],
};

const chipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm font-medium rounded-none border transition-colors press-feedback ${
    active
      ? 'bg-interactive/15 border-interactive text-white'
      : 'bg-surface-sunken border-line text-secondary hover:text-white hover:border-line-strong'
  }`;

const InstallApp: React.FC = () => {
  useSEO({
    title: 'Install the marching.art app — iPhone, Android & desktop | marching.art',
    description:
      'Add marching.art to your home screen in three taps. Step-by-step install instructions for iPhone, iPad, Android, Mac and Windows — no app store needed.',
    path: '/install',
  });

  const detected = usePWAInstall();
  const [platformOverride, setPlatformOverride] = useState<InstallPlatform | null>(null);
  const [browserOverride, setBrowserOverride] = useState<InstallBrowser | null>(null);
  const [installing, setInstalling] = useState(false);

  const platform = platformOverride ?? detected.platform;
  // "Same device as detected" means the live guide (native prompt, in-app
  // trap) applies. Switching to another device shows that device's manual
  // steps — the director is helping someone else.
  const isDetectedDevice = platformOverride === null || platformOverride === detected.platform;
  const browsers = BROWSERS_FOR_PLATFORM[platform];
  // A detected browser outside the platform's usual list (DuckDuckGo, an
  // unknown engine) still leads the chips so the director sees what we saw.
  const chipBrowsers =
    isDetectedDevice && !browsers.includes(detected.browser)
      ? [detected.browser, ...browsers]
      : browsers;
  const browser: InstallBrowser =
    browserOverride && chipBrowsers.includes(browserOverride)
      ? browserOverride
      : isDetectedDevice
        ? detected.browser
        : browsers[0];

  const guide = useMemo(() => {
    if (isDetectedDevice && browser === detected.browser) return detected.guide;
    return getInstallGuide({
      platform,
      browser,
      inApp: null,
      canPromptInstall: false,
      isInstalled: false,
    });
  }, [isDetectedDevice, browser, platform, detected.browser, detected.guide]);

  useEffect(() => {
    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.INSTALL_GUIDE_VIEWED, {
      kind: detected.guide.kind,
      platform: detected.platform,
      browser: detected.browser,
      in_app: detected.inAppBrowser?.id ?? 'none',
    });
    // Once per visit — the detected guide never changes within a tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNativeInstall = useCallback(async () => {
    setInstalling(true);
    const outcome = await detected.promptInstall();
    setInstalling(false);
    if (outcome === 'accepted') toast.success('Installing marching.art…');
    else if (outcome === 'unavailable')
      toast('Use the steps below to install from the browser menu.');
  }, [detected]);

  const handleShare = useCallback(() => {
    void shareLink({ title: 'Install the marching.art app', url: INSTALL_URL });
  }, []);

  const detectedLabel = `${PLATFORM_LABEL[detected.platform]} · ${BROWSER_LABEL[detected.browser]}${
    detected.inAppBrowser ? ` inside ${detected.inAppBrowser.name}` : ''
  }`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-6">
          <img
            src="/logo192.png"
            alt=""
            width={64}
            height={64}
            className="w-16 h-16 flex-shrink-0 border border-line rounded-none"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-interactive mb-1">
              Free · no app store
            </p>
            <Heading level="display" className="leading-tight">
              Get marching.art on your home screen
            </Heading>
          </div>
        </div>
        <p className="text-secondary mb-8">
          marching.art installs straight from your browser as an app — on iPhone, iPad, Android and
          desktop. Nothing to download from a store, and it updates itself.
        </p>

        {/* The guide */}
        <section
          aria-labelledby="install-guide-heading"
          className="bg-surface-card border border-line rounded-none p-4 sm:p-6 mb-6"
        >
          {guide.kind === 'installed' ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" aria-hidden="true" />
              <div>
                <Heading level="title" as="h2" id="install-guide-heading" className="mb-1">
                  {guide.headline}
                </Heading>
                <p className="text-sm text-secondary">{guide.intro}</p>
                <p className="text-sm text-muted mt-3">
                  Want score-drop alerts? Turn them on under{' '}
                  <Link to="/profile" className="text-interactive hover:underline">
                    Profile → Settings → Notifications
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <Heading level="title" as="h2" id="install-guide-heading">
                  {guide.headline}
                </Heading>
                {isDetectedDevice && (
                  <span className="text-[11px] text-muted" aria-live="polite">
                    Detected: {detectedLabel}
                  </span>
                )}
              </div>
              <p className="text-sm text-secondary mb-5">{guide.intro}</p>

              {guide.kind === 'native' && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  disabled={installing}
                  className="w-full min-h-[52px] px-6 mb-5 bg-interactive text-white font-bold text-base rounded-none hover:bg-interactive-hover active:scale-[0.99] transition-all press-feedback-strong flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download className="w-5 h-5" aria-hidden="true" />
                  {installing ? 'Waiting for your browser…' : 'Install marching.art'}
                </button>
              )}

              <InstallGuideBody guide={guide} href={INSTALL_URL} />

              <p className="text-xs text-muted mt-5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" aria-hidden="true" />
                <span>
                  <span className="text-secondary font-medium">Done?</span> {guide.afterInstall}
                </span>
              </p>
            </>
          )}
        </section>

        {/* Device / browser switcher */}
        <section aria-labelledby="install-switch-heading" className="mb-8">
          <p
            id="install-switch-heading"
            className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2"
          >
            Different device or browser?
          </p>
          <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Choose a device">
            {PLATFORM_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = platform === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPlatformOverride(opt.id);
                    setBrowserOverride(null);
                  }}
                  className={chipClass(active)}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a browser">
            {chipBrowsers.map((b) => {
              const active = browser === b;
              const label =
                b === detected.browser && isDetectedDevice && detected.inAppBrowser
                  ? `${detected.inAppBrowser.name} (in-app)`
                  : BROWSER_LABEL[b];
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBrowserOverride(b)}
                  className={chipClass(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Why */}
        <section aria-labelledby="install-why-heading" className="mb-8">
          <Heading level="section" as="h2" id="install-why-heading" className="mb-3">
            Why install it
          </Heading>
          <ul className="grid sm:grid-cols-3 gap-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className="bg-surface-sunken border border-line rounded-none p-3">
                  <Icon className="w-5 h-5 text-interactive mb-2" aria-hidden="true" />
                  <p className="text-sm font-bold text-white mb-1">{b.title}</p>
                  <p className="text-xs text-muted">{b.text}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Send to phone */}
        <section
          aria-labelledby="install-share-heading"
          className="bg-surface-sunken border border-line rounded-none p-4 mb-8 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <Heading level="section" as="h2" id="install-share-heading" className="mb-1">
              Reading this on a computer?
            </Heading>
            <p className="text-xs text-muted">
              Send <span className="text-secondary select-all">marching.art/install</span> to your
              phone, or to the director you&apos;re helping — it opens straight to their steps.
            </p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[44px] px-4 border border-interactive/50 text-interactive font-bold text-sm rounded-none hover:bg-interactive/10 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            Share link
          </button>
        </section>

        {/* Troubleshooting */}
        <section aria-labelledby="install-help-heading" className="mb-8">
          <Heading
            level="section"
            as="h2"
            id="install-help-heading"
            className="mb-3 flex items-center gap-2"
          >
            <HelpCircle className="w-5 h-5 text-interactive" aria-hidden="true" />
            Not working?
          </Heading>
          <div className="divide-y divide-line border border-line rounded-none">
            {TROUBLESHOOTING.map((item) => (
              <details key={item.q} className="group bg-surface-card">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] cursor-pointer text-sm font-medium text-white list-none [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="w-4 h-4 text-muted flex-shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-4 pb-4 text-sm text-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted flex items-center gap-2">
          <Wifi className="w-4 h-4" aria-hidden="true" />
          Still stuck? Ask in{' '}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-interactive hover:underline"
          >
            Discord
          </a>{' '}
          with your phone and browser and we&apos;ll walk you through it.
        </p>
      </div>
    </>
  );
};

export default InstallApp;
