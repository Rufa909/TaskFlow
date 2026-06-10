# TaskFlow - Task Management System cho Marketing

## Giới thiệu
TaskFlow là nền tảng quản lý nhiệm vụ **chuyên biệt cho Marketing**. Hỗ trợ Kanban, Team collaboration, và AI Assistant tự train chuyên sâu về Marketing (Content, SEO, Ads, Strategy...).

## Tính năng chính
- Xác thực người dùng (Đăng ký, Đăng nhập, Quên mật khẩu)
- Quản lý Task: Tạo, Sửa, Xóa, Gán nhãn, Ưu tiên, Deadline
- Kanban Board: Drag & Drop giữa các cột (To Do, In Progress, Done)
- Quản lý Project/Board
- Phân quyền thành viên
- Thông báo
- Tìm kiếm và lọc task
- Responsive design (Mobile-friendly)

## Công nghệ sử dụng
- **Frontend**: React.js + Vite + Tailwind CSS + React DnD (cho drag drop)
- **Backend**: Node.js + Express.js
- **Database**: MySQL (mysql2)
- **AI**: Self-trained local model (không dùng API bên ngoài)
- **Authentication**: JWT + bcrypt
- **Other**: Socket.io (real-time), Redux/ Zustand cho state management

## Cài đặt và Chạy dự án

### Prerequisites
- Node.js (v18+)
- MySQL (local hoặc Cloud)
- Git

### Clone project
```bash
git clone <your-repo-url>
cd task-management-system
```

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Cấu hình DB, JWT_SECRET
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Cấu trúc dự án
Xem chi tiết trong các file Markdown khác.

## Roadmap
1. Thiết kế Database & API
2. Xây dựng Backend
3. Xây dựng Frontend
4. Tích hợp Authentication
5. Triển khai Kanban
6. Testing & Deployment

---
**Hướng dẫn chi tiết được phân chia trong các file Markdown riêng.**