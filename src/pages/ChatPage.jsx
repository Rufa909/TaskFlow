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
  return photo.startsWith("http") || photo.startsWith("data:") ? photo : `${API_URL}${photo}`;
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

function displayName(member) {
  return member?.username || member?.email || "User";
}

function conversationKey(conversation) {
  return String(conversation?.conversation_id || "");
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

  const [members, setMembers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [canManageProject, setCanManageProject] = useState(false);

  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [groupAddUserId, setGroupAddUserId] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const messagesEndRef = useRef(null);
  const activeProjectId = activeProject?.project_id;
  const activeConversationId = conversationKey(activeConversation);
  const socketProjectIds = useMemo(() => (activeProjectId ? [activeProjectId] : []), [activeProjectId]);

  const memberById = useMemo(() => {
    const map = new Map();
    for (const member of members) map.set(Number(member.user_id), member);
    return map;
  }, [members]);

  const selectableMembers = useMemo(
    () => members.filter((member) => Number(member.user_id) !== Number(user?.id)),
    [members, user?.id],
  );

  const activeConversationTitle = useMemo(() => {
    if (!activeConversation) return "Project Chat";
    if (activeConversation.type === "direct") {
      const other = (activeConversation.participants || [])
        .map((id) => memberById.get(Number(id)))
        .find((member) => Number(member?.user_id) !== Number(user?.id));
      return displayName(other) || "Direct chat";
    }
    return activeConversation.name || activeProject?.name || "Project Chat";
  }, [activeConversation, activeProject?.name, memberById, user?.id]);

  const getConversationLabel = useCallback(
    (conversation) => {
      if (conversation.type === "project") return activeProject?.name || "Project Chat";
      if (conversation.type === "group") return conversation.name || "Group chat";
      const other = (conversation.participants || [])
        .map((id) => memberById.get(Number(id)))
        .find((member) => Number(member?.user_id) !== Number(user?.id));
      return displayName(other) || "Direct chat";
    },
    [activeProject?.name, memberById, user?.id],
  );

  const groupParticipantIds = useMemo(
    () => new Set((activeConversation?.participants || []).map(Number)),
    [activeConversation?.participants],
  );
  const membersOutsideActiveGroup = useMemo(
    () => selectableMembers.filter((member) => !groupParticipantIds.has(Number(member.user_id))),
    [groupParticipantIds, selectableMembers],
  );
  const activeGroupMembers = useMemo(
    () => selectableMembers.filter((member) => groupParticipantIds.has(Number(member.user_id))),
    [groupParticipantIds, selectableMembers],
  );

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await api.get("/projects");
      const nextProjects = res.data.projects || [];
      setProjects(nextProjects);
      setActiveProject((current) => current || nextProjects[0] || null);
    } catch (err) {
      console.error("Cannot load projects", err);
      showToast("Cannot load projects", "error");
    } finally {
      setLoadingProjects(false);
    }
  }, [showToast]);

  const loadProjectChat = useCallback(async (projectId) => {
    if (!projectId) return;
    setLoadingChat(true);
    try {
      const res = await api.get(`/projects/${projectId}/chat`);
      const nextMembers = res.data.members || [];
      const nextConversations = res.data.conversations || [];
      setMembers(nextMembers);
      setCanManageProject(Boolean(res.data.can_manage_project));
      setConversations(nextConversations);
      setActiveConversation((current) => {
        const currentKey = conversationKey(current);
        return nextConversations.find((item) => conversationKey(item) === currentKey) || nextConversations[0] || null;
      });
    } catch (err) {
      console.error("Cannot load project chat", err);
      showToast("Cannot load project chat", "error");
      setMembers([]);
      setConversations([]);
      setActiveConversation(null);
      setCanManageProject(false);
    } finally {
      setLoadingChat(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setMembers([]);
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setGroupMemberIds([]);
    if (activeProjectId) loadProjectChat(activeProjectId);
  }, [activeProjectId, loadProjectChat]);

  useEffect(() => {
    if (!activeProjectId || !activeConversationId) {
      setMessages([]);
      return;
    }

    let mounted = true;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const endpoint = activeConversation?.type === "project"
          ? `/projects/${activeProjectId}/messages`
          : `/projects/${activeProjectId}/conversations/${activeConversationId}/messages`;
        const res = await api.get(endpoint);
        if (mounted) setMessages(res.data.messages || []);
      } catch (err) {
        console.error("Cannot load messages", err);
        if (mounted) {
          showToast("Cannot load chat messages", "error");
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
  }, [activeProjectId, activeConversation?.type, activeConversationId, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  const handleProjectMessage = useCallback(
    (payload) => {
      if (Number(payload?.projectId) !== Number(activeProjectId)) return;
      if (String(payload?.conversationId) !== String(activeConversationId)) return;
      const nextMessage = payload.message;
      if (!nextMessage?.message_id) return;

      setMessages((prev) => {
        if (prev.some((item) => item.message_id === nextMessage.message_id)) return prev;
        return [...prev, nextMessage];
      });
    },
    [activeConversationId, activeProjectId],
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
      if (activeProject?.project_id === projectId) setActiveProject(nextProjects[0] || null);
    } catch (err) {
      showToast(err.response?.data?.message || t("cannotDeleteProject"), "error");
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!activeProjectId || !activeConversation || !messageText.trim() || sendingMessage) return;

    const content = messageText.trim();
    setMessageText("");
    setSendingMessage(true);

    try {
      await api.post(`/projects/${activeProjectId}/messages`, {
        content,
        conversation_id: activeConversationId,
      });
    } catch (err) {
      console.error("Cannot send message", err);
      showToast(err.response?.data?.message || "Cannot send message", "error");
      setMessageText(content);
    } finally {
      setSendingMessage(false);
    }
  };

  const openDirectChat = async (memberId) => {
    if (!activeProjectId || !memberId) return;
    try {
      const res = await api.post(`/projects/${activeProjectId}/conversations`, {
        type: "direct",
        member_ids: [memberId],
      });
      await loadProjectChat(activeProjectId);
      const id = res.data.conversation?.conversation_id;
      setActiveConversation((current) => (
        conversations.find((item) => Number(item.conversation_id) === Number(id)) || current
      ));
      setTimeout(() => {
        setActiveConversation((current) => (
          current?.conversation_id === id ? current : { conversation_id: id, type: "direct", participants: [user?.id, memberId] }
        ));
      }, 0);
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot open direct chat", "error");
    }
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!activeProjectId || !groupName.trim() || groupMemberIds.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await api.post(`/projects/${activeProjectId}/conversations`, {
        type: "group",
        name: groupName.trim(),
        member_ids: groupMemberIds,
      });
      setGroupName("");
      setGroupMemberIds([]);
      await loadProjectChat(activeProjectId);
      setActiveConversation(res.data.conversation);
      showToast("Group created", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot create group", "error");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!activeProjectId || !addMemberEmail.trim()) return;
    setSavingMember(true);
    try {
      await api.post(`/projects/${activeProjectId}/members`, {
        email: addMemberEmail.trim(),
        role: "member",
      });
      setAddMemberEmail("");
      await loadProjectChat(activeProjectId);
      showToast("Member added", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot add member", "error");
    } finally {
      setSavingMember(false);
    }
  };

  const handleAddGroupMember = async () => {
    if (!activeProjectId || !activeConversationId || !groupAddUserId) return;
    try {
      await api.post(`/projects/${activeProjectId}/conversations/${activeConversationId}/members`, {
        user_id: Number(groupAddUserId),
      });
      setGroupAddUserId("");
      await loadProjectChat(activeProjectId);
      showToast("Added to group", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot add group member", "error");
    }
  };

  const handlePromoteGroupMember = async (memberId) => {
    if (!activeProjectId || !activeConversationId) return;
    try {
      await api.put(`/projects/${activeProjectId}/conversations/${activeConversationId}/members/${memberId}/role`, {
        role: "admin",
      });
      showToast("Group member promoted", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot promote group member", "error");
    }
  };

  const toggleGroupMember = (memberId) => {
    setGroupMemberIds((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
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
                <p>Choose a workspace.</p>
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
                    className={`chat-project-row ${activeProject?.project_id === project.project_id ? "active" : ""}`}
                    onClick={() => setActiveProject(project)}
                  >
                    <span className="chat-project-icon">
                      <Icon name="hash" size={16} />
                    </span>
                    <span className="chat-project-main">
                      <span className="chat-project-name">{project.name}</span>
                      <span className="chat-project-role">{project.user_role || "member"}</span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="chat-thread-panel">
              <div className="chat-panel-title">Chats</div>
              {loadingChat ? (
                <div className="chat-empty">Loading chats...</div>
              ) : conversations.map((conversation) => {
                const isDirect = conversation.type === "direct";
                return (
                  <button
                    key={conversationKey(conversation)}
                    type="button"
                    className={`chat-thread-row ${activeConversationId === conversationKey(conversation) ? "active" : ""}`}
                    onClick={() => setActiveConversation(conversation)}
                  >
                    <Icon name={isDirect ? "user" : conversation.type === "group" ? "teamAdd" : "hash"} size={15} />
                    <span>{getConversationLabel(conversation)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="chat-conversation">
            <div className="chat-conversation-header">
              <div>
                <h1>{activeConversationTitle}</h1>
                <p>
                  {activeConversation?.type === "direct"
                    ? "Private conversation in this project."
                    : activeConversation?.type === "group"
                      ? "Group conversation with selected project members."
                      : "Messages are shared with every member in this project."}
                </p>
              </div>
            </div>

            <div className="chat-message-list">
              {!activeProject ? (
                <div className="chat-empty chat-empty-large">Select a project first.</div>
              ) : loadingMessages ? (
                <div className="chat-empty chat-empty-large">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty chat-empty-large">No messages yet. Start the conversation.</div>
              ) : (
                messages.map((message) => {
                  const mine = Number(message.sender_id) === Number(user?.id);
                  return (
                    <div key={`${message.conversation_id || activeConversationId}-${message.message_id}`} className={`chat-message-row ${mine ? "mine" : ""}`}>
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
                        <div className={`chat-message ${mine ? "mine" : ""}`}>{message.content}</div>
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
                placeholder={activeConversation ? `Message ${activeConversationTitle}...` : "Select a chat..."}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                disabled={!activeConversation || sendingMessage}
              />
              <button type="submit" disabled={!activeConversation || sendingMessage || !messageText.trim()}>
                Send
              </button>
            </form>
          </section>

          <aside className="chat-side-panel">
            <section className="chat-tool-section">
              <div className="chat-panel-title">Members</div>
              <div className="chat-member-list">
                {members.map((member) => (
                  <div className="chat-member-row" key={member.user_id}>
                    <span className="chat-avatar small">
                      {member.user_photo ? <img src={avatarUrl(member.user_photo)} alt="" /> : displayName(member).charAt(0).toUpperCase()}
                    </span>
                    <span className="chat-member-main">
                      <span>{displayName(member)}</span>
                      <span>{member.role}</span>
                    </span>
                    {Number(member.user_id) !== Number(user?.id) && (
                      <button type="button" className="chat-icon-btn" title="Direct chat" onClick={() => openDirectChat(member.user_id)}>
                        <Icon name="chat" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {canManageProject && (
              <form className="chat-tool-section" onSubmit={handleAddMember}>
                <div className="chat-panel-title">Add project member</div>
                <input type="email" placeholder="member@email.com" value={addMemberEmail} onChange={(event) => setAddMemberEmail(event.target.value)} />
                <button type="submit" disabled={savingMember || !addMemberEmail.trim()}>Add member</button>
              </form>
            )}

            <form className="chat-tool-section" onSubmit={handleCreateGroup}>
              <div className="chat-panel-title">Create group</div>
              <input type="text" placeholder="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
              <div className="chat-check-list">
                {selectableMembers.map((member) => (
                  <label key={member.user_id}>
                    <input
                      type="checkbox"
                      checked={groupMemberIds.includes(member.user_id)}
                      onChange={() => toggleGroupMember(member.user_id)}
                    />
                    <span>{displayName(member)}</span>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={creatingGroup || !groupName.trim() || groupMemberIds.length === 0}>Create group</button>
            </form>

            {activeConversation?.type === "group" && (
              <section className="chat-tool-section">
                <div className="chat-panel-title">Group controls</div>
                <div className="chat-inline-action">
                  <select value={groupAddUserId} onChange={(event) => setGroupAddUserId(event.target.value)}>
                    <option value="">Add member</option>
                    {membersOutsideActiveGroup.map((member) => <option key={member.user_id} value={member.user_id}>{displayName(member)}</option>)}
                  </select>
                  <button type="button" onClick={handleAddGroupMember} disabled={!groupAddUserId}>Add</button>
                </div>
                <div className="chat-check-list">
                  {activeGroupMembers.map((member) => (
                    <button key={member.user_id} type="button" className="chat-promote-btn" onClick={() => handlePromoteGroupMember(member.user_id)}>
                      Promote {displayName(member)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
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
