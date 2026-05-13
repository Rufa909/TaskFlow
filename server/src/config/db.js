// Dùng mysql2/promise để hỗ trợ async/await thay vì callback
const mysql = require('mysql2/promise');
require('dotenv').config();

// createPool giúp tái sử dụng connection thay vì tạo mới mỗi request
// → tiết kiệm tài nguyên, tăng hiệu suất
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,  // hàng đợi khi hết connection
  connectionLimit: 10,       // tối đa 10 connection song song
  queueLimit: 0              // 0 = không giới hạn hàng đợi
});

// Test kết nối ngay khi server khởi động
pool.getConnection()
  .then(conn => {
    console.log('✅ Kết nối MySQL thành công');
    conn.release(); // trả connection về pool sau khi test
  })
  .catch(err => {
    console.error('❌ Kết nối MySQL thất bại:', err.message);
    process.exit(1); // dừng server nếu không kết nối được DB
  });

module.exports = pool;