// src/components/Dashboard/DashboardCorpsPanel.jsx
import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Music, Edit, MoreVertical, Trash2, ArrowRightLeft,
  Archive, Trophy, AlertCircle, Calendar, MapPin,
  Check, ChevronDown, Plus, Users
} from 'lucide-react';
import InfoTooltip from '../InfoTooltip';

/**
 * Unified corps panel that displays corps info, lineup, and schedule
 * in a compact, tabbed interface.
 */
const DashboardCorpsPanel = ({
  activeCorps,
  activeCorpsClass,
  profile,
  currentWeek,
  getCorpsClassName,
  onShowCaptionSelection,
  onShowEditCorps,
  onShowDeleteConfirm,
  onShowMoveCorps,
  onShowRetireConfirm,
  onShowRegistration
}) => {
  const [activeSection, setActiveSection] = useState('lineup');
  const [showManagementMenu, setShowManagementMenu] = useState(false);

  if (!activeCorps) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-premium p-6 text-center"
      >
        <Music className="w-12 h-12 text-gold-500 mx-auto mb-3" />
        <h2 className="text-xl font-display font-bold text-cream-100 mb-2">
          Start Your Journey
        </h2>
        <p className="text-cream-300 text-sm mb-4">
          Register your fantasy corps and compete!
        </p>
        <button
          onClick={onShowRegistration}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Register Corps
        </button>
      </motion.div>
    );
  }

  const hasLineup = activeCorps.lineup && Object.keys(activeCorps.lineup).length > 0;
  const lineupCount = Object.keys(activeCorps.lineup || {}).length;
  const hasShows = activeCorps.selectedShows?.[`week${currentWeek}`]?.length > 0;
  const showCount = activeCorps.selectedShows?.[`week${currentWeek}`]?.length || 0;

  // Calculate lineup points
  const totalPoints = Object.values(activeCorps.lineup || {}).reduce((sum, selection) => {
    const parts = selection.split('|');
    return sum + (parseInt(parts[2]) || 0);
  }, 0);
  const pointLimits = { soundSport: 90, aClass: 60, open: 120, world: 150 };
  const limit = pointLimits[activeCorpsClass] || 150;

  // Sort captions in order
  const captionOrder = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
  const sortedLineup = Object.entries(activeCorps.lineup || {})
    .sort((a, b) => captionOrder.indexOf(a[0]) - captionOrder.indexOf(b[0]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      {/* Corps Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-display font-bold text-cream-100 truncate">
              {activeCorps.corpsName || activeCorps.name}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              activeCorpsClass === 'world' ? 'text-gold-500 bg-gold-500/10 border-gold-500/30' :
              activeCorpsClass === 'open' ? 'text-purple-500 bg-purple-500/10 border-purple-500/30' :
              activeCorpsClass === 'aClass' ? 'text-blue-500 bg-blue-500/10 border-blue-500/30' :
              'text-green-500 bg-green-500/10 border-green-500/30'
            }`}>
              {getCorpsClassName(activeCorpsClass)}
            </span>
            {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
              <span className="text-xs px-2 py-0.5 rounded bg-gold-500/20 text-gold-500 border border-gold-500/30 flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                Top 10
              </span>
            )}
          </div>
          {activeCorps.location && (
            <p className="text-sm text-cream-500/60 mt-1">{activeCorps.location}</p>
          )}
        </div>

        {/* Management Menu */}
        <div className="relative">
          <button
            onClick={() => setShowManagementMenu(!showManagementMenu)}
            className="btn-ghost p-2"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showManagementMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowManagementMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-1 w-44 glass-dark rounded-lg shadow-xl border border-cream-500/20 z-20 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      onShowEditCorps();
                      setShowManagementMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-cream-500/10 transition-colors text-cream-100 text-sm"
                  >
                    <Edit className="w-3 h-3 text-blue-500" />
                    Edit Details
                  </button>
                  <button
                    onClick={() => {
                      onShowMoveCorps();
                      setShowManagementMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-cream-500/10 transition-colors text-cream-100 text-sm"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-purple-500" />
                    Move Class
                  </button>
                  <button
                    onClick={() => {
                      onShowRetireConfirm();
                      setShowManagementMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-cream-500/10 transition-colors text-cream-100 text-sm"
                  >
                    <Archive className="w-3 h-3 text-orange-500" />
                    Retire
                  </button>
                  <div className="border-t border-cream-500/10" />
                  <button
                    onClick={() => {
                      onShowDeleteConfirm();
                      setShowManagementMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-500/10 transition-colors text-red-400 text-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Show Concept (if exists) */}
      {activeCorps.showConcept && (
        <div className="p-3 bg-charcoal-900/30 rounded-lg mb-4 text-sm text-cream-300">
          <span className="text-cream-500/60">Show: </span>
          {activeCorps.showConcept}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 mb-4 border-b border-cream-500/10 pb-2">
        <button
          onClick={() => setActiveSection('lineup')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSection === 'lineup'
              ? 'bg-gold-500 text-charcoal-900'
              : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
          }`}
        >
          <Users className="w-3 h-3" />
          Lineup ({lineupCount}/8)
        </button>
        <button
          onClick={() => setActiveSection('schedule')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSection === 'schedule'
              ? 'bg-gold-500 text-charcoal-900'
              : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
          }`}
        >
          <Calendar className="w-3 h-3" />
          Schedule ({showCount})
        </button>
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        {activeSection === 'lineup' && (
          <motion.div
            key="lineup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-cream-500/60">
                  Points: <span className={`font-bold ${totalPoints > limit ? 'text-red-500' : 'text-gold-500'}`}>
                    {totalPoints}
                  </span>/{limit}
                </span>
                <InfoTooltip
                  content="Select historical caption heads from different corps and years."
                  title="Caption Lineup"
                />
              </div>
              <button
                onClick={onShowCaptionSelection}
                className="btn-outline text-xs py-1.5 px-3"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </button>
            </div>

            {!hasLineup ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-cream-500/40 mx-auto mb-2" />
                <p className="text-sm text-cream-500/60 mb-3">No captions selected</p>
                <button
                  onClick={onShowCaptionSelection}
                  className="btn-primary text-sm"
                >
                  Select Captions
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sortedLineup.map(([caption, selection]) => {
                  const parts = selection.split('|');
                  const corpsName = parts[0] || selection;
                  const year = parts[1] || '';
                  const points = parts[2] || '?';

                  return (
                    <div
                      key={caption}
                      className="flex items-center justify-between p-2 bg-charcoal-900/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-cream-500/60">{caption}</p>
                        <p className="text-xs font-medium text-cream-100 truncate">{corpsName}</p>
                        {year && <p className="text-[10px] text-cream-500/40">({year})</p>}
                      </div>
                      <div className="text-right pl-2">
                        <p className="text-sm font-bold text-gold-500">{points}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeSection === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-cream-500/60">
                Week {currentWeek} Shows
              </span>
              <Link
                to="/schedule"
                className="btn-outline text-xs py-1.5 px-3"
              >
                <Calendar className="w-3 h-3 mr-1" />
                {hasShows ? 'Edit' : 'Select'}
              </Link>
            </div>

            {!hasShows ? (
              <div className="text-center py-6">
                <Calendar className="w-10 h-10 text-cream-500/40 mx-auto mb-2" />
                <p className="text-sm text-cream-500/60 mb-3">No shows selected</p>
                <Link
                  to="/schedule"
                  className="btn-primary text-sm inline-flex items-center"
                >
                  View Schedule
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeCorps.selectedShows[`week${currentWeek}`].map((show, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-charcoal-900/30 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-cream-100 truncate">
                        {show.eventName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {show.date && (
                          <span className="text-[10px] text-cream-500/60 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {show.date?.toDate ? show.date.toDate().toLocaleDateString() : show.date}
                          </span>
                        )}
                        {show.location && (
                          <span className="text-[10px] text-cream-500/60 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {show.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(DashboardCorpsPanel);
