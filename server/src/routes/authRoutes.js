const router = require('express').Router();

// Import controller (xử lý logic)
const { register, login, getMe } = require('../controllers/authController');

// Import middleware (bảo vệ route)
const auth = require('../middleware/authMiddleware');

// ─── Public routes (không cần token) ──────────────
// POST /api/auth/register → tạo tài khoản mới
router.post('/register', register);

// POST /api/auth/login → đăng nhập, nhận token
router.post('/login', login);

// ─── Protected routes (cần token) ─────────────────
// GET /api/auth/me → auth chạy trước, nếu pass mới vào getMe
router.get('/me', auth, getMe);

module.exports = router;