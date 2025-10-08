import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  Calendar, 
  MapPin, 
  Trophy, 
  BarChart3, 
  TrendingUp, 
  Award, 
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
  Star,
  Medal
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/common/LoadingScreen';

const ScoresPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSeason, setCurrentSeason] = useState(null);
  const [recaps, setRecaps] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [classFilter, setClassFilter] = useState('all');
  const [detailModal, setDetailModal] = useState(false);
  const [chartModal, setChartModal] = useState(false);
  const [selectedCorps, setSelectedCorps] = useState(null);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      setLoading(true);
      setError('');

      // Get current season
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      
      if (!seasonDoc.exists()) {
        setError('No active season found');
        return;
      }

      const seasonData = seasonDoc.data();
      setCurrentSeason(seasonData);

      // Get recaps for current season
      const recapsDoc = await getDoc(doc(db, 'fantasy_recaps', seasonData.activeSeasonId));
      
      if (!recapsDoc.exists()) {
        setError('No scores available yet');
        return;
      }

      const recapsData = recapsDoc.data().recaps || [];
      
      // Sort by day (most recent first)
      recapsData.sort((a, b) => b.offSeasonDay - a.offSeasonDay);
      
      setRecaps(recapsData);
      
      // Set most recent day as default
      if (recapsData.length > 0) {
        setSelectedDay(recapsData[0]);
      }

    } catch (error) {
      console.error('Error fetching scores:', error);
      setError('Failed to load scores');
      toast.error('Failed to load scores');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'TBD';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'TBD';
    }
  };

  const formatScore = (score) => {
    return typeof score === 'number' ? score.toFixed(3) : '0.000';
  };

  const getFilteredResults = (results) => {
    if (classFilter === 'all') return results;
    return results.filter(corps => corps.corpsClass === classFilter);
  };

  const openCorpsDetail = (corps) => {
    setSelectedCorps(corps);
    setDetailModal(true);
  };

  const openChartModal = (show) => {
    setSelectedShow(show);
    setChartModal(true);
  };

  const getChartData = (results) => {
    return results.slice(0, 12).map(corps => ({
      name: corps.corpsName.length > 15 ? corps.corpsName.substring(0, 15) + '...' : corps.corpsName,
      'Total': parseFloat(corps.totalScore.toFixed(2)),
      'GE': parseFloat(corps.geScore.toFixed(2)),
      'Visual': parseFloat(corps.visualScore.toFixed(2)),
      'Music': parseFloat(corps.musicScore.toFixed(2))
    }));
  };

  const getCaptionAwards = (results) => {
    const captions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
    const awards = {};

    captions.forEach(caption => {
      let topCorps = null;
      let topScore = 0;

      results.forEach(corps => {
        if (corps.captionScores && corps.captionScores[caption]) {
          if (corps.captionScores[caption] > topScore) {
            topScore = corps.captionScores[caption];
            topCorps = corps;
          }
        }
      });

      if (topCorps) {
        awards[caption] = {
          corpsName: topCorps.corpsName,
          score: topScore,
          userId: topCorps.uid
        };
      }
    });

    return awards;
  };

  const getCaptionName = (abbr) => {
    const names = {
      'GE1': 'General Effect 1',
      'GE2': 'General Effect 2',
      'VP': 'Visual Proficiency',
      'VA': 'Visual Analysis',
      'CG': 'Color Guard',
      'B': 'Brass',
      'MA': 'Music Analysis',
      'P': 'Percussion'
    };
    return names[abbr] || abbr;
  };

  const navigateDay = (direction) => {
    const currentIndex = recaps.findIndex(r => r.offSeasonDay === selectedDay.offSeasonDay);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex - 1;
    } else {
      newIndex = currentIndex + 1;
    }
    
    if (newIndex >= 0 && newIndex < recaps.length) {
      setSelectedDay(recaps[newIndex]);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading scores..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Error Loading Scores</h3>
        <p className="text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={fetchScores}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (recaps.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">No Scores Available</h3>
        <p className="text-text-secondary-dark">
          Scores will appear after the first competition day
        </p>
      </div>
    );
  }

  const currentIndex = recaps.findIndex(r => r.offSeasonDay === selectedDay?.offSeasonDay);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < recaps.length - 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary-dark mb-2">Competition Results</h1>
        <p className="text-text-secondary-dark text-lg">
          {currentSeason?.seasonName || 'Season 2025'} • {recaps.length} Competition Days
        </p>
      </div>

      {/* Day Navigation */}
      <div className="bg-surface-dark rounded-theme p-4 shadow-theme-dark">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDay('prev')}
            disabled={!hasPrev}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              hasPrev
                ? 'bg-primary hover:bg-primary-dark text-on-primary'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Day
          </button>

          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary-dark">
              Day {selectedDay?.offSeasonDay}
            </h3>
            <p className="text-sm text-text-secondary-dark">
              {formatDate(selectedDay?.date)}
            </p>
          </div>

          <button
            onClick={() => navigateDay('next')}
            disabled={!hasNext}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              hasNext
                ? 'bg-primary hover:bg-primary-dark text-on-primary'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Next Day
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Class Filter Tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {['all', 'World Class', 'Open Class', 'A Class', 'SoundSport'].map(cls => (
          <button
            key={cls}
            onClick={() => setClassFilter(cls)}
            className={`px-6 py-2 rounded-theme font-medium transition-colors ${
              classFilter === cls
                ? 'bg-primary text-on-primary'
                : 'bg-surface-dark text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
            }`}
          >
            {cls === 'all' ? 'All Classes' : cls}
          </button>
        ))}
      </div>

      {/* Shows */}
      {selectedDay && selectedDay.shows && selectedDay.shows.length > 0 ? (
        <div className="space-y-6">
          {selectedDay.shows.map((show, showIndex) => {
            // FIX: Use show.name || show.eventName
            const showName = show.name || show.eventName || 'Competition Event';
            
            return (
              <div key={showIndex} className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
                {/* Show Header */}
                <div className="border-b border-accent-dark pb-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-text-primary-dark mb-1">
                        {showName}
                      </h3>
                      <p className="text-text-secondary-dark flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {show.location || 'Location TBA'}
                      </p>
                    </div>
                    <button
                      onClick={() => openChartModal(show)}
                      className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-theme font-medium transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      View Charts
                    </button>
                  </div>
                </div>

                {/* Caption Awards */}
                {Object.keys(captionAwards).length > 0 && (
                  <div className="bg-yellow-900 bg-opacity-20 border-b border-yellow-600 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-400" />
                      <h4 className="font-bold text-text-primary-dark">Caption Awards</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(captionAwards).map(([caption, award]) => (
                        <div key={caption} className="bg-background-dark rounded p-2 text-sm">
                          <div className="font-semibold text-yellow-400 mb-1">
                            {getCaptionName(caption)}
                          </div>
                          <div className="text-text-primary-dark truncate">
                            {award.corpsName}
                          </div>
                          <div className="text-text-secondary-dark text-xs">
                            {formatScore(award.score)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background-dark border-b border-accent-dark">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-text-primary-dark">
                          Rank
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-text-primary-dark">
                          Corps
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-text-primary-dark">
                          Class
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary-dark">
                          GE
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary-dark">
                          Visual
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary-dark">
                          Music
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary-dark">
                          Total
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-text-primary-dark">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-dark">
                      {filteredResults.map((corps, index) => (
                        <tr
                          key={index}
                          className="hover:bg-background-dark transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {index < 3 && (
                                <Medal className={`w-4 h-4 ${
                                  index === 0 ? 'text-yellow-400' :
                                  index === 1 ? 'text-gray-400' :
                                  'text-orange-600'
                                }`} />
                              )}
                              <span className="font-bold text-text-primary-dark">
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-semibold text-text-primary-dark">
                                {corps.corpsName}
                              </div>
                              {corps.directorName && (
                                <div className="text-xs text-text-secondary-dark">
                                  Dir: {corps.directorName}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-accent-dark text-text-primary-dark rounded text-xs font-medium">
                              {corps.corpsClass}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-text-primary-dark">
                            {formatScore(corps.geScore)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-text-primary-dark">
                            {formatScore(corps.visualScore)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-text-primary-dark">
                            {formatScore(corps.musicScore)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-lg text-primary-dark">
                              {formatScore(corps.totalScore)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openCorpsDetail(corps)}
                              className="text-primary-dark hover:text-primary font-medium text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Info className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
          <h3 className="text-xl font-medium text-text-primary-dark mb-2">
            No Results for Day {selectedDay?.offSeasonDay}
          </h3>
          <p className="text-text-secondary-dark">
            Scores will appear after this competition day completes
          </p>
        </div>
      )}

      {/* Corps Detail Modal */}
      {detailModal && selectedCorps && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark rounded-theme p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary-dark mb-1">
                  {selectedCorps.corpsName}
                </h2>
                <p className="text-text-secondary-dark">
                  {selectedCorps.corpsClass} • Total Score: {formatScore(selectedCorps.totalScore)}
                </p>
              </div>
              <button
                onClick={() => setDetailModal(false)}
                className="text-text-secondary-dark hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background-dark rounded-theme p-4 text-center">
                  <div className="text-sm text-text-secondary-dark mb-1">General Effect</div>
                  <div className="text-2xl font-bold text-text-primary-dark">
                    {formatScore(selectedCorps.geScore)}
                  </div>
                </div>
                <div className="bg-background-dark rounded-theme p-4 text-center">
                  <div className="text-sm text-text-secondary-dark mb-1">Visual Total</div>
                  <div className="text-2xl font-bold text-text-primary-dark">
                    {formatScore(selectedCorps.visualScore)}
                  </div>
                </div>
                <div className="bg-background-dark rounded-theme p-4 text-center">
                  <div className="text-sm text-text-secondary-dark mb-1">Music Total</div>
                  <div className="text-2xl font-bold text-text-primary-dark">
                    {formatScore(selectedCorps.musicScore)}
                  </div>
                </div>
              </div>

              {/* Caption Scores */}
              {selectedCorps.captionScores && (
                <div>
                  <h3 className="text-lg font-semibold text-text-primary-dark mb-3">
                    Caption Breakdown
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(selectedCorps.captionScores).map(([caption, score]) => (
                      <div key={caption} className="bg-background-dark rounded p-3">
                        <div className="text-xs text-text-secondary-dark mb-1">
                          {getCaptionName(caption)}
                        </div>
                        <div className="text-lg font-bold text-text-primary-dark font-mono">
                          {formatScore(score)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {chartModal && selectedShow && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark rounded-theme p-6 w-full max-w-6xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary-dark mb-1">
                  Score Visualization
                </h2>
                <p className="text-text-secondary-dark">
                  {selectedShow.eventName}
                </p>
              </div>
              <button
                onClick={() => setChartModal(false)}
                className="text-text-secondary-dark hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Chart */}
            <div className="bg-background-dark rounded-theme p-4">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={getChartData(selectedShow.results || [])}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Total" fill="#F59E0B" />
                  <Bar dataKey="GE" fill="#3B82F6" />
                  <Bar dataKey="Visual" fill="#10B981" />
                  <Bar dataKey="Music" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoresPage;