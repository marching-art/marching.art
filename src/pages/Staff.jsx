// src/pages/Staff.jsx
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

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Dark Toolbar Style */}
      <div className="bg-[#1A1A1A] rounded-xl p-1.5 border border-[#2A2A2A] flex gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 rounded-lg transition-all font-display font-medium text-sm ${
            activeTab === 'marketplace'
              ? 'bg-gold-500 text-[#0D0D0D]'
              : 'text-[#FAF6EA]/60 hover:text-[#FAF6EA] hover:bg-[#2A2A2A]'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">Staff </span>Market
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 rounded-lg transition-all font-display font-medium text-sm ${
            activeTab === 'roster'
              ? 'bg-gold-500 text-[#0D0D0D]'
              : 'text-[#FAF6EA]/60 hover:text-[#FAF6EA] hover:bg-[#2A2A2A]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">My </span>Roster
        </button>
        <button
          onClick={() => setActiveTab('auctions')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 rounded-lg transition-all font-display font-medium text-sm ${
            activeTab === 'auctions'
              ? 'bg-gold-500 text-[#0D0D0D]'
              : 'text-[#FAF6EA]/60 hover:text-[#FAF6EA] hover:bg-[#2A2A2A]'
          }`}
        >
          <Gavel className="w-4 h-4" />
          Auctions
        </button>
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
