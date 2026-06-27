import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import api from "../api/axiosInstance";
import { getTranslation } from "../i18n/translations";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import "./NotificationsPage.css";

const PAGE_SIZE = 10;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [page, setPage] = useState(1);

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalNotifications / PAGE_SIZE));
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await api.get("/projects");
        const nextProjects = res.data.projects || [];
        setProjects(nextProjects);
        setActiveProject(nextProjects[0] || null);
      } catch (err) {
        console.error("Cannot load projects", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoadingNotifications(true);
      try {
        const res = await api.get("/notifications", {
          params: {
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          },
        });
        setNotifications(res.data.notifications || []);
        setTotalNotifications(Number(res.data.total || 0));
      } catch (err) {
        console.error("Cannot load notifications", err);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleLogout = async () => {
    if (await confirm(t("confirmLogout"), { confirmLabel: "Logout", danger: true })) {
      logout();
      navigate("/auth", { replace: true });
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      const res = await api.post("/projects", { name: newProjectName.trim() });
      const created = res.data.project;
      setProjects((prev) => [...prev, created]);
      setActiveProject(created);
      setNewProjectName("");
      setIsAddProjectModalOpen(false);
      setIsProjectMenuOpen(false);
    } catch (err) {
      showToast(t("cannotCreateProject"), "error");
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    const confirmed = await confirm(t("deleteProjectConfirm"), {
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${projectId}`);
      const nextProjects = projects.filter((project) => project.project_id !== projectId);
      setProjects(nextProjects);
      if (activeProject?.project_id === projectId) {
        setActiveProject(nextProjects[0] || null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || t("cannotDeleteProject"), "error");
    }
  };

  const markNotificationRead = async (notification) => {
    if (notification.is_read) return;
    try {
      await api.put(`/notifications/${notification.noti_id}/read`);
      setNotifications((prev) =>
        prev.map((item) =>
          item.noti_id === notification.noti_id ? { ...item, is_read: 1 } : item,
        ),
      );
    } catch (err) {
      console.error("Cannot mark notification read", err);
    }
  };

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={null}
        setActiveProject={() => {}}
        activeView="notifications"
        setActiveView={() => {}}
        setIsAddingTask={() => {}}
        loadingProjects={loadingProjects}
        handleDeleteProject={handleDeleteProject}
        onRequestEditProject={() => {}}
        t={t}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        handleLogout={handleLogout}
        isProjectMenuOpen={isProjectMenuOpen}
        setIsProjectMenuOpen={setIsProjectMenuOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
      />

      <main className="main-content notifications-page-content">
        <header className="main-header">
          <div className="breadcrumb">Notifications</div>
          <div className="main-actions">
            <button className="action-btn">
              <Icon name="more" size={14} />
            </button>
          </div>
        </header>

        <section className="notifications-panel">
          <div className="notifications-page-header">
            <h1>Notifications</h1>
          </div>

          {loadingNotifications ? (
            <div className="notifications-empty">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">No notifications</div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <button
                  key={notification.noti_id}
                  type="button"
                  className={`notifications-row ${notification.is_read ? "read" : ""}`}
                  onClick={() => markNotificationRead(notification)}
                >
                  <span className="notifications-dot" />
                  <span className="notifications-main">
                    <span className="notifications-title">{notification.title}</span>
                    <span className="notifications-meta">
                      {notification.task_project_name ||
                        notification.project_name ||
                        "TaskFlow"}
                      {notification.deadline &&
                        ` - Deadline ${new Date(notification.deadline).toLocaleDateString()}`}
                      {notification.change_note && ` - ${notification.change_note}`}
                      {" - "}
                      {timeAgo(notification.created_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="notifications-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </section>
      </main>

      <AddProjectModal
        isAddProjectModalOpen={isAddProjectModalOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        handleAddProject={handleAddProject}
        savingProject={savingProject}
      />

      <SettingsModal
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        settingsTab={activeSettingsTab}
        setSettingsTab={setActiveSettingsTab}
        user={user}
        updateUser={updateUser}
        handleLogout={handleLogout}
        t={t}
        language={language}
        setLanguage={setLanguage}
      />
    </div>
  );
}
