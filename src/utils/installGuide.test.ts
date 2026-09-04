// Real user-agent strings, one per branch the install guide has to get right.
import { describe, it, expect } from 'vitest';
import {
  buildOpenInBrowserUrl,
  detectBrowser,
  detectInAppBrowser,
  detectIOSVersion,
  detectPlatform,
  getInstallGuide,
  BROWSERS_FOR_PLATFORM,
  type InstallPlatform,
  type InstallBrowser,
} from './installGuide';

const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iosEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.0.2592.56 Mobile/15E148 Safari/605.1.15',
  iosInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 606858733)',
  iosFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/467.0.0.36.104;FBBV/606234160;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/0]',
  iosTikTok:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.9.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US',
  iosWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iosOldChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.2592.56',
  androidInstagram:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 334.0.0.42.95 Android (34/14; 420dpi; 1080x2340; Google/google; Pixel 8; shiba; shiba; en_US; 606858743)',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidDiscord:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Discord-Android/230013',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.56',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  winBrave:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('detectPlatform', () => {
  it.each([
    [UA.iosSafari, 'ios'],
    [UA.ipadSafari, 'ipados'],
    [UA.androidChrome, 'android'],
    [UA.macChrome, 'macos'],
    [UA.winEdge, 'windows'],
  ] as Array<[string, InstallPlatform]>)('%s → %s', (ua, expected) => {
    expect(detectPlatform(ua)).toBe(expected);
  });

  it('recognises an iPad in desktop-site mode from touch points', () => {
    expect(detectPlatform(UA.ipadDesktopMode)).toBe('macos');
    expect(
      detectPlatform(UA.ipadDesktopMode, { navigatorPlatform: 'MacIntel', maxTouchPoints: 5 })
    ).toBe('ipados');
  });
});

describe('detectBrowser', () => {
  it.each([
    [UA.iosSafari, 'safari'],
    [UA.iosChrome, 'chrome'],
    [UA.iosFirefox, 'firefox'],
    [UA.iosEdge, 'edge'],
    [UA.androidChrome, 'chrome'],
    [UA.androidSamsung, 'samsung'],
    [UA.androidFirefox, 'firefox'],
    [UA.androidEdge, 'edge'],
    [UA.macChrome, 'chrome'],
    [UA.macSafari, 'safari'],
    [UA.winEdge, 'edge'],
    [UA.winFirefox, 'firefox'],
  ] as Array<[string, InstallBrowser]>)('%s → %s', (ua, expected) => {
    expect(detectBrowser(ua)).toBe(expected);
  });

  it('uses navigator.brave since Brave hides in a Chrome UA', () => {
    expect(detectBrowser(UA.winBrave)).toBe('chrome');
    expect(detectBrowser(UA.winBrave, { isBrave: true })).toBe('brave');
  });

  it('does not call an iOS webview Safari', () => {
    expect(detectBrowser(UA.iosInstagram)).toBe('other');
    expect(detectBrowser(UA.iosWebView)).toBe('other');
  });
});

describe('detectInAppBrowser', () => {
  it('returns null for real browsers', () => {
    for (const ua of [
      UA.iosSafari,
      UA.iosChrome,
      UA.iosFirefox,
      UA.androidChrome,
      UA.androidSamsung,
      UA.androidFirefox,
      UA.macSafari,
      UA.winEdge,
    ]) {
      expect(detectInAppBrowser(ua), ua).toBeNull();
    }
  });

  it.each([
    [UA.iosInstagram, 'instagram', 'Instagram'],
    [UA.iosFacebook, 'facebook', 'Facebook'],
    [UA.iosTikTok, 'tiktok', 'TikTok'],
    [UA.androidInstagram, 'instagram', 'Instagram'],
    [UA.androidDiscord, 'discord', 'Discord'],
  ])('names the host app: %s', (ua, id, name) => {
    expect(detectInAppBrowser(ua)).toEqual({ id, name });
  });

  it('flags anonymous webviews on both platforms', () => {
    expect(detectInAppBrowser(UA.iosWebView)?.id).toBe('webview');
    expect(detectInAppBrowser(UA.androidWebView)?.id).toBe('webview');
  });
});

describe('detectIOSVersion', () => {
  it('parses the major version on iPhone and iPad only', () => {
    expect(detectIOSVersion(UA.iosSafari)).toBe(17);
    expect(detectIOSVersion(UA.iosOldChrome)).toBe(15);
    expect(detectIOSVersion(UA.ipadSafari)).toBe(17);
    expect(detectIOSVersion(UA.macSafari)).toBeNull();
    expect(detectIOSVersion(UA.androidChrome)).toBeNull();
  });
});

const guideFor = (ua: string, extra: Partial<Parameters<typeof getInstallGuide>[0]> = {}) =>
  getInstallGuide({
    platform: detectPlatform(ua),
    browser: detectBrowser(ua),
    inApp: detectInAppBrowser(ua),
    canPromptInstall: false,
    isInstalled: false,
    iosVersion: detectIOSVersion(ua),
    ...extra,
  });

describe('getInstallGuide', () => {
  it('reports installed before anything else', () => {
    const g = guideFor(UA.iosInstagram, { isInstalled: true, canPromptInstall: true });
    expect(g.kind).toBe('installed');
    expect(g.steps).toHaveLength(0);
  });

  it('sends an in-app browser out to Safari / Chrome first, then shows that browser’s steps', () => {
    const ios = guideFor(UA.iosInstagram);
    expect(ios.kind).toBe('open-in-browser');
    expect(ios.openInBrowser?.browserName).toBe('Safari');
    expect(ios.openInBrowser?.steps.length).toBeGreaterThan(0);
    expect(ios.steps[0].icon).toBe('share');

    const android = guideFor(UA.androidInstagram);
    expect(android.kind).toBe('open-in-browser');
    expect(android.openInBrowser?.browserName).toBe('Chrome');
    expect(android.steps[0].icon).toBe('menu-vertical');
  });

  it('in-app beats a native prompt (webviews never actually fire one, but be safe)', () => {
    expect(guideFor(UA.androidInstagram, { canPromptInstall: true }).kind).toBe('open-in-browser');
  });

  it('offers the one-tap prompt when the browser has one', () => {
    const g = guideFor(UA.androidChrome, { canPromptInstall: true });
    expect(g.kind).toBe('native');
    expect(g.steps.length).toBeGreaterThan(0); // manual fallback still listed
  });

  it('iPhone Safari: share sheet at the bottom; iPad: top right', () => {
    const phone = guideFor(UA.iosSafari);
    expect(phone.kind).toBe('manual');
    expect(phone.steps[0].hint).toMatch(/bottom/);
    expect(phone.steps[1].text).toMatch(/Add to Home Screen/);
    const pad = guideFor(UA.ipadSafari);
    expect(pad.steps[0].hint).toMatch(/top right/);
  });

  it('iPhone Chrome / Edge / Firefox each get their own menu path with the iOS 16.4 caveat', () => {
    const chrome = guideFor(UA.iosChrome);
    expect(chrome.kind).toBe('manual');
    expect(chrome.headline).toMatch(/Chrome/);
    expect(chrome.note).toMatch(/16\.4/);
    expect(guideFor(UA.iosEdge).steps[0].icon).toBe('menu-horizontal');
    expect(guideFor(UA.iosFirefox).steps[0].icon).toBe('menu-lines');
  });

  it('iPhone Chrome on an OS too old to install points to Safari', () => {
    const g = guideFor(UA.iosOldChrome);
    expect(g.kind).toBe('unsupported');
    expect(g.headline).toMatch(/Safari/);
    expect(g.steps[0].icon).toBe('share');
  });

  it('an unknown iOS browser points to Safari', () => {
    const g = guideFor(UA.iosWebView, { inApp: null });
    expect(g.kind).toBe('unsupported');
    expect(g.steps[0].icon).toBe('share');
  });

  it('Android browsers each get their own menu path', () => {
    expect(guideFor(UA.androidChrome).steps[0].icon).toBe('menu-vertical');
    expect(
      guideFor(UA.androidSamsung)
        .steps.map((s) => s.text)
        .join(' ')
    ).toMatch(/Add page to/);
    expect(guideFor(UA.androidFirefox).steps[1].text).toMatch(/Install/);
    expect(guideFor(UA.androidEdge).steps[1].text).toMatch(/Add to phone/);
    expect(guideFor(UA.androidChrome).kind).toBe('manual');
  });

  it('desktop: Chromium installs from the address bar, Safari adds to the Dock, Firefox is unsupported', () => {
    expect(guideFor(UA.macChrome).kind).toBe('manual');
    expect(guideFor(UA.macChrome).steps[0].text).toMatch(/address bar/);
    expect(guideFor(UA.winEdge).steps[1].text).toMatch(/Apps/);
    const safari = guideFor(UA.macSafari);
    expect(safari.kind).toBe('manual');
    expect(safari.steps[1].text).toMatch(/Add to Dock/);
    const firefox = guideFor(UA.winFirefox);
    expect(firefox.kind).toBe('unsupported');
    expect(firefox.intro).toMatch(/Chrome or Edge/);
  });

  it('every platform/browser combination yields a guide with at least one step', () => {
    for (const platform of Object.keys(BROWSERS_FOR_PLATFORM) as InstallPlatform[]) {
      for (const browser of [...BROWSERS_FOR_PLATFORM[platform], 'other' as const]) {
        const g = getInstallGuide({
          platform,
          browser,
          inApp: null,
          canPromptInstall: false,
          isInstalled: false,
        });
        expect(g.steps.length, `${platform}/${browser}`).toBeGreaterThan(0);
        expect(g.headline, `${platform}/${browser}`).toBeTruthy();
        expect(g.afterInstall, `${platform}/${browser}`).toBeTruthy();
      }
    }
  });
});

describe('buildOpenInBrowserUrl', () => {
  const href = 'https://marching.art/install?ref=discord';

  it('hands iOS to Safari via x-safari-https', () => {
    expect(buildOpenInBrowserUrl('ios', href)).toBe(
      'x-safari-https://marching.art/install?ref=discord'
    );
    expect(buildOpenInBrowserUrl('ipados', href)).toMatch(/^x-safari-https:\/\//);
  });

  it('hands Android to Chrome via an intent URL with a fallback', () => {
    const url = buildOpenInBrowserUrl('android', href);
    expect(url).toMatch(
      /^intent:\/\/marching\.art\/install\?ref=discord#Intent;scheme=https;package=com\.android\.chrome;/
    );
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent(href)}`);
  });

  it('has nothing to offer on desktop, or for non-https / malformed URLs', () => {
    expect(buildOpenInBrowserUrl('macos', href)).toBeNull();
    expect(buildOpenInBrowserUrl('ios', 'http://marching.art/')).toBeNull();
    expect(buildOpenInBrowserUrl('ios', 'not a url')).toBeNull();
  });
});
