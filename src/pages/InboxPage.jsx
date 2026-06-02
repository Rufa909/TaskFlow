import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import api from "../api/axiosInstance";
import { getTranslation } from "../i18n/translations";
import TaskList from "../components/task/TaskList";
import AddTaskForm from "../components/task/AddTaskForm";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";
import { useFilters } from "../context/FiltersContext";
import { useTeams } from "../context/TeamsContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import "./InboxPage.css";

const API_URL = "http://localhost:5000";

function avatarUrl(photo) {
  if (!photo) return "";
  return photo.startsWith("http") || photo.startsWith("data:")
    ? photo
    : `${API_URL}${photo}`;
}

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

export default function InboxPage() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { language, setLanguage } = useLanguage();

  const t = (key) => getTranslation(language, key);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskSubmissions, setTaskSubmissions] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [reviewingKey, setReviewingKey] = useState("");

  // Invitation states
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [fadingIds, setFadingIds] = useState(new Set());

  // Sidebar states
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");

  // Task UI states
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(null);
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);

  const [taskAttachment, setTaskAttachment] = useState([]);

  // Selected task for editing
  const [selectedTask, setSelectedTask] = useState(null);

  const { refreshInvitationCount } = useTeams();
  const reviewableProjects = projects.filter(
    (project) =>
      Number(project.owner_id) === Number(user?.id) ||
      project.user_role === "leader",
  );
  const canReviewApprovals = reviewableProjects.length > 0;

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await api.get("/projects");
        setProjects(res.data.projects || []);
      } catch (err) {
        console.error("Cannot load projects", err);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!canReviewApprovals) {
      setLoadingApprovals(false);
      setTaskSubmissions([]);
      return;
    }

    const fetchApprovals = async () => {
      setLoadingApprovals(true);
      try {
        const submissionResults = await Promise.all(
          reviewableProjects.map((project) =>
            api
              .get(`/projects/${project.project_id}/task-submissions`)
              .then((res) =>
                (res.data.submissions || []).map((item) => ({
                  ...item,
                  project_name: project.name,
                })),
              )
              .catch(() => []),
          ),
        );

        setTaskSubmissions(
          submissionResults
            .flat()
            .filter((item) => ["pending", "leader_approved"].includes(item.status)),
        );
      } finally {
        setLoadingApprovals(false);
      }
    };

    fetchApprovals();
  }, [projects, user]);

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await api.get("/tasks");
        setTasks(res.data.tasks || []);
      } catch (err) {
        console.error("Cannot load inbox tasks", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    const fetchInvitations = async () => {
      setLoadingInvitations(true);
      try {
        const res = await api.get("/teams/invitations");
        setInvitations(res.data.invitations || []);
      } catch (err) {
        console.error("Cannot load invitations", err);
      } finally {
        setLoadingInvitations(false);
      }
    };
    fetchInvitations();
  }, []);

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    try {
      await api.delete(`/projects/${task.project_id}/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err) {
      console.error(err);
      showToast("Cannot delete task", "error");
    }
  };

  const handleUpdateTask = async (taskId, updatedData) => {
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    try {
      const res = await api.put(
        `/projects/${task.project_id}/tasks/${taskId}`,
        updatedData,
      );
      const updatedTask = {
        ...res.data.task,
        project_name: task.project_name,
      };
      setTasks((prev) =>
        prev.map((t) => (t.task_id === taskId ? updatedTask : t)),
      );
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      showToast("Cannot update task", "error");
    }
  };

  const handleCompleteTask = async (task) => {
    if (!task?.task_id || !task?.project_id) return;
    try {
      const res = await api.post(
        `/projects/${task.project_id}/tasks/${task.task_id}/complete`,
      );
      const updatedTask = { ...task, ...res.data.task };
      if (updatedTask.status === "COMPLETED" || updatedTask.completed_at) {
        setTasks((prev) => prev.filter((item) => item.task_id !== task.task_id));
        return;
      }

      setTasks((prev) =>
        prev.map((item) => (item.task_id === task.task_id ? updatedTask : item)),
      );
    } catch (err) {
      console.error(err);
      showToast("Cannot complete task", "error");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      // If no project selected, try to add to first project or create as inbox task
      let projId = activeProject?.project_id;
      if (!projId && projects.length > 0) {
        projId = projects[0].project_id;
      }

      if (!projId) {
        showToast("Please select a project first", "error");
        return;
      }

      const formData = new FormData();
      formData.append("title", newTaskTitle.trim());
      formData.append("description", newTaskDesc.trim());
      formData.append(
        "deadline",
        taskDeadline ? taskDeadline.toISOString() : "",
      );
      formData.append("time", taskTime || "");
      formData.append("priority", taskPriority);
      if (taskAssignee) {
        formData.append("assigned_to", taskAssignee);
      }

      taskAttachment.forEach((file) => formData.append("attachments", file));

      const res = await api.post(`/projects/${projId}/tasks`, formData);

      const newTask = {
        ...res.data.task,
        project_name: activeProject?.name || projects[0]?.name || "Project",
      };

      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setTaskDeadline(null);
      setTaskTime("");
      setTaskPriority("medium");
      setTaskAssignee("");
      setTaskAttachment([]);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Cannot add task", "error");
    }
  };

  // Respond to invitation (accept / decline)
  const handleRespond = async (invitationId, action) => {
    setRespondingId(invitationId);

    try {
      await api.put(`/teams/invitations/${invitationId}`, { action });

      // Trigger fade-out animation
      setFadingIds((prev) => new Set(prev).add(invitationId));

      // Remove from list after animation
      setTimeout(() => {
        setInvitations((prev) =>
          prev.filter((inv) => inv.invitation_id !== invitationId),
        );
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(invitationId);
          return next;
        });
        refreshInvitationCount();
      }, 450);
    } catch (err) {
      console.error("Cannot respond to invitation", err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleReviewSubmission = async (submission, action) => {
    const key = `submission-${submission.submission_id}`;
    setReviewingKey(key);
    try {
      await api.put(
        `/projects/${submission.project_id}/task-submissions/${submission.submission_id}`,
        { action },
      );
      setTaskSubmissions((prev) =>
        prev.filter((item) => item.submission_id !== submission.submission_id),
      );
      showToast(action === "approve" ? "Task approved" : "Submission rejected", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot review submission", "error");
    } finally {
      setReviewingKey("");
    }
  };

  const { filters } = useFilters();

  const filtered = tasks.filter((task) => {
    if (
      filters.priorities.length > 0 &&
      (!task.priority || !filters.priorities.includes(task.priority))
    )
      return false;
    if (filters.labels.length > 0) {
      // tasks don't have labels in DB; skip label filtering for now
    }
    return true;
  });

  const handleLogout = async () => {
    if (await confirm(t("confirmLogout"), { confirmLabel: "Logout", danger: true })) {
      logout();
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
        handleDeleteProject={() => {}}
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

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="breadcrumb">Inbox</div>
          <div className="main-actions">
            <button className="action-btn">
              <Icon name="more" size={14} />
            </button>
          </div>
        </header>

        <div className="task-list-container inbox-content">
          <h1 className="page-title">Inbox</h1>

          <div className="inbox-approvals-section">
            <div className="inbox-invitations-title">
              <span className="title-icon">
                <Icon name="check" size={16} />
              </span>
              Approvals
              {taskSubmissions.length > 0 && (
                <span className="invitation-count-badge">
                  {taskSubmissions.length}
                </span>
              )}
            </div>

            {loadingApprovals ? (
              <div className="inv-loading">
                <div className="inv-spinner" />
                <span>Loading approvals...</span>
              </div>
            ) : taskSubmissions.length === 0 ? (
              <div className="inv-empty-state">
                <div className="inv-empty-icon">✓</div>
                <div className="inv-empty-text">No pending approvals</div>
              </div>
            ) : (
              <>
                {taskSubmissions.map((submission) => (
                  <div className="inbox-approval-card" key={`submission-${submission.submission_id}`}>
                    <div className="approval-info">
                      <div className="approval-title">
                        {submission.status === "leader_approved"
                          ? `Owner approval for "${submission.title}"`
                          : `Review submitted task "${submission.title}"`}
                      </div>
                      <div className="approval-meta">
                        {submission.project_name} - submitted by {submission.submitted_by_username}
                      </div>
                    </div>
                    <div className="inv-actions">
                      <button
                        className="inv-accept-btn"
                        disabled={reviewingKey === `submission-${submission.submission_id}`}
                        onClick={() => handleReviewSubmission(submission, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="inv-decline-btn"
                        disabled={reviewingKey === `submission-${submission.submission_id}`}
                        onClick={() => handleReviewSubmission(submission, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="inbox-section-divider" />
          </div>

          {/* ---- Invitations Section ---- */}
          <div className="inbox-invitations-section">
            <div className="inbox-invitations-title">
              <span className="title-icon">
                <Icon name="mail" size={16} />
              </span>
              Team Invitations
              {invitations.length > 0 && (
                <span className="invitation-count-badge">
                  {invitations.length}
                </span>
              )}
            </div>

            {loadingInvitations ? (
              <div className="inv-loading">
                <div className="inv-spinner" />
                <span>Loading invitations...</span>
              </div>
            ) : invitations.length === 0 ? (
              <div className="inv-empty-state">
                <div className="inv-empty-icon">📭</div>
                <div className="inv-empty-text">No pending invitations</div>
              </div>
            ) : (
              invitations.map((inv) => (
                <div
                  key={inv.invitation_id}
                  className={`inbox-invitation-card ${fadingIds.has(inv.invitation_id) ? "fading-out" : ""}`}
                >
                  {/* Sender avatar */}
                  <div className="inv-sender-avatar">
                    {inv.sender_photo ? (
                      <img
                        src={avatarUrl(inv.sender_photo)}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      (inv.sender_username || "U").charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="inv-info">
                    <div className="inv-sender-row">
                      <span className="inv-sender-name">
                        {inv.sender_username || "Unknown"}
                      </span>
                      {inv.sender_email && (
                        <span className="inv-sender-email">
                          {inv.sender_email}
                        </span>
                      )}
                    </div>
                    <div className="inv-details-row">
                      <span className="inv-project-badge">
                        <Icon name="hash" size={11} />
                        {inv.project_name || "Project"}
                      </span>
                      {inv.created_at && (
                        <span className="inv-timestamp">
                          {timeAgo(inv.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="inv-actions">
                    <button
                      className="inv-accept-btn"
                      onClick={() => handleRespond(inv.invitation_id, "accept")}
                      disabled={respondingId === inv.invitation_id}
                    >
                      <Icon name="check" size={14} />
                      Accept
                    </button>
                    <button
                      className="inv-decline-btn"
                      onClick={() =>
                        handleRespond(inv.invitation_id, "decline")
                      }
                      disabled={respondingId === inv.invitation_id}
                    >
                      <Icon name="x" size={14} />
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="inbox-section-divider" />
          </div>

          {/* ---- Tasks Section ---- */}
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : tasks.length === 0 ? (
            <>
              <div className="inbox-no-tasks-state">
                <div className="inbox-empty-icon">✨</div>
                <h3>Inbox Zero!</h3>
                <p>Great job! You've completed all your inbox tasks.</p>
                <button
                  className="add-task-btn"
                  onClick={() => setIsAddingTask(true)}
                  style={{ marginTop: "16px" }}
                >
                  <span className="icon">
                    <Icon name="plus" size={18} />
                  </span>
                  Add a task
                </button>
              </div>
            </>
          ) : (
            <>
              {isAddingTask ? (
                <AddTaskForm
                  newTaskTitle={newTaskTitle}
                  setNewTaskTitle={setNewTaskTitle}
                  newTaskDesc={newTaskDesc}
                  setNewTaskDesc={setNewTaskDesc}
                  handleAddTask={handleAddTask}
                  taskDeadline={taskDeadline}
                  setTaskDeadline={setTaskDeadline}
                  taskTime={taskTime}
                  setTaskTime={setTaskTime}
                  taskAttachment={taskAttachment}
                  setTaskAttachment={setTaskAttachment}
                  taskPriority={taskPriority}
                  setTaskPriority={setTaskPriority}
                  taskAssignee={taskAssignee}
                  setTaskAssignee={setTaskAssignee}
                  isDatePickerOpen={isDatePickerOpen}
                  setIsDatePickerOpen={setIsDatePickerOpen}
                  activeProject={activeProject}
                  projects={projects}
                  setActiveProject={setActiveProject}
                  isTaskProjectMenuOpen={isTaskProjectMenuOpen}
                  setIsTaskProjectMenuOpen={setIsTaskProjectMenuOpen}
                  setIsAddingTask={setIsAddingTask}
                />
              ) : (
                <button
                  className="add-task-btn"
                  onClick={() => setIsAddingTask(true)}
                  style={{ marginBottom: "20px" }}
                >
                  <span className="icon">
                    <Icon name="plus" size={18} />
                  </span>
                  Add task
                </button>
              )}
              <TaskList
                tasks={filtered}
                handleDeleteTask={(id) => handleDeleteTask(id)}
                setSelectedTask={setSelectedTask}
                handleCompleteTask={handleCompleteTask}
                currentUserId={user?.id}
              />
            </>
          )}
        </div>
      </main>

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

      <EditTaskModal
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        handleUpdateTask={handleUpdateTask}
      />
    </div>
  );
}
