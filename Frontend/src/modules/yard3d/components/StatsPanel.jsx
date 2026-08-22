import React from 'react';
import { BarChart3, X, Plus, FileText, Download, Settings } from 'lucide-react';
import { useYardStore } from '../../../store/yardStore';

const StatsPanel = () => {
  const {
    isStatsPanelOpen,
    toggleStatsPanel,
    getStats,
  } = useYardStore();

  if (!isStatsPanelOpen) {
    return (
      <button
        onClick={toggleStatsPanel}
        className="fixed right-4 top-24 z-40 glass p-3 rounded-lg hover:border-blue-500 transition-all"
        aria-label="Open statistics"
      >
        <BarChart3 size={20} className="text-slate-300" />
      </button>
    );
  }

  const stats = getStats();
  const occupancyPercent = stats.totalCapacity > 0
    ? Math.round((stats.occupied / stats.totalCapacity) * 100)
    : 0;

  return (
    <div className="fixed right-0 top-16 w-96 h-[calc(100vh-64px)] glass border-l border-slate-700 z-40 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-400" />
          <h2 className="font-semibold text-slate-100">Yard Statistics</h2>
        </div>
        <button
          onClick={toggleStatsPanel}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          aria-label="Close statistics"
        >
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Capacity Overview */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Capacity
          </div>
          
          <div className="glass-light rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-300">Occupied</span>
              <span className="font-semibold text-slate-100">
                {stats.occupied} ({occupancyPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
          </div>

          <div className="glass-light rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-300">Available</span>
              <span className="font-semibold text-slate-100">
                {stats.available} ({100 - occupancyPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-600 to-slate-500 transition-all duration-500"
                style={{ width: `${100 - occupancyPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* By Status */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            By Status
          </div>
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const percent = stats.totalCapacity > 0
              ? Math.round((count / stats.totalCapacity) * 100)
              : 0;
            return (
              <StatItem
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                count={count}
                percent={percent}
                color={getStatusColor(status)}
              />
            );
          })}
        </div>

        {/* By Size */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            By Size
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.bySize).map(([size, count]) => (
              <div key={size} className="glass-light rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-100">{count}</div>
                <div className="text-xs text-slate-400 mt-1">{size}</div>
              </div>
            ))}
          </div>
        </div>

        {/* By Type */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            By Type
          </div>
          {Object.entries(stats.byType).map(([type, count]) => {
            const percent = stats.totalCapacity > 0
              ? Math.round((count / stats.totalCapacity) * 100)
              : 0;
            return (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-slate-400 w-12 text-right">{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Quick Actions
          </div>
          <QuickActionButton icon={<Plus size={18} />} label="Add Container" />
          <QuickActionButton icon={<FileText size={18} />} label="Generate Report" />
          <QuickActionButton icon={<Download size={18} />} label="Export Data" />
          <QuickActionButton icon={<Settings size={18} />} label="Yard Settings" />
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, count, percent, color }) => (
  <div className="flex items-center justify-between text-sm">
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-slate-300">{label}</span>
    </div>
    <span className="text-slate-100 font-medium">
      {count} ({percent}%)
    </span>
  </div>
);

const QuickActionButton = ({ icon, label }) => (
  <button className="w-full flex items-center gap-3 px-4 py-3 glass-light rounded-lg hover:bg-blue-500/10 hover:border-blue-500/30 transition-all">
    <div className="text-blue-400">{icon}</div>
    <span className="text-slate-300 text-sm">{label}</span>
  </button>
);

const getStatusColor = (status) => {
  const colors = {
    full: '#10B981',
    empty: '#6B7280',
    damaged: '#EF4444',
    hold: '#F59E0B',
    export: '#3B82F6',
    import: '#8B5CF6',
  };
  return colors[status] || '#6B7280';
};

export default StatsPanel;
