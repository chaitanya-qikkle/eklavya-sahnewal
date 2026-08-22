import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useYardStore } from '../../../store/yardStore';

const FilterPanel = () => {
  const {
    isFilterPanelOpen,
    toggleFilterPanel,
    filters,
    updateFilters,
    clearFilters,
    getFilteredContainers,
    containers,
  } = useYardStore();

  const [expandedSections, setExpandedSections] = useState({
    status: true,
    size: true,
    type: true,
    customer: false,
    blocks: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleStatusChange = (status) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilters({ status: newStatus });
  };

  const handleSizeChange = (size) => {
    const newSize = filters.size.includes(size)
      ? filters.size.filter(s => s !== size)
      : [...filters.size, size];
    updateFilters({ size: newSize });
  };

  const handleTypeChange = (type) => {
    const newType = filters.type.includes(type)
      ? filters.type.filter(t => t !== type)
      : [...filters.type, type];
    updateFilters({ type: newType });
  };

  // Count containers by category
  const getCounts = () => {
    const counts = {
      status: {},
      size: {},
      type: {},
    };

    containers.forEach(c => {
      counts.status[c.status] = (counts.status[c.status] || 0) + 1;
      counts.size[c.size] = (counts.size[c.size] || 0) + 1;
      counts.type[c.type] = (counts.type[c.type] || 0) + 1;
    });

    return counts;
  };

  const counts = getCounts();
  const filteredCount = getFilteredContainers().length;
  const totalCount = containers.length;

  if (!isFilterPanelOpen) {
    return (
      <button
        onClick={toggleFilterPanel}
        className="fixed left-4 top-24 z-40 glass p-3 rounded-lg hover:border-blue-500 transition-all"
        aria-label="Open filters"
      >
        <Filter size={20} className="text-slate-300" />
      </button>
    );
  }

  return (
    <div className="fixed left-0 top-16 w-80 h-[calc(100vh-64px)] glass border-r border-slate-700 z-40 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-blue-400" />
          <h2 className="font-semibold text-slate-100">Filters</h2>
        </div>
        <button
          onClick={toggleFilterPanel}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          aria-label="Close filters"
        >
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Filter */}
        <FilterSection
          title="Status"
          isExpanded={expandedSections.status}
          onToggle={() => toggleSection('status')}
        >
          {['full', 'empty', 'damaged', 'hold', 'export', 'import'].map(status => (
            <FilterCheckbox
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              checked={filters.status.includes(status)}
              onChange={() => handleStatusChange(status)}
              count={counts.status[status] || 0}
            />
          ))}
        </FilterSection>

        {/* Size Filter */}
        <FilterSection
          title="Size"
          isExpanded={expandedSections.size}
          onToggle={() => toggleSection('size')}
        >
          {['20ft', '40ft', '45ft'].map(size => (
            <FilterCheckbox
              key={size}
              label={size}
              checked={filters.size.includes(size)}
              onChange={() => handleSizeChange(size)}
              count={counts.size[size] || 0}
            />
          ))}
        </FilterSection>

        {/* Type Filter */}
        <FilterSection
          title="Type"
          isExpanded={expandedSections.type}
          onToggle={() => toggleSection('type')}
        >
          {[
            { value: 'GP', label: 'GP - General Purpose' },
            { value: 'HC', label: 'HC - High Cube' },
            { value: 'RF', label: 'RF - Reefer' },
            { value: 'OT', label: 'OT - Open Top' },
          ].map(type => (
            <FilterCheckbox
              key={type.value}
              label={type.label}
              checked={filters.type.includes(type.value)}
              onChange={() => handleTypeChange(type.value)}
              count={counts.type[type.value] || 0}
            />
          ))}
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur-sm p-4 border-t border-slate-700">
        <div className="text-sm text-slate-400 mb-3">
          Showing {filteredCount} of {totalCount} containers
        </div>
        <button
          onClick={clearFilters}
          className="w-full btn-secondary text-sm"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
};

const FilterSection = ({ title, isExpanded, onToggle, children }) => (
  <div className="border border-slate-700 rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
    >
      <span className="font-medium text-slate-200 text-sm uppercase tracking-wide">
        {title}
      </span>
      {isExpanded ? (
        <ChevronUp size={16} className="text-slate-400" />
      ) : (
        <ChevronDown size={16} className="text-slate-400" />
      )}
    </button>
    {isExpanded && (
      <div className="p-3 space-y-2">
        {children}
      </div>
    )}
  </div>
);

const FilterCheckbox = ({ label, checked, onChange, count }) => (
  <label className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors">
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </div>
    <span className="text-xs text-slate-500">({count})</span>
  </label>
);

export default FilterPanel;
