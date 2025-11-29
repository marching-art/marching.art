// DeleteCorpsModal - Confirmation modal for deleting a corps
import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import Portal from '../Portal';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class'
};

const DeleteCorpsModal = ({ onClose, onConfirm, corpsName, corpsClass }) => {
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
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8 border-2 border-red-500/30">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                Delete Corps?
              </h2>
              <p className="text-cream-300">
                This action cannot be undone
              </p>
            </div>

            <div className="glass-premium rounded-xl p-4 mb-6">
              <p className="text-sm text-cream-500/60 mb-1">You are about to delete:</p>
              <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
              <p className="text-sm text-cream-500/60 mt-1">{CLASS_NAMES[corpsClass] || corpsClass}</p>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-300">
                All data for this corps will be permanently deleted, including:
              </p>
              <ul className="text-sm text-red-300/80 mt-2 space-y-1 ml-4">
                <li>• Caption lineup</li>
                <li>• Show selections</li>
                <li>• Equipment and staff</li>
                <li>• Performance history</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onClose}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >
                Delete Corps
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default DeleteCorpsModal;
