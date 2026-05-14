import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Roboto, sans-serif' }}>
      <h2>Xin chào, {user?.username}! 👋</h2>
      <p style={{ color: '#888', marginTop: '8px' }}>{user?.email}</p>
      <button
        onClick={handleLogout}
        style={{
          marginTop: '24px', padding: '10px 20px',
          background: '#3585db', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
}