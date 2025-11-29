// src/components/Execution/DashboardStaffPanel.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users, Award, Trophy, ChevronRight, TrendingUp, Target,
  ShoppingCart, Sparkles
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';

const CAPTION_OPTIONS = [
  { value: 'GE1', label: 'General Effect 1', color: 'bg-purple-500' },
  { value: 'GE2', label: 'General Effect 2', color: 'bg-purple-400' },
  { value: 'VP', label: 'Visual Performance', color: 'bg-blue-500' },
  { value: 'VA', label: 'Visual Analysis', color: 'bg-blue-400' },
  { value: 'CG', label: 'Color Guard', color: 'bg-pink-500' },
  { value: 'B', label: 'Brass', color: 'bg-yellow-500' },
  { value: 'MA', label: 'Music Analysis', color: 'bg-green-500' },
  { value: 'P', label: 'Percussion', color: 'bg-red-500' }
];

const DashboardStaffPanel = ({ activeCorpsClass }) => {
  const { user } = useAuth();
  const {
    ownedStaff,
    loading
  } = useStaffMarketplace(user?.uid);

  // Get staff assigned to this corps
  const assignedToCorps = ownedStaff.filter(
    s => s.assignedTo?.corpsClass === activeCorpsClass
  );

  // Get unassigned staff available to assign
  const unassignedStaff = ownedStaff.filter(s => !s.assignedTo);

  // Calculate staff effectiveness for this corps
  // Staff provides effectiveness bonus per-caption (0.75-1.00 range)
  // With good staff: ~3% bonus per staff up to ~8% total
  const calculateStaffBonus = () => {
    if (assignedToCorps.length === 0) return -2; // No staff = -2% penalty (below 0.80 baseline)
    // Each assigned staff improves effectiveness by ~3%, up to +8%
    const effectiveness = Math.min(0.80 + (assignedToCorps.length * 0.03), 1.00);
    const bonus = (effectiveness - 0.80) * 40; // Convert to percentage impact
    return Math.round(bonus);
  };

  const getCaptionColor = (caption) => {
    const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
    return option?.color || 'bg-gray-500';
  };

  const getCaptionLabel = (caption) => {
    const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
    return option?.label || caption;
  };

  const formatCorpsClassName = (className) => {
    if (!className) return '';
    return className
      .replace('Class', ' Class')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Staff Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-display font-bold text-cream-100 mb-1">
              DCI Hall of Fame Staff
            </h3>
            <p className="text-sm text-cream-500/60">
              Real DCI legends boosting your corps
            </p>
          </div>
          <Link
            to="/staff"
            className="btn-primary text-sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Marketplace
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-charcoal-800/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold text-cream-100">{assignedToCorps.length}</span>
            </div>
            <p className="text-xs text-cream-500/60">Assigned</p>
          </div>
          <div className="bg-charcoal-800/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-2xl font-bold text-cream-100">{unassignedStaff.length}</span>
            </div>
            <p className="text-xs text-cream-500/60">Available</p>
          </div>
          <div className="bg-charcoal-800/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className={`w-4 h-4 ${calculateStaffBonus() >= 0 ? 'text-gold-500' : 'text-red-400'}`} />
              <span className={`text-2xl font-bold ${calculateStaffBonus() >= 0 ? 'text-gold-500' : 'text-red-400'}`}>
                {calculateStaffBonus() >= 0 ? '+' : ''}{calculateStaffBonus()}%
              </span>
            </div>
            <p className="text-xs text-cream-500/60">Score Impact</p>
          </div>
        </div>

        {/* Assigned Staff List */}
        {assignedToCorps.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-cream-300 mb-2">
              Staff for {formatCorpsClassName(activeCorpsClass)}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignedToCorps.map((staff) => (
                <div
                  key={staff.staffId}
                  className="flex items-center gap-3 p-3 bg-charcoal-900/50 rounded-lg border border-charcoal-700"
                >
                  <div className={`w-10 h-10 ${getCaptionColor(staff.caption)}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Award className={`w-5 h-5 ${getCaptionColor(staff.caption).replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-cream-100 text-sm truncate">
                      {staff.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white ${getCaptionColor(staff.caption)}`}>
                        {staff.caption}
                      </span>
                      <span className="text-xs text-cream-500/60">
                        {getCaptionLabel(staff.caption)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-charcoal-900/30 rounded-lg">
            <Users className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
            <p className="text-cream-500/60 mb-1">No staff assigned to this corps</p>
            <p className="text-sm text-cream-500/40 mb-4">
              {ownedStaff.length > 0
                ? `You have ${unassignedStaff.length} unassigned staff available`
                : 'Purchase staff from the marketplace to boost your scores'}
            </p>
            <Link
              to="/staff"
              className="btn-outline text-sm inline-flex"
            >
              {ownedStaff.length > 0 ? 'Assign Staff' : 'Browse Marketplace'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        )}

        {/* Unassigned Staff Notice */}
        {unassignedStaff.length > 0 && assignedToCorps.length > 0 && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-400">
                  {unassignedStaff.length} Unassigned Staff Available
                </p>
                <p className="text-xs text-cream-500/60 mt-1">
                  Visit the Staff page to assign them to your corps for additional bonuses.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* How Staff Affects Scoring */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4"
      >
        <div className="flex items-start gap-3">
          <Trophy className="w-5 h-5 text-gold-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-cream-100 mb-2">How Staff Affects Your Score</p>
            <ul className="text-xs text-cream-500/80 space-y-1">
              <li>No staff assigned = <span className="text-red-400">-2% penalty</span> (below baseline)</li>
              <li>Each staff member improves effectiveness by ~3%</li>
              <li>Staff effectiveness ranges from -2% to +8% impact on multiplier</li>
              <li>Staff teaching their specialty caption get +15% effectiveness</li>
              <li>Staff morale affects their teaching quality</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default memo(DashboardStaffPanel);
