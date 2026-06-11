import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import './CustomizeWorkflowModal.css';

const CustomizeWorkflowModal = ({ isOpen, onClose, onSave, loading = false }) => {
  const [stages, setStages] = useState([
    { order: 1, name: 'Analyst & Planning', description: 'Requirement analysis & planning phase' },
    { order: 2, name: 'Development', description: 'Implementation & coding phase' },
    { order: 3, name: 'Testing', description: 'QA & testing phase' },
    { order: 4, name: 'Deployment & Maintenance', description: 'Release to production' }
  ]);

  const handleAddStage = () => {
    const newOrder = Math.max(...stages.map(s => s.order), 0) + 1;
    setStages([...stages, { order: newOrder, name: '', description: '' }]);
  };

  const handleRemoveStage = (index) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const handleStageChange = (index, field, value) => {
    const updated = [...stages];
    updated[index][field] = value;
    setStages(updated);
  };

  const handleMoveStage = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === stages.length - 1)
    ) {
      return;
    }

    const updated = [...stages];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Update order numbers
    updated.forEach((stage, i) => {
      stage.order = i + 1;
    });

    setStages(updated);
  };

  const handleSave = () => {
    const validStages = stages.filter(s => s.name && s.name.trim());
    if (validStages.length === 0) {
      alert('Please add at least one workflow stage');
      return;
    }
    onSave(validStages);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay customize-workflow-overlay" onClick={onClose}>
      <div 
        className="modal-content customize-workflow-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header customize-workflow-header">
          <h2>🔄 Customize Project Workflow</h2>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-body customize-workflow-body">
          <p className="modal-description">
            Define the workflow stages your project will go through. You can add, remove, or reorder stages.
          </p>

          <div className="stages-list">
            {stages.map((stage, index) => (
              <div key={index} className="stage-row">
                <div className="stage-handle">
                  <GripVertical size={18} />
                </div>

                <div className="stage-inputs">
                  <input
                    type="text"
                    placeholder="Stage name (e.g., Planning, Development)"
                    value={stage.name}
                    onChange={(e) => handleStageChange(index, 'name', e.target.value)}
                    className="stage-input stage-name"
                  />
                  <textarea
                    placeholder="Description (e.g., Requirement analysis & planning)"
                    value={stage.description}
                    onChange={(e) => handleStageChange(index, 'description', e.target.value)}
                    className="stage-input stage-description"
                    rows="2"
                  />
                </div>

                <div className="stage-actions">
                  <button
                    className="stage-btn move-btn"
                    onClick={() => handleMoveStage(index, 'up')}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    className="stage-btn move-btn"
                    onClick={() => handleMoveStage(index, 'down')}
                    disabled={index === stages.length - 1}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    className="stage-btn delete-btn"
                    onClick={() => handleRemoveStage(index)}
                    disabled={stages.length === 1}
                    title="Delete stage"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="add-stage-btn"
            onClick={handleAddStage}
          >
            <Plus size={18} /> Add Stage
          </button>
        </div>

        <div className="modal-footer customize-workflow-footer">
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Project with Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizeWorkflowModal;
