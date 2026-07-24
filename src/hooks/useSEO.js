// =============================================================================
// SEO HOOK - PER-ROUTE DOCUMENT METADATA
// =============================================================================
// The SPA serves one index.html for every route, so titles, descriptions, and
// canonical URLs must be set client-side. Googlebot executes JS during its
// render pass and picks these up. Each public page calls useSEO with its own
// values; index.html provides the defaults for the homepage.

import { useEffect } from 'react';

const SITE_URL = 'https://marching.art';
const DEFAULT_TITLE = 'marching.art — Fantasy Drum Corps | Draft DCI Lineups & Compete';
const DEFAULT_DESCRIPTION =
  'marching.art is the free fantasy drum corps game. Draft legendary DCI captions, build your dream corps, and compete with directors worldwide on live leaderboards.';
// Mirrors the baked-in og:image block in index.html so unmount restores it.
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const DEFAULT_IMAGE_ALT = 'marching.art — the fantasy drum corps game';
const JSON_LD_ID = 'seo-route-jsonld';

/**
 * @param {'name' | 'property'} attr
 * @param {string} key
 * @param {string | null | undefined} content
 */
const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

/** @param {string} href */
const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

/**
 * Set og:image / twitter:image and their companion tags. index.html bakes in
 * width/height/alt for the default 1200×630 card; a route-specific image has
 * unknown dimensions, so those two tags are dropped rather than left lying
 * (crawlers treat wrong dimensions worse than missing ones).
 *
 * @param {string} imageUrl Absolute URL of the social card image.
 * @param {string} alt      Alt text for the image.
 * @param {boolean} isDefault Whether this is the site-default card.
 */
const setImage = (imageUrl, alt, isDefault) => {
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:image:alt', alt);
  setMeta('property', 'og:image:width', isDefault ? '1200' : null);
  setMeta('property', 'og:image:height', isDefault ? '630' : null);
  setMeta('name', 'twitter:image', imageUrl);
};

/** @param {string | null} json */
const setJsonLd = (json) => {
  let el = document.getElementById(JSON_LD_ID);
  if (!json) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('id', JSON_LD_ID);
    document.head.appendChild(el);
  }
  el.textContent = json;
};

/** @param {string | null | undefined} url */
const toAbsoluteUrl = (url) => {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Set document title, meta description, canonical URL, and social tags for a
 * route. Values reset to the site defaults when the component unmounts, so
 * navigating from a page with custom SEO back to one without it (e.g. the
 * dashboard) never leaks stale metadata.
 *
 * @param {Object}  options
 * @param {string}  [options.title]         Full document title.
 * @param {string}  [options.description]   Meta description (~155 chars).
 * @param {string}  [options.path]          Canonical path, e.g. '/how-to-play'.
 * @param {boolean} [options.noindex]       Exclude the page from search indexes.
 * @param {string}  [options.image]         Social card image (absolute URL or site path).
 * @param {string}  [options.imageAlt]      Alt text for the social card image.
 * @param {string}  [options.type]          og:type, e.g. 'article' (default 'website').
 * @param {string}  [options.publishedTime] ISO timestamp for article:published_time.
 * @param {string}  [options.modifiedTime]  ISO timestamp for article:modified_time.
 * @param {Record<string, unknown> | null} [options.jsonLd]
 *   Structured data injected as an application/ld+json script (e.g. a
 *   NewsArticle object). Replaces any previous route-level JSON-LD; the
 *   static @graph in index.html is separate and untouched.
 */
export function useSEO({
  title,
  description,
  path,
  noindex = false,
  image,
  imageAlt,
  type,
  publishedTime,
  modifiedTime,
  jsonLd = null,
} = {}) {
  // Objects are compared by reference in the deps array; serializing keeps the
  // effect from re-running every render when callers pass a fresh literal.
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE;
    const resolvedDescription = description || DEFAULT_DESCRIPTION;
    const canonicalUrl = `${SITE_URL}${path || '/'}`;
    const resolvedImage = toAbsoluteUrl(image) || DEFAULT_IMAGE;
    const resolvedImageAlt = imageAlt || (image ? resolvedTitle : DEFAULT_IMAGE_ALT);

    document.title = resolvedTitle;
    setMeta('name', 'description', resolvedDescription);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
    setCanonical(canonicalUrl);
    setMeta('property', 'og:title', resolvedTitle);
    setMeta('property', 'og:description', resolvedDescription);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:type', type || 'website');
    setImage(resolvedImage, resolvedImageAlt, !image);
    setMeta('property', 'article:published_time', type === 'article' ? publishedTime : null);
    setMeta('property', 'article:modified_time', type === 'article' ? modifiedTime : null);
    setMeta('name', 'twitter:title', resolvedTitle);
    setMeta('name', 'twitter:description', resolvedDescription);
    setJsonLd(jsonLdString);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
      setMeta('name', 'robots', null);
      setCanonical(`${SITE_URL}/`);
      setMeta('property', 'og:title', DEFAULT_TITLE);
      setMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      setMeta('property', 'og:url', `${SITE_URL}/`);
      setMeta('property', 'og:type', 'website');
      setImage(DEFAULT_IMAGE, DEFAULT_IMAGE_ALT, true);
      setMeta('property', 'article:published_time', null);
      setMeta('property', 'article:modified_time', null);
      setMeta('name', 'twitter:title', DEFAULT_TITLE);
      setMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
      setJsonLd(null);
    };
  }, [
    title,
    description,
    path,
    noindex,
    image,
    imageAlt,
    type,
    publishedTime,
    modifiedTime,
    jsonLdString,
  ]);
}

export default useSEO;
