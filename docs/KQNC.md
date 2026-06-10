**Tiêu đề:** Nghiên cứu và Xây dựng Task Management System chuyên về Marketing  


---

## 1. Mục tiêu nghiên cứu

- Xây dựng một nền tảng quản lý công việc (Task Management) hiện đại, tập trung vào lĩnh vực **Marketing**.
- Tích hợp **AI Assistant** tự train hỗ trợ các vấn đề liên quan đến Marketing (campaign, content, SEO, social media…).
- Hỗ trợ làm việc nhóm, theo dõi tiến độ thời gian thực.
- Sử dụng công nghệ **Node.js + React + MySQL** và AI local.

---

## 2. Tiến độ trong 2 tuần qua (27/05/2026 – 10/06/2026)

### Tuần 1 (27/05 – 02/06/2026)
- Thiết lập cấu trúc monorepo (Frontend + Backend + AI Service).
- Hoàn thiện hệ thống Authentication (Local + Google OAuth).
- Xây dựng các model cơ bản: Users, Projects, Tasks, Project Members.
- Tích hợp MySQL database và migrations.
- Bắt đầu phát triển AI Service (train.py + dataset Marketing).
- Xây dựng giao diện cơ bản (Login, Register, Dashboard).

### Tuần 2 (03/06 – 10/06/2026)
- Hoàn thiện CRUD Tasks + Project.
- Phát triển AI Chatbot (v1.0 → v1.1) chuyên Marketing.
- Thêm tính năng Attachment, Comments, Notifications.
- Cải thiện UI/UX (Upgrade UI, Fix Edit Task, Member permissions).
- Xây dựng flow giao task, assignment request & submission.
- Thêm đa ngôn ngữ (i18n), responsive design.
- Viết README chi tiết + Postman collection.
- Tạo bộ tài liệu Markdown hướng dẫn phát triển (bao gồm file này).

**Tổng số commit trong 2 tuần:** ~40+ commits

---

## 3. Kết quả đạt được

### Tính năng đã hoàn thành
- [x] Authentication (JWT + Google Login)
- [x] Quản lý Project & Team
- [x] CRUD Tasks với Priority, Deadline, Status
- [x] Attachment & Comments
- [x] AI Chatbot cơ bản (tự train, chủ đề Marketing)
- [x] Role-based access (Owner, Leader, Member)
- [x] Notification & Activity Log
- [x] Responsive UI + Dark/Light mode (đang cải thiện)


## 4. Khó khăn gặp phải & Bài học rút ra

- Cấu trúc package.json bị lẫn giữa root và server → Đã fix.
- Tích hợp AI local tốn tài nguyên → Cần tối ưu model nhỏ.
- Quản lý state phức tạp khi làm Kanban → Sẽ dùng @dnd-kit.
- Đồng bộ real-time chưa hoàn thiện → Sắp tích hợp Socket.io.

---

## 5. Kế hoạch tiếp theo (2 tuần tới)

1. Hoàn thiện **Kanban Board** (Drag & Drop)
2. Nâng cấp AI Assistant (RAG + dataset Marketing lớn hơn)
3. Thêm Calendar View + Dashboard Analytics
4. Real-time Notification với Socket.io
5. Testing & Security Audit
6. Deploy lên production (Render / Railway)

---

## 6. Kết luận

Sau 2 tuần nghiên cứu và phát triển, **TaskFlow** đã có nền tảng vững chắc, có thể sử dụng được cho nhu cầu quản lý công việc Marketing cá nhân và nhóm nhỏ. Hệ thống đang hướng tới việc trở thành công cụ hỗ trợ Marketing toàn diện với AI thông minh.
