import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useYardStore } from '../../../store/yardStore';

const SearchBar = () => {
  const {
    searchQuery,
    setSearchQuery,
    containers,
    selectContainer,
  } = useYardStore();

  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    // Keyboard shortcut: Ctrl/Cmd + K
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      const filtered = containers.filter(c =>
        c.containerNo?.toLowerCase().includes(query) ||
        c.customer?.toLowerCase().includes(query) ||
        c.commodity?.toLowerCase().includes(query) ||
        c.blNumber?.toLowerCase().includes(query)
      ).slice(0, 10);
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [searchQuery, containers]);

  const handleResultClick = (container) => {
    selectContainer(container);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 glass px-6 py-3 rounded-xl flex items-center gap-3 hover:border-blue-500 transition-all"
      >
        <Search size={20} className="text-slate-400" />
        <span className="text-slate-300">Search containers...</span>
        <kbd className="px-2 py-1 text-xs bg-slate-700 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className="glass rounded-xl slide-down">
        {/* Search Input */}
        <div className="relative">
          <Search size={20} className="absolute left-4 top-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by container number, customer, commodity..."
            className="w-full pl-12 pr-12 py-4 bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="border-t border-slate-700 max-h-96 overflow-y-auto custom-scrollbar">
            <div className="p-2">
              <div className="text-xs text-slate-400 px-3 py-2">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((container) => (
                <button
                  key={container.containerId}
                  onClick={() => handleResultClick(container)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📦</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-slate-100">
                        {container.containerNo}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Block {container.block}, Row {container.row}, Slot {container.slot}, Tier {container.tier}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className={`status-badge ${container.status}`}>
                          {container.status}
                        </span>
                        <span className="text-slate-500">
                          {container.size} {container.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {searchQuery.length >= 2 && results.length === 0 && (
          <div className="border-t border-slate-700 p-8 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-slate-400">No containers found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search query
            </p>
          </div>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
};

export default SearchBar;
