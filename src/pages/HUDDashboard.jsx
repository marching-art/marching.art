// =============================================================================
// HUD DASHBOARD - High-Density Command Center
// =============================================================================
// The rebuilt dashboard with 3-column Holy Grail layout and sticky resource header.
// Uses real data from the useDashboardData hook and displays all critical information
// on a single screen without scrolling (One-Screen Rule).
//
// Layout:
//   [Resource Header - Sticky]
//   [Intelligence | Command Center | Logistics]
//
// Data Sources (from Phase 1 Audit):
// - useDashboardData() - Centralized dashboard state
// - useSeasonStore() - Season data (currentWeek, currentDay, weeksRemaining)
// - useStaffMarketplace() - Staff roster
// - profile.corpsCoin, profile.xp, profile.xpLevel - User resources
// - activeCorps.corpsName, activeCorps.rank - Corps identity

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../App';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStaffMarketplace } from '../hooks/useStaffMarketplace';

// Layout Components
import ResourceHeader from '../components/hud/ResourceHeader';
import {
  CommandCenterLayout,
  IntelligenceColumn,
  CommandColumn,
  LogisticsColumn,
  Panel,
} from '../components/hud/CommandCenterLayout';

// Icons for placeholder panels
import {
  BarChart3,
  Trophy,
  TrendingUp,
  Activity,
  Users,
  Wrench,
  Calendar,
  Zap,
  Target,
  Music,
  Bell,
} from 'lucide-react';

// =============================================================================
// PLACEHOLDER PANEL - Temporary content for Phase 2
// =============================================================================

const PlaceholderPanel = ({ icon: Icon, title, description, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 p-4 text-center ${className}`}>
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <Icon className="w-6 h-6 text-cream/40" />
    </div>
    <h4 className="text-xs font-display font-bold text-cream/60 uppercase tracking-wide">
      {title}
    </h4>
    {description && (
      <p className="text-[10px] text-cream/40 max-w-[200px]">
        {description}
      </p>
    )}
  </div>
);

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const columnVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] },
  },
};

// =============================================================================
// HUD DASHBOARD COMPONENT
// =============================================================================

const HUDDashboard = () => {
  const { user } = useAuth();

  // Centralized dashboard data hook
  const dashboardData = useDashboardData();

  // Staff marketplace for assigned staff count
  const { ownedStaff } = useStaffMarketplace(user?.uid);

  // Corps switcher state (for dropdown)
  const [showCorpsSwitcher, setShowCorpsSwitcher] = useState(false);

  // Destructure commonly used values from dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    weeksRemaining,
    currentWeek,
    currentDay,
    engagementData,
    executionState,
    handleCorpsSwitch,
  } = dashboardData;

  // Calculate staff assigned to active corps
  const assignedStaff = ownedStaff?.filter(
    s => s.assignedTo?.corpsClass === activeCorpsClass
  ) || [];

  // Handler for corps switching
  const handleCorpsSwitchClick = () => {
    if (hasMultipleCorps) {
      setShowCorpsSwitcher(!showCorpsSwitcher);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-surface">
      {/* ====================================================================
          RESOURCE HEADER - Sticky Top Bar
          ==================================================================== */}
      <ResourceHeader
        profile={profile}
        activeCorps={activeCorps}
        activeCorpsClass={activeCorpsClass}
        hasMultipleCorps={hasMultipleCorps}
        seasonData={seasonData}
        currentWeek={currentWeek}
        currentDay={currentDay}
        weeksRemaining={weeksRemaining}
        engagementData={engagementData}
        onCorpsSwitch={handleCorpsSwitchClick}
      />

      {/* ====================================================================
          MAIN CONTENT - 3-Column Command Center
          ==================================================================== */}
      <motion.div
        className="flex-1 min-h-0 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <CommandCenterLayout fullHeight>

          {/* ================================================================
              LEFT COLUMN: INTELLIGENCE
              Data feeds, insights, analytics, leaderboard position
              ================================================================ */}
          <IntelligenceColumn>
            <motion.div
              variants={columnVariants}
              className="h-full flex flex-col gap-1"
            >
              {/* Leaderboard Position Panel */}
              <Panel
                title="Leaderboard"
                subtitle="Your standing"
                variant="default"
                className="flex-none"
              >
                {/* Left Column: Leaderboard Position */}
                <PlaceholderPanel
                  icon={Trophy}
                  title="Rank Position"
                  description="Current rank and competitive standing"
                />
              </Panel>

              {/* Performance Trends Panel */}
              <Panel
                title="Performance"
                subtitle="Recent trends"
                variant="default"
                className="flex-1 min-h-0"
                scrollable
              >
                {/* Left Column: Score Trends */}
                <PlaceholderPanel
                  icon={TrendingUp}
                  title="Score History"
                  description="Week-over-week performance charts"
                />
              </Panel>

              {/* Season Progress Panel */}
              <Panel
                title="Season"
                variant="sunken"
                className="flex-none"
              >
                {/* Left Column: Season Timeline */}
                <PlaceholderPanel
                  icon={Calendar}
                  title="Timeline"
                  description="Season milestones and upcoming events"
                />
              </Panel>
            </motion.div>
          </IntelligenceColumn>

          {/* ================================================================
              CENTER COLUMN: COMMAND
              Corps vitals, multiplier, quick actions, daily operations
              ================================================================ */}
          <CommandColumn>
            <motion.div
              variants={columnVariants}
              className="h-full flex flex-col gap-1"
            >
              {/* Corps Vitals & Multiplier Panel */}
              <Panel
                title={activeCorps?.corpsName || activeCorps?.name || 'Command Center'}
                subtitle={`Week ${currentWeek} • Day ${currentDay}`}
                variant="accent"
                className="flex-none"
                actions={
                  <button className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide">
                    Details →
                  </button>
                }
              >
                {/* Center Column: Corps Identity & Multiplier */}
                <PlaceholderPanel
                  icon={Target}
                  title="Performance Multiplier"
                  description="Readiness, Morale, Equipment breakdown"
                />
              </Panel>

              {/* Readiness Gauges Panel */}
              <Panel
                title="Vitals"
                subtitle="Execution state"
                variant="elevated"
                className="flex-none"
              >
                {/* Center Column: Readiness/Morale/Equipment Bars */}
                <PlaceholderPanel
                  icon={Activity}
                  title="Section Readiness"
                  description="Brass, Percussion, Guard, Ensemble metrics"
                />
              </Panel>

              {/* Quick Actions Grid */}
              <Panel
                title="Quick Actions"
                variant="default"
                className="flex-1 min-h-0"
                noPadding
              >
                {/* Center Column: Action Tiles Grid */}
                <div className="h-full p-3">
                  <PlaceholderPanel
                    icon={Zap}
                    title="Action Grid"
                    description="Rehearse, Staff, Equipment, Schedule, Insights"
                  />
                </div>
              </Panel>

              {/* Notifications/Alerts Bar */}
              <Panel
                variant="sunken"
                className="flex-none"
                noPadding
              >
                {/* Center Column: Alert Ticker */}
                <div className="px-3 py-2 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-cream/40" />
                  <span className="text-[10px] text-cream/50">
                    No new alerts
                  </span>
                </div>
              </Panel>
            </motion.div>
          </CommandColumn>

          {/* ================================================================
              RIGHT COLUMN: LOGISTICS
              Staff roster, equipment status, schedule, resources
              ================================================================ */}
          <LogisticsColumn>
            <motion.div
              variants={columnVariants}
              className="h-full flex flex-col gap-1"
            >
              {/* Staff Roster Panel */}
              <Panel
                title="Staff"
                subtitle={`${assignedStaff.length}/8 assigned`}
                variant="default"
                className="flex-1 min-h-0"
                scrollable
                actions={
                  <button className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide">
                    Manage →
                  </button>
                }
              >
                {/* Right Column: Staff Roster List */}
                <PlaceholderPanel
                  icon={Users}
                  title="Staff Roster"
                  description="Assigned staff by caption with ratings"
                />
              </Panel>

              {/* Equipment Status Panel */}
              <Panel
                title="Equipment"
                subtitle="Condition status"
                variant="default"
                className="flex-none"
                actions={
                  <button className="text-[9px] text-gold-400 hover:text-gold-300 uppercase tracking-wide">
                    Repair →
                  </button>
                }
              >
                {/* Right Column: Equipment Health Bars */}
                <PlaceholderPanel
                  icon={Wrench}
                  title="Equipment Health"
                  description="Uniforms, Instruments, Props condition"
                />
              </Panel>

              {/* Weekly Schedule Panel */}
              <Panel
                title="Schedule"
                subtitle={`Week ${currentWeek}`}
                variant="sunken"
                className="flex-none"
              >
                {/* Right Column: This Week's Shows */}
                <PlaceholderPanel
                  icon={Music}
                  title="Upcoming Shows"
                  description="This week's competition schedule"
                />
              </Panel>
            </motion.div>
          </LogisticsColumn>

        </CommandCenterLayout>
      </motion.div>
    </div>
  );
};

export default HUDDashboard;
