# Hướng dẫn Xây dựng Frontend

## 1. Khởi tạo Project
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install tailwindcss@latest postcss autoprefixer @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install axios react-router-dom zustand react-hook-form zod lucide-react
npx tailwindcss init -p
```

## 2. Các Page chính
- `/login`, `/register`
- `/dashboard` - List projects
- `/project/:id` - Kanban Board
- `/task/:id` - Task Detail Modal

## 3. Component quan trọng
- `TaskCard`: Hiển thị task với drag
- `BoardColumn`: Column chứa tasks
- `CreateTaskModal`
- `Sidebar` cho navigation

## 4. State Management
Sử dụng Zustand:
```ts
import { create } from 'zustand';
export const useTaskStore = create((set) => ({ tasks: [], ... }));
```

## 5. Drag & Drop Implementation
Sử dụng @dnd-kit cho smooth experience.

Tiếp tục implement theo **UI_DESIGN.md** (nếu có).