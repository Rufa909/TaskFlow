import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  MessageSquare,
  Upload,
  Users,
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

const leaderTab = { key: 'leader', label: 'Leader', icon: BarChart3 };

const completedStatuses = new Set(['COMPLETED', 'OWNER_APPROVED']);
const reviewStatuses = new Set(['SUBMITTED', 'LEADER_APPROVED']);
const blockedStatuses = new Set(['REJECTED', 'CHANGES_REQUESTED']);
const activeStatuses = new Set(['ACCEPTED', 'IN_PROGRESS']);

function getTaskStatusLabel(status = '') {
  return String(status || 'DRAFT').replace(/_/g, ' ').toLowerCase();
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function taskAssigneeNames(task) {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  if (assignees.length === 0) return 'Unassigned';
  return assignees
    .map((member) => member.username || member.email || member.name || 'Member')
    .filter(Boolean)
    .join(', ');
}

function buildLeaderSuggestions(tasks = [], incomingPackage = null) {
  const documents = incomingPackage?.documents || [];
  const discussions = incomingPackage?.discussions || [];
  const deliverables = incomingPackage?.deliverables || [];
  const sourceText = [
    incomingPackage?.stage?.stage_name,
    ...documents.map((item) => `${item.title || ''} ${item.document_type || ''}`),
    ...discussions.map((item) => item.message || ''),
    ...deliverables.map((item) => `${item.title || ''} ${item.description || ''}`),
  ].join(' ').toLowerCase();

  const suggestions = [];

  if (sourceText.match(/require|srs|scope|mvp|user story|use case|stakeholder|survey/)) {
    suggestions.push({
      title: 'Break down previous-stage requirements',
      detail: 'Use previous documents and discussions to create clear tasks with acceptance criteria, prioritizing MVP items.',
    });
  }

  if (sourceText.match(/wireframe|ui|ux|prototype|screen|interface/)) {
    suggestions.push({
      title: 'Assign UI/UX before development',
      detail: 'Create tasks for screens, user flows, and stakeholder review before technical implementation starts.',
    });
  }

  if (sourceText.match(/api|database|erd|integration|payment|momo|cod|schema|backend/)) {
    suggestions.push({
      title: 'Separate high-risk technical work',
      detail: 'Create separate tasks for API, data, and integration work so blockers can be tracked early.',
    });
  }

  if (sourceText.match(/test|qa|performance|load|bug|peak/)) {
    suggestions.push({
      title: 'Prepare QA in parallel',
      detail: 'Add QA tasks with test cases, sample data, and performance criteria instead of waiting until the end of the stage.',
    });
  }

  const unassignedCount = tasks.filter((task) => Number(task.assignee_count || 0) === 0 && (!task.assignees || task.assignees.length === 0)).length;
  const reviewCount = tasks.filter((task) => reviewStatuses.has(task.status)).length;
  const blockedCount = tasks.filter((task) => blockedStatuses.has(task.status)).length;

  if (unassignedCount > 0) {
    suggestions.push({
      title: `${unassignedCount} tasks are unassigned`,
      detail: 'Assign these tasks first so the stage does not get stuck at the start.',
    });
  }

  if (reviewCount > 0) {
    suggestions.push({
      title: `${reviewCount} tasks need review`,
      detail: 'Review these first so members are not blocked waiting for feedback.',
    });
  }

  if (blockedCount > 0) {
    suggestions.push({
      title: `${blockedCount} tasks need unblocking`,
      detail: 'Check rejected or change-requested tasks and agree on the next action in discussions.',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Start from previous-stage handover',
      detail: 'Review the handed-over documents and discussions, then split work by module, assignee, and deadline.',
    });
  }

  return suggestions.slice(0, 5);
}
function LeaderWorkspace({ tasks, incomingPackage, currentPackage, setSelectedTask, suggestionData, loadingSuggestions }) {
  const total = tasks.length;
  const completed = tasks.filter((task) => completedStatuses.has(task.status)).length;
  const active = tasks.filter((task) => activeStatuses.has(task.status)).length;
  const review = tasks.filter((task) => reviewStatuses.has(task.status)).length;
  const blocked = tasks.filter((task) => blockedStatuses.has(task.status)).length;
  const unassigned = tasks.filter((task) => Number(task.assignee_count || 0) === 0 && (!task.assignees || task.assignees.length === 0)).length;
  const progress = percent(completed, total);
  const backendSuggestions = suggestionData?.suggestions || [];
  const suggestions = backendSuggestions.length > 0 ? backendSuggestions : buildLeaderSuggestions(tasks, incomingPackage);
  const assignmentPlan = suggestionData?.assignment_plan || [];
  const backendAttentionTasks = suggestionData?.attention_tasks || [];
  const attentionTasks = (backendAttentionTasks.length > 0 ? backendAttentionTasks : tasks
    .filter((task) => reviewStatuses.has(task.status) || blockedStatuses.has(task.status) || Number(task.assignee_count || 0) === 0)
    .slice(0, 6));
  const workload = suggestionData?.workload || [];
  const risks = suggestionData?.risks || [];
  const nextActions = suggestionData?.next_actions || [];
  const suggestionSource = suggestionData?.suggestion_source || (backendSuggestions.length > 0 ? 'data' : 'fallback');
  const sourceDocuments = incomingPackage?.documents?.length || 0;
  const sourceDiscussions = incomingPackage?.discussions?.length || 0;
  const currentDocuments = currentPackage?.documents?.length || 0;
  const currentDiscussions = currentPackage?.discussions?.length || 0;

  return (
    <div className="stage-leader-workspace">
      <section className="leader-summary-grid">
        <div className="leader-progress-card">
          <div className="leader-progress-ring" style={{ '--progress': `${progress}%` }}>
            <span>{progress}%</span>
          </div>
          <div>
            <strong>Project progress</strong>
            <small>{completed}/{total || 0} tasks completed</small>
          </div>
        </div>
        <div className="leader-stat-card">
          <span>{active}</span>
          <small>In progress</small>
        </div>
        <div className="leader-stat-card attention">
          <span>{review}</span>
          <small>Need review</small>
        </div>
        <div className="leader-stat-card danger">
          <span>{blocked}</span>
          <small>Blocked</small>
        </div>
      </section>

      <section className="leader-chart-section">
        <div className="leader-section-title">
          <BarChart3 size={16} />
          <span>Task overview</span>
        </div>
        <div className="leader-bar-list">
          {[
            ['Completed', completed, '#16a34a'],
            ['In progress', active, '#2563eb'],
            ['Need review', review, '#f59e0b'],
            ['Blocked', blocked, '#dc2626'],
            ['Unassigned', unassigned, '#64748b'],
          ].map(([label, value, color]) => (
            <div key={label} className="leader-bar-row">
              <span>{label}</span>
              <div className="leader-bar-track">
                <div style={{ width: `${percent(value, total)}%`, background: color }} />
              </div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="leader-suggestion-section">
        <div className="leader-section-title">
          <Lightbulb size={16} />
          <span>Assignment suggestions from previous stage</span>
          {loadingSuggestions && <em className="leader-loading-badge">Updating</em>}
          {!loadingSuggestions && <em className="leader-loading-badge">{suggestionSource === 'ai' ? 'AI' : 'Rules'}</em>}
        </div>
        <div className="leader-source-note">
          Based on {sourceDocuments} previous documents and {sourceDiscussions} discussions. Current stage has {currentDocuments} documents and {currentDiscussions} discussions.
        </div>
        <div className="leader-suggestion-list">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id || suggestion.title} className={`leader-suggestion-item priority-${suggestion.priority || 'medium'}`}>
              <div className="leader-suggestion-title-row">
                <strong>{suggestion.title}</strong>
                <em>{suggestion.priority || 'medium'}</em>
              </div>
              <small>{suggestion.detail}</small>
              {suggestion.recommended_member && (
                <span className="leader-recommendation-pill">
                  {suggestion.recommended_member.username || suggestion.recommended_member.email}
                  <small>{suggestion.recommended_role || suggestion.recommended_member.role}</small>
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {assignmentPlan.length > 0 && (
        <section className="leader-task-section">
          <div className="leader-section-title">
            <ClipboardCheck size={16} />
            <span>Suggested assignment plan</span>
          </div>
          <div className="leader-assignment-table">
            <div className="leader-assignment-head">
              <span>Task</span>
              <span>Assign to</span>
              <span>Priority</span>
            </div>
            {assignmentPlan.slice(0, 8).map((item) => (
              <div key={item.id || item.task_id || item.task_title} className="leader-assignment-row">
                <div className="leader-assignment-task">
                  <strong>{item.task_title}</strong>
                  <small>{item.detail}</small>
                  {item.reason && <em>{item.reason}</em>}
                </div>
                <div className="leader-assignment-member">
                  <strong>
                    {item.recommended_member?.username || item.recommended_member?.email || 'Unassigned'}
                  </strong>
                  <small>{item.recommended_role || item.recommended_member?.role || 'member'}</small>
                </div>
                <div className="leader-assignment-meta">
                  <span className={`leader-priority-pill priority-${item.priority || 'medium'}`}>
                    {item.priority || 'medium'}
                  </span>
                  <small>{item.suggested_deadline || 'Set deadline'}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(risks.length > 0 || nextActions.length > 0) && (
        <section className="leader-ai-section">
          {risks.length > 0 && (
            <div>
              <div className="leader-section-title compact">
                <AlertCircle size={15} />
                <span>AI risk notes</span>
              </div>
              <ul className="leader-note-list">
                {risks.map((risk) => <li key={risk}>{risk}</li>)}
              </ul>
            </div>
          )}
          {nextActions.length > 0 && (
            <div>
              <div className="leader-section-title compact">
                <CheckCircle2 size={15} />
                <span>Recommended next actions</span>
              </div>
              <ul className="leader-note-list">
                {nextActions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {workload.length > 0 && (
        <section className="leader-task-section">
          <div className="leader-section-title">
            <Users size={16} />
            <span>Member workload</span>
          </div>
          <div className="leader-workload-list">
            {workload.slice(0, 6).map((member) => (
              <div key={member.user_id} className="leader-workload-row">
                <span>
                  <strong>{member.username || member.email}</strong>
                  <small>{member.role}</small>
                </span>
                <em>{member.active_task_count} active</em>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="leader-task-section">
        <div className="leader-section-title">
          <Users size={16} />
          <span>Tasks for leader attention</span>
        </div>
        {attentionTasks.length === 0 ? (
          <p className="stage-muted">No urgent task needs leader attention right now.</p>
        ) : (
          <div className="leader-task-list">
            {attentionTasks.map((task) => (
              <button
                key={task.task_id || task.id}
                type="button"
                className="leader-task-row"
                onClick={() => setSelectedTask?.(task)}
              >
                <span>
                  <strong>{task.title}</strong>
                  <small>{taskAssigneeNames(task)}</small>
                </span>
                <em>{getTaskStatusLabel(task.status)}</em>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

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
  const [leaderSuggestionData, setLeaderSuggestionData] = useState(null);
  const [leaderSuggestionLoading, setLeaderSuggestionLoading] = useState(false);
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

  const refreshLeaderSuggestions = async () => {
    if (!projectId || !stageId) return;
    setLeaderSuggestionLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/stages/${stageId}/leader-suggestions`);
      setLeaderSuggestionData(res.data);
    } catch (err) {
      setLeaderSuggestionData(null);
      console.error('Cannot load leader suggestions:', err);
    } finally {
      setLeaderSuggestionLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('tasks');
    setLeaderSuggestionData(null);
    refreshOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId, stageId]);

  const currentPackage = overview?.current;
  const incomingPackage = overview?.incoming;
  const canComplete = Boolean(overview?.canCompleteStage);
  const canMoveStage = ['owner', 'leader'].includes(String(currentUserRole || '').toLowerCase());
  const isLeaderWorkspaceVisible = canMoveStage && (Number(stage?.stage_order || currentPackage?.stage?.stage_order || 0) > 1 || Boolean(incomingPackage));
  const visibleTabs = useMemo(
    () => (isLeaderWorkspaceVisible ? [...tabs, leaderTab] : tabs),
    [isLeaderWorkspaceVisible],
  );

  const deliverableSummary = useMemo(() => {
    const docs = currentPackage?.documents?.length || 0;
    const discussions = currentPackage?.discussions?.length || 0;
    return `${docs} documents, ${discussions} discussions`;
  }, [currentPackage]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab('tasks');
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'leader' || !isLeaderWorkspaceVisible || leaderSuggestionData || leaderSuggestionLoading) return;
    refreshLeaderSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLeaderWorkspaceVisible, isOpen, leaderSuggestionData, leaderSuggestionLoading, projectId, stageId]);

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
          ? `Cannot move to the next stage. Missing: ${missing.join(', ')}`
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

          <KnowledgeSection title="Information from previous stage" packageData={incomingPackage} />

          <div className="stage-tabs">
            {visibleTabs.map((tab) => {
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

              {activeTab === 'leader' && isLeaderWorkspaceVisible && (
                <div className="stage-tab-panel leader-tab-panel">
                  <LeaderWorkspace
                    tasks={tasks}
                    incomingPackage={incomingPackage}
                    currentPackage={currentPackage}
                    setSelectedTask={setSelectedTask}
                    suggestionData={leaderSuggestionData}
                    loadingSuggestions={leaderSuggestionLoading}
                  />
                </div>
              )}
            </>
          )}

          <KnowledgeSection title="Handover information for next stage" packageData={currentPackage} />
        </div>

        <div className="panel-footer">
          <div className="stage-deliverable-summary">{deliverableSummary}</div>
          <button
            type="button"
            className="stage-complete-btn"
            disabled={submitting || !canComplete || !canMoveStage}
            onClick={completeStage}
            title={!canMoveStage ? 'Only owner or leader can move stages' : !overview?.canCompleteStage ? 'You do not have permission to move this stage' : 'Complete stage'}
          >
            <CheckCircle2 size={17} />
            Move to next stage
          </button>
        </div>
      </div>
    </div>
  );
}
