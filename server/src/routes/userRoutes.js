const express = require('express');
const router = express.Router();

const { updateAvatar, upload } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.post(
  '/avatar', 
  authMiddleware,
  upload.single('avatar'), 
  updateAvatar
);

module.exports = router;