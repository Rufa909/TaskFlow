# Yêu cầu Dự án - Task Management System

## Yêu cầu Chức năng (Functional Requirements)

### 1. Quản lý Người dùng
- Đăng ký tài khoản (email, password, tên)
- Đăng nhập / Đăng xuất
- Quên mật khẩu (reset qua email)
- Chỉnh sửa profile (avatar, tên, bio)

### 2. Quản lý Project/Board
- Tạo Project mới
- Xem danh sách Project
- Mời thành viên vào Project
- Xóa/Archive Project

### 3. Quản lý Task
- CRUD Task (Create, Read, Update, Delete)
- Thuộc tính Task: Tiêu đề, Mô tả, Deadline, Ưu tiên (Low/Med/High), Nhãn (Labels), Assignee
- Comment trên Task
- Attach file (tùy chọn)

### 4. Kanban Board
- Tạo các Column (list)
- Drag & Drop Task giữa các Column
- Reorder Task và Column

### 5. Tìm kiếm & Lọc
- Tìm kiếm toàn cục
- Lọc theo assignee, label, deadline, priority

### 6. AI Marketing Assistant
- Hỏi đáp thông minh về task marketing
- Gợi ý content, campaign, SEO, A/B testing...
- Phân tích task & đề xuất cải thiện

### 7. Thông báo
- Real-time notification khi task được assign hoặc comment

## Yêu cầu Phi chức năng (Non-Functional)
- Responsive (Mobile, Tablet, Desktop)
- Bảo mật: JWT, Password hashing, Input validation
- Performance: Load nhanh, hỗ trợ nhiều user
- Scalability: Sẵn sàng cho cloud deployment
- Accessibility: WCAG cơ bản

## User Roles
- Admin (toàn quyền)
- Member (quản lý task trong project)
- Guest (xem)

Xem thêm **DATABASE_SCHEMA.md**, **API_DOCUMENTATION.md** để chi tiết.