import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Icon from "../common/Icon";
import ProfileDropdown from "./ProfileDropdown";
import api from "../../api/axiosInstance";

const API_URL = "http://localhost:5000";

function avatarUrl(photo) {
  if (!photo) return "";
  return photo.startsWith("http") || photo.startsWith("data:")
    ? photo
    : `${API_URL}${photo}`;
}

export default function Sidebar({
  user,

  projects,
  activeProject,
  setActiveProject,

  setIsAddingTask,

  loadingProjects,

  handleDeleteProject,

  t,

  isProfileMenuOpen,
  setIsProfileMenuOpen,

  handleLogout,

  isProjectMenuOpen,
  setIsProjectMenuOpen,
  setIsSettingsModalOpen,

  setIsAddProjectModalOpen,
}) {
  const src = avatarUrl(user?.user_photo);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({ inbox: 0, today: 0 });

  useEffect(() => {
    setImageError(false);
  }, [user?.user_photo]);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get('/tasks/counts');
        if (res.data.success) {
          setCounts(res.data.counts);
        }
      } catch (err) {
        console.error("Cannot load task counts", err);
      }
    };
    fetchCounts();
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div
          className="user-profile"
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
          title="Click to see options"
        >
          <div className="avatar">
            {src && !imageError ? (
              <img src={src} alt="" onError={() => setImageError(true)} />
            ) : (
              user?.username ? user.username.charAt(0).toUpperCase() : "U"
            )}
          </div>
          <span className="username">{user?.username || "User"}</span>
          <span className="chevron">
            <Icon name="chevronDown" size={14} />
          </span>

          {/* Profile Dropdown Menu */}
          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <ProfileDropdown
              handleLogout={handleLogout}
              setIsSettingsModalOpen={setIsSettingsModalOpen}
              setIsProfileMenuOpen={setIsProfileMenuOpen}
              t={t}
            />
          )}
        </div>
        <div className="sidebar-actions">
          <button className="icon-btn" title="Notifications">
            <Icon name="bell" size={18} />
          </button>
          <button className="icon-btn" title="Toggle Sidebar">
            <Icon name="sidebar" size={18} />
          </button>
        </div>
      </div>

      <div className="sidebar-nav">
        <button
          className="nav-item add-task"
          onClick={() => {
            setIsAddingTask(true);
          }}
        >
          <span className="icon">
            <Icon name="plus" size={18} />
          </span>{" "}
          {t("addTask")}
        </button>
        <button className="nav-item">
          <span className="icon">
            <Icon name="search" size={18} />
          </span>{" "}
          {t("search")}
        </button>
        <button 
          className={`nav-item ${location.pathname === '/' && !activeProject ? 'active' : ''}`} 
          onClick={() => {
            if (setActiveProject) setActiveProject(null);
            navigate('/');
          }}
        >
          <span className="icon">
            <Icon name="inbox" size={18} />
          </span>{" "}
          <span style={{flex: 1, textAlign: 'left'}}>{t("inbox")}</span>
          {counts.inbox > 0 && <span className="count">{counts.inbox}</span>}
        </button>
        <Link 
          to="/today"
          className={`nav-item ${location.pathname === '/today' ? 'active' : ''}`}
          style={{ textDecoration: 'none', display: 'flex' }}
        >
          <span className="icon">
            <Icon name="calendar" size={18} />
          </span>{" "}
          <span style={{flex: 1, textAlign: 'left'}}>{t("today")}</span>
          {counts.today > 0 && <span className="count">{counts.today}</span>}
        </Link>
        <Link
          to="/upcoming"
          className={`nav-item ${location.pathname === '/upcoming' ? 'active' : ''}`}
          style={{ textDecoration: 'none', display: 'flex' }}
        >
          <span className="icon">
            <Icon name="upcoming" size={18} />
          </span>{" "}
          <span style={{flex: 1, textAlign: 'left'}}>{t("upcoming")}</span>
        </Link>
        <button className="nav-item">
          <span className="icon">
            <Icon name="grid" size={18} />
          </span>{" "}
          {t("filtersLabels")}
        </button>
        <button className="nav-item">
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
              onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
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
                className={`project-item ${activeProject?.project_id === proj.project_id ? "active" : ""}`}
                onClick={() => {
                  if (setActiveProject) setActiveProject(proj);
                  if (setIsAddingTask) setIsAddingTask(false);
                  if (location.pathname !== '/') navigate('/');
                }}
              >
                <span className="icon">
                  <Icon name="hash" size={16} />
                </span>
                <span
                  className="project-name"
                  style={{ flex: 1, textAlign: "left" }}
                >
                  {proj.name}
                </span>
                <div
                  className="delete-project-btn"
                  onClick={(e) => handleDeleteProject(e, proj.project_id)}
                  title="Delete project"
                >
                  <Icon name="trash" size={14} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="nav-item">
          <span className="icon">
            <Icon name="help" size={18} />
          </span>{" "}
          {t("helpResources")}
        </button>
      </div>
    </aside>
  );
}
