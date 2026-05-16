const pool = require("../config/db");

// GET /api/projects/:projectId/tasks
exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const [rows] = await pool.query(
      "select * from tasks where project_id = ? and deleted_at is null order by created_at asc",
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
    const { title, description, deadline, time, priority } = req.body;

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

// DELETE /api/projects/:projectId/tasks/:taskId
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
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
