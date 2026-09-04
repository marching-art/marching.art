// =============================================================================
// INSTALL GUIDE — platform / browser detection and the steps to install
// =============================================================================
// Everything here is pure (no React, no DOM) so the whole decision tree that
// decides what a director sees on /install, in Settings and in the transient
// nudge is unit-testable against real user-agent strings.
//
// Why this exists: "Add to Home Screen" fails for three reasons that a generic
// two-line tip never covered —
//   1. The page opened inside another app's browser (Instagram, Facebook,
//      TikTok, Discord, Gmail…). Those webviews cannot install anything; the
//      only fix is to open the page in the real browser first.
//   2. The browser isn't the one the tip assumed (Chrome on iPhone, Samsung
//      Internet, Firefox on Android). Each hides the option somewhere else.
//   3. The user couldn't find the button at all. The steps here say WHERE it is
//      (bottom bar vs. top-right) and what the exact menu label reads.
// -----------------------------------------------------------------------------

export type InstallPlatform = 'ios' | 'ipados' | 'android' | 'macos' | 'windows' | 'other';

export type InstallBrowser =
  'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'brave' | 'duckduckgo' | 'other';

export type InAppHost =
  | 'instagram'
  | 'facebook'
  | 'messenger'
  | 'threads'
  | 'tiktok'
  | 'snapchat'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'reddit'
  | 'discord'
  | 'gmail'
  | 'google'
  | 'line'
  | 'wechat'
  | 'webview';

export interface InAppBrowser {
  id: InAppHost;
  /** Human name of the host app ("Instagram"). */
  name: string;
}

/** Icon keys, resolved to real icons by the renderer. Kept as strings so this
 *  module stays free of component imports. */
export type InstallStepIcon =
  | 'share'
  | 'menu-vertical'
  | 'menu-horizontal'
  | 'menu-lines'
  | 'plus'
  | 'add-square'
  | 'download'
  | 'compass'
  | 'dock'
  | 'check'
  | 'copy'
  | 'external';

export interface InstallStep {
  icon: InstallStepIcon;
  /** The action, phrased as an imperative ("Tap the Share button"). */
  text: string;
  /** Where to find it / what it looks like. */
  hint?: string;
}

export type InstallGuideKind =
  /** Already running as the installed app. */
  | 'installed'
  /** The browser has a native one-tap install prompt ready. */
  | 'native'
  /** Inside another app's browser — must open the real browser first. */
  | 'open-in-browser'
  /** Installable, but only through the browser's own menu. */
  | 'manual'
  /** This browser can't install web apps; suggest one that can. */
  | 'unsupported';

export interface InstallGuide {
  kind: InstallGuideKind;
  platform: InstallPlatform;
  browser: InstallBrowser;
  inApp: InAppBrowser | null;
  /** "Install on iPhone (Safari)". */
  headline: string;
  /** One sentence of context under the headline. */
  intro: string;
  /** The steps to perform in the current browser (empty for 'installed'). */
  steps: InstallStep[];
  /** Escape hatch when the page is inside an in-app browser. */
  openInBrowser?: {
    /** "Safari" / "Chrome". */
    browserName: string;
    /** Steps to break out of the host app's webview. */
    steps: InstallStep[];
  };
  /**
   * For 'unsupported': the browser the director should switch to and why.
   * The renderer turns this into a one-tap "Open in Chrome/Safari" button on
   * mobile (buildOpenInBrowserUrl) with a copy-link fallback.
   */
  switchTo?: {
    browserName: string;
    reason: string;
  };
  /** A caveat worth reading before starting (OS version requirement etc.). */
  note?: string;
  /** Once installed, what the director should look for. */
  afterInstall: string;
}

// -----------------------------------------------------------------------------
// Detection
// -----------------------------------------------------------------------------

export interface DetectOptions {
  /** navigator.platform — 'MacIntel' on iPadOS 13+ desktop-class Safari. */
  navigatorPlatform?: string;
  /** navigator.maxTouchPoints — >1 on an iPad masquerading as a Mac. */
  maxTouchPoints?: number;
  /** navigator.brave exists only in Brave. */
  isBrave?: boolean;
}

export function detectPlatform(ua: string, opts: DetectOptions = {}): InstallPlatform {
  const isIPad =
    /iPad/.test(ua) || (opts.navigatorPlatform === 'MacIntel' && (opts.maxTouchPoints ?? 0) > 1);
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (isIPad) return 'ipados';
  if (/android/i.test(ua)) return 'android';
  if (/Macintosh|MacIntel/.test(ua)) return 'macos';
  if (/Windows|Win64|Win32/.test(ua)) return 'windows';
  return 'other';
}

export function detectBrowser(ua: string, opts: DetectOptions = {}): InstallBrowser {
  // Order matters: every Chromium browser also carries "Chrome/", and every
  // WebKit browser carries "Safari/". Test the distinctive tokens first.
  if (opts.isBrave || /\bBrave\//.test(ua)) return 'brave';
  if (/\bEdgiOS\/|\bEdgA\/|\bEdg\//.test(ua)) return 'edge';
  if (/\bSamsungBrowser\//.test(ua)) return 'samsung';
  if (/\bOPR\/|\bOPiOS\/|\bOpera\b/.test(ua)) return 'opera';
  if (/\bDuckDuckGo\//.test(ua)) return 'duckduckgo';
  if (/\bFxiOS\/|\bFirefox\//.test(ua)) return 'firefox';
  if (/\bCriOS\//.test(ua)) return 'chrome';
  if (/\bChrome\/|\bChromium\//.test(ua)) return 'chrome';
  if (/\bSafari\//.test(ua) && /\bVersion\//.test(ua)) return 'safari';
  return 'other';
}

const IN_APP_TOKENS: Array<[RegExp, InAppHost, string]> = [
  [/\bInstagram\b/i, 'instagram', 'Instagram'],
  [/\bBarcelona\b/i, 'threads', 'Threads'], // Threads ships with Instagram's UA and a "Barcelona" tag
  [
    /\bMessengerForiOS\b|\bMessengerLite\b|\bOrca-Android\b|\bFB_IAB\/MESSENGER\b/i,
    'messenger',
    'Messenger',
  ],
  [/\bFBAN\b|\bFBAV\b|\bFB_IAB\b|\bFBIOS\b/i, 'facebook', 'Facebook'],
  [/musical_ly|TikTok|Bytedance/i, 'tiktok', 'TikTok'],
  [/\bSnapchat\b/i, 'snapchat', 'Snapchat'],
  [/\bTwitter\b|\bTwitterAndroid\b/i, 'twitter', 'X'],
  [/\bLinkedInApp\b/i, 'linkedin', 'LinkedIn'],
  [/\bPinterest\b/i, 'pinterest', 'Pinterest'],
  [/\bRedditApp\b|\bReddit\/Version\b/i, 'reddit', 'Reddit'],
  [/\bDiscord\b/i, 'discord', 'Discord'],
  [/\bGmail\b/i, 'gmail', 'Gmail'],
  [/\bGSA\/\d/i, 'google', 'the Google app'],
  [/\bLine\/\d/i, 'line', 'LINE'],
  [/\bMicroMessenger\b/i, 'wechat', 'WeChat'],
];

/**
 * Identify a host app's embedded browser. Returns null when the page is in a
 * real browser. Generic webviews (no recognizable host) come back as 'webview'
 * so the caller can still say "open this in Safari/Chrome".
 */
export function detectInAppBrowser(ua: string): InAppBrowser | null {
  for (const [re, id, name] of IN_APP_TOKENS) {
    if (re.test(ua)) return { id, name };
  }
  const platform = detectPlatform(ua);
  // Android WebView announces itself with "; wv)" in the platform parenthetical.
  if (platform === 'android' && /;\s*wv\)/.test(ua)) return { id: 'webview', name: 'this app' };
  // An iOS WKWebView carries "Mobile/" but no "Safari/" token. Real browsers on
  // iOS (Safari, Chrome, Firefox, Edge…) all append Safari/ to the UA.
  if (
    (platform === 'ios' || platform === 'ipados') &&
    /\bMobile\//.test(ua) &&
    !/\bSafari\//.test(ua)
  ) {
    return { id: 'webview', name: 'this app' };
  }
  return null;
}

/** Major iOS version parsed from the UA, or null on anything else. */
export function detectIOSVersion(ua: string): number | null {
  const m = /OS (\d+)[_.]\d+/.exec(ua);
  if (!m || !/iPhone|iPad|iPod/.test(ua)) return null;
  return Number(m[1]);
}

export const PLATFORM_LABEL: Record<InstallPlatform, string> = {
  ios: 'iPhone',
  ipados: 'iPad',
  android: 'Android',
  macos: 'Mac',
  windows: 'Windows',
  other: 'desktop',
};

export const BROWSER_LABEL: Record<InstallBrowser, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  samsung: 'Samsung Internet',
  opera: 'Opera',
  brave: 'Brave',
  duckduckgo: 'DuckDuckGo',
  other: 'your browser',
};

/** The browsers a director can switch the guide to, per platform. First entry
 *  is the platform's default (what to recommend when theirs can't install). */
export const BROWSERS_FOR_PLATFORM: Record<InstallPlatform, InstallBrowser[]> = {
  ios: ['safari', 'chrome', 'edge', 'firefox'],
  ipados: ['safari', 'chrome', 'edge', 'firefox'],
  android: ['chrome', 'samsung', 'firefox', 'edge', 'brave', 'opera'],
  macos: ['chrome', 'safari', 'edge', 'brave', 'firefox'],
  windows: ['chrome', 'edge', 'brave', 'firefox'],
  other: ['chrome', 'edge', 'brave', 'firefox'],
};

// -----------------------------------------------------------------------------
// The guide
// -----------------------------------------------------------------------------

export interface GuideInput {
  platform: InstallPlatform;
  browser: InstallBrowser;
  inApp: InAppBrowser | null;
  /** A native beforeinstallprompt is queued. */
  canPromptInstall: boolean;
  /** Already running standalone. */
  isInstalled: boolean;
  iosVersion?: number | null;
}

const IOS_AFTER =
  'Look for the marching.art icon on your home screen — open it from there from now on.';
const ANDROID_AFTER =
  'marching.art now sits in your app drawer and on your home screen, like any other app.';
const DESKTOP_AFTER = 'marching.art opens in its own window and appears in your apps list / Dock.';

const iosSafariSteps = (platform: InstallPlatform): InstallStep[] => [
  {
    icon: 'share',
    text: 'Tap the Share button',
    hint:
      platform === 'ipados'
        ? 'The square with an arrow pointing up, at the top right of Safari next to the address bar.'
        : 'The square with an arrow pointing up, in the bar at the bottom of Safari.',
  },
  {
    icon: 'add-square',
    text: 'Scroll down and tap "Add to Home Screen"',
    hint: 'It is below the row of app icons. Keep scrolling the list if you do not see it at first.',
  },
  { icon: 'check', text: 'Tap "Add" in the top right corner' },
];

const iosChromeSteps = (): InstallStep[] => [
  {
    icon: 'share',
    text: 'Tap the Share button',
    hint: 'The square with an arrow, at the top right of Chrome beside the address bar.',
  },
  { icon: 'add-square', text: 'Scroll down and tap "Add to Home Screen"' },
  { icon: 'check', text: 'Tap "Add"' },
];

const iosEdgeSteps = (): InstallStep[] => [
  { icon: 'menu-horizontal', text: 'Tap the ··· menu at the bottom of Edge' },
  { icon: 'share', text: 'Tap "Share", then "Add to Home Screen"' },
  { icon: 'check', text: 'Tap "Add"' },
];

const iosFirefoxSteps = (): InstallStep[] => [
  { icon: 'menu-lines', text: 'Tap the ≡ menu at the bottom of Firefox' },
  { icon: 'share', text: 'Tap "Share", then "Add to Home Screen"' },
  { icon: 'check', text: 'Tap "Add"' },
];

const androidChromeSteps = (): InstallStep[] => [
  {
    icon: 'menu-vertical',
    text: 'Tap the ⋮ menu at the top right of Chrome',
  },
  {
    icon: 'download',
    text: 'Tap "Add to Home screen" (or "Install app")',
    hint: 'If Chrome shows an "Install" bar at the bottom of the page, that works too.',
  },
  { icon: 'check', text: 'Tap "Install"' },
];

const androidFirefoxSteps = (): InstallStep[] => [
  { icon: 'menu-vertical', text: 'Tap the ⋮ menu' },
  { icon: 'download', text: 'Tap "Install" (or "Add to Home screen")' },
  { icon: 'check', text: 'Confirm with "Add"' },
];

const androidEdgeSteps = (): InstallStep[] => [
  { icon: 'menu-horizontal', text: 'Tap the ··· menu at the bottom of Edge' },
  { icon: 'download', text: 'Tap "Add to phone"' },
  { icon: 'check', text: 'Tap "Install"' },
];

const androidOperaSteps = (): InstallStep[] => [
  { icon: 'plus', text: 'Tap the + icon in the address bar, or open the ⋮ menu' },
  { icon: 'add-square', text: 'Tap "Add to…", then "Home screen"' },
  { icon: 'check', text: 'Confirm with "Add"' },
];

const desktopChromiumSteps = (browser: InstallBrowser): InstallStep[] => {
  const name = BROWSER_LABEL[browser];
  if (browser === 'edge') {
    return [
      {
        icon: 'download',
        text: 'Click the install icon at the right end of the address bar',
        hint: 'A small monitor with a down arrow. Edge shows it on sites that can be installed.',
      },
      {
        icon: 'menu-horizontal',
        text: 'Or open the ··· menu → "Apps" → "Install this site as an app"',
      },
      { icon: 'check', text: 'Click "Install"' },
    ];
  }
  return [
    {
      icon: 'download',
      text: 'Click the install icon at the right end of the address bar',
      hint: `A small monitor with a down arrow. ${name} shows it on sites that can be installed.`,
    },
    {
      icon: 'menu-vertical',
      text: 'Or open the ⋮ menu → "Cast, save, and share" → "Install page as app…"',
      hint: 'Older versions list it as "Install marching.art…" directly in the menu.',
    },
    { icon: 'check', text: 'Click "Install"' },
  ];
};

const macSafariSteps = (): InstallStep[] => [
  {
    icon: 'share',
    text: 'Click the Share button in the Safari toolbar',
    hint: 'Or use the File menu.',
  },
  { icon: 'dock', text: 'Choose "Add to Dock"', hint: 'Requires macOS Sonoma (14) or newer.' },
  { icon: 'check', text: 'Click "Add"' },
];

const openInBrowserSteps = (inApp: InAppBrowser, platform: InstallPlatform): InstallStep[] => {
  const isApple = platform === 'ios' || platform === 'ipados';
  const target = isApple ? 'Safari' : 'Chrome';
  switch (inApp.id) {
    case 'instagram':
    case 'threads':
      return [
        { icon: 'menu-horizontal', text: 'Tap the ··· menu at the top right of this screen' },
        { icon: 'external', text: `Tap "Open in browser" (or "Open in ${target}")` },
      ];
    case 'facebook':
    case 'messenger':
      return [
        { icon: 'menu-horizontal', text: 'Tap the ··· menu at the top right (or bottom right)' },
        { icon: 'external', text: `Tap "Open in browser" (or "Open in ${target}")` },
      ];
    case 'tiktok':
      return [
        { icon: 'menu-horizontal', text: 'Tap the ··· or share icon at the top right' },
        { icon: 'external', text: 'Tap "Open in browser"' },
      ];
    case 'snapchat':
      return [
        { icon: 'menu-horizontal', text: 'Tap the ··· menu at the bottom of the screen' },
        { icon: 'external', text: `Tap "Open in ${target}"` },
      ];
    case 'twitter':
    case 'linkedin':
    case 'pinterest':
    case 'reddit':
      return [
        { icon: 'menu-horizontal', text: 'Tap the ··· or share icon at the top of this screen' },
        { icon: 'external', text: `Tap "Open in browser" (or "Open in ${target}")` },
      ];
    case 'discord':
    case 'gmail':
    case 'google':
      return isApple
        ? [
            { icon: 'compass', text: 'Tap the Safari compass icon at the bottom right' },
            { icon: 'external', text: 'The page reopens in Safari — continue there' },
          ]
        : [
            { icon: 'menu-vertical', text: 'Tap the ⋮ menu at the top right' },
            { icon: 'external', text: 'Tap "Open in Chrome" (or "Open in browser")' },
          ];
    default:
      return isApple
        ? [
            { icon: 'compass', text: 'Look for a Safari compass icon or a ··· menu' },
            { icon: 'external', text: 'Choose "Open in Safari" / "Open in browser"' },
          ]
        : [
            { icon: 'menu-vertical', text: 'Look for a ⋮ or ··· menu' },
            { icon: 'external', text: 'Choose "Open in Chrome" / "Open in browser"' },
          ];
  }
};

export function getInstallGuide(input: GuideInput): InstallGuide {
  const { platform, browser, inApp, canPromptInstall, isInstalled } = input;
  const isApple = platform === 'ios' || platform === 'ipados';
  const device = PLATFORM_LABEL[platform];
  const base = { platform, browser, inApp };

  if (isInstalled) {
    return {
      ...base,
      kind: 'installed',
      headline: "You're using the installed app",
      intro: 'marching.art is already on this device. Nothing else to do here.',
      steps: [],
      afterInstall: isApple ? IOS_AFTER : platform === 'android' ? ANDROID_AFTER : DESKTOP_AFTER,
    };
  }

  if (inApp) {
    const target = isApple ? 'Safari' : 'Chrome';
    return {
      ...base,
      kind: 'open-in-browser',
      headline: `Open this page in ${target} first`,
      intro: `You're viewing marching.art inside ${inApp.name}'s built-in browser, which can't install apps. Open the page in ${target} and the steps below take about ten seconds.`,
      steps: isApple ? iosSafariSteps(platform) : androidChromeSteps(),
      openInBrowser: { browserName: target, steps: openInBrowserSteps(inApp, platform) },
      afterInstall: isApple ? IOS_AFTER : ANDROID_AFTER,
    };
  }

  if (canPromptInstall) {
    return {
      ...base,
      kind: 'native',
      headline: `Install on ${device} with one tap`,
      intro: `${BROWSER_LABEL[browser]} can install marching.art directly. Tap Install and confirm.`,
      steps: platform === 'android' ? androidChromeSteps() : desktopChromiumSteps(browser),
      afterInstall: platform === 'android' ? ANDROID_AFTER : DESKTOP_AFTER,
    };
  }

  if (isApple) {
    const iosVersion = input.iosVersion ?? null;
    const tooOldForThirdParty = iosVersion !== null && iosVersion < 16;
    switch (browser) {
      case 'safari':
        return {
          ...base,
          kind: 'manual',
          headline: `Install on ${device} (Safari)`,
          intro:
            'No App Store needed — Safari adds marching.art to your home screen in three taps.',
          steps: iosSafariSteps(platform),
          afterInstall: IOS_AFTER,
        };
      case 'chrome':
      case 'edge':
      case 'firefox':
        if (tooOldForThirdParty) {
          return {
            ...base,
            kind: 'unsupported',
            headline: `Use Safari to install on ${device}`,
            intro: `${BROWSER_LABEL[browser]} can only add web apps to the home screen on iOS 16.4 or newer. Open this page in Safari, then follow these steps.`,
            steps: iosSafariSteps(platform),
            switchTo: {
              browserName: 'Safari',
              reason: `${BROWSER_LABEL[browser]} needs iOS 16.4 or newer to add web apps. Safari can always do it.`,
            },
            afterInstall: IOS_AFTER,
          };
        }
        return {
          ...base,
          kind: 'manual',
          headline: `Install on ${device} (${BROWSER_LABEL[browser]})`,
          intro: `${BROWSER_LABEL[browser]} on ${device} can add marching.art to your home screen. If the option is missing, open the page in Safari instead.`,
          steps:
            browser === 'chrome'
              ? iosChromeSteps()
              : browser === 'edge'
                ? iosEdgeSteps()
                : iosFirefoxSteps(),
          note: "Requires iOS 16.4 or newer. The installed app always opens with Safari's engine, whichever browser you added it from.",
          afterInstall: IOS_AFTER,
        };
      default:
        return {
          ...base,
          kind: 'unsupported',
          headline: `Use Safari to install on ${device}`,
          intro: `${BROWSER_LABEL[browser] === 'your browser' ? 'This browser' : BROWSER_LABEL[browser]} can't add web apps to the home screen. Open this page in Safari, then follow these steps.`,
          steps: iosSafariSteps(platform),
          switchTo: {
            browserName: 'Safari',
            reason:
              'Only Safari (and, on iOS 16.4+, Chrome, Edge and Firefox) can add web apps to the home screen.',
          },
          afterInstall: IOS_AFTER,
        };
    }
  }

  if (platform === 'android') {
    if (browser === 'samsung') {
      // Samsung Internet packages the app through its own server, and on
      // Android 14+ the phone refuses the package: "This app was built for an
      // older version of Android and doesn't include the latest privacy
      // protections." Chrome on the same phone installs fine, so send the
      // director there instead of walking them into the wall.
      return {
        ...base,
        kind: 'unsupported',
        headline: 'Install on Android — use Chrome',
        intro:
          'Samsung Internet can\'t install marching.art on Android 14 or newer: the phone blocks it with "This app was built for an older version of Android". Chrome installs it in three taps, and the app works the same afterwards.',
        steps: androidChromeSteps(),
        switchTo: {
          browserName: 'Chrome',
          reason: "Samsung Internet's app installer is blocked by Android 14+. Chrome's is not.",
        },
        afterInstall: ANDROID_AFTER,
      };
    }
    const steps =
      browser === 'firefox'
        ? androidFirefoxSteps()
        : browser === 'edge'
          ? androidEdgeSteps()
          : browser === 'opera'
            ? androidOperaSteps()
            : androidChromeSteps();
    return {
      ...base,
      kind: 'manual',
      headline: `Install on Android (${BROWSER_LABEL[browser] === 'your browser' ? 'Chrome' : BROWSER_LABEL[browser]})`,
      intro:
        'No Play Store needed — your browser adds marching.art to your home screen and app drawer.',
      steps,
      note:
        browser === 'chrome' || browser === 'other'
          ? 'Already see "Open marching.art" instead of "Install"? The app is installed — open it from your home screen.'
          : undefined,
      afterInstall: ANDROID_AFTER,
    };
  }

  // Desktop.
  if (browser === 'safari' && platform === 'macos') {
    return {
      ...base,
      kind: 'manual',
      headline: 'Install on Mac (Safari)',
      intro: 'Safari can add marching.art to your Dock as its own app.',
      steps: macSafariSteps(),
      afterInstall: DESKTOP_AFTER,
    };
  }
  if (browser === 'firefox' || browser === 'safari' || browser === 'other') {
    return {
      ...base,
      kind: 'unsupported',
      headline: `Install on ${device}`,
      intro: `${BROWSER_LABEL[browser] === 'your browser' ? 'This browser' : BROWSER_LABEL[browser]} can't install web apps on ${device}. Open marching.art in Chrome or Edge and use these steps — or just bookmark the site.`,
      steps: desktopChromiumSteps('chrome'),
      afterInstall: DESKTOP_AFTER,
    };
  }
  return {
    ...base,
    kind: 'manual',
    headline: `Install on ${device} (${BROWSER_LABEL[browser]})`,
    intro:
      'marching.art runs as its own desktop app, in its own window, straight from the browser.',
    steps: desktopChromiumSteps(browser),
    afterInstall: DESKTOP_AFTER,
  };
}

// -----------------------------------------------------------------------------
// Escaping an in-app browser
// -----------------------------------------------------------------------------

/**
 * A URL that, when navigated to from inside a host app's webview, hands the
 * page to the real browser. iOS honours the `x-safari-https://` scheme from
 * most in-app browsers (Instagram, Facebook, TikTok…); Android webviews honour
 * a Chrome `intent://` URL. Returns null where no such trick exists — the
 * caller then falls back to "copy the link".
 */
export function buildOpenInBrowserUrl(platform: InstallPlatform, href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (platform === 'ios' || platform === 'ipados') {
    return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
  }
  if (platform === 'android') {
    const fallback = encodeURIComponent(href);
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }
  return null;
}
