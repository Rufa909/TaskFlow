const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { getProjects, createProject, deleteProject } = require('../controllers/projectController');

// Tất cả route projects đều cần đăng nhập
router.get('/', auth, getProjects);
router.post('/', auth, createProject);
router.delete('/:id', auth, deleteProject);

module.exports = router;
