import React from 'react';
import { CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import './WorkflowProgressBar.css';

const WorkflowProgressBar = ({ stages = [] }) => {
  if (!stages || stages.length === 0) return null;

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const inProgressCount = stages.filter(s => s.status === 'in_progress').length;
  const totalCount = stages.length;
  const progressPercent = (completedCount / totalCount) * 100;

  const getStageIcon = (status) => {
    switch(status) {
      case 'completed':
        return <CheckCircle className="stage-icon completed" size={24} />;
      case 'in_progress':
        return <Clock className="stage-icon active" size={24} />;
      default:
        return <div className="stage-icon pending" />;
    }
  };

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
          {stages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              <div className={`workflow-stage ${stage.status}`}>
                <div className="stage-icon-wrapper">
                  {getStageIcon(stage.status)}
                </div>
                <div className="stage-info">
                  <div className="stage-label">{stage.stage_name}</div>
                  <div className="stage-status">
                    {stage.status === 'completed' && 'Done'}
                    {stage.status === 'in_progress' && 'Current'}
                    {stage.status === 'pending' && 'Pending'}
                  </div>
                </div>
              </div>
              {index < stages.length - 1 && (
                <div className={`timeline-connector ${stage.status === 'approved' ? 'completed' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowProgressBar;
