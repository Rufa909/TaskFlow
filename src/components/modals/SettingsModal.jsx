import { useRef, useState } from "react";
import Icon from "../common/Icon";
import api from "../../api/axiosInstance";

const API_URL = "http://localhost:5000";

function avatarUrl(photo) {
  if (!photo) return "";
  return photo.startsWith("http") || photo.startsWith("data:")
    ? photo
    : `${API_URL}${photo}`;
}

export default function SettingsModal({
  isSettingsModalOpen,
  setIsSettingsModalOpen,

  settingsTab,
  setSettingsTab,

  user,
  updateUser,

  handleLogout,

  t,
  language,
  setLanguage
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState("");

  const savedAvatar = avatarUrl(user?.user_photo);
  const visibleAvatar = previewAvatar || savedAvatar;

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert("Photo must be smaller than 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewAvatar(reader.result);
      setImageError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarSave = async () => {
    if (!previewAvatar) return;

    try {
      setUploading(true);
      const res = await api.put("/auth/avatar", { image: previewAvatar });
      updateUser(res.data.user);
      setPreviewAvatar("");
      setImageError(false);
    } catch (err) {
      alert(err.response?.data?.message || "Cannot upload avatar.");
    } finally {
      setUploading(false);
    }
  };

  if (!isSettingsModalOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={() =>
        setIsSettingsModalOpen(false)
      }
    >

      {isSettingsModalOpen && (
        <div
          className="settings-modal-overlay"
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="settings-modal-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Settings Header */}
            <div className="settings-modal-header">
              <h2>Settings</h2>
              <button
                className="settings-close-btn"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                <Icon name="x" size={24} />
              </button>
            </div>

            {/* Settings Layout - Sidebar & Content */}
            <div className="settings-modal-body">
              {/* Settings Sidebar */}
              <aside className="settings-sidebar">
                <div className="settings-search">
                  <input
                    type="text"
                    placeholder="Search"
                    className="settings-search-input"
                  />
                </div>

                <div className="settings-nav">
                  <button
                    className={`settings-nav-item ${settingsTab === "account" ? "active" : ""}`}
                    onClick={() => setSettingsTab("account")}
                  >
                    <Icon name="user" size={18} /> {t("account")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "general" ? "active" : ""}`}
                    onClick={() => setSettingsTab("general")}
                  >
                    <Icon name="sliders" size={18} /> {t("general")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "subscription" ? "active" : ""}`}
                    onClick={() => setSettingsTab("subscription")}
                  >
                    <Icon name="creditCard" size={18} /> {t("subscription")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "theme" ? "active" : ""}`}
                    onClick={() => setSettingsTab("theme")}
                  >
                    <Icon name="palette" size={18} /> {t("theme")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "sidebar" ? "active" : ""}`}
                    onClick={() => setSettingsTab("sidebar")}
                  >
                    <Icon name="sidebar" size={18} /> {t("sidebar")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "quick-add" ? "active" : ""}`}
                    onClick={() => setSettingsTab("quick-add")}
                  >
                    <Icon name="plus" size={18} /> {t("quickAdd")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "productivity" ? "active" : ""}`}
                    onClick={() => setSettingsTab("productivity")}
                  >
                    <Icon name="activity" size={18} /> {t("productivity")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "reminders" ? "active" : ""}`}
                    onClick={() => setSettingsTab("reminders")}
                  >
                    <Icon name="clock" size={18} /> {t("reminders")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "notifications" ? "active" : ""}`}
                    onClick={() => setSettingsTab("notifications")}
                  >
                    <Icon name="bell" size={18} /> {t("notifications")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "backups" ? "active" : ""}`}
                    onClick={() => setSettingsTab("backups")}
                  >
                    <Icon name="download" size={18} /> {t("backups")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "integrations" ? "active" : ""}`}
                    onClick={() => setSettingsTab("integrations")}
                  >
                    <Icon name="share" size={18} /> {t("integrations")}
                  </button>
                  <button
                    className={`settings-nav-item ${settingsTab === "calendars" ? "active" : ""}`}
                    onClick={() => setSettingsTab("calendars")}
                  >
                    <Icon name="calendar" size={18} /> {t("calendars")}
                  </button>
                </div>
              </aside>

              {/* Settings Content */}
              <div className="settings-content">
                {settingsTab === "account" && (
                  <div className="settings-section">
                    <div className="settings-section-header">
                      <h3>{t("account")}</h3>
                    </div>
                    {/* Photo */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("photo")}</label>
                      <div className="settings-photo-section">
                        <div className="avatar-large">
                          {visibleAvatar && !imageError ? (
                            <img
                              src={visibleAvatar}
                              alt=""
                              onError={() => setImageError(true)}
                            />
                          ) : user?.username
                            ? user.username.charAt(0).toUpperCase()
                            : "U"}
                        </div>
                        <div className="photo-info">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="avatar-file-input"
                            onChange={handleAvatarSelect}
                          />
                          <button
                            type="button"
                            className="upload-photo-btn"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {t("uploadPhoto")}
                          </button>
                          {previewAvatar && (
                            <button
                              type="button"
                              className="change-email-btn"
                              disabled={uploading}
                              onClick={handleAvatarSave}
                              style={{ background: "#e3f2fd", color: "#1976d2" }}
                            >
                              {uploading ? "Saving..." : t("Save")}
                            </button>
                          )}
                          <p className="photo-hint">{t("pickPhoto")}</p>
                          <p className="photo-hint">{t("avatarPublic")}</p>
                        </div>
                      </div>
                    </div>

                    {/* Name */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("name")}</label>
                      <input
                        type="text"
                        className="settings-input"
                        defaultValue={user?.username || "User"}
                      />
                      <button className="change-email-btn">{t("Save")}</button>
                    </div>

                    {/* Email */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("email")}</label>
                      <div className="settings-email-section">
                        <span>{user?.email || "email@example.com"}</span>
                      </div>
                    </div>

                    {/* Password */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("password")}</label>
                      <button className="add-password-btn">
                        {t("changePassword")}
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab !== "account" && (
                  <div className="settings-section">
                    <div className="settings-section-header">
                      <h3>{t(settingsTab)}</h3>
                    </div>
                    {settingsTab === "general" ? (
                      <div>
                        {/* Language Setting */}
                        <div className="settings-section-item">
                          <label className="settings-label">
                            {t("Language")}
                          </label>
                          <div className="language-selector">
                            <button
                              className={`language-btn ${language === "en" ? "active" : ""}`}
                              onClick={() => setLanguage("en")}
                            >
                              <span className="language-name">English</span>
                            </button>
                            <button
                              className={`language-btn ${language === "vi" ? "active" : ""}`}
                              onClick={() => setLanguage("vi")}
                            >
                              <span className="language-name">Tiếng Việt</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{
                          color: "#808080",
                          fontSize: "14px",
                          paddingTop: "20px",
                        }}
                      >
                        Coming soon...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
