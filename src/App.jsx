import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    // AuthProvider bọc toàn bộ app để mọi component đều dùng được useAuth()
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Route công khai: trang login/register */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Route được bảo vệ: phải đăng nhập mới vào được */}
          {/* ProtectedRoute kiểm tra token, nếu chưa có → redirect về /auth */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* Mọi route không tồn tại → về trang chủ */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}