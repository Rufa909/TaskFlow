import React, { useState } from 'react';
import { useFilters } from '../../context/FiltersContext';

export default function FiltersModal() {
  const { filters, togglePriority, setLabels, isFiltersOpen, setIsFiltersOpen } = useFilters();
  const [labelInput, setLabelInput] = useState('');

  if (!isFiltersOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setIsFiltersOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Filters & Labels</h2>
          <button className="icon-btn" onClick={() => setIsFiltersOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          <div>
            <label>Priorities</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {['low','medium','high'].map((p) => (
                <button key={p} onClick={() => togglePriority(p)} className={filters.priorities.includes(p)?'active':''}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Labels (comma separated)</label>
            <input value={labelInput} onChange={(e)=>setLabelInput(e.target.value)} placeholder="work,personal" />
            <div style={{ marginTop: 8 }}>
              <button onClick={() => { setLabels(labelInput.split(',').map(s=>s.trim()).filter(Boolean)); setIsFiltersOpen(false); }}>Apply</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
