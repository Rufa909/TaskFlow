const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { getProjects, createProject, deleteProject, updateProject } = require('../controllers/projectController');

// Tất cả route projects đều cần đăng nhập
router.get('/', auth, getProjects);
router.post('/', auth, createProject);
router.delete('/:id', auth, deleteProject);

// update project name
router.put('/:id', auth, updateProject);

module.exports = router;
