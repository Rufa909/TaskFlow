import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axiosInstance';
import Icon from '../common/Icon';
import { useToast } from '../../context/ToastContext';
import { useRole } from '../../context/RoleContext';
import './ApprovalModal.css';

const API_URL = 'http://localhost:5000';

function avatarUrl(photo) {
  if (!photo) return '';
  return photo.startsWith('http') || photo.startsWith('data:')
    ? photo
    : `${API_URL}${photo}`;
}

function PriorityBadge({ priority }) {
  const map = {
    low: { label: 'Low', cls: 'priority-low' },
    medium: { label: 'Medium', cls: 'priority-medium' },
    high: { label: 'High', cls: 'priority-high' },
    urgent: { label: 'Urgent', cls: 'priority-urgent' },
  };
  const p = map[priority] || map.medium;
  return <span className={`apv-priority-badge ${p.cls}`}>{p.label}</span>;
}

export default function ApprovalModal({ isOpen, onClose, activeProject }) {
  const { showToast } = useToast();
  const { fetchPendingCount } = useRole();
  const [activeTab, setActiveTab] = useState('assignments');

  // Assignment requests
  const [assignments, setAssignments] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // Submissions
  const [submissions, setSubmissions] = useState([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Processing
  const [processingId, setProcessingId] = useState(null);

  const loadAssignments = useCallback(async () => {
    if (!activeProject?.project_id) return;
    setLoadingAssign(true);
    try {
      const res = await api.get(`/roles/assignment-requests/${activeProject.project_id}`);
      setAssignments(res.data.requests || []);
    } catch (err) {
      console.error('Cannot load assignment requests', err);
    } finally {
      setLoadingAssign(false);
    }
  }, [activeProject?.project_id]);

  const loadSubmissions = useCallback(async () => {
    if (!activeProject?.project_id) return;
    setLoadingSub(true);
    try {
      const res = await api.get(`/roles/submissions/${activeProject.project_id}`);
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      console.error('Cannot load submissions', err);
    } finally {
      setLoadingSub(false);
    }
  }, [activeProject?.project_id]);

  useEffect(() => {
    if (isOpen && activeProject) {
      loadAssignments();
      loadSubmissions();
    }
  }, [isOpen, activeProject, loadAssignments, loadSubmissions]);

  const handleAssignmentAction = async (requestId, action) => {
    setProcessingId(`assign-${requestId}`);
    try {
      const res = await api.put(`/roles/assignment-requests/${requestId}`, { action });
      showToast(res.data.message, 'success');
      loadAssignments();
      fetchPendingCount(activeProject.project_id);
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi xử lý', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmissionAction = async (submissionId, action) => {
    setProcessingId(`sub-${submissionId}`);
    try {
      const res = await api.put(`/roles/submissions/${submissionId}`, { action });
      showToast(res.data.message, 'success');
      loadSubmissions();
      fetchPendingCount(activeProject.project_id);
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi xử lý', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay apv-overlay" onClick={onClose}>
      <div className="modal-content apv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header apv-header">
          <div className="apv-title">
            <span className="apv-title-icon">
              <Icon name="check" size={16} />
            </span>
            Approval Center
            {activeProject && (
              <span className="apv-project-badge">
                <Icon name="hash" size={12} />
                {activeProject.name}
              </span>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="apv-tabs">
          <button
            className={`apv-tab ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            <Icon name="user" size={14} />
            Task Assignments
            {assignments.length > 0 && (
              <span className="apv-tab-count">{assignments.length}</span>
            )}
          </button>
          <button
            className={`apv-tab ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            <Icon name="check" size={14} />
            Task Submissions
            {submissions.length > 0 && (
              <span className="apv-tab-count">{submissions.length}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="apv-body">
          {/* ── Assignment Requests Tab ── */}
          {activeTab === 'assignments' && (
            <div className="apv-list">
              {loadingAssign ? (
                <div className="apv-loading">
                  <div className="apv-spinner" />
                  <span>Loading requests...</span>
                </div>
              ) : assignments.length === 0 ? (
                <div className="apv-empty">
                  <div className="apv-empty-icon">📋</div>
                  <div className="apv-empty-text">Không có yêu cầu giao task đang chờ duyệt</div>
                </div>
              ) : (
                assignments.map(req => (
                  <div className="apv-card" key={req.request_id}>
                    <div className="apv-card-header">
                      <div className="apv-task-info">
                        <span className="apv-task-title">{req.task_title}</span>
                        <PriorityBadge priority={req.priority} />
                        {req.deadline && (
                          <span className="apv-deadline">
                            <Icon name="calendar" size={12} />
                            {new Date(req.deadline).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="apv-people">
                      <div className="apv-person">
                        <div className="apv-avatar">
                          {req.requester_photo ? (
                            <img src={avatarUrl(req.requester_photo)} alt="" onError={e => e.target.style.display = 'none'} />
                          ) : (
                            (req.requester_name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="apv-person-info">
                          <span className="apv-person-label">Leader giao</span>
                          <span className="apv-person-name">{req.requester_name}</span>
                        </div>
                      </div>

                      <div className="apv-arrow">
                        <Icon name="chevronRight" size={16} />
                      </div>

                      <div className="apv-person">
                        <div className="apv-avatar">
                          {req.assignee_photo ? (
                            <img src={avatarUrl(req.assignee_photo)} alt="" onError={e => e.target.style.display = 'none'} />
                          ) : (
                            (req.assignee_name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="apv-person-info">
                          <span className="apv-person-label">Giao cho</span>
                          <span className="apv-person-name">{req.assignee_name}</span>
                        </div>
                      </div>
                    </div>

                    {req.note && (
                      <div className="apv-note">
                        <Icon name="edit" size={12} />
                        {req.note}
                      </div>
                    )}

                    <div className="apv-card-meta">
                      <span className="apv-time">
                        {new Date(req.created_at).toLocaleString('vi-VN')}
                      </span>
                      <div className="apv-actions">
                        <button
                          className="apv-btn apv-btn-reject"
                          onClick={() => handleAssignmentAction(req.request_id, 'reject')}
                          disabled={processingId === `assign-${req.request_id}`}
                        >
                          <Icon name="x" size={14} />
                          Từ chối
                        </button>
                        <button
                          className="apv-btn apv-btn-approve"
                          onClick={() => handleAssignmentAction(req.request_id, 'approve')}
                          disabled={processingId === `assign-${req.request_id}`}
                        >
                          {processingId === `assign-${req.request_id}` ? (
                            <div className="apv-spinner-sm" />
                          ) : (
                            <Icon name="check" size={14} />
                          )}
                          Duyệt
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Task Submissions Tab ── */}
          {activeTab === 'submissions' && (
            <div className="apv-list">
              {loadingSub ? (
                <div className="apv-loading">
                  <div className="apv-spinner" />
                  <span>Loading submissions...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="apv-empty">
                  <div className="apv-empty-icon">✅</div>
                  <div className="apv-empty-text">Không có yêu cầu nộp task đang chờ duyệt</div>
                </div>
              ) : (
                submissions.map(sub => (
                  <div className="apv-card" key={sub.submission_id}>
                    <div className="apv-card-header">
                      <div className="apv-task-info">
                        <span className="apv-task-title">{sub.task_title}</span>
                        <PriorityBadge priority={sub.priority} />
                        {sub.deadline && (
                          <span className="apv-deadline">
                            <Icon name="calendar" size={12} />
                            {new Date(sub.deadline).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="apv-people">
                      <div className="apv-person">
                        <div className="apv-avatar">
                          {sub.submitter_photo ? (
                            <img src={avatarUrl(sub.submitter_photo)} alt="" onError={e => e.target.style.display = 'none'} />
                          ) : (
                            (sub.submitter_name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="apv-person-info">
                          <span className="apv-person-label">Nộp bởi</span>
                          <span className="apv-person-name">{sub.submitter_name}</span>
                        </div>
                      </div>
                    </div>

                    {sub.note && (
                      <div className="apv-note">
                        <Icon name="edit" size={12} />
                        {sub.note}
                      </div>
                    )}

                    <div className="apv-card-meta">
                      <span className="apv-time">
                        {new Date(sub.created_at).toLocaleString('vi-VN')}
                      </span>
                      <div className="apv-actions">
                        <button
                          className="apv-btn apv-btn-reject"
                          onClick={() => handleSubmissionAction(sub.submission_id, 'reject')}
                          disabled={processingId === `sub-${sub.submission_id}`}
                        >
                          <Icon name="x" size={14} />
                          Từ chối
                        </button>
                        <button
                          className="apv-btn apv-btn-approve"
                          onClick={() => handleSubmissionAction(sub.submission_id, 'approve')}
                          disabled={processingId === `sub-${sub.submission_id}`}
                        >
                          {processingId === `sub-${sub.submission_id}` ? (
                            <div className="apv-spinner-sm" />
                          ) : (
                            <Icon name="check" size={14} />
                          )}
                          Duyệt
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
