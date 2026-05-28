import Icon from "../common/Icon";
import { useTeams } from "../../context/TeamsContext";

export default function ProfileDropdown({
  handleLogout,
  setIsSettingsModalOpen,
  setIsProfileMenuOpen,
  t,
}) {
  const { openTeamModal, activeProject } = useTeams();

  return (
    <div className="profile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
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