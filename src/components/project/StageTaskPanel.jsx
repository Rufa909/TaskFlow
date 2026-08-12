import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
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
import { useLanguage } from '../../context/LanguageContext';
import { formatLocalDate, parseLocalDate } from '../../utils/dateTime';
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

const leaderCopy = {
  en: {
    languageLabel: 'Language selector',
    projectProgress: 'Project progress',
    tasksCompleted: 'tasks completed',
    inProgress: 'In progress',
    needReview: 'Need review',
    blocked: 'Blocked',
    taskOverview: 'Task overview',
    completed: 'Completed',
    unassigned: 'Unassigned',
    assignmentSuggestions: 'Assignment suggestions from previous stage',
    updating: 'Updating',
    basedOn: 'Based on',
    previousDocuments: 'previous documents',
    and: 'and',
    discussions: 'discussions',
    currentStageHas: 'Current stage has',
    documents: 'documents',
    suggestedAssignmentPlan: 'Suggested assignment plan',
    task: 'Task',
    assignTo: 'Assign to',
    priority: 'Priority',
    setDeadline: 'Set deadline',
    member: 'member',
    aiRiskNotes: 'AI risk notes',
    recommendedNextActions: 'Recommended next actions',
    memberWorkload: 'Member workload',
    active: 'active',
    deadlineReminder: 'Tasks close to deadline',
    overdue: 'Overdue',
    dueToday: 'Due today',
    daysLeft: (days) => `${days} day${days === 1 ? '' : 's'} left`,
    tasksForLeaderAttention: 'Tasks for leader attention',
    noUrgentTask: 'No urgent task needs leader attention right now.',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    rules: 'Rules',
    informationFromPreviousStage: 'Information from previous stage',
    handoverForNextStage: 'Handover information for next stage',
    noPreviousStageInformation: 'No previous stage information.',
    noDocuments: 'No documents.',
    noDiscussions: 'No discussions.',
    moveToNextStage: 'Move to next stage',
    documentSummary: (docs, discussions) => `${docs} documents, ${discussions} discussions`,
  },
  vi: {
    languageLabel: 'Chọn ngôn ngữ',
    projectProgress: 'Tiến độ dự án',
    tasksCompleted: 'công việc đã hoàn thành',
    inProgress: 'Đang làm',
    needReview: 'Cần duyệt',
    blocked: 'Đang bị kẹt',
    taskOverview: 'Tổng quan công việc',
    completed: 'Hoàn thành',
    unassigned: 'Chưa giao',
    assignmentSuggestions: 'Gợi ý phân công từ giai đoạn trước',
    updating: 'Đang cập nhật',
    basedOn: 'Dựa trên',
    previousDocuments: 'tài liệu giai đoạn trước',
    and: 'và',
    discussions: 'thảo luận',
    currentStageHas: 'Giai đoạn hiện tại có',
    documents: 'tài liệu',
    suggestedAssignmentPlan: 'Kế hoạch phân công gợi ý',
    task: 'Công việc',
    assignTo: 'Giao cho',
    priority: 'Ưu tiên',
    setDeadline: 'Đặt hạn',
    member: 'thành viên',
    aiRiskNotes: 'Rủi ro AI ghi nhận',
    recommendedNextActions: 'Hành động nên làm tiếp',
    memberWorkload: 'Khối lượng của thành viên',
    active: 'đang làm',
    tasksForLeaderAttention: 'Việc leader cần chú ý',
    noUrgentTask: 'Hiện chưa có công việc khẩn cấp cần leader chú ý.',
    high: 'Cao',
    medium: 'Vừa',
    low: 'Thấp',
    rules: 'Luật',
    informationFromPreviousStage: 'Thông tin từ giai đoạn trước',
    handoverForNextStage: 'Thông tin bàn giao cho giai đoạn tiếp theo',
    noPreviousStageInformation: 'Chưa có thông tin từ giai đoạn trước.',
    noDocuments: 'Chưa có tài liệu.',
    noDiscussions: 'Chưa có thảo luận.',
    moveToNextStage: 'Chuyển sang giai đoạn tiếp theo',
    documentSummary: (docs, discussions) => `${docs} tài liệu, ${discussions} thảo luận`,
  },
};

leaderCopy.vi.deadlineReminder = 'Công việc sắp hết hạn';
leaderCopy.vi.overdue = 'Quá hạn';
leaderCopy.vi.dueToday = 'Hạn hôm nay';
leaderCopy.vi.daysLeft = (days) => `Còn ${days} ngày`;

function repairMojibake(value) {
  if (typeof value !== 'string') return value;
  if (!/[ÃÄÆÂÅ]|[\u0080-\u009f]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const originalBadness = (value.match(/[ÃÄÆÂÅ]|[\u0080-\u009f]/g) || []).length;
    const decodedBadness = (decoded.match(/[ÃÄÆÂÅ]|[\u0080-\u009f]/g) || []).length;
    return decodedBadness < originalBadness ? decoded : value;
  } catch {
    return value;
  }
}

function getLeaderCopy(language, key) {
  const value = leaderCopy[language]?.[key] || leaderCopy.en[key] || key;
  if (typeof value === 'function') {
    return (...args) => repairMojibake(value(...args));
  }
  return repairMojibake(value);
}

function getPriorityLabel(priority, language = 'en') {
  const key = String(priority || 'medium').toLowerCase();
  if (key === 'high') return getLeaderCopy(language, 'high');
  if (key === 'low') return getLeaderCopy(language, 'low');
  return getLeaderCopy(language, 'medium');
}

const leaderTextTranslations = {
  'Turn previous-stage requirements into implementation tasks': 'Chuyển yêu cầu giai đoạn trước thành việc triển khai',
  'Use the handed-over requirements, MVP scope, and use cases to create module-level tasks with acceptance criteria.': 'Dựa vào yêu cầu bàn giao, phạm vi MVP và use case để tạo các việc theo module kèm tiêu chí hoàn thành.',
  'Separate API, database, and integration tasks': 'Tách riêng việc API, database và tích hợp',
  'Data, API, and payment or integration work should have separate owners and early review checkpoints.': 'Các phần dữ liệu, API, thanh toán hoặc tích hợp nên có người phụ trách riêng và mốc review sớm.',
  'Prepare QA in parallel with implementation': 'Chuẩn bị QA song song với triển khai',
  'Create tasks for test cases, sample data, and performance checks early instead of pushing QA to the end.': 'Tạo việc cho test case, dữ liệu mẫu và kiểm tra hiệu năng từ sớm thay vì dồn QA về cuối.',
  'Prioritize UI/UX tasks before development': 'Ưu tiên việc UI/UX trước khi phát triển',
  'Assign ownership for screen flows, wireframes, and UI review to reduce rework after backend work is done.': 'Giao rõ người phụ trách luồng màn hình, wireframe và review UI để giảm việc làm lại sau khi backend hoàn tất.',
  'Convert requirements into implementation backlog': 'Chuyển yêu cầu thành backlog triển khai',
  'Break stage 1 scope, MVP items, and acceptance criteria into development-ready tasks.': 'Tách phạm vi giai đoạn 1, các mục MVP và tiêu chí hoàn thành thành những việc sẵn sàng để phát triển.',
  'Prepare UI/UX flow for key screens': 'Chuẩn bị luồng UI/UX cho các màn hình chính',
  'Draft screen flow, state handling, and review notes before implementation starts.': 'Phác thảo luồng màn hình, trạng thái xử lý và ghi chú review trước khi bắt đầu triển khai.',
  'Design API, database, and integration plan': 'Thiết kế kế hoạch API, database và tích hợp',
  'Define endpoints, schema changes, external integration risks, and review checkpoints.': 'Xác định endpoint, thay đổi schema, rủi ro tích hợp bên ngoài và các mốc review.',
  'Create QA checklist and test data': 'Tạo checklist QA và dữ liệu kiểm thử',
  'Prepare test cases, sample data, and performance checks in parallel with implementation.': 'Chuẩn bị test case, dữ liệu mẫu và kiểm tra hiệu năng song song với quá trình triển khai.',
  '1-2 days': '1-2 ngày',
  '2-3 days': '2-3 ngày',
  '3-4 days': '3-4 ngày',
  'Set after leader review': 'Đặt sau khi leader rà soát',
  'Use the task deadline': 'Dùng hạn của công việc',
  'Recommended from previous-stage context and current workload.': 'Được đề xuất dựa trên ngữ cảnh giai đoạn trước và khối lượng công việc hiện tại.',
};

function localizeLeaderText(value, language = 'en') {
  const repaired = repairMojibake(value);
  if (language !== 'vi') return repaired;
  const text = String(repaired || '').trim();
  const activeMatch = text.match(/^(.+) has (\d+) active task\(s\), so this keeps workload balanced\.$/i);
  if (activeMatch) {
    return repairMojibake(`${activeMatch[1]} đang có ${activeMatch[2]} công việc đang làm, nên phân công như vậy giúp cân bằng khối lượng.`);
  }
  return repairMojibake(leaderTextTranslations[text] || repaired);
}

function localizeLeaderRole(role, language = 'en') {
  const repaired = repairMojibake(role);
  if (language !== 'vi') return repaired;
  const value = String(repaired || '').toLowerCase();
  if (value === 'developer/devops') return 'Developer/DevOps';
  if (value === 'developer/ba') return 'Developer/BA';
  if (value === 'leader/member') return 'Leader/Thành viên';
  if (value === 'member') return 'Thành viên';
  if (value === 'owner') return 'Owner';
  if (value === 'leader') return 'Leader';
  if (value === 'qa') return 'QA';
  if (value === 'ba') return 'BA';
  return repaired;
}

function getTaskStatusLabel(status = '') {
  return String(status || 'DRAFT').replace(/_/g, ' ').toLowerCase();
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function taskAssigneeNames(task, language = 'en') {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  if (assignees.length === 0 && task?.assignee_names) return task.assignee_names;
  if (assignees.length === 0) return getLeaderCopy(language, 'unassigned');
  return assignees
    .map((member) => member.username || member.email || member.name || 'Member')
    .filter(Boolean)
    .join(', ');
}

function buildDueSoonTasks(tasks = [], windowDays = 3) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);

  return tasks
    .map((task) => {
      const deadline = parseLocalDate(task.deadline);
      if (!deadline || completedStatuses.has(task.status)) return null;
      if (deadline > windowEnd) return null;
      const daysRemaining = Math.ceil((deadline - today) / (24 * 60 * 60 * 1000));
      return {
        ...task,
        days_remaining: daysRemaining,
        deadline_status: daysRemaining < 0 ? 'overdue' : 'due_soon',
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseLocalDate(a.deadline) - parseLocalDate(b.deadline))
    .slice(0, 8);
}

function getDeadlineReminderLabel(task, language = 'en') {
  let days = Number(task.days_remaining);
  if (!Number.isFinite(days)) {
    const deadline = parseLocalDate(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    days = deadline ? Math.ceil((deadline - today) / (24 * 60 * 60 * 1000)) : 0;
  }
  if (task.deadline_status === 'overdue' || days < 0) return getLeaderCopy(language, 'overdue');
  if (days === 0) return getLeaderCopy(language, 'dueToday');
  if (typeof getLeaderCopy(language, 'daysLeft') === 'function') {
    return getLeaderCopy(language, 'daysLeft')(days);
  }
  return `${days} days left`;
}

function buildLeaderSuggestions(tasks = [], incomingPackage = null, language = 'en') {
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
      title: language === 'vi' ? 'Tách yêu cầu từ giai đoạn trước' : 'Break down previous-stage requirements',
      detail: language === 'vi'
        ? 'Dựa vào tài liệu và thảo luận trước đó để tạo công việc rõ ràng kèm tiêu chí hoàn thành, ưu tiên các mục MVP.'
        : 'Use previous documents and discussions to create clear tasks with acceptance criteria, prioritizing MVP items.',
    });
  }

  if (sourceText.match(/wireframe|ui|ux|prototype|screen|interface/)) {
    suggestions.push({
      title: language === 'vi' ? 'Giao UI/UX trước khi phát triển' : 'Assign UI/UX before development',
      detail: language === 'vi'
        ? 'Tạo việc cho màn hình, luồng người dùng và review với stakeholder trước khi bắt đầu triển khai kỹ thuật.'
        : 'Create tasks for screens, user flows, and stakeholder review before technical implementation starts.',
    });
  }

  if (sourceText.match(/api|database|erd|integration|payment|momo|cod|schema|backend/)) {
    suggestions.push({
      title: language === 'vi' ? 'Tách riêng các việc kỹ thuật rủi ro cao' : 'Separate high-risk technical work',
      detail: language === 'vi'
        ? 'Tạo việc riêng cho API, dữ liệu và tích hợp để phát hiện blocker từ sớm.'
        : 'Create separate tasks for API, data, and integration work so blockers can be tracked early.',
    });
  }

  if (sourceText.match(/test|qa|performance|load|bug|peak/)) {
    suggestions.push({
      title: language === 'vi' ? 'Chuẩn bị QA song song' : 'Prepare QA in parallel',
      detail: language === 'vi'
        ? 'Thêm việc QA với test case, dữ liệu mẫu và tiêu chí hiệu năng thay vì chờ đến cuối giai đoạn.'
        : 'Add QA tasks with test cases, sample data, and performance criteria instead of waiting until the end of the stage.',
    });
  }

  const unassignedCount = tasks.filter((task) => Number(task.assignee_count || 0) === 0 && (!task.assignees || task.assignees.length === 0)).length;
  const reviewCount = tasks.filter((task) => reviewStatuses.has(task.status)).length;
  const blockedCount = tasks.filter((task) => blockedStatuses.has(task.status)).length;

  if (unassignedCount > 0) {
    suggestions.push({
      title: language === 'vi' ? `${unassignedCount} công việc chưa được giao` : `${unassignedCount} tasks are unassigned`,
      detail: language === 'vi' ? 'Hãy giao các việc này trước để giai đoạn không bị kẹt ngay từ đầu.' : 'Assign these tasks first so the stage does not get stuck at the start.',
    });
  }

  if (reviewCount > 0) {
    suggestions.push({
      title: language === 'vi' ? `${reviewCount} công việc cần duyệt` : `${reviewCount} tasks need review`,
      detail: language === 'vi' ? 'Duyệt các việc này trước để thành viên không bị kẹt khi chờ phản hồi.' : 'Review these first so members are not blocked waiting for feedback.',
    });
  }

  if (blockedCount > 0) {
    suggestions.push({
      title: language === 'vi' ? `${blockedCount} công việc đang bị kẹt` : `${blockedCount} tasks need unblocking`,
      detail: language === 'vi' ? 'Kiểm tra các việc bị từ chối hoặc yêu cầu chỉnh sửa, rồi thống nhất bước tiếp theo trong thảo luận.' : 'Check rejected or change-requested tasks and agree on the next action in discussions.',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: language === 'vi' ? 'Bắt đầu từ dữ liệu bàn giao giai đoạn trước' : 'Start from previous-stage handover',
      detail: language === 'vi'
        ? 'Rà soát tài liệu và thảo luận được bàn giao, sau đó tách việc theo module, người phụ trách và hạn hoàn thành.'
        : 'Review the handed-over documents and discussions, then split work by module, assignee, and deadline.',
    });
  }

  return suggestions.slice(0, 5);
}
function LeaderWorkspace({ tasks, incomingPackage, currentPackage, setSelectedTask, suggestionData, loadingSuggestions, language, setLanguage }) {
  const lt = (key) => getLeaderCopy(language, key);
  const total = tasks.length;
  const completed = tasks.filter((task) => completedStatuses.has(task.status)).length;
  const active = tasks.filter((task) => activeStatuses.has(task.status)).length;
  const review = tasks.filter((task) => reviewStatuses.has(task.status)).length;
  const blocked = tasks.filter((task) => blockedStatuses.has(task.status)).length;
  const unassigned = tasks.filter((task) => Number(task.assignee_count || 0) === 0 && (!task.assignees || task.assignees.length === 0)).length;
  const progress = percent(completed, total);
  const backendSuggestions = suggestionData?.suggestions || [];
  const suggestions = backendSuggestions.length > 0 ? backendSuggestions : buildLeaderSuggestions(tasks, incomingPackage, language);
  const assignmentPlan = suggestionData?.assignment_plan || [];
  const localizedSuggestions = suggestions.map((suggestion) => ({
    ...suggestion,
    title: localizeLeaderText(suggestion.title, language),
    detail: localizeLeaderText(suggestion.detail, language),
    recommended_role: localizeLeaderRole(suggestion.recommended_role, language),
    recommended_member: suggestion.recommended_member
      ? {
          ...suggestion.recommended_member,
          role: localizeLeaderRole(suggestion.recommended_member.role, language),
        }
      : suggestion.recommended_member,
  }));
  const localizedAssignmentPlan = assignmentPlan.map((item) => ({
    ...item,
    task_title: localizeLeaderText(item.task_title, language),
    detail: localizeLeaderText(item.detail, language),
    reason: localizeLeaderText(item.reason, language),
    suggested_deadline: localizeLeaderText(item.suggested_deadline, language),
    recommended_role: localizeLeaderRole(item.recommended_role, language),
    recommended_member: item.recommended_member
      ? {
          ...item.recommended_member,
          role: localizeLeaderRole(item.recommended_member.role, language),
        }
      : item.recommended_member,
  }));
  const backendAttentionTasks = suggestionData?.attention_tasks || [];
  const backendDueSoonTasks = suggestionData?.due_soon_tasks || [];
  const dueSoonTasks = backendDueSoonTasks.length > 0
    ? backendDueSoonTasks
    : buildDueSoonTasks(tasks);
  const fallbackAttentionTasks = [
    ...dueSoonTasks,
    ...tasks.filter((task) => reviewStatuses.has(task.status) || blockedStatuses.has(task.status) || Number(task.assignee_count || 0) === 0),
  ].filter((task, index, list) => list.findIndex((item) => item.task_id === task.task_id) === index);
  const attentionTasks = (backendAttentionTasks.length > 0 ? backendAttentionTasks : fallbackAttentionTasks.slice(0, 6));
  const workload = suggestionData?.workload || [];
  const risks = suggestionData?.risks || [];
  const nextActions = suggestionData?.next_actions || [];
  const localizedRisks = risks.map((risk) => localizeLeaderText(risk, language));
  const localizedNextActions = nextActions.map((action) => localizeLeaderText(action, language));
  const suggestionSource = suggestionData?.suggestion_source || (backendSuggestions.length > 0 ? 'data' : 'fallback');
  const sourceDocuments = incomingPackage?.documents?.length || 0;
  const sourceDiscussions = incomingPackage?.discussions?.length || 0;
  const currentDocuments = currentPackage?.documents?.length || 0;
  const currentDiscussions = currentPackage?.discussions?.length || 0;

  return (
    <div className="stage-leader-workspace">
      <div className="leader-toolbar">
        <div className="leader-language-switch" aria-label={lt('languageLabel')}>
          <button
            type="button"
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={language === 'vi' ? 'active' : ''}
            onClick={() => setLanguage('vi')}
          >
            VI
          </button>
        </div>
      </div>

      <section className="leader-summary-grid">
        <div className="leader-progress-card">
          <div className="leader-progress-ring" style={{ '--progress': `${progress}%` }}>
            <span>{progress}%</span>
          </div>
          <div>
            <strong>{lt('projectProgress')}</strong>
            <small>{completed}/{total || 0} {lt('tasksCompleted')}</small>
          </div>
        </div>
        <div className="leader-stat-card">
          <span>{active}</span>
          <small>{lt('inProgress')}</small>
        </div>
        <div className="leader-stat-card attention">
          <span>{review}</span>
          <small>{lt('needReview')}</small>
        </div>
        <div className="leader-stat-card danger">
          <span>{blocked}</span>
          <small>{lt('blocked')}</small>
        </div>
      </section>

      <section className="leader-chart-section">
        <div className="leader-section-title">
          <BarChart3 size={16} />
          <span>{lt('taskOverview')}</span>
        </div>
        <div className="leader-bar-list">
          {[
            [lt('completed'), completed, '#16a34a'],
            [lt('inProgress'), active, '#2563eb'],
            [lt('needReview'), review, '#f59e0b'],
            [lt('blocked'), blocked, '#dc2626'],
            [lt('unassigned'), unassigned, '#64748b'],
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
          <span>{lt('assignmentSuggestions')}</span>
          {loadingSuggestions && <em className="leader-loading-badge">{lt('updating')}</em>}
          {!loadingSuggestions && <em className="leader-loading-badge">{suggestionSource === 'ai' ? 'AI' : lt('rules')}</em>}
        </div>
        <div className="leader-source-note">
          {lt('basedOn')} {sourceDocuments} {lt('previousDocuments')} {lt('and')} {sourceDiscussions} {lt('discussions')}. {lt('currentStageHas')} {currentDocuments} {lt('documents')} {lt('and')} {currentDiscussions} {lt('discussions')}.
        </div>
        <div className="leader-suggestion-list">
          {localizedSuggestions.map((suggestion) => (
            <div key={suggestion.id || suggestion.title} className={`leader-suggestion-item priority-${suggestion.priority || 'medium'}`}>
              <div className="leader-suggestion-title-row">
                <strong>{suggestion.title}</strong>
                <em>{getPriorityLabel(suggestion.priority, language)}</em>
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

      {localizedAssignmentPlan.length > 0 && (
        <section className="leader-task-section">
          <div className="leader-section-title">
            <ClipboardCheck size={16} />
            <span>{lt('suggestedAssignmentPlan')}</span>
          </div>
          <div className="leader-assignment-table">
            <div className="leader-assignment-head">
              <span>{lt('task')}</span>
              <span>{lt('assignTo')}</span>
              <span>{lt('priority')}</span>
            </div>
            {localizedAssignmentPlan.slice(0, 8).map((item) => (
              <div key={item.id || item.task_id || item.task_title} className="leader-assignment-row">
                <div className="leader-assignment-task">
                  <strong>{item.task_title}</strong>
                  <small>{item.detail}</small>
                  {item.reason && <em>{item.reason}</em>}
                </div>
                <div className="leader-assignment-member">
                  <strong>
                    {item.recommended_member?.username || item.recommended_member?.email || lt('unassigned')}
                  </strong>
                  <small>{item.recommended_role || item.recommended_member?.role || lt('member')}</small>
                </div>
                <div className="leader-assignment-meta">
                  <span className={`leader-priority-pill priority-${item.priority || 'medium'}`}>
                    {getPriorityLabel(item.priority, language)}
                  </span>
                  <small>{item.suggested_deadline || lt('setDeadline')}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(localizedRisks.length > 0 || localizedNextActions.length > 0) && (
        <section className="leader-ai-section">
          {localizedRisks.length > 0 && (
            <div>
              <div className="leader-section-title compact">
                <AlertCircle size={15} />
                <span>{lt('aiRiskNotes')}</span>
              </div>
              <ul className="leader-note-list">
                {localizedRisks.map((risk) => <li key={risk}>{risk}</li>)}
              </ul>
            </div>
          )}
          {localizedNextActions.length > 0 && (
            <div>
              <div className="leader-section-title compact">
                <CheckCircle2 size={15} />
                <span>{lt('recommendedNextActions')}</span>
              </div>
              <ul className="leader-note-list">
                {localizedNextActions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {dueSoonTasks.length > 0 && (
        <section className="leader-task-section leader-deadline-section">
          <div className="leader-section-title">
            <CalendarClock size={16} />
            <span>{lt('deadlineReminder')}</span>
          </div>
          <div className="leader-task-list">
            {dueSoonTasks.map((task) => (
              <button
                key={task.task_id || task.id}
                type="button"
                className={`leader-task-row deadline-${task.deadline_status || 'due_soon'}`}
                onClick={() => setSelectedTask?.(task)}
              >
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {taskAssigneeNames(task, language)}
                    {task.deadline && ` - ${formatLocalDate(task.deadline)}`}
                  </small>
                </span>
                <em>{getDeadlineReminderLabel(task, language)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {workload.length > 0 && (
        <section className="leader-task-section">
          <div className="leader-section-title">
            <Users size={16} />
            <span>{lt('memberWorkload')}</span>
          </div>
          <div className="leader-workload-list">
            {workload.slice(0, 6).map((member) => (
              <div key={member.user_id} className="leader-workload-row">
                <span>
                  <strong>{member.username || member.email}</strong>
                  <small>{member.role}</small>
                </span>
                <em>{member.active_task_count} {lt('active')}</em>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="leader-task-section">
        <div className="leader-section-title">
          <Users size={16} />
          <span>{lt('tasksForLeaderAttention')}</span>
        </div>
        {attentionTasks.length === 0 ? (
          <p className="stage-muted">{lt('noUrgentTask')}</p>
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
                  <small>{taskAssigneeNames(task, language)}</small>
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

function KnowledgeSection({ title, packageData, language }) {
  const lt = (key) => getLeaderCopy(language, key);
  const documents = packageData?.documents || [];
  const discussions = packageData?.discussions || [];

  return (
    <section className="stage-knowledge-section">
      <div className="stage-knowledge-title">{title}</div>
      {!packageData ? (
        <p className="stage-muted">{lt('noPreviousStageInformation')}</p>
      ) : (
        <div className="stage-knowledge-grid">
          <div>
            <span className="stage-mini-label">{lt('documents')}</span>
            {documents.length === 0 ? (
              <p className="stage-muted">{lt('noDocuments')}</p>
            ) : (
              documents.slice(0, 4).map((item) => (
                <a key={item.document_id} className="stage-link-line" href={assetUrl(item.file_url)} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ))
            )}
          </div>
          <div>
            <span className="stage-mini-label">{lt('discussions')}</span>
            {discussions.length === 0 ? (
              <p className="stage-muted">{lt('noDiscussions')}</p>
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
  const { language, setLanguage } = useLanguage();
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
      const res = await api.get(`/projects/${projectId}/stages/${stageId}/leader-suggestions`, {
        params: { language },
      });
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
  const isLeaderWorkspaceVisible = canMoveStage;
  const visibleTabs = useMemo(
    () => (isLeaderWorkspaceVisible ? [...tabs, leaderTab] : tabs),
    [isLeaderWorkspaceVisible],
  );

  const deliverableSummary = useMemo(() => {
    const docs = currentPackage?.documents?.length || 0;
    const discussions = currentPackage?.discussions?.length || 0;
    const summary = getLeaderCopy(language, 'documentSummary');
    return typeof summary === 'function' ? summary(docs, discussions) : `${docs} documents, ${discussions} discussions`;
  }, [currentPackage, language]);

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

  useEffect(() => {
    if (!isOpen || activeTab !== 'leader' || !isLeaderWorkspaceVisible) return;
    setLeaderSuggestionData(null);
    refreshLeaderSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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

          <KnowledgeSection title={getLeaderCopy(language, 'informationFromPreviousStage')} packageData={incomingPackage} language={language} />

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
                    language={language}
                    setLanguage={setLanguage}
                  />
                </div>
              )}
            </>
          )}

          <KnowledgeSection title={getLeaderCopy(language, 'handoverForNextStage')} packageData={currentPackage} language={language} />
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
            {getLeaderCopy(language, 'moveToNextStage')}
          </button>
        </div>
      </div>
    </div>
  );
}
