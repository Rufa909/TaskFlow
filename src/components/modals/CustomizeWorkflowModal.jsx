import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getTranslation } from '../../i18n/translations';
import './CustomizeWorkflowModal.css';

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CustomizeWorkflowModal = ({ isOpen, onClose, onSave, loading = false, projectDeadline = "" }) => {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const todayDate = getTodayDateInputValue();
  const getDefaultStages = () => [
    {
      order: 1,
      name: t('workflowStageAnalystPlanning'),
      description: t('workflowStageAnalystPlanningDesc'),
    },
    {
      order: 2,
      name: t('workflowStageDevelopment'),
      description: t('workflowStageDevelopmentDesc'),
    },
    {
      order: 3,
      name: t('workflowStageTesting'),
      description: t('workflowStageTestingDesc'),
    },
    {
      order: 4,
      name: t('workflowStageDeploymentMaintenance'),
      description: t('workflowStageDeploymentMaintenanceDesc'),
    },
  ];
  const [stages, setStages] = useState(getDefaultStages);

  useEffect(() => {
    if (isOpen) {
      setStages(getDefaultStages());
    }
  }, [isOpen, language]);

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

    if (field === 'start_date' && updated[index].end_date && value > updated[index].end_date) {
      updated[index].end_date = '';
    }

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
      alert(t('workflowStageRequired'));
      return;
    }
    const invalidStage = validStages.find((stage, index) => {
      const previousStage = validStages[index - 1];
      const previousEndDate = previousStage?.end_date;
      return (
        (stage.start_date && stage.end_date && stage.start_date > stage.end_date) ||
        (index === 0 && stage.start_date && stage.start_date < todayDate) ||
        (previousEndDate && stage.start_date && stage.start_date < previousEndDate) ||
        (projectDeadline && stage.end_date && stage.end_date > projectDeadline) ||
        (projectDeadline && stage.start_date && stage.start_date > projectDeadline)
      );
    });
    if (invalidStage) {
      alert('Ngày stage không hợp lệ: stage đầu không được trước ngày hiện tại, stage sau phải bắt đầu từ ngày kết thúc stage trước và không được quá hạn project.');
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
          <h2>🔄 {t('customizeProjectWorkflow')}</h2>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            aria-label={t('closeModal')}
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-body customize-workflow-body">
          <p className="modal-description">
            {t('customizeWorkflowDescription')}
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
                    placeholder={t('workflowStageNamePlaceholder')}
                    value={stage.name}
                    onChange={(e) => handleStageChange(index, 'name', e.target.value)}
                    className="stage-input stage-name"
                  />
                  <textarea
                    placeholder={t('workflowStageDescriptionPlaceholder')}
                    value={stage.description}
                    onChange={(e) => handleStageChange(index, 'description', e.target.value)}
                    className="stage-input stage-description"
                    rows="2"
                  />
                  <div className="stage-date-row">
                    <label className="stage-date-field">
                      <span>Bắt đầu</span>
                      <input
                        type="date"
                        value={stage.start_date || ''}
                        min={index === 0 ? todayDate : stages[index - 1]?.end_date || undefined}
                        max={projectDeadline || undefined}
                        onChange={(e) => handleStageChange(index, 'start_date', e.target.value)}
                        className="stage-input"
                      />
                    </label>
                    <label className="stage-date-field">
                      <span>Kết thúc</span>
                      <input
                        type="date"
                        value={stage.end_date || ''}
                        min={stage.start_date || undefined}
                        max={projectDeadline || undefined}
                        onChange={(e) => handleStageChange(index, 'end_date', e.target.value)}
                        className="stage-input"
                      />
                    </label>
                  </div>
                </div>

                <div className="stage-actions">
                  <button
                    className="stage-btn move-btn"
                    onClick={() => handleMoveStage(index, 'up')}
                    disabled={index === 0}
                    title={t('moveUp')}
                  >
                    ▲
                  </button>
                  <button
                    className="stage-btn move-btn"
                    onClick={() => handleMoveStage(index, 'down')}
                    disabled={index === stages.length - 1}
                    title={t('moveDown')}
                  >
                    ▼
                  </button>
                  <button
                    className="stage-btn delete-btn"
                    onClick={() => handleRemoveStage(index)}
                    disabled={stages.length === 1}
                    title={t('deleteStage')}
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
            <Plus size={18} /> {t('addStage')}
          </button>
        </div>

        <div className="modal-footer customize-workflow-footer">
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('cancel')}
          </button>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? t('creating') : t('createProjectWithWorkflow')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizeWorkflowModal;
