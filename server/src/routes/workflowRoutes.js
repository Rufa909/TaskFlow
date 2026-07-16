const express = require('express');
const router = express.Router();

// Import controller và middleware
const workflowController = require('../controllers/workflowController');
const upload = require('../middleware/uploadMiddleware');

// Import middleware bảo vệ route (trả về function)
const protect = require('../middleware/authMiddleware');

// Định nghĩa routes
router.get('/projects/:projectId/workflow', protect, workflowController.getProjectWorkflow);
router.get('/projects/:projectId/stages/:stageId/overview', protect, workflowController.getStageOverview);
router.get('/projects/:projectId/stages/:stageId/documents', protect, workflowController.getDocuments);
router.post('/projects/:projectId/stages/:stageId/documents', protect, upload.single('document'), workflowController.createDocument);
router.get('/projects/:projectId/stages/:stageId/discussions', protect, workflowController.getDiscussions);
router.post('/projects/:projectId/stages/:stageId/discussions', protect, workflowController.createDiscussion);
router.get('/projects/:projectId/stages/:stageId/decisions', protect, workflowController.getDecisions);
router.post('/projects/:projectId/stages/:stageId/decisions', protect, workflowController.createDecision);
router.get('/projects/:projectId/stages/:stageId/handover', protect, workflowController.getHandover);
router.post('/projects/:projectId/stages/:stageId/handover', protect, workflowController.upsertHandover);
router.get('/projects/:projectId/stages/:stageId/deliverables', protect, workflowController.getDeliverables);
router.post('/projects/:projectId/stages/:stageId/deliverables', protect, workflowController.createDeliverable);
router.post('/projects/:projectId/stages/:stageId/complete', protect, workflowController.completeStage);
router.post('/projects/:projectId/stages/next', protect, workflowController.moveNextStage);
router.post('/projects/:projectId/stages/previous', protect, workflowController.movePreviousStage);

module.exports = router;
