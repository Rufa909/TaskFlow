const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });


const aiRoutes = require("./routes/aiRoutes");

const app = express();
const uploadsPath = path.resolve(__dirname, '../uploads');
// ─── Middleware toàn cục

// CORS: cho phép frontend (localhost:5173) gọi API
// Nếu không có cors → browser chặn request vì khác origin
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true // cho phép gửi cookie nếu cần
}));

// Parse JSON body từ request
// Không có dòng này → req.body sẽ là undefined
app.use(express.json({ limit: '6mb' }));

// Parse URL-encoded body (form submit truyền thống)
app.use(express.urlencoded({ extended:true, limit: '6mb' }));
app.use('/uploads', express.static(uploadsPath));
app.get('/uploads/:filename', (req, res, next) => {
    const filePath = path.join(uploadsPath, 'files', req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) next();
    });
});
// ─── Routes 
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Tất cả route auth sẽ có prefix /api/auth
// VD: /api/auth/login, /api/auth/register
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api', require('./routes/taskRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use("/api/ai", aiRoutes);
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
