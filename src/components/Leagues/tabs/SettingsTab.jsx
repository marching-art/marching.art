// SettingsTab - Commissioner settings for league management
import React from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const SettingsTab = ({ league }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
        Commissioner Settings
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-cream-100 mb-2">Invite Code</h3>
          <div className="flex items-center gap-3 p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/20">
            <code className="text-2xl font-mono font-bold text-gold-500 tracking-wider">
              {league.inviteCode}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(league.inviteCode);
                toast.success('Invite code copied!');
              }}
              className="btn-outline text-sm"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-cream-100 mb-4">League Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Prize Pool (CorpsCoin)</span>
              <span className="font-bold text-gold-500">{league.settings?.prizePool || 1000}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Finals Spots</span>
              <span className="font-bold text-cream-100">{league.settings?.finalsSize || 12}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
              <span className="text-cream-300">Staff Trading</span>
              <span className={`font-bold ${league.settings?.enableStaffTrading ? 'text-green-400' : 'text-red-400'}`}>
                {league.settings?.enableStaffTrading ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsTab;
