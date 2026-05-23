import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";
import { GoogleLogin } from "@react-oauth/google";
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
  const handleGoogleSuccess = async (credentialResponse) => {
    setAlert({ type: "", msg: "" });
    setLoading(true);

    try {
      await loginWithGoogle(credentialResponse.credential);
      setAlert({
        type: "success",
        msg: "Đăng nhập Google thành công! Đang chuyển trang...",
      });
      setTimeout(() => navigate("/"), 800);
    } catch {
      setAlert({ type: "error", msg: "Đăng nhập Google thất bại" });
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

              <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() =>
                    setAlert({
                      type: "error",
                      msg: "Đăng nhập Google thất bại",
                    })
                  }npm run dev:all
                />
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
