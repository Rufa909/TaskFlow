import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Trang chủ sau khi đăng nhập (sẽ thay bằng layout Sidebar đầy đủ)
export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();                   // xóa token khỏi localStorage
    navigate('/auth', { replace: true }); // redirect về trang login
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'DM Sans, sans-serif' }}>
      <h2>Xin chào, {user?.username}! 👋</h2>
      <p style={{ color: '#888', marginTop: '8px' }}>{user?.email}</p>
      <button
        onClick={handleLogout}
        style={{
          marginTop: '24px', padding: '10px 20px',
          background: '#DB4035', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer'
        }}
      >
        Đăng xuất
      </button>
    </div>
  );
}