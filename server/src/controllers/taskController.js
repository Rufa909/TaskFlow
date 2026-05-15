const pool = require("../config/db");

// GET /api/projects/:projectId/tasks
exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC",
      [projectId],
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
    const { title, description, deadline, time } = req.body;

    let deadlineDate = null;
    if (deadline) {
      deadlineDate = new Date(deadline);
    }

    const [result] = await pool.query(
      `
    INSERT INTO tasks 
    (title, description, deadline, time, project_id, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        description || null,
        deadlineDate,
        time || null,
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

// DELETE /api/projects/:projectId/tasks/:taskId
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    await pool.query("DELETE FROM tasks WHERE task_id = ? AND created_by = ?", [
      taskId,
      req.user.id,
    ]);
    res.json({ success: true, message: "Đã xóa task" });
  } catch (err) {
    console.error("Loi deleteTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
