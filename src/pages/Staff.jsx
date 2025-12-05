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
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ================================================================
          TOP BAR: Tab Navigation (Fixed Height)
          ================================================================ */}
      <div className="shrink-0 border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div className="flex gap-1 p-1.5 overflow-x-auto hud-scroll">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded transition-all font-display font-semibold text-xs uppercase tracking-wide ${
                  isActive
                    ? 'text-gold-400 bg-gold-500/10'
                    : 'text-cream/50 hover:text-cream hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-gold-400' : ''}`} />
                <span className="hidden sm:inline">{tab.fullLabel}</span>
                <span className="sm:hidden">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="staffTab"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-gold-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================
          WORK SURFACE: Tab Content (h-full, internal scroll)
          ================================================================ */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {activeTab === 'marketplace' && <StaffMarketplace />}
          {activeTab === 'roster' && <StaffRoster userCorps={corps || {}} />}
          {activeTab === 'auctions' && <StaffAuctions />}
        </motion.div>
      </div>
    </div>
  );
};

export default Staff;
