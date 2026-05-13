const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Client gửi token trong header dạng: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    // Tách lấy phần token (bỏ chữ "Bearer ")
    const token = authHeader && authHeader.split(' ')[1];
    // Không có token → từ chối truy cập
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Chua dang nhap, vui long cung cap token!'
        });
    }

    try {
        // jwt.verify() giải mã token bằng SECRET_KEY
        // Nếu token giả mạo hoặc hết hạn → ném ra lỗi
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Gắn thông tin user vào req để controller sử dụng
        // decoded chứa: { id, username, email, iat, exp }
        req.user = decoded;
        // Gọi next() để tiếp tục xử lý sang controller
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Token ko hop le!'
        });
    }
};

module.exports = authMiddleware;