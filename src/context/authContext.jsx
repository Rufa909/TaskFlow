import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosInstance';

// Tạo Context để chia sẻ trạng thái auth toàn app
// Thay vì prop drilling (truyền props qua nhiều cấp component)
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // đang kiểm tra token ban đầu

  // Khi app khởi động: kiểm tra token trong localStorage có còn hợp lệ không
  // → tránh bị logout mỗi khi reload trang
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Gọi API /me để verify token với server
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch {
        // Token hết hạn hoặc không hợp lệ → xóa đi
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Hàm login: gọi API → lưu token → cập nhật state
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });

    // Lưu token vào localStorage để dùng cho các request sau
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user',  JSON.stringify(res.data.user));

    setUser(res.data.user);
    return res.data;
  };

  // Hàm register: tương tự login
  const register = async (username, email, password) => {
    const res = await api.post('/auth/register', { username, email, password });

    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user',  JSON.stringify(res.data.user));

    setUser(res.data.user);
    return res.data;
  };

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential });

    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));

    setUser(res.data.user);
    return res.data;
  };

  // Hàm logout: xóa token và reset state
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
// Custom hook để dùng AuthContext dễ hơn
// Thay vì useContext(AuthContext) ở mọi nơi → chỉ cần useAuth()
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải dùng trong AuthProvider');
  return context;
};
