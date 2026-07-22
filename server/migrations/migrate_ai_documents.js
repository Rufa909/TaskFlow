const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const sql = `
  CREATE TABLE IF NOT EXISTS ai_documents (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_type   VARCHAR(20)  NOT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    chunk_text  TEXT NOT NULL,
    embedding   MEDIUMTEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_user_file (user_id, file_name)
  )
`;

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });
  await pool.query(sql);
  console.log('✅ Created ai_documents table');
  await pool.end();
}
run().catch(err => { console.error('❌', err.message); process.exit(1); });
