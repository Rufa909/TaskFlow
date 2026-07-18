const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getProjects, createProject, deleteProject, updateProject } = require('../controllers/projectController');
const {
  getProjectChatOverview,
  getProjectMessages,
  getConversationMessages,
  createProjectMessage,
  createConversation,
  addProjectMember,
  getProjectMemberCandidates,
  removeProjectMember,
  addConversationMember,
  getConversationMemberCandidates,
  removeConversationMember,
  disbandConversation,
  updateConversationMemberRole,
} = require('../controllers/projectChatController');

// Tất cả route projects đều cần đăng nhập
router.get('/', auth, getProjects);
router.post('/', auth, createProject);
router.get('/:projectId/chat', auth, getProjectChatOverview);
router.get('/:projectId/messages', auth, getProjectMessages);
router.post('/:projectId/messages', auth, upload.single('attachment'), createProjectMessage);
router.get('/:projectId/conversations/:conversationId/messages', auth, getConversationMessages);
router.post('/:projectId/conversations', auth, createConversation);
router.get('/:projectId/member-candidates', auth, getProjectMemberCandidates);
router.post('/:projectId/members', auth, addProjectMember);
router.delete('/:projectId/members/:userId', auth, removeProjectMember);
router.get('/:projectId/conversations/:conversationId/member-candidates', auth, getConversationMemberCandidates);
router.post('/:projectId/conversations/:conversationId/members', auth, addConversationMember);
router.delete('/:projectId/conversations/:conversationId/members/:userId', auth, removeConversationMember);
router.patch('/:projectId/conversations/:conversationId/disband', auth, disbandConversation);
router.put('/:projectId/conversations/:conversationId/members/:userId/role', auth, updateConversationMemberRole);
router.delete('/:id', auth, deleteProject);

// update project name
router.put('/:id', auth, updateProject);

module.exports = router;
