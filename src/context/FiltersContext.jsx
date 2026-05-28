import React, { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();
const SAVED_FILTERS_STORAGE_KEY = 'taskflow.savedFilters';

function getSavedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_FILTERS_STORAGE_KEY) || '[]');
    return Array.isArray(saved)
      ? saved.map((filter) => ({
          id: filter.id || `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: filter.name || 'Untitled filter',
          color: filter.color || '#14b8a6',
          criteria: {
            priorities: Array.isArray(filter.criteria?.priorities) ? filter.criteria.priorities : [],
            labels: Array.isArray(filter.criteria?.labels) ? filter.criteria.labels : [],
            deadlines: Array.isArray(filter.criteria?.deadlines) ? filter.criteria.deadlines : [],
            dateRange: filter.criteria?.dateRange || { start: null, end: null },
          },
        }))
      : [];
  } catch {
    return [];
  }
}

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({ priorities: [], labels: [], deadlines: [], dateRange: { start: null, end: null } });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [availableLabels, setAvailableLabels] = useState([]);
  const [savedFilters, setSavedFilters] = useState(getSavedFilters);
  const [editingSavedFilter, setEditingSavedFilter] = useState(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState(null);

  const persistSavedFilters = (nextFilters) => {
    setSavedFilters(nextFilters);
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(nextFilters));
  };

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

  const toggleDeadline = (deadline) => {
    setFilters((prev) => {
      const exists = prev.deadlines.includes(deadline);
      return {
        ...prev,
        deadlines: exists
          ? prev.deadlines.filter(item => item !== deadline)
          : [...prev.deadlines, deadline],
      };
    });
  };

  const setLabels = (labels) => {
    setFilters((prev) => ({ ...prev, labels }));
  };

  const setDateRange = (dateRange) => {
    setFilters((prev) => ({ ...prev, dateRange }));
  };

  const clearFilters = () => {
    setFilters({ priorities: [], labels: [], deadlines: [], dateRange: { start: null, end: null } });
    setActiveSavedFilterId(null);
  };

  const hasActiveFilters = filters.priorities.length > 0 || filters.labels.length > 0 || filters.deadlines.length > 0 || filters.dateRange.start !== null || filters.dateRange.end !== null;

  const openFilterModal = (filter = null) => {
    setEditingSavedFilter(filter);
    setIsFiltersOpen(true);
  };

  const closeFilterModal = () => {
    setEditingSavedFilter(null);
    setIsFiltersOpen(false);
  };

  const applySavedFilter = (filter) => {
    setFilters(filter.criteria);
    setActiveSavedFilterId(filter.id);
  };

  const saveSavedFilter = (filter) => {
    const nextFilter = {
      ...filter,
      id: filter.id || `filter-${Date.now()}`,
    };
    const exists = savedFilters.some((item) => item.id === nextFilter.id);
    const nextFilters = exists
      ? savedFilters.map((item) => (item.id === nextFilter.id ? nextFilter : item))
      : [...savedFilters, nextFilter];

    persistSavedFilters(nextFilters);
    applySavedFilter(nextFilter);
    closeFilterModal();
  };

  const deleteSavedFilter = (filterId) => {
    persistSavedFilters(savedFilters.filter((item) => item.id !== filterId));
    if (activeSavedFilterId === filterId) {
      clearFilters();
    }
  };

  const renameLabelInSavedFilters = (oldLabel, newLabel) => {
    persistSavedFilters(
      savedFilters.map((filter) => ({
        ...filter,
        criteria: {
          ...filter.criteria,
          labels: filter.criteria.labels.map((label) =>
            label.toLowerCase() === oldLabel.toLowerCase() ? newLabel : label,
          ),
        },
      })),
    );
  };

  const removeLabelFromSavedFilters = (labelToRemove) => {
    persistSavedFilters(
      savedFilters.map((filter) => ({
        ...filter,
        criteria: {
          ...filter.criteria,
          labels: filter.criteria.labels.filter(
            (label) => label.toLowerCase() !== labelToRemove.toLowerCase(),
          ),
        },
      })),
    );
  };

  return (
    <FiltersContext.Provider value={{ 
      filters, 
      setFilters, 
      togglePriority, 
      toggleLabel,
      toggleDeadline,
      setLabels,
      setDateRange,
      clearFilters,
      hasActiveFilters,
      availableLabels,
      setAvailableLabels,
      savedFilters,
      activeSavedFilterId,
      editingSavedFilter,
      openFilterModal,
      closeFilterModal,
      applySavedFilter,
      saveSavedFilter,
      deleteSavedFilter,
      renameLabelInSavedFilters,
      removeLabelFromSavedFilters,
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
