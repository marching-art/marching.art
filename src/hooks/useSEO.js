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
 * Set document title, meta description, canonical URL, and social tags for a
 * route. Values reset to the site defaults when the component unmounts, so
 * navigating from a page with custom SEO back to one without it (e.g. the
 * dashboard) never leaks stale metadata.
 *
 * @param {Object}  options
 * @param {string}  [options.title]       Full document title.
 * @param {string}  [options.description] Meta description (~155 chars).
 * @param {string}  [options.path]        Canonical path, e.g. '/how-to-play'.
 * @param {boolean} [options.noindex]     Exclude the page from search indexes.
 */
export function useSEO({ title, description, path, noindex = false } = {}) {
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE;
    const resolvedDescription = description || DEFAULT_DESCRIPTION;
    const canonicalUrl = `${SITE_URL}${path || '/'}`;

    document.title = resolvedTitle;
    setMeta('name', 'description', resolvedDescription);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
    setCanonical(canonicalUrl);
    setMeta('property', 'og:title', resolvedTitle);
    setMeta('property', 'og:description', resolvedDescription);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('name', 'twitter:title', resolvedTitle);
    setMeta('name', 'twitter:description', resolvedDescription);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
      setMeta('name', 'robots', null);
      setCanonical(`${SITE_URL}/`);
      setMeta('property', 'og:title', DEFAULT_TITLE);
      setMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      setMeta('property', 'og:url', `${SITE_URL}/`);
      setMeta('name', 'twitter:title', DEFAULT_TITLE);
      setMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
    };
  }, [title, description, path, noindex]);
}

export default useSEO;
