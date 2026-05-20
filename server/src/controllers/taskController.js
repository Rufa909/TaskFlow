const pool = require("../config/db");
let completionColumnReady;

async function ensureTaskCompletionColumn() {
  if (!completionColumnReady) {
    completionColumnReady = (async () => {
      const [columns] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tasks'
          AND COLUMN_NAME = 'completed_at'
        `,
      );

      if (columns.length === 0) {
        await pool.query(
          "ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL",
        );
      }
    })();
  }

  return completionColumnReady;
}

// GET /api/projects/:projectId/tasks
exports.getTasks = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const { projectId } = req.params;
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tasks
      WHERE project_id = ?
        AND created_by = ?
        AND deleted_at IS NULL
        AND completed_at IS NULL
      ORDER BY created_at ASC
      `,
      [projectId, req.user.id],
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("Loi getTasks:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/projects/:projectId/tasks
exports.createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, deadline, time, priority } = req.body;
    await ensureTaskCompletionColumn();

    let deadlineDate = null;
    if (deadline) {
      deadlineDate = new Date(deadline);
    }
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    const [result] = await pool.query(
      `
    INSERT INTO tasks 
    (title, description, deadline, time, priority, project_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        description || null,
        deadlineDate,
        time || null,
        priority || "medium",
        projectId,
        req.user.id,
      ],
    );

    const [rows] = await pool.query("SELECT * FROM tasks WHERE task_id = ?", [
      result.insertId,
    ]);
    res.status(201).json({ success: true, task: rows[0] });
  } catch (err) {
    console.error("Loi createTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
// PUT /api/projects/:projectId/tasks/:taskId
exports.updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, deadline, time, priority } = req.body;
    await ensureTaskCompletionColumn();


    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    let deadlineDate = null;

    if (deadline) {
      deadlineDate = new Date(deadline);

      if (time) {
        const [hours, minutes] = time.split(":");

        deadlineDate.setHours(parseInt(hours, 10));
        deadlineDate.setMinutes(parseInt(minutes, 10));
      }
    }

    const [result] = await pool.query(
      `
            UPDATE tasks
            SET
                title = ?,
                description = ?,
                deadline = ?,
                time = ?,
                priority = ?
            WHERE task_id = ? AND project_id = ? AND created_by = ?
            `,
      [
        title.trim(),
        description || null,
        deadlineDate,
        time || null,
        priority || "medium",
        taskId,
        projectId,
        req.user.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE task_id = ? AND project_id = ? AND created_by = ?",
      [taskId, projectId, req.user.id],
    );

    res.json({
      success: true,
      task: rows[0],
    });
  } catch (err) {
    console.error("Loi updateTask:", err);

    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};
// POST /api/projects/:projectId/tasks/:taskId/complete
exports.completeTask = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const { projectId, taskId } = req.params;

    const [result] = await pool.query(
      `
      UPDATE tasks
      SET completed_at = COALESCE(completed_at, NOW())
      WHERE task_id = ?
        AND project_id = ?
        AND created_by = ?
        AND deleted_at IS NULL
      `,
      [taskId, projectId, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT tasks.*, projects.name AS project_name
      FROM tasks
      LEFT JOIN projects ON projects.project_id = tasks.project_id
      WHERE tasks.task_id = ?
        AND tasks.project_id = ?
        AND tasks.created_by = ?
      `,
      [taskId, projectId, req.user.id],
    );

    res.json({ success: true, task: rows[0] });
  } catch (err) {
    console.error("Loi completeTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/tasks/completed
exports.getCompletedTasks = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();

    const [rows] = await pool.query(
      `
      SELECT tasks.*, projects.name AS project_name
      FROM tasks
      LEFT JOIN projects ON projects.project_id = tasks.project_id
      WHERE tasks.created_by = ?
        AND tasks.deleted_at IS NULL
        AND tasks.completed_at IS NOT NULL
      ORDER BY tasks.completed_at DESC
      `,
      [req.user.id],
    );

    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("Loi getCompletedTasks:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/projects/:projectId/tasks/:taskId
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    await ensureTaskCompletionColumn();
    await pool.query(
      "UPDATE tasks SET deleted_at = NOW() WHERE task_id = ? AND created_by = ?",
      [taskId, req.user.id],
    );
    res.json({ success: true, message: "Đã xóa task" });
  } catch (err) {
    console.error("Loi deleteTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/tasks/today
exports.getTasksToday = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const [rows] = await pool.query(
      `SELECT t.*, p.name as project_name 
       FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.project_id 
       WHERE t.created_by = ? 
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL
         AND DATE(t.deadline) = CURDATE() 
       ORDER BY t.created_at ASC`,
      [req.user.id],
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("Loi getTasksToday:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/tasks -> all active tasks for inbox
exports.getAllTasks = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const [rows] = await pool.query(
      `SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.project_id WHERE t.created_by = ? AND t.deleted_at IS NULL AND t.completed_at IS NULL ORDER BY t.created_at ASC`,
      [req.user.id],
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error('Loi getAllTasks:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/tasks/counts
exports.getTaskCounts = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const userId = req.user.id;
    // Today count
    const [[{ todayCount }]] = await pool.query(
      `SELECT COUNT(*) as todayCount FROM tasks WHERE created_by = ? AND deleted_at IS NULL AND completed_at IS NULL AND DATE(deadline) = CURDATE()`,
      [userId],
    );

    // Inbox count: assume it means all tasks across all projects, or tasks without deadline. Let's just use total active tasks.
    const [[{ inboxCount }]] = await pool.query(
      `SELECT COUNT(*) as inboxCount FROM tasks WHERE created_by = ? AND deleted_at IS NULL AND completed_at IS NULL`,
      [userId],
    );

    res.json({
      success: true,
      counts: { today: todayCount, inbox: inboxCount },
    });
  } catch (err) {
    console.error("Loi getTaskCounts:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/tasks/counts/projects -> returns active task counts grouped by project
exports.getTaskCountsByProject = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT project_id, COUNT(*) as count FROM tasks WHERE created_by = ? AND deleted_at IS NULL AND completed_at IS NULL GROUP BY project_id`,
      [userId],
    );

    const counts = {};
    rows.forEach((r) => {
      counts[r.project_id] = r.count;
    });

    res.json({ success: true, counts });
  } catch (err) {
    console.error('Loi getTaskCountsByProject:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
