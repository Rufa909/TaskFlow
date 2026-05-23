const router = require('express').Router();

// Import controller (xử lý logic)
const {
  register,
  login,
  googleLogin,
  getMe,
  updateAvatar,
  updateUsername,
  updateEmail,
  updatePassword,
  sendVerificationEmail,
  verifyEmail
} = require('../controllers/authController');
// Import middleware (bảo vệ route)
const auth = require('../middleware/authMiddleware');

// ─── Public routes (không cần token) ──────────────
// POST /api/auth/register → tạo tài khoản mới
router.post('/register', register);
router.post('/google', googleLogin);
// POST /api/auth/login → đăng nhập, nhận token
router.post('/login', login);
router.get('/verify-email', verifyEmail);

// ─── Protected routes (cần token) ─────────────────
// GET /api/auth/me → auth chạy trước, nếu pass mới vào getMe
router.get('/me', auth, getMe);
router.put('/avatar', auth, updateAvatar);
router.put('/username', auth, updateUsername);
router.put('/email', auth, updateEmail);
router.put('/password', auth, updatePassword);
router.post('/send-verification-email', auth, sendVerificationEmail);

module.exports = router;
