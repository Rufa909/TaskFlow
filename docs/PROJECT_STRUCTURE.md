# Cấu trúc Dự án

## Root
```
task-management-system/
├── backend/
├── frontend/
├── README.md
├── docs/          # Các file markdown này
└── .gitignore
```

## Backend Structure
```
backend/
├── src/
│   ├── config/         # db.js, jwt.js
│   ├── controllers/    # project.controller.js, task.controller.js
│   ├── middleware/     # auth.js, errorHandler.js
│   ├── models/         # User.js, Project.js, Task.js
│   ├── routes/         # auth.routes.js, project.routes.js
│   ├── utils/          # socket.js
│   └── server.js
├── .env
├── package.json
└── nodemon.json
```

## Frontend Structure
```
frontend/
├── src/
│   ├── assets/
│   ├── components/     # TaskCard, BoardColumn, Modal...
│   ├── pages/          # Dashboard, ProjectView, Login...
│   ├── store/          # Zustand stores
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

Tạo thư mục theo cấu trúc này để dễ maintain.