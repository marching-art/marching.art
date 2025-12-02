// SoundSportTab - SoundSport ratings display
import React from 'react';
import { Music, Medal, Star } from 'lucide-react';
import LoadingScreen from '../../LoadingScreen';

// SoundSport rating helper
const getSoundSportRating = (score) => {
  if (score >= 90) return { rating: 'Gold', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' };
  if (score >= 75) return { rating: 'Silver', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-400/30' };
  if (score >= 60) return { rating: 'Bronze', color: 'text-orange-600', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-600/30' };
  return { rating: 'Participation', color: 'text-cream-500', bgColor: 'bg-cream-500/10', borderColor: 'border-cream-500/30' };
};

// Helper to get rating order for sorting (lower = better)
const getRatingOrder = (score) => {
  if (score >= 90) return 0; // Gold
  if (score >= 75) return 1; // Silver
  if (score >= 60) return 2; // Bronze
  return 3; // Participation
};

const SoundSportTab = ({ loading, allShows }) => {
  const soundSportShows = allShows.filter(show =>
    show.scores?.some(s => s.corpsClass === 'soundSport')
  );

  return (
    <div className="space-y-6">
      {/* SoundSport Info */}
      <div className="card p-4 md:p-6 border border-green-500/20">
        <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:block">
            <Music className="w-6 h-6 md:w-8 md:h-8 text-green-500 flex-shrink-0" />
            <h3 className="text-base md:text-lg font-semibold text-cream-100 md:hidden">
              About SoundSport
            </h3>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-cream-100 mb-2 hidden md:block">
              About SoundSport Scoring
            </h3>
            <p className="text-cream-300 text-sm md:text-base mb-4">
              SoundSport ensembles receive ratings (Gold, Silver, Bronze) based on their performance.
              Scores are not publicly announced or ranked.
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                <Medal className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-yellow-500 text-xs md:text-sm">Gold</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/10 border border-gray-400/30 rounded-full">
                <Medal className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-400 text-xs md:text-sm">Silver</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-600/30 rounded-full">
                <Medal className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-orange-600 text-xs md:text-sm">Bronze</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cream-500/10 border border-cream-500/30 rounded-full">
                <Medal className="w-4 h-4 text-cream-500" />
                <span className="font-semibold text-cream-500 text-xs md:text-sm">Participation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SoundSport Results */}
      {loading ? (
        <LoadingScreen fullScreen={false} />
      ) : soundSportShows.length > 0 ? (
        <div className="space-y-4">
          {soundSportShows.map((show, showIdx) => {
            // Filter and sort SoundSport scores by rating group, then alphabetically
            const sortedScores = show.scores
              .filter(s => s.corpsClass === 'soundSport')
              .sort((a, b) => {
                const ratingOrderA = getRatingOrder(a.score);
                const ratingOrderB = getRatingOrder(b.score);
                if (ratingOrderA !== ratingOrderB) {
                  return ratingOrderA - ratingOrderB; // Gold first, then Silver, Bronze, Participation
                }
                return a.corps.localeCompare(b.corps); // Alphabetical within same rating
              });

            return (
              <div key={showIdx} className="card p-4 md:p-6">
                <div className="mb-3 md:mb-4">
                  <h3 className="text-lg md:text-xl font-semibold text-cream-100">{show.eventName}</h3>
                  <p className="text-xs md:text-sm text-cream-500/60">{show.location} • {show.date}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {sortedScores.map((score, idx) => {
                    const ratingInfo = getSoundSportRating(score.score);
                    return (
                      <div
                        key={idx}
                        className={`p-3 md:p-4 rounded-lg border ${ratingInfo.bgColor} ${ratingInfo.borderColor}`}
                      >
                        <div className="flex items-center gap-2 md:gap-3">
                          <Medal className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ${ratingInfo.color}`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-cream-100 text-sm md:text-base truncate">{score.corps}</p>
                            <p className={`text-xs md:text-sm font-semibold ${ratingInfo.color}`}>
                              {ratingInfo.rating}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 md:p-12 text-center">
          <Star className="w-12 h-12 md:w-16 md:h-16 text-cream-500/30 mx-auto mb-4" />
          <p className="text-lg md:text-xl text-cream-300 mb-2">No Recent SoundSport Events</p>
          <p className="text-sm md:text-base text-cream-500/60">SoundSport event results will appear here when available</p>
        </div>
      )}
    </div>
  );
};

export default SoundSportTab;
