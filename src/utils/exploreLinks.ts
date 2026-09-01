// =============================================================================
// EXPLORE LINKS — the game destinations that aren't part of the daily loop
// =============================================================================
// Shop, Achievements, Records, and the two archive galleries are real places a
// director goes — they just aren't the daily loop (Dashboard / Lineup /
// Schedule / Scores), so they don't belong in the primary nav. They used to
// live inside the ❓ help drawer (SiteLinksMenu) as "EXPLORE_LINKS", grouped
// under a question mark beside Privacy and the Game Guide — a director hunting
// for the Shop had to think to look under "help". They are game features, not
// help, so they get their own menu.
//
// One source of truth so the desktop Explore menu (Layout/ExploreMenu), the
// signed-in public header (Layout/SiteHeader), and the mobile More sheet
// (BottomNav) can never drift apart.
import {
  ShoppingBag,
  Award,
  BookOpen,
  Archive,
  History,
  Palette,
  Store,
  type LucideIcon,
} from 'lucide-react';

export interface AppLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Your progression & economy — the reward surfaces a director actually revisits.
// The Uniform Studio and the Design Exchange (home of the monthly Showcase
// vote and the Weekly Design Brief) belong here too: until 2026-09 neither
// appeared in ANY navigation surface — the Exchange was reachable from one
// link inside the Studio, and the Studio from nowhere but a dashboard card.
export const GAME_LINKS: AppLink[] = [
  { to: '/studio', label: 'Uniform Studio', icon: Palette },
  { to: '/exchange', label: 'Design Exchange', icon: Store },
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/records', label: 'Records', icon: BookOpen },
];

// The game world's archive — reference, browsed occasionally, not daily.
export const ARCHIVE_LINKS: AppLink[] = [
  { to: '/retired-corps', label: 'Retired Corps', icon: Archive },
  { to: '/corps-history', label: 'Corps History', icon: History },
];
