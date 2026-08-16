import React from 'react';
import { ChevronRight } from 'lucide-react';
import './WorkflowProgressBar.css';

const stripStageIcon = (name = '') => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();

const WorkflowProgressBar = ({ stages = [], onStageClick, selectedStageId }) => {
  if (!stages || stages.length === 0) return null;

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const inProgressCount = stages.filter(s => s.status === 'in_progress').length;
  const totalCount = stages.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div className="workflow-progress-container">
      <div className="workflow-progress-card">
        {/* Header with title and progress bar */}
        <div className="workflow-header">
          <h3 className="workflow-title">Project Progress</h3>
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
                      {stage.status === 'completed' && 'Done'}
                      {stage.status === 'in_progress' && 'Current'}
                      {stage.status === 'pending' && 'Pending'}
                    </div>
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
      </div>
    </div>
  );
};

export default WorkflowProgressBar;
