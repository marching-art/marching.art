// src/components/Execution/StaffRoster.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Star, TrendingUp, Sparkles, Plus,
  Coins, Music, Target, Heart, ChevronRight
} from 'lucide-react';
import Portal from '../Portal';

const StaffRoster = ({ staff, onHireStaff, onAssignStaff, processing, corpsCoin }) => {
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Available staff types and their effects
  const staffTypes = [
    {
      id: 'brass_instructor',
      name: 'Brass Instructor',
      icon: Music,
      specialty: 'Brass',
      cost: 1000,
      effect: '+2% Brass performance',
      rarity: 'common',
      description: 'Experienced brass instructor to improve horn line execution'
    },
    {
      id: 'visual_designer',
      name: 'Visual Designer',
      icon: Target,
      specialty: 'Visual',
      cost: 1200,
      effect: '+2% Visual performance',
      rarity: 'common',
      description: 'Creative visual designer for choreography and staging'
    },
    {
      id: 'percussion_tech',
      name: 'Percussion Tech',
      icon: '🥁',
      specialty: 'Percussion',
      cost: 1000,
      effect: '+2% Percussion performance',
      rarity: 'common',
      description: 'Technical expert for battery and pit sections'
    },
    {
      id: 'corps_director',
      name: 'Corps Director',
      icon: Star,
      specialty: 'Overall',
      cost: 2500,
      effect: '+3% All captions',
      rarity: 'rare',
      description: 'Visionary leader who improves all aspects of the corps'
    },
    {
      id: 'morale_specialist',
      name: 'Morale Specialist',
      icon: Heart,
      specialty: 'Morale',
      cost: 1500,
      effect: 'Slower morale decay',
      rarity: 'uncommon',
      description: 'Keeps spirits high and maintains corps morale'
    },
    {
      id: 'legend_instructor',
      name: 'Legend Instructor',
      icon: Sparkles,
      specialty: 'Elite',
      cost: 5000,
      effect: '+5% All captions',
      rarity: 'legendary',
      description: 'Legendary instructor with decades of championship experience'
    }
  ];

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-green-500';
      case 'rare': return 'text-blue-500';
      case 'legendary': return 'text-gold-500';
      default: return 'text-cream-500';
    }
  };

  const getRarityBg = (rarity) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500/20 border-gray-500/30';
      case 'uncommon': return 'bg-green-500/20 border-green-500/30';
      case 'rare': return 'bg-blue-500/20 border-blue-500/30';
      case 'legendary': return 'bg-gold-500/20 border-gold-500/30';
      default: return 'bg-cream-500/20 border-cream-500/30';
    }
  };

  const handleHireStaff = async (staffType) => {
    const result = await onHireStaff(staffType);
    if (result.success) {
      setShowMarketplace(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Staff Roster Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-display font-bold text-cream-100 mb-1">
              Staff Roster
            </h3>
            <p className="text-sm text-cream-500/60">
              {staff?.length || 0} staff members assigned
            </p>
          </div>
          <button
            onClick={() => setShowMarketplace(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Hire Staff
          </button>
        </div>

        {!staff || staff.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
            <p className="text-cream-500/60 mb-4">No staff members yet</p>
            <button
              onClick={() => setShowMarketplace(true)}
              className="btn-outline"
            >
              Browse Staff Marketplace
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff.map((member, index) => {
              const staffInfo = staffTypes.find(s => s.id === member.type);
              if (!staffInfo) return null;

              const Icon = typeof staffInfo.icon === 'string' ? null : staffInfo.icon;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`card-hover border-2 ${getRarityBg(staffInfo.rarity)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {Icon ? (
                        <Icon className={`w-8 h-8 ${getRarityColor(staffInfo.rarity)}`} />
                      ) : (
                        <span className="text-3xl">{staffInfo.icon}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-cream-100">
                            {staffInfo.name}
                          </h4>
                          <p className="text-xs text-cream-500/60">
                            {staffInfo.specialty}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold ${getRarityColor(staffInfo.rarity)}`}>
                          {staffInfo.rarity}
                        </span>
                      </div>
                      <p className="text-sm text-green-500 font-semibold mb-2">
                        {staffInfo.effect}
                      </p>
                      <p className="text-xs text-cream-500/60">
                        {staffInfo.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Staff Benefits */}
        {staff && staff.length > 0 && (
          <div className="mt-6 card-premium p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-semibold text-cream-100">
                Active Staff Bonuses
              </span>
            </div>
            <p className="text-xs text-cream-500/80">
              Your {staff.length} staff member{staff.length > 1 ? 's are' : ' is'} providing execution bonuses to your corps.
              Higher quality staff unlock better performance potential!
            </p>
          </div>
        )}
      </motion.div>

      {/* Staff Marketplace Modal */}
      <AnimatePresence>
        {showMarketplace && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowMarketplace(false)}
            >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-dark rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gradient mb-2">
                    Staff Marketplace
                  </h3>
                  <p className="text-cream-500/60">
                    Hire skilled staff to improve your corps performance
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 rounded-lg">
                  <Coins className="w-5 h-5 text-gold-500" />
                  <span className="font-bold text-gold-500">
                    {corpsCoin || 0} CC
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {staffTypes.map((staffMember, index) => {
                  const Icon = typeof staffMember.icon === 'string' ? null : staffMember.icon;
                  const canAfford = (corpsCoin || 0) >= staffMember.cost;

                  return (
                    <motion.div
                      key={staffMember.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`card border-2 ${getRarityBg(staffMember.rarity)}`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          {Icon ? (
                            <Icon className={`w-10 h-10 ${getRarityColor(staffMember.rarity)}`} />
                          ) : (
                            <span className="text-4xl">{staffMember.icon}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-bold text-cream-100">
                              {staffMember.name}
                            </h4>
                            <span className={`text-xs font-semibold ${getRarityColor(staffMember.rarity)}`}>
                              {staffMember.rarity}
                            </span>
                          </div>
                          <p className="text-xs text-cream-500/60 mb-2">
                            {staffMember.specialty} Specialist
                          </p>
                          <p className="text-sm text-green-500 font-semibold">
                            {staffMember.effect}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-cream-500/80 mb-4">
                        {staffMember.description}
                      </p>

                      <button
                        onClick={() => handleHireStaff(staffMember.id)}
                        disabled={processing || !canAfford}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        <span>Hire</span>
                        <span className="ml-auto flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {staffMember.cost} CC
                        </span>
                      </button>

                      {!canAfford && (
                        <p className="text-xs text-red-500 mt-2 text-center">
                          Insufficient CorpsCoin
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowMarketplace(false)}
                className="btn-ghost w-full"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffRoster;
