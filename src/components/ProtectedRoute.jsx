import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Component bảo vệ route: nếu chưa đăng nhập → redirect về /auth
// Bọc quanh các route cần xác thực
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Đang kiểm tra token → hiển thị loading, không redirect vội
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <div>Đang tải...</div>
      </div>
    );
  }

  // Chưa đăng nhập → về trang auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Đã đăng nhập → hiển thị nội dung
  return children;
};

export default ProtectedRoute;