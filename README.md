# TaskFlow - Ứng dụng Quản lý Công việc Toàn diện

TaskFlow là một ứng dụng web hiện đại giúp bạn quản lý công việc, dự án và nhóm một cách hiệu quả. Ứng dụng tích hợp AI để hỗ trợ thông minh và tăng năng suất công việc.

##  Tính năng chính

- **Quản lý công việc**: Tạo, chỉnh sửa, xóa và theo dõi tiến độ công việc
- **Quản lý dự án**: Tổ chức công việc theo dự án với giao diện trực quan
- **Quản lý nhóm**: Tạo nhóm và phân công công việc cho thành viên
- **Hệ thống thông báo**: Thông báo thời gian thực về cập nhật công việc
- **Chat AI thông minh**: Trợ lý AI giúp bạn với các câu hỏi về công việc
- **Xác thực an toàn**: Đăng nhập/đăng ký với mã hóa mật khẩu bảo mật
- **Tải tệp đính kèm**: Đính kèm tài liệu vào công việc
- **Bình luận và thảo luận**: Giao tiếp với thành viên trong từng công việc
- **Hỗ trợ đa ngôn ngữ**: Chuyển đổi giữa các ngôn ngữ khác nhau
- **Giao diện responsive**: Hoạt động tốt trên mọi thiết bị

##  Công nghệ sử dụng

### Frontend
- **React 18** - Thư viện giao diện người dùng
- **Vite** - Công cụ build hiện đại
- **JavaScript (ES6+)** - Ngôn ngữ lập trình chính
- **CSS3** - Tạo kiểu giao diện

### Backend
- **Node.js** - Thời gian chạy JavaScript phía máy chủ
- **Express.js** - Framework web
- **PostgreSQL/MySQL** - Cơ sở dữ liệu
- **JWT** - Xác thực token

### AI Service
- **Python** - Xử lý AI
- **TensorFlow/PyTorch** - Học máy
- **Dataset** - Dữ liệu huấn luyện

### Công cụ khác
- **Postman** - Kiểm tra API
- **Multer** - Tải tệp lên

##  Cấu trúc dự án

```
TaskFlow/
├── index.html                 # File HTML chính
├── package.json              # Cấu hình npm frontend
├── vite.config.js            # Cấu hình Vite
├── test.js                   # File kiểm tra
│
├── src/                      # Mã nguồn frontend
│   ├── App.jsx              # Component chính
│   ├── main.jsx             # Điểm vào ứng dụng
│   ├── api/                 # Axios instance
│   ├── components/          # Các component React
│   │   ├── AI/              # Component chat AI
│   │   ├── common/          # Component dùng chung
│   │   ├── modals/          # Dialog/Modal
│   │   ├── sidebar/         # Thanh bên
│   │   └── task/            # Quản lý công việc
│   ├── context/             # React Context
│   ├── hooks/               # Custom hooks
│   ├── i18n/                # Đa ngôn ngữ
│   ├── pages/               # Các trang
│   ├── services/            # API services
│   └── assets/              # Ảnh, icon, v.v
│
├── server/                  # Mã nguồn backend
│   ├── package.json        # Cấu hình npm backend
│   ├── src/
│   │   ├── app.js          # Tập tin chính Express
│   │   ├── config/         # Cấu hình (database)
│   │   ├── controllers/    # Logic xử lý
│   │   ├── middleware/     # Middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── migrations/     # Database migrations
│   │   └── uploads/        # Thư mục lưu tệp tải lên
│   └── uploads/            # Tệp đã tải lên
│
├── ai-service/            # Dịch vụ AI
│   ├── app.py             # Ứng dụng Flask/FastAPI
│   ├── train.py           # Huấn luyện mô hình
│   ├── predict.py         # Dự đoán
│   ├── dataset.json       # Dữ liệu
│   └── generate_dataset.cjs # Tạo dataset
│
├── public/                # Tệp tĩnh công khai
├── postman/              # Collection Postman để kiểm tra API
└── scripts/              # Script tiện ích
```

##  Yêu cầu hệ thống

- **Node.js**: phiên bản 16 trở lên
- **Python**: phiên bản 3.8 trở lên
- **npm** hoặc **yarn**: quản lý gói
- **Database**: PostgreSQL hoặc MySQL
- **Git**: kiểm soát phiên bản

##  Hướng dẫn cài đặt

### 1. Clone dự án

```bash
git clone <repository-url>
cd TaskFlow
```

### 2. Cài đặt Frontend

```bash
npm install
```

### 3. Cài đặt Backend

```bash
cd server
npm install
```

### 4. Cài đặt AI Service

```bash
cd ai-service
pip install -r requirements.txt
```

### 5. Cấu hình biến môi trường

Tạo file `.env` trong thư mục `server`:

```env
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

Tạo file `.env` trong thư mục `ai-service`:

```env
MODEL_PATH=./models
PORT=5001
```

### 6. Khởi động cơ sở dữ liệu

```bash
cd server
npm run migrate  # Chạy migrations (nếu có)
```

##  Chạy ứng dụng

### Chạy Frontend (phát triển)

```bash
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

### Chạy Backend

```bash
cd server
npm start
# hoặc
npm run dev  # Chế độ phát triển với nodemon
```

Backend sẽ chạy tại `http://localhost:5000`

### Chạy AI Service

```bash
cd ai-service
python app.py
```

AI Service sẽ chạy tại `http://localhost:5001`

##  Kiểm tra

### Chạy kiểm tra frontend

```bash
npm run test
```

### Kiểm tra API với Postman

Mở Postman và import file `postman/globals/workspace.globals.yaml`

##  API Documentation

### Xác thực
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất

### Người dùng
- `GET /api/users/:id` - Lấy thông tin người dùng
- `PUT /api/users/:id` - Cập nhật thông tin người dùng
- `DELETE /api/users/:id` - Xóa tài khoản

### Dự án
- `GET /api/projects` - Danh sách dự án
- `POST /api/projects` - Tạo dự án mới
- `GET /api/projects/:id` - Chi tiết dự án
- `PUT /api/projects/:id` - Cập nhật dự án
- `DELETE /api/projects/:id` - Xóa dự án

### Công việc
- `GET /api/tasks` - Danh sách công việc
- `POST /api/tasks` - Tạo công việc mới
- `GET /api/tasks/:id` - Chi tiết công việc
- `PUT /api/tasks/:id` - Cập nhật công việc
- `DELETE /api/tasks/:id` - Xóa công việc

### Nhóm
- `GET /api/teams` - Danh sách nhóm
- `POST /api/teams` - Tạo nhóm
- `GET /api/teams/:id` - Chi tiết nhóm
- `PUT /api/teams/:id` - Cập nhật nhóm
- `DELETE /api/teams/:id` - Xóa nhóm

### AI
- `POST /api/ai/chat` - Gửi tin nhắn cho AI

##  Bảo mật

- Sử dụng JWT để xác thực người dùng
- Mã hóa mật khẩu với bcrypt
- CORS được cấu hình để ngăn chặn yêu cầu không mong muốn
- Xác thực middleware trên tất cả các route được bảo vệ


**Tác giả**: Quang  
**Cập nhật lần cuối**: 2026-06-08
