import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Icon from "../components/common/Icon";
import "./AdminPage.css";

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "activity", description: "System-wide health, workload, risk, and recent movement." },
  { id: "users", label: "Users", icon: "users", description: "Manage accounts, access state, workload, projects, and tasks." },
  { id: "groups", label: "Groups", icon: "teamAdd", description: "Review active chat groups visible in TaskFlow." },
  { id: "projects", label: "Projects", icon: "grid", description: "Track project ownership, health, deadline risk, and progress." },
  { id: "tasks", label: "Tasks", icon: "check", description: "Search and inspect all active system tasks." },
  { id: "workflows", label: "Workflows", icon: "share", description: "Identify delayed stages and current workflow bottlenecks." },
  { id: "monitoring", label: "Monitoring", icon: "flag", description: "Operational issue queue by severity." },
  { id: "activity", label: "Activity Logs", icon: "clock", description: "System audit trail with searchable actions." },
];

const DONE_STATUSES = new Set(["COMPLETED", "OWNER_APPROVED"]);
const BLOCKED_STATUSES = new Set(["CHANGES_REQUESTED", "REJECTED", "BLOCKED"]);
const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "ACCEPTED", "ASSIGNED", "SUBMITTED", "LEADER_APPROVED"]);
const MONITORING_SUMMARY_ITEMS = [
  { label: "Overdue Tasks", types: ["Overdue Task"] },
  { label: "Blocked Tasks", types: ["Blocked Task"] },
  { label: "Delayed Stages", types: ["Delayed Stage"] },
  { label: "Projects At Risk", types: ["Project At Risk"] },
  { label: "Users Overloaded", types: ["User Overloaded"] },
  { label: "Workflow Bottlenecks", types: ["Workflow Bottleneck"] },
];

const ADMIN_VI = {
  "Dashboard": "Tổng quan",
  "Users": "Người dùng",
  "Groups": "Nhóm",
  "Projects": "Dự án",
  "Tasks": "Công việc",
  "Workflows": "Quy trình",
  "Monitoring": "Giám sát",
  "Reports": "Báo cáo",
  "Activity Logs": "Nhật ký hoạt động",
  "Settings": "Cài đặt",
  "System-wide health, workload, risk, and recent movement.": "Theo dõi sức khỏe hệ thống, khối lượng công việc, rủi ro và hoạt động gần đây.",
  "Manage accounts, access state, workload, projects, and tasks.": "Quản lý tài khoản, trạng thái truy cập, khối lượng việc, dự án và công việc.",
  "Review active chat groups visible in TaskFlow.": "Xem các nhóm chat đang tồn tại trên website.",
  "Track project ownership, health, deadline risk, and progress.": "Theo dõi chủ sở hữu, sức khỏe, rủi ro deadline và tiến độ dự án.",
  "Search and inspect all active system tasks.": "Tìm kiếm và kiểm tra toàn bộ công việc trong hệ thống.",
  "Identify delayed stages and current workflow bottlenecks.": "Xác định stage bị trễ và điểm nghẽn hiện tại của workflow.",
  "Operational issue queue by severity.": "Danh sách vấn đề vận hành theo mức độ nghiêm trọng.",
  "Completion, overdue, workload, and performance analytics.": "Phân tích hoàn thành, quá hạn, workload và hiệu suất.",
  "System audit trail with searchable actions.": "Nhật ký kiểm toán hệ thống có thể tìm kiếm theo hành động.",
  "System-level configuration surfaces.": "Các thiết lập cấp hệ thống.",
  "Admin Console": "Bảng quản trị",
  "Admin": "Quản trị",
  "Sign out": "Đăng xuất",
  "Refresh": "Làm mới",
  "Loading admin dashboard...": "Đang tải bảng quản trị...",
  "Cannot load admin dashboard.": "Không thể tải bảng quản trị.",
  "System is stable": "Hệ thống ổn định",
  "projects need attention": "dự án cần chú ý",
  "overdue tasks": "công việc quá hạn",
  "blocked tasks": "công việc bị kẹt",
  "verified users": "người dùng đã xác minh",
  "API connected": "Đã kết nối API",
  "API fallback": "Đang dùng dữ liệu dự phòng",
  "Derived workflow analytics": "Phân tích workflow suy luận",
  "Total Users": "Tổng người dùng",
  "Total Groups": "Tổng nhóm",
  "Total Projects": "Tổng dự án",
  "Total Tasks": "Tổng công việc",
  "Completed Tasks": "Công việc hoàn thành",
  "Overdue Tasks": "Công việc quá hạn",
  "Blocked Tasks": "Công việc bị kẹt",
  "Projects At Risk": "Dự án rủi ro",
  "Monthly Trend": "Xu hướng theo tháng",
  "Task Status": "Trạng thái công việc",
  "Project Progress": "Tiến độ dự án",
  "User Workload": "Khối lượng người dùng",
  "Assigned Tasks by User": "Task đang giao theo người",
  "Recent Activities": "Hoạt động gần đây",
  "Overdue / Blocked Tasks": "Công việc quá hạn / bị kẹt",
  "No monthly trend data": "Chưa có dữ liệu xu hướng theo tháng",
  "No chart data": "Chưa có dữ liệu biểu đồ",
  "No projects": "Chưa có dự án",
  "No workload data": "Chưa có dữ liệu workload",
  "No activities": "Chưa có hoạt động",
  "No projects at risk": "Không có dự án rủi ro",
  "No overdue or blocked tasks": "Không có công việc quá hạn hoặc bị kẹt",
  "Completed": "Hoàn thành",
  "Tasks": "Công việc",
  "completed": "hoàn thành",
  "created task": "đã tạo công việc",
  "created project": "đã tạo dự án",
  "overdue": "quá hạn",
  "active": "đang hoạt động",
  "User Management": "Quản lý người dùng",
  "Add User": "Thêm người dùng",
  "Search": "Tìm kiếm",
  "All status": "Tất cả trạng thái",
  "Active": "Đang hoạt động",
  "Pending": "Đang chờ",
  "Locked": "Đã khóa",
  "Inactive": "Không còn hoạt động",
  "Admin": "Quản trị",
  "Owner": "Chủ sở hữu",
  "Member": "Thành viên",
  "Name": "Tên",
  "Email": "Email",
  "Role": "Vai trò",
  "Status": "Trạng thái",
  "Last Active": "Hoạt động gần nhất",
  "Actions": "Hành động",
  "View": "Xem",
  "Edit": "Sửa",
  "Lock": "Khóa",
  "Lock this user?": "Khóa người dùng này? Người dùng sẽ không thể đăng nhập.",
  "Cannot lock user.": "Không thể khóa người dùng.",
  "No users found": "Không tìm thấy người dùng",
  "Chat group": "Nhóm chat",
  "Open chat": "Mở chat",
  "Last message": "Tin nhắn cuối",
  "Disbanded": "Đã giải tán",
  "No chat groups found": "Không tìm thấy nhóm chat",
  "All types": "Tất cả loại",
  "members": "thành viên",
  "projects": "dự án",
  "Members": "Thành viên",
  "Project Name": "Tên dự án",
  "Group": "Nhóm",
  "Progress": "Tiến độ",
  "Deadline": "Hạn chót",
  "Created At": "Ngày tạo",
  "All projects": "Tất cả dự án",
  "Completed": "Hoàn thành",
  "Archived": "Đã lưu trữ",
  "At Risk": "Rủi ro",
  "On Track": "Đúng tiến độ",
  "Delayed": "Bị trễ",
  "No projects found": "Không tìm thấy dự án",
  "Task": "Công việc",
  "Project": "Dự án",
  "Assignee": "Người phụ trách",
  "Priority": "Ưu tiên",
  "All users": "Tất cả người dùng",
  "All priority": "Tất cả ưu tiên",
  "Low": "Thấp",
  "Medium": "Trung bình",
  "High": "Cao",
  "Urgent": "Khẩn cấp",
  "All deadlines": "Tất cả deadline",
  "Due soon": "Sắp hết hạn",
  "No deadline": "Không có deadline",
  "Clear": "Xóa hạn",
  "Detail": "Chi tiết",
  "No tasks found": "Không tìm thấy công việc",
  "No bottleneck": "Không có điểm nghẽn",
  "Bottleneck": "Điểm nghẽn",
  "Owner:": "Phụ trách:",
  "Processing:": "Xử lý:",
  "Deadline:": "Hạn chót:",
  "Average processing time:": "Thời gian xử lý trung bình:",
  "Current bottleneck:": "Điểm nghẽn hiện tại:",
  "No workflows found": "Không tìm thấy workflow",
  "System Monitoring": "Giám sát hệ thống",
  "Delayed Stages": "Stage bị trễ",
  "Users Overloaded": "Người dùng quá tải",
  "Workflow Bottlenecks": "Điểm nghẽn workflow",
  "Overdue Task": "Công việc quá hạn",
  "Blocked Task": "Công việc bị kẹt",
  "Project At Risk": "Dự án rủi ro",
  "User Overloaded": "Người dùng quá tải",
  "Workflow Bottleneck": "Điểm nghẽn workflow",
  "Issue": "Vấn đề",
  "Scope": "Phạm vi",
  "Type": "Loại",
  "Severity": "Mức độ",
  "Critical": "Nghiêm trọng",
  "Warning": "Cảnh báo",
  "Normal": "Bình thường",
  "No active issues": "Không có vấn đề đang hoạt động",
  "Reports & Analytics": "Báo cáo & phân tích",
  "Today": "Hôm nay",
  "7 Days": "7 ngày",
  "30 Days": "30 ngày",
  "3 Months": "3 tháng",
  "Custom": "Tùy chỉnh",
  "Task Completion Rate": "Tỷ lệ hoàn thành công việc",
  "Project Completion Rate": "Tỷ lệ hoàn thành dự án",
  "Overdue Rate": "Tỷ lệ quá hạn",
  "Average Task Completion Time": "Thời gian hoàn thành task trung bình",
  "Average Workflow Processing Time": "Thời gian xử lý workflow trung bình",
  "Task Completion": "Hoàn thành công việc",
  "Project Performance": "Hiệu suất dự án",
  "All actions": "Tất cả hành động",
  "Time": "Thời gian",
  "User": "Người dùng",
  "Action": "Hành động",
  "No activity logs found": "Không tìm thấy nhật ký hoạt động",
  "User permissions": "Phân quyền người dùng",
  "Task settings": "Cài đặt công việc",
  "Workflow settings": "Cài đặt workflow",
  "Notification settings": "Cài đặt thông báo",
  "Project settings": "Cài đặt dự án",
  "AI settings": "Cài đặt AI",
  "Enabled": "Bật",
  "Require admin approval": "Yêu cầu admin duyệt",
  "Audit changes": "Ghi log thay đổi",
  "Edit User": "Sửa người dùng",
  "User Detail": "Chi tiết người dùng",
  "Task Detail": "Chi tiết công việc",
  "Group Members": "Thành viên nhóm",
  "Save User": "Lưu người dùng",
  "Save Group": "Lưu nhóm",
  "New user": "Người dùng mới",
  "Unknown user": "Người dùng không xác định",
  "Unknown owner": "Không rõ chủ sở hữu",
  "Unassigned": "Chưa giao",
  "No description": "Không có mô tả",
  "Description": "Mô tả",
  "Created:": "Ngày tạo:",
  "Assignee:": "Người phụ trách:",
  "Project:": "Dự án:",
  "No tasks": "Chưa có công việc",
  "Language": "Ngôn ngữ",
  "English": "Tiếng Anh",
  "Vietnamese": "Tiếng Việt",
};

function adminText(language, text) {
  return language === "vi" ? ADMIN_VI[text] || text : text;
}

function formatStatus(status = "", language = "en") {
  const label = String(status || "DRAFT").replace(/_/g, " ").toLowerCase();
  const statusMap = {
    draft: "Bản nháp",
    completed: "Hoàn thành",
    assigned: "Đã giao",
    "in progress": "Đang làm",
    submitted: "Đã nộp",
    "changes requested": "Yêu cầu chỉnh sửa",
    rejected: "Bị từ chối",
    accepted: "Đã nhận",
    "leader approved": "Leader đã duyệt",
    "owner approved": "Owner đã duyệt",
    blocked: "Bị kẹt",
    pending: "Đang chờ",
    active: "Đang hoạt động",
    locked: "Đã khóa",
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
    urgent: "Khẩn cấp",
    admin: "Quản trị",
    owner: "Chủ sở hữu",
    member: "Thành viên",
  };
  return language === "vi" ? statusMap[label] || label : label;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function isOverdue(deadline, status) {
  if (!deadline || DONE_STATUSES.has(String(status || "").toUpperCase())) return false;
  const date = new Date(deadline);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function isDueSoon(deadline, status) {
  if (!deadline || DONE_STATUSES.has(String(status || "").toUpperCase())) return false;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;
  const diff = date.getTime() - Date.now();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

function getDateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isProjectDeadlineOverdue(deadline, progress) {
  const date = getDateOnly(deadline);
  if (!date || Number(progress || 0) >= 100) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date < today;
}

function isProjectDeadlineDueSoon(deadline, progress) {
  const date = getDateOnly(deadline);
  if (!date || Number(progress || 0) >= 100) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= 3;
}

function normalizeDeadlineProject(project, progressPercent = 0) {
  const existing = project?.deadlineProject || project?.deadline_project || null;
  if (existing) return existing;

  const date = getDateOnly(project?.deadline);
  if (!date) {
    return {
      date: null,
      status: "none",
      days_remaining: null,
      is_overdue: false,
      is_due_soon: false,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const completed = Number(progressPercent || 0) >= 100;
  const isOverdue = !completed && daysRemaining < 0;
  const isDueSoon = !completed && daysRemaining >= 0 && daysRemaining <= 3;

  return {
    date: String(project.deadline).slice(0, 10),
    status: completed ? "completed" : isOverdue ? "overdue" : isDueSoon ? "due_soon" : "active",
    days_remaining: daysRemaining,
    is_overdue: isOverdue,
    is_due_soon: isDueSoon,
  };
}

function getProjectProgressPercent(project) {
  const stages = project.workflowStages || project.workflow_stages || [];
  if (stages.length > 0) {
    const completedStages = stages.filter((stage) => String(stage.status || "").toLowerCase() === "completed").length;
    return Math.round((completedStages / stages.length) * 100);
  }
  const total = Number(project.total_tasks || 0);
  const completed = Number(project.completed_tasks || 0);
  if (total > 0) return Math.round((completed / total) * 100);
  return Number(project.progress_percent || 0);
}

function getProjectProgressMeta(project, language = "en") {
  const stages = project.workflowStages || project.workflow_stages || [];
  if (stages.length > 0) {
    const completedStages = stages.filter((stage) => String(stage.status || "").toLowerCase() === "completed").length;
    return language === "vi"
      ? `${completedStages}/${stages.length} bước quy trình`
      : `${completedStages}/${stages.length} workflow stages`;
  }
  return language === "vi"
    ? `${Number(project.completed_tasks || 0)}/${Number(project.total_tasks || 0)} công việc`
    : `${Number(project.completed_tasks || 0)}/${Number(project.total_tasks || 0)} tasks`;
}

function getHealth(project) {
  const progress = getProjectProgressPercent(project);
  const deadlineProject = normalizeDeadlineProject(project, progress);
  if (deadlineProject.is_overdue || isProjectDeadlineOverdue(project.deadline, progress)) return "delayed";
  if (Number(project.overdue_tasks || 0) > 0) return "delayed";
  if (deadlineProject.is_due_soon || isProjectDeadlineDueSoon(project.deadline, progress)) return "at_risk";
  if (Number(project.due_soon_tasks || 0) > 0 || progress < 40) return "at_risk";
  return "on_track";
}

function healthLabel(health, language = "en") {
  if (health === "delayed") return language === "vi" ? "Bị trễ" : "Delayed";
  if (health === "at_risk") return language === "vi" ? "Rủi ro" : "At Risk";
  return language === "vi" ? "Đúng tiến độ" : "On Track";
}

function deadlineProjectLabel(deadlineProject, language = "en") {
  if (!deadlineProject?.date) return language === "vi" ? "Chưa có hạn" : "No deadline";
  if (deadlineProject.status === "completed") return language === "vi" ? "Hoàn thành" : "Completed";
  if (deadlineProject.is_overdue || deadlineProject.status === "overdue") return language === "vi" ? "Quá hạn" : "Overdue";
  if (deadlineProject.is_due_soon || deadlineProject.status === "due_soon") return language === "vi" ? "Sắp hết hạn" : "Due soon";
  const days = Number(deadlineProject.days_remaining);
  if (Number.isFinite(days)) {
    if (days === 0) return language === "vi" ? "Hôm nay" : "Today";
    return language === "vi" ? `Còn ${days} ngày` : `${days} days left`;
  }
  return language === "vi" ? "Đang hoạt động" : "Active";
}

function deadlineProjectTone(deadlineProject) {
  if (!deadlineProject?.date) return "neutral";
  if (deadlineProject.is_overdue || deadlineProject.status === "overdue") return "red";
  if (deadlineProject.is_due_soon || deadlineProject.status === "due_soon") return "orange";
  if (deadlineProject.status === "completed") return "green";
  return "blue";
}

function workflowStatusLabel(status, language = "en") {
  const labels = {
    completed: language === "vi" ? "Hoàn thành" : "Completed",
    in_progress: language === "vi" ? "Đang xử lý" : "In progress",
    pending: language === "vi" ? "Đang chờ" : "Waiting",
    delayed: language === "vi" ? "Bị trễ" : "Delayed",
  };
  return labels[status] || status;
}

function normalizeWorkflowStageStatus(status) {
  const value = String(status || "pending").toLowerCase();
  if (["approved", "complete", "completed", "done"].includes(value)) return "completed";
  if (["in_progress", "in progress", "active", "current"].includes(value)) return "in_progress";
  if (["delayed", "overdue"].includes(value)) return "delayed";
  return "pending";
}

function buildAdminModel(stats, visibleProjects, currentUser, chatGroupConversations = [], chatUsers = []) {
  const taskGroups = stats?.tasksByStatus || {};
  const tasks = Object.values(taskGroups).flat().map((task) => ({
    ...task,
    id: Number(task.task_id),
    status: task.status || "DRAFT",
    priority: task.priority || "medium",
    assignee: task.assignee_name || task.owner_name || "Unassigned",
    assignee_email: task.assignee_email || "",
    overdue: isOverdue(task.deadline, task.status),
    dueSoon: isDueSoon(task.deadline, task.status),
    blocked: BLOCKED_STATUSES.has(String(task.status || "").toUpperCase()),
  }));

  const projectProgress = stats?.projectProgress || [];
  const projects = projectProgress.map((project) => {
    const progress = getProjectProgressPercent(project);
    const deadlineProject = normalizeDeadlineProject(project, progress);
    const health = getHealth(project);
    return {
      ...project,
      id: Number(project.project_id),
      group: project.group_name || "Workspace",
      members: Number(project.member_count || 0),
      progress_percent: progress,
      status: progress >= 100 ? "Completed" : "Active",
      deadline: deadlineProject?.date || project.deadline || null,
      deadlineProject,
      workflowStages: project.workflowStages || project.workflow_stages || [],
      health,
    };
  });

  const projectMap = new Map(projects.map((project) => [Number(project.project_id), project]));
  visibleProjects.forEach((project) => {
    if (!projectMap.has(Number(project.project_id))) {
      projectMap.set(Number(project.project_id), {
        ...project,
        id: Number(project.project_id),
        project_id: Number(project.project_id),
        owner_name: project.owner_name || currentUser?.username || "Owner",
        owner_email: project.owner_email || currentUser?.email || "",
        group: "Workspace",
        members: 0,
        total_tasks: 0,
        completed_tasks: 0,
        active_tasks: 0,
        overdue_tasks: 0,
        due_soon_tasks: 0,
        progress_percent: 0,
        status: "Active",
        deadline: project.deadlineProject?.date || project.deadline_project?.date || project.deadline || null,
        deadlineProject: normalizeDeadlineProject(project, 0),
        workflowStages: project.workflowStages || project.workflow_stages || [],
        health: "on_track",
      });
    }
  });

  const allProjects = [...projectMap.values()];
  const userTaskCounts = new Map();
  tasks.forEach((task) => {
    const key = task.assignee_email || task.assignee || "Unassigned";
    const current = userTaskCounts.get(key) || { name: task.assignee, email: task.assignee_email, tasks: 0, overdue: 0 };
    if (!DONE_STATUSES.has(String(task.status || "").toUpperCase())) current.tasks += 1;
    if (task.overdue) current.overdue += 1;
    userTaskCounts.set(key, current);
  });

  const recentUsers = stats?.recentUsers || [];
  const users = recentUsers.length > 0 ? recentUsers : currentUser ? [currentUser] : [];
  const enrichedUsers = users.map((item, index) => {
    const workload = userTaskCounts.get(item.email) || userTaskCounts.get(item.username) || {};
    return {
      id: item.user_id || item.id || index + 1,
      name: item.username || item.name || "Unknown user",
      email: item.email || "-",
      role: item.role || "member",
      status: item.deleted_at ? "Inactive" : item.locked_at || item.locked ? "Locked" : item.email_verified ? "Active" : "Pending",
      projects: allProjects.filter((project) => project.owner_email === item.email || project.owner_id === item.user_id).length,
      tasks: workload.tasks || 0,
      lastActive: item.last_active || item.updated_at || item.created_at,
      auth_provider: item.auth_provider,
    };
  });

  const chatUserMap = new Map(chatUsers.map((item) => [Number(item.user_id), item]));
  const groups = chatGroupConversations.map((conversation) => ({
    id: conversation.conversation_id,
    conversation_id: conversation.conversation_id,
    name: conversation.name || "Group chat",
    type: "chat",
    status: conversation.disbanded_at ? "Disbanded" : "Active",
    members: Number(conversation.member_count || conversation.participants?.length || 0),
    projects: conversation.project_id ? 1 : 0,
    project_id: conversation.project_id,
    project_name: conversation.project_name || "",
    created_at: conversation.created_at,
    last_message_at: conversation.last_message_at,
    participants: (conversation.participants || []).map((userId) => chatUserMap.get(Number(userId))).filter(Boolean),
  }));

  const workflows = allProjects.map((project) => {
    const progress = Number(project.progress_percent || 0);
    const projectDeadlineState = project.deadlineProject || normalizeDeadlineProject(project, progress);
    const isProjectOverdue = Boolean(projectDeadlineState?.is_overdue);
    const realStages = (project.workflowStages || [])
      .slice()
      .sort((a, b) => Number(a.stage_order || 0) - Number(b.stage_order || 0));
    const firstOpenStageIndex = realStages.findIndex((stage) => normalizeWorkflowStageStatus(stage.status) !== "completed");
    const currentStageIndex = firstOpenStageIndex >= 0 ? firstOpenStageIndex : realStages.length - 1;
    const stages = realStages.map((stage, index) => {
      const normalizedStatus = normalizeWorkflowStageStatus(stage.status);
      const status = isProjectOverdue && normalizedStatus !== "completed" ? "delayed" : normalizedStatus;
      return {
        id: stage.id || `${project.project_id}-${index}`,
        stage_id: stage.id || stage.stage_id,
        project_id: Number(stage.project_id || project.project_id),
        order: Number(stage.stage_order || index + 1),
        name: stage.stage_name || stage.name || `Stage ${index + 1}`,
        owner: stage.assignee_email || stage.assignee_name || project.owner_email || project.owner_name || "Owner",
        status,
        canMovePrevious: index === currentStageIndex && Boolean(stage.can_move_previous),
        processingTime: "-",
        deadline: stage.deadline || project.deadlineProject?.date || project.deadline,
        deadlineProject: stage.deadline ? normalizeDeadlineProject({ deadline: stage.deadline }, status === "completed" ? 100 : 0) : project.deadlineProject || null,
        delayStatus: status,
        bottleneck: status === "delayed" || (status === "in_progress" && project.health !== "on_track"),
      };
    });
    return {
      id: project.project_id,
      name: project.name,
      health: project.health,
      progress,
      owner: project.owner_email || project.owner_name || "Owner",
      deadline: project.deadlineProject?.date || project.deadline,
      deadlineProject: project.deadlineProject || null,
      totalTasks: Number(project.total_tasks || 0),
      completedTasks: Number(project.completed_tasks || 0),
      overdueTasks: Number(project.overdue_tasks || 0),
      dueSoonTasks: Number(project.due_soon_tasks || 0),
      currentBottleneck: stages.find((stage) => stage.bottleneck)?.name || "-",
      avgProcessingTime: `${Math.max(1, Math.round((project.total_tasks || 1) / 2))}d`,
      stages,
    };
  });

  const blockedTasks = tasks.filter((task) => task.blocked);
  const overdueTasks = tasks.filter((task) => task.overdue);
  const projectsAtRisk = allProjects.filter((project) => project.health !== "on_track");
  const overloadedUsers = enrichedUsers.filter((item) => Number(item.tasks || 0) >= 5);

  const activities = [
    ...tasks.slice(0, 8).map((task) => ({
      id: `task-${task.task_id}`,
      time: task.created_at,
      user: task.assignee || task.owner_name || "System",
      project: task.project_name || "-",
      action: "created task",
      detail: task.title,
    })),
    ...allProjects.slice(0, 6).map((project) => ({
      id: `project-${project.project_id}`,
      time: project.created_at,
      user: project.owner_email || project.owner_name || "System",
      project: project.name,
      action: "created project",
      detail: project.name,
    })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  const taskTotal = Number(stats?.tasks?.total || tasks.length || 0);
  const completed = Number(stats?.tasks?.completed || tasks.filter((task) => DONE_STATUSES.has(task.status)).length || 0);
  const overdue = Number(stats?.tasks?.overdue || overdueTasks.length || 0);

  return {
    users: enrichedUsers,
    groups,
    chatUsers,
    projects: allProjects,
    tasks,
    workflows,
    activities,
    stats: {
      totalUsers: Number(stats?.users?.total || enrichedUsers.length || 0),
      totalGroups: groups.length,
      totalProjects: Number(stats?.projects?.total || allProjects.length || 0),
      totalTasks: taskTotal,
      completedTasks: completed,
      overdueTasks: overdue,
      blockedTasks: blockedTasks.length,
      projectsAtRisk: projectsAtRisk.length,
      verifiedUsers: Number(stats?.users?.verified || 0),
    },
    taskStatus: stats?.taskStatus || [],
    monthlyStats: stats?.monthlyStats || [],
    workload: [...userTaskCounts.values()].filter((item) => Number(item.tasks || 0) > 0).sort((a, b) => b.tasks - a.tasks).slice(0, 8),
    monitoring: [
      ...overdueTasks.slice(0, 8).map((task) => ({ id: `overdue-${task.id}`, type: "Overdue Task", title: task.title, scope: task.project_name, level: "Critical" })),
      ...blockedTasks.slice(0, 8).map((task) => ({ id: `blocked-${task.id}`, type: "Blocked Task", title: task.title, scope: task.project_name, level: "Warning" })),
      ...projectsAtRisk.slice(0, 8).map((project) => ({ id: `risk-${project.id}`, type: "Project At Risk", title: project.name, scope: project.owner_email || project.owner_name, level: project.health === "delayed" ? "Critical" : "Warning" })),
      ...overloadedUsers.slice(0, 8).map((item) => ({ id: `load-${item.id}`, type: "User Overloaded", title: item.name, scope: `${item.tasks} tasks`, level: "Warning" })),
      ...workflows.filter((workflow) => workflow.currentBottleneck !== "-").slice(0, 8).map((workflow) => ({ id: `workflow-${workflow.id}`, type: "Workflow Bottleneck", title: workflow.name, scope: workflow.currentBottleneck, level: "Warning" })),
    ],
    reports: {
      taskCompletionRate: taskTotal > 0 ? Math.round((completed / taskTotal) * 100) : 0,
      projectCompletionRate: allProjects.length > 0 ? Math.round((allProjects.filter((project) => project.progress_percent >= 100).length / allProjects.length) * 100) : 0,
      overdueRate: taskTotal > 0 ? Math.round((overdue / taskTotal) * 100) : 0,
      blockedTasks: blockedTasks.length,
      projectsAtRisk: projectsAtRisk.length,
    },
    dataQuality: {
      coreApi: Boolean(stats),
      realTasks: tasks.length > 0,
      derivedWorkflows: true,
      localAdminActions: true,
    },
  };
}

function StatCard({ label, value, tone = "default", icon = "activity", showIcon = true, unit, hint }) {
  return (
    <div className={`admin-stat-card ${tone}`}>
      <div>
        <div className="admin-stat-value">
          <span>{value}</span>
          {unit && value !== "-" ? <em>{unit}</em> : null}
        </div>
        <small>{label}</small>
        {hint ? <p>{hint}</p> : null}
      </div>
      {showIcon ? <Icon name={icon} size={18} /> : null}
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`admin-badge ${tone}`}>{children}</span>;
}

function ProgressBar({ value, tone = "blue" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="admin-progress">
      <div className={`admin-progress-fill ${tone}`} style={{ width: `${safeValue}%` }} />
      <span>{safeValue}%</span>
    </div>
  );
}

function SectionCard({ title, icon, actions, children }) {
  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div>
          <Icon name={icon} size={16} />
          <h2>{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label }) {
  return <div className="admin-empty-state">{label}</div>;
}

function SearchFilter({ search, onSearch, placeholder = "Search", children }) {
  return (
    <div className="admin-toolbar">
      <label className="admin-search">
        <Icon name="search" size={15} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
      </label>
      {children}
    </div>
  );
}

function DonutChart({ items, language = "en", t = (text) => text }) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const completed = items.find((item) => DONE_STATUSES.has(String(item.status || "").toUpperCase()))?.count || 0;
  const value = total > 0 ? Math.round((Number(completed) / total) * 100) : 0;
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut" style={{ "--value": `${value}%` }}>
        <div>
          <strong>{value}%</strong>
          <span>{t("Completed")}</span>
        </div>
      </div>
      <div className="admin-donut-note">
        <strong>{completed}/{total} {t("Tasks")}</strong>
        <span>{t("Completed")} {language === "vi" ? "trên" : "of"} {total} {t("Tasks")}</span>
      </div>
    </div>
  );
}

function formatMonthLabel(month, language = "en") {
  const [year, value] = String(month || "").split("-");
  if (!year || !value) return month || "-";
  return language === "vi" ? `Tháng ${Number(value)}/${year}` : `${value}/${year}`;
}

function MonthlyTrendChart({ items, selectedMonth = "all", language = "en", t = (text) => text }) {
  const points = [...items].reverse();
  if (!points.length) return <EmptyState label={t("No monthly trend data")} />;

  const visiblePoints = selectedMonth === "all"
    ? points
    : points.filter((item) => item.month === selectedMonth);
  const summaryItems = visiblePoints.length ? visiblePoints : points;
  const totals = summaryItems.reduce((sum, item) => ({
    tasks: sum.tasks + Number(item.tasks || 0),
    completed: sum.completed + Number(item.completed_tasks || 0),
    projects: sum.projects + Number(item.projects || 0),
  }), { tasks: 0, completed: 0, projects: 0 });
  const maxValue = Math.max(1, ...visiblePoints.flatMap((item) => [
    Number(item.tasks || 0),
    Number(item.completed_tasks || 0),
    Number(item.projects || 0),
  ]));

  return (
    <div className="admin-monthly-trend">
      <div className="admin-monthly-summary">
        <div><span>{t("Tasks")}</span><strong>{totals.tasks}</strong></div>
        <div><span>{t("Completed")}</span><strong>{totals.completed}</strong></div>
        <div><span>{t("Projects")}</span><strong>{totals.projects}</strong></div>
      </div>
      <div className="admin-monthly-bars">
        {visiblePoints.map((item) => (
          <div key={item.month} className="admin-monthly-row">
            <strong>{formatMonthLabel(item.month, language)}</strong>
            <div>
              <span className="tasks" style={{ width: `${(Number(item.tasks || 0) / maxValue) * 100}%` }}><b>{Number(item.tasks || 0)}</b></span>
              <span className="completed" style={{ width: `${(Number(item.completed_tasks || 0) / maxValue) * 100}%` }}><b>{Number(item.completed_tasks || 0)}</b></span>
              <span className="projects" style={{ width: `${(Number(item.projects || 0) / maxValue) * 100}%` }}><b>{Number(item.projects || 0)}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="admin-chart-legend">
        <span className="tasks">{t("Tasks")}</span>
        <span className="completed">{t("Completed")}</span>
        <span className="projects">{t("Projects")}</span>
      </div>
    </div>
  );
}

function monthOffset(month, offset) {
  const [year, value] = String(month || "").split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (value || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildTrendMonths(items, range = "last6") {
  const dataMap = new Map(items.map((item) => [item.month, item]));
  const sortedMonths = [...dataMap.keys()].sort();
  const lastMonth = sortedMonths[sortedMonths.length - 1] || currentMonthKey();

  if (String(range).startsWith("month:")) {
    const month = String(range).replace("month:", "");
    return [{ month, tasks: 0, completed_tasks: 0, projects: 0, ...dataMap.get(month) }];
  }

  if (range === "all") {
    const firstMonth = sortedMonths[0] || lastMonth;
    const months = [];
    for (let month = firstMonth; month <= lastMonth; month = monthOffset(month, 1)) {
      months.push(month);
    }
    return months.map((month) => ({ month, tasks: 0, completed_tasks: 0, projects: 0, ...dataMap.get(month) }));
  }

  const count = range === "last12" ? 12 : 6;
  return Array.from({ length: count }, (_, index) => monthOffset(lastMonth, index - count + 1))
    .map((month) => ({ month, tasks: 0, completed_tasks: 0, projects: 0, ...dataMap.get(month) }));
}

function getTrendYearMonths(items) {
  const months = items.map((item) => item.month).filter(Boolean).sort();
  const year = Number(String(months[months.length - 1] || currentMonthKey()).slice(0, 4));
  const now = new Date();
  const monthCount = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  return Array.from({ length: monthCount }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function MonthlyAreaChart({ items, range = "last6", language = "en", t = (text) => text }) {
  if (!items.length) return <EmptyState label={t("No monthly trend data")} />;

  const points = buildTrendMonths(items, range);
  const totals = points.reduce((sum, item) => ({
    tasks: sum.tasks + Number(item.tasks || 0),
    completed: sum.completed + Number(item.completed_tasks || 0),
    projects: sum.projects + Number(item.projects || 0),
  }), { tasks: 0, completed: 0, projects: 0 });
  const maxValue = Math.max(1, ...points.flatMap((item) => [
    Number(item.tasks || 0),
    Number(item.completed_tasks || 0),
    Number(item.projects || 0),
  ]));

  return (
    <div className="admin-monthly-trend">
      <div className="admin-monthly-summary">
        <div><span>{t("Tasks")}</span><strong>{totals.tasks}</strong></div>
        <div><span>{t("Completed")}</span><strong>{totals.completed}</strong></div>
        <div><span>{t("Projects")}</span><strong>{totals.projects}</strong></div>
      </div>
      <div className="admin-column-chart">
        {points.map((item) => {
          const values = [
            ["tasks", Number(item.tasks || 0)],
            ["completed", Number(item.completed_tasks || 0)],
            ["projects", Number(item.projects || 0)],
          ];
          return (
            <div key={item.month} className="admin-column-group">
              <div className="admin-column-bars">
                {values.map(([key, value]) => (
                  <span key={key} className={key} style={{ height: `${Math.max(4, (value / maxValue) * 100)}%` }}>
                    <b>{value}</b>
                  </span>
                ))}
              </div>
              <strong>{String(item.month).slice(5)}</strong>
            </div>
          );
        })}
      </div>
      <div className="admin-chart-legend">
        <span className="tasks">{t("Tasks")}</span>
        <span className="completed">{t("Completed")}</span>
        <span className="projects">{t("Projects")}</span>
      </div>
    </div>
  );
}

function AdminModal({ title, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = (text) => adminText(language, text);
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [chatGroups, setChatGroups] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [trendRange, setTrendRange] = useState("last6");
  const [filters, setFilters] = useState({
    userStatus: "all",
    projectStatus: "all",
    taskStatus: "all",
    taskPriority: "all",
    taskProject: "all",
    taskUser: "all",
    taskDeadline: "all",
    activityAction: "all",
    health: "all",
    reportRange: "30 Days",
  });
  const [localUsers, setLocalUsers] = useState([]);
  const [lockingUserIds, setLockingUserIds] = useState(new Set());
  const [savingProjectDeadlineIds, setSavingProjectDeadlineIds] = useState(new Set());
  const [savingPreviousStageIds, setSavingPreviousStageIds] = useState(new Set());
  const [projectDeadlineDrafts, setProjectDeadlineDrafts] = useState({});

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, projectRes, chatGroupRes] = await Promise.all([
        api.get("/auth/admin/stats"),
        api.get("/projects").catch(() => ({ data: { projects: [] } })),
        api.get("/projects/chat/group-conversations").catch(() => ({ data: { conversations: [], chat_users: [] } })),
      ]);
      const nextStats = statsRes.data.stats || null;
      setStats(nextStats);
      setProjects(projectRes.data.projects || []);
      setChatGroups(nextStats?.chatGroups || chatGroupRes.data.conversations || []);
      setChatUsers(nextStats?.chatUsers || chatGroupRes.data.chat_users || []);
    } catch (err) {
      setError(err.response?.data?.message || "Cannot load admin dashboard.");
      setStats(null);
      setProjects([]);
      setChatGroups([]);
      setChatUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const model = useMemo(() => {
    const base = buildAdminModel(stats, projects, user, chatGroups, chatUsers);
    const mergedUsers = [...base.users, ...localUsers]
      .filter((item, index, list) => list.findIndex((entry) => String(entry.email) === String(item.email)) === index);
    return { ...base, users: mergedUsers, stats: { ...base.stats, totalUsers: Math.max(base.stats.totalUsers, mergedUsers.length) } };
  }, [stats, projects, user, chatGroups, chatUsers, localUsers]);

  const activeNav = ADMIN_NAV.find((item) => item.id === activeView) || ADMIN_NAV[0];
  const lowerSearch = search.trim().toLowerCase();
  const filterText = (values) => !lowerSearch || values.some((value) => String(value || "").toLowerCase().includes(lowerSearch));
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetSearch = (view) => {
    setActiveView(view);
    setSearch("");
  };

  const visibleUsers = model.users.filter((item) => (
    filterText([item.name, item.email, item.status])
    && (filters.userStatus === "all" || item.status === filters.userStatus)
  ));

  const visibleProjects = model.projects.filter((item) => {
    const statusMatch = filters.projectStatus === "all"
      || item.status.toLowerCase() === filters.projectStatus
      || item.health === filters.projectStatus;
    return filterText([item.name, item.owner_email, item.owner_name, item.group, item.status]) && statusMatch;
  });

  const visibleTasks = model.tasks.filter((item) => (
    filterText([item.title, item.project_name, item.assignee, item.status, item.priority])
    && (filters.taskStatus === "all" || item.status === filters.taskStatus)
    && (filters.taskPriority === "all" || item.priority === filters.taskPriority)
    && (filters.taskProject === "all" || String(item.project_id) === filters.taskProject)
    && (filters.taskUser === "all" || item.assignee === filters.taskUser || item.assignee_email === filters.taskUser)
    && (filters.taskDeadline === "all"
      || (filters.taskDeadline === "overdue" && item.overdue)
      || (filters.taskDeadline === "due_soon" && item.dueSoon)
      || (filters.taskDeadline === "no_deadline" && !item.deadline))
  ));

  const visibleActivities = model.activities.filter((item) => (
    filterText([item.user, item.project, item.action, item.detail])
    && (filters.activityAction === "all" || item.action === filters.activityAction)
  ));

  const lockUser = async (target) => {
    if (!window.confirm(`${t("Lock this user?")}\n${target.name} (${target.email})`)) return;

    if (String(target.id).startsWith("local-")) {
      setLocalUsers((current) => current.map((item) => (
        item.id === target.id ? { ...item, locked_at: new Date().toISOString(), status: "Locked" } : item
      )));
      return;
    }

    setLockingUserIds((current) => new Set(current).add(target.id));
    try {
      await api.patch(`/auth/admin/users/${target.id}/lock`, { email: target.email });
      await loadAdminData();
    } catch (err) {
      window.alert(err.response?.data?.message || t("Cannot lock user."));
    } finally {
      setLockingUserIds((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    }
  };

  const saveUser = (payload) => {
    setLocalUsers((current) => {
      const id = payload.id || `local-${Date.now()}`;
      const nextUser = {
        id,
        name: payload.name || "New user",
        email: payload.email || "new.user@taskflow.local",
        status: payload.status || "Active",
        projects: payload.projects || 0,
        tasks: payload.tasks || 0,
        lastActive: new Date().toISOString(),
      };
      return current.some((item) => item.id === id)
        ? current.map((item) => (item.id === id ? nextUser : item))
        : [...current, nextUser];
    });
    setModal(null);
  };

  const saveProjectDeadline = async (project, deadline) => {
    const projectId = project.project_id || project.id;
    if (!projectId || savingProjectDeadlineIds.has(projectId)) return;

    setSavingProjectDeadlineIds((current) => new Set(current).add(projectId));
    try {
      const res = await api.patch(`/auth/admin/projects/${projectId}/deadline`, { deadline: deadline || null });
      const updated = res.data.project;
      const nextDeadlineProject = updated.deadlineProject || updated.deadline_project || null;
      const nextDeadline = nextDeadlineProject?.date || updated.deadline || null;

      setStats((current) => {
        if (!current?.projectProgress) return current;
        return {
          ...current,
          projectProgress: current.projectProgress.map((item) => (
            Number(item.project_id) === Number(projectId)
              ? {
                  ...item,
                  deadline: nextDeadline,
                  deadlineProject: nextDeadlineProject,
                  progress_percent: updated.progress_percent ?? item.progress_percent,
                }
              : item
          )),
        };
      });

      setProjects((current) => current.map((item) => (
        Number(item.project_id) === Number(projectId)
          ? { ...item, deadline: nextDeadline, deadlineProject: nextDeadlineProject }
          : item
      )));
      setProjectDeadlineDrafts((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.message || "Cannot update project deadline.");
    } finally {
      setSavingProjectDeadlineIds((current) => {
        const next = new Set(current);
        next.delete(projectId);
        return next;
      });
    }
  };

  const renderDashboard = () => (
    <div className="admin-view">
      <div className="admin-health-strip">
        <div>
          <strong>{model.stats.projectsAtRisk === 0 ? t("System is stable") : `${model.stats.projectsAtRisk} ${t("projects need attention")}`}</strong>
          <span>{model.stats.overdueTasks} {t("overdue tasks")}, {model.stats.blockedTasks} {t("blocked tasks")}, {model.stats.verifiedUsers} {t("verified users")}.</span>
        </div>
      </div>

      <div className="admin-stat-grid">
        <StatCard label={t("Total Users")} value={model.stats.totalUsers} icon="users" />
        <StatCard label={t("Total Groups")} value={model.stats.totalGroups} icon="teamAdd" />
        <StatCard label={t("Total Projects")} value={model.stats.totalProjects} icon="grid" />
        <StatCard label={t("Total Tasks")} value={model.stats.totalTasks} icon="check" />
        <StatCard label={t("Completed Tasks")} value={model.stats.completedTasks} tone="green" icon="check" />
        <StatCard label={t("Overdue Tasks")} value={model.stats.overdueTasks} tone="red" icon="clock" />
        <StatCard label={t("Blocked Tasks")} value={model.stats.blockedTasks} tone="orange" icon="lock" />
        <StatCard label={t("Projects At Risk")} value={model.stats.projectsAtRisk} tone="red" icon="flag" />
      </div>

      <div className="admin-dashboard-grid">
        <SectionCard
          title={t("Monthly Trend")}
          icon="activity"
          actions={(
            <select value={trendRange} onChange={(event) => setTrendRange(event.target.value)}>
              <option value="last6">{language === "vi" ? "6 tháng gần nhất" : "Last 6 months"}</option>
              <option value="last12">{language === "vi" ? "12 tháng gần nhất" : "Last 12 months"}</option>
              <option value="all">{language === "vi" ? "Tất cả dữ liệu" : "All data"}</option>
              {getTrendYearMonths(model.monthlyStats).map((month) => (
                <option key={month} value={`month:${month}`}>{formatMonthLabel(month, language)}</option>
              ))}
            </select>
          )}
        >
          <MonthlyAreaChart items={model.monthlyStats} range={trendRange} language={language} t={t} />
        </SectionCard>
        <SectionCard title={t("Task Completion")} icon="activity"><DonutChart items={model.taskStatus} language={language} t={t} /></SectionCard>
        <SectionCard title={t("Project Progress")} icon="grid">
          <div className="admin-list-stack">
            {model.projects.length ? model.projects.slice(0, 6).map((project) => (
              <div key={project.id} className="admin-compact-row">
                <span>
                  <strong>{project.name}</strong>
                  <small>{getProjectProgressMeta(project, language)} · {t("Deadline:")} {formatDate(project.deadline)}</small>
                </span>
                <ProgressBar value={project.progress_percent} tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "blue"} />
              </div>
            )) : <EmptyState label={t("No projects")} />}
          </div>
        </SectionCard>
        <SectionCard title={t("Recent Activities")} icon="clock">
          <div className="admin-timeline">
            {model.activities.slice(0, 6).map((item) => (
              <div key={item.id}>
                <time>{formatDate(item.time)}</time>
                <span>{item.user} {t(item.action)}</span>
                <small>{item.detail}</small>
              </div>
            ))}
            {!model.activities.length && <EmptyState label={t("No activities")} />}
          </div>
        </SectionCard>
        <SectionCard title={t("Overdue / Blocked Tasks")} icon="lock">
          <TaskIssueList tasks={model.tasks.filter((task) => task.overdue || task.blocked).slice(0, 6)} onView={(task) => setModal({ type: "task", item: task })} t={t} />
        </SectionCard>
      </div>
    </div>
  );

  const renderUsers = () => (
    <SectionCard
      title={t("User Management")}
      icon="users"
      actions={<button className="admin-primary-button" type="button" onClick={() => setModal({ type: "userForm", item: null })}><Icon name="plus" size={14} />{t("Add User")}</button>}
    >
      <SearchFilter search={search} onSearch={setSearch} placeholder={t("Search")}>
        <select value={filters.userStatus} onChange={(event) => updateFilter("userStatus", event.target.value)}>
          <option value="all">{t("All status")}</option>
          <option value="Active">{t("Active")}</option>
          <option value="Pending">{t("Pending")}</option>
          <option value="Locked">{t("Locked")}</option>
          <option value="Inactive">{t("Inactive")}</option>
        </select>
      </SearchFilter>
      <div className="admin-table users">
        <div className="admin-table-head">
          <span>{t("Name")}</span><span>{t("Email")}</span><span>{t("Status")}</span><span>{t("Projects")}</span><span>{t("Tasks")}</span><span>{t("Last Active")}</span><span>{t("Actions")}</span>
        </div>
        {visibleUsers.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span><strong>{item.name}</strong></span>
            <span>{item.email}</span>
            <span><Badge tone={item.status === "Locked" ? "red" : item.status === "Pending" ? "orange" : item.status === "Inactive" ? "neutral" : "green"}>{t(item.status)}</Badge></span>
            <span>{item.projects}</span>
            <span>{item.tasks}</span>
            <span>{formatDate(item.lastActive)}</span>
            <span className="admin-row-actions">
              <button type="button" onClick={() => setModal({ type: "user", item })}>{t("View")}</button>
              <button type="button" disabled={item.status === "Inactive" || item.status === "Locked" || lockingUserIds.has(item.id)} onClick={() => lockUser(item)}>{t("Lock")}</button>
            </span>
          </div>
        ))}
      </div>
      {visibleUsers.length === 0 && <EmptyState label={t("No users found")} />}
    </SectionCard>
  );

  const renderGroups = () => (
    <SectionCard
      title={t("Groups")}
      icon="teamAdd"
    >
      <SearchFilter search={search} onSearch={setSearch} placeholder={t("Search")} />
      <div className="admin-card-grid">
        {model.groups
          .filter((group) => filterText([group.name, group.project_name, group.status]))
          .map((group) => (
            <div key={group.id} className="admin-group-card">
              <div>
                <strong>{group.name}</strong>
                <Badge tone={group.status === "Disbanded" ? "red" : "blue"}>{group.status === "Disbanded" ? t("Disbanded") : t("Chat group")}</Badge>
              </div>
              <p>{group.members} {t("members")}{group.project_name ? ` - ${group.project_name}` : ""}</p>
              <small className="admin-group-meta">{t("Last message")}: {formatDateTime(group.last_message_at || group.created_at)}</small>
              <div className="admin-row-actions">
                <button type="button" onClick={() => setModal({ type: "group", item: group })}>{t("Members")}</button>
                <button type="button" onClick={() => navigate("/chat")}>{t("Open chat")}</button>
              </div>
            </div>
          ))}
      </div>
      {model.groups.length === 0 && <EmptyState label={t("No chat groups found")} />}
    </SectionCard>
  );

  const renderProjects = () => {
    const summaryItems = [
      { label: t("All projects"), value: model.projects.length, tone: "blue" },
      { label: t("On Track"), value: model.projects.filter((project) => project.health === "on_track").length, tone: "green" },
      { label: t("At Risk"), value: model.projects.filter((project) => project.health === "at_risk").length, tone: "orange" },
      { label: t("Delayed"), value: model.projects.filter((project) => project.health === "delayed").length, tone: "red" },
    ];

    return (
      <SectionCard title={t("Projects")} icon="grid">
        <div className="admin-project-management">
          <div className="admin-project-summary-grid">
            {summaryItems.map((item) => (
              <div key={item.label} className={`admin-project-summary-card ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <SearchFilter search={search} onSearch={setSearch} placeholder={t("Search")}>
            <select value={filters.projectStatus} onChange={(event) => updateFilter("projectStatus", event.target.value)}>
              <option value="all">{t("All projects")}</option>
              <option value="active">{t("Active")}</option>
              <option value="completed">{t("Completed")}</option>
              <option value="delayed">{t("Overdue Tasks")}</option>
              <option value="archived">{t("Archived")}</option>
              <option value="at_risk">{t("At Risk")}</option>
            </select>
          </SearchFilter>

          <div className="admin-table projects admin-project-table">
            <div className="admin-table-head">
              <span>{t("Project Name")}</span><span>{t("Owner")}</span><span>{t("Group")}</span><span>{t("Members")}</span><span>{t("Progress")}</span><span>{t("Status")}</span><span>{t("Deadline")}</span><span>{t("Created At")}</span>
            </div>
            {visibleProjects.map((project) => {
              const projectId = project.project_id || project.id;
              const deadlineValue = project.deadlineProject?.date || project.deadline || "";
              const deadlineDraft = Object.prototype.hasOwnProperty.call(projectDeadlineDrafts, projectId)
                ? projectDeadlineDrafts[projectId]
                : deadlineValue;
              const deadlineTone = deadlineProjectTone(project.deadlineProject);
              const isSavingDeadline = savingProjectDeadlineIds.has(projectId);
              const hasDeadlineDraft = deadlineDraft !== deadlineValue;
              const projectInitial = String(project.name || "P").trim().charAt(0).toUpperCase();

              return (
                <div key={project.id} className={`admin-table-row admin-project-row ${project.health}`}>
                  <span className="admin-project-identity">
                    <i>{projectInitial}</i>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{project.owner_email || project.owner_name || "-"}</small>
                    </span>
                  </span>
                  <span className="admin-owner-cell">
                    <strong>{project.owner_name || t("Owner")}</strong>
                    <small>{project.owner_email || "-"}</small>
                  </span>
                  <span><span className="admin-group-pill">{project.group || "Workspace"}</span></span>
                  <span><span className="admin-members-pill"><Icon name="users" size={13} />{project.members}</span></span>
                  <span className="admin-project-progress-cell">
                    <small>{project.completed_tasks || 0}/{project.total_tasks || 0} {t("Tasks")}</small>
                    <ProgressBar value={project.progress_percent} tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "blue"} />
                  </span>
                  <span><Badge tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "green"}><i className={`admin-health-dot ${project.health}`} />{healthLabel(project.health, language)}</Badge></span>
                  <span className={`admin-deadline-cell ${deadlineTone} ${deadlineValue ? "has-date" : "empty"}`}>
                    <span className="admin-deadline-capsule">
                      <label className="admin-project-deadline-control" title={language === "vi" ? "Chọn hạn chót" : "Choose deadline"}>
                        <span className="admin-deadline-icon"><Icon name="calendar" size={13} /></span>
                        <span className="admin-deadline-text">
                          <strong>{deadlineValue ? formatDate(deadlineValue) : (language === "vi" ? "Đặt hạn" : "Set date")}</strong>
                          <small>{deadlineProjectLabel(project.deadlineProject, language)}</small>
                        </span>
                        <input
                          type="date"
                          value={deadlineDraft}
                          disabled={isSavingDeadline}
                          onChange={(event) => setProjectDeadlineDrafts((current) => ({
                            ...current,
                            [projectId]: event.target.value,
                          }))}
                        />
                      </label>
                      {hasDeadlineDraft && (
                        <button
                          className="admin-deadline-save"
                          type="button"
                          disabled={isSavingDeadline}
                          onClick={() => saveProjectDeadline(project, deadlineDraft)}
                        >
                          {language === "vi" ? "Lưu" : "Save"}
                        </button>
                      )}
                      {deadlineValue && (
                        <button
                          className="admin-deadline-clear"
                          type="button"
                          disabled={isSavingDeadline}
                          onClick={() => saveProjectDeadline(project, null)}
                          title={t("Clear")}
                          aria-label={t("Clear")}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </span>
                  </span>
                  <span className="admin-created-cell">{formatDate(project.created_at)}</span>
                </div>
              );
            })}
          </div>
          {visibleProjects.length === 0 && <EmptyState label={t("No projects found")} />}
        </div>
      </SectionCard>
    );
  };

  const handleAdminMovePrevious = async (workflow, stage) => {
    const projectId = workflow.id || stage.project_id;
    const stageId = stage.stage_id || stage.id;
    if (!projectId || !stageId || savingPreviousStageIds.has(stageId)) return;

    setSavingPreviousStageIds((current) => new Set(current).add(stageId));
    setError("");
    try {
      await api.post(`/projects/${projectId}/stages/previous`, { stageId });
      await loadAdminData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      const previousErrorMessages = {
        "You can only move back once after moving to a new stage": "Chỉ được quay lại 1 lần sau khi chuyển sang giai đoạn mới",
        "You can only move back within 12 hours after moving to a new stage": "Chỉ được quay lại trong vòng 12 tiếng kể từ khi chuyển sang giai đoạn mới",
        "Cannot move back from the first stage": "Không thể quay lại từ giai đoạn đầu tiên",
        "Only project owner or admin can move a stage back": "Chỉ chủ dự án hoặc admin được quay lại giai đoạn trước",
      };
      setError(previousErrorMessages[msg] || msg);
    } finally {
      setSavingPreviousStageIds((current) => {
        const next = new Set(current);
        next.delete(stageId);
        return next;
      });
    }
  };

  const renderTasks = () => (
    <SectionCard title={t("Tasks")} icon="check">
      <SearchFilter search={search} onSearch={setSearch} placeholder={t("Search")}>
        <select value={filters.taskProject} onChange={(event) => updateFilter("taskProject", event.target.value)}>
          <option value="all">{t("All projects")}</option>
          {model.projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name}</option>)}
        </select>
        <select value={filters.taskUser} onChange={(event) => updateFilter("taskUser", event.target.value)}>
          <option value="all">{t("All users")}</option>
          {[...new Set(model.tasks.map((task) => task.assignee).filter(Boolean))].map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={filters.taskStatus} onChange={(event) => updateFilter("taskStatus", event.target.value)}>
          <option value="all">{t("All status")}</option>
          {model.taskStatus.map((item) => <option key={item.status} value={item.status}>{formatStatus(item.status, language)}</option>)}
        </select>
        <select value={filters.taskPriority} onChange={(event) => updateFilter("taskPriority", event.target.value)}>
          <option value="all">{t("All priority")}</option>
          <option value="low">{t("Low")}</option>
          <option value="medium">{t("Medium")}</option>
          <option value="high">{t("High")}</option>
          <option value="urgent">{t("Urgent")}</option>
        </select>
        <select value={filters.taskDeadline} onChange={(event) => updateFilter("taskDeadline", event.target.value)}>
          <option value="all">{t("All deadlines")}</option>
          <option value="overdue">{t("Overdue Tasks")}</option>
          <option value="due_soon">{t("Due soon")}</option>
          <option value="no_deadline">{t("No deadline")}</option>
        </select>
      </SearchFilter>
      <div className="admin-table tasks">
        <div className="admin-table-head">
          <span>{t("Task")}</span><span>{t("Project")}</span><span>{t("Assignee")}</span><span>{t("Status")}</span><span>{t("Priority")}</span><span>{t("Deadline")}</span><span>{t("Created At")}</span><span>{t("Actions")}</span>
        </div>
        {visibleTasks.map((task) => (
          <div key={task.id} className="admin-table-row">
            <span><strong>{task.title}</strong></span>
            <span>{task.project_name || "-"}</span>
            <span>{task.assignee}</span>
            <span><Badge tone={task.blocked ? "red" : DONE_STATUSES.has(task.status) ? "green" : ACTIVE_STATUSES.has(task.status) ? "blue" : "neutral"}>{formatStatus(task.status, language)}</Badge></span>
            <span><Badge tone={task.priority === "high" || task.priority === "urgent" ? "red" : task.priority === "medium" ? "orange" : "green"}>{formatStatus(task.priority, language)}</Badge></span>
            <span>{formatDate(task.deadline)}</span>
            <span>{formatDate(task.created_at)}</span>
            <span className="admin-row-actions"><button type="button" onClick={() => setModal({ type: "task", item: task })}>{t("Detail")}</button></span>
          </div>
        ))}
      </div>
      {visibleTasks.length === 0 && <EmptyState label={t("No tasks found")} />}
    </SectionCard>
  );

  const renderWorkflows = () => (
    <div className="admin-workflow-list">
      {model.workflows.map((workflow) => (
        <SectionCard
          key={workflow.id}
          title={workflow.name}
          icon="share"
          actions={<Badge tone={workflow.health === "delayed" ? "red" : workflow.health === "at_risk" ? "orange" : "green"}>{workflow.currentBottleneck === "-" ? t("No bottleneck") : `${t("Bottleneck")}: ${workflow.currentBottleneck}`}</Badge>}
        >
          <div className="admin-workflow-legend">
            <span className="completed">{workflowStatusLabel("completed", language)}</span>
            <span className="in_progress">{workflowStatusLabel("in_progress", language)}</span>
            <span className="pending">{workflowStatusLabel("pending", language)}</span>
            <span className="delayed">{workflowStatusLabel("delayed", language)}</span>
          </div>

          <div className="admin-pipeline">
            {workflow.stages.length ? workflow.stages.map((stage, index) => (
              <span key={stage.id} className="admin-stage-flow-item">
                <div className={`admin-stage ${stage.status} ${stage.bottleneck ? "bottleneck" : ""}`}>
                  <div className="admin-stage-topline">
                    <span>{stage.order}</span>
                    <strong>{stage.name}</strong>
                  </div>
                  <small>{workflowStatusLabel(stage.status, language)}</small>
                  {stage.canMovePrevious && (
                    <button
                      type="button"
                      className="admin-stage-previous"
                      onClick={() => handleAdminMovePrevious(workflow, stage)}
                      disabled={savingPreviousStageIds.has(stage.stage_id || stage.id)}
                      title={language === "vi" ? "Quay lại stage trước" : "Move to previous stage"}
                      aria-label={language === "vi" ? "Quay lại stage trước" : "Move to previous stage"}
                    >
                      <Icon name="chevronLeft" size={13} />
                      <span>{savingPreviousStageIds.has(stage.stage_id || stage.id) ? "..." : "Previous"}</span>
                    </button>
                  )}
                </div>
                {index < workflow.stages.length - 1 && <span className="admin-stage-connector" aria-hidden="true"><Icon name="chevronRight" size={14} /></span>}
              </span>
            )) : <EmptyState label={language === "vi" ? "Project này chưa có quy trình" : "No workflow stages for this project"} />}
          </div>

          <div className="admin-workflow-summary">
            <span>{t("Progress")}: <strong>{workflow.progress}%</strong></span>
            <span>{t("Current bottleneck:")} <strong>{workflow.currentBottleneck}</strong></span>
          </div>
        </SectionCard>
      ))}
      {model.workflows.length === 0 && <SectionCard title={t("Workflows")} icon="share"><EmptyState label={t("No workflows found")} /></SectionCard>}
    </div>
  );

  const renderMonitoring = () => (
    <SectionCard title={t("System Monitoring")} icon="flag">
      <div className="admin-monitor-grid">
        {MONITORING_SUMMARY_ITEMS.map(({ label, types }) => {
          const count = model.monitoring.filter((item) => types.includes(item.type)).length;
          return <StatCard key={label} label={t(label)} value={count} tone={count > 0 ? "orange" : "green"} icon="flag" />;
        })}
      </div>
      <div className="admin-table monitoring">
        <div className="admin-table-head"><span>{t("Issue")}</span><span>{t("Scope")}</span><span>{t("Type")}</span><span>{t("Severity")}</span></div>
        {model.monitoring.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span><strong>{item.title}</strong></span>
            <span>{item.scope}</span>
            <span>{t(item.type)}</span>
            <span><Badge tone={item.level === "Critical" ? "red" : item.level === "Warning" ? "orange" : "green"}>{t(item.level)}</Badge></span>
          </div>
        ))}
      </div>
      {model.monitoring.length === 0 && <EmptyState label={t("No active issues")} />}
    </SectionCard>
  );

  const renderReports = () => {
    const isVi = language === "vi";
    const avgTaskCopy = {
      label: isVi ? "Trung bình cho 1 công việc hoàn thành" : "Average per completed task",
      unit: isVi ? "ngày / công việc" : "days / task",
      hint: isVi ? "Tính từ các công việc đã hoàn thành" : "Calculated from completed tasks",
    };
    const avgWorkflowCopy = {
      label: isVi ? "Trung bình cho 1 bước quy trình" : "Average per workflow stage",
      unit: isVi ? "ngày / bước" : "days / stage",
      hint: isVi ? "Tính từ các bước quy trình đang có dữ liệu" : "Calculated from workflow stages with data",
    };

    return (
    <div className="admin-view">
      <SectionCard
        title={t("Reports & Analytics")}
        icon="sliders"
        actions={(
          <select value={filters.reportRange} onChange={(event) => updateFilter("reportRange", event.target.value)}>
            <option value="Today">{t("Today")}</option><option value="7 Days">{t("7 Days")}</option><option value="30 Days">{t("30 Days")}</option><option value="3 Months">{t("3 Months")}</option><option value="Custom">{t("Custom")}</option>
          </select>
        )}
      >
        <div className="admin-report-grid">
          <StatCard label={t("Task Completion Rate")} value={`${model.reports.taskCompletionRate}%`} tone="green" showIcon={false} />
          <StatCard label={t("Project Completion Rate")} value={`${model.reports.projectCompletionRate}%`} tone="blue" showIcon={false} />
          <StatCard label={t("Overdue Rate")} value={`${model.reports.overdueRate}%`} tone={model.reports.overdueRate > 0 ? "red" : "green"} showIcon={false} />
          <StatCard label={t("Blocked Tasks")} value={model.reports.blockedTasks} tone={model.reports.blockedTasks > 0 ? "orange" : "green"} showIcon={false} />
          <StatCard label={t("Projects At Risk")} value={model.reports.projectsAtRisk} tone={model.reports.projectsAtRisk > 0 ? "red" : "green"} showIcon={false} />
        </div>
      </SectionCard>
      <div className="admin-dashboard-grid">
        <SectionCard title={t("Task Completion")} icon="activity"><DonutChart items={model.taskStatus} language={language} t={t} /></SectionCard>
        <SectionCard title={t("Project Performance")} icon="grid">
          <div className="admin-list-stack">
            {model.projects.slice(0, 8).map((project) => (
              <div key={project.id} className="admin-compact-row">
                <span>
                  <strong>{project.name}</strong>
                  <small>{t("Deadline:")} {formatDate(project.deadline)}</small>
                </span>
                <ProgressBar value={project.progress_percent} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
    );
  };

  const renderActivity = () => (
    <SectionCard title={t("Activity Logs")} icon="clock">
      <SearchFilter search={search} onSearch={setSearch} placeholder={t("Search")}>
        <select value={filters.activityAction} onChange={(event) => updateFilter("activityAction", event.target.value)}>
          <option value="all">{t("All actions")}</option>
          {[...new Set(model.activities.map((item) => item.action))].map((action) => <option key={action} value={action}>{t(action)}</option>)}
        </select>
        <input className="admin-date-input" type="date" />
      </SearchFilter>
      <div className="admin-table activity">
        <div className="admin-table-head"><span>{t("Time")}</span><span>{t("User")}</span><span>{t("Project")}</span><span>{t("Action")}</span><span>{t("Detail")}</span></div>
        {visibleActivities.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span>{formatDateTime(item.time)}</span>
            <span>{item.user}</span>
            <span>{item.project}</span>
            <span>{t(item.action)}</span>
            <span>{item.detail}</span>
          </div>
        ))}
      </div>
      {visibleActivities.length === 0 && <EmptyState label={t("No activity logs found")} />}
    </SectionCard>
  );

  const renderContent = () => {
    if (activeView === "dashboard") return renderDashboard();
    if (activeView === "users") return renderUsers();
    if (activeView === "groups") return renderGroups();
    if (activeView === "projects") return renderProjects();
    if (activeView === "tasks") return renderTasks();
    if (activeView === "workflows") return renderWorkflows();
    if (activeView === "monitoring") return renderMonitoring();
    if (activeView === "activity") return renderActivity();
    return renderDashboard();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button type="button" className="admin-brand" onClick={() => navigate("/")}>
          <span>TF</span>
          <div>
            <strong>TaskFlow</strong>
            <small>{t("Admin Console")}</small>
          </div>
        </button>
        <nav>
          {ADMIN_NAV.map((item) => (
            <button key={item.id} type="button" className={activeView === item.id ? "active" : ""} onClick={() => resetSearch(item.id)}>
              <Icon name={item.icon} size={17} />
              <span>{t(item.label)}</span>
            </button>
          ))}
        </nav>
        <div className="admin-account">
          <span>{user?.username || "Admin"}</span>
          <small>{user?.email}</small>
          <button type="button" onClick={logout}>{t("Sign out")}</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-breadcrumb">
              <button type="button" onClick={() => resetSearch("dashboard")}>{t("Admin")}</button>
              <Icon name="chevronRight" size={13} />
              <span>{t(activeNav.label)}</span>
            </div>
            <h1>{t(activeNav.label)}</h1>
            <p>{t(activeNav.description)}</p>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-language-switch" aria-label={t("Language")}>
              <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
              <button type="button" className={language === "vi" ? "active" : ""} onClick={() => setLanguage("vi")}>VI</button>
            </div>
            <button type="button" className="admin-refresh" onClick={loadAdminData} disabled={loading}>
              <Icon name="activity" size={15} />
              {t("Refresh")}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="admin-state">{t("Loading admin dashboard...")}</div>
        ) : error ? (
          <div className="admin-state error">{language === "vi" && error === "Cannot load admin dashboard." ? t(error) : error}</div>
        ) : renderContent()}
      </main>

      {modal && (
        <AdminModal title={modalTitle(modal, t)} onClose={() => setModal(null)}>
          <ModalContent modal={modal} model={model} onSaveUser={saveUser} t={t} language={language} />
        </AdminModal>
      )}
    </div>
  );
}

function TaskIssueList({ tasks, onView, t = (text) => text }) {
  if (!tasks.length) return <EmptyState label={t("No overdue or blocked tasks")} />;
  return (
    <div className="admin-list-stack">
      {tasks.map((task) => (
        <button key={task.id} type="button" className="admin-issue-row" onClick={() => onView(task)}>
          <span>{task.title}</span>
          <Badge tone={task.blocked ? "red" : "orange"}>{task.blocked ? t("Blocked Tasks") : t("Overdue Tasks")}</Badge>
        </button>
      ))}
    </div>
  );
}

function modalTitle(modal, t = (text) => text) {
  if (modal.type === "userForm") return modal.item ? t("Edit User") : t("Add User");
  if (modal.type === "user") return t("User Detail");
  if (modal.type === "task") return t("Task Detail");
  if (modal.type === "group") return t("Group Members");
  return t("Group");
}

function ModalContent({ modal, model, onSaveUser, t = (text) => text, language = "en" }) {
  const [form, setForm] = useState(modal.item || { status: "Active" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (modal.type === "userForm") {
    return (
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSaveUser(form); }}>
        <label>{t("Name")}<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
        <label>{t("Email")}<input value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>{t("Status")}<select value={form.status || "Active"} onChange={(event) => update("status", event.target.value)}><option value="Active">{t("Active")}</option><option value="Pending">{t("Pending")}</option><option value="Locked">{t("Locked")}</option></select></label>
        <button className="admin-primary-button" type="submit">{t("Save User")}</button>
      </form>
    );
  }

  if (modal.type === "user") {
    const ownedProjects = model.projects.filter((project) => project.owner_email === modal.item.email || project.owner_id === modal.item.id);
    const assignedTasks = model.tasks.filter((task) => task.assignee_email === modal.item.email || task.assignee === modal.item.name);
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.name}</strong><span>{modal.item.email}</span></p>
        <p><Badge tone={modal.item.status === "Locked" ? "red" : "green"}>{t(modal.item.status)}</Badge></p>
        <h4>{t("Projects")}</h4>
        {ownedProjects.map((project) => <span key={project.id}>{project.name}</span>)}
        {!ownedProjects.length && <EmptyState label={t("No projects")} />}
        <h4>{t("Tasks")}</h4>
        {assignedTasks.map((task) => <span key={task.id}>{task.title}</span>)}
        {!assignedTasks.length && <EmptyState label={t("No tasks")} />}
      </div>
    );
  }

  if (modal.type === "task") {
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.title}</strong><span>{modal.item.description || t("No description")}</span></p>
        <p><Badge>{formatStatus(modal.item.status, language)}</Badge><Badge>{formatStatus(modal.item.priority, language)}</Badge></p>
        <p><span>{t("Project:")} {modal.item.project_name || "-"}</span><span>{t("Assignee:")} {modal.item.assignee}</span></p>
        <p><span>{t("Deadline:")} {formatDate(modal.item.deadline)}</span><span>{t("Created:")} {formatDate(modal.item.created_at)}</span></p>
      </div>
    );
  }

  if (modal.type === "group") {
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.name}</strong><span>{modal.item.members} {t("members")}</span></p>
        {(modal.item.participants || []).map((user) => <span key={user.user_id}>{user.username} - {user.email}</span>)}
        {(modal.item.participants || []).length === 0 && <EmptyState label={t("No users found")} />}
      </div>
    );
  }

  return (
    <form className="admin-form">
      <label>{t("Group")}<input defaultValue={modal.item?.name || ""} /></label>
      <label>{t("Type")}<input defaultValue={modal.item?.type || ""} /></label>
      <button className="admin-primary-button" type="button">{t("Save Group")}</button>
    </form>
  );
}
