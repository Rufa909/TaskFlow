import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import TaskList from '../task/TaskList';
import './StageTaskPanel.css';

export default function StageTaskPanel({
  isOpen,
  onClose,
  stage,
  tasks = [],
  loading,
  handleDeleteTask,
  handleCompleteTask,
  handleReviewTaskSubmission,
  currentUserRole,
  currentUserId,
  setSelectedTask,
}) {
  if (!isOpen) return null;

  return (
    <div className={`stage-task-panel-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`stage-task-panel ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <div className="panel-header-title">
            <h3 className="panel-title">Tasks in Stage</h3>
            <span className="stage-name-badge">{stage ? stage.stage_name : 'Unassigned'}</span>
          </div>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close panel">
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          {loading ? (
            <div className="panel-loading">
              <div className="spinner" />
              <p>Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="panel-empty">
              <AlertCircle size={32} className="empty-icon" />
              <p className="empty-text">No tasks in this stage.</p>
            </div>
          ) : (
            <div className="panel-task-list">
              <TaskList
                tasks={tasks}
                handleDeleteTask={handleDeleteTask}
                handleCompleteTask={handleCompleteTask}
                handleReviewTaskSubmission={handleReviewTaskSubmission}
                currentUserRole={currentUserRole}
                currentUserId={currentUserId}
                setSelectedTask={setSelectedTask}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
