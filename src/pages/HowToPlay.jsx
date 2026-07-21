// =============================================================================
// GAME GUIDE - THE COMPLETE, COHESIVE HOW-TO-PLAY DOCUMENT (/guide)
// =============================================================================
// One scrolling document that tells the whole story in order — what the game
// is, how you start, how you score, how you progress, and the second way to
// play (Podium Class), all in a single consistent format. A sticky section
// navigator (left rail on desktop, chip bar on mobile) with scroll-spy keeps
// it easy to jump around. Public mirror: /how-to-play (HowToPlayPublic.jsx).
//
// This file is the shell (header, navigator, scroll-spy, search). The section
// bodies live in howToPlaySections.jsx.
//
// Design laws: no glow, no shadow, dense data, sharp corners (rounded-none),
// data-terminal palette (azure interactive, gold brand/Podium).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Compass,
  Rocket,
  Target,
  Trophy,
  Layers,
  TrendingUp,
  Calendar,
  Coins,
  Users,
  Medal,
  Book,
  HelpCircle,
  Search,
} from 'lucide-react';
import { GuideSection } from './howToPlaySections';
import { SearchResults } from './howToPlaySearch';

// Section order + labels + icons. Ids must match SECTION_CONTENT keys.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'start', label: 'Getting Started', icon: Rocket },
  { id: 'captions', label: 'The 8 Captions', icon: Target },
  { id: 'scoring', label: 'How Scoring Works', icon: Trophy },
  { id: 'classes', label: 'Classes & Ratings', icon: Layers },
  { id: 'progression', label: 'Progression', icon: TrendingUp },
  { id: 'season', label: 'Season Calendar', icon: Calendar },
  { id: 'economy', label: 'CorpsCoin', icon: Coins },
  { id: 'leagues', label: 'Leagues', icon: Users },
  { id: 'podium', label: 'Podium Class', icon: Medal },
  { id: 'glossary', label: 'Glossary', icon: Book },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

const HowToPlay = () => {
  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const query = searchQuery.trim();
  const searching = query.length >= 2;

  const setSectionRef = (id) => (el) => {
    if (el) sectionRefs.current[id] = el;
  };

  // Scroll-spy: highlight whichever section is nearest the top of the viewport.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || searching || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root, rootMargin: '0px 0px -75% 0px', threshold: 0 }
    );

    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [searching]);

  const scrollToSection = useCallback((id) => {
    setSearchQuery('');
    setActiveId(id);
    // Defer so the section list is mounted again after leaving search mode.
    requestAnimationFrame(() => {
      const root = scrollRef.current;
      const el = sectionRefs.current[id];
      if (root && el) {
        const top =
          el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
        root.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header: title + search + mobile section nav */}
      <div className="flex-shrink-0 border-b border-white/10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-interactive/20 rounded-none flex items-center justify-center">
              <Book className="w-4 h-4 text-interactive" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Game Guide</h1>
              <p className="text-[10px] text-muted">Everything you need to know, in order</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              placeholder="Search the guide..."
              aria-label="Search the game guide"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-3 bg-black/30 border border-white/10 rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive/50"
            />
          </div>
        </div>

        {/* Mobile section chips */}
        {!searching && (
          <div className="lg:hidden overflow-x-auto scrollbar-hide border-t border-white/10">
            <div className="flex gap-1 px-2 py-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap rounded-none transition-colors ${
                    activeId === s.id
                      ? 'text-white bg-interactive'
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {searching ? (
          <div className="max-w-5xl mx-auto px-4 py-6">
            <SearchResults query={query} onNavigate={scrollToSection} />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 flex gap-6">
            {/* Desktop section rail */}
            <nav className="hidden lg:block w-52 flex-shrink-0 sticky top-0 self-start pt-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-3 mb-2">
                Sections
              </p>
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const active = activeId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => scrollToSection(s.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-none transition-colors ${
                          active
                            ? 'text-white bg-interactive/15 border-l-2 border-interactive'
                            : 'text-muted hover:text-secondary hover:bg-white/5 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${active ? 'text-interactive' : ''}`}
                        />
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 py-6 space-y-12 pb-24">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} ref={setSectionRef(s.id)}>
                  <GuideSection id={s.id} />
                </section>
              ))}

              {/* Quick reference footer */}
              <div className="border-t border-white/10 pt-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider">Budgets</p>
                    <p className="text-xs text-white font-mono">90/60/120/150</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider">Unlocks</p>
                    <p className="text-xs text-white font-mono">1/2/3 seasons</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider">Captions</p>
                    <p className="text-xs text-white font-mono">8 per lineup</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HowToPlay;
