import React, { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({ priorities: [], labels: [] });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const togglePriority = (prio) => {
    setFilters((prev) => {
      const exists = prev.priorities.includes(prio);
      return { ...prev, priorities: exists ? prev.priorities.filter(p => p !== prio) : [...prev.priorities, prio] };
    });
  };

  const toggleLabel = (label) => {
    setFilters((prev) => {
      const exists = prev.labels.includes(label);
      return { ...prev, labels: exists ? prev.labels.filter(l => l !== label) : [...prev.labels, label] };
    });
  };

  const setLabels = (labels) => {
    setFilters((prev) => ({ ...prev, labels }));
  };

  const clearFilters = () => {
    setFilters({ priorities: [], labels: [] });
  };

  const hasActiveFilters = filters.priorities.length > 0 || filters.labels.length > 0;

  return (
    <FiltersContext.Provider value={{ 
      filters, 
      setFilters, 
      togglePriority, 
      toggleLabel,
      setLabels, 
      clearFilters,
      hasActiveFilters,
      isFiltersOpen, 
      setIsFiltersOpen 
    }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  return useContext(FiltersContext);
}
