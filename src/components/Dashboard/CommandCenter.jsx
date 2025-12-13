// src/components/Dashboard/CommandCenter.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users, ChevronRight, Trophy, Music, Calendar, Sparkles
} from 'lucide-react';
import { Card } from '../ui/Card';

/**
 * CommandCenter - Unified corps management HUD
 *
 * Design Philosophy: "Surface Status, Drill for Detail"
 * - Shows corps score and status at a glance
 * - Action cards link to modals/pages for deep management
 */

// Action card component
const ActionCard = memo(({
  icon: Icon,
  title,
  subtitle,
  onAction,
}) => {
  return (
    <div
      onClick={onAction}
      className="action-tile cursor-pointer flex items-center justify-between"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="icon-neon-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-yellow-50 font-bold text-sm truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-yellow-50/50 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-yellow-500/30">
        <ChevronRight size={18} className="text-yellow-50/60" />
      </div>
    </div>
  );
});

ActionCard.displayName = 'ActionCard';

const CommandCenter = ({
  profile,
  activeCorps,
  activeCorpsClass,
  currentWeek,
  corps,
  hasMultipleCorps,
  onCorpsSwitch,
  getCorpsClassName,
  assignedStaff = [],
  onOpenStaffModal,
}) => {
  if (!activeCorps) return null;

  const showsThisWeek = activeCorps?.selectedShows?.[`week${currentWeek}`]?.length || 0;
  const staffSlotsFilled = assignedStaff.length;
  const maxStaffSlots = 8;

  // Class order for sorting
  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  // Class badge colors
  const classColors = {
    worldClass: 'bg-gold-500 text-charcoal-900',
    openClass: 'bg-purple-500 text-white',
    aClass: 'bg-blue-500 text-white',
    soundSport: 'bg-green-500 text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Corps Selector - Only show if multiple corps */}
      {hasMultipleCorps && (
        <div className="flex items-center gap-3 px-1">
          <Music className="w-4 h-4 text-gold-500 flex-shrink-0" />
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {Object.entries(corps)
              .sort((a, b) => CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]))
              .map(([classId, corpsData]) => (
                <button
                  key={classId}
                  onClick={() => onCorpsSwitch(classId)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeCorpsClass === classId
                      ? 'bg-gold-500 text-charcoal-900'
                      : 'bg-charcoal-800/60 text-cream-500/70 hover:text-cream-100 hover:bg-charcoal-700'
                  }`}
                >
                  {corpsData.corpsName || corpsData.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT: Hero Card - Corps Status (8 cols) */}
        <Card variant="premium" padding="none" className="lg:col-span-8 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-5 pointer-events-none">
            <Trophy size={192} />
          </div>

          {/* HUD HEADER */}
          <div className="hud-header relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest uppercase ${classColors[activeCorpsClass] || 'bg-cream-500 text-charcoal-900'}`} style={{ borderRadius: '2px' }}>
                {getCorpsClassName(activeCorpsClass)}
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-black text-white dark:text-cream-100 tracking-tight uppercase">
                {activeCorps.corpsName || activeCorps.name}
              </h2>
              {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-gold-500/20 text-gold-400 text-[10px] font-bold" style={{ borderRadius: '2px' }}>
                  <Trophy size={10} />
                  TOP 10
                </span>
              )}
            </div>
            {activeCorps.showConcept && (
              <p className="hidden sm:block text-cream-400 dark:text-cream-500 text-xs">
                <span className="text-gold-500 font-semibold">SHOW:</span> "{typeof activeCorps.showConcept === 'object' ? activeCorps.showConcept.theme : activeCorps.showConcept}"
              </p>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 relative z-10">

            {/* Section 1: Season Score */}
            <div className="hud-quadrant p-4 sm:p-5 border-b sm:border-b-0 sm:border-r hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                SEASON SCORE
              </div>
              {activeCorpsClass !== 'soundSport' ? (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="score-glow text-5xl tracking-tight">
                      {activeCorps.totalSeasonScore?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-xs text-cream-500/50 mt-1">Total Points</div>
                  </div>
                  {activeCorps.rank && (
                    <div className="text-center ml-6">
                      <div className="text-3xl font-bold text-gold-400">#{activeCorps.rank}</div>
                      <div className="text-xs text-cream-500/50 mt-1">Rank</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  <Sparkles size={18} />
                  <span>SoundSport is about having fun - no scoring!</span>
                </div>
              )}
            </div>

            {/* Section 2: Weekly Status */}
            <div className="hud-quadrant p-4 sm:p-5 border-b hud-grid-divider">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                WEEKLY STATUS
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Calendar size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="text-xl font-mono font-black text-purple-400">{showsThisWeek}</div>
                    <div className="text-[9px] text-cream-500/50 uppercase tracking-wider">Shows This Week</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Users size={18} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-xl font-mono font-black text-green-400">{staffSlotsFilled}/{maxStaffSlots}</div>
                    <div className="text-[9px] text-cream-500/50 uppercase tracking-wider">Staff</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Quick Actions */}
            <div className="hud-quadrant p-4 sm:p-5 sm:col-span-2">
              <div className="text-[10px] text-cream-500/60 uppercase tracking-widest font-bold mb-3">
                QUICK ACTIONS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Link
                  to="/schedule"
                  className="action-tile flex items-center gap-3 !p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
                    <Calendar size={18} className="icon-neon-gold" />
                  </div>
                  <span className="text-sm font-semibold text-yellow-50 uppercase tracking-wide">Schedule</span>
                  <ChevronRight size={16} className="ml-auto text-yellow-50/40" />
                </Link>
                <Link
                  to="/leaderboard"
                  className="action-tile flex items-center gap-3 !p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
                    <Trophy size={18} className="icon-neon-gold" />
                  </div>
                  <span className="text-sm font-semibold text-yellow-50 uppercase tracking-wide">Leaderboard</span>
                  <ChevronRight size={16} className="ml-auto text-yellow-50/40" />
                </Link>
                <Link
                  to="/staff"
                  className="action-tile flex items-center gap-3 !p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-yellow-500/20 flex items-center justify-center">
                    <Users size={18} className="icon-neon-gold" />
                  </div>
                  <span className="text-sm font-semibold text-yellow-50 uppercase tracking-wide">Staff Market</span>
                  <ChevronRight size={16} className="ml-auto text-yellow-50/40" />
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {/* RIGHT: Action Cards Column (4 cols) */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {/* Staff Management */}
          <ActionCard
            icon={Users}
            title="Staff Roster"
            subtitle={`${staffSlotsFilled}/${maxStaffSlots} Assigned`}
            onAction={onOpenStaffModal}
          />

          {/* Show Schedule Link */}
          <Link to="/schedule" className="block">
            <ActionCard
              icon={Calendar}
              title="Show Schedule"
              subtitle={`${showsThisWeek} shows this week`}
              onAction={() => {}}
            />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default CommandCenter;
