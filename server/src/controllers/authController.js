const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');

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
            user: {
                id: newUser.user_id,
                username: newUser.username,
                email: newUser.email,
                created_at: newUser.created_at
            }
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
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                user_photo: user.user_photo,
                created_at: user.created_at
            }
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
            user: rows[0]
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

        const [rows] = await pool.query(
            'select user_id, username, email, user_photo, created_at from users where user_id = ?',
            [req.user.id]
        );
        const user = rows[0];

        return res.json({
            success: true,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                user_photo: user.user_photo,
                created_at: user.created_at
            }
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
exports.updateUsername = async (req, res) => {
    const { username } = req.body;

    // Validate
    if (!username || username.trim().length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Tên phải có ít nhất 2 ký tự'
        });
    }

    try {
        // Update DB
        await pool.query(
            'UPDATE users SET username = ? WHERE user_id = ?',
            [username.trim(), req.user.id]
        );

        // Lấy user mới
        const [rows] = await pool.query(
            'SELECT user_id, username, email, user_photo, created_at FROM users WHERE user_id = ?',
            [req.user.id]
        );

        const user = rows[0];

        return res.json({
            success: true,
            message: 'Cap nhat ten thanh cong',
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                user_photo: user.user_photo,
                created_at: user.created_at
            }
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
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email khong duoc de trong'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Email khong hop le'
        });
    }

    try {
        // Check email tồn tại
        const [existingUser] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND user_id != ?',
            [email, req.user.id]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email da duoc su dung'
            });
        }

        // Update email
        await pool.query(
            'UPDATE users SET email = ? WHERE user_id = ?',
            [email, req.user.id]
        );

        // Lấy user mới
        const [rows] = await pool.query(
            'SELECT user_id, username, email, user_photo, created_at FROM users WHERE user_id = ?',
            [req.user.id]
        );

        const user = rows[0];

        return res.json({
            success: true,
            message: 'Cap nhat email thanh cong',
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                user_photo: user.user_photo,
                created_at: user.created_at
            }
        });

    } catch (err) {
        console.error('Loi update email:', err);

        return res.status(500).json({
            success: false,
            message: 'Co loi xay ra'
        });
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