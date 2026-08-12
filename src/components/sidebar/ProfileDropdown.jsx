import Icon from "../common/Icon";
import { useTeams } from "../../context/TeamsContext";
import { useNavigate } from "react-router-dom";

export default function ProfileDropdown({
  user,
  handleLogout,
  setIsSettingsModalOpen,
  setIsProfileMenuOpen,
  t,
}) {
  const { openTeamModal, activeProject } = useTeams();
  const navigate = useNavigate();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  return (
    <div className="profile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
      {isAdmin && (
        <div
          className="profile-dropdown-item admin-item"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/admin");
            setIsProfileMenuOpen(false);
          }}
        >
          <Icon name="activity" size={14} /> Admin Console
        </div>
      )}

      <div
        className="profile-dropdown-item"
        onClick={(e) => {
          e.stopPropagation();
          openTeamModal();
          setIsProfileMenuOpen(false);
        }}
      >
        <Icon name="teamAdd" size={14} /> {t("addTeam")}
      </div>

      <div
        className="profile-dropdown-item"
        onClick={(e) => {
          e.stopPropagation();
          setIsSettingsModalOpen(true);
          setIsProfileMenuOpen(false);
        }}
      >
        <Icon name="setting" size={14} /> {t("settings")}
      </div>

      <div className="profile-dropdown-divider"></div>

      <div
        className="profile-dropdown-item logout-item"
        onClick={(e) => {
          e.stopPropagation();
          handleLogout();
        }}
      >
        <Icon name="logout" size={14} /> {t("logout")}
      </div>
    </div>
  );
}
