// =============================================================================
// SEO HOOK TESTS
// =============================================================================
// The hook mutates document.head directly, so assertions read the live DOM.
// jsdom gives each test file a fresh document; unmount-reset tests share it.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useSEO } from './useSEO';

const DEFAULT_TITLE = 'marching.art — Fantasy Drum Corps | Draft DCI Lineups & Compete';
const DEFAULT_IMAGE = 'https://marching.art/og-image.jpg';

const meta = (attr: 'name' | 'property', key: string): string | null =>
  document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;

const canonical = (): string | null =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

const jsonLd = (): Record<string, unknown> | null => {
  const el = document.getElementById('seo-route-jsonld');
  return el?.textContent ? JSON.parse(el.textContent) : null;
};

const SeoProbe = (props: Parameters<typeof useSEO>[0]) => {
  useSEO(props);
  return null;
};

describe('useSEO', () => {
  it('sets title, description, canonical, and social tags', () => {
    render(
      <SeoProbe title="Finals Recap | marching.art" description="A recap." path="/article/finals" />
    );
    expect(document.title).toBe('Finals Recap | marching.art');
    expect(meta('name', 'description')).toBe('A recap.');
    expect(canonical()).toBe('https://marching.art/article/finals');
    expect(meta('property', 'og:title')).toBe('Finals Recap | marching.art');
    expect(meta('property', 'og:url')).toBe('https://marching.art/article/finals');
    expect(meta('name', 'twitter:title')).toBe('Finals Recap | marching.art');
  });

  it('defaults og:type to website and honors an article type with published time', () => {
    const { rerender } = render(<SeoProbe title="T" />);
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'article:published_time')).toBeNull();

    rerender(<SeoProbe title="T" type="article" publishedTime="2026-07-20T02:00:00.000Z" />);
    expect(meta('property', 'og:type')).toBe('article');
    expect(meta('property', 'article:published_time')).toBe('2026-07-20T02:00:00.000Z');
  });

  it('sets a custom social image without the default card dimensions', () => {
    render(<SeoProbe title="T" image="https://cdn.example.com/hero.jpg" imageAlt="Hero image" />);
    expect(meta('property', 'og:image')).toBe('https://cdn.example.com/hero.jpg');
    expect(meta('name', 'twitter:image')).toBe('https://cdn.example.com/hero.jpg');
    expect(meta('property', 'og:image:alt')).toBe('Hero image');
    // Unknown dimensions must not inherit the default 1200×630.
    expect(meta('property', 'og:image:width')).toBeNull();
    expect(meta('property', 'og:image:height')).toBeNull();
  });

  it('resolves a site-relative image against the site origin', () => {
    render(<SeoProbe title="T" image="/images/card.png" />);
    expect(meta('property', 'og:image')).toBe('https://marching.art/images/card.png');
  });

  it('injects and removes route-level JSON-LD', () => {
    const { unmount } = render(
      <SeoProbe title="T" jsonLd={{ '@type': 'NewsArticle', headline: 'T' }} />
    );
    expect(jsonLd()).toEqual({ '@type': 'NewsArticle', headline: 'T' });
    unmount();
    expect(jsonLd()).toBeNull();
  });

  it('sets robots noindex only when asked', () => {
    const { rerender } = render(<SeoProbe title="T" />);
    expect(meta('name', 'robots')).toBeNull();
    rerender(<SeoProbe title="T" noindex />);
    expect(meta('name', 'robots')).toBe('noindex, nofollow');
  });

  it('restores all defaults on unmount', () => {
    const { unmount } = render(
      <SeoProbe
        title="Custom"
        description="Custom description"
        path="/custom"
        image="https://cdn.example.com/hero.jpg"
        type="article"
        publishedTime="2026-07-20T02:00:00.000Z"
        noindex
      />
    );
    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(canonical()).toBe('https://marching.art/');
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:image')).toBe(DEFAULT_IMAGE);
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'article:published_time')).toBeNull();
    expect(meta('name', 'robots')).toBeNull();
  });
});
