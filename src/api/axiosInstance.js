import axios from 'axios';

// Tạo instance axios với cấu hình mặc định
// Giúp không phải lặp lại baseURL và headers mỗi lần gọi API
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // địa chỉ backend
  timeout: 10000,                        // timeout 10 giây
});

// ─── Request Interceptor ──────────────────────────
// Chạy TRƯỚC mỗi request → tự động gắn token vào header
api.interceptors.request.use(
  (config) => {
    // Lấy token từ localStorage (được lưu sau khi login)
    const token = localStorage.getItem('token');

    if (token) {
      // Gắn token vào header Authorization
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────
// Chạy SAU mỗi response → xử lý lỗi tập trung
api.interceptors.response.use(
  (response) => response, // response OK → trả về bình thường

  (error) => {
    // Nếu token hết hạn (401/403) → tự động logout
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth'; // redirect về trang login
    }
    return Promise.reject(error);
  }
);

export default api;