// Shared site-wide link constants.
//
// The Discord invite used to be pasted literally into GameShell, the Landing
// header, ArticleSiteHeader, and PodiumLanding — four copies that had to be
// edited together whenever the invite rotated. One source of truth instead.
export const DISCORD_URL = 'https://discord.gg/YvFRJ97A5H';

// Public, crawlable pages that every shell links to. Kept in one place so the
// footer, the signed-in links menu, and the server-rendered /results pages
// cannot drift apart.
export const PUBLIC_LINKS = [
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/podium-guide', label: 'Podium Guide' },
  { to: '/hall-of-champions', label: 'Hall of Champions' },
];

export const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];
