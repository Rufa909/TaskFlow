import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Icon from "../common/Icon";
import ProfileDropdown from "./ProfileDropdown";
import api from "../../api/axiosInstance";
import { useFilters } from "../../context/FiltersContext";
import { useTeams } from "../../context/TeamsContext";
import "./SideBar.css";

const API_URL = "http://localhost:5000";
const SIDEBAR_COLLAPSED_KEY = "taskflow.sidebarCollapsed";

function getSavedSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

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

export default function Sidebar({
  user,

  projects,
  activeProject,
  setActiveProject,
  activeView = "project",
  setActiveView = () => {},

  setIsAddingTask,

  loadingProjects,

  handleDeleteProject,
  onRequestEditProject,

  t,

  isProfileMenuOpen,
  setIsProfileMenuOpen,

  handleLogout,

  isProjectMenuOpen,
  setIsProjectMenuOpen,

  isSidebarCollapsed,
  setIsSidebarCollapsed,

  setIsSettingsModalOpen,
  setIsAddProjectModalOpen,
}) {
  const src = avatarUrl(user?.user_photo);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({ inbox: 0, today: 0 });
  const [notifications, setNotifications] = useState([]);
  const [approvalNotifications, setApprovalNotifications] = useState([]);
  const [invitationNotifications, setInvitationNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const {
    openTeamModal,
    setActiveProject: setContextActiveProject,
  } = useTeams();

  useEffect(() => {
    if (activeProject) {
      setContextActiveProject(activeProject);
    }
  }, [activeProject, setContextActiveProject]);
  const [projectCounts, setProjectCounts] = useState({});
  const [localSidebarCollapsed, setLocalSidebarCollapsed] = useState(
    getSavedSidebarCollapsed,
  );
  const sidebarCollapsed = isSidebarCollapsed ?? localSidebarCollapsed;
  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false);
  };

  const toggleSidebar = () => {
    closeProfileMenu();
    const nextCollapsed = !sidebarCollapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));

    if (typeof setIsSidebarCollapsed === "function") {
      setIsSidebarCollapsed(nextCollapsed);
    } else {
      setLocalSidebarCollapsed(nextCollapsed);
    }
  };

  useEffect(() => {
    setImageError(false);
  }, [user?.user_photo]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get("/tasks/counts");
        if (res.data.success) {
          setCounts(res.data.counts);
        }
      } catch (err) {
        console.error("Cannot load task counts", err);
      }
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/notifications");
        if (mounted) setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error("Cannot load notifications", err);
      } finally {
        if (mounted) setLoadingNotifications(false);
      }
    };

    fetchNotifications();
    const id = setInterval(fetchNotifications, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchApprovalNotifications = async () => {
      const reviewableProjects = (projects || []).filter(
        (project) =>
          Number(project.owner_id) === Number(user?.id) ||
          project.user_role === "leader",
      );

      if (reviewableProjects.length === 0) {
        if (mounted) setApprovalNotifications([]);
        return;
      }

      try {
        const submissionResults = await Promise.all(
          reviewableProjects.map((project) =>
            api
              .get(`/projects/${project.project_id}/task-submissions`)
              .then((res) =>
                (res.data.submissions || [])
                  .filter((item) => ["pending", "leader_approved"].includes(item.status))
                  .map((item) => ({
                    kind: "approval",
                    noti_id: `approval-${project.project_id}-${item.submission_id}`,
                    is_read: 0,
                    title:
                      item.status === "leader_approved"
                        ? `Owner approval for "${item.title}"`
                        : `Review submitted task "${item.title}"`,
                    task_project_name: project.name,
                    created_at: item.created_at,
                  })),
              )
              .catch(() => []),
          ),
        );

        if (mounted) {
          setApprovalNotifications(
            submissionResults
              .flat()
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
          );
        }
      } catch (err) {
        console.error("Cannot load approval notifications", err);
      }
    };

    fetchApprovalNotifications();
    const id = setInterval(fetchApprovalNotifications, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [projects, user?.id]);

  useEffect(() => {
    let mounted = true;

    const fetchInvitationNotifications = async () => {
      try {
        const res = await api.get("/teams/invitations");
        const pendingInvitations = (res.data.invitations || []).map((inv) => ({
          kind: "invitation",
          noti_id: `invitation-${inv.invitation_id}`,
          is_read: 0,
          title: `Team invitation from ${inv.sender_username || "Unknown"}`,
          project_name: inv.project_name,
          created_at: inv.created_at,
        }));

        if (mounted) {
          setInvitationNotifications(pendingInvitations);
        }
      } catch (err) {
        console.error("Cannot load invitation notifications", err);
      }
    };

    fetchInvitationNotifications();
    const id = setInterval(fetchInvitationNotifications, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const { setIsFiltersOpen } = useFilters();
  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;
  const pendingInboxNotificationCount =
    approvalNotifications.length + invitationNotifications.length;
  const notificationBadgeCount = unreadNotificationCount + pendingInboxNotificationCount;
  const latestNotifications = [
    ...approvalNotifications,
    ...invitationNotifications,
    ...notifications,
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const markAllNotificationsRead = async () => {
    if (unreadNotificationCount === 0 || isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
    } catch (err) {
      console.error("Cannot mark all notifications read", err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleMarkAllNotificationsRead = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead();
  };

  const handleInboxClick = () => {
    closeProfileMenu();
    setIsNotificationsOpen(false);
    markAllNotificationsRead();
  };

  useEffect(() => {
    if (location.pathname === "/inbox") {
      markAllNotificationsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, unreadNotificationCount]);

  const handleNotificationClick = async (notification) => {
    if (notification.kind === "approval" || notification.kind === "invitation") {
      setIsNotificationsOpen(false);
      navigate("/inbox");
      return;
    }

    if (!notification.is_read) {
      try {
        await api.put(`/notifications/${notification.noti_id}/read`);
        setNotifications((prev) =>
          prev.map((item) =>
            item.noti_id === notification.noti_id
              ? { ...item, is_read: 1 }
              : item,
          ),
        );
      } catch (err) {
        console.error("Cannot mark notification read", err);
      }
    }

    const projectId = notification.task_project_id || notification.reference_id;
    if (notification.task_project_id && notification.reference_id) {
      const targetProject = projects.find(
        (project) => Number(project.project_id) === Number(projectId),
      );
      if (targetProject) {
        setActiveProject(targetProject);
      }
      setActiveView("project");
      setIsNotificationsOpen(false);
      navigate(`/?projectId=${projectId}&taskId=${notification.reference_id}`);
    }
  };

  const handleViewNotificationDetails = () => {
    closeProfileMenu();
    setIsNotificationsOpen(false);
    navigate("/notifications");
  };

  // fetch per-project counts and poll for realtime-ish updates
  useEffect(() => {
    let mounted = true;
    const fetchProjectCounts = async () => {
      try {
        const res = await api.get("/tasks/counts/projects");
        if (res.data.success && mounted) {
          setProjectCounts(res.data.counts || {});
        }
      } catch (err) {
        console.error("Cannot load project counts", err);
      }
    };

    fetchProjectCounts();
    const id = setInterval(fetchProjectCounts, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [projects]);

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div
          className="user-profile"
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
          title="Click to see options"
        >
          <div className="avatar">
            {src && !imageError ? (
              <img src={src} alt="" onError={() => setImageError(true)} />
            ) : user?.username ? (
              user.username.charAt(0).toUpperCase()
            ) : (
              "U"
            )}
          </div>
          <span className="username">{user?.username || "User"}</span>
          <span className="chevron">
            <Icon name="chevronDown" size={14} />
          </span>

          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <ProfileDropdown
              handleLogout={handleLogout}
              setIsSettingsModalOpen={setIsSettingsModalOpen}
              setIsProfileMenuOpen={setIsProfileMenuOpen}
              t={t}
              activeProject={activeProject}
            />
          )}
        </div>
        <div className="sidebar-actions" ref={notificationsRef}>
          <button
            className={`icon-btn notification-bell ${isNotificationsOpen ? "active" : ""}`}
            title="Notifications"
            onClick={(e) => {
              e.stopPropagation();
              closeProfileMenu();
              setIsNotificationsOpen((prev) => !prev);
            }}
          >
            <Icon name="bell" size={18} />
            {notificationBadgeCount > 0 && (
              <span className="notification-bell-badge">
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </span>
            )}
          </button>
          {isNotificationsOpen && (
            <div className="notification-popover">
              <div className="notification-popover-header">
                <span>Notifications</span>
                {notificationBadgeCount > 0 && (
                  <span className="notification-popover-actions">
                    <button
                      type="button"
                      className="notification-read-all-btn"
                      disabled={isMarkingAllRead}
                      onClick={handleMarkAllNotificationsRead}
                    >
                      Read all
                    </button>
                    <span className="notification-popover-count">
                      {notificationBadgeCount}
                    </span>
                  </span>
                )}
              </div>

              <div className="notification-popover-list">
                {loadingNotifications ? (
                  <div className="notification-popover-empty">Loading...</div>
                ) : latestNotifications.length === 0 ? (
                  <div className="notification-popover-empty">No notifications</div>
                ) : (
                  latestNotifications.map((notification) => (
                    <button
                      key={notification.noti_id}
                      type="button"
                      className={`notification-popover-item ${
                        notification.is_read ? "read" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <span className="notification-popover-dot" />
                      <span className="notification-popover-main">
                        <span className="notification-popover-title">
                          {notification.title}
                        </span>
                        <span className="notification-popover-meta">
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
                  ))
                )}
              </div>
              <div className="notification-popover-footer">
                <button
                  type="button"
                  className="notification-detail-link"
                  onClick={handleViewNotificationDetails}
                >
                  View details
                </button>
              </div>
            </div>
          )}
          <button
            className="icon-btn"
            title="Toggle Sidebar"
            onClick={toggleSidebar}
          >
            <Icon name="sidebar" size={18} />
          </button>
        </div>
      </div>

      <div className="sidebar-nav">
        <button
          className="nav-item add-task"
          onClick={() => {
            closeProfileMenu();
            setActiveView("project");
            if (location.pathname !== "/" || location.search) navigate("/");
            setIsAddingTask(true);
          }}
        >
          <span className="icon">
            <Icon name="plus" size={18} />
          </span>{" "}
          {t("addTask")}
        </button>
        <button className="nav-item" onClick={closeProfileMenu}>
          <span className="icon">
            <Icon name="search" size={18} />
          </span>{" "}
          {t("search")}
        </button>
        <Link
          to="/inbox"
          className={`nav-item ${location.pathname === "/inbox" ? "active" : ""}`}
          style={{ textDecoration: "none", display: "flex" }}
          onClick={handleInboxClick}
        >
          <span className="icon">
            <Icon name="inbox" size={18} />
          </span>{" "}
          <span style={{ flex: 1, textAlign: "left" }}>{t("inbox")}</span>
          {notificationBadgeCount > 0 && (
            <span className="count inbox-notification-count">
              {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
            </span>
          )}
        </Link>
        <Link
          to="/chat"
          className={`nav-item ${location.pathname === "/chat" ? "active" : ""}`}
          style={{ textDecoration: "none", display: "flex" }}
          onClick={closeProfileMenu}
        >
          <span className="icon">
            <Icon name="chat" size={18} />
          </span>{" "}
          <span style={{ flex: 1, textAlign: "left" }}>{t("chat")}</span>
        </Link>
        <Link
          to="/today"
          className={`nav-item ${location.pathname === "/today" ? "active" : ""}`}
          style={{ textDecoration: "none", display: "flex" }}
          onClick={closeProfileMenu}
        >
          <span className="icon">
            <Icon name="calendar" size={18} />
          </span>{" "}
          <span style={{ flex: 1, textAlign: "left" }}>{t("today")}</span>
          {counts.today > 0 && <span className="count">{counts.today}</span>}
        </Link>
        <Link
          to="/upcoming"
          className={`nav-item ${location.pathname === "/upcoming" ? "active" : ""}`}
          style={{ textDecoration: "none", display: "flex" }}
          onClick={closeProfileMenu}
        >
          <span className="icon">
            <Icon name="upcoming" size={18} />
          </span>{" "}
          <span style={{ flex: 1, textAlign: "left" }}>{t("upcoming")}</span>
        </Link>
        <button
          className={`nav-item filters-btn ${activeView === "filtersLabels" ? "active" : ""}`}
          onClick={() => {
            closeProfileMenu();
            setActiveView("filtersLabels");
            setIsAddingTask(false);
            navigate("/?view=filtersLabels");
          }}
          title={t("filtersLabels")}
        >
          <span className="icon">
            <Icon name="sliders" size={18} />
          </span>
          {t("filtersLabels")}
        </button>
        <button
          className={`nav-item ${activeView === "reporting" ? "active" : ""}`}
          onClick={() => {
            closeProfileMenu();
            setActiveView("reporting");
            setIsAddingTask(false);
            navigate("/?view=reporting");
          }}
        >
          <span className="icon">
            <Icon name="activity" size={18} />
          </span>{" "}
          {t("reporting")}
        </button>
      </div>

      <div className="sidebar-projects">
        <div className="projects-header">
          <span>{t("myProjects")}</span>
          <div className="projects-header-actions">
            <button
              onClick={() => {
                closeProfileMenu();
                setIsProjectMenuOpen(!isProjectMenuOpen);
              }}
              title={t("addProject")}
            >
              <Icon name="plus" size={16} />
            </button>
            <button title="Collapse">
              <Icon name="chevronDown" size={16} />
            </button>

            {isProjectMenuOpen && (
              <div className="project-dropdown-menu">
                <div
                  className="project-dropdown-item"
                  onClick={() => {
                    closeProfileMenu();
                    setIsProjectMenuOpen(false);
                    setIsAddProjectModalOpen(true);
                  }}
                >
                  <Icon name="hash" size={14} /> {t("addProject")}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="project-list">
          {loadingProjects ? (
            <div style={{ padding: "8px", fontSize: "13px", color: "#aaa" }}>
              Loading...
            </div>
          ) : (
            projects.map((proj) => (
              <button
                key={proj.project_id}
                className={`project-item ${
                  activeView === "project" &&
                  activeProject?.project_id === proj.project_id
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  closeProfileMenu();
                  setActiveView("project");
                  setActiveProject(proj);
                  setIsAddingTask(false);
                  if (location.pathname !== "/" || location.search)
                    navigate("/");
                }}
              >
                <span className="icon">
                  <Icon name="hash" size={18} />
                </span>
                <span className="project-name" style={{ flex: 1, textAlign: "left" }}>
                  {proj.name}
                </span>
                {projectCounts[proj.project_id] > 0 && (
                  <span className="project-count">{projectCounts[proj.project_id]}</span>
                )}
                <div
                  className="team-project-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeProfileMenu();
                    openTeamModal(proj);
                  }}
                  title="View and add members"
                >
                  <Icon name="teamAdd" size={14} />
                </div>
                <div
                  className="edit-project-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeProfileMenu();
                    if (typeof onRequestEditProject === "function") onRequestEditProject(proj);
                  }}
                  title="Edit project"
                >
                  <Icon name="edit" size={14} />
                </div>
                <div
                  className="delete-project-btn"
                  onClick={(e) => {
                    closeProfileMenu();
                    handleDeleteProject(e, proj.project_id);
                  }}
                  title="Delete project"
                >
                  <Icon name="trash" size={14} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="collapsed-account">
        <button
          className="collapsed-account-btn"
          type="button"
          title="Account"
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
        >
          <span className="avatar">
            {src && !imageError ? (
              <img src={src} alt="" onError={() => setImageError(true)} />
            ) : user?.username ? (
              user.username.charAt(0).toUpperCase()
            ) : (
              "U"
            )}
          </span>
        </button>

        {isProfileMenuOpen && (
          <ProfileDropdown
            handleLogout={handleLogout}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
            setIsProfileMenuOpen={setIsProfileMenuOpen}
            t={t}
            activeProject={activeProject}
          />
        )}
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={closeProfileMenu}>
          <span className="icon">
            <Icon name="help" size={18} />
          </span>{" "}
          {t("helpResources")}
        </button>
      </div>
    </aside>
  );
}
