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
        className="bg-white/5 border border-white/10 rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-display font-bold text-gold-400 mb-1 uppercase tracking-wider">
              Performance Equipment
            </h3>
            <p className="text-xs text-cream-muted">
              Directly affects caption scores (±5% impact)
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-gold-500/30 rounded">
            <Coins className="w-4 h-4 text-gold-400" />
            <span className="font-mono font-bold text-gold-400">
              {corpsCoin || 0}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {performanceEquipment.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="cursor-pointer bg-black/40 border-2 border-white/10 hover:border-gold-500/30 p-3 transition-all group"
                style={{ borderRadius: '4px' }}
                onClick={() => setSelectedEquipment(type.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center bg-charcoal-900 border border-white/20 text-2xl flex-shrink-0" style={{ borderRadius: '4px' }}>
                    {type.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-display font-bold text-cream-100 text-sm uppercase tracking-wide">{type.name}</h4>
                      <div className="flex items-center gap-1 text-gold-400">
                        {Array.from({ length: level }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-cream-muted mb-1.5">{type.description}</p>
                    <div className="flex items-center gap-2">
                      {/* Segmented Progress Bar */}
                      <div className="flex-1 h-2 bg-charcoal-900 overflow-hidden flex gap-0.5" style={{ borderRadius: '2px' }}>
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
                      <div className="flex gap-1">
                        {type.affectedCaptions.map(cap => (
                          <span key={cap} className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-[8px] font-mono text-blue-400" style={{ borderRadius: '2px' }}>
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-mono font-bold ${getConditionColor(condition)}`}>
                      {Math.round(condition * 100)}%
                    </span>
                    <span className="text-[10px] font-mono text-gold-400">LVL {level}</span>
                  </div>
                </div>
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
        className="bg-white/5 border border-white/10 rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-display font-bold text-gold-400 mb-1 uppercase tracking-wider">
              Travel Equipment
            </h3>
            <p className="text-xs text-cream-muted">
              Affects overall travel health (combined 70%+ = no penalty)
            </p>
          </div>
          {/* Travel Health Status */}
          <div className={`px-3 py-2 border ${hasTravelPenalty ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`} style={{ borderRadius: '4px' }}>
            <div className="flex items-center gap-2">
              {hasTravelPenalty ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-green-400" />
              )}
              <div>
                <div className={`text-sm font-mono font-bold ${hasTravelPenalty ? 'text-red-400' : 'text-green-400'}`}>
                  {hasTravelPenalty ? '-3%' : 'OK'}
                </div>
                <div className="text-[9px] font-mono text-cream-muted">
                  {Math.round(travelHealth * 50)}%/70%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {travelEquipment.map((type, index) => {
            const maxValue = equipment?.[`${type.id}Max`];
            const { condition, level } = getEquipmentData(equipment?.[type.id], maxValue);
            const LIcon = type.LucideIcon;

            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="cursor-pointer bg-black/40 border-2 border-white/10 hover:border-gold-500/30 p-3 transition-all group"
                style={{ borderRadius: '4px' }}
                onClick={() => setSelectedEquipment(type.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center bg-charcoal-900 border border-white/20 flex-shrink-0" style={{ borderRadius: '4px' }}>
                    <LIcon className={`w-6 h-6 ${getConditionColor(condition)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-display font-bold text-cream-100 text-sm uppercase tracking-wide">{type.name}</h4>
                      <div className="flex items-center gap-1 text-gold-400">
                        {Array.from({ length: level }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-cream-muted mb-1.5">{type.description}</p>
                    {/* Segmented Progress Bar */}
                    <div className="h-2 bg-charcoal-900 overflow-hidden flex gap-0.5" style={{ borderRadius: '2px' }}>
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
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-mono font-bold ${getConditionColor(condition)}`}>
                      {Math.round(condition * 100)}%
                    </span>
                    <span className="text-[10px] font-mono text-gold-400">LVL {level}</span>
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
              className="bg-charcoal-950/95 backdrop-blur-xl border border-white/10 p-6 max-w-md w-full shadow-[0_0_40px_rgba(0,0,0,0.8)]"
              style={{
                borderRadius: '8px',
                backgroundImage: `
                  linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const type = equipmentTypes.find(t => t.id === selectedEquipment);
                const maxValue = equipment?.[`${selectedEquipment}Max`];
                const { condition, level } = getEquipmentData(equipment?.[selectedEquipment], maxValue);

                return (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto bg-charcoal-900 border-2 border-white/20 flex items-center justify-center text-5xl mb-4" style={{ borderRadius: '8px' }}>
                        {type.icon}
                      </div>
                      <h3 className="text-xl font-display font-black text-gold-400 uppercase tracking-tight mb-1">
                        {type.name}
                      </h3>
                      <p className="text-xs text-cream-muted">
                        {type.description}
                      </p>
                    </div>

                    {/* Current Status */}
                    <div className="bg-black/40 border border-white/10 p-4" style={{ borderRadius: '4px' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-display font-bold text-cream-muted uppercase">Condition</span>
                        <span className={`text-lg font-mono font-bold ${getConditionColor(condition)}`}>
                          {Math.round(condition * 100)}%
                        </span>
                      </div>
                      {/* Segmented Progress Bar */}
                      <div className="h-3 bg-charcoal-900 overflow-hidden flex gap-0.5 mb-3" style={{ borderRadius: '2px' }}>
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
                        <span className="text-xs font-display font-bold text-cream-muted uppercase">Level</span>
                        <div className="flex items-center gap-1 text-gold-400">
                          {Array.from({ length: level }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current" />
                          ))}
                          <span className="ml-2 font-mono font-bold">{level}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      {/* Repair */}
                      <button
                        onClick={() => handleRepair(selectedEquipment)}
                        disabled={processing || condition >= 0.95}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 border border-white/10 hover:border-green-500/50 hover:bg-green-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderRadius: '4px' }}
                      >
                        <Wrench className="w-5 h-5 text-green-400" />
                        <span className="flex-1 text-left font-display font-bold text-cream-100 uppercase text-sm">Repair to 100%</span>
                        <span className="flex items-center gap-1 font-mono font-bold text-gold-400">
                          <Coins className="w-4 h-4" />
                          {type.repairCost}
                        </span>
                      </button>

                      {/* Upgrade */}
                      <button
                        onClick={() => handleUpgrade(selectedEquipment)}
                        disabled={processing || level >= 5}
                        className="w-full flex items-center gap-3 p-3 bg-gold-500/20 border border-gold-500/40 hover:border-gold-400 hover:bg-gold-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderRadius: '4px' }}
                      >
                        <TrendingUp className="w-5 h-5 text-gold-400" />
                        <span className="flex-1 text-left font-display font-bold text-gold-300 uppercase text-sm">Upgrade to LVL {level + 1}</span>
                        <span className="flex items-center gap-1 font-mono font-bold text-gold-400">
                          <Coins className="w-4 h-4" />
                          {type.upgradeCost}
                        </span>
                      </button>

                      {level >= 5 && (
                        <div className="p-3 bg-gold-500/20 border border-gold-500/40 text-center" style={{ borderRadius: '4px' }}>
                          <div className="flex items-center justify-center gap-2 text-gold-400">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-display font-bold uppercase">Max Level Reached</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30" style={{ borderRadius: '4px' }}>
                      <p className="text-[11px] text-blue-300 leading-relaxed">
                        Equipment degrades over time and affects your execution multiplier.
                        Keep it in good condition for optimal performance!
                      </p>
                    </div>

                    {/* Close */}
                    <button
                      onClick={() => setSelectedEquipment(null)}
                      className="w-full p-3 bg-white/5 border border-white/10 hover:border-white/30 text-cream-muted hover:text-cream-100 font-display font-bold uppercase text-sm transition-all"
                      style={{ borderRadius: '4px' }}
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
