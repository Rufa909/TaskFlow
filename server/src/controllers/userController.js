const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Cấu hình Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh!'), false);
  }
});

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file ảnh" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy user" });
    }

    // Cập nhật vào database
    const [result] = await db.execute(
      'UPDATE users SET user_photo = ? WHERE user_id = ?',
      [avatarUrl, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    console.log(`✅ Avatar updated successfully for user ${userId}`);

    res.json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatarUrl: avatarUrl
    });

  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật avatar" });
  }
};

module.exports = {
  updateAvatar,
  upload
};