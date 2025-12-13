// RetireCorpsModal - Confirmation modal for retiring a corps
import React from 'react';
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
  inLeague = false
}) => {
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
                Retire Corps?
              </h2>
              <p className="text-cream-300">
                Honor the legacy of your corps
              </p>
            </div>

            <div className="glass-premium rounded-xl p-4 mb-6">
              <p className="text-sm text-cream-500/60 mb-1">You are about to retire:</p>
              <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
              <p className="text-sm text-cream-500/60 mt-1">{CLASS_NAMES[corpsClass] || corpsClass}</p>
            </div>

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
                onClick={onConfirm}
                disabled={retiring}
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
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default RetireCorpsModal;
