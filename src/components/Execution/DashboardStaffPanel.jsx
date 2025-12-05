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
      {/* Staff Roster Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-slot"
      >
        {/* Header with Marketplace Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="section-label mb-0">Staff Roster</span>
            <span className="text-xs font-mono text-green-400">+{calculateStaffBonus()}%</span>
          </div>
          <Link
            to="/staff"
            className="p-2 bg-black/40 border border-gold-500/30 hover:border-gold-500/50 hover:bg-gold-500/10 text-gold-400 transition-all rounded-lg"
            title="Staff Marketplace"
          >
            <ShoppingCart className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats Row - Compact */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm font-mono font-bold text-green-400">{assignedToCorps.length}</span>
            <span className="text-[10px] text-cream/40">assigned</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cream/50" />
            <span className="text-sm font-mono font-bold text-cream/50">{unassignedStaff.length}</span>
            <span className="text-[10px] text-cream/40">available</span>
          </div>
        </div>

        {/* Staff Roster Table */}
        {assignedToCorps.length > 0 ? (
          <div className="space-y-1">
            {assignedToCorps.map((staff) => (
              <button
                key={staff.staffId}
                onClick={() => setSelectedStaff(staff)}
                className="w-full h-14 flex items-center gap-3 px-3 bg-black/40 border border-white/5 hover:border-gold-500/30 transition-all cursor-pointer rounded-lg group"
              >
                {/* Avatar */}
                <div className={`w-9 h-9 ${getCaptionColor(staff.caption)}/20 border border-white/10 flex items-center justify-center flex-shrink-0 rounded-lg`}>
                  <Award className={`w-4 h-4 ${getCaptionColor(staff.caption).replace('bg-', 'text-')}`} />
                </div>

                {/* Name / Role */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-mono font-bold text-cream-100 truncate">
                    {staff.name}
                  </p>
                  <p className="text-[10px] text-cream/40 truncate">
                    {getCaptionLabel(staff.caption)}
                  </p>
                </div>

                {/* Bonus Stat (Green) */}
                <span className="text-sm font-mono font-bold text-green-400 flex-shrink-0">
                  +1%
                </span>

                {/* Salary (Gold) */}
                <span className="text-xs font-mono text-gold-400 flex-shrink-0 w-16 text-right">
                  ${staff.salary || 0}/wk
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-black/40 border border-white/5 rounded-lg">
            <Users className="w-8 h-8 text-cream/30 mx-auto mb-2" />
            <p className="text-sm font-mono text-cream/50 mb-1">No Staff Assigned</p>
            <p className="text-[10px] text-cream/40 mb-3">
              {ownedStaff.length > 0
                ? `${unassignedStaff.length} available to assign`
                : 'Purchase staff in marketplace'}
            </p>
            <Link
              to="/staff"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 hover:border-gold-500/30 text-cream/60 text-xs font-mono transition-all rounded-lg"
            >
              {ownedStaff.length > 0 ? 'Assign Staff' : 'Browse Marketplace'}
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Unassigned Staff Notice - Subtle */}
        {unassignedStaff.length > 0 && assignedToCorps.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-[10px]">
            <span className="text-cream/40">
              {unassignedStaff.length} staff available to assign
            </span>
            <Link
              to="/staff?tab=roster"
              className="text-gold-400 hover:text-gold-300 font-mono"
            >
              Manage →
            </Link>
          </div>
        )}
      </motion.div>

      {/* Staff Info - Compact */}
      <div className="flex items-center gap-4 text-[10px] text-cream/40 px-1">
        <span><span className="text-gold-400 font-mono font-bold">+1%</span> per staff</span>
        <span><span className="text-gold-400 font-mono font-bold">+5%</span> max bonus</span>
      </div>

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
