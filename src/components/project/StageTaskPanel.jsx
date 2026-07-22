import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../api/axiosInstance';
import TaskList from '../task/TaskList';
import './StageTaskPanel.css';

const tabs = [
  { key: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'discussions', label: 'Discussions', icon: MessageSquare },
];

const documentTypes = [
  { value: 'requirement_document', label: 'Requirement Document' },
  { value: 'user_story', label: 'User Story' },
  { value: 'use_case', label: 'Use Case' },
  { value: 'erd', label: 'ERD' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'api_document', label: 'API Document' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'other', label: 'Other' },
];

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

function assetUrl(url) {
  if (!url) return '#';
  return url.startsWith('http') || url.startsWith('data:') ? url : `${API_ORIGIN}${url}`;
}

function EmptyState({ text }) {
  return (
    <div className="panel-empty compact">
      <AlertCircle size={24} className="empty-icon" />
      <p className="empty-text">{text}</p>
    </div>
  );
}

function KnowledgeSection({ title, packageData }) {
  const documents = packageData?.documents || [];
  const discussions = packageData?.discussions || [];

  return (
    <section className="stage-knowledge-section">
      <div className="stage-knowledge-title">{title}</div>
      {!packageData ? (
        <p className="stage-muted">No previous stage information.</p>
      ) : (
        <div className="stage-knowledge-grid">
          <div>
            <span className="stage-mini-label">Documents</span>
            {documents.length === 0 ? (
              <p className="stage-muted">No documents.</p>
            ) : (
              documents.slice(0, 4).map((item) => (
                <a key={item.document_id} className="stage-link-line" href={assetUrl(item.file_url)} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ))
            )}
          </div>
          <div>
            <span className="stage-mini-label">Discussions</span>
            {discussions.length === 0 ? (
              <p className="stage-muted">No discussions.</p>
            ) : (
              discussions.slice(-3).map((item) => (
                <p key={item.discussion_id} className="stage-line">{item.message}</p>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function StageTaskPanel({
  isOpen,
  onClose,
  projectId,
  stage,
  tasks = [],
  loading,
  handleDeleteTask,
  handleCompleteTask,
  handleReviewTaskSubmission,
  currentUserRole,
  currentUserId,
  setSelectedTask,
  onWorkflowUpdated,
}) {
  const [activeTab, setActiveTab] = useState('tasks');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [documentForm, setDocumentForm] = useState({
    title: '',
    document_type: 'requirement_document',
    file: null,
  });
  const [discussionMessage, setDiscussionMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stageId = stage?.id || stage?.stage_id;

  const refreshOverview = async () => {
    if (!projectId || !stageId) return;
    setOverviewLoading(true);
    setPanelError('');
    try {
      const res = await api.get(`/projects/${projectId}/stages/${stageId}/overview`);
      setOverview(res.data);
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot load stage data.');
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('tasks');
    refreshOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId, stageId]);

  const checklist = overview?.checklist?.items || [];
  const currentPackage = overview?.current;
  const incomingPackage = overview?.incoming;
  const canComplete = Boolean(overview?.canCompleteStage);
  const canMoveStage = ['owner', 'leader'].includes(String(currentUserRole || '').toLowerCase());

  const deliverableSummary = useMemo(() => {
    const docs = currentPackage?.documents?.length || 0;
    const discussions = currentPackage?.discussions?.length || 0;
    return `${docs} documents, ${discussions} discussions`;
  }, [currentPackage]);

  const submitDocument = async (event) => {
    event.preventDefault();
    if (!documentForm.file && !documentForm.title.trim()) return;
    setSubmitting(true);
    setPanelError('');
    try {
      const formData = new FormData();
      formData.append('title', documentForm.title || documentForm.file?.name || 'Document');
      formData.append('document_type', documentForm.document_type);
      if (documentForm.file) formData.append('document', documentForm.file);
      await api.post(`/projects/${projectId}/stages/${stageId}/documents`, formData);
      setDocumentForm({ title: '', document_type: 'requirement_document', file: null });
      await refreshOverview();
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDiscussion = async (event) => {
    event.preventDefault();
    if (!discussionMessage.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/discussions`, {
        message: discussionMessage,
      });
      setDiscussionMessage('');
      await refreshOverview();
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot add discussion.');
    } finally {
      setSubmitting(false);
    }
  };

  const completeStage = async () => {
    setSubmitting(true);
    setPanelError('');
    try {
      const res = await api.post(`/projects/${projectId}/stages/${stageId}/complete`);
      if (onWorkflowUpdated) onWorkflowUpdated(res.data.data || []);
      await refreshOverview();
    } catch (err) {
      const missing = err.response?.data?.missing || [];
      setPanelError(
        missing.length > 0
          ? `Không thể chuyển sang giai đoạn tiếp theo. Thiếu: ${missing.join(', ')}`
          : err.response?.data?.message || 'Cannot complete stage.',
      );
      if (err.response?.data?.checklist) {
        setOverview((prev) => ({ ...prev, checklist: err.response.data.checklist }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`stage-task-panel-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`stage-task-panel ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <div className="panel-header-title">
            <h3 className="panel-title">Stage Workspace</h3>
            <span className="stage-name-badge">{stage ? stage.stage_name : 'Unassigned'}</span>
          </div>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close panel">
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          {panelError && <div className="stage-panel-error">{panelError}</div>}

          <KnowledgeSection title="Thông tin nhận từ giai đoạn trước" packageData={incomingPackage} />

          <div className="stage-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`stage-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {overviewLoading ? (
            <div className="panel-loading">
              <div className="spinner" />
              <p>Loading stage data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'tasks' && (
                loading ? (
                  <div className="panel-loading">
                    <div className="spinner" />
                    <p>Loading tasks...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <EmptyState text="No tasks in this stage." />
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
                )
              )}

              {activeTab === 'documents' && (
                <div className="stage-tab-panel">
                  <form className="stage-form" onSubmit={submitDocument}>
                    <input
                      value={documentForm.title}
                      onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Document title"
                    />
                    <select
                      value={documentForm.document_type}
                      onChange={(event) => setDocumentForm((prev) => ({ ...prev, document_type: event.target.value }))}
                    >
                      {documentTypes.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <label className="stage-file-input">
                      <Upload size={16} />
                      <span>{documentForm.file?.name || 'Choose file'}</span>
                      <input
                        type="file"
                        onChange={(event) => setDocumentForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                      />
                    </label>
                    <button type="submit" disabled={submitting}>
                      <Upload size={16} />
                      Upload
                    </button>
                  </form>

                  {(currentPackage?.documents || []).length === 0 ? (
                    <EmptyState text="No documents uploaded." />
                  ) : (
                    <div className="stage-list">
                      {currentPackage.documents.map((doc) => (
                        <a key={doc.document_id} className="stage-list-item" href={assetUrl(doc.file_url)} target="_blank" rel="noreferrer">
                          <FileText size={17} />
                          <span>
                            <strong>{doc.title}</strong>
                            <small>{doc.document_type}</small>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'discussions' && (
                <div className="stage-tab-panel">
                  <form className="stage-form" onSubmit={submitDiscussion}>
                    <textarea
                      value={discussionMessage}
                      onChange={(event) => setDiscussionMessage(event.target.value)}
                      placeholder="Add context, issue, or note for this stage"
                    />
                    <button type="submit" disabled={submitting}>
                      <MessageSquare size={16} />
                      Add discussion
                    </button>
                  </form>
                  {(currentPackage?.discussions || []).length === 0 ? (
                    <EmptyState text="No discussions yet." />
                  ) : (
                    <div className="stage-list">
                      {currentPackage.discussions.map((item) => (
                        <div key={item.discussion_id} className="stage-list-item">
                          <MessageSquare size={17} />
                          <span>
                            <strong>{item.user_name || 'Member'}</strong>
                            <small>{item.message}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="stage-checklist">
                <div className="stage-checklist-title">Checklist chuyển stage</div>
                {checklist.length === 0 ? (
                  <div className="stage-check-item done">
                    <CheckCircle2 size={17} />
                    <span>Không có điều kiện bắt buộc</span>
                  </div>
                ) : (
                  checklist.map((item) => (
                    <div key={item.key} className={`stage-check-item ${item.complete ? 'done' : 'missing'}`}>
                      {item.complete ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                      <span>{item.label}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <KnowledgeSection title="Thông tin bàn giao cho giai đoạn tiếp theo" packageData={currentPackage} />
        </div>

        <div className="panel-footer">
          <div className="stage-deliverable-summary">{deliverableSummary}</div>
          <button
            type="button"
            className="stage-complete-btn"
            disabled={submitting || !canComplete || !canMoveStage}
            onClick={completeStage}
            title={!canMoveStage ? 'Chỉ owner hoặc leader được chuyển stage' : !overview?.canCompleteStage ? 'Bạn chưa có quyền chuyển stage này' : 'Complete stage'}
          >
            <CheckCircle2 size={17} />
            Chuyển sang giai đoạn tiếp theo
          </button>
        </div>
      </div>
    </div>
  );
}
