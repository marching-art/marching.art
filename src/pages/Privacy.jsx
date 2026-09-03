// src/pages/Privacy.jsx
import React from 'react';
import { Heading } from '../components/ui';
import { useSEO } from '../hooks/useSEO';
import { APP_CONFIG } from '../config';

// Chrome comes from PublicShell — this page used to offer a lone "Back to Home"
// link as its entire navigation.
//
// Keep this honest: every processor and practice named below exists in the
// codebase (see ARCHITECTURE.md and docs/INTEGRATIONS.md). When a new one is
// added — a new vendor, a new signal the integrity job reads, a new place a
// director's words are republished — add it here in the same change.
const LAST_UPDATED = 'September 1, 2026';

const linkClass = 'text-interactive hover:text-interactive-hover underline';

const Privacy = () => {
  useSEO({
    title: 'Privacy Policy | marching.art',
    description: 'Privacy policy for marching.art, the free fantasy drum corps game.',
    path: '/privacy',
  });

  return (
    <div className="container-responsive py-8 px-4 max-w-3xl mx-auto">
      <div className="bg-surface-card border border-line rounded-none p-6 sm:p-8">
        <Heading level="display" className="text-gradient mb-6">
          Privacy Policy
        </Heading>

        <p className="text-muted text-sm mb-6">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-6 text-secondary">
          <section>
            <Heading level="title" className="mb-3">
              1. Information We Collect
            </Heading>
            <p className="mb-2 text-sm">Information you give us:</p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>Account information: email address, director name, username, password.</li>
              <li>
                Date of birth, collected once at sign-up to confirm you are old enough to play. It
                is stored privately, never shown on your profile, and not used for anything else.
              </li>
              <li>Profile information you choose to add: location, bio, favorite corps.</li>
              <li>
                Game content you create: corps names, show concepts, lineups and picks, uniform
                designs, league names and chat, comments, and press releases.
              </li>
              <li>
                Supporter information — if you support us through Buy Me a Coffee, we receive the
                email address and name associated with your payment so we can grant supporter
                recognition. Payment card details are handled entirely by Buy Me a Coffee and are
                never seen or stored by us.
              </li>
            </ul>
            <p className="mt-2 text-sm">Information collected automatically:</p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>Usage data (pages visited, features used) through Google Analytics.</li>
              <li>Device information (browser type, operating system).</li>
              <li>
                Activity that the game itself records: when you sign in, when you claim daily
                rewards, and your in-game transactions (CorpsCoin has no real-money value).
              </li>
              <li>
                If you turn on push notifications, a device token that lets us deliver them. It is
                stored privately and removed when you turn notifications off.
              </li>
              <li>
                If the app crashes or hits an error, a report containing the error, the page you
                were on, and your browser type — no account identifier.
              </li>
            </ul>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              2. How We Use Your Information
            </Heading>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>To provide and maintain the game service and keep your account secure.</li>
              <li>To personalize your experience and remember your preferences.</li>
              <li>
                To display leaderboards, standings, public profiles, and public corps pages (your
                director name and username, corps names, scores, placements, and achievements are
                public; your lineup is not).
              </li>
              <li>
                To recognize supporters (profile flair and the public Supporters wall, which you can
                opt out of at any time).
              </li>
              <li>
                To send you the notifications you have enabled: in-app, push, and email (score
                drops, lineup deadlines, league activity, streak reminders, digests). Each can be
                turned off in Settings.
              </li>
              <li>To protect fair play — see section 4.</li>
              <li>To measure how the game is used, in aggregate, and improve it.</li>
            </ul>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              3. Generated Content and Where Your Words Travel
            </Heading>
            <p className="text-sm mb-2">
              Parts of the game are produced by software, and some of what you write is republished
              by the game. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>
                Corps avatars and the images and articles in the game newsroom are generated with
                Google&apos;s Gemini and Imagen models. The prompts include public game data — corps
                names, show concepts, uniform colors, scores — never your email, date of birth, or
                private settings.
              </li>
              <li>
                Press releases you publish, and newsroom articles that mention your corps and
                director name, are also posted to the marching.art community Discord server.
                Anything you publish in the game should be treated as public.
              </li>
              <li>
                League chat is visible to the members of that league. League activity feeds are
                visible to league members.
              </li>
            </ul>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              4. Fair-Play and Account-Integrity Checks
            </Heading>
            <p className="text-sm mb-2">
              Leagues, prediction pools, and community votes only work if one person is one
              director. To protect that, the game runs an automated review that looks for accounts
              likely to belong to the same person — for example, several accounts whose email
              addresses normalize to the same inbox, accounts created together in a burst, or
              accounts sharing the same identifying profile details.
            </p>
            <p className="text-sm">
              These checks produce signals for a human to look at. No account is suspended,
              restricted, or otherwise penalized automatically; any restriction is a decision made
              by a person, and you can contact us to dispute it (section 11).
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              5. Service Providers
            </Heading>
            <p className="text-sm mb-2">
              We do not sell your personal information, and we do not share it with advertisers. We
              use the following providers to run the game, each of which processes data only on our
              behalf and under its own privacy policy:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>
                Google Firebase (authentication, database, hosting, push notification delivery) and
                Google Cloud (servers, logging, error reporting).
              </li>
              <li>Google Analytics (usage measurement).</li>
              <li>Google Gemini / Imagen (generated avatars, images, and articles — section 3).</li>
              <li>Brevo (email delivery — digests and notifications you have enabled).</li>
              <li>Cloudinary (image hosting for avatars and share cards).</li>
              <li>Discord (community announcements — section 3).</li>
              <li>Buy Me a Coffee (donations, if you choose to support the game).</li>
              <li>YouTube Data API (video search and embeds — section 6).</li>
            </ul>
            <p className="text-sm mt-2">
              We may also disclose information when required by law, or to protect the rights,
              safety, or integrity of the game and its players.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              6. YouTube API Services
            </Heading>
            <p className="text-sm mb-2">
              Our service uses the YouTube API Services to display video content related to drum
              corps performances. By using marching.art, you are also agreeing to be bound by the{' '}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                YouTube Terms of Service
              </a>
              . When you use YouTube features within our service, your use is also governed by{' '}
              <a
                href="http://www.google.com/policies/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Google&apos;s Privacy Policy
              </a>
              .
            </p>
            <p className="text-sm">
              We store limited metadata about YouTube videos (video ID, title, thumbnail URL,
              channel name) to improve search performance. We do not store any YouTube user data,
              access tokens, or personal information from YouTube.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              7. Cookies and Similar Technologies
            </Heading>
            <p className="text-sm mb-2">
              We and our service providers (including Google/YouTube) may store or read cookies and
              similar technologies on your device. They are used to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>Maintain your session and authentication state</li>
              <li>Remember your preferences on this device</li>
              <li>Analyze usage patterns to improve our service</li>
              <li>Enable YouTube video playback functionality</li>
            </ul>
            <p className="text-sm mt-2">
              When you watch YouTube videos embedded in our service, YouTube may set cookies on your
              device. You can manage cookie preferences through your browser settings; the game
              works without analytics cookies.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              8. How Long We Keep Information
            </Heading>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>
                Your account, profile, and game content are kept for as long as your account exists.
              </li>
              <li>
                When you delete your account, everything stored under it is deleted: your profile
                and its public copy, private settings, device tokens, date of birth, corps, uniform
                wardrobe, season and caption history, CorpsCoin ledger, notifications, Podium
                career, email log, and profile comments. Your supporter link is detached and your
                corps names are released. Your director name is removed from past results,
                standings, and champion records — the scores themselves remain, with no name
                attached, because other players&apos; standings depend on them.
              </li>
              <li>
                Aggregate statistics (how many directors were active, how much CorpsCoin was earned
                across the game) are kept without any personal identifiers.
              </li>
              <li>
                Server logs and error reports are retained by our cloud provider for a limited
                period for security and debugging and then deleted.
              </li>
            </ul>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              9. Data Security
            </Heading>
            <p className="text-sm">
              We implement reasonable security measures to protect your information, including
              access rules that keep private data (your email, date of birth, device tokens)
              readable only by you and the game&apos;s own servers. However, no method of
              transmission over the Internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              10. Your Rights and Choices
            </Heading>
            <p className="text-sm mb-2">Wherever you live, you can:</p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              <li>Access and update your account information in Settings.</li>
              <li>Turn each kind of notification on or off in Settings.</li>
              <li>Opt out of being named on the public Supporters wall.</li>
              <li>
                Delete your account from Settings at any time (see section 8 for what that removes).
                Deletion is permanent.
              </li>
              <li>
                Ask us for a copy of the personal information we hold about you, or to correct it —
                email us (section 11).
              </li>
            </ul>
            <p className="text-sm mt-2">
              If you are in the European Economic Area or the United Kingdom, our legal bases for
              processing are: performance of our contract with you (running the game you signed up
              for), our legitimate interests (keeping the game fair and secure, understanding how it
              is used), and your consent (optional notifications and analytics cookies, which you
              can withdraw at any time). You also have the right to object to processing, to
              portability, and to lodge a complaint with your local supervisory authority. Data is
              processed on servers in the United States.
            </p>
            <p className="text-sm mt-2">
              If you are a California resident, you have the right to know what personal information
              we collect and how it is used (this policy), to request deletion, and not to be
              discriminated against for exercising those rights. We do not sell or share personal
              information as those terms are defined in the CCPA/CPRA.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              11. Contact Us
            </Heading>
            <p className="text-sm">
              Questions about this policy, requests about your data, or a dispute about a fair-play
              restriction:{' '}
              <a href={`mailto:${APP_CONFIG.supportEmail}`} className={linkClass}>
                {APP_CONFIG.supportEmail}
              </a>
              .
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              12. Children&apos;s Privacy
            </Heading>
            <p className="text-sm">
              Our service is for people aged 13 and over. We ask for a date of birth at sign-up and
              do not create accounts for anyone younger. If you believe a child under 13 has an
              account, contact us and we will delete it.
            </p>
          </section>

          <section>
            <Heading level="title" className="mb-3">
              13. Changes to This Policy
            </Heading>
            <p className="text-sm">
              We may update this policy from time to time. Significant changes are announced on the
              What&apos;s New page and by updating the date at the top of this page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
