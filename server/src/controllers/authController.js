const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const getPublicUser = (user) => ({
    id: user.user_id,
    username: user.username,
    email: user.email,
    user_photo: user.user_photo,
    email_verified: Boolean(user.email_verified),
    auth_provider: user.auth_provider || 'local',
    created_at: user.created_at
});

const ensureEmailVerificationColumns = async () => {
    const [columns] = await pool.query(
        `SHOW COLUMNS FROM users WHERE Field IN (
            'email_verified',
            'email_verification_token_hash',
            'email_verification_expires'
        )`
    );
    const existing = new Set(columns.map((column) => column.Field));

    if (!existing.has('email_verified')) {
        await pool.query('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!existing.has('email_verification_token_hash')) {
        await pool.query('ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR(64) NULL');
    }
    if (!existing.has('email_verification_expires')) {
        await pool.query('ALTER TABLE users ADD COLUMN email_verification_expires DATETIME NULL');
    }
};

const getMailTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Missing EMAIL_USER or EMAIL_PASS');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Hàm tạo JWT Token
// Payload: thông tin lưu trong token (KHÔNG lưu password!)
// Token sẽ hết hạn sau thời gian trong .env
const createToken = (user) => {
    return jwt.sign(
        {
            id: user.user_id || user.id,  // hỗ trợ cả 2 trường hợp
            username: user.username,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN
        }
    )
}

// POST /api/auth/register
// Luồng: validate → kiểm tra email tồn tại → hash password → lưu DB → trả token
exports.register = async (req, res) => {
    const {username, email, password} = req.body;
    // Bước 1: Kiểm tra dữ liệu đầu vào
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Vui long dien day du thong tin!'
        });
    }
    // Kiểm tra định dạng email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success:false,
            message: 'email ko hop le'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Mat khau phai hon 6 ky tu'
        });
    }

    try {
        // Bước 2: Kiểm tra email đã tồn tại trong DB chưa
        // pool.query trả về [rows, fields] nên dùng destructuring [rows]
        const [existingUser] = await pool.query('select * from users where email = ?', [email]); // dùng ? và truyền riêng để tránh SQL Injection
        if (existingUser.length > 0){
            return res.status(409).json({
                success: false,
                message: 'Email da duoc su dung'
            });
        }
        // Bước 3: Hash password trước khi lưu
        // Salt rounds = 10: càng cao càng an toàn nhưng càng chậm
        const hashedPassword = await bcrypt.hash(password, 10);
        // Bước 4: Lưu user vào database
        const [result] = await pool.query('insert into users (username, email, password) values (?, ?, ?)', [username, email, hashedPassword]);
        // Bước 4b: Tự động tạo project mặc định "Project1" cho user mới
        await pool.query('INSERT INTO projects (owner_id, name) VALUES (?, ?)', [result.insertId, 'Project1']);
        // Bước 5: Lấy lại thông tin user vừa tạo (không lấy password)
        const [rows] = await pool.query('select user_id, username, email, created_at from users where user_id = ?', [result.insertId]);
        const newUser = rows[0];
        // Bước 6: Tạo token và trả về client
        const token = createToken(newUser);
        return res.status(201).json({
            success: true,
            message: 'Dang ky thanh cong',
            token, // client lưu token này vào localStorage
            user: getPublicUser(newUser)
        });
    } catch (err) {
        console.error('Loi dang ky:', err);
        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra, vui long thu lai sau!'
        });
    }
};

// POST /api/auth/login
// Luồng: validate → tìm user → so password → tạo token → trả về
exports.login = async (req, res) => {
    const {email, password} = req.body;
    // Bước 1: Validate input
    if (!email || !password){
        return res.status(400).json({
            success: false,
            message: 'Vui long dien day du thong tin!'
        });
    }

    try {
         // Bước 2: Tìm user theo email
        const [rows] = await pool.query('select * from users where email = ?', [email]);
        // Không nên nói rõ "email không tồn tại" vì lý do bảo mật
        if (rows.length === 0){
            return res.status(401).json({
                success: false,
                message: 'Email hoac mat khau khong chinh xac!'
            });
        }

        const user = rows[0];
        // Bước 3: So sánh password người dùng nhập với hash trong DB
        // bcrypt.compare() tự động xử lý salt nên không cần làm thủ công
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch){
            return res.status(401).json({
                success: false,
                message: 'Email hoac mat khau khong chinh xac!'
            });
        }
        // Bước 4: Tạo JWT token
        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: 'Dang nhap thanh cong',
            token,
            user: getPublicUser(user)
        });
    } catch (err){
        console.error('Loi dang nhap:', err);
        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra, vui long thu lai sau!'
        });
    }
}
// GET /api/auth/me  (cần token)
// Dùng để frontend kiểm tra token còn hợp lệ không khi reload trang
exports.getMe = async (req, res) => {
    try {
        // req.user đã được authMiddleware gắn vào từ token
        const [rows] = await pool.query('select * from users where user_id = ?', [req.user.id]);

        if (rows.length === 0){
            return res.status(404).json({
                success: false,
                message: 'User khong ton tai!'
            });
        }
        res.json({
            success: true,
            user: getPublicUser(rows[0])
        });
    } catch (err){
        console.error('Loi getMe:', err);
        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra, vui long thu lai sau!'
        });
    }
};

exports.updateAvatar = async (req, res) => {
    const { image } = req.body;
    const match = image?.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);

    if (!match) {
        return res.status(400).json({
            success: false,
            message: 'Anh khong hop le!'
        });
    }

    const imageBuffer = Buffer.from(match[2], 'base64');
    if (imageBuffer.length > 4 * 1024 * 1024) {
        return res.status(400).json({
            success: false,
            message: 'Anh phai nho hon 4MB!'
        });
    }

    try {
        const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        const uploadsDir = path.resolve(__dirname, '../../uploads/avatars');
        const fileName = `user-${req.user.id}-${Date.now()}.${extension}`;
        const publicPath = `/uploads/avatars/${fileName}`;

        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.writeFile(path.join(uploadsDir, fileName), imageBuffer);

        await pool.query(
            'update users set user_photo = ? where user_id = ?',
            [publicPath, req.user.id]
        );

        const [rows] = await pool.query('select * from users where user_id = ?', [req.user.id]);
        const user = rows[0];

        return res.json({
            success: true,
            user: getPublicUser(user)
        });
    } catch (err) {
        console.error('Loi update avatar:', err);
        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra, vui long thu lai sau!'
        });
    }
};
// UPDATE USERNAME
async function getUsernameSuggestions(username, userId) {
    const base = username.trim();
    const candidates = Array.from({ length: 20 }, (_, index) => `${base}${index + 1}`);
    const placeholders = candidates.map(() => '?').join(',');

    const [rows] = await pool.query(
        `SELECT username FROM users WHERE user_id <> ? AND LOWER(username) IN (${placeholders})`,
        [userId, ...candidates.map((candidate) => candidate.toLowerCase())]
    );

    const taken = new Set(rows.map((row) => String(row.username).toLowerCase()));
    return candidates
        .filter((candidate) => !taken.has(candidate.toLowerCase()))
        .slice(0, 3);
}

exports.updateUsername = async (req, res) => {
    const { username } = req.body;
    const nextUsername = username?.trim();

    // Validate
    if (!nextUsername || nextUsername.length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Tên phải có ít nhất 2 ký tự'
        });
    }

    try {
        const [existingUsers] = await pool.query(
            'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id <> ? LIMIT 1',
            [nextUsername, req.user.id]
        );

        if (existingUsers.length > 0) {
            const suggestions = await getUsernameSuggestions(nextUsername, req.user.id);

            return res.status(409).json({
                success: false,
                message: 'Ten nay da duoc su dung. Vui long chon ten khac.',
                suggestions
            });
        }

        // Update DB
        await pool.query(
            'UPDATE users SET username = ? WHERE user_id = ?',
            [nextUsername, req.user.id]
        );

        // Lấy user mới
        const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.user.id]);

        const user = rows[0];

        return res.json({
            success: true,
            message: 'Cap nhat ten thanh cong',
            user: getPublicUser(user)
        });

    } catch (err) {
        console.error('Loi update username:', err);

        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra'
        });
    }
};
exports.updateEmail = async (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Changing email is disabled.'
    });
};

exports.sendVerificationEmail = async (req, res) => {
    try {
        await ensureEmailVerificationColumns();

        const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User khong ton tai'
            });
        }

        const user = rows[0];
        if (user.email_verified) {
            return res.json({
                success: true,
                message: 'Email nay da duoc xac thuc.',
                user: getPublicUser(user)
            });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await pool.query(
            `UPDATE users
             SET email_verification_token_hash = ?,
                 email_verification_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR)
             WHERE user_id = ?`,
            [tokenHash, req.user.id]
        );

        const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
        const verifyUrl = `${apiBaseUrl}/api/auth/verify-email?token=${token}`;
        const transporter = getMailTransporter();

        await transporter.sendMail({
            from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Xac thuc email TaskFlow',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
                    <h2>Xac thuc tai khoan TaskFlow</h2>
                    <p>Chao ${user.username || 'ban'},</p>
                    <p>Bam vao nut ben duoi de xac thuc email cua tai khoan. Link co hieu luc trong 1 gio.</p>
                    <p>
                        <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">
                            Xac thuc email
                        </a>
                    </p>
                    <p>Neu nut khong hoat dong, copy link nay vao trinh duyet:</p>
                    <p>${verifyUrl}</p>
                </div>
            `
        });

        return res.json({
            success: true,
            message: 'Sent verification email. Please check your inbox.',
        });
    } catch (err) {
        console.error('Loi gui email xac thuc:', err);
        return res.status(500).json({
            success: false,
            message: 'cant send verification email, please try again later.'
        });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.query;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (!token) {
        return res.redirect(`${clientUrl}/?emailVerified=invalid`);
    }

    try {
        await ensureEmailVerificationColumns();

        const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
        const [rows] = await pool.query(
            `SELECT * FROM users
             WHERE email_verification_token_hash = ?
               AND email_verification_expires > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.redirect(`${clientUrl}/?emailVerified=invalid`);
        }

        await pool.query(
            `UPDATE users
             SET email_verified = 1,
                 email_verification_token_hash = NULL,
                 email_verification_expires = NULL
             WHERE user_id = ?`,
            [rows[0].user_id]
        );

        return res.redirect(`${clientUrl}/?emailVerified=success`);
    } catch (err) {
        console.error('Loi xac thuc email:', err);
        return res.redirect(`${clientUrl}/?emailVerified=error`);
    }
};
exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Validate
    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Vui long nhap day du thong tin'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Mat khau moi phai co it nhat 6 ky tu'
        });
    }

    try {
        // Lấy user hiện tại
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE user_id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User khong ton tai'
            });
        }

        const user = rows[0];

        // Kiểm tra password cũ
        if (user.auth_provider === 'google') {
            return res.status(403).json({
                success: false,
                message: 'Tai khoan Google khong the doi mat khau trong ung dung'
            });
        }

        const isMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Mat khau hien tai khong dung'
            });
        }

        // Hash password mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update DB
        await pool.query(
            'UPDATE users SET password = ? WHERE user_id = ?',
            [hashedPassword, req.user.id]
        );

        return res.json({
            success: true,
            message: 'Cap nhat mat khau thanh cong'
        });

    } catch (err) {
        console.error('Loi update password:', err);

        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra'
        });
    }
};
exports.googleLogin = async (req, res) => {
  const { credential, accessToken } = req.body;

  if (!credential && !accessToken) {
    return res.status(400).json({ success: false, message: 'Missing Google credential' });
  }

  try {
    let payload;

    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } else {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!googleRes.ok) {
        return res.status(401).json({ success: false, message: 'Google login failed' });
      }

      payload = await googleRes.json();
    }

    const email = payload.email;
    const username = payload.name || email.split('@')[0];
    const photo = payload.picture || null;

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    let user = rows[0];

    if (!user) {
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

      const [result] = await pool.query(
        'INSERT INTO users (username, email, password, user_photo, email_verified, auth_provider) VALUES (?, ?, ?, ?, 1, ?)',
        [username, email, randomPassword, photo, 'google']
      );

      await pool.query('INSERT INTO projects (owner_id, name) VALUES (?, ?)', [result.insertId, 'Project1']);

      const [newRows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
      user = newRows[0];
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: 'Dang nhap Google thanh cong',
      token,
      user: getPublicUser(user)
    });
  } catch (err) {
    console.error('Loi Google login:', err);
    return res.status(401).json({ success: false, message: 'Google login failed' });
  }
};
