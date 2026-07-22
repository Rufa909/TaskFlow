const express = require('express');
const router = express.Router();

// Import controller và middleware
const workflowController = require('../controllers/workflowController');
const upload = require('../middleware/uploadMiddleware');
const { MAX_UPLOAD_SIZE_MB } = upload;

// Import middleware bảo vệ route (trả về function)
const protect = require('../middleware/authMiddleware');

function uploadDocument(req, res, next) {
  upload.single('document')(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File vượt quá dung lượng tối đa ${MAX_UPLOAD_SIZE_MB}MB`,
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Không thể upload file',
    });
  });
}

// Định nghĩa routes
router.get('/projects/:projectId/workflow', protect, workflowController.getProjectWorkflow);
router.get('/projects/:projectId/stages/:stageId/overview', protect, workflowController.getStageOverview);
router.get('/projects/:projectId/stages/:stageId/documents', protect, workflowController.getDocuments);
router.post('/projects/:projectId/stages/:stageId/documents', protect, uploadDocument, workflowController.createDocument);
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
