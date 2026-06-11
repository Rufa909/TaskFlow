const express = require('express');
const router = express.Router();

// Import controller và middleware
const workflowController = require('../controllers/workflowController');

// Import middleware bảo vệ route (trả về function)
const protect = require('../middleware/authMiddleware');

// Định nghĩa routes
router.get('/projects/:projectId/workflow', protect, workflowController.getProjectWorkflow);
router.post('/projects/:projectId/stages/next', protect, workflowController.moveNextStage);
router.post('/projects/:projectId/stages/previous', protect, workflowController.movePreviousStage);

module.exports = router;