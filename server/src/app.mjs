const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
// ─── Middleware toàn cục

// CORS: cho phép frontend (localhost:5173) gọi API
// Nếu không có cors → browser chặn request vì khác origin
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true // cho phép gửi cookie nếu cần
}));

// Parse JSON body từ request
// Không có dòng này → req.body sẽ là undefined
app.use(express.json());

// Parse URL-encoded body (form submit truyền thống)
app.use(express.urlencoded({ extended:true }));
// ─── Routes 

// Tất cả route auth sẽ có prefix /api/auth
// VD: /api/auth/login, /api/auth/register
app.use('/api/auth', require('./routes/authRoutes'));
// (Sẽ thêm sau) Task routes
// app.use('/api/tasks', require('./routes/taskRoutes'));

// ─── Global Error Handler
// Bắt lỗi từ tất cả route, phải có 4 tham số (err, req, res, next)
app.use((err, req, res, next) => {
    console.error('Loi toan cuc:', err);
    res.status(500).json({
        success: false,
        message: 'Co loi xay ra, vui long thu lai sau!'
    });
})
// ─── 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.path} khong ton tai!`
    });
})
// ─── Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
