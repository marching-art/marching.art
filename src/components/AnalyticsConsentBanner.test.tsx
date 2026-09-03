import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsConsentBanner } from './AnalyticsConsentBanner';
import {
  ANALYTICS_CONSENT_KEY,
  resetAnalyticsConsent,
  setAnalyticsConsent,
} from '../utils/analyticsConsent';

const renderBanner = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AnalyticsConsentBanner />
    </MemoryRouter>
  );

beforeEach(() => resetAnalyticsConsent());

describe('AnalyticsConsentBanner', () => {
  it('asks on a first visit and records "Allow"', () => {
    renderBanner();
    const region = screen.getByRole('region', { name: /help improve marching\.art/i });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    );

    fireEvent.click(screen.getByRole('button', { name: /^allow$/i }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
    expect(screen.queryByTestId('analytics-consent')).toBeNull();
  });

  it('records "No thanks" and hides', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /no thanks/i }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
    expect(screen.queryByTestId('analytics-consent')).toBeNull();
  });

  it('stays off the sign-in, sign-up, reset and onboarding forms', () => {
    for (const path of ['/login', '/register', '/forgot-password', '/onboarding']) {
      const { unmount } = renderBanner(path);
      expect(screen.queryByTestId('analytics-consent')).toBeNull();
      unmount();
    }
    renderBanner('/how-to-play');
    expect(screen.getByTestId('analytics-consent')).toBeInTheDocument();
  });

  it('never renders once a decision exists', () => {
    setAnalyticsConsent('denied');
    renderBanner();
    expect(screen.queryByTestId('analytics-consent')).toBeNull();
  });
});
