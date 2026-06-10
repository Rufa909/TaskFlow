# Hướng dẫn Xây dựng Backend - TaskFlow (MySQL)

## Khởi tạo Backend

```bash
cd server
npm init -y

# Cài các package cần thiết
npm install express mysql2 dotenv cors bcryptjs jsonwebtoken multer body-parser
npm install --save-dev nodemon

# Real-time (nếu cần)
npm install socket.io

server/
├── config/
│   └── db.js                    # Kết nối MySQL
├── controllers/
├── routes/
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── utils/
├── uploads/                     # Lưu file đính kèm
├── .env
└── server.js

Sau khi hoàn thành API, test bằng Postman hoặc Thunder Client.