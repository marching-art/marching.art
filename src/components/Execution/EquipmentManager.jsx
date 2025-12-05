// src/components/Execution/EquipmentManager.jsx
// Updated with Bus/Truck (Travel Health) and Caption Mapping
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, TrendingUp, AlertCircle, Sparkles,
  ChevronRight, Coins, Star, Bus, Truck, Info, Music, Target, Zap
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
  const [showCaptionMap, setShowCaptionMap] = useState(false);

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
      {/* Caption Impact Map - Collapsible */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-dark rounded-xl overflow-hidden"
      >
        <button
          onClick={() => setShowCaptionMap(!showCaptionMap)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-display font-bold text-cream uppercase">
              Equipment → Caption Impact
            </span>
          </div>
          <ChevronRight className={`w-4 h-4 text-cream-muted transition-transform ${showCaptionMap ? 'rotate-90' : ''}`} />
        </button>
        <AnimatePresence>
          {showCaptionMap && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2">
                {performanceEquipment.map(eq => {
                  const { condition } = getEquipmentData(equipment?.[eq.id], equipment?.[`${eq.id}Max`]);
                  return (
                    <div key={eq.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{eq.icon}</span>
                        <span className="text-xs text-cream">{eq.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {eq.affectedCaptions.map(cap => (
                            <span key={cap} className="px-1.5 py-0.5 rounded bg-charcoal-700 text-[9px] font-mono text-cream-muted">
                              {cap}
                            </span>
                          ))}
                        </div>
                        <span className={`font-mono text-xs font-bold ${getConditionColor(condition)}`}>
                          {Math.round(condition * 100)}%
                        </span>
                        <span className="text-[9px] text-cream-muted">{eq.captionImpact}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Performance Equipment Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-display font-bold text-cream-100 mb-1 uppercase tracking-wider">
              Performance Equipment
            </h3>
            <p className="text-sm text-cream-500/60">
              Directly affects caption scores (±5% impact)
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
          {performanceEquipment.map((type, index) => {
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
                <p className="text-xs text-cream-500/60 mb-2">
                  {type.description}
                </p>

                {/* Affected captions */}
                <div className="flex gap-1 mb-3">
                  {type.affectedCaptions.map(cap => (
                    <span key={cap} className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[9px] font-mono text-blue-400 border border-blue-500/30">
                      {cap}
                    </span>
                  ))}
                </div>

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

      {/* Travel Equipment Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-display font-bold text-cream-100 mb-1 uppercase tracking-wider">
              Travel Equipment
            </h3>
            <p className="text-sm text-cream-500/60">
              Affects overall travel health (combined 70%+ = no penalty)
            </p>
          </div>
          {/* Travel Health Status */}
          <div className={`px-3 py-2 rounded-lg border ${hasTravelPenalty ? 'bg-red-500/20 border-red-500/30' : 'bg-green-500/20 border-green-500/30'}`}>
            <div className="flex items-center gap-2">
              {hasTravelPenalty ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-green-400" />
              )}
              <div>
                <div className={`text-sm font-bold ${hasTravelPenalty ? 'text-red-400' : 'text-green-400'}`}>
                  {hasTravelPenalty ? '-3% Penalty' : 'No Penalty'}
                </div>
                <div className="text-[9px] text-cream-muted">
                  {Math.round(travelHealth * 50)}% / 70% threshold
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {travelEquipment.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);
            const LIcon = type.LucideIcon;

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`card-hover cursor-pointer border-2 ${getConditionBg(condition)}`}
                onClick={() => setSelectedEquipment(type.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-charcoal-700">
                    <LIcon className={`w-8 h-8 ${getConditionColor(condition)}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-cream-100">{type.name}</h4>
                      <div className="flex items-center gap-1 text-gold-500">
                        {Array.from({ length: level }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-cream-500/60 mb-2">{type.description}</p>
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
                  <div className="text-right">
                    <div className={`text-lg font-mono font-bold ${getConditionColor(condition)}`}>
                      {Math.round(condition * 100)}%
                    </div>
                    <ChevronRight className="w-4 h-4 text-cream-500/40 ml-auto" />
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
