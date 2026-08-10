import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/common/Icon";
import "./AdminPage.css";

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "activity" },
  { id: "users", label: "Users", icon: "users" },
  { id: "groups", label: "Groups", icon: "teamAdd" },
  { id: "projects", label: "Projects", icon: "grid" },
  { id: "tasks", label: "Tasks", icon: "check" },
  { id: "workflows", label: "Workflows", icon: "share" },
  { id: "monitoring", label: "Monitoring", icon: "flag" },
  { id: "reports", label: "Reports", icon: "sliders" },
  { id: "activity", label: "Activity Logs", icon: "clock" },
  { id: "settings", label: "Settings", icon: "setting" },
];

const DONE_STATUSES = new Set(["COMPLETED", "OWNER_APPROVED"]);
const BLOCKED_STATUSES = new Set(["CHANGES_REQUESTED", "REJECTED", "BLOCKED"]);
const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "ACCEPTED", "ASSIGNED", "SUBMITTED", "LEADER_APPROVED"]);

function formatStatus(status = "") {
  return String(status || "DRAFT").replace(/_/g, " ").toLowerCase();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function isOverdue(deadline, status) {
  if (!deadline || DONE_STATUSES.has(String(status || "").toUpperCase())) return false;
  const date = new Date(deadline);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function getHealth(project) {
  if (Number(project.overdue_tasks || 0) > 0) return "delayed";
  if (Number(project.due_soon_tasks || 0) > 0 || Number(project.progress_percent || 0) < 40) return "at_risk";
  return "on_track";
}

function healthLabel(health) {
  if (health === "delayed") return "Delayed";
  if (health === "at_risk") return "At Risk";
  return "On Track";
}

function buildAdminModel(stats, visibleProjects, currentUser) {
  const taskGroups = stats?.tasksByStatus || {};
  const tasks = Object.values(taskGroups).flat().map((task) => ({
    ...task,
    id: Number(task.task_id),
    status: task.status || "DRAFT",
    priority: task.priority || "medium",
    assignee: task.assignee_name || task.owner_name || "Unassigned",
    assignee_email: task.assignee_email || "",
    overdue: isOverdue(task.deadline, task.status),
    blocked: BLOCKED_STATUSES.has(String(task.status || "").toUpperCase()),
  }));

  const projectProgress = stats?.projectProgress || [];
  const projects = projectProgress.map((project) => {
    const health = getHealth(project);
    return {
      ...project,
      id: Number(project.project_id),
      group: project.group_name || "Workspace",
      members: Number(project.member_count || 0),
      status: Number(project.progress_percent || 0) >= 100 ? "Completed" : "Active",
      deadline: project.deadline || null,
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
        deadline: project.deadline || null,
        health: "on_track",
      });
    }
  });

  const allProjects = [...projectMap.values()];
  const userTaskCounts = new Map();
  tasks.forEach((task) => {
    const key = task.assignee_email || task.assignee || "Unassigned";
    const current = userTaskCounts.get(key) || { name: task.assignee, email: task.assignee_email, tasks: 0, overdue: 0 };
    current.tasks += 1;
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
      status: item.locked ? "Locked" : item.email_verified ? "Active" : "Pending",
      projects: allProjects.filter((project) => project.owner_email === item.email || project.owner_id === item.user_id).length,
      tasks: workload.tasks || 0,
      lastActive: item.last_active || item.updated_at || item.created_at,
      auth_provider: item.auth_provider,
    };
  });

  const groups = (stats?.projectRoles || []).map((role, index) => ({
    id: index + 1,
    name: `${formatStatus(role.role)} group`,
    type: role.role || "member",
    status: "Active",
    members: Number(role.count || 0),
    projects: allProjects.filter((project) => String(project.user_role || "").toLowerCase() === String(role.role || "").toLowerCase()).length,
    owner: role.role === "owner" ? "Project owners" : "System",
  }));

  if (groups.length === 0) {
    groups.push({ id: 1, name: "Workspace group", type: "workspace", status: "Active", members: enrichedUsers.length, projects: allProjects.length, owner: "System" });
  }

  const workflows = allProjects.map((project) => {
    const progress = Number(project.progress_percent || 0);
    const stages = ["Content", "Design", "Review", "Publish"].map((name, index) => {
      const threshold = (index + 1) * 25;
      const done = progress >= threshold;
      const current = progress < threshold && progress >= index * 25;
      const delayed = (project.health === "delayed" || project.health === "at_risk") && current;
      return {
        id: `${project.project_id}-${index}`,
        name,
        owner: project.owner_email || project.owner_name || "Owner",
        status: done ? "completed" : current ? "in_progress" : "pending",
        processingTime: `${Math.max(1, index + Math.ceil(progress / 25))}d`,
        deadline: project.deadline,
        delayStatus: delayed ? "Delayed" : done ? "Normal" : "Pending",
        bottleneck: delayed,
      };
    });
    return {
      id: project.project_id,
      name: project.name,
      health: project.health,
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
    workload: [...userTaskCounts.values()].sort((a, b) => b.tasks - a.tasks).slice(0, 8),
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
      avgTaskCompletionTime: completed > 0 ? "2.4 days" : "-",
      avgWorkflowProcessingTime: workflows.length > 0 ? "4.1 days" : "-",
    },
  };
}

function StatCard({ label, value, tone = "default", icon = "activity" }) {
  return (
    <div className={`admin-stat-card ${tone}`}>
      <div>
        <span>{value}</span>
        <small>{label}</small>
      </div>
      <Icon name={icon} size={18} />
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

function SearchFilter({ search, onSearch, children }) {
  return (
    <div className="admin-toolbar">
      <label className="admin-search">
        <Icon name="search" size={15} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search" />
      </label>
      {children}
    </div>
  );
}

function ChartBars({ items, valueKey = "count", labelKey = "status" }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  if (!items.length) return <EmptyState label="No chart data" />;
  return (
    <div className="admin-bars">
      {items.map((item) => (
        <div key={item[labelKey]} className="admin-bar-row">
          <span>{formatStatus(item[labelKey])}</span>
          <div><i style={{ width: `${(Number(item[valueKey] || 0) / max) * 100}%` }} /></div>
          <strong>{item[valueKey]}</strong>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const completed = items.find((item) => DONE_STATUSES.has(String(item.status || "").toUpperCase()))?.count || 0;
  const value = total > 0 ? Math.round((Number(completed) / total) * 100) : 0;
  return (
    <div className="admin-donut" style={{ "--value": `${value}%` }}>
      <div>
        <strong>{value}%</strong>
        <span>Completed</span>
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
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    role: "all",
    userStatus: "all",
    projectStatus: "all",
    taskStatus: "all",
    taskPriority: "all",
    health: "all",
    reportRange: "30 Days",
  });
  const [localUsers, setLocalUsers] = useState([]);
  const [deletedUserIds, setDeletedUserIds] = useState(new Set());

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, projectRes] = await Promise.all([
        api.get("/auth/admin/stats"),
        api.get("/projects").catch(() => ({ data: { projects: [] } })),
      ]);
      setStats(statsRes.data.stats || null);
      setProjects(projectRes.data.projects || []);
    } catch (err) {
      setError(err.response?.data?.message || "Cannot load admin dashboard.");
      setStats(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const model = useMemo(() => {
    const base = buildAdminModel(stats, projects, user);
    const mergedUsers = [...base.users, ...localUsers]
      .filter((item, index, list) => list.findIndex((entry) => String(entry.email) === String(item.email)) === index)
      .filter((item) => !deletedUserIds.has(item.id));
    return { ...base, users: mergedUsers, stats: { ...base.stats, totalUsers: Math.max(base.stats.totalUsers, mergedUsers.length) } };
  }, [stats, projects, user, localUsers, deletedUserIds]);

  const activeNav = ADMIN_NAV.find((item) => item.id === activeView) || ADMIN_NAV[0];
  const lowerSearch = search.trim().toLowerCase();
  const filterText = (values) => !lowerSearch || values.some((value) => String(value || "").toLowerCase().includes(lowerSearch));
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetSearch = (view) => {
    setActiveView(view);
    setSearch("");
  };

  const visibleUsers = model.users.filter((item) => (
    filterText([item.name, item.email, item.role, item.status])
    && (filters.role === "all" || item.role === filters.role)
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
  ));

  const visibleActivities = model.activities.filter((item) => filterText([item.user, item.project, item.action, item.detail]));

  const lockUser = (target) => {
    setLocalUsers((current) => {
      const exists = current.some((item) => item.id === target.id);
      const nextUser = { ...target, status: target.status === "Locked" ? "Active" : "Locked" };
      return exists ? current.map((item) => (item.id === target.id ? nextUser : item)) : [...current, nextUser];
    });
  };

  const deleteUser = (target) => {
    setDeletedUserIds((current) => new Set(current).add(target.id));
  };

  const saveUser = (payload) => {
    setLocalUsers((current) => {
      const id = payload.id || `local-${Date.now()}`;
      const nextUser = {
        id,
        name: payload.name || "New user",
        email: payload.email || "new.user@taskflow.local",
        role: payload.role || "member",
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

  const renderDashboard = () => (
    <div className="admin-view">
      <div className="admin-stat-grid">
        <StatCard label="Total Users" value={model.stats.totalUsers} icon="users" />
        <StatCard label="Total Groups" value={model.stats.totalGroups} icon="teamAdd" />
        <StatCard label="Total Projects" value={model.stats.totalProjects} icon="grid" />
        <StatCard label="Total Tasks" value={model.stats.totalTasks} icon="check" />
        <StatCard label="Completed Tasks" value={model.stats.completedTasks} tone="green" icon="check" />
        <StatCard label="Overdue Tasks" value={model.stats.overdueTasks} tone="red" icon="clock" />
        <StatCard label="Blocked Tasks" value={model.stats.blockedTasks} tone="orange" icon="lock" />
        <StatCard label="Projects At Risk" value={model.stats.projectsAtRisk} tone="red" icon="flag" />
      </div>

      <div className="admin-dashboard-grid">
        <SectionCard title="Task Status" icon="activity"><ChartBars items={model.taskStatus} /></SectionCard>
        <SectionCard title="Project Progress" icon="grid">
          <div className="admin-list-stack">
            {model.projects.length ? model.projects.slice(0, 6).map((project) => (
              <div key={project.id} className="admin-compact-row">
                <span>{project.name}</span>
                <ProgressBar value={project.progress_percent} tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "blue"} />
              </div>
            )) : <EmptyState label="No projects" />}
          </div>
        </SectionCard>
        <SectionCard title="User Workload" icon="users">
          <div className="admin-list-stack">
            {model.workload.length ? model.workload.map((item) => (
              <div key={item.email || item.name} className="admin-workload-row">
                <span>{item.name}</span>
                <strong>{item.tasks}</strong>
                <small>{item.overdue} overdue</small>
              </div>
            )) : <EmptyState label="No workload data" />}
          </div>
        </SectionCard>
        <SectionCard title="Recent Activities" icon="clock">
          <div className="admin-timeline">
            {model.activities.slice(0, 6).map((item) => (
              <div key={item.id}>
                <time>{formatDate(item.time)}</time>
                <span>{item.user} {item.action}</span>
                <small>{item.detail}</small>
              </div>
            ))}
            {!model.activities.length && <EmptyState label="No activities" />}
          </div>
        </SectionCard>
        <SectionCard title="Projects At Risk" icon="flag">
          <RiskList projects={model.projects.filter((project) => project.health !== "on_track").slice(0, 6)} />
        </SectionCard>
        <SectionCard title="Overdue / Blocked Tasks" icon="lock">
          <TaskIssueList tasks={model.tasks.filter((task) => task.overdue || task.blocked).slice(0, 6)} onView={(task) => setModal({ type: "task", item: task })} />
        </SectionCard>
      </div>
    </div>
  );

  const renderUsers = () => (
    <SectionCard
      title="User Management"
      icon="users"
      actions={<button className="admin-primary-button" type="button" onClick={() => setModal({ type: "userForm", item: null })}><Icon name="plus" size={14} />Add User</button>}
    >
      <SearchFilter search={search} onSearch={setSearch}>
        <select value={filters.userStatus} onChange={(event) => updateFilter("userStatus", event.target.value)}>
          <option value="all">All status</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Locked">Locked</option>
        </select>
        <select value={filters.role} onChange={(event) => updateFilter("role", event.target.value)}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
          <option value="member">Member</option>
        </select>
      </SearchFilter>
      <div className="admin-table users">
        <div className="admin-table-head">
          <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Projects</span><span>Tasks</span><span>Last Active</span><span>Actions</span>
        </div>
        {visibleUsers.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span><strong>{item.name}</strong></span>
            <span>{item.email}</span>
            <span><Badge>{item.role}</Badge></span>
            <span><Badge tone={item.status === "Locked" ? "red" : item.status === "Pending" ? "orange" : "green"}>{item.status}</Badge></span>
            <span>{item.projects}</span>
            <span>{item.tasks}</span>
            <span>{formatDate(item.lastActive)}</span>
            <span className="admin-row-actions">
              <button type="button" onClick={() => setModal({ type: "user", item })}>View</button>
              <button type="button" onClick={() => setModal({ type: "userForm", item })}>Edit</button>
              <button type="button" onClick={() => lockUser(item)}>{item.status === "Locked" ? "Unlock" : "Lock"}</button>
              <button type="button" onClick={() => deleteUser(item)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
      {visibleUsers.length === 0 && <EmptyState label="No users found" />}
    </SectionCard>
  );

  const renderGroups = () => (
    <SectionCard
      title="Groups"
      icon="teamAdd"
      actions={<button className="admin-primary-button" type="button" onClick={() => setModal({ type: "groupForm" })}><Icon name="plus" size={14} />Create Group</button>}
    >
      <SearchFilter search={search} onSearch={setSearch}>
        <select value={filters.role} onChange={(event) => updateFilter("role", event.target.value)}>
          <option value="all">All types</option>
          {model.groups.map((group) => <option key={group.id} value={group.type}>{group.type}</option>)}
        </select>
      </SearchFilter>
      <div className="admin-card-grid">
        {model.groups
          .filter((group) => filterText([group.name, group.type, group.status]) && (filters.role === "all" || group.type === filters.role))
          .map((group) => (
            <div key={group.id} className="admin-group-card">
              <div>
                <strong>{group.name}</strong>
                <Badge tone="blue">{group.type}</Badge>
              </div>
              <p>{group.members} members · {group.projects} projects</p>
              <div className="admin-row-actions">
                <button type="button" onClick={() => setModal({ type: "group", item: group })}>Members</button>
                <button type="button" onClick={() => setModal({ type: "groupProjects", item: group })}>Projects</button>
                <button type="button" onClick={() => setModal({ type: "groupForm", item: group })}>Edit</button>
                <button type="button">Delete</button>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );

  const renderProjects = () => (
    <SectionCard title="Projects" icon="grid">
      <SearchFilter search={search} onSearch={setSearch}>
        <select value={filters.projectStatus} onChange={(event) => updateFilter("projectStatus", event.target.value)}>
          <option value="all">All projects</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="delayed">Overdue</option>
          <option value="archived">Archived</option>
          <option value="at_risk">At Risk</option>
        </select>
      </SearchFilter>
      <div className="admin-table projects">
        <div className="admin-table-head">
          <span>Project Name</span><span>Owner</span><span>Group</span><span>Members</span><span>Progress</span><span>Status</span><span>Deadline</span><span>Created At</span>
        </div>
        {visibleProjects.map((project) => (
          <div key={project.id} className="admin-table-row">
            <span><strong>{project.name}</strong><small>{project.owner_email || project.owner_name}</small></span>
            <span>{project.owner_email || project.owner_name || "-"}</span>
            <span>{project.group}</span>
            <span>{project.members}</span>
            <span><ProgressBar value={project.progress_percent} tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "blue"} /></span>
            <span><Badge tone={project.health === "delayed" ? "red" : project.health === "at_risk" ? "orange" : "green"}><i className={`admin-health-dot ${project.health}`} />{healthLabel(project.health)}</Badge></span>
            <span>{formatDate(project.deadline)}</span>
            <span>{formatDate(project.created_at)}</span>
          </div>
        ))}
      </div>
      {visibleProjects.length === 0 && <EmptyState label="No projects found" />}
    </SectionCard>
  );

  const renderTasks = () => (
    <SectionCard title="Tasks" icon="check">
      <SearchFilter search={search} onSearch={setSearch}>
        <select value={filters.taskStatus} onChange={(event) => updateFilter("taskStatus", event.target.value)}>
          <option value="all">All status</option>
          {model.taskStatus.map((item) => <option key={item.status} value={item.status}>{formatStatus(item.status)}</option>)}
        </select>
        <select value={filters.taskPriority} onChange={(event) => updateFilter("taskPriority", event.target.value)}>
          <option value="all">All priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </SearchFilter>
      <div className="admin-table tasks">
        <div className="admin-table-head">
          <span>Task</span><span>Project</span><span>Assignee</span><span>Status</span><span>Priority</span><span>Deadline</span><span>Created At</span><span>Actions</span>
        </div>
        {visibleTasks.map((task) => (
          <div key={task.id} className="admin-table-row">
            <span><strong>{task.title}</strong></span>
            <span>{task.project_name || "-"}</span>
            <span>{task.assignee}</span>
            <span><Badge tone={task.blocked ? "red" : DONE_STATUSES.has(task.status) ? "green" : ACTIVE_STATUSES.has(task.status) ? "blue" : "neutral"}>{formatStatus(task.status)}</Badge></span>
            <span><Badge tone={task.priority === "high" || task.priority === "urgent" ? "red" : task.priority === "medium" ? "orange" : "green"}>{task.priority}</Badge></span>
            <span>{formatDate(task.deadline)}</span>
            <span>{formatDate(task.created_at)}</span>
            <span className="admin-row-actions"><button type="button" onClick={() => setModal({ type: "task", item: task })}>Detail</button></span>
          </div>
        ))}
      </div>
      {visibleTasks.length === 0 && <EmptyState label="No tasks found" />}
    </SectionCard>
  );

  const renderWorkflows = () => (
    <div className="admin-workflow-list">
      {model.workflows.map((workflow) => (
        <SectionCard key={workflow.id} title={workflow.name} icon="share" actions={<Badge tone={workflow.health === "delayed" ? "red" : workflow.health === "at_risk" ? "orange" : "green"}>{workflow.currentBottleneck === "-" ? "No bottleneck" : `Bottleneck: ${workflow.currentBottleneck}`}</Badge>}>
          <div className="admin-pipeline">
            {workflow.stages.map((stage) => (
              <div key={stage.id} className={`admin-stage ${stage.status} ${stage.bottleneck ? "bottleneck" : ""}`}>
                <div>
                  <strong>{stage.name}</strong>
                  <Badge tone={stage.bottleneck ? "orange" : stage.status === "completed" ? "green" : stage.status === "in_progress" ? "blue" : "neutral"}>{stage.delayStatus}</Badge>
                </div>
                <small>Owner: {stage.owner}</small>
                <small>Processing: {stage.processingTime}</small>
                <small>Deadline: {formatDate(stage.deadline)}</small>
              </div>
            ))}
          </div>
          <div className="admin-workflow-summary">
            <span>Average processing time: <strong>{workflow.avgProcessingTime}</strong></span>
            <span>Current bottleneck: <strong>{workflow.currentBottleneck}</strong></span>
          </div>
        </SectionCard>
      ))}
      {model.workflows.length === 0 && <SectionCard title="Workflows" icon="share"><EmptyState label="No workflows found" /></SectionCard>}
    </div>
  );

  const renderMonitoring = () => (
    <SectionCard title="System Monitoring" icon="flag">
      <div className="admin-monitor-grid">
        {["Overdue Tasks", "Blocked Tasks", "Delayed Stages", "Projects At Risk", "Users Overloaded", "Workflow Bottlenecks"].map((label) => {
          const count = model.monitoring.filter((item) => item.type.toLowerCase().includes(label.split(" ")[0].toLowerCase())).length;
          return <StatCard key={label} label={label} value={count} tone={count > 0 ? "orange" : "green"} icon="flag" />;
        })}
      </div>
      <div className="admin-table monitoring">
        <div className="admin-table-head"><span>Issue</span><span>Scope</span><span>Type</span><span>Severity</span></div>
        {model.monitoring.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span><strong>{item.title}</strong></span>
            <span>{item.scope}</span>
            <span>{item.type}</span>
            <span><Badge tone={item.level === "Critical" ? "red" : item.level === "Warning" ? "orange" : "green"}>{item.level}</Badge></span>
          </div>
        ))}
      </div>
      {model.monitoring.length === 0 && <EmptyState label="No active issues" />}
    </SectionCard>
  );

  const renderReports = () => (
    <div className="admin-view">
      <SectionCard
        title="Reports & Analytics"
        icon="sliders"
        actions={(
          <select value={filters.reportRange} onChange={(event) => updateFilter("reportRange", event.target.value)}>
            <option>Today</option><option>7 Days</option><option>30 Days</option><option>3 Months</option><option>Custom</option>
          </select>
        )}
      >
        <div className="admin-report-grid">
          <StatCard label="Task Completion Rate" value={`${model.reports.taskCompletionRate}%`} tone="green" />
          <StatCard label="Project Completion Rate" value={`${model.reports.projectCompletionRate}%`} tone="blue" />
          <StatCard label="Overdue Rate" value={`${model.reports.overdueRate}%`} tone={model.reports.overdueRate > 0 ? "red" : "green"} />
          <StatCard label="Average Task Completion Time" value={model.reports.avgTaskCompletionTime} />
          <StatCard label="Average Workflow Processing Time" value={model.reports.avgWorkflowProcessingTime} />
        </div>
      </SectionCard>
      <div className="admin-dashboard-grid">
        <SectionCard title="Task Completion" icon="activity"><DonutChart items={model.taskStatus} /></SectionCard>
        <SectionCard title="Project Performance" icon="grid">
          <div className="admin-list-stack">
            {model.projects.slice(0, 8).map((project) => (
              <div key={project.id} className="admin-compact-row">
                <span>{project.name}</span>
                <ProgressBar value={project.progress_percent} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const renderActivity = () => (
    <SectionCard title="Activity Logs" icon="clock">
      <SearchFilter search={search} onSearch={setSearch}>
        <select><option>All actions</option><option>Project</option><option>Task</option><option>Workflow</option></select>
        <input className="admin-date-input" type="date" />
      </SearchFilter>
      <div className="admin-table activity">
        <div className="admin-table-head"><span>Time</span><span>User</span><span>Project</span><span>Action</span><span>Detail</span></div>
        {visibleActivities.map((item) => (
          <div key={item.id} className="admin-table-row">
            <span>{formatDate(item.time)}</span>
            <span>{item.user}</span>
            <span>{item.project}</span>
            <span>{item.action}</span>
            <span>{item.detail}</span>
          </div>
        ))}
      </div>
      {visibleActivities.length === 0 && <EmptyState label="No activity logs found" />}
    </SectionCard>
  );

  const renderSettings = () => (
    <div className="admin-settings-grid">
      {[
        "User permissions",
        "Task settings",
        "Workflow settings",
        "Notification settings",
        "Project settings",
        "AI settings",
      ].map((label) => (
        <SectionCard key={label} title={label} icon="setting">
          <div className="admin-setting-row"><span>Enabled</span><input type="checkbox" defaultChecked /></div>
          <div className="admin-setting-row"><span>Require admin approval</span><input type="checkbox" /></div>
          <div className="admin-setting-row"><span>Audit changes</span><input type="checkbox" defaultChecked /></div>
        </SectionCard>
      ))}
    </div>
  );

  const renderContent = () => {
    if (activeView === "dashboard") return renderDashboard();
    if (activeView === "users") return renderUsers();
    if (activeView === "groups") return renderGroups();
    if (activeView === "projects") return renderProjects();
    if (activeView === "tasks") return renderTasks();
    if (activeView === "workflows") return renderWorkflows();
    if (activeView === "monitoring") return renderMonitoring();
    if (activeView === "reports") return renderReports();
    if (activeView === "activity") return renderActivity();
    return renderSettings();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button type="button" className="admin-brand" onClick={() => navigate("/")}>
          <span>TF</span>
          <div>
            <strong>TaskFlow</strong>
            <small>Admin Console</small>
          </div>
        </button>
        <nav>
          {ADMIN_NAV.map((item) => (
            <button key={item.id} type="button" className={activeView === item.id ? "active" : ""} onClick={() => resetSearch(item.id)}>
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-account">
          <span>{user?.username || "Admin"}</span>
          <small>{user?.email}</small>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-breadcrumb">
              <button type="button" onClick={() => resetSearch("dashboard")}>Admin</button>
              <Icon name="chevronRight" size={13} />
              <span>{activeNav.label}</span>
            </div>
            <h1>{activeNav.label}</h1>
          </div>
          <button type="button" className="admin-refresh" onClick={loadAdminData} disabled={loading}>
            <Icon name="activity" size={15} />
            Refresh
          </button>
        </header>

        {loading ? (
          <div className="admin-state">Loading admin dashboard...</div>
        ) : error ? (
          <div className="admin-state error">{error}</div>
        ) : renderContent()}
      </main>

      {modal && (
        <AdminModal title={modalTitle(modal)} onClose={() => setModal(null)}>
          <ModalContent modal={modal} model={model} onSaveUser={saveUser} />
        </AdminModal>
      )}
    </div>
  );
}

function RiskList({ projects }) {
  if (!projects.length) return <EmptyState label="No projects at risk" />;
  return (
    <div className="admin-list-stack">
      {projects.map((project) => (
        <div key={project.id} className="admin-risk-row">
          <span>{project.name}</span>
          <Badge tone={project.health === "delayed" ? "red" : "orange"}>{healthLabel(project.health)}</Badge>
        </div>
      ))}
    </div>
  );
}

function TaskIssueList({ tasks, onView }) {
  if (!tasks.length) return <EmptyState label="No overdue or blocked tasks" />;
  return (
    <div className="admin-list-stack">
      {tasks.map((task) => (
        <button key={task.id} type="button" className="admin-issue-row" onClick={() => onView(task)}>
          <span>{task.title}</span>
          <Badge tone={task.blocked ? "red" : "orange"}>{task.blocked ? "Blocked" : "Overdue"}</Badge>
        </button>
      ))}
    </div>
  );
}

function modalTitle(modal) {
  if (modal.type === "userForm") return modal.item ? "Edit User" : "Add User";
  if (modal.type === "user") return "User Detail";
  if (modal.type === "task") return "Task Detail";
  if (modal.type === "group") return "Group Members";
  if (modal.type === "groupProjects") return "Group Projects";
  return "Group";
}

function ModalContent({ modal, model, onSaveUser }) {
  const [form, setForm] = useState(modal.item || { role: "member", status: "Active" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (modal.type === "userForm") {
    return (
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSaveUser(form); }}>
        <label>Name<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
        <label>Email<input value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Role<select value={form.role || "member"} onChange={(event) => update("role", event.target.value)}><option value="admin">Admin</option><option value="owner">Owner</option><option value="member">Member</option></select></label>
        <label>Status<select value={form.status || "Active"} onChange={(event) => update("status", event.target.value)}><option>Active</option><option>Pending</option><option>Locked</option></select></label>
        <button className="admin-primary-button" type="submit">Save User</button>
      </form>
    );
  }

  if (modal.type === "user") {
    const ownedProjects = model.projects.filter((project) => project.owner_email === modal.item.email || project.owner_id === modal.item.id);
    const assignedTasks = model.tasks.filter((task) => task.assignee_email === modal.item.email || task.assignee === modal.item.name);
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.name}</strong><span>{modal.item.email}</span></p>
        <p><Badge>{modal.item.role}</Badge><Badge tone={modal.item.status === "Locked" ? "red" : "green"}>{modal.item.status}</Badge></p>
        <h4>Projects</h4>
        {ownedProjects.map((project) => <span key={project.id}>{project.name}</span>)}
        {!ownedProjects.length && <EmptyState label="No projects" />}
        <h4>Tasks</h4>
        {assignedTasks.map((task) => <span key={task.id}>{task.title}</span>)}
        {!assignedTasks.length && <EmptyState label="No tasks" />}
      </div>
    );
  }

  if (modal.type === "task") {
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.title}</strong><span>{modal.item.description || "No description"}</span></p>
        <p><Badge>{formatStatus(modal.item.status)}</Badge><Badge>{modal.item.priority}</Badge></p>
        <p><span>Project: {modal.item.project_name || "-"}</span><span>Assignee: {modal.item.assignee}</span></p>
        <p><span>Deadline: {formatDate(modal.item.deadline)}</span><span>Created: {formatDate(modal.item.created_at)}</span></p>
      </div>
    );
  }

  if (modal.type === "groupProjects") {
    const projects = model.projects.filter((project) => project.group === modal.item.name || project.user_role === modal.item.type);
    return (
      <div className="admin-modal-detail">
        {projects.map((project) => <span key={project.id}>{project.name}</span>)}
        {!projects.length && <EmptyState label="No projects" />}
      </div>
    );
  }

  if (modal.type === "group") {
    return (
      <div className="admin-modal-detail">
        <p><strong>{modal.item.name}</strong><span>{modal.item.members} members</span></p>
        {model.users.slice(0, modal.item.members || 4).map((user) => <span key={user.id}>{user.name} · {user.email}</span>)}
      </div>
    );
  }

  return (
    <form className="admin-form">
      <label>Group name<input defaultValue={modal.item?.name || ""} /></label>
      <label>Type<input defaultValue={modal.item?.type || ""} /></label>
      <button className="admin-primary-button" type="button">Save Group</button>
    </form>
  );
}
