# Hướng dẫn Xây dựng Backend

## 1. Khởi tạo
```bash
mkdir backend && cd backend
npm init -y
npm install express mongoose dotenv cors bcryptjs jsonwebtoken socket.io
npm install --save-dev nodemon
```

## 2. Cấu hình cơ bản
- Kết nối MongoDB trong `config/db.js`
- Middleware auth: verify JWT
- Error handling global

## 3. Implement Controllers
Ví dụ Task Controller:
- createTask
- updateTask (cập nhật position khi move)
- getTasksByProject

## 4. Real-time với Socket.io
```js
io.on('connection', (socket) => {
  socket.on('joinProject', (projectId) => {
    socket.join(projectId);
  });
});
```

Sau khi hoàn thành API, test bằng Postman hoặc Thunder Client.