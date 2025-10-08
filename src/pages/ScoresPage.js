import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useDataStore } from '../store/dataStore';
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
  const { 
    fetchCurrentSeason: getCachedSeason, 
    fetchRecaps: getCachedRecaps 
  } = useDataStore();
  
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
  const [captionAwards, setCaptionAwards] = useState({});
  const [filteredResults, setFilteredResults] = useState([]);

  useEffect(() => {
    loadScoresData();
  }, []);

  // Filter results when classFilter or selectedShow changes
  useEffect(() => {
    if (selectedShow && selectedShow.results) {
      if (classFilter === 'all') {
        setFilteredResults(selectedShow.results);
      } else {
        setFilteredResults(selectedShow.results.filter(r => r.corpsClass === classFilter));
      }
    }
  }, [selectedShow, classFilter]);

  const loadScoresData = async () => {
    try {
      setLoading(true);
      setError('');

      // OPTIMIZED: Use cached season data
      const seasonData = await getCachedSeason();
      
      if (!seasonData) {
        setError('No active season found');
        return;
      }

      setCurrentSeason(seasonData);

      // OPTIMIZED: Use cached recaps data
      const recapsData = await getCachedRecaps(seasonData.activeSeasonId);
      
      if (!recapsData || recapsData.length === 0) {
        setError('No scores available yet');
        return;
      }

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

  const getPlacementColor = (placement) => {
    switch(placement) {
      case 1: return 'text-yellow-500';
      case 2: return 'text-gray-400';
      case 3: return 'text-orange-600';
      default: return 'text-text-primary dark:text-text-primary-dark';
    }
  };

  const getPlacementIcon = (placement) => {
    switch(placement) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-orange-600" />;
      default: return null;
    }
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

  const openCorpsDetail = (corps) => {
    setSelectedCorps(corps);
    setDetailModal(true);
  };

  const openChartView = (corps) => {
    setSelectedCorps(corps);
    setChartModal(true);
  };

  const getChartData = (corps) => {
    if (!corps || !corps.captionScores) return [];

    return Object.entries(corps.captionScores).map(([caption, score]) => ({
      caption: getCaptionName(caption),
      score: parseFloat(score) || 0
    }));
  };

  if (loading) {
    return <LoadingScreen message="Loading scores..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
          Error Loading Scores
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={loadScoresData}
          className="bg-primary hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary text-on-primary dark:text-on-primary-dark px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (recaps.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
          No Scores Available
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
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
        <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Competition Results
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          {currentSeason?.seasonName || 'Season 2025'} • {recaps.length} Competition Days
        </p>
      </div>

      {/* Day Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDay('prev')}
            disabled={!hasPrev}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              hasPrev
                ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
                : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous Day
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Day {selectedDay?.offSeasonDay}
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              {formatDate(selectedDay?.date)}
            </p>
          </div>

          <button
            onClick={() => navigateDay('next')}
            disabled={!hasNext}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              hasNext
                ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
                : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
            }`}
          >
            Next Day
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Class Filter */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-text-primary dark:text-text-primary-dark">
            Filter by Class:
          </span>
          <div className="flex gap-2">
            {['all', 'World Class', 'Open Class', 'A Class', 'SoundSport'].map((cls) => (
              <button
                key={cls}
                onClick={() => setClassFilter(cls)}
                className={`px-4 py-2 rounded-theme font-medium transition-colors ${
                  classFilter === cls
                    ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark'
                    : 'bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark hover:bg-primary dark:hover:bg-primary-dark hover:bg-opacity-20 dark:hover:bg-opacity-20'
                }`}
              >
                {cls === 'all' ? 'All Classes' : cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shows List */}
      {selectedDay && selectedDay.shows && (
        <div className="space-y-6">
          {selectedDay.shows.map((show, showIndex) => {
            const showName = show.name || show.eventName || 'Competition Event';
            
            // Filter results by class
            const showResults = classFilter === 'all' 
              ? show.results 
              : show.results.filter(r => r.corpsClass === classFilter);

            // Sort by total score descending
            showResults.sort((a, b) => b.totalScore - a.totalScore);

            if (showResults.length === 0) return null;

            return (
              <div key={showIndex} className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
                {/* Show Header */}
                <div className="border-b border-accent dark:border-accent-dark pb-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                        {showName}
                      </h3>
                      <p className="text-text-secondary dark:text-text-secondary-dark flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {show.location || 'Location TBA'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Competitors
                      </div>
                      <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                        {showResults.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-accent dark:border-accent-dark">
                        <th className="text-left py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Rank
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Corps
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Class
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          GE
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Visual
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Music
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Total
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-text-primary dark:text-text-primary-dark">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showResults.map((result, index) => (
                        <tr
                          key={result.uid || index}
                          className="border-b border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark hover:bg-opacity-10 dark:hover:bg-opacity-10 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              {getPlacementIcon(index + 1)}
                              <span className={`text-lg font-bold ${getPlacementColor(index + 1)}`}>
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                {result.corpsName}
                              </div>
                              <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                {result.alias || result.displayName}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="px-2 py-1 bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 text-primary dark:text-primary-dark rounded-full text-sm font-medium">
                              {result.corpsClass}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center text-text-primary dark:text-text-primary-dark font-medium">
                            {formatScore(result.geTotal)}
                          </td>
                          <td className="py-4 px-4 text-center text-text-primary dark:text-text-primary-dark font-medium">
                            {formatScore(result.visualTotal)}
                          </td>
                          <td className="py-4 px-4 text-center text-text-primary dark:text-text-primary-dark font-medium">
                            {formatScore(result.musicTotal)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-xl font-bold text-primary dark:text-primary-dark">
                              {formatScore(result.totalScore)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openCorpsDetail(result)}
                                className="p-2 bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 text-primary dark:text-primary-dark rounded-theme hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-colors"
                                title="View Details"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openChartView(result)}
                                className="p-2 bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 text-primary dark:text-primary-dark rounded-theme hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-colors"
                                title="View Chart"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Caption High Scores */}
                {captionAwards[showName] && (
                  <div className="mt-6 pt-6 border-t border-accent dark:border-accent-dark">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary dark:text-primary-dark" />
                      Caption High Scores
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(captionAwards[showName]).map(([caption, winner]) => (
                        <div key={caption} className="bg-background dark:bg-background-dark p-3 rounded-theme">
                          <div className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">
                            {getCaptionName(caption)}
                          </div>
                          <div className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
                            {winner.corpsName}
                          </div>
                          <div className="text-primary dark:text-primary-dark font-bold">
                            {formatScore(winner.score)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Corps Detail Modal */}
      {detailModal && selectedCorps && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                  {selectedCorps.corpsName}
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  {selectedCorps.alias || selectedCorps.displayName}
                </p>
              </div>
              <button
                onClick={() => setDetailModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="space-y-6">
              {/* Total Score */}
              <div className="bg-gradient-to-r from-primary dark:from-primary-dark to-secondary dark:to-secondary-dark p-6 rounded-theme text-center">
                <div className="text-white text-opacity-90 mb-2">Total Score</div>
                <div className="text-5xl font-bold text-white">
                  {formatScore(selectedCorps.totalScore)}
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                  <div className="text-text-secondary dark:text-text-secondary-dark mb-2">
                    General Effect
                  </div>
                  <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {formatScore(selectedCorps.geTotal)}
                  </div>
                </div>
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                  <div className="text-text-secondary dark:text-text-secondary-dark mb-2">
                    Visual Total
                  </div>
                  <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {formatScore(selectedCorps.visualTotal)}
                  </div>
                </div>
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                  <div className="text-text-secondary dark:text-text-secondary-dark mb-2">
                    Music Total
                  </div>
                  <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    {formatScore(selectedCorps.musicTotal)}
                  </div>
                </div>
              </div>

              {/* Caption Scores */}
              <div>
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                  Caption Scores
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedCorps.captionScores && Object.entries(selectedCorps.captionScores).map(([caption, score]) => (
                    <div key={caption} className="bg-background dark:bg-background-dark p-4 rounded-theme">
                      <div className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">
                        {getCaptionName(caption)}
                      </div>
                      <div className="text-xl font-bold text-primary dark:text-primary-dark">
                        {formatScore(score)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lineup Information */}
              {selectedCorps.lineup && (
                <div>
                  <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                    Caption Selections
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(selectedCorps.lineup).map(([caption, corps]) => (
                      <div key={caption} className="bg-background dark:bg-background-dark p-3 rounded-theme flex justify-between items-center">
                        <span className="text-text-secondary dark:text-text-secondary-dark text-sm">
                          {getCaptionName(caption)}
                        </span>
                        <span className="font-medium text-text-primary dark:text-text-primary-dark">
                          {corps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setDetailModal(false)}
                  className="px-6 py-2 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {chartModal && selectedCorps && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                  Caption Performance
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  {selectedCorps.corpsName}
                </p>
              </div>
              <button
                onClick={() => setChartModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData(selectedCorps)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="caption" 
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
                  <Bar dataKey="score" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setChartModal(false)}
                className="px-6 py-2 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoresPage;