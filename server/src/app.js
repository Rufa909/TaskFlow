const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Server } = require('socket.io');
const { setIo } = require('./socket');

const workflowRoutes = require('./routes/workflowRoutes');
const aiRoutes = require("./routes/aiRoutes");
const { checkOverdueTasks } = require("./controllers/taskController");

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
app.use('/api', workflowRoutes);

// ─── Socket.IO setup
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true
    }
});
setIo(io);

// Room theo projectId (room name bạn tự chọn, ví dụ: project:<projectId>)
io.on('connection', (socket) => {
    console.log('Socket da ket noi:', socket.id);

    socket.on('joinProject', (projectId) => {
        if (!projectId) return;
        const room = `project:${projectId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} da tham gia room ${room}`);
    });

    socket.on('disconnect', () => {
        console.log('Socket da ngat ket noi:', socket.id);
    });
});

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
// ─── Khởi động server chayj bang socket
const PORT = process.env.PORT || 5000;
httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} dang duoc su dung. Hay tat server cu hoac doi PORT trong .env.`);
        process.exit(1);
    }

    throw err;
});

httpServer.listen(PORT, () => {
    console.log(`Server (HTTP + Socket.io) is running on port ${PORT}`);
});

const overdueIntervalMs = Number(process.env.OVERDUE_TASK_CHECK_INTERVAL_MS || 15 * 60 * 1000);
setInterval(() => {
    checkOverdueTasks().catch((err) => {
        console.error('Loi kiem tra task qua han:', err.message);
    });
}, overdueIntervalMs);
