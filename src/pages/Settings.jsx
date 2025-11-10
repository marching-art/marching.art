// src/pages/Settings.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Lock, Palette } from 'lucide-react';

const Settings = () => {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Settings</h1>
        <p className="text-cream-300">Manage your account and preferences</p>
      </motion.div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-cream-100 mb-4">Account Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-cream-300">Email Notifications</label>
            <input type="checkbox" className="checkbox" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-cream-300">Show Reminders</label>
            <input type="checkbox" className="checkbox" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
