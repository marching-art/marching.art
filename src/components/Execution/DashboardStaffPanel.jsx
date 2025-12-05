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
        className="bg-white/5 border border-white/10 rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-display font-bold text-gold-400 uppercase tracking-wider mb-1">
              DCI Hall of Fame Staff
            </h3>
            <p className="text-xs text-cream-muted">
              Real DCI legends boosting your corps
            </p>
          </div>
          <Link
            to="/staff"
            className="flex items-center gap-2 px-3 py-2 bg-gold-500/20 border border-gold-500/40 hover:border-gold-400 text-gold-400 text-xs font-display font-bold uppercase transition-all"
            style={{ borderRadius: '4px' }}
          >
            <ShoppingCart className="w-4 h-4" />
            Marketplace
          </Link>
        </div>

        {/* Stats Row - Tactical compact style */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-black/40 border border-white/10 p-3 text-center" style={{ borderRadius: '4px' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xl font-mono font-bold text-green-400">{assignedToCorps.length}</span>
            </div>
            <p className="text-[10px] font-display font-bold text-cream-muted uppercase">Assigned</p>
          </div>
          <div className="bg-black/40 border border-white/10 p-3 text-center" style={{ borderRadius: '4px' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xl font-mono font-bold text-blue-400">{unassignedStaff.length}</span>
            </div>
            <p className="text-[10px] font-display font-bold text-cream-muted uppercase">Available</p>
          </div>
          <div className="bg-black/40 border border-gold-500/30 p-3 text-center" style={{ borderRadius: '4px' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-xl font-mono font-bold text-gold-400">+{calculateStaffBonus()}%</span>
            </div>
            <p className="text-[10px] font-display font-bold text-cream-muted uppercase">Bonus</p>
          </div>
        </div>

        {/* Assigned Staff List - Tactical List Style */}
        {assignedToCorps.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-[10px] font-display font-bold text-cream-muted uppercase tracking-wider pb-2 border-b border-white/10">
              Staff for {formatCorpsClassName(activeCorpsClass)}
            </h4>
            <div className="space-y-1">
              {assignedToCorps.map((staff) => (
                <button
                  key={staff.staffId}
                  onClick={() => setSelectedStaff(staff)}
                  className="flex items-center gap-3 p-2 bg-black/40 border border-white/10 hover:border-gold-500/30 transition-all cursor-pointer text-left w-full group"
                  style={{ borderRadius: '4px' }}
                >
                  <div className={`w-8 h-8 ${getCaptionColor(staff.caption)}/20 border border-white/20 flex items-center justify-center flex-shrink-0`} style={{ borderRadius: '4px' }}>
                    <Award className={`w-4 h-4 ${getCaptionColor(staff.caption).replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-cream-100 text-sm truncate uppercase tracking-wide">
                      {staff.name}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold ${getCaptionColor(staff.caption)} ${getCaptionColor(staff.caption).replace('bg-', 'border-')}`} style={{ borderRadius: '2px' }}>
                    {staff.caption}
                  </span>
                  <span className="text-xs font-mono text-gold-400 group-hover:text-gold-300">
                    +1%
                  </span>
                  <ChevronRight className="w-4 h-4 text-cream-muted group-hover:text-gold-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-black/40 border border-white/10" style={{ borderRadius: '4px' }}>
            <Users className="w-10 h-10 text-cream-muted mx-auto mb-2" />
            <p className="text-sm font-display font-bold text-cream-muted uppercase mb-1">No Staff Assigned</p>
            <p className="text-xs text-cream-muted mb-4">
              {ownedStaff.length > 0
                ? `${unassignedStaff.length} unassigned staff available`
                : 'Purchase staff to boost scores'}
            </p>
            <Link
              to="/staff"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:border-gold-500/30 text-cream-100 text-xs font-display font-bold uppercase transition-all"
              style={{ borderRadius: '4px' }}
            >
              {ownedStaff.length > 0 ? 'Assign Staff' : 'Browse Marketplace'}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Unassigned Staff Notice */}
        {unassignedStaff.length > 0 && assignedToCorps.length > 0 && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30" style={{ borderRadius: '4px' }}>
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-display font-bold text-blue-400 uppercase">
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

      {/* How Staff Affects Scoring */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 border border-white/10 p-4" style={{ borderRadius: '4px' }}
      >
        <div className="flex items-start gap-3">
          <Trophy className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-display font-bold text-gold-400 uppercase tracking-wide mb-2">How Staff Affects Your Score</p>
            <ul className="text-[11px] text-cream-muted space-y-1 font-mono">
              <li className="flex items-center gap-2">
                <span className="text-gold-400">+1%</span>
                <span>per staff member assigned</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gold-400">+5%</span>
                <span>maximum total bonus</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">CAP</span>
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
                className="bg-charcoal-950/95 backdrop-blur-xl border border-white/10 p-6 w-full max-w-lg shadow-[0_0_40px_rgba(0,0,0,0.8)]"
                style={{
                  borderRadius: '8px',
                  backgroundImage: `
                    linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }}
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gold-500/30">
                  <h3 className="text-lg font-display font-black text-gold-400 uppercase tracking-tight">Staff Details</h3>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="p-2 border border-transparent hover:border-red-500/50 hover:bg-red-500/20 text-cream-muted hover:text-red-400 transition-colors"
                    style={{ borderRadius: '4px' }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Staff Info */}
                  <div className="flex items-start gap-4 p-4 bg-black/40 border border-white/10" style={{ borderRadius: '4px' }}>
                    <div className={`w-12 h-12 ${getCaptionColor(selectedStaff.caption)}/20 border border-white/20 flex items-center justify-center flex-shrink-0`} style={{ borderRadius: '4px' }}>
                      <Award className={`w-6 h-6 ${getCaptionColor(selectedStaff.caption).replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-display font-bold text-cream-100 uppercase tracking-wide mb-1">{selectedStaff.name}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold ${getCaptionColor(selectedStaff.caption)} ${getCaptionColor(selectedStaff.caption).replace('bg-', 'border-')}`} style={{ borderRadius: '2px' }}>
                          {selectedStaff.caption}
                        </span>
                        <span className="text-xs font-mono text-cream-muted">
                          {selectedStaff.yearInducted}
                        </span>
                      </div>
                      {selectedStaff.biography && (
                        <p className="text-xs text-cream-muted">{selectedStaff.biography}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-black/40 border border-white/10" style={{ borderRadius: '4px' }}>
                      <p className="text-[10px] font-display font-bold text-cream-muted uppercase mb-1">Value</p>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-gold-400" />
                        <span className="text-xl font-mono font-bold text-gold-400">
                          {selectedStaff.currentValue || selectedStaff.baseValue || 0}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-black/40 border border-white/10" style={{ borderRadius: '4px' }}>
                      <p className="text-[10px] font-display font-bold text-cream-muted uppercase mb-1">Seasons</p>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-blue-400" />
                        <span className="text-xl font-mono font-bold text-blue-400">
                          {selectedStaff.seasonsCompleted || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Info */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30" style={{ borderRadius: '4px' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-display font-bold text-green-400 uppercase">Currently Assigned</span>
                    </div>
                    <p className="text-xs text-cream-muted mb-3">
                      Boosting <span className="font-mono text-green-400">{getCaptionLabel(selectedStaff.caption)}</span> for{' '}
                      <span className="font-mono text-cream-100">
                        {selectedStaff.assignedTo?.corpsName || formatCorpsClassName(selectedStaff.assignedTo?.corpsClass)}
                      </span>
                    </p>
                    <button
                      onClick={handleUnassign}
                      disabled={assigning}
                      className="w-full py-2 px-4 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition-all disabled:opacity-50 font-display font-bold uppercase text-sm"
                      style={{ borderRadius: '4px' }}
                    >
                      {assigning ? 'Unassigning...' : 'Unassign Staff'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedStaff(null)}
                      className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 hover:border-white/30 text-cream-muted hover:text-cream-100 font-display font-bold uppercase text-sm transition-all"
                      style={{ borderRadius: '4px' }}
                    >
                      Close
                    </button>
                    <button
                      onClick={handleManageInMarketplace}
                      className="flex-1 py-2.5 px-4 bg-gold-500/20 border border-gold-500/40 hover:border-gold-400 text-gold-400 font-display font-bold uppercase text-sm transition-all"
                      style={{ borderRadius: '4px' }}
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
