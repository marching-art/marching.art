// src/pages/Staff.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Users } from 'lucide-react';
import { StaffMarketplace, StaffRoster } from '../components/Staff';

const Staff = () => {
  const [activeTab, setActiveTab] = useState('marketplace');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold ${
            activeTab === 'marketplace'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          Staff Marketplace
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold ${
            activeTab === 'roster'
              ? 'bg-gold-500 text-charcoal-900'
              : 'glass text-cream-300 hover:text-cream-100'
          }`}
        >
          <Users className="w-5 h-5" />
          My Roster
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
        {activeTab === 'roster' && <StaffRoster />}
      </motion.div>
    </div>
  );
};

export default Staff;
