import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./AuthPage.css";

const authTranslations = {
  en: {
    login: "Login",
    register: "Register",
    welcomeBack: "Welcome back",
    signInToContinue: "Sign in to continue your work!",
    createAccount: "Create an account",
    getStarted: "Get started with our service",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    confirmPassword: "Confirm password",
    loginButton: "Login",
    createAccountButton: "Create Account",
    processing: "Processing...",
    creatingAccount: "Creating account...",
    or: "Or",
    requiredFields: "Please fill in all information",
    passwordTooShort: "Password must be at least 6 characters",
    passwordsDoNotMatch: "Passwords do not match",
    loginSuccess: "Login successful! Redirecting...",
    loginFailed: "Login failed",
    registerSuccess: "Registration successful! Redirecting...",
    registerFailed: "Registration failed",
    googleLoginSuccess: "Google login successful! Redirecting...",
    googleLoginFailed: "Google login failed",
    productivityCompanion: "Your productivity companion",
    smartManagementTasks: "Smart management tasks",
    classifiedPriorityDeadline: "Classified by priority and deadline",
    collaborativeWork: "Collaborative work",
    assignTrackProgress: "Assign tasks and track progress in real-time",
    detailedReports: "Detailed reports",
    analyzingPerformance: "Analyzing performance weekly and monthly",
    instantNotifications: "Instant notifications",
    neverMissDeadline: "Never miss a deadline again",
    rightsReserved: "All rights reserved",
    fullNamePlaceholder: "Nguyen Van A",
    emailPlaceholder: "example@example.com",
    passwordPlaceholder: "Minimum 6 characters",
    confirmPasswordPlaceholder: "Re-enter password",
    loginWithGoogle: "Login with Google",
  },
  vi: {
    login: "Đăng nhập",
    register: "Đăng ký",
    welcomeBack: "Chào mừng trở lại",
    signInToContinue: "Đăng nhập để tiếp tục công việc của bạn!",
    createAccount: "Tạo tài khoản",
    getStarted: "Bắt đầu sử dụng dịch vụ",
    email: "Email",
    password: "Mật khẩu",
    fullName: "Họ và tên",
    confirmPassword: "Xác nhận mật khẩu",
    loginButton: "Đăng nhập",
    createAccountButton: "Tạo tài khoản",
    processing: "Đang xử lý...",
    creatingAccount: "Đang tạo tài khoản...",
    or: "Hoặc",
    requiredFields: "Vui lòng nhập đầy đủ thông tin",
    passwordTooShort: "Mật khẩu phải có ít nhất 6 ký tự",
    passwordsDoNotMatch: "Mật khẩu nhập lại không khớp",
    loginSuccess: "Đăng nhập thành công! Đang chuyển trang...",
    loginFailed: "Đăng nhập thất bại",
    registerSuccess: "Đăng ký thành công! Đang chuyển trang...",
    registerFailed: "Đăng ký thất bại",
    googleLoginSuccess: "Đăng nhập Google thành công! Đang chuyển trang...",
    googleLoginFailed: "Đăng nhập Google thất bại",
    productivityCompanion: "Người bạn đồng hành năng suất",
    smartManagementTasks: "Quản lý công việc thông minh",
    classifiedPriorityDeadline: "Phân loại theo ưu tiên và hạn chót",
    collaborativeWork: "Làm việc nhóm",
    assignTrackProgress: "Giao việc và theo dõi tiến độ theo thời gian thực",
    detailedReports: "Báo cáo chi tiết",
    analyzingPerformance: "Phân tích hiệu suất theo tuần và tháng",
    instantNotifications: "Thông báo tức thì",
    neverMissDeadline: "Không bỏ lỡ hạn chót nữa",
    rightsReserved: "Đã đăng ký bản quyền",
    fullNamePlaceholder: "Nguyễn Văn A",
    emailPlaceholder: "example@example.com",
    passwordPlaceholder: "Tối thiểu 6 ký tự",
    confirmPasswordPlaceholder: "Nhập lại mật khẩu",
    loginWithGoogle: "Đăng nhập bằng Google",
  },
};

export default function AuthPage() {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const { login, register, loginWithGoogle } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = (key) =>
    authTranslations[language]?.[key] || authTranslations.en[key] || key;

  const switchTab = (newTab) => {
    setTab(newTab);
    setAlert({ type: "", msg: "" });
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert({ type: "", msg: "" });

    if (!loginData.email || !loginData.password) {
      return setAlert({ type: "error", msg: t("requiredFields") });
    }

    setLoading(true);
    try {
      await login(loginData.email, loginData.password);
      setAlert({ type: "success", msg: t("loginSuccess") });
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      setAlert({
        type: "error",
        msg: err.response?.data?.message || t("loginFailed"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAlert({ type: "", msg: "" });

    if (
      !regData.username ||
      !regData.email ||
      !regData.password ||
      !regData.confirmPassword
    ) {
      return setAlert({ type: "error", msg: t("requiredFields") });
    }

    if (regData.password.length < 6) {
      return setAlert({ type: "error", msg: t("passwordTooShort") });
    }

    if (regData.password !== regData.confirmPassword) {
      return setAlert({ type: "error", msg: t("passwordsDoNotMatch") });
    }

    setLoading(true);
    try {
      await register(regData.username, regData.email, regData.password);
      setAlert({ type: "success", msg: t("registerSuccess") });
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      setAlert({
        type: "error",
        msg: err.response?.data?.message || t("registerFailed"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (accessToken) => {
    setAlert({ type: "", msg: "" });
    setLoading(true);

    try {
      await loginWithGoogle({ accessToken });
      setAlert({ type: "success", msg: t("googleLoginSuccess") });
      setTimeout(() => navigate("/"), 800);
    } catch {
      setAlert({ type: "error", msg: t("googleLoginFailed") });
    } finally {
      setLoading(false);
    }
  };

  const startGoogleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => handleGoogleToken(tokenResponse.access_token),
    onError: () => setAlert({ type: "error", msg: t("googleLoginFailed") }),
  });

  const features = [
    ["smartManagementTasks", "classifiedPriorityDeadline"],
    ["collaborativeWork", "assignTrackProgress"],
    ["detailedReports", "analyzingPerformance"],
    ["instantNotifications", "neverMissDeadline"],
  ];

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div>
          <div className="brand-logo">
            <img
              src="/src/images/icon.png"
              alt="Task Flow Logo"
              style={{ width: "50px", height: "50px" }}
            />
          </div>
          <div className="brand-title">Task Flow</div>
          <div className="brand-tagline">{t("productivityCompanion")}</div>
        </div>

        <div className="feature-list">
          {features.map(([title, desc]) => (
            <div key={title} className="feature-item">
              <div className="feature-dot" />
              <div className="feature-text">
                <strong>{t(title)}</strong> - {t(desc)}
              </div>
            </div>
          ))}
        </div>

        <div className="left-footer">© 2026 Task Flow · {t("rightsReserved")}</div>
      </div>

      <div className="auth-right">
        <div className="auth-language-switch" aria-label="Language selector">
          <button
            type="button"
            className={language === "en" ? "active" : ""}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={language === "vi" ? "active" : ""}
            onClick={() => setLanguage("vi")}
          >
            VI
          </button>
        </div>

        <div className="auth-form-box">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => switchTab("login")}
            >
              {t("login")}
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => switchTab("register")}
            >
              {t("register")}
            </button>
          </div>

          {alert.msg && (
            <div className={`alert-box ${alert.type}`}>{alert.msg}</div>
          )}

          {tab === "login" && (
            <form onSubmit={handleLogin}>
              <div className="form-heading">{t("welcomeBack")}</div>
              <div className="form-subtext">{t("signInToContinue")}</div>

              <div className="field-group">
                <label className="field-label">{t("email")}</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder={t("emailPlaceholder")}
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">{t("password")}</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" /> {t("processing")}
                  </>
                ) : (
                  t("loginButton")
                )}
              </button>

              <div className="or-divider">{t("or")}</div>

              <button
                type="button"
                className="oauth-btn"
                disabled={loading}
                onClick={() => startGoogleLogin()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t("loginWithGoogle")}
              </button>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={handleRegister}>
              <div className="form-heading">{t("createAccount")}</div>
              <div className="form-subtext">{t("getStarted")}</div>

              <div className="field-group">
                <label className="field-label">{t("fullName")}</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder={t("fullNamePlaceholder")}
                  value={regData.username}
                  onChange={(e) =>
                    setRegData({ ...regData, username: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">{t("email")}</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder={t("emailPlaceholder")}
                  value={regData.email}
                  onChange={(e) =>
                    setRegData({ ...regData, email: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">{t("password")}</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder={t("passwordPlaceholder")}
                  value={regData.password}
                  onChange={(e) =>
                    setRegData({ ...regData, password: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">{t("confirmPassword")}</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder={t("confirmPasswordPlaceholder")}
                  value={regData.confirmPassword}
                  onChange={(e) =>
                    setRegData({ ...regData, confirmPassword: e.target.value })
                  }
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" /> {t("creatingAccount")}
                  </>
                ) : (
                  t("createAccountButton")
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
