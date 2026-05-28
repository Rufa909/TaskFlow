const pool = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureRoleTables() {
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

  // Ensure assignment_status column on tasks
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tasks'
      AND COLUMN_NAME = 'assignment_status'
  `);
  if (cols.length === 0) {
    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN assignment_status ENUM('none','pending','approved','rejected') DEFAULT 'none'
    `);
  }
}

// Get user's role in a project ('owner' | 'leader' | 'member' | null)
async function getUserRole(userId, projectId) {
  // Check if owner
  const [[project]] = await pool.query(
    'SELECT owner_id FROM projects WHERE project_id = ? AND deleted_at IS NULL',
    [projectId]
  );
  if (!project) return null;
  if (project.owner_id === userId) return 'owner';

  // Check project_members role
  const [[member]] = await pool.query(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId]
  );
  return member ? member.role : null;
}

// ─── Get current user's role in a project ────────────────────────────────────
// GET /api/roles/projects/:projectId/my-role
exports.getMyRole = async (req, res) => {
  try {
    const { projectId } = req.params;
    const role = await getUserRole(req.user.id, projectId);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Bạn không phải thành viên của project này' });
    }
    res.json({ success: true, role });
  } catch (err) {
    console.error('Lỗi getMyRole:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Leader tạo yêu cầu giao task cho member ─────────────────────────────────
// POST /api/roles/assignment-request
exports.requestTaskAssignment = async (req, res) => {
  try {
    await ensureRoleTables();
    const { task_id, project_id, assigned_to, note } = req.body;
    const requesterId = req.user.id;

    if (!task_id || !project_id || !assigned_to) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra requester là leader hoặc owner
    const requesterRole = await getUserRole(requesterId, project_id);
    if (!['leader', 'owner'].includes(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Chỉ Leader hoặc Owner mới được giao task' });
    }

    // Owner bypass: tự động approve
    if (requesterRole === 'owner') {
      await pool.query(
        'UPDATE tasks SET assigned_to = ?, assignment_status = ? WHERE task_id = ? AND project_id = ?',
        [assigned_to, 'approved', task_id, project_id]
      );
      const [[task]] = await pool.query('SELECT * FROM tasks WHERE task_id = ?', [task_id]);
      return res.json({ success: true, approved: true, task });
    }

    // Kiểm tra assigned_to là member của project
    const assigneeRole = await getUserRole(assigned_to, project_id);
    if (!assigneeRole) {
      return res.status(404).json({ success: false, message: 'Người được giao không phải thành viên của project' });
    }

    // Kiểm tra task thuộc project
    const [[task]] = await pool.query(
      'SELECT * FROM tasks WHERE task_id = ? AND project_id = ? AND deleted_at IS NULL',
      [task_id, project_id]
    );
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task không tồn tại' });
    }

    // Kiểm tra đã có pending request chưa
    const [existing] = await pool.query(
      "SELECT * FROM task_assignment_requests WHERE task_id = ? AND status = 'pending'",
      [task_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Task này đang có yêu cầu giao đang chờ duyệt' });
    }

    // Tạo request và đặt task về pending
    const [result] = await pool.query(
      'INSERT INTO task_assignment_requests (task_id, project_id, assigned_to, requested_by, note) VALUES (?, ?, ?, ?, ?)',
      [task_id, project_id, assigned_to, requesterId, note || null]
    );

    await pool.query(
      "UPDATE tasks SET assignment_status = 'pending' WHERE task_id = ?",
      [task_id]
    );

    res.status(201).json({
      success: true,
      approved: false,
      message: 'Yêu cầu giao task đã gửi, chờ Owner duyệt',
      request_id: result.insertId
    });
  } catch (err) {
    console.error('Lỗi requestTaskAssignment:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Owner lấy danh sách yêu cầu giao task đang pending ──────────────────────
// GET /api/roles/assignment-requests/:projectId
exports.getAssignmentRequests = async (req, res) => {
  try {
    await ensureRoleTables();
    const { projectId } = req.params;
    const userId = req.user.id;

    const role = await getUserRole(userId, projectId);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Chỉ Owner mới xem được danh sách này' });
    }

    const [rows] = await pool.query(
      `SELECT
        tar.*,
        t.title AS task_title,
        t.priority,
        t.deadline,
        u_req.username AS requester_name,
        u_req.user_photo AS requester_photo,
        u_ass.username AS assignee_name,
        u_ass.user_photo AS assignee_photo
       FROM task_assignment_requests tar
       JOIN tasks t ON t.task_id = tar.task_id
       JOIN users u_req ON u_req.user_id = tar.requested_by
       JOIN users u_ass ON u_ass.user_id = tar.assigned_to
       WHERE tar.project_id = ? AND tar.status = 'pending'
       ORDER BY tar.created_at DESC`,
      [projectId]
    );

    res.json({ success: true, requests: rows });
  } catch (err) {
    console.error('Lỗi getAssignmentRequests:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Owner duyệt / từ chối yêu cầu giao task ────────────────────────────────
// PUT /api/roles/assignment-requests/:requestId
exports.reviewAssignmentRequest = async (req, res) => {
  try {
    await ensureRoleTables();
    const { requestId } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    const userId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action phải là 'approve' hoặc 'reject'" });
    }

    // Lấy request
    const [[request]] = await pool.query(
      "SELECT * FROM task_assignment_requests WHERE request_id = ? AND status = 'pending'",
      [requestId]
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại hoặc đã được xử lý' });
    }

    // Kiểm tra quyền owner
    const role = await getUserRole(userId, request.project_id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Chỉ Owner mới có thể duyệt' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Cập nhật request
    await pool.query(
      'UPDATE task_assignment_requests SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE request_id = ?',
      [newStatus, userId, requestId]
    );

    if (action === 'approve') {
      // Giao task cho member
      await pool.query(
        "UPDATE tasks SET assigned_to = ?, assignment_status = 'approved' WHERE task_id = ?",
        [request.assigned_to, request.task_id]
      );
    } else {
      // Huỷ trạng thái pending
      await pool.query(
        "UPDATE tasks SET assignment_status = 'rejected' WHERE task_id = ?",
        [request.task_id]
      );
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Đã duyệt giao task' : 'Đã từ chối giao task'
    });
  } catch (err) {
    console.error('Lỗi reviewAssignmentRequest:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Member nộp task (gửi submission request) ────────────────────────────────
// POST /api/roles/submit-task/:taskId
exports.submitTask = async (req, res) => {
  try {
    await ensureRoleTables();
    const { taskId } = req.params;
    const { note } = req.body;
    const userId = req.user.id;

    // Lấy task
    const [[task]] = await pool.query(
      'SELECT * FROM tasks WHERE task_id = ? AND deleted_at IS NULL',
      [taskId]
    );
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task không tồn tại' });
    }

    const role = await getUserRole(userId, task.project_id);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Bạn không phải thành viên của project' });
    }

    // Owner có thể complete trực tiếp → không cần submit
    if (role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Owner có thể hoàn thành task trực tiếp, không cần nộp'
      });
    }

    // Member/leader chỉ được nộp task mà mình được giao
    if (task.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ có thể nộp task được giao cho mình' });
    }

    // Kiểm tra đã có pending submission chưa
    const [existing] = await pool.query(
      "SELECT * FROM task_submissions WHERE task_id = ? AND status = 'pending'",
      [taskId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Task này đang có yêu cầu nộp đang chờ duyệt' });
    }

    const [result] = await pool.query(
      'INSERT INTO task_submissions (task_id, project_id, submitted_by, note) VALUES (?, ?, ?, ?)',
      [taskId, task.project_id, userId, note || null]
    );

    res.status(201).json({
      success: true,
      message: 'Đã nộp task, chờ Owner duyệt',
      submission_id: result.insertId
    });
  } catch (err) {
    console.error('Lỗi submitTask:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Owner lấy danh sách submissions đang pending ────────────────────────────
// GET /api/roles/submissions/:projectId
exports.getSubmissions = async (req, res) => {
  try {
    await ensureRoleTables();
    const { projectId } = req.params;
    const userId = req.user.id;

    const role = await getUserRole(userId, projectId);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Chỉ Owner mới xem được danh sách này' });
    }

    const [rows] = await pool.query(
      `SELECT
        ts.*,
        t.title AS task_title,
        t.priority,
        t.deadline,
        u.username AS submitter_name,
        u.user_photo AS submitter_photo
       FROM task_submissions ts
       JOIN tasks t ON t.task_id = ts.task_id
       JOIN users u ON u.user_id = ts.submitted_by
       WHERE ts.project_id = ? AND ts.status = 'pending'
       ORDER BY ts.created_at DESC`,
      [projectId]
    );

    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error('Lỗi getSubmissions:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Owner duyệt / từ chối submission ────────────────────────────────────────
// PUT /api/roles/submissions/:submissionId
exports.reviewSubmission = async (req, res) => {
  try {
    await ensureRoleTables();
    const { submissionId } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    const userId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action phải là 'approve' hoặc 'reject'" });
    }

    const [[submission]] = await pool.query(
      "SELECT * FROM task_submissions WHERE submission_id = ? AND status = 'pending'",
      [submissionId]
    );
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại hoặc đã được xử lý' });
    }

    const role = await getUserRole(userId, submission.project_id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Chỉ Owner mới có thể duyệt' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await pool.query(
      'UPDATE task_submissions SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE submission_id = ?',
      [newStatus, userId, submissionId]
    );

    if (action === 'approve') {
      await pool.query(
        'UPDATE tasks SET completed_at = NOW() WHERE task_id = ?',
        [submission.task_id]
      );
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Đã duyệt nộp task – task hoàn thành!' : 'Đã từ chối nộp task'
    });
  } catch (err) {
    console.error('Lỗi reviewSubmission:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Owner lấy số lượng pending (badge count) ────────────────────────────────
// GET /api/roles/pending-count/:projectId
exports.getPendingCount = async (req, res) => {
  try {
    await ensureRoleTables();
    const { projectId } = req.params;
    const userId = req.user.id;

    const role = await getUserRole(userId, projectId);
    if (role !== 'owner') {
      return res.json({ success: true, count: 0 });
    }

    const [[{ assignCount }]] = await pool.query(
      "SELECT COUNT(*) as assignCount FROM task_assignment_requests WHERE project_id = ? AND status = 'pending'",
      [projectId]
    );
    const [[{ subCount }]] = await pool.query(
      "SELECT COUNT(*) as subCount FROM task_submissions WHERE project_id = ? AND status = 'pending'",
      [projectId]
    );

    res.json({ success: true, count: assignCount + subCount, assignCount, subCount });
  } catch (err) {
    console.error('Lỗi getPendingCount:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ─── Lấy toàn bộ yêu cầu chờ duyệt của các project do user làm Owner ──────────
// GET /api/roles/inbox-approvals
exports.getInboxApprovals = async (req, res) => {
  try {
    await ensureRoleTables();
    const userId = req.user.id;

    // Lấy toàn bộ project_id mà user này là owner
    const [ownedProjects] = await pool.query(
      "SELECT project_id FROM projects WHERE owner_id = ? AND deleted_at IS NULL",
      [userId]
    );

    if (ownedProjects.length === 0) {
      return res.json({ success: true, assignmentRequests: [], submissions: [] });
    }

    const projectIds = ownedProjects.map(p => p.project_id);

    // Lấy danh sách giao task đang chờ duyệt
    const [assignments] = await pool.query(
      `SELECT
        tar.*,
        p.name AS project_name,
        t.title AS task_title,
        t.priority,
        t.deadline,
        u_req.username AS requester_name,
        u_req.user_photo AS requester_photo,
        u_ass.username AS assignee_name,
        u_ass.user_photo AS assignee_photo
       FROM task_assignment_requests tar
       JOIN tasks t ON t.task_id = tar.task_id
       JOIN projects p ON p.project_id = tar.project_id
       JOIN users u_req ON u_req.user_id = tar.requested_by
       JOIN users u_ass ON u_ass.user_id = tar.assigned_to
       WHERE tar.project_id IN (?) AND tar.status = 'pending'
       ORDER BY tar.created_at DESC`,
      [projectIds]
    );

    // Lấy danh sách nộp task đang chờ duyệt
    const [submissions] = await pool.query(
      `SELECT
        ts.*,
        p.name AS project_name,
        t.title AS task_title,
        t.priority,
        t.deadline,
        u.username AS submitter_name,
        u.user_photo AS submitter_photo
       FROM task_submissions ts
       JOIN tasks t ON t.task_id = ts.task_id
       JOIN projects p ON p.project_id = ts.project_id
       JOIN users u ON u.user_id = ts.submitted_by
       WHERE ts.project_id IN (?) AND ts.status = 'pending'
       ORDER BY ts.created_at DESC`,
      [projectIds]
    );

    res.json({
      success: true,
      assignmentRequests: assignments,
      submissions: submissions
    });
  } catch (err) {
    console.error('Lỗi getInboxApprovals:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
