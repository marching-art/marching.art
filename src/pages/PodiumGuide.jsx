// PodiumGuide — the public Podium Class guide (Phase 7.6, design §7).
// FMA-style: short numbered sections, plain language, everything a new
// director needs and nothing they don't. Public and crawlable, like
// /how-to-play. Content is distilled from docs/PODIUM_CLASS_DESIGN.md.

import React from 'react';
import { Link } from 'react-router-dom';
import { Medal, ChevronLeft } from 'lucide-react';

const SECTIONS = [
  {
    n: 1,
    title: 'What is Podium Class?',
    body: `Podium Class is the director's chair. Instead of drafting historical caption scores like the fantasy classes, you FOUND a drum corps and earn every point: you run rehearsals day by day, route a tour, manage food, travel, morale, and money, and your show grows the way real shows grow. One corps per director. It is always open and always free to play — like SoundSport, there is no unlock.`,
  },
  {
    n: 2,
    title: 'Founding your corps',
    body: `Pick a name, a hometown, and a show challenge for each of the 8 captions (1 = safe and clean early, 8 = a monster book that only pays off if you clean it). Optionally weight your audition pool toward brass, percussion, or visual talent. You start at the reputation tier your corps history has earned — a brand-new corps starts as a Community Corps.`,
  },
  {
    n: 3,
    title: 'The daily loop',
    body: `Every day you get 12 rehearsal blocks (20 in spring training, 4 on show days). Seven block types cover the ensemble: Stretching/PT, Visual Basics, Visual Ensemble, Guard Sectionals, Brass Sectionals, Percussion Sectionals (battery + front ensemble), and Full Ensemble. Each block installs CONTENT early and CLEANS it late — the balance shifts across the season, just like a real summer. Hammering the same block all day pays less per rep after the first four. A caption you ignore starts to decay after a few days.`,
  },
  {
    n: 4,
    title: 'The assistant director',
    body: `Save a plan template and any day you don't log in, your assistant runs it at reduced yield. Missing a day is growth lost, never a wrecked season. Playing yourself always beats the assistant — but the assistant never sleeps.`,
  },
  {
    n: 5,
    title: 'Condition: stamina, morale, food, rest',
    body: `Rehearsal costs stamina; low stamina cuts your yields. Nights recover some, a declared rest day recovers a lot. Grinding at maximum for days builds fatigue and drains morale. Your food plan (gas station, standard, full kitchen) nudges recovery — money buys margin, never access. A broke corps can always play; it just feels like a broke corps.`,
  },
  {
    n: 6,
    title: 'The tour: shows, travel, majors',
    body: `Pick up to 4 shows a week from the same schedule every class uses. Miles cost Corps Budget and stamina — routing matters, and southern venues in July drain more. Three majors anchor the season for everyone: the Southwestern Championship in Dallas (Day 28), the Southeastern in Atlanta (Day 35), and the two-night Eastern Classic in Allentown (Days 41–42, one registration covers both nights, you perform your assigned night). Podium corps attend all three automatically, plus Championship Week in Indianapolis: A Class and Open Class run Prelims and Class Finals on Days 47–48; World Class runs Prelims, Semifinals, and Finals through Day 49.`,
  },
  {
    n: 7,
    title: 'Scoring',
    body: `Your 8 captions score against the real historical envelope of DCI results for that day of the season — how much show you have installed, how clean it is, and your corps condition decide where in the band you land. Recaps drop nightly around 2 AM ET as a full-caption box score (Podium is the only class that shows all 8 captions). No corps ever scores 100; the all-time ceiling is 99.70 and it is meant to be a once-in-a-generation feat.`,
  },
  {
    n: 8,
    title: 'Reputation: the climb to Champion Status',
    body: `Reputation attaches to your corps and is earned ONLY from competitive results, season over season. Seven tiers — Community Corps up through Champion Status — and your tier caps how high in the historical envelope you can score. Nobody debuts a champion: like Crown, the Bluecoats, and Boston, Champion Status takes roughly a dozen strong seasons. Skip seasons and your corps returns weaker than it left — though old glory speeds the re-climb. Champions can still be beaten under the right circumstances.`,
  },
  {
    n: 9,
    title: 'Divisions: A Class, Open Class, World Class',
    body: `Every corps starts in A Class. At each season's end the whole veteran field is assessed against published cutoffs (balanced thirds of the finals scores): finish above the next division's cutoff and you rise — one division per season, A to Open to World, the same climb corps made in the old days. Falling below your division's line gives you one grace season; two straight seasons below it and you drop one division. Sit out a season and your seat is held once; miss two or more and you restart in A Class. Each division crowns its own champions and medals at Finals.`,
  },
  {
    n: 10,
    title: 'Money: Corps Budget and CorpsCoin',
    body: `Your Corps Budget is the season operating ledger: funded by an optional capped CorpsCoin commitment plus show payouts and fundraiser blocks; spent on travel, food, camp days, and clinicians. CorpsCoin is the game-wide currency. Nothing you can buy ever adds a point to a score — donations and purchases grant zero competitive advantage, ever.`,
  },
  {
    n: 11,
    title: 'Staff',
    body: `Staff are persistent people with careers. Each season a shared market opens — caption techs, a tour manager, a program coordinator — and every person signs with exactly ONE corps. Contracts run 1–3 seasons at the salary locked at signing; tenure raises both a person's tier and their price, so a 25-year legend costs a fortune while the total staff boost stays capped — decisions beat payroll, always. You can post a contract to the mid-season transfer market (the buyer pays a premium, you recoup the rest), or retrain a person into a new caption (reduced boost while they learn). Careers end in retirement around season 30 — Hall of Fame stuff — and fresh talent enters every season, so the market never maxes out.`,
  },
  {
    n: 12,
    title: 'Joint rehearsals',
    body: `Propose a shared rehearsal day with another corps. If they accept: Full Ensemble sharpens for both, morale lifts, and each director privately receives the scrimmage report — a caption-by-caption head-to-head, the only scouting outside a shared floor. One per week; you must be within a day trip of each other on tour, or the proposer pays the travel. Repeat pairings decay, so spread the handshakes around.`,
  },
  {
    n: 13,
    title: 'Spring training (live seasons)',
    body: `During a live season the first 21 calendar days are spring training: 20 blocks a day of pure install (content-heavy, no shows, no scores), camp days that cost a little Budget when you rehearse, and the whole thing closes with the Family Day exhibition — a private diagnostic score only you see, so you know exactly what you're taking on tour. Off-seasons skip camp and open competition-ready.`,
  },
  {
    n: 14,
    title: 'Host your own show',
    body: `Any director can rent a venue and put a real event on the season schedule — open enrollment for every class, and you earn CorpsCoin for every corps that performs. Start with a high school stadium (day-one affordable), and run successful shows to unlock the College Bowl and eventually an NFL stadium. A well-drawn show profits; a great host funds a whole corps this way.`,
  },
  {
    n: 15,
    title: 'The record',
    body: `Every season is archived forever: your profile carries the full season history, medals, and trophies; champions enter the Hall of Champions; and the weekly Podium Report power rankings chart the whole class. Fans vote a Fan Favorite each season — prelims ballots at every major, finals during Championship Week, banner at season end (cosmetic, always). Your trajectory chart draws real historical ghosts — Crown '12, Bluecoats '10, Jersey Surf, Pioneer — so you always know whose season you're living. The recap sheet is built to be screenshotted — argue about it somewhere public.`,
  },
];

export default function PodiumGuide() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Masthead */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-white mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> marching.art
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="w-6 h-6 text-[#c9a227]" />
            <h1 className="text-2xl font-bold">The Podium Class Guide</h1>
          </div>
          <p className="text-sm text-gray-400">
            Run a drum corps. Earn every point. Twelve short sections — everything you need.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.n} id={`s${section.n}`}>
              <h2 className="text-sm font-bold text-[#c9a227] uppercase tracking-wider mb-1.5">
                {section.n}. {section.title}
              </h2>
              <p className="text-[13px] leading-relaxed text-gray-300">{section.body}</p>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-10 pt-6 border-t border-[#333] flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Podium Class is always open — found your corps from the Dashboard.
          </span>
          <Link
            to="/dashboard"
            className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-[#c9a227] text-black rounded-none"
          >
            Play
          </Link>
        </div>
      </div>
    </div>
  );
}
