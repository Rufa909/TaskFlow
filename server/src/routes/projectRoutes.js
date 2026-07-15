const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { getProjects, createProject, deleteProject, updateProject } = require('../controllers/projectController');
const {
  getProjectMessages,
  createProjectMessage,
} = require('../controllers/projectChatController');

// Tất cả route projects đều cần đăng nhập
router.get('/', auth, getProjects);
router.post('/', auth, createProject);
router.get('/:projectId/messages', auth, getProjectMessages);
router.post('/:projectId/messages', auth, createProjectMessage);
router.delete('/:id', auth, deleteProject);

// update project name
router.put('/:id', auth, updateProject);

module.exports = router;
