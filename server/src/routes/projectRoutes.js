const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { MAX_UPLOAD_SIZE_MB } = upload;
const { getProjects, createProject, deleteProject, updateProject } = require('../controllers/projectController');
const {
  getProjectChatOverview,
  getDirectConversations,
  getGroupConversations,
  searchGlobalChatUsers,
  createDirectConversation,
  createGroupConversation,
  getProjectMessages,
  getConversationMessages,
  getDirectConversationMessages,
  getGroupConversationMessages,
  clearDirectConversationMessages,
  clearGroupConversationMessages,
  removeDirectConversationForMe,
  removeGroupConversationForMe,
  createProjectMessage,
  createDirectConversationMessage,
  createGroupConversationMessage,
  createConversation,
  addProjectMember,
  getProjectMemberCandidates,
  searchProjectChatUsers,
  removeProjectMember,
  addGlobalGroupMember,
  getGlobalGroupMemberCandidates,
  removeGlobalGroupMember,
  disbandGlobalGroup,
  addConversationMember,
  getConversationMemberCandidates,
  removeConversationMember,
  disbandConversation,
  updateConversationMemberRole,
} = require('../controllers/projectChatController');

function uploadChatAttachment(req, res, next) {
  upload.single('attachment')(req, res, (err) => {
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

// Tất cả route projects đều cần đăng nhập
router.get('/', auth, getProjects);
router.post('/', auth, createProject);
router.get('/chat/direct-conversations', auth, getDirectConversations);
router.post('/chat/direct-conversations', auth, createDirectConversation);
router.get('/chat/direct-conversations/:conversationId/messages', auth, getDirectConversationMessages);
router.post('/chat/direct-conversations/:conversationId/messages', auth, uploadChatAttachment, createDirectConversationMessage);
router.delete('/chat/direct-conversations/:conversationId/messages', auth, clearDirectConversationMessages);
router.delete('/chat/direct-conversations/:conversationId', auth, removeDirectConversationForMe);
router.get('/chat/group-conversations', auth, getGroupConversations);
router.post('/chat/group-conversations', auth, createGroupConversation);
router.get('/chat/group-conversations/:conversationId/messages', auth, getGroupConversationMessages);
router.post('/chat/group-conversations/:conversationId/messages', auth, uploadChatAttachment, createGroupConversationMessage);
router.delete('/chat/group-conversations/:conversationId/messages', auth, clearGroupConversationMessages);
router.get('/chat/group-conversations/:conversationId/member-candidates', auth, getGlobalGroupMemberCandidates);
router.post('/chat/group-conversations/:conversationId/members', auth, addGlobalGroupMember);
router.delete('/chat/group-conversations/:conversationId/members/:userId', auth, removeGlobalGroupMember);
router.patch('/chat/group-conversations/:conversationId/disband', auth, disbandGlobalGroup);
router.delete('/chat/group-conversations/:conversationId', auth, removeGroupConversationForMe);
router.get('/chat/user-search', auth, searchGlobalChatUsers);
router.get('/:projectId/chat', auth, getProjectChatOverview);
router.get('/:projectId/messages', auth, getProjectMessages);
router.post('/:projectId/messages', auth, uploadChatAttachment, createProjectMessage);
router.get('/:projectId/conversations/:conversationId/messages', auth, getConversationMessages);
router.post('/:projectId/conversations', auth, createConversation);
router.get('/:projectId/member-candidates', auth, getProjectMemberCandidates);
router.get('/:projectId/chat-user-search', auth, searchProjectChatUsers);
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
