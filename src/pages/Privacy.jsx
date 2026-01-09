// src/pages/Privacy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBodyScroll } from '../hooks/useBodyScroll';

const Privacy = () => {
  useBodyScroll();

  return (
    <div className="min-h-screen bg-gradient-main">
      <div className="container-responsive py-8 px-4 max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-cream-300 hover:text-gold-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="glass-dark rounded-2xl p-6 sm:p-8">
          <h1 className="text-3xl font-display font-bold text-gradient mb-6">
            Privacy Policy
          </h1>

          <p className="text-cream-400 text-sm mb-6">
            Last updated: January 2026
          </p>

          <div className="space-y-6 text-cream-300">
            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">1. Information We Collect</h2>
              <p className="mb-2">We collect information you provide directly:</p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Account information (email address, display name)</li>
                <li>Profile information (location, bio)</li>
                <li>Game data (corps names, scores, achievements)</li>
              </ul>
              <p className="mt-2 text-sm">We automatically collect:</p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Usage data (pages visited, features used)</li>
                <li>Device information (browser type, operating system)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>To provide and maintain the game service</li>
                <li>To personalize your experience</li>
                <li>To display leaderboards and public profiles</li>
                <li>To communicate updates and announcements</li>
                <li>To improve our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">3. YouTube API Services</h2>
              <p className="text-sm mb-2">
                Our service uses the YouTube API Services to display video content related to drum corps performances. By using marching.art, you are also agreeing to be bound by the{' '}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-500 hover:text-gold-400 underline"
                >
                  YouTube Terms of Service
                </a>.
              </p>
              <p className="text-sm mb-2">
                When you use YouTube features within our service, your use is also governed by{' '}
                <a
                  href="http://www.google.com/policies/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-500 hover:text-gold-400 underline"
                >
                  Google's Privacy Policy
                </a>.
              </p>
              <p className="text-sm">
                We store limited metadata about YouTube videos (video ID, title, thumbnail URL, channel name) to improve search performance. We do not store any YouTube user data, access tokens, or personal information from YouTube.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">4. Information Sharing</h2>
              <p className="text-sm">
                We do not sell your personal information. We may share information:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2 mt-2">
                <li>Publicly (display names, scores, achievements on leaderboards)</li>
                <li>With service providers who assist our operations</li>
                <li>When required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">5. Cookies and Tracking Technologies</h2>
              <p className="text-sm mb-2">
                We and our service providers (including Google/YouTube) may store, access, or collect information directly or indirectly on or from your device by placing, accessing, or recognizing cookies or similar technologies on your device or browser.
              </p>
              <p className="text-sm mb-2">
                Cookies are used to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Maintain your session and authentication state</li>
                <li>Remember your preferences</li>
                <li>Analyze usage patterns to improve our service</li>
                <li>Enable YouTube video playback functionality</li>
              </ul>
              <p className="text-sm mt-2">
                When you watch YouTube videos embedded in our service, YouTube may set cookies on your device. You can manage cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">6. Data Security</h2>
              <p className="text-sm">
                We implement reasonable security measures to protect your information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">7. Your Rights</h2>
              <p className="text-sm">You may:</p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Access and update your account information</li>
                <li>Request deletion of your account</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">8. Children's Privacy</h2>
              <p className="text-sm">
                Our service is not intended for children under 13. We do not knowingly collect information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">9. Changes to This Policy</h2>
              <p className="text-sm">
                We may update this policy from time to time. We will notify you of significant changes by posting the new policy on this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">10. Contact Us</h2>
              <p className="text-sm">
                If you have questions about this Privacy Policy, please contact us at:{' '}
                <a
                  href="mailto:contact@marching.art"
                  className="text-gold-500 hover:text-gold-400 underline"
                >
                  contact@marching.art
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
