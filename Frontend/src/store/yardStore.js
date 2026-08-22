import { create } from 'zustand';

// Zustand store for 3D Yard Visualization state management
export const useYardStore = create((set, get) => ({
  // Yard Data
  yardLayout: null,
  containers: [],
  blocks: [],
  
  // UI State
  selectedContainer: null,
  hoveredContainer: null,
  selectedTiers: [1, 2, 3],
  viewMode: 'isometric', // 'isometric' | 'top' | 'side' | 'free'
  zoomLevel: 100,
  
  // Filters
  filters: {
    status: ['full', 'empty'],
    size: ['20ft', '40ft'],
    type: ['GP', 'HC'],
    customer: [],
    dateRange: { from: null, to: null },
    blocks: [],
  },
  
  // Search
  searchQuery: '',
  searchResults: [],
  
  // UI Panels
  isFilterPanelOpen: true,
  isStatsPanelOpen: true,
  isSearchOpen: false,
  isDetailsModalOpen: false,
  
  // Loading States
  isLoading: false,
  error: null,
  
  // Actions
  setYardLayout: (layout) => set({ yardLayout: layout }),
  
  setContainers: (containers) => set({ containers }),
  
  setBlocks: (blocks) => set({ blocks }),
  
  selectContainer: (container) => set({ 
    selectedContainer: container,
    isDetailsModalOpen: !!container 
  }),
  
  hoverContainer: (container) => set({ hoveredContainer: container }),
  
  toggleTier: (tier) => set((state) => {
    const tiers = state.selectedTiers.includes(tier)
      ? state.selectedTiers.filter(t => t !== tier)
      : [...state.selectedTiers, tier];
    return { selectedTiers: tiers };
  }),
  
  setSelectedTiers: (tiers) => set({ selectedTiers: tiers }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setZoomLevel: (level) => set({ zoomLevel: level }),
  
  updateFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  clearFilters: () => set({
    filters: {
      status: ['full', 'empty'],
      size: ['20ft', '40ft'],
      type: ['GP', 'HC'],
      customer: [],
      dateRange: { from: null, to: null },
      blocks: [],
    }
  }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSearchResults: (results) => set({ searchResults: results }),
  
  toggleFilterPanel: () => set((state) => ({ 
    isFilterPanelOpen: !state.isFilterPanelOpen 
  })),
  
  toggleStatsPanel: () => set((state) => ({ 
    isStatsPanelOpen: !state.isStatsPanelOpen 
  })),
  
  toggleSearch: () => set((state) => ({ 
    isSearchOpen: !state.isSearchOpen 
  })),
  
  closeDetailsModal: () => set({ 
    isDetailsModalOpen: false,
    selectedContainer: null 
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  // Computed/Helper Functions
  getFilteredContainers: () => {
    const { containers, filters, searchQuery } = get();
    
    let filtered = containers;
    
    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(c => filters.status.includes(c.status));
    }
    
    // Apply size filter
    if (filters.size.length > 0) {
      filtered = filtered.filter(c => filters.size.includes(c.size));
    }
    
    // Apply type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(c => filters.type.includes(c.type));
    }
    
    // Apply customer filter
    if (filters.customer.length > 0) {
      filtered = filtered.filter(c => filters.customer.includes(c.customer));
    }
    
    // Apply block filter
    if (filters.blocks.length > 0) {
      filtered = filtered.filter(c => filters.blocks.includes(c.block));
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.containerNo?.toLowerCase().includes(query) ||
        c.customer?.toLowerCase().includes(query) ||
        c.commodity?.toLowerCase().includes(query) ||
        c.blNumber?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  },
  
  getStats: () => {
    const { containers } = get();
    const filtered = get().getFilteredContainers();
    
    const stats = {
      totalCapacity: containers.length,
      occupied: filtered.filter(c => c.status === 'full').length,
      available: filtered.filter(c => c.status === 'empty').length,
      byStatus: {},
      bySize: {},
      byType: {},
    };
    
    // Count by status
    filtered.forEach(c => {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      stats.bySize[c.size] = (stats.bySize[c.size] || 0) + 1;
      stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
    });
    
    return stats;
  },
}));
