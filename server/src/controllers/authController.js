const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Hàm tạo JWT Token
// Payload: thông tin lưu trong token (KHÔNG lưu password!)
// Token sẽ hết hạn sau thời gian trong .env
const createToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
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