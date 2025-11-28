// src/components/Execution/EquipmentManager.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, TrendingUp, AlertCircle, Sparkles,
  ChevronRight, Coins, Star
} from 'lucide-react';
import Portal from '../Portal';

const EquipmentManager = ({
  equipment,
  onRepair,
  onUpgrade,
  processing,
  corpsCoin
}) => {
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  const equipmentTypes = [
    {
      id: 'uniforms',
      name: 'Uniforms',
      icon: '👔',
      description: 'Corps member uniforms and shoes',
      repairCost: 100,
      upgradeCost: 500
    },
    {
      id: 'instruments',
      name: 'Instruments',
      icon: '🎺',
      description: 'Brass and woodwind instruments',
      repairCost: 150,
      upgradeCost: 750
    },
    {
      id: 'props',
      name: 'Props & Equipment',
      icon: '🎨',
      description: 'Stage props and visual equipment',
      repairCost: 120,
      upgradeCost: 600
    }
  ];

  // Helper to extract equipment data from either flat number or object format
  const getEquipmentData = (equipmentValue, maxValue) => {
    if (typeof equipmentValue === 'number') {
      // Flat number format from backend - calculate level from max value
      const level = maxValue ? Math.round((maxValue - 1.0) / 0.05) + 1 : 1;
      return { condition: equipmentValue, level: Math.max(1, level) };
    }
    if (typeof equipmentValue === 'object' && equipmentValue !== null) {
      return { condition: equipmentValue.condition || 0.90, level: equipmentValue.level || 1 };
    }
    return { condition: 0.90, level: 1 };
  };

  const getConditionColor = (condition) => {
    if (condition >= 0.85) return 'text-green-500';
    if (condition >= 0.70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConditionBg = (condition) => {
    if (condition >= 0.85) return 'bg-green-500/20 border-green-500/30';
    if (condition >= 0.70) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getConditionLabel = (condition) => {
    if (condition >= 0.95) return 'Excellent';
    if (condition >= 0.85) return 'Good';
    if (condition >= 0.70) return 'Fair';
    if (condition >= 0.50) return 'Poor';
    return 'Critical';
  };

  const handleRepair = async (equipmentType) => {
    const result = await onRepair(equipmentType);
    if (result.success) {
      setSelectedEquipment(null);
    }
  };

  const handleUpgrade = async (equipmentType) => {
    const result = await onUpgrade(equipmentType);
    if (result.success) {
      setSelectedEquipment(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Equipment Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-display font-bold text-cream-100 mb-1">
              Equipment Management
            </h3>
            <p className="text-sm text-cream-500/60">
              Maintain and upgrade your corps equipment
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gold-500/20 rounded-lg">
            <Coins className="w-5 h-5 text-gold-500" />
            <span className="font-bold text-gold-500">
              {corpsCoin || 0} CC
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {equipmentTypes.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-hover cursor-pointer border-2 ${getConditionBg(condition)}`}
                onClick={() => setSelectedEquipment(type.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{type.icon}</div>
                  <div className="flex items-center gap-1 text-gold-500">
                    {Array.from({ length: level }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                </div>

                <h4 className="font-semibold text-cream-100 mb-1">
                  {type.name}
                </h4>
                <p className="text-xs text-cream-500/60 mb-3">
                  {type.description}
                </p>

                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream-500/60">Condition</span>
                    <span className={`text-sm font-semibold ${getConditionColor(condition)}`}>
                      {getConditionLabel(condition)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        condition >= 0.85 ? 'bg-green-500' :
                        condition >= 0.70 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${condition * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-cream-500/60">Level {level}</span>
                  <ChevronRight className="w-4 h-4 text-cream-500/40" />
                </div>

                {condition < 0.70 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-yellow-500">
                    <AlertCircle className="w-3 h-3" />
                    Needs attention
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Equipment Detail Modal */}
      <AnimatePresence>
        {selectedEquipment && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedEquipment(null)}
            >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-dark rounded-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const type = equipmentTypes.find(t => t.id === selectedEquipment);
                const maxValue = equipment?.[`${selectedEquipment}Max`];
                const { condition, level } = getEquipmentData(equipment?.[selectedEquipment], maxValue);

                return (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-6xl mb-4">{type.icon}</div>
                      <h3 className="text-2xl font-bold text-gradient mb-2">
                        {type.name}
                      </h3>
                      <p className="text-cream-500/60">
                        {type.description}
                      </p>
                    </div>

                    {/* Current Status */}
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-cream-500/60">Current Status</span>
                        <span className={`text-lg font-bold ${getConditionColor(condition)}`}>
                          {getConditionLabel(condition)}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-charcoal-800 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full ${
                            condition >= 0.85 ? 'bg-green-500' :
                            condition >= 0.70 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${condition * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-cream-500/60">Level</span>
                        <div className="flex items-center gap-1 text-gold-500">
                          {Array.from({ length: level }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current" />
                          ))}
                          <span className="ml-2 font-semibold">{level}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                      {/* Repair */}
                      <button
                        onClick={() => handleRepair(selectedEquipment)}
                        disabled={processing || condition >= 0.95}
                        className="w-full btn-outline py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wrench className="w-5 h-5 mr-2" />
                        <span>Repair to 100%</span>
                        <span className="ml-auto flex items-center gap-1 text-gold-500">
                          <Coins className="w-4 h-4" />
                          {type.repairCost} CC
                        </span>
                      </button>

                      {/* Upgrade */}
                      <button
                        onClick={() => handleUpgrade(selectedEquipment)}
                        disabled={processing || level >= 5}
                        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <TrendingUp className="w-5 h-5 mr-2" />
                        <span>Upgrade to Level {level + 1}</span>
                        <span className="ml-auto flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {type.upgradeCost} CC
                        </span>
                      </button>

                      {level >= 5 && (
                        <div className="card-premium p-3 text-center">
                          <div className="flex items-center justify-center gap-2 text-gold-500">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-semibold">Max Level Reached!</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="card p-4">
                      <p className="text-xs text-cream-500/80 leading-relaxed">
                        Equipment degrades over time and affects your execution multiplier.
                        Keep it in good condition for optimal performance!
                      </p>
                    </div>

                    {/* Close */}
                    <button
                      onClick={() => setSelectedEquipment(null)}
                      className="btn-ghost w-full"
                    >
                      Close
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EquipmentManager;
