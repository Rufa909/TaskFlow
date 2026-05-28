import { useEffect, useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import Icon from '../common/Icon';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './FiltersModal.css';

const FILTER_COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const EMPTY_CRITERIA = { priorities: [], labels: [], deadlines: [], dateRange: { start: null, end: null } };

export default function FiltersModal() {
  const {
    availableLabels,
    isFiltersOpen,
    editingSavedFilter,
    closeFilterModal,
    saveSavedFilter,
  } = useFilters();
  const [filterName, setFilterName] = useState('');
  const [filterColor, setFilterColor] = useState(FILTER_COLOR_OPTIONS[4]);
  const [draftCriteria, setDraftCriteria] = useState(EMPTY_CRITERIA);

  const deadlineFilters = [
    { value: 'today', label: 'Today', icon: 'calendar' },
    { value: 'tomorrow', label: 'Tomorrow', icon: 'calendar' },
    { value: 'week', label: 'This week', icon: 'calendar' },
    { value: 'no_deadline', label: 'No Deadline', icon: 'calendar' },
  ];

  useEffect(() => {
    if (!isFiltersOpen) return;

    setFilterName(editingSavedFilter?.name || '');
    setFilterColor(editingSavedFilter?.color || FILTER_COLOR_OPTIONS[4]);
    setDraftCriteria(editingSavedFilter?.criteria || EMPTY_CRITERIA);
  }, [editingSavedFilter, isFiltersOpen]);

  const toggleDraftValue = (group, value) => {
    setDraftCriteria((prev) => {
      const exists = prev[group].includes(value);
      return {
        ...prev,
        [group]: exists
          ? prev[group].filter((item) => item !== value)
          : [...prev[group], value],
      };
    });
  };

  const activeCount =
    draftCriteria.priorities.length +
    draftCriteria.labels.length +
    draftCriteria.deadlines.length +
    ((draftCriteria.dateRange?.start || draftCriteria.dateRange?.end) ? 1 : 0);

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = filterName.trim();

    if (!name || activeCount === 0) return;

    saveSavedFilter({
      id: editingSavedFilter?.id,
      name,
      color: filterColor,
      criteria: draftCriteria,
    });
  };

  if (!isFiltersOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeFilterModal}>
      <form className="filters-modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="filters-modal-header">
          <h2>{editingSavedFilter ? 'Edit filter' : 'Add filter'}</h2>
          <button 
            className="filters-modal-close" 
            type="button"
            onClick={closeFilterModal}
            aria-label="Close filters"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="filters-modal-body">
          <div className="filters-section">
            <h3 className="filters-section-title">Filter name</h3>
            <input
              className="filters-label-input"
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
              placeholder="Filter name"
              autoFocus
            />
          </div>

          <div className="filters-section">
            <h3 className="filters-section-title">Color</h3>
            <div className="label-color-grid">
              {FILTER_COLOR_OPTIONS.map((color) => (
                <button
                  className={`label-color-option ${filterColor === color ? 'active' : ''}`}
                  key={color}
                  type="button"
                  onClick={() => setFilterColor(color)}
                  style={{ backgroundColor: color }}
                  aria-label={`Choose color ${color}`}
                >
                  {filterColor === color && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-section">
            <h3 className="filters-section-title">Deadline</h3>
            <div className="filters-priority-group">
              {deadlineFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleDraftValue('deadlines', item.value)}
                  className={`filters-priority-btn deadline-filter ${draftCriteria.deadlines.includes(item.value) ? 'active' : ''}`}
                  title={`Filter by ${item.label.toLowerCase()} deadline`}
                >
                  <Icon name={item.icon} size={14} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="filters-date-range-container" style={{ marginTop: '12px' }}>
              <DatePicker
                selectsRange={true}
                startDate={draftCriteria.dateRange?.start}
                endDate={draftCriteria.dateRange?.end}
                onChange={(update) => {
                  setDraftCriteria((prev) => ({
                    ...prev,
                    dateRange: { start: update[0], end: update[1] },
                  }));
                }}
                placeholderText="Select continuous date range"
                isClearable={true}
                className="filters-label-input"
              />
            </div>
          </div>

          <div className="filters-section">
            <h3 className="filters-section-title">Labels</h3>
            {availableLabels.length > 0 ? (
              <div className="filters-label-chips">
                {availableLabels.map((label) => (
                  <button
                    key={label.name}
                    type="button"
                    onClick={() => toggleDraftValue('labels', label.name)}
                    className={`filters-label-chip ${draftCriteria.labels.includes(label.name) ? 'active' : ''}`}
                    style={draftCriteria.labels.includes(label.name) ? { backgroundColor: label.color, borderColor: label.color } : undefined}
                    title={`Filter by ${label.name}`}
                  >
                    <Icon name="tag" size={13} />
                    {label.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="filters-empty-text">Create labels first to filter by label.</p>
            )}
          </div>

          {/* Priority Filters */}
          <div className="filters-section">
            <h3 className="filters-section-title">Priority</h3>
            <div className="filters-priority-group">
              {['urgent', 'high', 'medium', 'low'].map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => toggleDraftValue('priorities', priority)}
                  className={`filters-priority-btn priority-${priority} ${draftCriteria.priorities.includes(priority) ? 'active' : ''}`}
                  title={`Filter by ${priority} priority`}
                >
                  <Icon name="flag" size={14} />
                  <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeCount > 0 && (
            <div className="filters-summary">
              <p className="filters-summary-text">
                <strong>{activeCount}</strong> condition{activeCount !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>

        <div className="filters-modal-footer">
          <button
            type="button"
            onClick={closeFilterModal}
            className="filters-clear-btn"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="filters-apply-btn"
            disabled={!filterName.trim() || activeCount === 0}
          >
            {editingSavedFilter ? 'Save filter' : 'Add filter'}
          </button>
        </div>
      </form>
    </div>
  );
}
