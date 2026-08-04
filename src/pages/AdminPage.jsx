import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getTranslation } from "../i18n/translations";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import SettingsModal from "../components/modals/SettingsModal";
import "./homePage.css";
import "./AdminPage.css";

function formatStatus(status = "") {
  return String(status || "DRAFT").replace(/_/g, " ").toLowerCase();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function StatCard({ label, value, tone = "default" }) {
  return (
    <div className={`admin-page-stat ${tone}`}>
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function MonthlyLineChart({ data = [] }) {
  const points = [...data].reverse();
  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 20, bottom: 34, left: 38 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...points.flatMap((item) => [
    Number(item.tasks || 0),
    Number(item.completed_tasks || 0),
    Number(item.projects || 0),
  ]));

  const buildLine = (key) => points.map((item, index) => {
    const x = padding.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = padding.top + innerHeight - (Number(item[key] || 0) / maxValue) * innerHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <section className="admin-line-chart-card">
      <div className="admin-page-section-title">
        <Icon name="activity" size={16} />
        <span>Monthly trend</span>
      </div>
      {points.length === 0 ? (
        <p className="admin-empty">No monthly data.</p>
      ) : (
        <>
          <svg className="admin-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly system trend line chart">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + innerHeight * ratio;
              return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="admin-chart-grid-line" />;
            })}
            <polyline points={buildLine("tasks")} className="admin-chart-line tasks" />
            <polyline points={buildLine("completed_tasks")} className="admin-chart-line completed" />
            <polyline points={buildLine("projects")} className="admin-chart-line projects" />
            {points.map((item, index) => {
              const x = padding.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
              return (
                <text key={item.month} x={x} y={height - 10} textAnchor="middle" className="admin-chart-label">
                  {String(item.month).slice(5)}
                </text>
              );
            })}
            <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="admin-chart-label">{maxValue}</text>
            <text x={padding.left - 8} y={padding.top + innerHeight} textAnchor="end" className="admin-chart-label">0</text>
          </svg>
          <div className="admin-chart-legend">
            <span className="tasks">Tasks</span>
            <span className="completed">Completed</span>
            <span className="projects">Projects</span>
          </div>
        </>
      )}
    </section>
  );
}

function DropdownSection({ title, icon, summary, isOpen, onToggle, children }) {
  return (
    <section className={`admin-page-section admin-dropdown-section ${isOpen ? "open" : ""}`}>
      <button type="button" className="admin-section-toggle" onClick={onToggle}>
        <span className="admin-section-toggle-main">
          <Icon name={icon} size={16} />
          <span>{title}</span>
        </span>
        <span className="admin-section-toggle-meta">
          <em>{summary}</em>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>
      {isOpen && (
        <div className="admin-section-content">
          {children}
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = (key) => getTranslation(language, key);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [projects, setProjects] = useState([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    status: false,
    projects: false,
    monthly: false,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("taskflow.sidebarCollapsed") === "true",
  );

  const loadAdminStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/auth/admin/stats");
      const nextStats = res.data.stats || null;
      setStats(nextStats);
      const firstStatus = nextStats?.taskStatus?.[0]?.status || "";
      setSelectedStatus((current) => current || firstStatus);
    } catch (err) {
      setError(err.response?.data?.message || "Cannot load admin statistics.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminStats();
    api.get("/projects")
      .then((res) => setProjects(res.data.projects || []))
      .catch(() => setProjects([]));
  }, []);

  const selectedTasks = useMemo(() => {
    if (!selectedStatus) return [];
    const groups = stats?.tasksByStatus || {};
    const matchedKey = Object.keys(groups).find(
      (key) => key.toLowerCase() === String(selectedStatus).toLowerCase(),
    );
    return groups[matchedKey || selectedStatus] || [];
  }, [selectedStatus, stats]);
  const hasTaskDrilldownData = Object.keys(stats?.tasksByStatus || {}).length > 0;
  const hasProjectProgressData = (stats?.projectProgress || []).length > 0;
  const hasMonthlyStatsData = (stats?.monthlyStats || []).length > 0;
  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={projects[0] || null}
        setActiveProject={() => {}}
        activeView="admin"
        setActiveView={() => {}}
        setIsAddingTask={() => navigate("/")}
        loadingProjects={false}
        handleDeleteProject={() => {}}
        onRequestEditProject={() => {}}
        t={t}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        handleLogout={logout}
        isProjectMenuOpen={false}
        setIsProjectMenuOpen={() => {}}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        setIsAddProjectModalOpen={() => {}}
      />

      <main className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>Admin panel</h1>
            <p>System statistics, project progress, and task drill-downs</p>
          </div>
          <button type="button" onClick={loadAdminStats} disabled={loading}>
            <Icon name="activity" size={15} />
            Refresh
          </button>
        </header>

        {loading ? (
          <div className="admin-page-state">Loading system statistics...</div>
        ) : error ? (
          <div className="admin-page-state error">{error}</div>
        ) : (
          <>
            <section className="admin-overview-grid">
              <MonthlyLineChart data={stats?.monthlyStats || []} />
              <div className="admin-page-stat-grid">
                <StatCard label="Users" value={stats?.users?.total || 0} />
                <StatCard label="Active projects" value={stats?.projects?.active || 0} />
                <StatCard label="Active tasks" value={stats?.tasks?.active || 0} />
                <StatCard label="Completed tasks" value={stats?.tasks?.completed || 0} tone="green" />
                <StatCard label="Overdue tasks" value={stats?.tasks?.overdue || 0} tone="red" />
                <StatCard label="Due soon" value={stats?.tasks?.dueSoon || 0} tone="orange" />
                <StatCard label="Verified users" value={stats?.users?.verified || 0} />
              </div>
            </section>

            <DropdownSection
              title="Task status distribution"
              icon="activity"
              summary={`${stats?.taskStatus?.length || 0} statuses`}
              isOpen={openSections.status}
              onToggle={() => toggleSection("status")}
            >
              <div className="admin-status-grid">
                {(stats?.taskStatus || []).map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    className={`admin-status-card ${selectedStatus === item.status ? "active" : ""}`}
                    onClick={() => setSelectedStatus(item.status)}
                  >
                    <span>{formatStatus(item.status)}</span>
                    <strong>{item.count}</strong>
                  </button>
                ))}
              </div>

              <div className="admin-task-drilldown">
                <div className="admin-subsection-title">
                  <span>{selectedStatus ? `Tasks: ${formatStatus(selectedStatus)}` : "Tasks"}</span>
                  <em>{selectedTasks.length}</em>
                </div>
                {!hasTaskDrilldownData ? (
                  <p className="admin-empty warning">
                    Task list data is not available yet. Restart the backend so /auth/admin/stats returns tasksByStatus.
                  </p>
                ) : selectedTasks.length === 0 ? (
                  <p className="admin-empty">No tasks in this status.</p>
                ) : (
                  <div className="admin-task-table">
                    <div className="admin-task-head">
                      <span>Task</span>
                      <span>Project</span>
                      <span>Priority</span>
                      <span>Deadline</span>
                    </div>
                    {selectedTasks.map((task) => (
                      <div key={task.task_id} className="admin-task-row">
                        <span>
                          <strong>{task.title}</strong>
                          <small>{formatStatus(task.status)}</small>
                        </span>
                        <span>{task.project_name || "-"}</span>
                        <span className={`admin-priority ${task.priority || "medium"}`}>
                          {task.priority || "medium"}
                        </span>
                        <span>{formatDate(task.deadline)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DropdownSection>

            <DropdownSection
              title="Project progress overview"
              icon="grid"
              summary={`${stats?.projectProgress?.length || 0} active projects`}
              isOpen={openSections.projects}
              onToggle={() => toggleSection("projects")}
            >
              <div className="admin-project-list">
                {!hasProjectProgressData ? (
                  <p className="admin-empty warning">
                    Project progress data is not available yet. Restart the backend so /auth/admin/stats returns projectProgress.
                  </p>
                ) : (stats?.projectProgress || []).map((project) => (
                  <div key={project.project_id} className="admin-project-row">
                    <div className="admin-project-main">
                      <strong>{project.name}</strong>
                      <small>{project.owner_email || project.owner_name || "Unknown owner"}</small>
                    </div>
                    <div className="admin-project-progress">
                      <div className="admin-project-track">
                        <div style={{ width: `${project.progress_percent}%` }} />
                      </div>
                      <span>{project.progress_percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </DropdownSection>

            <DropdownSection
              title="Monthly statistics"
              icon="calendar"
              summary={`${stats?.monthlyStats?.length || 0} months`}
              isOpen={openSections.monthly}
              onToggle={() => toggleSection("monthly")}
            >
              <div className="admin-month-table">
                <div className="admin-month-head">
                  <span>Month</span>
                  <span>Users</span>
                  <span>Projects</span>
                  <span>Tasks</span>
                  <span>Completed</span>
                </div>
                {!hasMonthlyStatsData ? (
                  <div className="admin-month-row">
                    <strong>No monthly data</strong>
                    <span>-</span>
                    <span>-</span>
                    <span>-</span>
                    <span>-</span>
                  </div>
                ) : (stats?.monthlyStats || []).map((month) => (
                  <div key={month.month} className="admin-month-row">
                    <strong>{month.month}</strong>
                    <span>{month.users}</span>
                    <span>{month.projects}</span>
                    <span>{month.tasks}</span>
                    <span>{month.completed_tasks}</span>
                  </div>
                ))}
              </div>
            </DropdownSection>
          </>
        )}
      </main>

      <SettingsModal
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        settingsTab="account"
        setSettingsTab={() => {}}
        user={user}
        updateUser={updateUser}
        handleLogout={logout}
        t={t}
        language={language}
        setLanguage={setLanguage}
      />
    </div>
  );
}
