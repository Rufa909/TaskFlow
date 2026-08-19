import React from 'react';
import { CheckCircle2, ChevronRight, PanelRightOpen } from 'lucide-react';
import './WorkflowProgressBar.css';

const stripStageIcon = (name = '') => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();

const formatStageDate = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
};

const WorkflowProgressBar = ({
  stages = [],
  onStageClick,
  selectedStageId,
  onOpenWorkspace,
  canOpenWorkspace = false,
}) => {
  if (!stages || stages.length === 0) return null;

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const inProgressCount = stages.filter(s => s.status === 'in_progress').length;
  const totalCount = stages.length;
  const progressPercent = (completedCount / totalCount) * 100;
  const isComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="workflow-progress-container">
      <div className={`workflow-progress-card ${isComplete ? 'complete' : ''}`}>
        {/* Header with title and progress bar */}
        <div className="workflow-header">
          <div className="workflow-title-wrap">
            <h3 className="workflow-title">Project Progress</h3>
            {isComplete && (
              <span className="workflow-complete-pill">
                <CheckCircle2 size={14} />
                <span>Đã hoàn thành dự án</span>
              </span>
            )}
          </div>
          <div className="progress-stats">
            <div className="progress-item">
              <span className="progress-label">Completed</span>
              <span className="progress-value">{completedCount}/{totalCount}</span>
            </div>
            <div className="progress-bar-wrapper">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="progress-percent">{Math.round(progressPercent)}%</span>
            </div>
          </div>
          {canOpenWorkspace && (
            <button
              type="button"
              className="workflow-workspace-btn"
              onClick={onOpenWorkspace}
              title="Open stage workspace"
              aria-label="Open stage workspace"
            >
              <PanelRightOpen size={16} />
              <span>Workspace</span>
            </button>
          )}
        </div>

        {/* Horizontal stages timeline */}
        <div className="workflow-timeline">
          {stages.map((stage, index) => {
            const isClickable = typeof onStageClick === 'function';
            const isSelected = selectedStageId === stage.id;
            return (
              <React.Fragment key={stage.id}>
                <div 
                  className={`workflow-stage ${stage.status} ${isClickable ? 'clickable' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => isClickable && onStageClick(stage)}
                >
                  <div className="stage-info">
                    <div className="stage-label">{stripStageIcon(stage.stage_name)}</div>
                    <div className="stage-status">
                      {stage.status === 'completed' && 'Đã xong'}
                      {stage.status === 'in_progress' && 'Đang làm'}
                      {stage.status === 'pending' && 'Chờ'}
                    </div>
                    {(stage.start_date || stage.end_date || stage.deadline) && (
                      <div className="stage-date-range">
                        {formatStageDate(stage.start_date) || '...'} - {formatStageDate(stage.end_date || stage.deadline) || '...'}
                      </div>
                    )}
                  </div>
                </div>
                {index < stages.length - 1 && (
                  <div className={`timeline-connector ${stage.status === 'approved' || stage.status === 'completed' ? 'completed' : ''}`}>
                    <ChevronRight size={18} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {isComplete && (
          <div className="workflow-complete-banner" role="status" aria-live="polite">
            <CheckCircle2 size={18} />
            <span>Dự án đã hoàn thành toàn bộ stage. Workspace vẫn có thể mở để xem lại task, tài liệu và bàn giao.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowProgressBar;
