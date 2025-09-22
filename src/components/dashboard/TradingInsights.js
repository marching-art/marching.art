// components/dashboard/TradingInsights.js
// Trading analytics and insights widget for the dashboard

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import { DCI_HALL_OF_FAME_STAFF, calculateStaffMultiplier } from '../../data/dciHallOfFameStaff';
import Icon from '../ui/Icon';
import { motion } from 'framer-motion';

const TradingInsights = ({ userCorps = {} }) => {
  const { user, loggedInProfile } = useUserStore();
  const [tradingData, setTradingData] = useState({
    recentTrades: [],
    marketTrends: {},
    staffValues: {},
    recommendations: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('overview');

  useEffect(() => {
    if (user) {
      fetchTradingInsights();
    }
  }, [user]);

  const fetchTradingInsights = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchRecentTrades(),
        fetchStaffMarketData(),
        fetchTradingRecommendations()
      ]);
    } catch (error) {
      console.error('Error fetching trading insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentTrades = async () => {
    try {
      const tradesRef = collection(db, 'staff-trade-history');
      const recentQuery = query(
        tradesRef,
        orderBy('completedAt', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(recentQuery);
      const trades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTradingData(prev => ({ ...prev, recentTrades: trades }));
    } catch (error) {
      console.error('Error fetching recent trades:', error);
    }
  };

  const fetchStaffMarketData = async () => {
    try {
      const staffRef = collection(db, 'staff-database');
      const snapshot = await getDocs(staffRef);
      
      const staffValues = {};
      const marketTrends = {};

      snapshot.docs.forEach(doc => {
        const staff = doc.data();
        staffValues[doc.id] = staff.currentValue || staff.baseValue;
        
        // Calculate market trends by caption
        if (!marketTrends[staff.caption]) {
          marketTrends[staff.caption] = {
            averageValue: 0,
            count: 0,
            trending: 'stable'
          };
        }
        
        marketTrends[staff.caption].averageValue += staff.currentValue || staff.baseValue;
        marketTrends[staff.caption].count++;
      });

      // Calculate averages
      Object.keys(marketTrends).forEach(caption => {
        marketTrends[caption].averageValue = 
          marketTrends[caption].averageValue / marketTrends[caption].count;
      });

      setTradingData(prev => ({ 
        ...prev, 
        staffValues,
        marketTrends 
      }));
    } catch (error) {
      console.error('Error fetching staff market data:', error);
    }
  };

  const fetchTradingRecommendations = async () => {
    // Generate recommendations based on user's current staff and market trends
    const recommendations = generateRecommendations();
    setTradingData(prev => ({ ...prev, recommendations }));
  };

  const generateRecommendations = () => {
    const recommendations = [];
    
    // Analyze user's current staff lineup
    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
      const staffLineup = corps.staffLineup || {};
      
      Object.entries(staffLineup).forEach(([caption, staffId]) => {
        if (staffId) {
          const staff = getStaffById(staffId);
          if (staff) {
            const multiplier = calculateStaffMultiplier(staff);
            const bonusPercent = ((multiplier - 1) * 100);
            
            // Recommend upgrades for underperforming staff
            if (bonusPercent < 5) {
              const betterOptions = DCI_HALL_OF_FAME_STAFF[caption]
                ?.filter(s => s.id !== staffId && s.currentValue > staff.currentValue)
                ?.slice(0, 2);
              
              if (betterOptions?.length > 0) {
                recommendations.push({
                  type: 'upgrade',
                  caption,
                  corpsClass,
                  currentStaff: staff,
                  suggestions: betterOptions,
                  reasoning: `${staff.name} provides only ${bonusPercent.toFixed(1)}% bonus. Consider upgrading.`
                });
              }
            }
            
            // Recommend trades for overvalued staff
            if (bonusPercent > 12) {
              recommendations.push({
                type: 'trade_high',
                caption,
                corpsClass,
                staff,
                reasoning: `${staff.name} is performing exceptionally (+${bonusPercent.toFixed(1)}%). Consider trading while value is high.`
              });
            }
          }
        } else {
          // Recommend staff for empty positions
          const topStaff = DCI_HALL_OF_FAME_STAFF[caption]
            ?.sort((a, b) => (b.currentValue || b.baseValue) - (a.currentValue || a.baseValue))
            ?.slice(0, 3);
          
          if (topStaff?.length > 0) {
            recommendations.push({
              type: 'hire',
              caption,
              corpsClass,
              suggestions: topStaff,
              reasoning: `No staff assigned to ${caption}. Consider hiring a Hall of Fame instructor.`
            });
          }
        }
      });
    });

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  };

  const getStaffById = (staffId) => {
    for (const caption of Object.keys(DCI_HALL_OF_FAME_STAFF)) {
      const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
      if (staff) return { ...staff, caption };
    }
    return null;
  };

  const userTradingStats = useMemo(() => {
    const userTrades = tradingData.recentTrades.filter(trade => 
      trade.fromUserId === user?.uid || trade.targetUserId === user?.uid
    );

    return {
      totalTrades: userTrades.length,
      successRate: userTrades.length > 0 ? 
        (userTrades.filter(t => t.status === 'completed').length / userTrades.length * 100).toFixed(0) : 0,
      avgTradeValue: userTrades.length > 0 ?
        userTrades.reduce((sum, trade) => sum + (trade.value || 0), 0) / userTrades.length : 0,
      lastTrade: userTrades[0]?.completedAt
    };
  }, [tradingData.recentTrades, user]);

  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-accent rounded w-3/4"></div>
          <div className="h-3 bg-accent rounded w-1/2"></div>
          <div className="h-2 bg-accent rounded w-full"></div>
        </div>
      </div>
    );
  }

  const views = [
    { id: 'overview', label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'trends', label: 'Market', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { id: 'recommendations', label: 'Tips', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }
  ];

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
          Trading Insights
        </h3>
        <div className="flex gap-1">
          {views.map(view => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id)}
              className={`p-2 rounded transition-colors ${
                selectedView === view.id
                  ? 'bg-primary text-on-primary'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark'
              }`}
              title={view.label}
            >
              <Icon path={view.icon} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {selectedView === 'overview' && (
        <div className="space-y-4">
          {/* User Trading Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
              <div className="text-lg font-bold text-primary dark:text-primary-dark">
                {userTradingStats.totalTrades}
              </div>
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                Total Trades
              </div>
            </div>
            
            <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
              <div className="text-lg font-bold text-green-500">
                {userTradingStats.successRate}%
              </div>
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                Success Rate
              </div>
            </div>
            
            <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
              <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                {userTradingStats.avgTradeValue.toFixed(0)}
              </div>
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                Avg Value
              </div>
            </div>
            
            <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
              <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                {tradingData.recentTrades.length}
              </div>
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                Recent
              </div>
            </div>
          </div>

          {/* Quick Recommendation */}
          {tradingData.recommendations.length > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-theme">
              <div className="flex items-start gap-2">
                <Icon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                      className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-text-primary dark:text-text-primary-dark text-sm">
                    Trading Tip
                  </div>
                  <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    {tradingData.recommendations[0].reasoning}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedView === 'trends' && (
        <div className="space-y-4">
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
            Staff Market by Caption
          </h4>
          <div className="space-y-2">
            {Object.entries(tradingData.marketTrends).map(([caption, trend]) => (
              <div key={caption} className="flex justify-between items-center p-2 bg-background dark:bg-background-dark rounded">
                <span className="font-medium text-text-primary dark:text-text-primary-dark">
                  {caption}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary dark:text-text-primary-dark">
                    {trend.averageValue.toFixed(0)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    trend.trending === 'up' ? 'bg-green-500/20 text-green-600' :
                    trend.trending === 'down' ? 'bg-red-500/20 text-red-600' :
                    'bg-gray-500/20 text-gray-600'
                  }`}>
                    {trend.trending}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'recommendations' && (
        <div className="space-y-3">
          {tradingData.recommendations.length === 0 ? (
            <div className="text-center py-4 text-text-secondary dark:text-text-secondary-dark">
              <Icon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Your staff lineup is optimized!</p>
            </div>
          ) : (
            tradingData.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
              >
                <div className="flex items-start gap-3">
                  <Icon path={
                    rec.type === 'upgrade' ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' :
                    rec.type === 'hire' ? 'M12 6v6m0 0v6m0-6h6m-6 0H6' :
                    'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
                  } className={`w-4 h-4 mt-0.5 ${
                    rec.type === 'upgrade' ? 'text-blue-500' :
                    rec.type === 'hire' ? 'text-green-500' :
                    'text-orange-500'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-text-primary dark:text-text-primary-dark text-sm">
                      {rec.type === 'upgrade' ? 'Upgrade Opportunity' :
                       rec.type === 'hire' ? 'Hiring Suggestion' :
                       'Trading Opportunity'}
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      {rec.caption} • {rec.corpsClass}
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                      {rec.reasoning}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
        <button className="w-full bg-primary text-on-primary py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors text-sm">
          Open Staff Trading Center
        </button>
      </div>
    </div>
  );
};

export default TradingInsights;