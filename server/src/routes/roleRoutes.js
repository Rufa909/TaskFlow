const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getMyRole,
  requestTaskAssignment,
  getAssignmentRequests,
  reviewAssignmentRequest,
  submitTask,
  getSubmissions,
  reviewSubmission,
  getPendingCount,
  getInboxApprovals,
} = require('../controllers/roleController');

// Role của user trong project
router.get('/projects/:projectId/my-role', auth, getMyRole);

// Pending count (badge cho owner)
router.get('/pending-count/:projectId', auth, getPendingCount);

// Toàn bộ yêu cầu chờ duyệt của các project do user làm Owner cho trang Inbox
router.get('/inbox-approvals', auth, getInboxApprovals);

// Assignment requests (leader → member, owner duyệt)
router.post('/assignment-request', auth, requestTaskAssignment);
router.get('/assignment-requests/:projectId', auth, getAssignmentRequests);
router.put('/assignment-requests/:requestId', auth, reviewAssignmentRequest);

// Task submissions (member nộp, owner duyệt)
router.post('/submit-task/:taskId', auth, submitTask);
router.get('/submissions/:projectId', auth, getSubmissions);
router.put('/submissions/:submissionId', auth, reviewSubmission);

module.exports = router;
