import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

function chatNotificationKey(notification) {
  if (!notification || notification.is_read) return "";
  if (notification.category && notification.category !== "chat") return "";
  if (notification.type === "project_chat_message") {
    return notification.project_chat_conversation_id
      || (notification.project_chat_project_id ? `project-${notification.project_chat_project_id}` : "");
  }
  if (notification.type === "chat_message") {
    return notification.chat_conversation_id ? String(notification.chat_conversation_id) : "";
  }
  if (notification.type === "group_invited") {
    return notification.chat_conversation_id ? String(notification.chat_conversation_id) : "";
  }
  return "";
}

function chatNotificationProjectId(notification) {
  if (!notification || notification.is_read) return "";
  return notification.chat_project_id || notification.project_chat_project_id || "";
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
  const location = useLocation();
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
  const [globalDirectConversations, setGlobalDirectConversations] = useState([]);
  const [globalDirectUsers, setGlobalDirectUsers] = useState([]);
  const [loadingDirectChats, setLoadingDirectChats] = useState(false);
  const [globalGroupConversations, setGlobalGroupConversations] = useState([]);
  const [globalGroupUsers, setGlobalGroupUsers] = useState([]);
  const [loadingGroupChats, setLoadingGroupChats] = useState(false);
  const [isCreateDirectOpen, setIsCreateDirectOpen] = useState(false);
  const [directInviteEmail, setDirectInviteEmail] = useState("");
  const [directInviteUser, setDirectInviteUser] = useState(null);
  const [directEmailSuggestions, setDirectEmailSuggestions] = useState([]);
  const [creatingDirectChat, setCreatingDirectChat] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatNotifications, setChatNotifications] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [canManageProject, setCanManageProject] = useState(false);

  const [savingMember, setSavingMember] = useState(false);
  const [projectMemberCandidates, setProjectMemberCandidates] = useState([]);
  const [selectedProjectMemberIds, setSelectedProjectMemberIds] = useState([]);
  const [loadingProjectMemberCandidates, setLoadingProjectMemberCandidates] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [createGroupInviteEmail, setCreateGroupInviteEmail] = useState("");
  const [createGroupInviteUser, setCreateGroupInviteUser] = useState(null);
  const [createGroupEmailSuggestions, setCreateGroupEmailSuggestions] = useState([]);
  const [groupAddMemberIds, setGroupAddMemberIds] = useState([]);
  const [groupInviteEmail, setGroupInviteEmail] = useState("");
  const [groupInviteUser, setGroupInviteUser] = useState(null);
  const [groupInviteEmailSuggestions, setGroupInviteEmailSuggestions] = useState([]);
  const [groupMemberCandidates, setGroupMemberCandidates] = useState([]);
  const [loadingGroupMemberCandidates, setLoadingGroupMemberCandidates] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingGroupMembers, setAddingGroupMembers] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [chatPanelView, setChatPanelView] = useState("overview");
  const [openMemberMenuId, setOpenMemberMenuId] = useState(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState("");

  const messagesEndRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const latestMessageIdRef = useRef(0);
  const activeProjectId = activeProject?.project_id;
  const activeConversationId = conversationKey(activeConversation);
  const activeChatProjectId = activeConversation?.type && activeConversation.type !== "project"
    ? activeConversation.project_id
    : activeProjectId;
  const canLoadActiveChat = ["direct", "group"].includes(activeConversation?.type)
    ? Boolean(activeConversationId)
    : Boolean(activeChatProjectId && activeConversationId);
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
    for (const member of globalDirectUsers) {
      if (!map.has(Number(member.user_id))) map.set(Number(member.user_id), member);
    }
    for (const member of globalGroupUsers) {
      if (!map.has(Number(member.user_id))) map.set(Number(member.user_id), member);
    }
    return map;
  }, [chatUsers, globalDirectUsers, globalGroupUsers, members]);

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

  const groupConversations = useMemo(() => {
    const byId = new Map();
    const addConversation = (conversation) => {
      if (!conversation || conversation.type !== "group") return;
      const key = conversationKey(conversation);
      if (!key) return;
      byId.set(key, {
        ...byId.get(key),
        ...conversation,
        project_name: conversation.project_name || byId.get(key)?.project_name || "",
      });
    };

    globalGroupConversations.forEach(addConversation);
    conversations.forEach(addConversation);
    if (activeConversation?.type === "group") addConversation(activeConversation);

    return Array.from(byId.values()).sort((a, b) => (
      new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0)
    ));
  }, [activeConversation, conversations, globalGroupConversations]);
  const directConversations = useMemo(() => {
    const byId = new Map();
    const addConversation = (conversation) => {
      if (!conversation || conversation.type !== "direct") return;
      const key = conversationKey(conversation);
      if (!key) return;
      byId.set(key, {
        ...byId.get(key),
        ...conversation,
        project_name: conversation.project_name || byId.get(key)?.project_name || activeProject?.name,
      });
    };

    globalDirectConversations.forEach(addConversation);
    conversations.forEach(addConversation);
    if (activeConversation?.type === "direct") addConversation(activeConversation);

    return Array.from(byId.values()).sort((a, b) => (
      new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0)
    ));
  }, [activeConversation, activeProject?.name, conversations, globalDirectConversations]);

  const unreadCountsByConversation = useMemo(() => {
    const counts = {};
    for (const notification of chatNotifications) {
      const key = chatNotificationKey(notification);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [chatNotifications]);

  const unreadCountsByProject = useMemo(() => {
    const counts = {};
    for (const notification of chatNotifications) {
      if (notification.type === "project_chat_message") continue;
      const projectId = chatNotificationProjectId(notification);
      if (!projectId) continue;
      counts[projectId] = (counts[projectId] || 0) + 1;
    }
    return counts;
  }, [chatNotifications]);

  const canManageActiveGroup = useMemo(() => {
    if (activeConversation?.type !== "group") return false;
    if (activeConversation.removed_at) return false;
    if (activeConversation.disbanded_at) return false;
    const isProjectScopedGroup = Boolean(activeConversation.project_id);
    const participantRole = activeConversation.participant_role
      || activeConversation.participant_roles?.[String(user?.id)]
      || activeConversation.participant_roles?.[Number(user?.id)];

    return (isProjectScopedGroup && canManageProject)
      || participantRole === "admin"
      || Number(activeConversation.created_by) === Number(user?.id);
  }, [activeConversation, canManageProject, user?.id]);

  const canClearActiveHistory = Boolean(
    !isRemovedFromActiveChat
      && (activeConversation?.type === "direct"
        || activeConversation?.type === "group"),
  );

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

  const loadProjects = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingProjects(true);
    try {
      const res = await api.get("/projects");
      const nextProjects = res.data.projects || [];
      const queryProjectId = new URLSearchParams(location.search).get("projectId");
      setProjects(nextProjects);
      setActiveProject((current) => {
        const queryProject = queryProjectId
          ? nextProjects.find((project) => Number(project.project_id) === Number(queryProjectId))
          : null;
        const currentProject = current
          ? nextProjects.find((project) => Number(project.project_id) === Number(current.project_id))
          : null;
        return queryProject || currentProject || nextProjects[0] || null;
      });
    } catch (err) {
      console.error("Cannot load projects", err);
      if (!silent) showToast("Cannot load projects", "error");
    } finally {
      if (!silent) setLoadingProjects(false);
    }
  }, [location.search, showToast]);

  const loadGlobalDirectChats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingDirectChats(true);
    try {
      const res = await api.get("/projects/chat/direct-conversations");
      setGlobalDirectConversations(res.data.conversations || []);
      setGlobalDirectUsers(res.data.chat_users || []);
    } catch (err) {
      console.error("Cannot load direct chats", err);
      setGlobalDirectConversations([]);
      setGlobalDirectUsers([]);
    } finally {
      if (!silent) setLoadingDirectChats(false);
    }
  }, []);

  const loadGlobalGroupChats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingGroupChats(true);
    try {
      const res = await api.get("/projects/chat/group-conversations");
      setGlobalGroupConversations(res.data.conversations || []);
      setGlobalGroupUsers(res.data.chat_users || []);
    } catch (err) {
      console.error("Cannot load groups", err);
      setGlobalGroupConversations([]);
      setGlobalGroupUsers([]);
    } finally {
      if (!silent) setLoadingGroupChats(false);
    }
  }, []);

  const loadChatNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications", { params: { limit: 100 } });
      setChatNotifications(
        (res.data.notifications || []).filter((notification) => chatNotificationKey(notification)),
      );
    } catch (err) {
      console.error("Cannot load chat notifications", err);
    }
  }, []);

  const loadProjectChat = useCallback(async (projectId, preferredConversationId = null, { silent = false } = {}) => {
    if (!projectId) return;
    if (!silent) setLoadingChat(true);
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
        if (preferredConversationId) {
          const preferred = nextConversations.find((item) => (
            conversationKey(item) === String(preferredConversationId)
          ));
          if (preferred) return preferred;
        }
        const currentKey = conversationKey(current);
        return nextConversations.find((item) => conversationKey(item) === currentKey) || nextConversations[0] || null;
      });
    } catch (err) {
      console.error("Cannot load project chat", err);
      if (!silent) {
        showToast("Cannot load project chat", "error");
        setMembers([]);
        setChatUsers([]);
        setConversations([]);
        setActiveConversation(null);
        setCanManageProject(false);
      }
    } finally {
      if (!silent) setLoadingChat(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
    loadGlobalDirectChats();
    loadGlobalGroupChats();
    loadChatNotifications();
  }, [loadChatNotifications, loadGlobalDirectChats, loadGlobalGroupChats, loadProjects]);

  useEffect(() => {
    const id = setInterval(loadChatNotifications, 5000);
    return () => clearInterval(id);
  }, [loadChatNotifications]);

  useEffect(() => {
    const id = setInterval(() => {
      loadProjects({ silent: true });
      loadGlobalDirectChats({ silent: true });
      loadGlobalGroupChats({ silent: true });
      loadChatNotifications();
      if (activeProjectId) {
        loadProjectChat(activeProjectId, null, { silent: true });
      }
    }, 5000);

    return () => clearInterval(id);
  }, [activeProjectId, loadChatNotifications, loadGlobalDirectChats, loadGlobalGroupChats, loadProjectChat, loadProjects]);

  useEffect(() => {
    setMembers([]);
    setChatUsers([]);
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setGroupMemberIds([]);
    setCreateGroupInviteEmail("");
    setCreateGroupInviteUser(null);
    setCreateGroupEmailSuggestions([]);
    setGroupAddMemberIds([]);
    setGroupName("");
    setIsCreateGroupOpen(false);
    if (activeProjectId) loadProjectChat(activeProjectId);
  }, [activeProjectId, loadProjectChat]);

  useEffect(() => {
    if (!canLoadActiveChat) {
      setMessages([]);
      latestMessageIdRef.current = 0;
      return;
    }

    let mounted = true;
    latestMessageIdRef.current = 0;
    const fetchMessages = async (silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const endpoint = activeConversation?.type === "direct"
          ? `/projects/chat/direct-conversations/${activeConversationId}/messages`
          : activeConversation?.type === "group"
            ? `/projects/chat/group-conversations/${activeConversationId}/messages`
          : activeConversation?.type === "project"
            ? `/projects/${activeChatProjectId}/messages`
            : `/projects/${activeChatProjectId}/conversations/${activeConversationId}/messages`;
        const res = await api.get(endpoint);
        const nextMessages = res.data.messages || [];
        const newestMessageId = nextMessages.reduce(
          (maxId, message) => Math.max(maxId, Number(message.message_id) || 0),
          0,
        );
        const incomingMessage = nextMessages.find((message) => (
          Number(message.message_id) > latestMessageIdRef.current
          && Number(message.sender_id) !== Number(user?.id)
        ));

        if (mounted) {
          if (latestMessageIdRef.current > 0 && incomingMessage) {
            showToast(`Tin nhắn mới từ ${incomingMessage.sender_username || "User"}`, "info");
          }
          latestMessageIdRef.current = Math.max(latestMessageIdRef.current, newestMessageId);
          setMessages(nextMessages);
        }
      } catch (err) {
        console.error("Cannot load messages", err);
        if (mounted && !silent) {
          showToast("Cannot load chat messages", "error");
          setMessages([]);
        }
      } finally {
        if (mounted && !silent) setLoadingMessages(false);
      }
    };

    fetchMessages();
    const intervalId = setInterval(() => fetchMessages(true), 5000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [activeChatProjectId, activeConversation?.type, activeConversationId, canLoadActiveChat, showToast, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  useEffect(() => {
    setChatPanelView("overview");
    setProjectMemberCandidates([]);
    setSelectedProjectMemberIds([]);
    setGroupAddMemberIds([]);
    setGroupInviteEmail("");
    setGroupInviteUser(null);
    setGroupInviteEmailSuggestions([]);
    setGroupMemberCandidates([]);
    setOpenMemberMenuId(null);
    setSelectedAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }, [activeConversationId]);

  useEffect(() => {
    setOpenMemberMenuId(null);
    if (chatPanelView !== "add") setSelectedProjectMemberIds([]);
    if (chatPanelView !== "add") setGroupAddMemberIds([]);
    if (chatPanelView !== "add") setGroupInviteEmail("");
    if (chatPanelView !== "add") setGroupInviteUser(null);
    if (chatPanelView !== "add") setGroupInviteEmailSuggestions([]);
    if (chatPanelView !== "add") setGroupMemberCandidates([]);
  }, [chatPanelView]);

  useEffect(() => {
    let active = true;
    const query = createGroupInviteEmail.trim();
    setCreateGroupInviteUser((current) => (
      current?.email && current.email.toLowerCase() === query ? current : null
    ));

    if (query.length < 2) {
      setCreateGroupEmailSuggestions([]);
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/projects/chat/user-search", {
          params: { q: query },
        });
        if (active) setCreateGroupEmailSuggestions(res.data.users || []);
      } catch (err) {
        if (active) setCreateGroupEmailSuggestions([]);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [createGroupInviteEmail]);

  useEffect(() => {
    let active = true;
    const query = groupInviteEmail.trim();
    setGroupInviteUser((current) => (
      current?.email && current.email.toLowerCase() === query ? current : null
    ));

    if (query.length < 2) {
      setGroupInviteEmailSuggestions([]);
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/projects/chat/user-search", {
          params: { q: query },
        });
        if (active) setGroupInviteEmailSuggestions(res.data.users || []);
      } catch (err) {
        if (active) setGroupInviteEmailSuggestions([]);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [groupInviteEmail]);

  useEffect(() => {
    let active = true;
    const query = directInviteEmail.trim();
    setDirectInviteUser((current) => (
      current?.email && current.email.toLowerCase() === query.toLowerCase() ? current : null
    ));

    if (query.length < 2) {
      setDirectEmailSuggestions([]);
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/projects/chat/user-search", {
          params: { q: query },
        });
        if (active) setDirectEmailSuggestions(res.data.users || []);
      } catch (err) {
        if (active) setDirectEmailSuggestions([]);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [directInviteEmail]);

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
      || !activeConversationId
    ) {
      return;
    }

    let mounted = true;
    async function loadGroupMemberCandidates() {
      setLoadingGroupMemberCandidates(true);
      try {
        const res = await api.get(`/projects/chat/group-conversations/${activeConversationId}/member-candidates`);
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
  }, [activeConversation?.type, activeConversationId, canManageActiveGroup, chatPanelView, showToast]);

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

  const markConversationNotificationsRead = useCallback((conversation) => {
    const key = conversationKey(conversation);
    if (!key) return;

    const unreadForConversation = chatNotifications.filter(
      (notification) => chatNotificationKey(notification) === key,
    );
    if (unreadForConversation.length === 0) return;

    setChatNotifications((prev) => (
      prev.filter((notification) => chatNotificationKey(notification) !== key)
    ));
    Promise.all(
      unreadForConversation.map((notification) => api.put(`/notifications/${notification.noti_id}/read`)),
    ).catch((err) => {
      console.error("Cannot mark chat conversation read", err);
      loadChatNotifications();
    });
  }, [chatNotifications, loadChatNotifications]);

  const openChatConversation = useCallback((conversation) => {
    if (!conversation) return;
    setOpenConversationMenuId("");
    setActiveConversation(conversation);
    markConversationNotificationsRead(conversation);
  }, [markConversationNotificationsRead]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!canLoadActiveChat || !activeConversation || isChatLocked || (!messageText.trim() && !selectedAttachment) || sendingMessage) return;

    const content = messageText.trim();
    const attachment = selectedAttachment;
    setMessageText("");
    setSelectedAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    setSendingMessage(true);

    try {
      let res;
      if (attachment) {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("conversation_id", activeConversationId);
        formData.append("attachment", attachment);
        const endpoint = activeConversation.type === "direct"
          ? `/projects/chat/direct-conversations/${activeConversationId}/messages`
          : activeConversation.type === "group"
            ? `/projects/chat/group-conversations/${activeConversationId}/messages`
          : `/projects/${activeChatProjectId}/messages`;
        res = await api.post(endpoint, formData);
      } else {
        const endpoint = activeConversation.type === "direct"
          ? `/projects/chat/direct-conversations/${activeConversationId}/messages`
          : activeConversation.type === "group"
            ? `/projects/chat/group-conversations/${activeConversationId}/messages`
          : `/projects/${activeChatProjectId}/messages`;
        res = await api.post(endpoint, {
          content,
          conversation_id: activeConversationId,
        });
      }
      if (res?.data?.message) {
        latestMessageIdRef.current = Math.max(
          latestMessageIdRef.current,
          Number(res.data.message.message_id) || 0,
        );
        setMessages((prev) => [...prev, res.data.message]);
        if (activeConversation.type === "direct") loadGlobalDirectChats();
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
    if (!memberId) return;
    try {
      const res = await api.post("/projects/chat/direct-conversations", {
        user_id: Number(memberId),
      });
      await loadGlobalDirectChats();
      openChatConversation(res.data.conversation);
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot open direct chat", "error");
    }
  };

  const openExistingDirectChat = async (conversation) => {
    if (!conversation?.conversation_id) return;
    openChatConversation(conversation);
  };

  const handleCreateDirectChat = async (event) => {
    event.preventDefault();
    if ((!directInviteEmail.trim() && !directInviteUser?.user_id) || creatingDirectChat) return;

    setCreatingDirectChat(true);
    try {
      const res = await api.post("/projects/chat/direct-conversations", {
        email: directInviteUser?.email || directInviteEmail.trim(),
        user_id: directInviteUser?.user_id,
      });
      const conversation = res.data.conversation;
      setDirectInviteEmail("");
      setDirectInviteUser(null);
      setDirectEmailSuggestions([]);
      setIsCreateDirectOpen(false);
      await loadGlobalDirectChats();
      await openExistingDirectChat(conversation);
      showToast("Direct chat opened", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot create direct chat", "error");
    } finally {
      setCreatingDirectChat(false);
    }
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || (groupMemberIds.length === 0 && !createGroupInviteEmail.trim())) return;
    setCreatingGroup(true);
    try {
      const res = await api.post("/projects/chat/group-conversations", {
        name: groupName.trim(),
        member_ids: groupMemberIds,
        invite_email: createGroupInviteUser?.email || createGroupInviteEmail.trim(),
      });
      setGroupName("");
      setGroupMemberIds([]);
      setCreateGroupInviteEmail("");
      setCreateGroupInviteUser(null);
      setCreateGroupEmailSuggestions([]);
      setIsCreateGroupOpen(false);
      await loadGlobalGroupChats();
      openChatConversation(res.data.conversation);
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
    if (!activeConversationId || groupAddMemberIds.length === 0 || addingGroupMembers) return;
    setAddingGroupMembers(true);
    try {
      await Promise.all(groupAddMemberIds.map((userId) => (
        api.post(`/projects/chat/group-conversations/${activeConversationId}/members`, {
          user_id: Number(userId),
        })
      )));
      setGroupAddMemberIds([]);
      setGroupMemberCandidates((prev) => (
        prev.filter((member) => !groupAddMemberIds.includes(Number(member.user_id)))
      ));
      await loadGlobalGroupChats({ silent: true });
      showToast("Added to group", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot add group member", "error");
    } finally {
      setAddingGroupMembers(false);
    }
  };

  const handleInviteGroupMemberByEmail = async (event) => {
    event.preventDefault();
    if (!activeConversationId || !groupInviteEmail.trim() || addingGroupMembers) return;
    setAddingGroupMembers(true);
    try {
      await api.post(`/projects/chat/group-conversations/${activeConversationId}/members`, {
        email: groupInviteUser?.email || groupInviteEmail.trim(),
      });
      setGroupInviteEmail("");
      setGroupInviteUser(null);
      setGroupInviteEmailSuggestions([]);
      setGroupAddMemberIds([]);
      await loadGlobalGroupChats({ silent: true });
      showToast("Invited to group", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot invite by email", "error");
    } finally {
      setAddingGroupMembers(false);
    }
  };

  const handleRemoveGroupMember = async (member) => {
    if (!activeConversationId || !member?.user_id) return;
    const confirmed = await confirm(`Remove ${displayName(member)} from this group chat?`, {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/projects/chat/group-conversations/${activeConversationId}/members/${member.user_id}`);
      await loadGlobalGroupChats({ silent: true });
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
    if (!activeConversationId || activeConversation?.type !== "group") return;
    const confirmed = await confirm("Disband this group?", {
      confirmLabel: "Disband",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.patch(`/projects/chat/group-conversations/${activeConversationId}/disband`);
      setMessages([]);
      await loadGlobalGroupChats({ silent: true });
      showToast("Group disbanded", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot disband group", "error");
    }
  };

  const handleClearChatHistory = async () => {
    if (!activeConversationId || !["direct", "group"].includes(activeConversation?.type) || clearingHistory) return;
    const confirmed = await confirm("Delete all messages in this conversation? This will clear the history for everyone.", {
      confirmLabel: "Clear history",
      danger: true,
    });
    if (!confirmed) return;

    setClearingHistory(true);
    try {
      const endpoint = activeConversation.type === "direct"
        ? `/projects/chat/direct-conversations/${activeConversationId}/messages`
        : `/projects/chat/group-conversations/${activeConversationId}/messages`;
      await api.delete(endpoint);
      setMessages([]);
      latestMessageIdRef.current = 0;
      await Promise.all([
        loadChatNotifications({ silent: true }),
        activeConversation.type === "direct"
          ? loadGlobalDirectChats({ silent: true })
          : loadGlobalGroupChats({ silent: true }),
      ]);
      showToast("Chat history cleared", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot clear chat history", "error");
    } finally {
      setClearingHistory(false);
    }
  };

  const handleRemoveConversationFromList = async (conversation) => {
    const key = conversationKey(conversation);
    if (!key || !["direct", "group"].includes(conversation?.type)) return;

    const confirmed = await confirm("Delete this chat history from your side?", {
      confirmLabel: "Delete history",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const endpoint = conversation.type === "direct"
        ? `/projects/chat/direct-conversations/${key}`
        : `/projects/chat/group-conversations/${key}`;
      await api.delete(endpoint);
      setOpenConversationMenuId("");
      setChatNotifications((prev) => prev.filter((notification) => chatNotificationKey(notification) !== key));

      if (activeConversationId === key) {
        setActiveConversation(null);
        setMessages([]);
        latestMessageIdRef.current = 0;
      }

      if (conversation.type === "direct") {
        setGlobalDirectConversations((prev) => prev.filter((item) => conversationKey(item) !== key));
        setConversations((prev) => prev.filter((item) => conversationKey(item) !== key));
        await loadGlobalDirectChats({ silent: true });
      } else {
        setGlobalGroupConversations((prev) => prev.filter((item) => conversationKey(item) !== key));
        setConversations((prev) => prev.filter((item) => conversationKey(item) !== key));
        await loadGlobalGroupChats({ silent: true });
      }

      showToast("Chat history deleted", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot delete chat history", "error");
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

  const selectCreateGroupInviteUser = (member) => {
    setCreateGroupInviteUser(member);
    setCreateGroupInviteEmail(member.email || "");
    setCreateGroupEmailSuggestions([]);
  };

  const selectGroupInviteUser = (member) => {
    setGroupInviteUser(member);
    setGroupInviteEmail(member.email || "");
    setGroupInviteEmailSuggestions([]);
  };

  const selectDirectInviteUser = (member) => {
    setDirectInviteUser(member);
    setDirectInviteEmail(member.email || "");
    setDirectEmailSuggestions([]);
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
                    onClick={() => {
                      setActiveProject(project);
                      markConversationNotificationsRead({ conversation_id: `project-${project.project_id}` });
                    }}
                  >
                    <span className="chat-project-icon">
                      <Icon name="hash" size={16} />
                    </span>
                    <span className="chat-project-main">
                      <span className="chat-project-name">{project.name}</span>
                      <span className="chat-project-role">{project.user_role || "member"}</span>
                    </span>
                    {(unreadCountsByConversation[`project-${project.project_id}`] || unreadCountsByProject[project.project_id]) > 0 && (
                      <span className="chat-row-badge">
                        {(unreadCountsByConversation[`project-${project.project_id}`] || 0) + (unreadCountsByProject[project.project_id] || 0) > 9
                          ? "9+"
                          : (unreadCountsByConversation[`project-${project.project_id}`] || 0) + (unreadCountsByProject[project.project_id] || 0)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="chat-thread-panel">
              <div className="chat-panel-title-row">
                <div className="chat-panel-title">Groups</div>
                <button
                  type="button"
                  className={`chat-create-toggle ${isCreateGroupOpen ? "active" : ""}`}
                  onClick={() => setIsCreateGroupOpen((open) => !open)}
                >
                  <Icon name="teamAdd" size={14} />
                  <span>Create group</span>
                </button>
              </div>
              {isCreateGroupOpen && (
                <form className="chat-create-group-form" onSubmit={handleCreateGroup}>
                  <input type="text" placeholder="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                  <div className="chat-create-email-row">
                    <Icon name="mail" size={14} />
                    <input
                      type="email"
                      placeholder="Invite by email"
                      value={createGroupInviteEmail}
                      autoComplete="off"
                      onChange={(event) => {
                        setCreateGroupInviteEmail(event.target.value);
                        setCreateGroupInviteUser(null);
                      }}
                    />
                  </div>
                  {createGroupInviteUser && (
                    <div className="chat-email-selected-user">
                      <span className="chat-avatar small">
                        {createGroupInviteUser.user_photo ? (
                          <img src={avatarUrl(createGroupInviteUser.user_photo)} alt="" />
                        ) : (
                          displayName(createGroupInviteUser).charAt(0).toUpperCase()
                        )}
                      </span>
                      <span>
                        <strong>{displayName(createGroupInviteUser)}</strong>
                        <small>{createGroupInviteUser.email}</small>
                      </span>
                    </div>
                  )}
                  {!createGroupInviteUser && createGroupEmailSuggestions.length > 0 && (
                    <div className="chat-email-suggestions">
                      {createGroupEmailSuggestions.map((member) => (
                        <button
                          key={member.user_id}
                          type="button"
                          onClick={() => selectCreateGroupInviteUser(member)}
                        >
                          <span className="chat-avatar small">
                            {member.user_photo ? (
                              <img src={avatarUrl(member.user_photo)} alt="" />
                            ) : (
                              displayName(member).charAt(0).toUpperCase()
                            )}
                          </span>
                          <span>
                            <strong>{displayName(member)}</strong>
                            <small>{member.email}</small>
                          </span>
                          {member.project_role && <em>{member.project_role}</em>}
                        </button>
                      ))}
                    </div>
                  )}
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
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setIsCreateGroupOpen(false);
                        setCreateGroupInviteEmail("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingGroup || !groupName.trim() || (groupMemberIds.length === 0 && !createGroupInviteEmail.trim())}
                    >
                      Create group
                    </button>
                  </div>
                </form>
              )}
              {loadingGroupChats ? (
                <div className="chat-empty">Loading groups...</div>
              ) : groupConversations.length === 0 ? (
                <div className="chat-empty">No groups yet.</div>
              ) : groupConversations.map((conversation) => {
                const key = conversationKey(conversation);
                const unreadCount = unreadCountsByConversation[key] || 0;
                return (
                  <div
                    key={key}
                    className={`chat-thread-row-shell ${activeConversationId === key ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="chat-thread-row"
                      onClick={() => openChatConversation(conversation)}
                    >
                      <Icon name="users" size={15} />
                      <span className="chat-thread-main">
                        {conversation.name || "Group chat"}
                        {conversation.project_name && <small>{conversation.project_name}</small>}
                      </span>
                      {unreadCount > 0 && (
                        <span className="chat-row-badge">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="chat-thread-more-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenConversationMenuId((current) => (current === key ? "" : key));
                      }}
                      aria-label="Chat actions"
                    >
                      <Icon name="more" size={16} />
                    </button>
                    {openConversationMenuId === key && (
                      <div className="chat-thread-menu">
                        <button
                          type="button"
                          onClick={() => handleRemoveConversationFromList(conversation)}
                        >
                          <Icon name="trash" size={14} />
                          <span>Delete history</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="chat-thread-panel chat-thread-panel--direct">
              <div className="chat-panel-title-row">
                <div className="chat-panel-title">Direct chats</div>
                <button
                  type="button"
                  className={`chat-create-toggle ${isCreateDirectOpen ? "active" : ""}`}
                  onClick={() => setIsCreateDirectOpen((current) => !current)}
                >
                  <Icon name="teamAdd" size={14} />
                  New
                </button>
              </div>
              {isCreateDirectOpen && (
                <form className="chat-create-direct-form" onSubmit={handleCreateDirectChat}>
                  <div className="chat-create-email-row">
                    <Icon name="mail" size={14} />
                    <input
                      type="email"
                      placeholder="Find by email"
                      value={directInviteEmail}
                      autoComplete="off"
                      onChange={(event) => {
                        setDirectInviteEmail(event.target.value);
                        setDirectInviteUser(null);
                      }}
                    />
                  </div>
                  {directInviteUser && (
                    <div className="chat-email-selected-user">
                      <span className="chat-avatar small">
                        {directInviteUser.user_photo ? (
                          <img src={avatarUrl(directInviteUser.user_photo)} alt="" />
                        ) : (
                          displayName(directInviteUser).charAt(0).toUpperCase()
                        )}
                      </span>
                      <span>
                        <strong>{displayName(directInviteUser)}</strong>
                        <small>{directInviteUser.email}</small>
                      </span>
                    </div>
                  )}
                  {!directInviteUser && directEmailSuggestions.length > 0 && (
                    <div className="chat-email-suggestions">
                      {directEmailSuggestions.map((member) => (
                        <button
                          key={member.user_id}
                          type="button"
                          onClick={() => selectDirectInviteUser(member)}
                        >
                          <span className="chat-avatar small">
                            {member.user_photo ? (
                              <img src={avatarUrl(member.user_photo)} alt="" />
                            ) : (
                              displayName(member).charAt(0).toUpperCase()
                            )}
                          </span>
                          <span>
                            <strong>{displayName(member)}</strong>
                            <small>{member.email}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="chat-create-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setIsCreateDirectOpen(false);
                        setDirectInviteEmail("");
                        setDirectInviteUser(null);
                        setDirectEmailSuggestions([]);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingDirectChat || !directInviteEmail.trim()}
                    >
                      Open chat
                    </button>
                  </div>
                </form>
              )}
              {loadingDirectChats ? (
                <div className="chat-empty">Loading direct chats...</div>
              ) : directConversations.length === 0 ? (
                <div className="chat-empty">No direct chats yet.</div>
              ) : directConversations.map((conversation) => {
                const isDirect = conversation.type === "direct";
                const directMember = isDirect ? getDirectConversationMember(conversation) : null;
                const key = conversationKey(conversation);
                const unreadCount = unreadCountsByConversation[key] || 0;
                return (
                  <div
                    key={key}
                    className={`chat-thread-row-shell ${activeConversationId === key ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="chat-thread-row"
                      onClick={() => openExistingDirectChat(conversation)}
                    >
                      {isDirect ? (
                        <span className="chat-thread-avatar">
                          {directMember?.user_photo ? <img src={avatarUrl(directMember.user_photo)} alt="" /> : displayName(directMember).charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <Icon name={conversation.type === "group" ? "users" : "hash"} size={15} />
                      )}
                      <span className="chat-thread-main">
                        {getConversationLabel(conversation)}
                        {conversation.project_name && <small>{conversation.project_name}</small>}
                      </span>
                      {unreadCount > 0 && (
                        <span className="chat-row-badge">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="chat-thread-more-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenConversationMenuId((current) => (current === key ? "" : key));
                      }}
                      aria-label="Chat actions"
                    >
                      <Icon name="more" size={16} />
                    </button>
                    {openConversationMenuId === key && (
                      <div className="chat-thread-menu">
                        <button
                          type="button"
                          onClick={() => handleRemoveConversationFromList(conversation)}
                        >
                          <Icon name="trash" size={14} />
                          <span>Delete history</span>
                        </button>
                      </div>
                    )}
                  </div>
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
                    ? "Private conversation."
                    : activeConversation?.type === "group"
                      ? "Group conversation."
                      : "Messages are shared with every member in this project."}
                </p>
              </div>
            </div>

            <div className="chat-message-list">
              {!activeConversation ? (
                <div className="chat-empty chat-empty-large">Select a chat first.</div>
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
                        <small>{activeConversation?.type === "group" ? "Add members to this group" : "Add a new project member"}</small>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  )}

                  {canClearActiveHistory && (
                    <button
                      type="button"
                      className="chat-danger-row"
                      onClick={handleClearChatHistory}
                      disabled={clearingHistory || messages.length === 0}
                    >
                      <span>
                        <strong>Clear history</strong>
                        <small>Delete all messages in this conversation</small>
                      </span>
                      <Icon name="trash" size={16} />
                    </button>
                  )}

                  {activeConversation?.type === "group" && canManageActiveGroup && (
                    <button type="button" className="chat-danger-row" onClick={handleDisbandGroup}>
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
                  <form className="chat-email-invite-form" onSubmit={handleInviteGroupMemberByEmail}>
                    <label htmlFor="groupInviteEmail">Invite by email</label>
                    <div className="chat-email-invite-row">
                      <Icon name="mail" size={15} />
                      <input
                        id="groupInviteEmail"
                        type="email"
                        placeholder="member@email.com"
                        value={groupInviteEmail}
                        autoComplete="off"
                        onChange={(event) => {
                          setGroupInviteEmail(event.target.value);
                          setGroupInviteUser(null);
                        }}
                      />
                    </div>
                    {groupInviteUser && (
                      <div className="chat-email-selected-user">
                        <span className="chat-avatar small">
                          {groupInviteUser.user_photo ? (
                            <img src={avatarUrl(groupInviteUser.user_photo)} alt="" />
                          ) : (
                            displayName(groupInviteUser).charAt(0).toUpperCase()
                          )}
                        </span>
                        <span>
                          <strong>{displayName(groupInviteUser)}</strong>
                          <small>{groupInviteUser.email}</small>
                        </span>
                      </div>
                    )}
                    {!groupInviteUser && groupInviteEmailSuggestions.length > 0 && (
                      <div className="chat-email-suggestions">
                        {groupInviteEmailSuggestions.map((member) => (
                          <button
                            key={member.user_id}
                            type="button"
                            onClick={() => selectGroupInviteUser(member)}
                          >
                            <span className="chat-avatar small">
                              {member.user_photo ? (
                                <img src={avatarUrl(member.user_photo)} alt="" />
                              ) : (
                                displayName(member).charAt(0).toUpperCase()
                              )}
                            </span>
                            <span>
                              <strong>{displayName(member)}</strong>
                              <small>{member.email}</small>
                            </span>
                            {member.project_role && <em>{member.project_role}</em>}
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="submit" disabled={addingGroupMembers || !groupInviteEmail.trim()}>
                      Invite email
                    </button>
                  </form>
                  <div className="chat-group-member-picker compact">
                    {loadingGroupMemberCandidates ? (
                      <div className="chat-empty">Loading members...</div>
                    ) : addableChatMembers.length === 0 ? (
                      <div className="chat-empty">All available members are already in this group.</div>
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
