// =============================================================================
// INSPECTOR PANEL COMPONENT
// =============================================================================
// Context-sensitive detail panel that shows information based on user selection.
// Implements the Master-Detail pattern - when a user selects an item in the
// main content area, this panel populates with relevant details.
//
// Design Philosophy:
// - High information density
// - No navigation required - details appear immediately
// - Radar charts for multi-dimensional data (GE, Visual, Music)
// - Sparklines for historical trends

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Music,
  Eye,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  DollarSign,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { BentoBox } from './BentoBox';

// =============================================================================
// INSPECTOR CONTEXT
// =============================================================================
// Allows any component in the app to push content to the Inspector panel

const InspectorContext = createContext(null);

export const useInspector = () => {
  const context = useContext(InspectorContext);
  if (!context) {
    throw new Error('useInspector must be used within an InspectorProvider');
  }
  return context;
};

export const InspectorProvider = ({ children }) => {
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorType, setInspectorType] = useState(null);

  const openInspector = useCallback((type, data) => {
    setInspectorType(type);
    setInspectorData(data);
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorType(null);
    setInspectorData(null);
  }, []);

  return (
    <InspectorContext.Provider value={{ inspectorData, inspectorType, openInspector, closeInspector }}>
      {children}
    </InspectorContext.Provider>
  );
};

// =============================================================================
// SCORE BREAKDOWN RADAR (Simplified SVG)
// =============================================================================

const ScoreRadar = ({ scores = {} }) => {
  const { ge = 0, visual = 0, music = 0 } = scores;

  // Normalize to 0-100 scale (assuming max is ~40 for GE, ~30 for others)
  const geNorm = (ge / 40) * 100;
  const visNorm = (visual / 30) * 100;
  const musNorm = (music / 30) * 100;

  // Calculate radar points (equilateral triangle)
  const cx = 60, cy = 60, r = 45;
  const points = [
    { x: cx, y: cy - r * (geNorm / 100) }, // Top (GE)
    { x: cx + r * 0.866 * (visNorm / 100), y: cy + r * 0.5 * (visNorm / 100) }, // Bottom right (Visual)
    { x: cx - r * 0.866 * (musNorm / 100), y: cy + r * 0.5 * (musNorm / 100) }, // Bottom left (Music)
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120" className="overflow-visible">
        {/* Background grid */}
        <polygon
          points={`${cx},${cy - r} ${cx + r * 0.866},${cy + r * 0.5} ${cx - r * 0.866},${cy + r * 0.5}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <polygon
          points={`${cx},${cy - r * 0.66} ${cx + r * 0.866 * 0.66},${cy + r * 0.5 * 0.66} ${cx - r * 0.866 * 0.66},${cy + r * 0.5 * 0.66}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
        <polygon
          points={`${cx},${cy - r * 0.33} ${cx + r * 0.866 * 0.33},${cy + r * 0.5 * 0.33} ${cx - r * 0.866 * 0.33},${cy + r * 0.5 * 0.33}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />

        {/* Data polygon */}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="rgba(250, 204, 21, 0.2)"
          stroke="rgba(250, 204, 21, 0.8)"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#FACC15" />
        ))}

        {/* Labels */}
        <text x={cx} y={8} textAnchor="middle" className="fill-purple-400 text-[10px] font-bold">
          GE
        </text>
        <text x={cx + r + 10} y={cy + r * 0.5 + 5} textAnchor="start" className="fill-green-400 text-[10px] font-bold">
          VIS
        </text>
        <text x={cx - r - 10} y={cy + r * 0.5 + 5} textAnchor="end" className="fill-blue-400 text-[10px] font-bold">
          MUS
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-cream/60">GE: {ge.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3 text-green-400" />
          <span className="text-cream/60">Vis: {visual.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Music className="w-3 h-3 text-blue-400" />
          <span className="text-cream/60">Mus: {music.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SPARKLINE COMPONENT
// =============================================================================

const Sparkline = ({ data = [], color = '#FACC15', width = 80, height = 24 }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const trend = data[data.length - 1] - data[0];

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End point dot */}
        <circle
          cx={(data.length - 1) / (data.length - 1) * width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="2"
          fill={color}
        />
      </svg>
      {trend !== 0 && (
        <span className={`text-[10px] font-mono ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? '+' : ''}{trend.toFixed(2)}
        </span>
      )}
    </div>
  );
};

// =============================================================================
// STAT ROW COMPONENT
// =============================================================================

const StatRow = ({ label, value, icon: Icon, color = 'gold', trend }) => {
  const colorClasses = {
    gold: 'text-gold-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${colorClasses[color]} opacity-60`} />}
        <span className="text-xs text-cream/60">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-mono font-bold ${colorClasses[color]} tabular-nums`}>
          {value}
        </span>
        {trend !== undefined && (
          trend > 0 ? (
            <TrendingUp className="w-3 h-3 text-green-400" />
          ) : trend < 0 ? (
            <TrendingDown className="w-3 h-3 text-red-400" />
          ) : null
        )}
      </div>
    </div>
  );
};

// =============================================================================
// CORPS INSPECTOR VIEW
// =============================================================================

const CorpsInspectorView = ({ data }) => {
  if (!data) return null;

  const {
    name = 'Unknown Corps',
    rank = '-',
    totalScore = 0,
    ge = 0,
    visual = 0,
    music = 0,
    history = [],
    showName = '',
    location = '',
  } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-display font-bold uppercase text-gold-400">
          {name}
        </h2>
        <p className="text-xs text-cream/50">{showName}</p>
        {location && <p className="text-xs text-cream/40">{location}</p>}
      </div>

      {/* Rank & Score */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center px-4 py-2 bg-gold-400/10 rounded-lg border border-gold-400/20">
          <span className="text-[10px] uppercase text-gold-400/60">Rank</span>
          <span className="text-2xl font-mono font-bold text-gold-400">#{rank}</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-lg">
          <span className="text-[10px] uppercase text-cream/40">Total</span>
          <span className="text-2xl font-mono font-bold text-cream">{totalScore.toFixed(3)}</span>
        </div>
      </div>

      {/* Score Radar */}
      <div className="flex justify-center py-2">
        <ScoreRadar scores={{ ge, visual, music }} />
      </div>

      {/* Trend Sparkline */}
      {history.length > 1 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-cream/40">Score Trend</span>
          <Sparkline data={history} width={180} height={32} />
        </div>
      )}

      {/* Detailed Stats */}
      <div className="flex flex-col">
        <StatRow label="General Effect" value={ge.toFixed(2)} icon={Sparkles} color="purple" />
        <StatRow label="Visual" value={visual.toFixed(2)} icon={Eye} color="green" />
        <StatRow label="Music" value={music.toFixed(2)} icon={Music} color="blue" />
      </div>
    </div>
  );
};

// =============================================================================
// MEMBER INSPECTOR VIEW
// =============================================================================

const MemberInspectorView = ({ data }) => {
  if (!data) return null;

  const {
    name = 'Unknown Member',
    section = '',
    position = '',
    stats = {},
    salary = 0,
    contractExpires = '',
  } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-charcoal-800 flex items-center justify-center">
          <User className="w-6 h-6 text-cream/40" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-display font-bold uppercase text-cream">
            {name}
          </h2>
          <p className="text-xs text-gold-400">{section} • {position}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col">
        <StatRow label="Marching" value={stats.marching ?? '-'} icon={BarChart3} color="green" />
        <StatRow label="Musicianship" value={stats.music ?? '-'} icon={Music} color="blue" />
        <StatRow label="Technique" value={stats.technique ?? '-'} icon={Award} color="purple" />
        <StatRow label="Stamina" value={stats.stamina ?? '-'} icon={TrendingUp} color="gold" />
      </div>

      {/* Contract Info */}
      <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs text-cream/40 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Salary
          </span>
          <span className="text-sm font-mono font-bold text-gold-400">
            ${salary.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-cream/40 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Contract Ends
          </span>
          <span className="text-xs font-mono text-cream/60">
            {contractExpires}
          </span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// EMPTY INSPECTOR STATE
// =============================================================================

const EmptyInspectorState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
      <ChevronRight className="w-6 h-6 text-cream/20" />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-sm text-cream/40">No Selection</p>
      <p className="text-xs text-cream/20">
        Select an item to view details
      </p>
    </div>
  </div>
);

// =============================================================================
// INSPECTOR PANEL COMPONENT
// =============================================================================

const InspectorPanel = ({ className = '' }) => {
  const { inspectorData, inspectorType, closeInspector } = useInspector();

  const renderContent = () => {
    if (!inspectorType || !inspectorData) {
      return <EmptyInspectorState />;
    }

    switch (inspectorType) {
      case 'corps':
        return <CorpsInspectorView data={inspectorData} />;
      case 'member':
        return <MemberInspectorView data={inspectorData} />;
      default:
        return <EmptyInspectorState />;
    }
  };

  return (
    <BentoBox
      title="Inspector"
      subtitle={inspectorType ? inspectorType.toUpperCase() : 'SELECT'}
      variant="default"
      scrollable
      className={className}
      actions={
        inspectorData && (
          <button
            onClick={closeInspector}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-cream/40" />
          </button>
        )
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={inspectorType || 'empty'}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </BentoBox>
  );
};

export default InspectorPanel;
