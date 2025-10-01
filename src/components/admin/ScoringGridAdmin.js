import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, RefreshCw, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { db, functions } from '../../firebaseConfig';
import { doc, getDoc, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const ScoringGridAdmin = () => {
  const [activeTab, setActiveTab] = useState('GE1');
  const [seasonData, setSeasonData] = useState(null);
  const [scoringGrid, setScoringGrid] = useState(null);
  const [seasonCorps, setSeasonCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSeasonId, setCurrentSeasonId] = useState(null);
  const [dateRange, setDateRange] = useState({ start: 1, end: 14 }); // Show 2 weeks at a time
  const [maxDay, setMaxDay] = useState(49);

  // Caption tabs matching DCI scoring system
  const captionTabs = [
    { id: 'GE1', label: 'GE1', color: 'bg-blue-600' },
    { id: 'GE2', label: 'GE2', color: 'bg-blue-600' },
    { id: 'VP', label: 'VP', color: 'bg-green-600' },
    { id: 'VA', label: 'VA', color: 'bg-green-600' },
    { id: 'CG', label: 'CG', color: 'bg-green-600' },
    { id: 'B', label: 'B', color: 'bg-red-600' },
    { id: 'MA', label: 'MA', color: 'bg-red-600' },
    { id: 'P', label: 'P', color: 'bg-red-600' },
    { id: 'TOTAL', label: 'TOTAL', color: 'bg-gray-800' },
    { id: 'EFFECT', label: 'EFFECT', color: 'bg-purple-600' },
    { id: 'VISUAL', label: 'VISUAL', color: 'bg-green-700' },
    { id: 'MUSIC', label: 'MUSIC', color: 'bg-red-700' },
  ];

  // Fetch current season and corps data on mount
  useEffect(() => {
    fetchCurrentSeasonData();
  }, []);

  // Fetch scoring grid when season changes
  useEffect(() => {
    if (currentSeasonId) {
      fetchScoringGrid();
    }
  }, [currentSeasonId]);

  const fetchCurrentSeasonData = async () => {
    try {
      setLoading(true);
      
      // Get current season from game-settings
      const gameSettingsDoc = await getDoc(doc(db, 'game-settings', 'current'));
      
      if (!gameSettingsDoc.exists()) {
        toast.error('No active season found');
        setLoading(false);
        return;
      }
      
      const gameData = gameSettingsDoc.data();
      const seasonId = gameData.activeSeasonId || gameData.currentSeasonId;
      
      setCurrentSeasonId(seasonId);
      setMaxDay(gameData.totalDays || (gameData.seasonType === 'live' ? 70 : 49));
      
      // Get season info
      setSeasonData({
        seasonId: seasonId,
        seasonName: gameData.seasonName,
        seasonType: gameData.seasonType,
        totalDays: gameData.totalDays,
        currentDay: gameData.currentDay,
        startDate: gameData.startDate.toDate(),
        endDate: gameData.endDate.toDate()
      });
      
      // Get corps for this season from dci-data
      const dciDataDoc = await getDoc(doc(db, 'dci-data', seasonId));
      
      if (!dciDataDoc.exists()) {
        toast.error('Corps data not found for current season');
        setLoading(false);
        return;
      }
      
      const dciData = dciDataDoc.data();
      const corps = dciData.corps || dciData.corpsValues || [];
      
      // Sort corps by value (descending) for display
      const sortedCorps = corps.sort((a, b) => b.value - a.value);
      setSeasonCorps(sortedCorps);
      
    } catch (error) {
      console.error('Error fetching season data:', error);
      toast.error('Failed to load season data');
    } finally {
      setLoading(false);
    }
  };

  const fetchScoringGrid = async () => {
    try {
      // Fetch from seasonal_scores collection
      const scoreGridDoc = await getDoc(doc(db, 'seasonal_scores', currentSeasonId));
      
      if (!scoreGridDoc.exists()) {
        toast.warning('Seasonal score grid not found. Scores will be generated on demand.');
        setScoringGrid({});
        return;
      }
      
      const gridData = scoreGridDoc.data();
      const grid = gridData.grid || {};
      
      // Process grid to calculate totals if not present
      const processedGrid = {};
      Object.keys(grid).forEach(corpsName => {
        processedGrid[corpsName] = {};
        Object.keys(grid[corpsName]).forEach(day => {
          const dayData = grid[corpsName][day];
          const captions = dayData.captions || dayData;
          
          // Ensure all captions exist
          processedGrid[corpsName][day] = {
            GE1: captions.GE1 || 0,
            GE2: captions.GE2 || 0,
            VP: captions.VP || 0,
            VA: captions.VA || 0,
            CG: captions.CG || 0,
            B: captions.B || 0,
            MA: captions.MA || 0,
            P: captions.P || 0,
          };
          
          // Calculate totals
          const ge = processedGrid[corpsName][day].GE1 + processedGrid[corpsName][day].GE2;
          const visual = (processedGrid[corpsName][day].VP + processedGrid[corpsName][day].VA + processedGrid[corpsName][day].CG) / 2;
          const music = (processedGrid[corpsName][day].B + processedGrid[corpsName][day].MA + processedGrid[corpsName][day].P) / 2;
          
          processedGrid[corpsName][day].EFFECT = parseFloat(ge.toFixed(2));
          processedGrid[corpsName][day].VISUAL = parseFloat(visual.toFixed(2));
          processedGrid[corpsName][day].MUSIC = parseFloat(music.toFixed(2));
          processedGrid[corpsName][day].TOTAL = parseFloat((ge + visual + music).toFixed(2));
        });
      });
      
      setScoringGrid(processedGrid);
      toast.success('Scoring grid loaded successfully');
      
    } catch (error) {
      console.error('Error fetching scoring grid:', error);
      toast.error('Failed to load scoring grid');
      setScoringGrid({});
    }
  };

  const refreshGrid = async () => {
    toast.info('Refreshing scoring grid...');
    await fetchScoringGrid();
  };

  const regenerateGrid = async () => {
    if (!window.confirm('This will regenerate the entire seasonal score grid. This may take a few minutes. Continue?')) {
      return;
    }
    
    try {
      toast.info('Regenerating seasonal score grid...');
      
      // Call the cloud function to regenerate
      const initializeSeason = httpsCallable(functions, 'initializeSeasonManually');
      const result = await initializeSeason({ regenerateGrid: true });
      
      if (result.data.success) {
        toast.success('Score grid regenerated successfully');
        await fetchScoringGrid();
      } else {
        toast.error('Failed to regenerate grid');
      }
    } catch (error) {
      console.error('Error regenerating grid:', error);
      toast.error('Failed to regenerate grid');
    }
  };

  const formatDate = (dayNumber) => {
    if (!seasonData) return `Day ${dayNumber}`;
    const date = new Date(seasonData.startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysToShow = () => {
    const days = [];
    for (let i = dateRange.start; i <= Math.min(dateRange.end, maxDay); i++) {
      days.push(i);
    }
    return days;
  };

  const getScoreForDay = (corpsName, day) => {
    if (!scoringGrid || !scoringGrid[corpsName] || !scoringGrid[corpsName][day]) {
      return null;
    }
    return scoringGrid[corpsName][day][activeTab];
  };

  const navigateDays = (direction) => {
    const step = 14; // Move 2 weeks at a time
    if (direction === 'prev') {
      setDateRange({
        start: Math.max(1, dateRange.start - step),
        end: Math.max(step, dateRange.end - step)
      });
    } else {
      setDateRange({
        start: Math.min(maxDay - step + 1, dateRange.start + step),
        end: Math.min(maxDay, dateRange.end + step)
      });
    }
  };

  const exportToCSV = () => {
    if (!scoringGrid || !seasonCorps.length) {
      toast.error('No data to export');
      return;
    }
    
    // Create CSV header
    let csv = `Corps,Value,${getDaysToShow().map(d => `Day ${d} (${formatDate(d)})`).join(',')}\n`;
    
    // Add data rows
    seasonCorps.forEach(corps => {
      const corpsName = corps.name || corps.corpsName;
      const scores = getDaysToShow().map(day => {
        const score = getScoreForDay(corpsName, day);
        return score !== null ? score : '';
      }).join(',');
      
      csv += `"${corpsName}",${corps.value},${scores}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSeasonId}_${activeTab}_scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading scoring grid...</span>
      </div>
    );
  }

  if (!seasonData || !seasonCorps.length) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Season Data Available</h3>
        <p className="text-text-secondary">Please initialize a season first.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
              Seasonal Scoring Grid
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {seasonData.seasonName} • Day {seasonData.currentDay} of {seasonData.totalDays}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshGrid}
              className="px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={regenerateGrid}
              className="px-3 py-2 bg-warning hover:bg-warning-dark text-white rounded-lg flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Regenerate
            </button>
            <button
              onClick={exportToCSV}
              className="px-3 py-2 bg-success hover:bg-success-dark text-white rounded-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Caption Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {captionTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} text-white`
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="p-4 bg-gray-800 flex justify-between items-center">
        <button
          onClick={() => navigateDays('prev')}
          disabled={dateRange.start === 1}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm">
            Days {dateRange.start} - {Math.min(dateRange.end, maxDay)}
          </span>
        </div>
        
        <button
          onClick={() => navigateDays('next')}
          disabled={dateRange.end >= maxDay}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scoring Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900">
              <th className="sticky left-0 bg-gray-900 z-10 px-4 py-2 text-left font-medium text-gray-300 border-r border-gray-700">
                Corps
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-300 border-r border-gray-700 min-w-[60px]">
                Value
              </th>
              {getDaysToShow().map(day => (
                <th 
                  key={day} 
                  className="px-2 py-2 text-center font-medium text-gray-300 min-w-[80px] border-r border-gray-700"
                >
                  <div className="text-xs">{formatDate(day)}</div>
                  <div className="text-xs text-gray-500">Day {day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasonCorps.map((corps, index) => {
              const corpsName = corps.name || corps.corpsName;
              const isEvenRow = index % 2 === 0;
              
              return (
                <tr 
                  key={corpsName}
                  className={`border-b border-gray-800 ${
                    isEvenRow ? 'bg-gray-900/30' : 'bg-gray-900/10'
                  } hover:bg-gray-800/50 transition-colors`}
                >
                  <td className="sticky left-0 px-4 py-2 font-medium text-gray-200 border-r border-gray-700"
                      style={{ backgroundColor: isEvenRow ? 'rgb(17 24 39 / 0.3)' : 'rgb(17 24 39 / 0.1)' }}>
                    {corpsName}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-400 border-r border-gray-700">
                    {corps.value}
                  </td>
                  {getDaysToShow().map(day => {
                    const score = getScoreForDay(corpsName, day);
                    const hasScore = score !== null;
                    
                    return (
                      <td 
                        key={day}
                        className={`px-2 py-2 text-center border-r border-gray-700 ${
                          hasScore ? 'text-gray-100' : 'text-gray-600'
                        }`}
                      >
                        {hasScore ? score.toFixed(1) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Corps:</span>
            <span className="ml-2 font-semibold">{seasonCorps.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Season Type:</span>
            <span className="ml-2 font-semibold capitalize">{seasonData.seasonType}</span>
          </div>
          <div>
            <span className="text-gray-400">Current Day:</span>
            <span className="ml-2 font-semibold">{seasonData.currentDay}</span>
          </div>
          <div>
            <span className="text-gray-400">Grid Coverage:</span>
            <span className="ml-2 font-semibold">
              {scoringGrid && Object.keys(scoringGrid).length > 0 
                ? `${Object.keys(scoringGrid).length} corps`
                : 'No data'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringGridAdmin;