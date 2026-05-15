const express = require('express');
const router = express.Router();

const { updateAvatar, upload } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');   // ← Đúng tên file

// Route upload avatar
router.post(
  '/avatar', 
  authMiddleware,                    // Sử dụng middleware
  upload.single('avatar'), 
  updateAvatar
);

module.exports = router;