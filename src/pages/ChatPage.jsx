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
import "./ChatPage.css";

const API_URL = "http://localhost:5000";
function avatarUrl(photo) {
  if (!photo) return "";
  return photo.startsWith("http") || photo.startsWith("data:") ? photo : `${API_URL}${photo}`;
}

function assetUrl(url) {
  if (!url) return "";
  return url.startsWith("http") || url.startsWith("data:") ? url : `${API_URL}${url}`;
}

function isImageType(type = "") {
  return type.startsWith("image/");
}

function formatFileSize(size) {
  const value = Number(size);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function groupRoleLabel(role) {
  return role === "admin" ? "Admin" : "Member";
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
  const [chatUsers, setChatUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [canManageProject, setCanManageProject] = useState(false);

  const [savingMember, setSavingMember] = useState(false);
  const [projectMemberCandidates, setProjectMemberCandidates] = useState([]);
  const [selectedProjectMemberIds, setSelectedProjectMemberIds] = useState([]);
  const [loadingProjectMemberCandidates, setLoadingProjectMemberCandidates] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [groupAddMemberIds, setGroupAddMemberIds] = useState([]);
  const [groupMemberCandidates, setGroupMemberCandidates] = useState([]);
  const [loadingGroupMemberCandidates, setLoadingGroupMemberCandidates] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingGroupMembers, setAddingGroupMembers] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [chatPanelView, setChatPanelView] = useState("overview");
  const [openMemberMenuId, setOpenMemberMenuId] = useState(null);

  const messagesEndRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const activeProjectId = activeProject?.project_id;
  const activeConversationId = conversationKey(activeConversation);
  const isRemovedFromActiveChat = Boolean(
    activeConversation?.removed_at
      || (activeConversation?.type === "project" && activeProject?.user_role === "removed"),
  );
  const isDisbandedActiveGroup = Boolean(
    activeConversation?.type === "group" && activeConversation?.disbanded_at,
  );
  const isChatLocked = isRemovedFromActiveChat || isDisbandedActiveGroup;
  const removedChatMessage = activeConversation?.type === "group"
    ? "You have been removed from this group."
    : "You have been removed from this project.";
  const disbandedChatMessage = "Admin has disbanded this group.";

  const memberById = useMemo(() => {
    const map = new Map();
    for (const member of members) map.set(Number(member.user_id), member);
    for (const member of chatUsers) {
      if (!map.has(Number(member.user_id))) map.set(Number(member.user_id), member);
    }
    return map;
  }, [chatUsers, members]);

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

  const getDirectConversationMember = useCallback(
    (conversation) => (conversation.participants || [])
      .map((id) => memberById.get(Number(id)))
      .find((member) => Number(member?.user_id) !== Number(user?.id)),
    [memberById, user?.id],
  );

  const getConversationLabel = useCallback(
    (conversation) => {
      if (conversation.type === "project") return activeProject?.name || "Project Chat";
      if (conversation.type === "group") return `Group: ${conversation.name || "Group chat"}`;
      const other = getDirectConversationMember(conversation);
      return displayName(other) || "Direct chat";
    },
    [activeProject?.name, getDirectConversationMember],
  );

  const activeChatMembers = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.type === "project") return members;
    return (activeConversation.participants || [])
      .map((id) => memberById.get(Number(id)))
      .filter(Boolean);
  }, [activeConversation, memberById, members]);

  const addableChatMembers = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.type === "group") return groupMemberCandidates;
    return [];
  }, [activeConversation, groupMemberCandidates]);

  const canManageActiveGroup = useMemo(() => {
    if (activeConversation?.type !== "group") return false;
    if (activeConversation.removed_at) return false;
    if (activeConversation.disbanded_at) return false;
    const participantRole = activeConversation.participant_role
      || activeConversation.participant_roles?.[String(user?.id)]
      || activeConversation.participant_roles?.[Number(user?.id)];

    return participantRole === "admin" || Number(activeConversation.created_by) === Number(user?.id);
  }, [activeConversation, user?.id]);

  const getChatMemberRoleLabel = useCallback(
    (member) => {
      if (activeConversation?.type !== "group") return member?.role || "member";
      const participantRole = activeConversation.participant_roles?.[String(member?.user_id)]
        || activeConversation.participant_roles?.[Number(member?.user_id)]
        || (Number(activeConversation.created_by) === Number(member?.user_id) ? "admin" : "member");

      return groupRoleLabel(participantRole);
    },
    [activeConversation],
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
      const nextChatUsers = res.data.chat_users || [];
      const nextConversations = res.data.conversations || [];
      setMembers(nextMembers);
      setChatUsers(nextChatUsers);
      setCanManageProject(Boolean(res.data.can_manage_project));
      setActiveProject((current) => (
        current && Number(current.project_id) === Number(projectId)
          ? { ...current, ...(res.data.project || {}) }
          : current
      ));
      setConversations(nextConversations);
      setActiveConversation((current) => {
        const currentKey = conversationKey(current);
        return nextConversations.find((item) => conversationKey(item) === currentKey) || nextConversations[0] || null;
      });
    } catch (err) {
      console.error("Cannot load project chat", err);
      showToast("Cannot load project chat", "error");
      setMembers([]);
      setChatUsers([]);
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
    setChatUsers([]);
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setGroupMemberIds([]);
    setGroupAddMemberIds([]);
    setGroupName("");
    setIsCreateGroupOpen(false);
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

  useEffect(() => {
    setChatPanelView("overview");
    setProjectMemberCandidates([]);
    setSelectedProjectMemberIds([]);
    setGroupAddMemberIds([]);
    setGroupMemberCandidates([]);
    setOpenMemberMenuId(null);
    setSelectedAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }, [activeConversationId]);

  useEffect(() => {
    setOpenMemberMenuId(null);
    if (chatPanelView !== "add") setSelectedProjectMemberIds([]);
    if (chatPanelView !== "add") setGroupAddMemberIds([]);
    if (chatPanelView !== "add") setGroupMemberCandidates([]);
  }, [chatPanelView]);

  useEffect(() => {
    if (chatPanelView !== "add" || activeConversation?.type !== "project" || !canManageProject || !activeProjectId) {
      return;
    }

    let mounted = true;
    async function loadProjectMemberCandidates() {
      setLoadingProjectMemberCandidates(true);
      try {
        const res = await api.get(`/projects/${activeProjectId}/member-candidates`);
        if (mounted) setProjectMemberCandidates(res.data.users || []);
      } catch (err) {
        if (mounted) {
          setProjectMemberCandidates([]);
          showToast(err.response?.data?.message || "Cannot load member candidates", "error");
        }
      } finally {
        if (mounted) setLoadingProjectMemberCandidates(false);
      }
    }

    loadProjectMemberCandidates();
    return () => {
      mounted = false;
    };
  }, [activeConversation?.type, activeProjectId, canManageProject, chatPanelView, showToast]);

  useEffect(() => {
    if (
      chatPanelView !== "add"
      || activeConversation?.type !== "group"
      || !canManageActiveGroup
      || !activeProjectId
      || !activeConversationId
    ) {
      return;
    }

    let mounted = true;
    async function loadGroupMemberCandidates() {
      setLoadingGroupMemberCandidates(true);
      try {
        const res = await api.get(`/projects/${activeProjectId}/conversations/${activeConversationId}/member-candidates`);
        if (mounted) setGroupMemberCandidates(res.data.users || []);
      } catch (err) {
        if (mounted) {
          setGroupMemberCandidates([]);
          showToast(err.response?.data?.message || "Cannot load group member candidates", "error");
        }
      } finally {
        if (mounted) setLoadingGroupMemberCandidates(false);
      }
    }

    loadGroupMemberCandidates();
    return () => {
      mounted = false;
    };
  }, [activeConversation?.type, activeConversationId, activeProjectId, canManageActiveGroup, chatPanelView, showToast]);

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
    if (!activeProjectId || !activeConversation || isChatLocked || (!messageText.trim() && !selectedAttachment) || sendingMessage) return;

    const content = messageText.trim();
    const attachment = selectedAttachment;
    setMessageText("");
    setSelectedAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    setSendingMessage(true);

    try {
      if (attachment) {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("conversation_id", activeConversationId);
        formData.append("attachment", attachment);
        await api.post(`/projects/${activeProjectId}/messages`, formData);
      } else {
        await api.post(`/projects/${activeProjectId}/messages`, {
          content,
          conversation_id: activeConversationId,
        });
      }
    } catch (err) {
      console.error("Cannot send message", err);
      showToast(err.response?.data?.message || "Cannot send message", "error");
      setMessageText(content);
      setSelectedAttachment(attachment);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedAttachment(file);
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
      setIsCreateGroupOpen(false);
      await loadProjectChat(activeProjectId);
      setActiveConversation(res.data.conversation);
      showToast("Group created", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot create group", "error");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddSelectedProjectMembers = async () => {
    if (!activeProjectId || selectedProjectMemberIds.length === 0 || savingMember) return;
    setSavingMember(true);
    try {
      await Promise.all(selectedProjectMemberIds.map((userId) => (
        api.post(`/projects/${activeProjectId}/members`, {
          user_id: Number(userId),
          role: "member",
        })
      )));
      setSelectedProjectMemberIds([]);
      setProjectMemberCandidates((prev) => (
        prev.filter((member) => !selectedProjectMemberIds.includes(Number(member.user_id)))
      ));
      await loadProjectChat(activeProjectId);
      showToast("Member added", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot add member", "error");
    } finally {
      setSavingMember(false);
    }
  };

  const handleAddSelectedGroupMembers = async () => {
    if (!activeProjectId || !activeConversationId || groupAddMemberIds.length === 0 || addingGroupMembers) return;
    setAddingGroupMembers(true);
    try {
      await Promise.all(groupAddMemberIds.map((userId) => (
        api.post(`/projects/${activeProjectId}/conversations/${activeConversationId}/members`, {
          user_id: Number(userId),
        })
      )));
      setGroupAddMemberIds([]);
      setGroupMemberCandidates((prev) => (
        prev.filter((member) => !groupAddMemberIds.includes(Number(member.user_id)))
      ));
      await loadProjectChat(activeProjectId);
      showToast("Added to group", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot add group member", "error");
    } finally {
      setAddingGroupMembers(false);
    }
  };

  const handleRemoveGroupMember = async (member) => {
    if (!activeProjectId || !activeConversationId || !member?.user_id) return;
    const confirmed = await confirm(`Remove ${displayName(member)} from this group chat?`, {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${activeProjectId}/conversations/${activeConversationId}/members/${member.user_id}`);
      await loadProjectChat(activeProjectId);
      showToast("Removed from group chat", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot remove group member", "error");
    }
  };

  const handleRemoveProjectMember = async (member) => {
    if (!activeProjectId || !member?.user_id) return;
    const confirmed = await confirm(`Remove ${displayName(member)} from this project chat?`, {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${activeProjectId}/members/${member.user_id}`);
      await loadProjectChat(activeProjectId);
      showToast("Removed from project chat", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot remove project chat member", "error");
    }
  };

  const handleRemoveChatMember = (member) => {
    if (activeConversation?.type === "project") {
      handleRemoveProjectMember(member);
      return;
    }

    handleRemoveGroupMember(member);
  };

  const handleDisbandGroup = async () => {
    if (!activeProjectId || !activeConversationId || activeConversation?.type !== "group") return;
    const confirmed = await confirm("Disband this group?", {
      confirmLabel: "Disband",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.patch(`/projects/${activeProjectId}/conversations/${activeConversationId}/disband`);
      setMessages([]);
      await loadProjectChat(activeProjectId);
      showToast("Group disbanded", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot disband group", "error");
    }
  };

  const handleChatMemberClick = (member) => {
    if (!member?.user_id || Number(member.user_id) === Number(user?.id)) return;

    if (
      (activeConversation?.type === "group" && canManageActiveGroup)
      || (activeConversation?.type === "project" && canManageProject)
    ) {
      setOpenMemberMenuId((current) => (
        Number(current) === Number(member.user_id) ? null : Number(member.user_id)
      ));
      return;
    }

    openDirectChat(member.user_id);
  };

  const toggleGroupMember = (memberId) => {
    setGroupMemberIds((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
  };

  const toggleGroupAddMember = (memberId) => {
    setGroupAddMemberIds((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
  };

  const toggleProjectAddMember = (memberId) => {
    setSelectedProjectMemberIds((prev) => (
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
              <div className="chat-panel-title-row">
                <div className="chat-panel-title">Chats</div>
                <button
                  type="button"
                  className={`chat-create-toggle ${isCreateGroupOpen ? "active" : ""}`}
                  onClick={() => setIsCreateGroupOpen((open) => !open)}
                  disabled={!activeProject}
                >
                  <Icon name="teamAdd" size={14} />
                  <span>Create group</span>
                </button>
              </div>
              {isCreateGroupOpen && (
                <form className="chat-create-group-form" onSubmit={handleCreateGroup}>
                  <input type="text" placeholder="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                  <div className="chat-group-member-picker compact">
                    {selectableMembers.map((member) => (
                      <button
                        key={member.user_id}
                        type="button"
                        className={`chat-picker-member ${groupMemberIds.includes(member.user_id) ? "selected" : ""}`}
                        onClick={() => toggleGroupMember(member.user_id)}
                      >
                        <span className="chat-picker-dot" aria-hidden="true" />
                        <span className="chat-avatar small">
                          {member.user_photo ? <img src={avatarUrl(member.user_photo)} alt="" /> : displayName(member).charAt(0).toUpperCase()}
                        </span>
                        <span className="chat-picker-name">{displayName(member)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="chat-create-actions">
                    <button type="button" className="secondary" onClick={() => setIsCreateGroupOpen(false)}>Cancel</button>
                    <button type="submit" disabled={creatingGroup || !groupName.trim() || groupMemberIds.length === 0}>Create group</button>
                  </div>
                </form>
              )}
              {loadingChat ? (
                <div className="chat-empty">Loading chats...</div>
              ) : conversations.map((conversation) => {
                const isDirect = conversation.type === "direct";
                const directMember = isDirect ? getDirectConversationMember(conversation) : null;
                return (
                  <button
                    key={conversationKey(conversation)}
                    type="button"
                    className={`chat-thread-row ${activeConversationId === conversationKey(conversation) ? "active" : ""}`}
                    onClick={() => setActiveConversation(conversation)}
                  >
                    {isDirect ? (
                      <span className="chat-thread-avatar">
                        {directMember?.user_photo ? <img src={avatarUrl(directMember.user_photo)} alt="" /> : displayName(directMember).charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Icon name={conversation.type === "group" ? "users" : "hash"} size={15} />
                    )}
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
              ) : isDisbandedActiveGroup ? (
                <div className="chat-removed-notice">{disbandedChatMessage}</div>
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
                        <div className={`chat-message ${mine ? "mine" : ""}`}>
                          {message.content && <div className="chat-message-text">{message.content}</div>}
                          {message.attachment_url && (
                            isImageType(message.attachment_type || "") ? (
                              <a className="chat-image-attachment" href={assetUrl(message.attachment_url)} target="_blank" rel="noreferrer">
                                <img src={assetUrl(message.attachment_url)} alt={message.attachment_name || "Attachment"} />
                              </a>
                            ) : (
                              <a className="chat-file-attachment" href={assetUrl(message.attachment_url)} target="_blank" rel="noreferrer">
                                <Icon name="paperclip" size={16} />
                                <span>
                                  <strong>{message.attachment_name || "Attachment"}</strong>
                                  <small>{formatFileSize(message.attachment_size)}</small>
                                </span>
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isRemovedFromActiveChat && !isDisbandedActiveGroup && (
                <div className="chat-removed-notice">
                  {removedChatMessage}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              {selectedAttachment && (
                <div className="chat-selected-attachment">
                  <Icon name="paperclip" size={14} />
                  <span>{selectedAttachment.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttachment(null);
                      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
                    }}
                    aria-label="Remove attachment"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}
              <div className="chat-input-row">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="chat-file-input"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json"
                  onChange={handleAttachmentChange}
                  disabled={!activeConversation || isChatLocked || sendingMessage}
                />
                <button
                  type="button"
                  className="chat-attach-btn"
                  title="Attach file"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={!activeConversation || isChatLocked || sendingMessage}
                >
                  <Icon name="paperclip" size={18} />
                </button>
                <input
                  type="text"
                  placeholder={isDisbandedActiveGroup ? disbandedChatMessage : isRemovedFromActiveChat ? removedChatMessage : activeConversation ? `Message ${activeConversationTitle}...` : "Select a chat..."}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  disabled={!activeConversation || isChatLocked || sendingMessage}
                />
                <button type="submit" disabled={!activeConversation || isChatLocked || sendingMessage || (!messageText.trim() && !selectedAttachment)}>
                  Send
                </button>
              </div>
            </form>
          </section>

          <aside className="chat-side-panel">
            <section className="chat-info-section">
              {chatPanelView !== "overview" && (
                <button type="button" className="chat-panel-back" onClick={() => setChatPanelView("overview")}>
                  <Icon name="chevronRight" size={14} />
                  <span>Back</span>
                </button>
              )}

              {chatPanelView === "overview" && (
                <>
                  <div className="chat-info-heading">
                    <span className="chat-info-icon">
                      <Icon name={activeConversation?.type === "direct" ? "user" : activeConversation?.type === "group" ? "users" : "hash"} size={18} />
                    </span>
                    <div>
                      <div className="chat-panel-title">Conversation details</div>
                      <h3>{activeConversationTitle}</h3>
                    </div>
                  </div>

                  <button type="button" className="chat-info-nav-row" onClick={() => setChatPanelView("members")}>
                    <span>
                      <strong>Members</strong>
                      <small>{activeChatMembers.length} people in this chat</small>
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </button>

                  {((activeConversation?.type === "group" && canManageActiveGroup) || (activeConversation?.type === "project" && canManageProject)) && (
                    <button type="button" className="chat-info-nav-row" onClick={() => setChatPanelView("add")}>
                      <span>
                        <strong>Add member</strong>
                        <small>{activeConversation?.type === "group" ? "Add project members to this group" : "Add a new project member"}</small>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  )}

                  {activeConversation?.type === "group" && canManageActiveGroup && (
                    <button type="button" className="chat-disband-row" onClick={handleDisbandGroup}>
                      <span>
                        <strong>Disband group</strong>
                      </span>
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </>
              )}

              {chatPanelView === "members" && (
                <>
                  <div className="chat-panel-title">Members</div>
                  <div className="chat-member-list">
                    {activeChatMembers.map((member) => {
                      const isCurrentUser = Number(member.user_id) === Number(user?.id);
                      const canOpenMemberActions = !isCurrentUser && (
                        (activeConversation?.type === "group" && canManageActiveGroup)
                        || (activeConversation?.type === "project" && canManageProject)
                      );
                      const canRemoveMember = canOpenMemberActions && (
                        activeConversation?.type === "group"
                        || (activeConversation?.type === "project" && member.role !== "owner")
                      );
                      const isMemberMenuOpen = Number(openMemberMenuId) === Number(member.user_id);

                      return (
                        <div
                          className={`chat-member-row ${!isCurrentUser ? "interactive" : ""}`}
                          key={member.user_id}
                          role={!isCurrentUser ? "button" : undefined}
                          tabIndex={!isCurrentUser ? 0 : undefined}
                          onClick={() => handleChatMemberClick(member)}
                          onKeyDown={(event) => {
                            if (isCurrentUser || !["Enter", " "].includes(event.key)) return;
                            event.preventDefault();
                            handleChatMemberClick(member);
                          }}
                        >
                          <span className="chat-avatar small">
                            {member.user_photo ? <img src={avatarUrl(member.user_photo)} alt="" /> : displayName(member).charAt(0).toUpperCase()}
                          </span>
                          <span className="chat-member-main">
                            <span>{displayName(member)}</span>
                            <span>{getChatMemberRoleLabel(member)}</span>
                          </span>
                          {canOpenMemberActions && (
                            <div className={`chat-member-menu ${isMemberMenuOpen ? "open" : ""}`} onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMemberMenuId(null);
                                  openDirectChat(member.user_id);
                                }}
                              >
                                <Icon name="chat" size={14} />
                                <span>Direct chat</span>
                              </button>
                              {canRemoveMember && (
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => {
                                    setOpenMemberMenuId(null);
                                    handleRemoveChatMember(member);
                                  }}
                                >
                                  <Icon name="x" size={14} />
                                  <span>Remove member</span>
                                </button>
                              )}
                            </div>
                          )}
                          {canOpenMemberActions && (
                            <span className="chat-member-more" aria-hidden="true">
                              <Icon name="chevronRight" size={14} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {chatPanelView === "add" && activeConversation?.type === "project" && canManageProject && (
                <div className="chat-add-member-form">
                  <div className="chat-panel-title">Add member</div>
                  {loadingProjectMemberCandidates ? (
                    <div className="chat-empty">Loading members...</div>
                  ) : projectMemberCandidates.length === 0 ? (
                    <div className="chat-empty">No users available to add.</div>
                  ) : (
                    <div className="chat-group-member-picker compact">
                      {projectMemberCandidates.map((member) => (
                        <button
                          key={member.user_id}
                          type="button"
                          className={`chat-picker-member ${selectedProjectMemberIds.includes(member.user_id) ? "selected" : ""}`}
                          onClick={() => toggleProjectAddMember(member.user_id)}
                        >
                          <span className="chat-picker-dot" aria-hidden="true" />
                          <span className="chat-avatar small">
                            {member.user_photo ? <img src={avatarUrl(member.user_photo)} alt="" /> : displayName(member).charAt(0).toUpperCase()}
                          </span>
                          <span className="chat-picker-name">{displayName(member)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {projectMemberCandidates.length > 0 && (
                    <button
                      type="button"
                      className="chat-add-btn wide"
                      disabled={savingMember || selectedProjectMemberIds.length === 0}
                      onClick={handleAddSelectedProjectMembers}
                    >
                      Add member
                    </button>
                  )}
                </div>
              )}

              {chatPanelView === "add" && activeConversation?.type === "group" && canManageActiveGroup && (
                <>
                  <div className="chat-panel-title">Add member</div>
                  <div className="chat-group-member-picker compact">
                    {loadingGroupMemberCandidates ? (
                      <div className="chat-empty">Loading members...</div>
                    ) : addableChatMembers.length === 0 ? (
                      <div className="chat-empty">All project members are already in this group.</div>
                    ) : addableChatMembers.map((member) => (
                      <button
                        key={member.user_id}
                        type="button"
                        className={`chat-picker-member ${groupAddMemberIds.includes(member.user_id) ? "selected" : ""}`}
                        onClick={() => toggleGroupAddMember(member.user_id)}
                      >
                        <span className="chat-picker-dot" aria-hidden="true" />
                        <span className="chat-avatar small">
                          {member.user_photo ? <img src={avatarUrl(member.user_photo)} alt="" /> : displayName(member).charAt(0).toUpperCase()}
                        </span>
                        <span className="chat-picker-name">
                          {displayName(member)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {addableChatMembers.length > 0 && (
                    <button
                      type="button"
                      className="chat-add-btn wide"
                      disabled={addingGroupMembers || groupAddMemberIds.length === 0}
                      onClick={handleAddSelectedGroupMembers}
                    >
                      Add member
                    </button>
                  )}
                </>
              )}
            </section>
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
