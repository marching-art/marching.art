// RetireCorpsModal - Confirmation modal for retiring a corps with staff handling
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Archive } from 'lucide-react';
import Portal from '../Portal';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class'
};

const RetireCorpsModal = ({
  onClose,
  onConfirm,
  corpsName,
  corpsClass,
  retiring,
  assignedStaff = [],
  otherCorps = {},
  inLeague = false
}) => {
  const [staffActions, setStaffActions] = useState({});
  const [showStaffStep, setShowStaffStep] = useState(false);

  // Initialize staff actions when assigned staff changes
  useEffect(() => {
    if (assignedStaff.length > 0) {
      const initialActions = {};
      assignedStaff.forEach(staff => {
        initialActions[staff.staffId] = 'unassign'; // Default action
      });
      setStaffActions(initialActions);
    }
  }, [assignedStaff]);

  const handleStaffAction = (staffId, action) => {
    setStaffActions(prev => ({ ...prev, [staffId]: action }));
  };

  const handleConfirm = () => {
    if (assignedStaff.length > 0) {
      onConfirm(staffActions);
    } else {
      onConfirm({});
    }
  };

  // Get available corps for reassignment (excluding current corps)
  const availableCorps = Object.entries(otherCorps)
    .filter(([classId]) => classId !== corpsClass)
    .map(([classId, data]) => ({
      classId,
      name: data.corpsName || data.name || CLASS_NAMES[classId]
    }));

  const allStaffHandled = assignedStaff.length === 0 ||
    assignedStaff.every(s => staffActions[s.staffId]);

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8 border-2 border-orange-500/30">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Archive className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                {showStaffStep ? 'Transfer Staff' : 'Retire Corps?'}
              </h2>
              <p className="text-cream-300">
                {showStaffStep
                  ? 'Choose what happens to your staff'
                  : 'Honor the legacy of your corps'}
              </p>
            </div>

            {!showStaffStep ? (
              <>
                <div className="glass-premium rounded-xl p-4 mb-6">
                  <p className="text-sm text-cream-500/60 mb-1">You are about to retire:</p>
                  <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
                  <p className="text-sm text-cream-500/60 mt-1">{CLASS_NAMES[corpsClass] || corpsClass}</p>
                </div>

                {assignedStaff.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-300 font-semibold mb-2">
                      \u26A0\uFE0F {assignedStaff.length} staff member{assignedStaff.length > 1 ? 's' : ''} assigned
                    </p>
                    <p className="text-sm text-yellow-300/80">
                      You'll need to decide what to do with your staff before retiring.
                    </p>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-300">
                    Your corps will be moved to the Retired Corps Gallery:
                  </p>
                  <ul className="text-sm text-blue-300/80 mt-2 space-y-1 ml-4">
                    <li>• All season history preserved</li>
                    <li>• Lifetime stats maintained</li>
                    <li>• Can be brought out of retirement anytime</li>
                    <li>• Current season data will be reset</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={onClose}
                    disabled={retiring}
                    className="btn-outline flex-1 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => assignedStaff.length > 0 ? setShowStaffStep(true) : handleConfirm()}
                    disabled={retiring}
                    className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {assignedStaff.length > 0 ? 'Continue' : retiring ? (
                      <>
                        <Archive className="w-4 h-4 animate-pulse" />
                        Retiring...
                      </>
                    ) : 'Retire Corps'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto custom-scrollbar">
                  {assignedStaff.map((staff) => (
                    <div key={staff.staffId} className="glass-premium rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-cream-100">{staff.name}</p>
                          <p className="text-xs text-cream-500">{staff.caption} • Value: {staff.currentValue}</p>
                        </div>
                      </div>
                      <select
                        value={staffActions[staff.staffId] || 'unassign'}
                        onChange={(e) => handleStaffAction(staff.staffId, e.target.value)}
                        className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 text-sm focus:outline-none focus:border-gold-500"
                      >
                        <option value="unassign">Keep Unassigned</option>
                        {availableCorps.map(corps => (
                          <option key={corps.classId} value={`reassign:${corps.classId}`}>
                            Transfer to {corps.name}
                          </option>
                        ))}
                        {inLeague && (
                          <option value="tradePool">Add to League Trade Pool</option>
                        )}
                        <option value="auction">List for Auction</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowStaffStep(false)}
                    disabled={retiring}
                    className="btn-outline flex-1 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={retiring || !allStaffHandled}
                    className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {retiring ? (
                      <>
                        <Archive className="w-4 h-4 animate-pulse" />
                        Retiring...
                      </>
                    ) : 'Retire Corps'}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default RetireCorpsModal;
