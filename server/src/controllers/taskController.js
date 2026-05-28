const pool = require("../config/db");
let completionColumnReady;
let attachmentTableReady;

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

async function ensureTaskAttachmentTable() {
  if (!attachmentTableReady) {
    attachmentTableReady = (async () => {
      // 1. Create table if not exists
      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS attachments (
          attachment_id INT AUTO_INCREMENT PRIMARY KEY,
          task_id INT NOT NULL,
          originalName VARCHAR(255) NULL,
          file_url VARCHAR(500) NOT NULL,
          fileName VARCHAR(255) NULL,
          mimeType VARCHAR(100) NULL,
          size INT NULL,
          upload_by INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_attachments_task_id (task_id)
        )
        `
      );

      // 2. Dynamically add missing columns if the table already existed with older schema
      const [cols] = await pool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'attachments'
      `);
      const colNames = cols.map(c => c.COLUMN_NAME);

      if (!colNames.includes('originalName')) {
        await pool.query("ALTER TABLE attachments ADD COLUMN originalName VARCHAR(255) NULL");
      }
      if (!colNames.includes('fileName')) {
        await pool.query("ALTER TABLE attachments ADD COLUMN fileName VARCHAR(255) NULL");
      }
      if (!colNames.includes('mimeType')) {
        await pool.query("ALTER TABLE attachments ADD COLUMN mimeType VARCHAR(100) NULL");
      }
      if (!colNames.includes('size')) {
        await pool.query("ALTER TABLE attachments ADD COLUMN size INT NULL");
      }
    })();
  }

  return attachmentTableReady;
}

// GET /api/projects/:projectId/tasks
exports.getTasks = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    const { projectId } = req.params;
    const [rows] = await pool.query(
      `
      SELECT
        t.*,
        ta.attachment_id,
        ta.originalName AS attachment_name,
        ta.file_url AS attachment_url,
        ta.mimeType AS attachment_type,
        ta.size AS attachment_size
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN (
        SELECT a.*
        FROM attachments a
        JOIN (
          SELECT task_id, MIN(attachment_id) AS attachment_id
          FROM attachments
          GROUP BY task_id
        ) first_attachment ON first_attachment.attachment_id = a.attachment_id
      ) ta ON ta.task_id = t.task_id
      WHERE t.project_id = ?
        AND p.deleted_at IS NULL
        AND (
          p.owner_id = ?
          OR (
            EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.project_id
                AND pm.user_id = ?
            )
            AND (
              t.assignment_status IN ('none', 'approved', 'rejected') OR t.assignment_status IS NULL
              OR (
                t.assignment_status = 'pending'
                AND (
                  t.created_by = ?
                  OR EXISTS (
                    SELECT 1
                    FROM task_assignment_requests tar
                    WHERE tar.task_id = t.task_id
                      AND tar.requested_by = ?
                      AND tar.status = 'pending'
                  )
                )
              )
            )
          )
        )
        AND t.deleted_at IS NULL
        AND t.completed_at IS NULL
      ORDER BY t.created_at ASC
      `,
      [projectId, req.user.id, req.user.id, req.user.id, req.user.id],
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
    const { title, description, deadline, time, priority, assigned_to } = req.body;
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();

    const [[project]] = await pool.query(
      `SELECT p.project_id, p.owner_id
       FROM projects p
       WHERE p.project_id = ?
         AND p.deleted_at IS NULL
         AND (
           p.owner_id = ?
           OR EXISTS (
             SELECT 1
             FROM project_members pm
             WHERE pm.project_id = p.project_id
               AND pm.user_id = ?
           )
         )`,
      [projectId, req.user.id, req.user.id],
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

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

    // Determine the user's role
    let creatorRole = null;
    if (project.owner_id === req.user.id) {
      creatorRole = 'owner';
    } else {
      const [[member]] = await pool.query(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, req.user.id]
      );
      creatorRole = member ? member.role : null;
    }

    let insertAssignedTo = null;
    let insertAssignmentStatus = 'none';

    if (assigned_to && assigned_to !== 'none' && assigned_to !== 'null' && assigned_to !== '') {
      if (creatorRole === 'owner') {
        insertAssignedTo = assigned_to;
        insertAssignmentStatus = 'approved';
      } else if (creatorRole === 'leader') {
        insertAssignedTo = null;
        insertAssignmentStatus = 'pending';
      }
    }

    const [result] = await pool.query(
      `
    INSERT INTO tasks 
    (title, description, deadline, time, priority, project_id, created_by, assigned_to, assignment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        description || null,
        deadlineDate,
        time || null,
        priority || "medium",
        projectId,
        req.user.id,
        insertAssignedTo,
        insertAssignmentStatus,
      ],
    );

    const taskId = result.insertId;

    if (insertAssignmentStatus === 'pending' && assigned_to) {
      await pool.query(
        "INSERT INTO task_assignment_requests (task_id, project_id, assigned_to, requested_by, status) VALUES (?, ?, ?, ?, 'pending')",
        [taskId, projectId, assigned_to, req.user.id]
      );
    }

    if (req.file) {
      await pool.query(
        `
        INSERT INTO attachments
        (task_id, originalName, file_url, fileName, mimeType, size, upload_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          taskId,
          req.file.originalname,
          `/uploads/files/${req.file.filename}`,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.user.id,
        ],
      );
    }

    const [rows] = await pool.query(
      `
      SELECT
        t.*,
        ta.attachment_id,
        ta.originalName AS attachment_name,
        ta.file_url AS attachment_url,
        ta.mimeType AS attachment_type,
        ta.size AS attachment_size
      FROM tasks t
      LEFT JOIN attachments ta ON ta.task_id = t.task_id
      WHERE t.task_id = ?
      `,
      [taskId],
    );
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
    const { title, description, deadline, time, priority, assigned_to } = req.body;
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();

    const [[project]] = await pool.query(
      "SELECT owner_id FROM projects WHERE project_id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    let userRole = null;
    if (project.owner_id === req.user.id) {
      userRole = 'owner';
    } else {
      const [[member]] = await pool.query(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, req.user.id]
      );
      userRole = member ? member.role : null;
    }

    const [[task]] = await pool.query(
      "SELECT assigned_to, assignment_status FROM tasks WHERE task_id = ? AND project_id = ? AND deleted_at IS NULL",
      [taskId, projectId]
    );
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

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

    let updateAssignedTo = task.assigned_to;
    let updateAssignmentStatus = task.assignment_status;

    if (assigned_to !== undefined) {
      let targetAssignee = (assigned_to && assigned_to !== 'none' && assigned_to !== 'null' && assigned_to !== '') ? parseInt(assigned_to) : null;
      if (userRole === 'owner') {
        updateAssignedTo = targetAssignee;
        updateAssignmentStatus = targetAssignee ? 'approved' : 'none';
      } else if (userRole === 'leader') {
        if (targetAssignee !== task.assigned_to) {
          if (targetAssignee) {
            updateAssignedTo = null; // stays null until owner approval
            updateAssignmentStatus = 'pending';
            await pool.query("DELETE FROM task_assignment_requests WHERE task_id = ? AND status = 'pending'", [taskId]);
            await pool.query(
              "INSERT INTO task_assignment_requests (task_id, project_id, assigned_to, requested_by, status) VALUES (?, ?, ?, ?, 'pending')",
              [taskId, projectId, targetAssignee, req.user.id]
            );
          } else {
            updateAssignedTo = null;
            updateAssignmentStatus = 'none';
            await pool.query("DELETE FROM task_assignment_requests WHERE task_id = ? AND status = 'pending'", [taskId]);
          }
        }
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
                priority = ?,
                assigned_to = ?,
                assignment_status = ?
            WHERE task_id = ?
              AND project_id = ?
              AND deleted_at IS NULL
            `,
      [
        title.trim(),
        description || null,
        deadlineDate,
        time || null,
        priority || "medium",
        updateAssignedTo,
        updateAssignmentStatus,
        taskId,
        projectId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (req.file) {
      const [attachments] = await pool.query(
        "SELECT attachment_id FROM attachments WHERE task_id = ? ORDER BY attachment_id ASC LIMIT 1",
        [taskId],
      );

      if (attachments.length > 0) {
        await pool.query(
          `
          UPDATE attachments
          SET originalName = ?,
              file_url = ?,
              fileName = ?,
              mimeType = ?,
              size = ?,
              upload_by = ?
          WHERE attachment_id = ?
          `,
          [
            req.file.originalname,
            `/uploads/files/${req.file.filename}`,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            req.user.id,
            attachments[0].attachment_id,
          ],
        );
      } else {
        await pool.query(
          `
          INSERT INTO attachments
          (task_id, originalName, file_url, fileName, mimeType, size, upload_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            taskId,
            req.file.originalname,
            `/uploads/files/${req.file.filename}`,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            req.user.id,
          ],
        );
      }
    }

    const [rows] = await pool.query(
      `
      SELECT
        t.*,
        ta.attachment_id,
        ta.originalName AS attachment_name,
        ta.file_url AS attachment_url,
        ta.mimeType AS attachment_type,
        ta.size AS attachment_size
      FROM tasks t
      LEFT JOIN attachments ta ON ta.task_id = t.task_id
      WHERE t.task_id = ? AND t.project_id = ?
      `,
      [taskId, projectId],
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
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM projects p
          WHERE p.project_id = ?
            AND p.deleted_at IS NULL
        )
      `,
      [taskId, projectId, projectId],
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
        AND projects.deleted_at IS NULL
      `,
      [taskId, projectId],
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
    await ensureTaskAttachmentTable();

    const [rows] = await pool.query(
      `
      SELECT
        t.*,
        p.name AS project_name,
        ta.attachment_id,
        ta.originalName AS attachment_name,
        ta.file_url AS attachment_url,
        ta.mimeType AS attachment_type,
        ta.size AS attachment_size
      FROM tasks t
      JOIN projects p ON p.project_id = t.project_id
      LEFT JOIN (
        SELECT a.*
        FROM attachments a
        JOIN (
          SELECT task_id, MIN(attachment_id) AS attachment_id
          FROM attachments
          GROUP BY task_id
        ) first_attachment ON first_attachment.attachment_id = a.attachment_id
      ) ta ON ta.task_id = t.task_id
      WHERE (
          p.owner_id = ?
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = p.project_id
              AND pm.user_id = ?
          )
        )
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND t.completed_at IS NOT NULL
      ORDER BY t.completed_at DESC
      `,
      [req.user.id, req.user.id],
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
    const { projectId, taskId } = req.params;
    await ensureTaskCompletionColumn();
    await pool.query(
      `UPDATE tasks
       SET deleted_at = NOW()
       WHERE task_id = ?
         AND project_id = ?
         AND EXISTS (
           SELECT 1 FROM projects p
           WHERE p.project_id = ?
             AND p.deleted_at IS NULL
         )`,
      [taskId, projectId, projectId],
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
    await ensureTaskAttachmentTable();
    const [rows] = await pool.query(
      `SELECT
         t.*,
         p.name as project_name,
         ta.attachment_id,
         ta.originalName AS attachment_name,
         ta.file_url AS attachment_url,
         ta.mimeType AS attachment_type,
         ta.size AS attachment_size
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       LEFT JOIN (
         SELECT a.*
         FROM attachments a
         JOIN (
           SELECT task_id, MIN(attachment_id) AS attachment_id
           FROM attachments
           GROUP BY task_id
         ) first_attachment ON first_attachment.attachment_id = a.attachment_id
       ) ta ON ta.task_id = t.task_id
       WHERE (
           p.owner_id = ?
           OR EXISTS (
             SELECT 1
             FROM project_members pm
             WHERE pm.project_id = p.project_id
               AND pm.user_id = ?
           )
         ) 
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL
         AND DATE(t.deadline) = CURDATE() 
       ORDER BY t.created_at ASC`,
      [req.user.id, req.user.id],
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
    await ensureTaskAttachmentTable();
    const [rows] = await pool.query(
      `SELECT
         t.*,
         p.name as project_name,
         ta.attachment_id,
         ta.originalName AS attachment_name,
         ta.file_url AS attachment_url,
         ta.mimeType AS attachment_type,
         ta.size AS attachment_size
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       LEFT JOIN (
         SELECT a.*
         FROM attachments a
         JOIN (
           SELECT task_id, MIN(attachment_id) AS attachment_id
           FROM attachments
           GROUP BY task_id
         ) first_attachment ON first_attachment.attachment_id = a.attachment_id
       ) ta ON ta.task_id = t.task_id
       WHERE (
           p.owner_id = ?
           OR EXISTS (
             SELECT 1
             FROM project_members pm
             WHERE pm.project_id = p.project_id
               AND pm.user_id = ?
           )
         ) 
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL 
       ORDER BY t.created_at ASC`,
      [req.user.id, req.user.id],
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("Loi getAllTasks:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/tasks/counts
exports.getTaskCounts = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    const userId = req.user.id;
    // Today count
    const [[{ todayCount }]] = await pool.query(
      `SELECT COUNT(DISTINCT t.task_id) as todayCount 
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN project_members pm ON p.project_id = pm.project_id
       WHERE (p.owner_id = ? OR pm.user_id = ?) 
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL 
         AND DATE(t.deadline) = CURDATE()`,
      [userId, userId],
    );

    // Inbox count
    const [[{ inboxCount }]] = await pool.query(
      `SELECT COUNT(DISTINCT t.task_id) as inboxCount 
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN project_members pm ON p.project_id = pm.project_id
       WHERE (p.owner_id = ? OR pm.user_id = ?) 
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL`,
      [userId, userId],
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
      `SELECT t.project_id, COUNT(DISTINCT t.task_id) as count 
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN project_members pm ON p.project_id = pm.project_id
       WHERE (p.owner_id = ? OR pm.user_id = ?) 
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL 
         AND t.completed_at IS NULL 
       GROUP BY t.project_id`,
      [userId, userId],
    );

    const counts = {};
    rows.forEach((r) => {
      counts[r.project_id] = r.count;
    });

    res.json({ success: true, counts });
  } catch (err) {
    console.error("Loi getTaskCountsByProject:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
