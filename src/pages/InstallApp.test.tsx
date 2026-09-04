// /install renders the guide the hook detected, lets a director switch to a
// different device, offers the one-tap install when the browser has one, and
// walks an in-app-browser visitor out to Safari/Chrome first.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getInstallGuide, type InstallGuide } from '../utils/installGuide';

const trackFunnelEvent = vi.fn();
vi.mock('../api/funnel', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEvent(...args),
  CLIENT_FUNNEL_EVENTS: { INSTALL_GUIDE_VIEWED: 'install_guide_viewed' },
}));

const promptInstall = vi.fn();
let hookState: {
  platform: InstallGuide['platform'];
  browser: InstallGuide['browser'];
  inAppBrowser: InstallGuide['inApp'];
  canPromptInstall: boolean;
  isInstalled: boolean;
};
vi.mock('../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    ...hookState,
    needsManualInstall: !hookState.isInstalled && !hookState.canPromptInstall,
    promptInstall,
    guide: getInstallGuide({
      platform: hookState.platform,
      browser: hookState.browser,
      inApp: hookState.inAppBrowser,
      canPromptInstall: hookState.canPromptInstall,
      isInstalled: hookState.isInstalled,
    }),
  }),
}));

import InstallApp from './InstallApp';

const renderPage = () =>
  render(
    <MemoryRouter>
      <InstallApp />
    </MemoryRouter>
  );

describe('InstallApp (/install)', () => {
  beforeEach(() => {
    trackFunnelEvent.mockClear();
    promptInstall.mockReset();
    hookState = {
      platform: 'ios',
      browser: 'safari',
      inAppBrowser: null,
      canPromptInstall: false,
      isInstalled: false,
    };
  });

  it('shows iPhone Safari steps for a Safari-on-iPhone visitor and logs the view', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /Install on iPhone \(Safari\)/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tap the Share button/)).toBeInTheDocument();
    expect(screen.getByText(/Scroll down and tap "Add to Home Screen"/)).toBeInTheDocument();
    expect(screen.getByText(/Detected: iPhone · Safari/)).toBeInTheDocument();
    expect(trackFunnelEvent).toHaveBeenCalledWith('install_guide_viewed', {
      kind: 'manual',
      platform: 'ios',
      browser: 'safari',
      in_app: 'none',
    });
  });

  it('switches to another device’s steps from the chips', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Android' }));
    expect(
      screen.getByRole('heading', { level: 2, name: /Install on Android \(Chrome\)/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tap the ⋮ menu/)).toBeInTheDocument();
    // Not the detected device any more, so no "Detected" badge.
    expect(screen.queryByText(/Detected:/)).not.toBeInTheDocument();

    // Samsung Internet is blocked on Android 14+ — the guide hands off to Chrome.
    fireEvent.click(screen.getByRole('button', { name: 'Samsung Internet' }));
    expect(
      screen.getByRole('heading', { level: 2, name: /Install on Android — use Chrome/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Chrome installs it in three taps/)).toBeInTheDocument();
  });

  it('gives a Samsung Internet visitor a one-tap Open in Chrome hand-off', () => {
    hookState = { ...hookState, platform: 'android', browser: 'samsung' };
    renderPage();
    const open = screen.getByRole('link', { name: /Open in Chrome/ });
    expect(open).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^intent:\/\/marching\.art\/install#Intent;scheme=https;package=com\.android\.chrome;/
      )
    );
    expect(screen.getByText(/Tap the ⋮ menu/)).toBeInTheDocument();
  });

  it('offers a one-tap install when the browser has a native prompt', async () => {
    hookState = { ...hookState, platform: 'android', browser: 'chrome', canPromptInstall: true };
    promptInstall.mockResolvedValue('accepted');
    renderPage();
    const button = screen.getByRole('button', { name: /Install marching\.art/ });
    fireEvent.click(button);
    expect(promptInstall).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      'install_guide_viewed',
      expect.objectContaining({ kind: 'native' })
    );
  });

  it('walks an Instagram in-app visitor out to Safari before the install steps', () => {
    hookState = {
      ...hookState,
      browser: 'other',
      inAppBrowser: { id: 'instagram', name: 'Instagram' },
    };
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /Open this page in Safari first/ })
    ).toBeInTheDocument();
    const open = screen.getByRole('link', { name: /Open in Safari/ });
    expect(open).toHaveAttribute('href', 'x-safari-https://marching.art/install');
    expect(screen.getByText(/Tap "Open in browser"/)).toBeInTheDocument();
    // The chip for the detected browser names the host app, not "your browser".
    expect(screen.getByRole('button', { name: 'Instagram (in-app)' })).toBeInTheDocument();
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      'install_guide_viewed',
      expect.objectContaining({ kind: 'open-in-browser', in_app: 'instagram' })
    );
  });

  it('tells an already-installed director there is nothing to do', () => {
    hookState = { ...hookState, isInstalled: true };
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /using the installed app/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tap the Share button/)).not.toBeInTheDocument();
  });

  it('lists the troubleshooting answers', () => {
    renderPage();
    expect(screen.getByText(/Do I need the App Store or Play Store\?/)).toBeInTheDocument();
    expect(
      screen.getByText(/Android shows "Open marching\.art" instead of "Install"/)
    ).toBeInTheDocument();
  });
});
