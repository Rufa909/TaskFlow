const express = require("express");
const router = express.Router();
const {
  getTasks,
  createTask,
  deleteTask,
  updateTask,
  getTasksToday,
  getTaskCounts,
} = require("../controllers/taskController");
const authMiddleware = require("../middleware/authMiddleware");

// The route prefix in app.js will be /api
router.get("/tasks/today", authMiddleware, getTasksToday);
router.get("/tasks/counts", authMiddleware, getTaskCounts);

// These routes need the project ID in the path
router.get("/projects/:projectId/tasks", authMiddleware, getTasks);
router.post("/projects/:projectId/tasks", authMiddleware, createTask);
router.delete("/projects/:projectId/tasks/:taskId", authMiddleware, deleteTask);
router.put("/projects/:projectId/tasks/:taskId", authMiddleware, updateTask);

module.exports = router;

