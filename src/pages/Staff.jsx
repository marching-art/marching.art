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
      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'marketplace'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">Staff </span>Marketplace
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'roster'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Users className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">My </span>Roster
        </button>
        <button
          onClick={() => setActiveTab('auctions')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg transition-all font-semibold text-sm md:text-base ${
            activeTab === 'auctions'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Gavel className="w-4 h-4 md:w-5 md:h-5" />
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
