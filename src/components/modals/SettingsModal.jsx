import Icon from "../common/Icon";
import api from "../../api/axiosInstance";
import { useEffect, useRef, useState } from "react";

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
  setLanguage,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [sendingVerificationEmail, setSendingVerificationEmail] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameSavedMessage, setNameSavedMessage] = useState("");
  
  const savedAvatar = avatarUrl(user?.user_photo);

  useEffect(() => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setNameError("");
    setNameSuggestions([]);
    setNameSavedMessage("");
    setVerificationMessage("");
  }, [user]);

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
  const handleSaveUsername = async () => {
    const nextUsername = username.trim();

    setNameError("");
    setNameSuggestions([]);
    setNameSavedMessage("");

    if (!nextUsername) {
      alert("Name cannot be empty.");
      return;
    }

    try {
      setSavingName(true);

      const res = await api.put("/auth/username", {
        username: nextUsername,
      });

      updateUser(res.data.user);
      setNameSavedMessage("Name updated.");
    } catch (err) {
      if (err.response?.status === 409) {
        setNameError(err.response.data?.message || "This name is already used.");
        setNameSuggestions(err.response.data?.suggestions || []);
        return;
      }

      alert(err.response?.data?.message || "Cannot update name.");
    } finally {
      setSavingName(false);
    }
  };
  
  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword) {
      alert("Please fill all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }

    try {
      setSavingPassword(true);

      const res = await api.put("/auth/password", {
        currentPassword,
        newPassword,
      });

      alert(res.data.message);

      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      alert(err.response?.data?.message || "Cannot update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    setVerificationMessage("");

    try {
      setSendingVerificationEmail(true);
      const res = await api.post("/auth/send-verification-email");

      if (res.data.user) {
        updateUser(res.data.user);
      }

      setVerificationMessage(
        res.data.message || "Verification link sent to your email.",
      );
    } catch (err) {
      setVerificationMessage(
        err.response?.data?.message || "Cannot send verification email.",
      );
    } finally {
      setSendingVerificationEmail(false);
    }
  };
  if (!isSettingsModalOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={() => setIsSettingsModalOpen(false)}
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
                          ) : user?.username ? (
                            user.username.charAt(0).toUpperCase()
                          ) : (
                            "U"
                          )}
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
                              style={{
                                background: "#e3f2fd",
                                color: "#1976d2",
                              }}
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
                      <div className="settings-name-control">
                        <input
                          type="text"
                          className={`settings-input ${nameError ? "settings-input-error" : ""}`}
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setNameError("");
                            setNameSuggestions([]);
                            setNameSavedMessage("");
                          }}
                        />
                        {nameError && (
                          <p className="settings-field-error">{nameError}</p>
                        )}
                        {nameSavedMessage && (
                          <p className="settings-field-success">
                            {nameSavedMessage}
                          </p>
                        )}
                        {nameSuggestions.length > 0 && (
                          <div className="settings-name-suggestions">
                            <span>Available suggestions:</span>
                            {nameSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                  setUsername(suggestion);
                                  setNameError("");
                                  setNameSuggestions([]);
                                  setNameSavedMessage("");
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="change-email-btn"
                        onClick={handleSaveUsername}
                        disabled={savingName}
                      >
                        {savingName ? "Saving..." : t("Save")}
                      </button>
                    </div>

                    {/* Email (disabled - user cannot change email from UI) */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("email")}</label>
                      <div className="settings-email-control">
                        <div className="settings-email-row">
                          <input
                            type="email"
                            className="settings-input"
                            value={email}
                            disabled
                          />
                          {user?.email_verified ? (
                            <span className="settings-email-status verified">
                              {t("emailVerified")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="change-email-btn"
                              onClick={handleSendVerificationEmail}
                              disabled={sendingVerificationEmail}
                            >
                              {sendingVerificationEmail
                                ? t("sending")
                                : t("verifyEmail")}
                            </button>
                          )}
                        </div>
                        {!user?.email_verified && (
                          <span className="settings-email-status unverified">
                            {t("emailNotVerified")}
                          </span>
                        )}
                        {verificationMessage && (
                          <p className="settings-field-success">
                            {verificationMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Password */}
                    <div
                      className="settings-section-item"
                      style={{ marginTop: "24px" }}
                    >
                      <label className="settings-label">{t("password")}</label>

                      {!showPasswordForm ? (
                        <button
                          className="add-password-btn"
                          onClick={() => setShowPasswordForm(true)}
                        >
                          {t("changePassword")}
                        </button>
                      ) : (
                        <>
                          <input
                            type="password"
                            className="settings-input"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            style={{ marginBottom: "12px" }}
                          />

                          <input
                            type="password"
                            className="settings-input"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />

                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              marginTop: "12px",
                            }}
                          >
                            <button
                              className="change-email-btn"
                              onClick={handleSavePassword}
                              disabled={savingPassword}
                            >
                              {savingPassword ? "Saving..." : t("Save")}
                            </button>

                            <button
                              className="add-password-btn"
                              onClick={() => {
                                setShowPasswordForm(false);
                                setCurrentPassword("");
                                setNewPassword("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
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
