import React, { useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import Icon from '../common/Icon';
import './FiltersModal.css';

export default function FiltersModal() {
  const { filters, togglePriority, toggleLabel, setLabels, clearFilters, hasActiveFilters, isFiltersOpen, setIsFiltersOpen } = useFilters();
  const [newLabelInput, setNewLabelInput] = useState('');
  const [commonLabels] = useState(['work', 'personal', 'shopping', 'urgent', 'review']);

  if (!isFiltersOpen) return null;

  const handleAddLabel = () => {
    if (newLabelInput.trim() && !filters.labels.includes(newLabelInput.trim())) {
      toggleLabel(newLabelInput.trim());
      setNewLabelInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddLabel();
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setIsFiltersOpen(false)}>
      <div className="filters-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="filters-modal-header">
          <h2>Filters & Labels</h2>
          <button 
            className="filters-modal-close" 
            onClick={() => setIsFiltersOpen(false)}
            aria-label="Close filters"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="filters-modal-body">
          {/* Priority Filters */}
          <div className="filters-section">
            <h3 className="filters-section-title">Priority</h3>
            <div className="filters-priority-group">
              {['low', 'medium', 'high'].map((priority) => (
                <button
                  key={priority}
                  onClick={() => togglePriority(priority)}
                  className={`filters-priority-btn priority-${priority} ${filters.priorities.includes(priority) ? 'active' : ''}`}
                  title={`Filter by ${priority} priority`}
                >
                  <Icon name="flag" size={14} />
                  <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Label Filters */}
          <div className="filters-section">
            <h3 className="filters-section-title">Labels</h3>
            
            <div className="filters-label-input-group">
              <input
                type="text"
                placeholder="Add custom label..."
                value={newLabelInput}
                onChange={(e) => setNewLabelInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="filters-label-input"
              />
              <button
                onClick={handleAddLabel}
                className="filters-label-add-btn"
                disabled={!newLabelInput.trim()}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>

            {/* Selected Labels */}
            {filters.labels.length > 0 && (
              <div className="filters-selected-labels">
                <p className="filters-selected-title">Selected Labels</p>
                <div className="filters-label-badges">
                  {filters.labels.map((label) => (
                    <button
                      key={label}
                      onClick={() => toggleLabel(label)}
                      className="filters-label-badge"
                      title="Click to remove"
                    >
                      <Icon name="hash" size={12} />
                      {label}
                      <Icon name="x" size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Common Labels */}
            <div className="filters-common-labels">
              <p className="filters-common-title">Common Labels</p>
              <div className="filters-label-chips">
                {commonLabels.map((label) => (
                  <button
                    key={label}
                    onClick={() => toggleLabel(label)}
                    className={`filters-label-chip ${filters.labels.includes(label) ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="filters-summary">
              <p className="filters-summary-text">
                <strong>{filters.priorities.length + filters.labels.length}</strong> filter{filters.priorities.length + filters.labels.length !== 1 ? 's' : ''} active
              </p>
            </div>
          )}
        </div>

        <div className="filters-modal-footer">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="filters-clear-btn"
            >
              <Icon name="x" size={14} />
              Clear All Filters
            </button>
          )}
          <button
            onClick={() => setIsFiltersOpen(false)}
            className="filters-apply-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
