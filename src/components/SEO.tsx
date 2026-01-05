// src/components/SEO.tsx
// SEO meta tags and structured data component
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
}

const DEFAULT_TITLE = 'marching.art - Fantasy Drum Corps Manager';
const DEFAULT_DESCRIPTION = 'Build and manage your own fantasy drum corps. Hire legendary staff, compete in shows, and lead your corps to championship glory.';
const DEFAULT_IMAGE = '/og-image.png';
const SITE_URL = 'https://marching.art';

export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  noIndex = false,
}) => {
  const fullTitle = title ? `${title} | marching.art` : DEFAULT_TITLE;
  const fullImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const fullCanonical = canonical ? `${SITE_URL}${canonical}` : undefined;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="marching.art" />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {/* Theme Color for Mobile */}
      <meta name="theme-color" content="#0f0f0f" />

      {/* Apple Mobile */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="marching.art" />
    </Helmet>
  );
};

// Pre-configured SEO for common pages
export const DashboardSEO: React.FC = () => (
  <SEO
    title="Dashboard"
    description="Manage your fantasy drum corps, view scores, and track your progress."
    canonical="/dashboard"
  />
);

export const ScoresSEO: React.FC = () => (
  <SEO
    title="Scores & Leaderboard"
    description="View scores, rankings, and leaderboards for fantasy drum corps competition."
    canonical="/scores"
  />
);

export const ScheduleSEO: React.FC = () => (
  <SEO
    title="Schedule"
    description="View the season schedule and register your corps for upcoming shows."
    canonical="/schedule"
  />
);

export const LeaguesSEO: React.FC = () => (
  <SEO
    title="Leagues"
    description="Join or create leagues to compete against other fantasy drum corps directors."
    canonical="/leagues"
  />
);

export const ProfileSEO: React.FC<{ username?: string }> = ({ username }) => (
  <SEO
    title={username ? `${username}'s Profile` : 'Profile'}
    description={username ? `View ${username}'s fantasy drum corps profile and achievements.` : 'Your fantasy drum corps profile and achievements.'}
    type="profile"
  />
);

export default SEO;
