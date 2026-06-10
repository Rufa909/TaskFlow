# API Documentation (REST + Socket)

Base URL: `/api`

## Auth Routes
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập → trả JWT
- `POST /auth/forgot-password`
- `GET /auth/me` - Lấy info user hiện tại (protected)

## Project Routes (Protected)
- `GET /projects` - List projects của user
- `POST /projects` - Tạo project
- `GET /projects/:id` - Chi tiết project
- `PUT /projects/:id` - Update
- `DELETE /projects/:id`
- `POST /projects/:id/invite` - Mời member

## Board Routes
- `GET /projects/:projectId/boards`
- `POST /projects/:projectId/boards`
- `PUT /boards/:id` (reorder)

## Task Routes
- `GET /projects/:projectId/tasks`
- `POST /projects/:projectId/tasks`
- `GET /tasks/:id`
- `PUT /tasks/:id` (update, move column)
- `DELETE /tasks/:id`
- `POST /tasks/:id/comments`

## Socket Events (Real-time)
- `joinProject: projectId`
- `taskUpdated`, `taskMoved`, `newComment`, `notification`

**Security**: Sử dụng middleware auth JWT cho tất cả route protected.

Xem mã nguồn backend để implement chi tiết.