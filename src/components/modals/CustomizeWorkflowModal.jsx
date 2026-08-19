import React, { useEffect, useMemo, useState } from 'react';
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

function parseDateInputValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateInput(value, days) {
  const date = parseDateInputValue(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

function formatSuggestedDate(value) {
  const date = parseDateInputValue(value);
  return date ? date.toLocaleDateString('vi-VN') : '';
}

function getStageDurationWeight(stage) {
  const value = `${stage?.name || ''} ${stage?.description || ''}`.toLowerCase();

  if (/(develop|phát triển|lap trinh|lập trình|coding|implementation|backend|frontend)/.test(value)) {
    return 2.2;
  }
  if (/(test|kiểm thử|kiem thu|qa|quality|đảm bảo chất lượng|dam bao chat luong)/.test(value)) {
    return 1.5;
  }
  if (/(analysis|analyst|planning|phân tích|phan tich|lập kế hoạch|lap ke hoach|requirement|yêu cầu|yeu cau|ba)/.test(value)) {
    return 1.3;
  }
  if (/(design|ui|ux|prototype|thiết kế|thiet ke)/.test(value)) {
    return 1.25;
  }
  if (/(deploy|deployment|release|triển khai|trien khai|maintenance|bảo trì|bao tri|devops)/.test(value)) {
    return 1;
  }

  return 1;
}

function buildWeightedSuggestedRanges(stages, todayDate, projectDeadline) {
  const start = parseDateInputValue(todayDate);
  const end = parseDateInputValue(projectDeadline);
  if (!start || !end || end < start || stages.length === 0) return [];

  const spanDays = Math.floor((end - start) / (24 * 60 * 60 * 1000));
  if (spanDays <= 0) {
    return stages.map(() => ({ start_date: todayDate, end_date: projectDeadline }));
  }

  const weights = stages.map(getStageDurationWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || stages.length;
  const idealDurations = weights.map((weight) => (spanDays * weight) / totalWeight);
  const baseDurations = idealDurations.map(Math.floor);
  let remainingDays = spanDays - baseDurations.reduce((sum, days) => sum + days, 0);

  const rankedIndexes = idealDurations
    .map((duration, index) => ({
      index,
      fraction: duration - Math.floor(duration),
      weight: weights[index],
    }))
    .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || a.index - b.index);

  for (let i = 0; remainingDays > 0; i += 1) {
    const target = rankedIndexes[i % rankedIndexes.length];
    baseDurations[target.index] += 1;
    remainingDays -= 1;
  }

  let currentOffset = 0;
  return stages.map((_, index) => {
    const startOffset = currentOffset;
    currentOffset += baseDurations[index];
    return {
      start_date: addDaysToDateInput(todayDate, startOffset),
      end_date: addDaysToDateInput(todayDate, currentOffset),
    };
  });
}

function normalizeStageDateSequence(stages, startIndex = 0) {
  const normalized = stages.map((stage) => ({ ...stage }));
  const firstIndex = Math.max(0, startIndex);

  for (let index = firstIndex; index < normalized.length; index += 1) {
    const stage = normalized[index];
    const previousStage = normalized[index - 1];
    const minStartDate = index === 0 ? null : previousStage?.end_date;

    if (minStartDate && stage.start_date && stage.start_date < minStartDate) {
      stage.start_date = minStartDate;
    }

    if (stage.start_date && stage.end_date && stage.end_date < stage.start_date) {
      stage.end_date = stage.start_date;
    }
  }

  return normalized;
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
  const suggestedRanges = useMemo(() => {
    return buildWeightedSuggestedRanges(stages, todayDate, projectDeadline);
  }, [projectDeadline, stages, todayDate]);

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
      updated[index].end_date = value;
    }

    const normalizeFromIndex = field === 'end_date' ? index + 1 : index;
    setStages(normalizeStageDateSequence(updated, normalizeFromIndex));
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

    setStages(normalizeStageDateSequence(updated));
  };

  const applySuggestedRange = (index) => {
    const range = suggestedRanges[index];
    if (!range) return;
    const updated = [...stages];
    updated[index] = {
      ...updated[index],
      start_date: range.start_date,
      end_date: range.end_date,
    };
    setStages(updated);
  };

  const applyAllSuggestedRanges = () => {
    if (suggestedRanges.length !== stages.length) return;
    setStages(stages.map((stage, index) => ({
      ...stage,
      start_date: suggestedRanges[index].start_date,
      end_date: suggestedRanges[index].end_date,
    })));
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

          {suggestedRanges.length === stages.length && (
            <div className="stage-suggestion-bar">
              <span>Hướng dẫn chia ngày theo độ quan trọng của stage</span>
              <button type="button" onClick={applyAllSuggestedRanges}>
                Áp dụng hướng dẫn
              </button>
            </div>
          )}

          <div className="stages-list">
            {stages.map((stage, index) => {
              const suggestedRange = suggestedRanges[index];
              return (
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
                  {suggestedRange && (
                    <button
                      type="button"
                      className="stage-date-suggestion"
                      onClick={() => applySuggestedRange(index)}
                    >
                      Hướng dẫn: {formatSuggestedDate(suggestedRange.start_date)} - {formatSuggestedDate(suggestedRange.end_date)}
                    </button>
                  )}
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
              );
            })}
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
