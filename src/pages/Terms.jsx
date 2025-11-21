// src/pages/Terms.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms = () => {
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
            Terms of Service
          </h1>

          <p className="text-cream-400 text-sm mb-6">
            Last updated: January 2025
          </p>

          <div className="space-y-6 text-cream-300">
            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">1. Acceptance of Terms</h2>
              <p className="text-sm">
                By accessing or using marching.art, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">2. Description of Service</h2>
              <p className="text-sm">
                marching.art is a fantasy drum corps game that allows users to create virtual corps, compete in leagues, and track scores based on real DCI performances. The service is provided for entertainment purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">3. User Accounts</h2>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>You must provide accurate information when creating an account</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must be at least 13 years old to use this service</li>
                <li>One account per person is permitted</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">4. User Conduct</h2>
              <p className="text-sm mb-2">You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Use offensive, abusive, or inappropriate names or content</li>
                <li>Harass, threaten, or intimidate other users</li>
                <li>Attempt to manipulate scores or game mechanics</li>
                <li>Use automated systems or bots</li>
                <li>Interfere with the proper functioning of the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">5. Intellectual Property</h2>
              <p className="text-sm">
                The service and its original content, features, and functionality are owned by marching.art and are protected by copyright and other intellectual property laws. DCI and corps names are trademarks of their respective owners.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">6. User Content</h2>
              <p className="text-sm">
                You retain ownership of content you create (corps names, show concepts). By posting content, you grant us a license to display it within the service. We may remove content that violates these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">7. Disclaimer of Warranties</h2>
              <p className="text-sm">
                The service is provided "as is" without warranties of any kind. We do not guarantee the service will be uninterrupted, secure, or error-free. Game scores and rankings are for entertainment only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">8. Limitation of Liability</h2>
              <p className="text-sm">
                To the maximum extent permitted by law, marching.art shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">9. Termination</h2>
              <p className="text-sm">
                We reserve the right to suspend or terminate your account at our discretion, with or without notice, for conduct that violates these terms or is harmful to other users or the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">10. Changes to Terms</h2>
              <p className="text-sm">
                We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-cream-100 mb-3">11. Contact</h2>
              <p className="text-sm">
                If you have questions about these Terms of Service, please contact us through the app.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
