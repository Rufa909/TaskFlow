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

  const setLabels = (labels) => {
    setFilters((prev) => ({ ...prev, labels }));
  };

  return (
    <FiltersContext.Provider value={{ filters, setFilters, togglePriority, setLabels, isFiltersOpen, setIsFiltersOpen }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  return useContext(FiltersContext);
}
