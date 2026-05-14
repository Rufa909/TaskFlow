const express = require('express');
const router = express.Router();
const { getTasks, createTask, deleteTask } = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

// The route prefix in app.js will be /api
// These routes need the project ID in the path
router.get('/projects/:projectId/tasks', authMiddleware, getTasks);
router.post('/projects/:projectId/tasks', authMiddleware, createTask);
router.delete('/projects/:projectId/tasks/:taskId', authMiddleware, deleteTask);

module.exports = router;
