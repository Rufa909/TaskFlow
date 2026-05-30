const express = require("express");
const router = express.Router();
const {
  getTasks,
  createTask,
  deleteTask,
  updateTask,
  getTasksToday,
  getTaskCounts,
  getTaskCountsByProject,
  getAllTasks,
  completeTask,
  getCompletedTasks,
  requestTaskAssignment,
  getTaskAssignmentRequests,
  reviewTaskAssignmentRequest,
  getTaskSubmissions,
  reviewTaskSubmission,
  checkOverdueTasksNow,
} = require("../controllers/taskController");

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

function uploadAttachment(req, res, next) {
  upload.single("attachment")(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File vượt quá dung lượng tối đa 5MB",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Không thể upload file",
    });
  });
}
// The route prefix in app.js will be /api
router.get("/tasks/today", authMiddleware, getTasksToday);
router.get("/tasks/counts", authMiddleware, getTaskCounts);
router.get("/tasks/counts/projects", authMiddleware, getTaskCountsByProject);
router.get("/tasks", authMiddleware, getAllTasks);
router.get("/tasks/completed", authMiddleware, getCompletedTasks);
router.post("/tasks/overdue/check", authMiddleware, checkOverdueTasksNow);
router.get("/projects/:projectId/tasks", authMiddleware, getTasks);
router.get("/projects/:projectId/task-assignment-requests", authMiddleware, getTaskAssignmentRequests);
router.put("/projects/:projectId/task-assignment-requests/:requestId", authMiddleware, reviewTaskAssignmentRequest);
router.get("/projects/:projectId/task-submissions", authMiddleware, getTaskSubmissions);
router.put("/projects/:projectId/task-submissions/:submissionId", authMiddleware, reviewTaskSubmission);
// These routes need the project ID in the path

router.post("/projects/:projectId/tasks", authMiddleware, uploadAttachment, createTask);
router.post("/projects/:projectId/tasks/:taskId/complete", authMiddleware, completeTask);
router.post("/projects/:projectId/tasks/:taskId/submit", authMiddleware, completeTask);
router.post("/projects/:projectId/tasks/:taskId/assign", authMiddleware, requestTaskAssignment);

router.delete("/projects/:projectId/tasks/:taskId", authMiddleware, deleteTask);

router.put("/projects/:projectId/tasks/:taskId", authMiddleware, uploadAttachment, updateTask);

module.exports = router;
