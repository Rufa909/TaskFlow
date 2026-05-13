import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function AuthPage() {
  // tab: 'login' | 'register' — điều khiển hiển thị form nào
  const [tab,      setTab]      = useState('login');
  const [loading,  setLoading]  = useState(false);
  const [alert,    setAlert]    = useState({ type: '', msg: '' });

  // State form Login
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // State form Register
  const [regData, setRegData] = useState({
    username: '', email: '', password: ''
  });

  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Xử lý đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert({ type: '', msg: '' });

    if (!loginData.email || !loginData.password) {
      return setAlert({ type: 'error', msg: 'Vui lòng nhập đầy đủ thông tin' });
    }

    setLoading(true);
    try {
      // Gọi hàm login từ AuthContext → gọi API → lưu token
      await login(loginData.email, loginData.password);

      setAlert({ type: 'success', msg: 'Đăng nhập thành công! Đang chuyển trang...' });

      // Chuyển đến trang chủ sau 0.8 giây
      setTimeout(() => navigate('/'), 800);

    } catch (err) {
      // err.response.data.message là message từ backend trả về
      const msg = err.response?.data?.message || 'Đăng nhập thất bại';
      setAlert({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  // Xử lý đăng ký
  const handleRegister = async (e) => {
    e.preventDefault();
    setAlert({ type: '', msg: '' });

    if (!regData.username || !regData.email || !regData.password) {
      return setAlert({ type: 'error', msg: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (regData.password.length < 6) {
      return setAlert({ type: 'error', msg: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    setLoading(true);
    try {
      await register(regData.username, regData.email, regData.password);
      setAlert({ type: 'success', msg: 'Đăng ký thành công! Đang chuyển trang...' });
      setTimeout(() => navigate('/'), 800);

    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng ký thất bại';
      setAlert({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  // Khi đổi tab → xóa alert và reset loading
  const switchTab = (newTab) => {
    setTab(newTab);
    setAlert({ type: '', msg: '' });
    setLoading(false);
  };

  return (
    <div className="auth-page">

      {/* ── Panel trái: Branding ── */}
      <div className="auth-left">
        <div>
          <div className="brand-logo">
            <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <div className="brand-title">DoItRightNow</div>
          <div className="brand-tagline">Your productivity companion</div>
        </div>

        <div className="feature-list">
          {[
            ['Quản lý task thông minh', 'Phân loại theo độ ưu tiên và deadline tự động'],
            ['Làm việc nhóm', 'Giao task và theo dõi tiến độ realtime'],
            ['Báo cáo chi tiết', 'Phân tích năng suất theo tuần và tháng'],
            ['Thông báo tức thì', 'Không bỏ lỡ bất kỳ deadline nào'],
          ].map(([title, desc]) => (
            <div key={title} className="feature-item">
              <div className="feature-dot" />
              <div className="feature-text">
                <strong>{title}</strong> — {desc}
              </div>
            </div>
          ))}
        </div>

        <div className="left-footer">© 2025 DoItRightNow · All rights reserved</div>
      </div>

      {/* ── Panel phải: Form ── */}
      <div className="auth-right">
        <div className="auth-form-box">

          {/* Tabs chuyển đổi Login / Register */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              Đăng nhập
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => switchTab('register')}
            >
              Đăng ký
            </button>
          </div>

          {/* Alert box: hiện lỗi hoặc thành công */}
          {alert.msg && (
            <div className={`alert-box ${alert.type}`}>{alert.msg}</div>
          )}

          {/* ── Form Login ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-heading">Chào mừng trở lại</div>
              <div className="form-subtext">Đăng nhập để tiếp tục công việc</div>

              <div className="field-group">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="huy@example.com"
                  value={loginData.email}
                  onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Mật khẩu</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? <><div className="spinner" /> Đang xử lý...</> : 'Đăng nhập'}
              </button>

              <div className="or-divider">hoặc</div>

              <button type="button" className="oauth-btn">
                {/* Google icon SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Tiếp tục với Google
              </button>
            </form>
          )}

          {/* ── Form Register ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-heading">Tạo tài khoản</div>
              <div className="form-subtext">Bắt đầu hành trình productivity của bạn</div>

              <div className="field-group">
                <label className="field-label">Họ và tên</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Trần Quang Huy"
                  value={regData.username}
                  onChange={e => setRegData({ ...regData, username: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="huy@example.com"
                  value={regData.email}
                  onChange={e => setRegData({ ...regData, email: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Mật khẩu</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Tối thiểu 6 ký tự"
                  value={regData.password}
                  onChange={e => setRegData({ ...regData, password: e.target.value })}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? <><div className="spinner" /> Đang tạo tài khoản...</> : 'Tạo tài khoản'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}