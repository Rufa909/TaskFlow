import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Scale,
  Send,
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
  { key: 'decisions', label: 'Decisions', icon: Scale },
  { key: 'handover', label: 'Handover', icon: Send },
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
  const decisions = packageData?.decisions || [];
  const discussions = packageData?.discussions || [];
  const handover = packageData?.handover;

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
            <span className="stage-mini-label">Decisions</span>
            {decisions.length === 0 ? (
              <p className="stage-muted">No decisions.</p>
            ) : (
              decisions.slice(0, 3).map((item) => (
                <p key={item.decision_id} className="stage-line">{item.decision}</p>
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
          <div>
            <span className="stage-mini-label">Handover Notes</span>
            {handover ? (
              <p className="stage-line">{handover.open_issues || handover.summary}</p>
            ) : (
              <p className="stage-muted">No handover notes.</p>
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
  const [decisionForm, setDecisionForm] = useState({ decision: '', reason: '' });
  const [deliverableForm, setDeliverableForm] = useState({ title: '', description: '' });
  const [handoverForm, setHandoverForm] = useState({
    summary: '',
    open_issues: '',
    technical_limits: '',
    recommendations: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const stageId = stage?.id || stage?.stage_id;

  const refreshOverview = async () => {
    if (!projectId || !stageId) return;
    setOverviewLoading(true);
    setPanelError('');
    try {
      const res = await api.get(`/projects/${projectId}/stages/${stageId}/overview`);
      setOverview(res.data);
      const handover = res.data.current?.handover;
      setHandoverForm({
        summary: handover?.summary || '',
        open_issues: handover?.open_issues || '',
        technical_limits: handover?.technical_limits || '',
        recommendations: handover?.recommendations || '',
      });
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot load stage handover data.');
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
  const canComplete = Boolean(overview?.checklist?.canComplete && overview?.canCompleteStage);

  const deliverableSummary = useMemo(() => {
    const docs = currentPackage?.documents?.length || 0;
    const decisions = currentPackage?.decisions?.length || 0;
    const discussions = currentPackage?.discussions?.length || 0;
    return `${docs} documents, ${decisions} decisions, ${discussions} discussions`;
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

  const submitDecision = async (event) => {
    event.preventDefault();
    if (!decisionForm.decision.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/decisions`, decisionForm);
      setDecisionForm({ decision: '', reason: '' });
      await refreshOverview();
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot add decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitHandover = async (event) => {
    event.preventDefault();
    if (!handoverForm.summary.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/handover`, handoverForm);
      await refreshOverview();
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot save handover notes.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeliverable = async (event) => {
    event.preventDefault();
    if (!deliverableForm.title.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/deliverables`, deliverableForm);
      setDeliverableForm({ title: '', description: '' });
      await refreshOverview();
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Cannot add deliverable.');
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

              {activeTab === 'decisions' && (
                <div className="stage-tab-panel">
                  <form className="stage-form" onSubmit={submitDecision}>
                    <input
                      value={decisionForm.decision}
                      onChange={(event) => setDecisionForm((prev) => ({ ...prev, decision: event.target.value }))}
                      placeholder="Decision"
                    />
                    <textarea
                      value={decisionForm.reason}
                      onChange={(event) => setDecisionForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Reason"
                    />
                    <button type="submit" disabled={submitting}>
                      <Scale size={16} />
                      Record decision
                    </button>
                  </form>
                  {(currentPackage?.decisions || []).length === 0 ? (
                    <EmptyState text="No decisions recorded." />
                  ) : (
                    <div className="stage-list">
                      {currentPackage.decisions.map((item) => (
                        <div key={item.decision_id} className="stage-list-item">
                          <Scale size={17} />
                          <span>
                            <strong>{item.decision}</strong>
                            <small>{item.reason || 'No reason provided'}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'handover' && (
                <div className="stage-tab-panel">
                  <form className="stage-form" onSubmit={submitHandover}>
                    <textarea
                      value={handoverForm.summary}
                      onChange={(event) => setHandoverForm((prev) => ({ ...prev, summary: event.target.value }))}
                      placeholder="Tóm tắt công việc đã hoàn thành"
                    />
                    <textarea
                      value={handoverForm.open_issues}
                      onChange={(event) => setHandoverForm((prev) => ({ ...prev, open_issues: event.target.value }))}
                      placeholder="Các vấn đề còn tồn đọng"
                    />
                    <textarea
                      value={handoverForm.technical_limits}
                      onChange={(event) => setHandoverForm((prev) => ({ ...prev, technical_limits: event.target.value }))}
                      placeholder="Các giới hạn kỹ thuật"
                    />
                    <textarea
                      value={handoverForm.recommendations}
                      onChange={(event) => setHandoverForm((prev) => ({ ...prev, recommendations: event.target.value }))}
                      placeholder="Đề xuất cho nhóm tiếp theo"
                    />
                    <button type="submit" disabled={submitting}>
                      <Send size={16} />
                      Save handover
                    </button>
                  </form>

                  <div className="stage-checklist">
                    <div className="stage-checklist-title">Checklist chuyển stage</div>
                    {checklist.map((item) => (
                      <div key={item.key} className={`stage-check-item ${item.complete ? 'done' : 'missing'}`}>
                        {item.complete ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <form className="stage-form stage-deliverable-form" onSubmit={submitDeliverable}>
                    <input
                      value={deliverableForm.title}
                      onChange={(event) => setDeliverableForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Deliverable title"
                    />
                    <textarea
                      value={deliverableForm.description}
                      onChange={(event) => setDeliverableForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Deliverable description"
                    />
                    <button type="submit" disabled={submitting}>
                      <ClipboardCheck size={16} />
                      Add deliverable
                    </button>
                  </form>

                  {(currentPackage?.deliverables || []).length > 0 && (
                    <div className="stage-list">
                      {currentPackage.deliverables.map((item) => (
                        <div key={item.deliverable_id} className="stage-list-item">
                          <ClipboardCheck size={17} />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.description || item.status}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <KnowledgeSection title="Thông tin bàn giao cho giai đoạn tiếp theo" packageData={currentPackage} />
        </div>

        <div className="panel-footer">
          <div className="stage-deliverable-summary">{deliverableSummary}</div>
          <button
            type="button"
            className="stage-complete-btn"
            disabled={submitting || !canComplete}
            onClick={completeStage}
            title={!overview?.canCompleteStage ? 'Only stage owners can complete this stage' : 'Complete stage'}
          >
            <CheckCircle2 size={17} />
            Chuyển sang giai đoạn tiếp theo
          </button>
        </div>
      </div>
    </div>
  );
}
