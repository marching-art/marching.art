// Shared Admin panel UI primitives. Extracted from pages/Admin.jsx.

import { CheckCircle, RefreshCw, Terminal } from 'lucide-react';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'season', label: 'Season Ops' },
  { id: 'livescores', label: 'Live Scores' },
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Content' },
  { id: 'jobs', label: 'Jobs' },
];

const TelemetryStrip = ({ stats }) => (
  <div className="bg-[#1a1a1a] border-b border-[#333]">
    <div className="flex items-center divide-x divide-[#333]">
      <TelemetryStat label="Users" value={stats.totalUsers.toLocaleString()} />
      <TelemetryStat
        label="Active (7d)"
        value={stats.activeUsers.toLocaleString()}
        color="text-green-500"
      />
      <TelemetryStat
        label="Corps"
        value={stats.totalCorps.toLocaleString()}
        color="text-[#0057B8]"
      />
      <TelemetryStat label="System" value="ONLINE" color="text-green-500" icon={CheckCircle} />
    </div>
  </div>
);

const TelemetryStat = ({ label, value, color = 'text-white', icon: Icon }) => (
  <div className="flex items-center gap-3 px-4 py-2">
    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}:</span>
    <span className={`text-sm font-bold font-data tabular-nums ${color} flex items-center gap-1`}>
      {Icon && <Icon className="w-3 h-3" />}
      {value}
    </span>
  </div>
);

// =============================================================================
// NAVIGATION TABS (Segmented Control)
// =============================================================================

const NavTabs = ({ activeTab, onTabChange }) => (
  <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-2">
    <div className="flex items-center gap-1">
      {ADMIN_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-none transition-colors ${
            activeTab === tab.id
              ? 'bg-[#0057B8] text-white'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

// =============================================================================
// PROCESS TABLE ROW
// =============================================================================

const ProcessRow = ({ name, description, icon: Icon, loading, onExecute }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] hover:bg-[#111] transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[11px] text-gray-500 truncate">{description}</p>
      </div>
    </div>
    <button
      onClick={onExecute}
      disabled={loading}
      className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/20 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
      {loading ? 'Running' : 'Execute'}
    </button>
  </div>
);

// =============================================================================
// SECTION HEADER
// =============================================================================

const SectionHeader = ({ title, icon: Icon }) => (
  <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center gap-2">
    {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</h3>
  </div>
);

// =============================================================================
// INFO ROW (for data display)
// =============================================================================

const InfoRow = ({ label, value, badge, mono }) => (
  <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#222] last:border-b-0">
    <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
    {badge ? (
      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-bold uppercase">
        {value}
      </span>
    ) : (
      <span className={`text-sm text-white ${mono ? 'font-data tabular-nums' : 'font-medium'}`}>
        {value || '—'}
      </span>
    )}
  </div>
);

// =============================================================================
// OVERVIEW TAB
// =============================================================================

export { TelemetryStrip, TelemetryStat, NavTabs, ProcessRow, SectionHeader, InfoRow };
