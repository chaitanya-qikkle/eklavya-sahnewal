import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, HelpCircle } from 'lucide-react';
import { useYardStore } from '../../../store/yardStore';

const TierControlBar = () => {
  const {
    selectedTiers,
    toggleTier,
    setSelectedTiers,
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel,
  } = useYardStore();

  const tiers = [1, 2, 3];
  const viewModes = [
    { value: 'isometric', label: 'Isometric' },
    { value: 'top', label: 'Top View' },
    { value: 'side', label: 'Side View' },
    { value: 'free', label: 'Free' },
  ];

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 10, 50));
  };

  const handleReset = () => {
    setZoomLevel(100);
    setViewMode('isometric');
  };

  const handleAllTiers = () => {
    if (selectedTiers.length === 3) {
      setSelectedTiers([1]); // Show only tier 1
    } else {
      setSelectedTiers([1, 2, 3]); // Show all
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-28 glass border-t border-slate-700 z-30">
      <div className="h-full px-8 flex flex-col justify-center gap-4">
        {/* Tier Selection */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide min-w-32">
            Tier Selection:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => toggleTier(0)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTiers.includes(0)
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Ground
            </button>
            {tiers.map(tier => (
              <button
                key={tier}
                onClick={() => toggleTier(tier)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedTiers.includes(tier)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tier {tier}
              </button>
            ))}
            <button
              onClick={handleAllTiers}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all"
            >
              {selectedTiers.length === 3 ? 'Hide All' : 'All Tiers'}
            </button>
          </div>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide min-w-32">
            View Mode:
          </span>
          <div className="flex gap-2">
            {viewModes.map(mode => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === mode.value
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-slate-400">Zoom:</span>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={18} className="text-slate-300" />
            </button>
            <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                style={{ width: `${(zoomLevel - 50) / 1.5}%` }}
              />
            </div>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={18} className="text-slate-300" />
            </button>
            <span className="text-sm text-slate-400 min-w-12 text-right">
              {zoomLevel}%
            </span>
          </div>

          {/* Reset & Help */}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Reset view"
              title="Reset View"
            >
              <RotateCcw size={18} className="text-slate-300" />
            </button>
            <button
              className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Help"
              title="Help"
            >
              <HelpCircle size={18} className="text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierControlBar;
