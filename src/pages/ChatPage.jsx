import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import useSocketIo from "../hooks/useSocketIo";
import "./ChatPage.css";

const API_URL = "http://localhost:5000";

function avatarUrl(photo) {
  if (!photo) return "";
  return photo.startsWith("http") || photo.startsWith("data:")
    ? photo
    : `${API_URL}${photo}`;
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("taskflow.sidebarCollapsed") === "true",
  );

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);

  const activeProjectId = activeProject?.project_id;
  const socketProjectIds = useMemo(
    () => (activeProjectId ? [activeProjectId] : []),
    [activeProjectId],
  );

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
        showToast("Cannot load projects", "error");
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [showToast]);

  useEffect(() => {
    if (!activeProjectId) {
      setMessages([]);
      return;
    }

    let mounted = true;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await api.get(`/projects/${activeProjectId}/messages`);
        if (mounted) {
          setMessages(res.data.messages || []);
        }
      } catch (err) {
        console.error("Cannot load project messages", err);
        if (mounted) {
          showToast("Cannot load project chat", "error");
          setMessages([]);
        }
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    };

    fetchMessages();
    return () => {
      mounted = false;
    };
  }, [activeProjectId, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  const handleProjectMessage = useCallback(
    (payload) => {
      if (Number(payload?.projectId) !== Number(activeProjectId)) return;
      const nextMessage = payload.message;
      if (!nextMessage?.message_id) return;

      setMessages((prev) => {
        if (prev.some((item) => item.message_id === nextMessage.message_id)) {
          return prev;
        }
        return [...prev, nextMessage];
      });
    },
    [activeProjectId],
  );

  useSocketIo({
    enabled: Boolean(activeProjectId),
    projectIds: socketProjectIds,
    onProjectMessage: handleProjectMessage,
  });

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

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!activeProjectId || !messageText.trim() || sendingMessage) return;

    const content = messageText.trim();
    setMessageText("");
    setSendingMessage(true);

    try {
      await api.post(`/projects/${activeProjectId}/messages`, { content });
    } catch (err) {
      console.error("Cannot send project message", err);
      showToast(err.response?.data?.message || "Cannot send message", "error");
      setMessageText(content);
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={null}
        setActiveProject={() => {}}
        activeView="chat"
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

      <main className="main-content chat-page-content">
        <header className="main-header">
          <div className="breadcrumb">Project Chat</div>
          <div className="main-actions">
            <button className="action-btn" title="Project chat">
              <Icon name="chat" size={14} />
            </button>
          </div>
        </header>

        <section className="chat-page-shell">
          <aside className="chat-project-panel">
            <div className="chat-project-panel-header">
              <div>
                <h2>Projects</h2>
                <p>Choose a project to chat with its members.</p>
              </div>
            </div>

            <div className="chat-project-list">
              {loadingProjects ? (
                <div className="chat-empty">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="chat-empty">No projects yet.</div>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.project_id}
                    type="button"
                    className={`chat-project-row ${
                      activeProject?.project_id === project.project_id ? "active" : ""
                    }`}
                    onClick={() => setActiveProject(project)}
                  >
                    <span className="chat-project-icon">
                      <Icon name="hash" size={16} />
                    </span>
                    <span className="chat-project-main">
                      <span className="chat-project-name">{project.name}</span>
                      <span className="chat-project-role">
                        {project.user_role || "member"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="chat-conversation">
            <div className="chat-conversation-header">
              <div>
                <h1>{activeProject?.name || "Project Chat"}</h1>
                <p>
                  {activeProject
                    ? "Messages are shared with members in this project."
                    : "Select a project to start chatting."}
                </p>
              </div>
            </div>

            <div className="chat-message-list">
              {!activeProject ? (
                <div className="chat-empty chat-empty-large">Select a project first.</div>
              ) : loadingMessages ? (
                <div className="chat-empty chat-empty-large">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty chat-empty-large">
                  No messages yet. Start the project conversation.
                </div>
              ) : (
                messages.map((message) => {
                  const mine = Number(message.sender_id) === Number(user?.id);
                  return (
                    <div
                      key={message.message_id}
                      className={`chat-message-row ${mine ? "mine" : ""}`}
                    >
                      {!mine && (
                        <span className="chat-avatar">
                          {message.sender_photo ? (
                            <img src={avatarUrl(message.sender_photo)} alt="" />
                          ) : (
                            (message.sender_username || "U").charAt(0).toUpperCase()
                          )}
                        </span>
                      )}
                      <div className="chat-message-stack">
                        <div className="chat-message-meta">
                          <span>{mine ? "You" : message.sender_username || "User"}</span>
                          <span>{formatMessageTime(message.created_at)}</span>
                        </div>
                        <div className={`chat-message ${mine ? "mine" : ""}`}>
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder={
                  activeProject ? `Message ${activeProject.name}...` : "Select a project..."
                }
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                disabled={!activeProject || sendingMessage}
              />
              <button
                type="submit"
                disabled={!activeProject || sendingMessage || !messageText.trim()}
              >
                Send
              </button>
            </form>
          </section>
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
