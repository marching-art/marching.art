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
        className="glass-slot"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-label mb-0">DCI Hall of Fame Staff</h3>
            <p className="data-label-sm">Real DCI legends boosting your corps</p>
          </div>
          <Link
            to="/staff"
            className="flex items-center gap-2 px-3 py-2 bg-gold-500/20 border border-gold-500/40 hover:border-gold-500/60 text-gold-400 text-xs font-display font-bold uppercase transition-all rounded-lg"
          >
            <ShoppingCart className="w-4 h-4" />
            Marketplace
          </Link>
        </div>

        {/* Stats Row - Glass Slot style */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-black/40 border border-white/5 hover:border-gold-500/30 p-3 text-center rounded-lg transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-green-400" />
              <span className="text-lg font-mono font-bold text-green-400">{assignedToCorps.length}</span>
            </div>
            <p className="data-label-sm">Assigned</p>
          </div>
          <div className="bg-black/40 border border-white/5 hover:border-gold-500/30 p-3 text-center rounded-lg transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-lg font-mono font-bold text-blue-400">{unassignedStaff.length}</span>
            </div>
            <p className="data-label-sm">Available</p>
          </div>
          <div className="bg-black/40 border border-gold-500/30 p-3 text-center rounded-lg">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-lg font-mono font-bold text-gold-400">+{calculateStaffBonus()}%</span>
            </div>
            <p className="data-label-sm">Bonus</p>
          </div>
        </div>

        {/* Assigned Staff List */}
        {assignedToCorps.length > 0 ? (
          <div className="space-y-2">
            <h4 className="section-label border-b border-white/5 pb-2">
              Staff for {formatCorpsClassName(activeCorpsClass)}
            </h4>
            <div className="space-y-1">
              {assignedToCorps.map((staff) => (
                <button
                  key={staff.staffId}
                  onClick={() => setSelectedStaff(staff)}
                  className="flex items-center gap-3 p-2 bg-black/40 border border-white/5 hover:border-gold-500/30 transition-all cursor-pointer text-left w-full group rounded-lg"
                >
                  <div className={`w-8 h-8 ${getCaptionColor(staff.caption)}/20 border border-white/10 flex items-center justify-center flex-shrink-0 rounded-lg`}>
                    <Award className={`w-4 h-4 ${getCaptionColor(staff.caption).replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-bold text-cream-100 truncate">
                      {staff.name}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold rounded ${getCaptionColor(staff.caption)} ${getCaptionColor(staff.caption).replace('bg-', 'border-')}`}>
                    {staff.caption}
                  </span>
                  <span className="text-xs font-mono text-gold-400 group-hover:text-gold-300">
                    +1%
                  </span>
                  <ChevronRight className="w-4 h-4 text-cream-100/50 group-hover:text-gold-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-black/40 border border-white/5 rounded-lg">
            <Users className="w-10 h-10 text-cream-100/30 mx-auto mb-2" />
            <p className="text-sm font-mono font-bold text-cream-100/50 mb-1">No Staff Assigned</p>
            <p className="data-label-sm mb-4">
              {ownedStaff.length > 0
                ? `${unassignedStaff.length} unassigned staff available`
                : 'Purchase staff to boost scores'}
            </p>
            <Link
              to="/staff"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 hover:border-gold-500/30 text-cream-100 text-xs font-display font-bold uppercase transition-all rounded-lg"
            >
              {ownedStaff.length > 0 ? 'Assign Staff' : 'Browse Marketplace'}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Unassigned Staff Notice */}
        {unassignedStaff.length > 0 && assignedToCorps.length > 0 && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                  {unassignedStaff.length} Unassigned Staff
                </p>
              </div>
              <Link
                to="/staff?tab=roster"
                className="text-xs font-mono text-blue-400 hover:text-blue-300 whitespace-nowrap"
              >
                Assign →
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      {/* How Staff Affects Scoring - Help section (closed by default design) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-slot"
      >
        <div className="flex items-start gap-3">
          <Trophy className="w-5 h-5 text-gold-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="section-label mb-2">How Staff Affects Your Score</p>
            <ul className="text-xs text-cream-100/60 space-y-1 font-mono">
              <li className="flex items-center gap-2">
                <span className="text-sm font-bold text-gold-400">+1%</span>
                <span>per staff member assigned</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sm font-bold text-gold-400">+5%</span>
                <span>maximum total bonus</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-400">CAP</span>
                <span>caption-specific boosts</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Staff Details Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-charcoal-900/95 backdrop-blur-xl border border-white/10 w-full max-w-lg shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-lg overflow-hidden tactical-grid"
              >
                {/* Modal Header */}
                <div className="panel-header border-b border-white/10">
                  <h3 className="panel-title">Staff Details</h3>
                  <button onClick={() => setSelectedStaff(null)} className="panel-close">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4 relative z-10">

                  {/* Staff Info */}
                  <div className="flex items-start gap-4 glass-slot">
                    <div className={`w-10 h-10 ${getCaptionColor(selectedStaff.caption)}/20 border border-white/10 flex items-center justify-center flex-shrink-0 rounded-lg`}>
                      <Award className={`w-5 h-5 ${getCaptionColor(selectedStaff.caption).replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-mono font-bold text-cream-100 mb-1">{selectedStaff.name}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold rounded ${getCaptionColor(selectedStaff.caption)} ${getCaptionColor(selectedStaff.caption).replace('bg-', 'border-')}`}>
                          {selectedStaff.caption}
                        </span>
                        <span className="data-label-sm">
                          {selectedStaff.yearInducted}
                        </span>
                      </div>
                      {selectedStaff.biography && (
                        <p className="text-xs text-cream-100/60">{selectedStaff.biography}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-black/40 border border-white/5 hover:border-gold-500/30 rounded-lg transition-colors">
                      <p className="data-label-sm mb-1">Value</p>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-gold-400" />
                        <span className="text-lg font-mono font-bold text-gold-400">
                          {selectedStaff.currentValue || selectedStaff.baseValue || 0}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/5 hover:border-gold-500/30 rounded-lg transition-colors">
                      <p className="data-label-sm mb-1">Seasons</p>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-blue-400" />
                        <span className="text-lg font-mono font-bold text-blue-400">
                          {selectedStaff.seasonsCompleted || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Info */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-400" />
                      <span className="section-label text-green-400 mb-0">Currently Assigned</span>
                    </div>
                    <p className="text-xs text-cream-100/60 mb-3">
                      Boosting <span className="font-mono text-green-400">{getCaptionLabel(selectedStaff.caption)}</span> for{' '}
                      <span className="font-mono text-cream-100">
                        {selectedStaff.assignedTo?.corpsName || formatCorpsClassName(selectedStaff.assignedTo?.corpsClass)}
                      </span>
                    </p>
                    <button
                      onClick={handleUnassign}
                      disabled={assigning}
                      className="w-full py-2 px-4 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition-all disabled:opacity-50 font-display font-bold uppercase text-sm rounded-lg"
                    >
                      {assigning ? 'Unassigning...' : 'Unassign Staff'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedStaff(null)}
                      className="flex-1 py-2.5 px-4 bg-black/40 border border-white/5 hover:border-white/20 text-cream-100/50 hover:text-cream-100 font-display font-bold uppercase text-sm transition-all rounded-lg"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleManageInMarketplace}
                      className="flex-1 py-2.5 px-4 bg-gold-500/20 border border-gold-500/40 hover:border-gold-500/60 text-gold-400 font-display font-bold uppercase text-sm transition-all rounded-lg"
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
