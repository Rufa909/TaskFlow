# Tech Stack cho Task Management System

## Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Headless UI / Shadcn/ui
- **State Management**: Zustand hoặc Redux Toolkit
- **Routing**: React Router v6
- **Drag & Drop**: @dnd-kit/core
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Real-time**: Socket.io-client

## Backend
- **Runtime**: Node.js + Express.js
- **Database**: MySQL + mysql2 (hoặc Sequelize)
- **Auth**: JWT + bcryptjs + express-validator
- **Real-time**: Socket.io
- **File Upload**: Multer (nếu cần attach file)
- **Environment**: dotenv
- **Logging**: Winston hoặc Morgan
- **Testing**: Jest + Supertest

## DevOps & Tools
- **Version Control**: Git + GitHub
- **Package Manager**: npm / pnpm
- **Linting**: ESLint + Prettier
- **Deployment**: Vercel (Frontend), Render / Railway / AWS (Backend + DB)
- **CI/CD**: GitHub Actions

## Lý do chọn
- React + Tailwind: Phát triển UI nhanh, đẹp
- MySQL: Relational database, dễ quản lý quan hệ giữa Project - Task - User
- Node/Express: Full JS stack, dễ maintain

Xem **PROJECT_STRUCTURE.md** để biết cách tổ chức thư mục.