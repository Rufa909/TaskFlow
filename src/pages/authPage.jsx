import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

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

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert({ type: "", msg: "" });

    if (!loginData.email || !loginData.password) {
      return setAlert({ type: "error", msg: "Vui lòng nhập đầy đủ thông tin" });
    }

    setLoading(true);
    try {
      await login(loginData.email, loginData.password);

      setAlert({
        type: "success",
        msg: "Đăng nhập thành công! Đang chuyển trang...",
      });

      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      const msg = err.response?.data?.message || "Đăng nhập thất bại";
      setAlert({ type: "error", msg });
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
      return setAlert({ type: "error", msg: "Vui lòng nhập đầy đủ thông tin" });
    }
    if (regData.password.length < 6) {
      return setAlert({
        type: "error",
        msg: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }
    if (regData.password !== regData.confirmPassword) {
      return setAlert({ type: "error", msg: "Mật khẩu nhập lại không khớp" });
    }
    setLoading(true);
    try {
      await register(regData.username, regData.email, regData.password);
      setAlert({
        type: "success",
        msg: "Đăng ký thành công! Đang chuyển trang...",
      });
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      const msg = err.response?.data?.message || "Đăng ký thất bại";
      setAlert({ type: "error", msg });
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setAlert({ type: "", msg: "" });
    setLoading(false);
  };

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
            {/* <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg> */}
          </div>
          <div className="brand-title">Task Flow</div>
          <div className="brand-tagline">Your productivity companion</div>
        </div>

        <div className="feature-list">
          {[
            ["Smart management tasks", "Classified by priority and deadline"],
            [
              "Collaborative work",
              "Assign tasks and track propress in real-time",
            ],
            ["Detailed reports", "Analying performance weekly and monthly"],
            ["Instant notifications", "Never miss a deadline again"],
          ].map(([title, desc]) => (
            <div key={title} className="feature-item">
              <div className="feature-dot" />
              <div className="feature-text">
                <strong>{title}</strong> — {desc}
              </div>
            </div>
          ))}
        </div>

        <div className="left-footer">
          © 2026 Task Flow · All rights reserved
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => switchTab("login")}
            >
              Login
            </button>
            <button
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => switchTab("register")}
            >
              Register
            </button>
          </div>

          {alert.msg && (
            <div className={`alert-box ${alert.type}`}>{alert.msg}</div>
          )}

          {tab === "login" && (
            <form onSubmit={handleLogin}>
              <div className="form-heading">Welcome back</div>
              <div className="form-subtext">Sign in to continue your work!</div>

              <div className="field-group">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="example@example.com"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">Password</label>
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
                    <div className="spinner" /> Processing...
                  </>
                ) : (
                  "Login"
                )}
              </button>

              <div className="or-divider">Or</div>

              <button type="button" className="oauth-btn">
                <svg width="18" height="18" viewBox="0 0 24 24">
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
                Continue with Google
              </button>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={handleRegister}>
              <div className="form-heading">Create an account</div>
              <div className="form-subtext">Get started with our service</div>

              <div className="field-group">
                <label className="field-label">Full name</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Nguyen Van A"
                  value={regData.username}
                  onChange={(e) =>
                    setRegData({ ...regData, username: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="NguyenVanA@example.com"
                  value={regData.email}
                  onChange={(e) =>
                    setRegData({ ...regData, email: e.target.value })
                  }
                />
              </div>

              <div className="field-group">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Minimum 6 characters"
                  value={regData.password}
                  onChange={(e) =>
                    setRegData({ ...regData, password: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label">Confirm password</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Re-enter password"
                  value={regData.confirmPassword}
                  onChange={(e) =>
                    setRegData({ ...regData, confirmPassword: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" /> Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
