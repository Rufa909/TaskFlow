import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, ChevronRight, ChevronLeft, User, Calendar, Trophy } from 'lucide-react';
import axios from 'axios';
import './ProjectWorkflowTracker.css';

const ProjectWorkflowTracker = ({ projectId, isOwner = false, stages: initialStages = [], onStagesChange }) => {
  const [stages, setStages] = useState(initialStages);
  const [loading, setLoading] = useState(!initialStages || initialStages.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isOwnerState, setIsOwnerState] = useState(isOwner);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pendingCompleteStageId, setPendingCompleteStageId] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Đồng bộ prop isOwner vào state khi prop thay đổi
  useEffect(() => {
    setIsOwnerState(isOwner);
  }, [isOwner]);

  // Lấy dữ liệu workflow nếu không có initialStages
  useEffect(() => {
    if (initialStages && initialStages.length > 0) {
      setStages(initialStages);
      setLoading(false);
      return;
    }

    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setStages(res.data.data);
        if (res.data.isOwner !== undefined) {
          setIsOwnerState(res.data.isOwner);
        }
      } catch (err) {
        console.error("Lỗi khi lấy workflow:", err);
        setError('Không thể tải workflow');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) fetchWorkflow();
  }, [projectId, initialStages, API_URL]);

  const handleMoveNext = async (stageId) => {
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/stages/${stageId}/complete`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(res.data.data);
      if (onStagesChange) onStagesChange(res.data.data);
      if (res.data.isOwner !== undefined) setIsOwnerState(res.data.isOwner);
      setError(null);
    } catch (err) {
      const missing = err.response?.data?.missing || [];
      setError(
        missing.length > 0
          ? `Không thể chuyển stage. Thiếu: ${missing.join(', ')}`
          : 'Lỗi khi chuyển sang giai đoạn tiếp theo: ' + (err.response?.data?.message || err.message)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteProject = async () => {
    if (!pendingCompleteStageId) return;
    setShowCompleteModal(false);
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/stages/${pendingCompleteStageId}/complete`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(res.data.data);
      if (onStagesChange) onStagesChange(res.data.data);
      if (res.data.isOwner !== undefined) setIsOwnerState(res.data.isOwner);
      setError(null);
    } catch (err) {
      const missing = err.response?.data?.missing || [];
      setError(
        missing.length > 0
          ? `Không thể hoàn thành dự án. Thiếu: ${missing.join(', ')}`
          : 'Lỗi khi hoàn thành dự án: ' + (err.response?.data?.message || err.message)
      );
    } finally {
      setIsSubmitting(false);
      setPendingCompleteStageId(null);
    }
  };

  const handleMovePrevious = async (stageId) => {
    setIsSubmitting(true);
    try {
      console.log('[ProjectWorkflowTracker] calling previous endpoint');
      await axios.post(
        `${API_URL}/api/projects/${projectId}/stages/previous`,
        { stageId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      console.log('[ProjectWorkflowTracker] movePrevious got workflow', {
        success: res.data?.success,
        dataLen: res.data?.data?.length,
        stages: res.data?.data
      });

      setStages(res.data.data);
      if (onStagesChange) onStagesChange(res.data.data);
      if (res.data.isOwner !== undefined) setIsOwnerState(res.data.isOwner);
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      setError('Lỗi khi quay lại giai đoạn trước: ' + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed': return 'badge-completed';
      case 'in_progress': return 'badge-in-progress';
      default: return 'badge-pending';
    }
  };

  if (loading) return <div className="workflow-loading">Loading workflow...</div>;
  if (error && stages.length === 0) return <div className="workflow-error">{error}</div>;

  return (
    <div className="workflow-tracker-container">
      <div className="workflow-tracker-header">
        <h2 className="workflow-tracker-title">Progressing</h2>
        <p className="workflow-tracker-subtitle">Keep track of the progress of each project stage</p>
      </div>

      <div className="workflow-timeline-container">
        {stages.map((stage, index) => {
          const inProgressIndex = stages.findIndex(s => s.status === 'in_progress');
          const effectiveInProgressIndex = inProgressIndex !== -1
            ? inProgressIndex
            : stages.findIndex(s => s.status !== 'completed');
          const isCurrent = index === effectiveInProgressIndex;
          const isLastStage = index === stages.length - 1;

          return (
            <div key={stage.id} className={`workflow-item ${stage.status}`}>
              <div className="stage-card">
                <div className="stage-content">
                  <div className="stage-header">
                    <div>
                      <h3 className="stage-name">{stage.stage_order}. {stage.stage_name}</h3>
                      {stage.description && (
                        <p className="stage-description">{stage.description}</p>
                      )}
                    </div>
                    <span className={`stage-badge ${getStatusBadgeClass(stage.status)}`}>
                      {getStatusLabel(stage.status)}
                    </span>
                  </div>

                  {/* Stage metadata */}
                  <div className="stage-metadata">
                    {stage.assignee_name && (
                      <div className="metadata-item">
                        <User size={16} />
                        <span>{stage.assignee_name}</span>
                      </div>
                    )}
                    {stage.deadline && (
                      <div className="metadata-item">
                        <Calendar size={16} />
                        <span>{new Date(stage.deadline).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons — only for owner on the current active stage */}
                  {isOwnerState && isCurrent && (
                    <div className="stage-actions">
                      {error && <div className="action-error">{error}</div>}
                      <div className="action-buttons">
                        {isLastStage ? (
                          <button
                            className="btn-complete"
                            onClick={() => {
                              setPendingCompleteStageId(stage.id);
                              setShowCompleteModal(true);
                            }}
                            disabled={isSubmitting}
                            type="button"
                            aria-label="Complete project"
                            title="Complete project"
                          >
                            <Trophy size={18} />
                            <span>Complete</span>
                          </button>
                        ) : (
                          <button
                            className="btn-next"
                            onClick={() => handleMoveNext(stage.id)}
                            disabled={isSubmitting}
                            type="button"
                            aria-label="Next stage"
                            title="Next stage"
                          >
                            <ChevronRight size={18} />
                            <span>Next</span>
                          </button>
                        )}
                        <button
                          className="btn-previous"
                          onClick={() => handleMovePrevious(stage.id)}
                          disabled={isSubmitting || Number(stage.stage_order) === 1}
                          type="button"
                          aria-label="Previous stage"
                          title="Previous stage"
                        >
                          <span>Previous</span>
                          <ChevronLeft size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Project Confirmation Modal */}
      {showCompleteModal && (
        <div className="complete-modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="complete-modal" onClick={e => e.stopPropagation()}>
            <div className="complete-modal-icon">
              <Trophy size={48} />
            </div>
            <h2 className="complete-modal-title">Complete Project?</h2>
            <p className="complete-modal-desc">
              You will complete the final stage and mark the entire project as{' '}
              <strong>Completed</strong>. This action cannot be undone easily.
            </p>
            <div className="complete-modal-actions">
              <button
                className="complete-modal-btn-cancel"
                onClick={() => setShowCompleteModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="complete-modal-btn-confirm"
                onClick={handleCompleteProject}
                disabled={isSubmitting}
                type="button"
              >
                <Trophy size={16} />
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectWorkflowTracker;
