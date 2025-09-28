import React, { useState, useEffect } from 'react';
import { db } from 'firebaseConfig';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, MapPin, Trophy, BarChart3, TrendingUp, Award, Users } from 'lucide-react';

const ScoresPage = () => {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showResults, setShowResults] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedCorps, setSelectedCorps] = useState(null);
  const [chartView, setChartView] = useState('scores');

  const currentSeason = '2025';
  const captions = ['GE1', 'GE2', 'Visual Proficiency', 'Visual Analysis', 'Color Guard', 'Brass', 'Music Analysis', 'Percussion'];

  useEffect(() => {
    fetchShows();
  }, [currentSeason]);

  useEffect(() => {
    if (selectedShow) {
      fetchShowResults(selectedShow.id);
    }
  }, [selectedShow]);

  const fetchShows = async () => {
    try {
      const showsRef = collection(db, 'schedules');
      const q = query(
        showsRef,
        where('season', '==', currentSeason),
        where('hasResults', '==', true),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const showsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setShows(showsData);
      
      // Set most recent show as default
      if (showsData.length > 0) {
        setSelectedShow(showsData[0]);
        setSelectedDate(showsData[0].date);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShowResults = async (showId) => {
    try {
      const resultsRef = collection(db, `fantasy_recaps/${showId}/results`);
      const q = query(resultsRef, orderBy('totalScore', 'desc'));
      const snapshot = await getDocs(q);
      
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setShowResults(results);
    } catch (error) {
      console.error('Error fetching show results:', error);
      setShowResults([]);
    }
  };

  const openCorpsDetail = async (corps) => {
    try {
      // Fetch detailed score breakdown
      const detailRef = doc(db, `fantasy_recaps/${selectedShow.id}/details/${corps.id}`);
      const detailSnap = await getDoc(detailRef);
      
      if (detailSnap.exists()) {
        setSelectedCorps({
          ...corps,
          details: detailSnap.data()
        });
      } else {
        setSelectedCorps(corps);
      }
      setDetailModal(true);
    } catch (error) {
      console.error('Error fetching corps details:', error);
      setSelectedCorps(corps);
      setDetailModal(true);
    }
  };

  const formatScore = (score) => {
    return typeof score === 'number' ? score.toFixed(3) : '0.000';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRankBadge = (rank) => {
    let badgeClass = 'bg-surface-dark border-accent-dark text-text-primary-dark';
    if (rank === 1) badgeClass = 'bg-yellow-500 border-yellow-600 text-black';
    else if (rank === 2) badgeClass = 'bg-gray-400 border-gray-500 text-black';
    else if (rank === 3) badgeClass = 'bg-amber-600 border-amber-700 text-white';
    
    return `${badgeClass} border rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm`;
  };

  const getClassBadge = (className) => {
    const colors = {
      'World Class': 'bg-red-500 text-white',
      'Open Class': 'bg-blue-500 text-white',
      'A Class': 'bg-green-500 text-white',
      'SoundSport': 'bg-purple-500 text-white'
    };
    
    return `${colors[className] || 'bg-gray-500 text-white'} px-2 py-1 rounded text-xs font-medium`;
  };

  const getChartData = () => {
    return showResults.slice(0, 12).map(corps => ({
      name: corps.corpsName.length > 12 ? corps.corpsName.substring(0, 12) + '...' : corps.corpsName,
      score: corps.totalScore,
      ge: corps.generalEffect || 0,
      visual: corps.visualTotal || 0,
      music: corps.musicTotal || 0
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary-dark mb-2">Competition Results</h1>
        <p className="text-text-secondary-dark text-lg">
          {currentSeason} Season • {shows.length} Shows with Results
        </p>
      </div>

      {/* Show Selection */}
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h3 className="text-lg font-semibold text-text-primary-dark mb-4">Select Competition</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shows.map(show => (
            <button
              key={show.id}
              onClick={() => setSelectedShow(show)}
              className={`p-4 rounded-theme border-2 transition-colors text-left ${
                selectedShow?.id === show.id
                  ? 'border-primary bg-primary/10'
                  : 'border-accent-dark hover:border-primary-dark'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-text-primary-dark">{show.showName}</h4>
                <Trophy className="w-5 h-5 text-primary-dark" />
              </div>
              <div className="space-y-1 text-sm text-text-secondary-dark">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(show.date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{show.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{show.participatingCorps?.length || 0} Corps</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Results Display */}
      {selectedShow && (
        <div className="space-y-6">
          {/* Show Header */}
          <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-text-primary-dark">{selectedShow.showName}</h2>
                <p className="text-text-secondary-dark">{formatDate(selectedShow.date)} • {selectedShow.location}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartView('scores')}
                  className={`px-4 py-2 rounded-theme flex items-center gap-2 ${
                    chartView === 'scores' ? 'bg-primary text-on-primary' : 'bg-accent-dark text-text-primary-dark'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Scores
                </button>
                <button
                  onClick={() => setChartView('breakdown')}
                  className={`px-4 py-2 rounded-theme flex items-center gap-2 ${
                    chartView === 'breakdown' ? 'bg-primary text-on-primary' : 'bg-accent-dark text-text-primary-dark'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Breakdown
                </button>
              </div>
            </div>

            {/* Chart Display */}
            {showResults.length > 0 && (
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'scores' ? (
                    <BarChart data={getChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgb(40 28 20)', 
                          border: '1px solid rgb(101 67 33)',
                          borderRadius: '0.75rem'
                        }}
                      />
                      <Bar dataKey="score" fill="#F7941D" />
                    </BarChart>
                  ) : (
                    <LineChart data={getChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgb(40 28 20)', 
                          border: '1px solid rgb(101 67 33)',
                          borderRadius: '0.75rem'
                        }}
                      />
                      <Line type="monotone" dataKey="ge" stroke="#F7941D" name="General Effect" />
                      <Line type="monotone" dataKey="visual" stroke="#8B4513" name="Visual" />
                      <Line type="monotone" dataKey="music" stroke="#DCD7C5" name="Music" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Results Table */}
          {showResults.length > 0 ? (
            <div className="bg-surface-dark rounded-theme shadow-theme-dark overflow-hidden">
              <div className="bg-accent-dark p-4">
                <div className="grid grid-cols-12 gap-4 font-semibold text-text-primary-dark">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-4">Corps</div>
                  <div className="col-span-2 text-center">Class</div>
                  <div className="col-span-2 text-center">General Effect</div>
                  <div className="col-span-2 text-center">Total Score</div>
                  <div className="col-span-1 text-center">Details</div>
                </div>
              </div>

              <div className="divide-y divide-accent-dark">
                {showResults.map((corps, index) => (
                  <div
                    key={corps.id}
                    className={`grid grid-cols-12 gap-4 p-4 hover:bg-background-dark transition-colors ${
                      index < 3 ? 'bg-gradient-to-r from-accent-dark/20 to-transparent' : ''
                    }`}
                  >
                    <div className="col-span-1 flex justify-center items-center">
                      <div className={getRankBadge(index + 1)}>
                        {index + 1}
                      </div>
                    </div>

                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded border border-accent-dark flex-shrink-0"
                          style={{ 
                            backgroundColor: corps.uniforms?.primaryColor || '#8B4513',
                            borderColor: corps.uniforms?.secondaryColor || '#F7941D'
                          }}
                        />
                        <div>
                          <button
                            onClick={() => window.location.href = `/profile/${corps.userId}`}
                            className="font-semibold text-text-primary-dark hover:text-primary-dark transition-colors"
                          >
                            {corps.corpsName}
                          </button>
                          <p className="text-sm text-text-secondary-dark">{corps.directorName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <span className={getClassBadge(corps.class)}>
                        {corps.class}
                      </span>
                    </div>

                    <div className="col-span-2 text-center">
                      <p className="text-lg font-semibold text-text-primary-dark">
                        {formatScore(corps.generalEffect)}
                      </p>
                      <div className="flex justify-center gap-2 text-sm text-text-secondary-dark">
                        <span>V: {formatScore(corps.visualTotal)}</span>
                        <span>M: {formatScore(corps.musicTotal)}</span>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <p className="text-xl font-bold text-primary-dark">
                        {formatScore(corps.totalScore)}
                      </p>
                    </div>

                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => openCorpsDetail(corps)}
                        className="text-primary-dark hover:text-primary transition-colors"
                      >
                        <Award className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
              <h3 className="text-xl font-medium text-text-primary-dark mb-2">
                No results available
              </h3>
              <p className="text-text-secondary-dark">
                Results will appear here after the competition.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Corps Detail Modal */}
      {detailModal && selectedCorps && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark rounded-theme p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary-dark">{selectedCorps.corpsName}</h2>
                <p className="text-text-secondary-dark">{selectedShow.showName} • {formatDate(selectedShow.date)}</p>
              </div>
              <button
                onClick={() => setDetailModal(false)}
                className="text-text-secondary-dark hover:text-text-primary-dark text-2xl"
              >
                ×
              </button>
            </div>

            {selectedCorps.details && (
              <div className="space-y-6">
                {/* Score Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-background-dark p-4 rounded-theme text-center">
                    <h4 className="font-semibold text-text-primary-dark mb-2">General Effect</h4>
                    <p className="text-2xl font-bold text-primary-dark">
                      {formatScore(selectedCorps.generalEffect)}
                    </p>
                  </div>
                  <div className="bg-background-dark p-4 rounded-theme text-center">
                    <h4 className="font-semibold text-text-primary-dark mb-2">Visual Total</h4>
                    <p className="text-2xl font-bold text-primary-dark">
                      {formatScore(selectedCorps.visualTotal)}
                    </p>
                  </div>
                  <div className="bg-background-dark p-4 rounded-theme text-center">
                    <h4 className="font-semibold text-text-primary-dark mb-2">Music Total</h4>
                    <p className="text-2xl font-bold text-primary-dark">
                      {formatScore(selectedCorps.musicTotal)}
                    </p>
                  </div>
                </div>

                {/* Caption Breakdown */}
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-4">Caption Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {captions.map(caption => (
                      <div key={caption} className="bg-background-dark p-3 rounded border border-accent-dark">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-text-primary-dark">{caption}</span>
                          <span className="font-bold text-primary-dark">
                            {formatScore(selectedCorps.details.captions?.[caption] || 0)}
                          </span>
                        </div>
                        {selectedCorps.details.captionCorps?.[caption] && (
                          <p className="text-sm text-text-secondary-dark mt-1">
                            {selectedCorps.details.captionCorps[caption]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoresPage;