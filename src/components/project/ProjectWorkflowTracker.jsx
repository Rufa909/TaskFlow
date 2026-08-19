import React, { useState, useEffect } from 'react';
import { User, Calendar, Trophy, Pencil, Check, X } from 'lucide-react';
import axios from 'axios';
import './ProjectWorkflowTracker.css';

const stripStageIcon = (name = '') => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();

const formatStageDate = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
};

const ProjectWorkflowTracker = ({ projectId, isOwner = false, stages: initialStages = [], onStagesChange }) => {
  const [stages, setStages] = useState(initialStages);
  const [loading, setLoading] = useState(!initialStages || initialStages.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isOwnerState, setIsOwnerState] = useState(isOwner);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pendingCompleteStageId, setPendingCompleteStageId] = useState(null);
  const [editingStageId, setEditingStageId] = useState(null);
  const [dateDraft, setDateDraft] = useState({ start_date: '', end_date: '' });

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

  const startEditingDates = (stage) => {
    setEditingStageId(stage.id);
    setDateDraft({
      start_date: stage.start_date ? String(stage.start_date).slice(0, 10) : '',
      end_date: (stage.end_date || stage.deadline) ? String(stage.end_date || stage.deadline).slice(0, 10) : '',
    });
  };

  const saveStageDates = async (stageId) => {
    if (dateDraft.start_date && dateDraft.end_date && dateDraft.start_date > dateDraft.end_date) {
      setError('Ngày bắt đầu stage không được sau ngày kết thúc.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.put(
        `${API_URL}/api/projects/${projectId}/stages/${stageId}/dates`,
        dateDraft,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
      );
      setStages(res.data.data);
      if (onStagesChange) onStagesChange(res.data.data);
      setEditingStageId(null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật thời gian stage.');
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
            : (() => {
                const firstOpenIndex = stages.findIndex(s => s.status !== 'completed');
                return firstOpenIndex !== -1 ? firstOpenIndex : stages.length - 1;
              })();
          const isCurrent = index === effectiveInProgressIndex;
          const isLastStage = index === stages.length - 1;

          return (
            <div key={stage.id} className={`workflow-item ${stage.status}`}>
              <div className="stage-card">
                <div className="stage-content">
                  <div className="stage-header">
                    <div>
                      <h3 className="stage-name">{stage.stage_order}. {stripStageIcon(stage.stage_name)}</h3>
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
                    <div className="metadata-item stage-date-metadata">
                      <Calendar size={16} />
                      {editingStageId === stage.id ? (
                        <span className="stage-date-editor-inline">
                          <input
                            type="date"
                            value={dateDraft.start_date}
                            max={dateDraft.end_date || undefined}
                            onChange={(event) => setDateDraft((draft) => ({ ...draft, start_date: event.target.value }))}
                            disabled={isSubmitting}
                          />
                          <input
                            type="date"
                            value={dateDraft.end_date}
                            min={dateDraft.start_date || undefined}
                            onChange={(event) => setDateDraft((draft) => ({ ...draft, end_date: event.target.value }))}
                            disabled={isSubmitting}
                          />
                          <button type="button" onClick={() => saveStageDates(stage.id)} disabled={isSubmitting} title="Save dates" aria-label="Save dates">
                            <Check size={14} />
                          </button>
                          <button type="button" onClick={() => setEditingStageId(null)} disabled={isSubmitting} title="Cancel" aria-label="Cancel">
                            <X size={14} />
                          </button>
                        </span>
                      ) : (
                        <>
                          <span>
                            {stage.start_date || stage.end_date || stage.deadline
                              ? `${formatStageDate(stage.start_date) || 'Chưa đặt'} - ${formatStageDate(stage.end_date || stage.deadline) || 'Chưa đặt'}`
                              : 'Chưa đặt thời gian stage'}
                          </span>
                          {isOwnerState && (
                            <button type="button" className="stage-date-edit-btn" onClick={() => startEditingDates(stage)} title="Edit stage dates" aria-label="Edit stage dates">
                              <Pencil size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {isOwnerState && isCurrent && isLastStage && stage.status !== 'completed' && (
                    <div className="stage-actions">
                      {error && <div className="action-error">{error}</div>}
                      <div className="action-buttons">
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
