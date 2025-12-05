// src/components/Execution/EquipmentManager.jsx
// Updated with Bus/Truck (Travel Health) and Caption Mapping
// Refactored to Inventory List style
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, TrendingUp, AlertCircle, Sparkles,
  Coins, Star, Bus, Truck, X, Info
} from 'lucide-react';
import Portal from '../Portal';
import InfoTooltip from '../InfoTooltip';

const EquipmentManager = ({
  equipment,
  onRepair,
  onUpgrade,
  processing,
  corpsCoin
}) => {
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  // Performance equipment (affects captions)
  const performanceEquipment = [
    {
      id: 'uniforms',
      name: 'Uniforms',
      icon: '👔',
      description: 'Corps member uniforms and shoes',
      repairCost: 100,
      upgradeCost: 500,
      affectedCaptions: ['VP', 'VA'],
      captionImpact: '±5%'
    },
    {
      id: 'instruments',
      name: 'Instruments',
      icon: '🎺',
      description: 'Brass and woodwind instruments',
      repairCost: 150,
      upgradeCost: 750,
      affectedCaptions: ['B', 'MA', 'P'],
      captionImpact: '±5%'
    },
    {
      id: 'props',
      name: 'Props & Equipment',
      icon: '🎨',
      description: 'Stage props and visual equipment',
      repairCost: 120,
      upgradeCost: 600,
      affectedCaptions: ['CG'],
      captionImpact: '±5%'
    }
  ];

  // Travel equipment (affects overall morale/travel penalty)
  const travelEquipment = [
    {
      id: 'bus',
      name: 'Tour Bus',
      icon: '🚌',
      LucideIcon: Bus,
      description: 'Member transportation between shows',
      repairCost: 200,
      upgradeCost: 2000,
      travelPenalty: true
    },
    {
      id: 'truck',
      name: 'Equipment Truck',
      icon: '🚛',
      LucideIcon: Truck,
      description: 'Hauls instruments and props',
      repairCost: 250,
      upgradeCost: 2500,
      travelPenalty: true
    }
  ];

  // Combined for equipment types lookup
  const equipmentTypes = [...performanceEquipment, ...travelEquipment];

  // Calculate travel health penalty
  const busCondition = equipment?.bus || 0.90;
  const truckCondition = equipment?.truck || 0.90;
  const travelHealth = busCondition + truckCondition;
  const hasTravelPenalty = travelHealth < 1.40;
  const travelPenaltyAmount = hasTravelPenalty ? -0.03 : 0;

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
      {/* Wallet Display Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-gold-400" />
          <span className="text-lg font-mono font-bold text-gold-400">
            {corpsCoin || 0}
          </span>
          <span className="data-label-sm">CC</span>
        </div>
      </div>

      {/* Performance Equipment - Inventory List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-slot"
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="section-label mb-0">Performance Equipment</h3>
          <InfoTooltip
            content="Directly affects caption scores (±5% impact per equipment type)"
            title="Equipment Impact"
          />
        </div>

        <div className="space-y-1.5">
          {performanceEquipment.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="h-16 cursor-pointer bg-black/40 border border-white/5 hover:border-gold-500/30 px-3 transition-all group rounded-lg flex items-center gap-3"
                onClick={() => setSelectedEquipment(type.id)}
              >
                {/* Left: Icon Box */}
                <div className="w-10 h-10 flex items-center justify-center bg-white/5 text-xl flex-shrink-0 rounded-lg">
                  {type.icon}
                </div>

                {/* Center: Name + Description */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-mono font-bold text-cream-100 truncate">{type.name}</h4>
                  <p className="data-label-sm truncate">{type.description}</p>
                </div>

                {/* Right: Condition Bar + Level Badge */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Thin Segmented Bar */}
                  <div className="w-16 h-1.5 bg-charcoal-900 overflow-hidden flex gap-px rounded-sm">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${
                          i < Math.round(condition * 10)
                            ? condition >= 0.85 ? 'bg-green-500' :
                              condition >= 0.70 ? 'bg-yellow-500' :
                              'bg-red-500'
                            : 'bg-charcoal-800'
                        }`}
                      />
                    ))}
                  </div>
                  {/* Level Badge */}
                  <div className="flex items-center gap-1 px-2 py-1 bg-gold-500/20 border border-gold-500/30 rounded text-xs font-mono font-bold text-gold-400">
                    <Star className="w-3 h-3 fill-current" />
                    {level}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Travel Equipment - Inventory List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-slot"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="section-label mb-0">Travel Equipment</h3>
            <InfoTooltip
              content="Affects overall travel health. Combined condition must be 70%+ to avoid -3% penalty."
              title="Travel Health"
            />
          </div>
          {/* Travel Health Status Badge */}
          <div className={`flex items-center gap-1.5 px-2 py-1 border rounded text-xs font-mono font-bold ${
            hasTravelPenalty
              ? 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'bg-green-500/20 border-green-500/40 text-green-400'
          }`}>
            {hasTravelPenalty ? (
              <AlertCircle className="w-3 h-3" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {hasTravelPenalty ? '-3%' : 'OK'}
          </div>
        </div>

        <div className="space-y-1.5">
          {travelEquipment.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);
            const LIcon = type.LucideIcon;

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.03 }}
                className="h-16 cursor-pointer bg-black/40 border border-white/5 hover:border-gold-500/30 px-3 transition-all group rounded-lg flex items-center gap-3"
                onClick={() => setSelectedEquipment(type.id)}
              >
                {/* Left: Icon Box */}
                <div className="w-10 h-10 flex items-center justify-center bg-white/5 flex-shrink-0 rounded-lg">
                  <LIcon className={`w-5 h-5 ${getConditionColor(condition)}`} />
                </div>

                {/* Center: Name + Description */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-mono font-bold text-cream-100 truncate">{type.name}</h4>
                  <p className="data-label-sm truncate">{type.description}</p>
                </div>

                {/* Right: Condition Bar + Level Badge */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Thin Segmented Bar */}
                  <div className="w-16 h-1.5 bg-charcoal-900 overflow-hidden flex gap-px rounded-sm">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${
                          i < Math.round(condition * 10)
                            ? condition >= 0.85 ? 'bg-green-500' :
                              condition >= 0.70 ? 'bg-yellow-500' :
                              'bg-red-500'
                            : 'bg-charcoal-800'
                        }`}
                      />
                    ))}
                  </div>
                  {/* Level Badge */}
                  <div className="flex items-center gap-1 px-2 py-1 bg-gold-500/20 border border-gold-500/30 rounded text-xs font-mono font-bold text-gold-400">
                    <Star className="w-3 h-3 fill-current" />
                    {level}
                  </div>
                </div>
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
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedEquipment(null)}
            >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal-900/95 backdrop-blur-xl border border-white/10 max-w-md w-full shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-lg overflow-hidden tactical-grid"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const type = equipmentTypes.find(t => t.id === selectedEquipment);
                const maxValue = equipment?.[`${selectedEquipment}Max`];
                const { condition, level } = getEquipmentData(equipment?.[selectedEquipment], maxValue);

                return (
                  <>
                    {/* Modal Header */}
                    <div className="panel-header">
                      <h3 className="panel-title">{type.name}</h3>
                      <button onClick={() => setSelectedEquipment(null)} className="panel-close">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4 relative z-10">
                      {/* Equipment Icon */}
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto bg-black/40 border border-white/10 flex items-center justify-center text-4xl mb-3 rounded-lg">
                          {type.icon}
                        </div>
                        <p className="data-label-sm">{type.description}</p>
                      </div>

                      {/* Current Status */}
                      <div className="glass-slot">
                        <div className="flex items-center justify-between mb-3">
                          <span className="data-label-sm">Condition</span>
                          <span className={`text-sm font-mono font-bold ${getConditionColor(condition)}`}>
                            {Math.round(condition * 100)}%
                          </span>
                        </div>
                        {/* Segmented Progress Bar */}
                        <div className="h-3 bg-charcoal-900 overflow-hidden flex gap-0.5 mb-3 rounded-sm">
                          {[...Array(10)].map((_, i) => (
                            <div
                              key={i}
                              className={`flex-1 transition-all duration-300 ${
                                i < Math.round(condition * 10)
                                  ? condition >= 0.85 ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' :
                                    condition >= 0.70 ? 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]' :
                                    'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                                  : 'bg-charcoal-800'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="data-label-sm">Level</span>
                          <div className="flex items-center gap-1 text-gold-400">
                            {Array.from({ length: level }).map((_, i) => (
                              <Star key={i} className="w-4 h-4 fill-current" />
                            ))}
                            <span className="ml-2 text-sm font-mono font-bold text-cream-100">{level}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        {/* Repair */}
                        <button
                          onClick={() => handleRepair(selectedEquipment)}
                          disabled={processing || condition >= 0.95}
                          className="w-full flex items-center gap-3 p-3 bg-black/40 border border-white/5 hover:border-green-500/50 hover:bg-green-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                        >
                          <Wrench className="w-5 h-5 text-green-400" />
                          <span className="flex-1 text-left text-sm font-mono font-bold text-cream-100">Repair to 100%</span>
                          <span className="flex items-center gap-1 text-sm font-mono font-bold text-gold-400">
                            <Coins className="w-4 h-4" />
                            {type.repairCost}
                          </span>
                        </button>

                        {/* Upgrade */}
                        <button
                          onClick={() => handleUpgrade(selectedEquipment)}
                          disabled={processing || level >= 5}
                          className="w-full flex items-center gap-3 p-3 bg-gold-500/20 border border-gold-500/40 hover:border-gold-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                        >
                          <TrendingUp className="w-5 h-5 text-gold-400" />
                          <span className="flex-1 text-left text-sm font-mono font-bold text-gold-300">Upgrade to LVL {level + 1}</span>
                          <span className="flex items-center gap-1 text-sm font-mono font-bold text-gold-400">
                            <Coins className="w-4 h-4" />
                            {type.upgradeCost}
                          </span>
                        </button>

                        {level >= 5 && (
                          <div className="p-3 bg-gold-500/20 border border-gold-500/40 text-center rounded-lg">
                            <div className="flex items-center justify-center gap-2 text-gold-400">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-sm font-display font-bold uppercase">Max Level Reached</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="glass-slot border-blue-500/20">
                        <p className="text-xs text-cream-100/60 leading-relaxed">
                          Equipment degrades over time and affects your execution multiplier.
                          Keep it in good condition for optimal performance!
                        </p>
                      </div>

                      {/* Close */}
                      <button
                        onClick={() => setSelectedEquipment(null)}
                        className="w-full p-3 bg-black/40 border border-white/5 hover:border-white/20 text-cream-100/50 hover:text-cream-100 font-display font-bold uppercase text-sm transition-all rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                  </>
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
