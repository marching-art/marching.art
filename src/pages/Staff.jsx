// src/pages/Staff.jsx
// Stadium HUD Style - Staff Market Page
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Users, Gavel } from 'lucide-react';
import { StaffMarketplace, StaffRoster, StaffAuctions } from '../components/Staff';
import { useUserStore } from '../store/userStore';
import { useAuth } from '../App';
import { useDashboardData } from '../hooks/useDashboardData';

const Staff = () => {
  const [activeTab, setActiveTab] = useState('marketplace');
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();
  const { corps } = useDashboardData();

  // Complete the daily challenge for visiting staff market
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('staff_meeting');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  const tabs = [
    { id: 'marketplace', label: 'Market', fullLabel: 'Staff Market', icon: ShoppingCart },
    { id: 'roster', label: 'Roster', fullLabel: 'My Roster', icon: Users },
    { id: 'auctions', label: 'Auctions', fullLabel: 'Auctions', icon: Gavel },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Stadium HUD Glass Style */}
      <div className="glass-panel p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 rounded-lg transition-all font-display font-semibold text-sm uppercase tracking-wide ${
                isActive
                  ? 'text-yellow-400'
                  : 'text-yellow-50/60 hover:text-yellow-50 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'icon-neon-gold' : ''}`} />
              <span className="hidden sm:inline">{tab.fullLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="staffTab"
                  className="absolute -bottom-1 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-yellow-500/80 via-yellow-400 to-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.6)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'marketplace' && <StaffMarketplace />}
        {activeTab === 'roster' && <StaffRoster userCorps={corps || {}} />}
        {activeTab === 'auctions' && <StaffAuctions />}
      </motion.div>
    </div>
  );
};

export default Staff;
