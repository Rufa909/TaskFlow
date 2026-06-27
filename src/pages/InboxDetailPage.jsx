import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import "./InboxDetailPage.css";

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

function approvalStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "leader_approved":
      return "Leader approved";
    case "approved":
      return "Approved";
    case "rejected":
      return "Changes requested";
    default:
      return status || "Unknown";
  }
}

function invitationStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    default:
      return status || "Unknown";
  }
}

export default function InboxDetailPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const t = (key) => getTranslation(language, key);

  const isApprovals = type === "approvals";
  const pageTitle = isApprovals ? "Approvals" : "Team Invitations";

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [page, setPage] = useState(1);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [activeProject, setActiveProject] = useState(null);

  const reviewableProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          Number(project.owner_id) === Number(user?.id) ||
          project.user_role === "leader",
      ),
    [projects, user?.id],
  );

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!["approvals", "invitations"].includes(type)) {
      navigate("/inbox", { replace: true });
    }
  }, [navigate, type]);

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
    if (isApprovals && loadingProjects) return;

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        if (isApprovals) {
          const submissionResults = await Promise.all(
            reviewableProjects.map((project) =>
              api
                .get(`/projects/${project.project_id}/task-submissions`, {
                  params: { includeHistory: true },
                })
                .then((res) =>
                  (res.data.submissions || []).map((item) => ({
                    ...item,
                    project_name: project.name,
                  })),
                )
                .catch(() => []),
            ),
          );

          setItems(
            submissionResults
              .flat()
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
          );
        } else {
          const res = await api.get("/teams/invitations", {
            params: { includeHistory: true },
          });
          setItems(res.data.invitations || []);
        }
        setPage(1);
      } catch (err) {
        console.error("Cannot load inbox details", err);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [isApprovals, loadingProjects, reviewableProjects, type]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
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

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={null}
        setActiveProject={() => {}}
        activeView="inbox"
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

      <main className="main-content inbox-detail-page-content">
        <header className="main-header">
          <div className="breadcrumb">Inbox / {pageTitle}</div>
          <div className="main-actions">
            <button className="action-btn" onClick={() => navigate("/inbox")}>
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        </header>

        <section className="inbox-detail-page-panel">
          <div className="inbox-detail-page-header">
            <h1>{pageTitle}</h1>
            <button type="button" onClick={() => navigate("/inbox")}>
              Back to Inbox
            </button>
          </div>

          {loadingItems ? (
            <div className="inbox-detail-page-empty">Loading...</div>
          ) : visibleItems.length === 0 ? (
            <div className="inbox-detail-page-empty">No history</div>
          ) : (
            <div className="inbox-detail-page-list">
              {visibleItems.map((item) =>
                isApprovals ? (
                  <div
                    className="inbox-detail-page-row"
                    key={`approval-detail-${item.submission_id}`}
                  >
                    <span className="inbox-detail-page-dot" />
                    <span className="inbox-detail-page-main">
                      <span className="inbox-detail-page-title">
                        {item.status === "leader_approved"
                          ? `Owner approval for "${item.title}"`
                          : `Review submitted task "${item.title}"`}
                      </span>
                      <span className="inbox-detail-page-meta">
                        {item.project_name} - submitted by {item.submitted_by_username}
                        {item.created_at && ` - ${timeAgo(item.created_at)}`}
                      </span>
                      {item.note && (
                        <span className="inbox-detail-page-note">{item.note}</span>
                      )}
                    </span>
                    <span className={`inbox-detail-page-status status-${item.status}`}>
                      {approvalStatusLabel(item.status)}
                    </span>
                  </div>
                ) : (
                  <div
                    className="inbox-detail-page-row"
                    key={`invitation-detail-${item.invitation_id}`}
                  >
                    <span className="inbox-detail-page-dot" />
                    <span className="inbox-detail-page-main">
                      <span className="inbox-detail-page-title">
                        {item.sender_username || "Unknown"}
                        {item.sender_email && (
                          <span className="inbox-detail-page-inline">
                            {item.sender_email}
                          </span>
                        )}
                      </span>
                      <span className="inbox-detail-page-meta">
                        {item.project_name || "Project"}
                        {item.created_at && ` - ${timeAgo(item.created_at)}`}
                      </span>
                    </span>
                    <span className={`inbox-detail-page-status status-${item.status}`}>
                      {invitationStatusLabel(item.status)}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="inbox-detail-page-pagination">
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
