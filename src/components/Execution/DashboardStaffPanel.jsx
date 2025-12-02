// src/components/Execution/DashboardStaffPanel.jsx
import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Award, Trophy, ChevronRight, TrendingUp, Target,
  ShoppingCart, Sparkles, X, Calendar, DollarSign
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import Portal from '../Portal';

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

const DashboardStaffPanel = ({ activeCorpsClass, userCorps = {} }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    ownedStaff,
    loading,
    assigning,
    unassignStaff
  } = useStaffMarketplace(user?.uid);

  const [selectedStaff, setSelectedStaff] = useState(null);

  // Get staff assigned to this corps
  const assignedToCorps = ownedStaff.filter(
    s => s.assignedTo?.corpsClass === activeCorpsClass
  );

  // Get unassigned staff available to assign
  const unassignedStaff = ownedStaff.filter(s => !s.assignedTo);

  // Calculate staff bonus for this corps (max 5%)
  const calculateStaffBonus = () => {
    if (assignedToCorps.length === 0) return 0;
    // Each assigned staff provides 1% bonus, up to 5%
    return Math.min(assignedToCorps.length, 5);
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

  const handleUnassign = async () => {
    if (!selectedStaff) return;
    try {
      await unassignStaff(selectedStaff.staffId);
      setSelectedStaff(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleManageInMarketplace = () => {
    setSelectedStaff(null);
    navigate('/staff?tab=roster');
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
              <TrendingUp className="w-4 h-4 text-gold-500" />
              <span className="text-2xl font-bold text-gold-500">+{calculateStaffBonus()}%</span>
            </div>
            <p className="text-xs text-cream-500/60">Score Bonus</p>
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
                <button
                  key={staff.staffId}
                  onClick={() => setSelectedStaff(staff)}
                  className="flex items-center gap-3 p-3 bg-charcoal-900/50 rounded-lg border border-charcoal-700 hover:border-gold-500/50 hover:bg-charcoal-800/50 transition-all cursor-pointer text-left w-full"
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
                  <ChevronRight className="w-4 h-4 text-cream-500/40" />
                </button>
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
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-400">
                  {unassignedStaff.length} Unassigned Staff Available
                </p>
                <p className="text-xs text-cream-500/60 mt-1">
                  Visit the Staff page to assign them to your corps for additional bonuses.
                </p>
              </div>
              <Link
                to="/staff?tab=roster"
                className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
              >
                Assign Now →
              </Link>
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
              <li>Each staff member boosts your corps multiplier by ~1%</li>
              <li>Staff can provide up to +5% total score bonus</li>
              <li>Staff are assigned to specific corps for targeted improvements</li>
              <li>DCI Hall of Fame inductees are based on real legends</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Staff Details Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-6 w-full max-w-lg"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-cream-100">Staff Details</h3>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Staff Info */}
                  <div className="flex items-start gap-4 p-4 bg-charcoal-900/50 rounded-lg">
                    <div className={`w-12 h-12 ${getCaptionColor(selectedStaff.caption)}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Award className={`w-6 h-6 ${getCaptionColor(selectedStaff.caption).replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-cream-100 mb-1">{selectedStaff.name}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white ${getCaptionColor(selectedStaff.caption)}`}>
                          {selectedStaff.caption}
                        </span>
                        <span className="text-xs text-cream-400">
                          Inducted {selectedStaff.yearInducted}
                        </span>
                      </div>
                      {selectedStaff.biography && (
                        <p className="text-sm text-cream-400">{selectedStaff.biography}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Current Value</p>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-gold-400" />
                        <span className="text-xl font-bold text-gold-400">
                          {selectedStaff.currentValue || selectedStaff.baseValue || 0}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Seasons</p>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-blue-400" />
                        <span className="text-xl font-bold text-blue-400">
                          {selectedStaff.seasonsCompleted || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Info */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-green-400">Currently Assigned</span>
                    </div>
                    <p className="text-cream-300 mb-3">
                      Boosting <span className="font-semibold">{getCaptionLabel(selectedStaff.caption)}</span> for{' '}
                      <span className="font-semibold">
                        {selectedStaff.assignedTo?.corpsName || formatCorpsClassName(selectedStaff.assignedTo?.corpsClass)}
                      </span>
                    </p>
                    <button
                      onClick={handleUnassign}
                      disabled={assigning}
                      className="w-full py-2 px-4 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      {assigning ? 'Unassigning...' : 'Unassign Staff'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedStaff(null)}
                      className="flex-1 py-2 px-4 rounded-lg bg-charcoal-700 text-cream-300 hover:bg-charcoal-600 transition-all"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleManageInMarketplace}
                      className="flex-1 py-2 px-4 rounded-lg bg-gold-500 text-charcoal-900 font-semibold hover:bg-gold-400 transition-all"
                    >
                      Manage in Roster
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(DashboardStaffPanel);
