const pool = require('./src/config/db');

async function addColumnIfMissing(table, column, definition) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ ${table}.${column} added`);
  } else {
    console.log(`✅ ${table}.${column} already exists`);
  }
}

async function fixSchema() {
  try {
    // 1. Thêm deleted_at vào projects
    await addColumnIfMissing('projects', 'deleted_at', 'DATETIME NULL');

    // 2. Thêm email_verified vào users
    await addColumnIfMissing('users', 'email_verified', 'TINYINT(1) DEFAULT 0');

    // 3. Đổi role ENUM trong project_members để thêm 'leader'
    const [cols] = await pool.query("SHOW COLUMNS FROM project_members LIKE 'role'");
    const currentType = cols[0] ? cols[0].Type : '';
    console.log('project_members.role current type:', currentType);
    if (!currentType.includes('leader')) {
      await pool.query("ALTER TABLE project_members MODIFY COLUMN role ENUM('owner','leader','member') DEFAULT 'member'");
      console.log('✅ project_members.role updated to include leader');
    } else {
      console.log('✅ project_members.role already has leader');
    }

    // 4. Tạo bảng task_assignment_requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_assignment_requests (
        request_id   INT AUTO_INCREMENT PRIMARY KEY,
        task_id      INT NOT NULL,
        project_id   INT NOT NULL,
        assigned_to  INT NOT NULL,
        requested_by INT NOT NULL,
        status       ENUM('pending','approved','rejected') DEFAULT 'pending',
        note         TEXT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at  DATETIME NULL,
        reviewed_by  INT NULL,
        FOREIGN KEY (task_id)      REFERENCES tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY (project_id)   REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to)  REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX (project_id),
        INDEX (status)
      )
    `);
    console.log('✅ task_assignment_requests OK');

    // 5. Tạo bảng task_submissions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_submissions (
        submission_id INT AUTO_INCREMENT PRIMARY KEY,
        task_id       INT NOT NULL,
        project_id    INT NOT NULL,
        submitted_by  INT NOT NULL,
        status        ENUM('pending','approved','rejected') DEFAULT 'pending',
        note          TEXT NULL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at   DATETIME NULL,
        reviewed_by   INT NULL,
        FOREIGN KEY (task_id)      REFERENCES tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY (project_id)   REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX (project_id),
        INDEX (status)
      )
    `);
    console.log('✅ task_submissions OK');

    // 6. Thêm assignment_status vào tasks
    await addColumnIfMissing('tasks', 'assignment_status', "ENUM('none','pending','approved','rejected') DEFAULT 'none'");

    // 7. Tạo bảng team_invitations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        invitation_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id    INT NOT NULL,
        sender_id     INT NOT NULL,
        receiver_id   INT NOT NULL,
        status        ENUM('pending','accepted','declined') DEFAULT 'pending',
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id)  REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id)   REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE KEY unique_invitation (project_id, sender_id, receiver_id)
      )
    `);
    console.log('✅ team_invitations OK');

    console.log('\n🎉 Schema fix hoàn tất! Restart server là dùng được.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixSchema();
