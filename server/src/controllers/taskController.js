const pool = require("../config/db");
const nodemailer = require("nodemailer");
let completionColumnReady;
let attachmentTableReady;
let labelsColumnReady;
let workflowSchemaReady;
let taskDetailSchemaReady;

function getMailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Missing EMAIL_USER or EMAIL_PASS");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function ensureTaskWorkflowSchema() {
  if (!workflowSchemaReady) {
    workflowSchemaReady = (async () => {
      const [memberRoleColumns] = await pool.query(
        `
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'project_members'
          AND COLUMN_NAME = 'role'
        `,
      );

      if (
        memberRoleColumns.length > 0 &&
        !String(memberRoleColumns[0].COLUMN_TYPE).includes("leader")
      ) {
        await pool.query(
          "ALTER TABLE project_members MODIFY COLUMN role ENUM('owner','leader','member') DEFAULT 'member'",
        );
      }

      const [taskColumns] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tasks'
          AND COLUMN_NAME IN ('assignment_status', 'deadline_notified_at')
        `,
      );
      const taskColumnNames = new Set(taskColumns.map((column) => column.COLUMN_NAME));

      if (!taskColumnNames.has("assignment_status")) {
        await pool.query(
          "ALTER TABLE tasks ADD COLUMN assignment_status ENUM('none','pending','approved','rejected') DEFAULT 'none'",
        );
      }
      if (!taskColumnNames.has("deadline_notified_at")) {
        await pool.query("ALTER TABLE tasks ADD COLUMN deadline_notified_at DATETIME NULL");
      }

      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS task_assignment_requests (
          request_id INT AUTO_INCREMENT PRIMARY KEY,
          task_id INT NOT NULL,
          project_id INT NOT NULL,
          assigned_to INT NOT NULL,
          requested_by INT NOT NULL,
          status ENUM('pending','approved','rejected') DEFAULT 'pending',
          note TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME NULL,
          reviewed_by INT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_task_assignment_requests_project (project_id),
          INDEX idx_task_assignment_requests_status (status)
        )
        `,
      );

      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS task_submissions (
          submission_id INT AUTO_INCREMENT PRIMARY KEY,
          task_id INT NOT NULL,
          project_id INT NOT NULL,
          submitted_by INT NOT NULL,
          status ENUM('pending','approved','rejected') DEFAULT 'pending',
          note TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME NULL,
          reviewed_by INT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_task_submissions_project (project_id),
          INDEX idx_task_submissions_status (status)
        )
        `,
      );
    })();
  }

  return workflowSchemaReady;
}

async function getProjectRole(projectId, userId) {
  const [[project]] = await pool.query(
    "SELECT owner_id FROM projects WHERE project_id = ? AND deleted_at IS NULL",
    [projectId],
  );

  if (!project) return null;
  if (Number(project.owner_id) === Number(userId)) return "owner";

  const [[member]] = await pool.query(
    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, userId],
  );

  return member?.role || null;
}

async function isProjectMember(projectId, userId) {
  const role = await getProjectRole(projectId, userId);
  return Boolean(role);
}

async function canAccessTask(projectId, taskId, userId) {
  const [[task]] = await pool.query(
    `
    SELECT t.task_id
    FROM tasks t
    JOIN projects p ON p.project_id = t.project_id
    WHERE t.task_id = ?
      AND t.project_id = ?
      AND t.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND (
        p.owner_id = ?
        OR EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = p.project_id
            AND pm.user_id = ?
        )
      )
    LIMIT 1
    `,
    [taskId, projectId, userId, userId],
  );

  return Boolean(task);
}

async function sendDeadlineMail(task) {
  const recipients = [task.assigned_email, task.leader_email]
    .filter(Boolean)
    .filter((email, index, emails) => emails.indexOf(email) === index);

  if (recipients.length === 0) return false;

  const transporter = getMailTransporter();
  await transporter.sendMail({
    from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
    to: recipients,
    subject: `Task quá hạn: ${task.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2>Task quá hạn deadline</h2>
        <p><strong>Task:</strong> ${task.title}</p>
        <p><strong>Project:</strong> ${task.project_name}</p>
        <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString("vi-VN")}</p>
        <p>Mail này được gửi cho member phụ trách và leader/người tạo task.</p>
      </div>
    `,
  });

  return true;
}

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
    attachmentTableReady = pool.query(
      `
      CREATE TABLE IF NOT EXISTS attachments (
        attachment_id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        comment_id INT NULL,
        originalName VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        fileName VARCHAR(255) NOT NULL,
        mimeType VARCHAR(100),
        size INT,
        upload_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_attachments_task_id (task_id),
        FOREIGN KEY (comment_id) REFERENCES task_comments(comment_id) ON DELETE CASCADE
      )
      `,
    );
  }

  return attachmentTableReady;
}

async function ensureTaskLabelsColumn() {
  if (!labelsColumnReady) {
    labelsColumnReady = (async () => {
      const [columns] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tasks'
          AND COLUMN_NAME = 'labels'
        `,
      );

      if (columns.length === 0) {
        await pool.query("ALTER TABLE tasks ADD COLUMN labels TEXT NULL");
      }

      const [attachColumns] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'attachments'
          AND COLUMN_NAME = 'comment_id'
        `
      );
      if (attachColumns.length === 0) {
        await pool.query("ALTER TABLE attachments ADD COLUMN comment_id INT NULL");
        await pool.query("ALTER TABLE attachments ADD FOREIGN KEY (comment_id) REFERENCES task_comments(comment_id) ON DELETE CASCADE");
      }
    })();
  }

  return labelsColumnReady;
}

async function ensureTaskDetailSchema() {
  if (!taskDetailSchemaReady) {
    taskDetailSchemaReady = (async () => {
      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS task_subtasks (
          subtask_id INT AUTO_INCREMENT PRIMARY KEY,
          task_id INT NOT NULL,
          project_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          completed_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          INDEX idx_task_subtasks_task (task_id)
        )
        `,
      );

      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS task_comments (
          comment_id INT AUTO_INCREMENT PRIMARY KEY,
          task_id INT NOT NULL,
          project_id INT NOT NULL,
          user_id INT NOT NULL,
          body TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_task_comments_task (task_id)
        )
        `,
      );
    })();
  }

  return taskDetailSchemaReady;
}

function parseTaskLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTaskRows(rows) {
  return rows.map((task) => ({
    ...task,
    labels: parseTaskLabels(task.labels),
  }));
}

function getUploadedTaskFiles(req) {
  if (req.file) return [req.file];
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;

  return [
    ...(req.files.attachment || []),
    ...(req.files.attachments || []),
  ];
}

async function insertTaskAttachments(taskId, files, userId) {
  for (const file of files) {
    await pool.query(
      `
      INSERT INTO attachments
      (task_id, originalName, file_url, fileName, mimeType, size, upload_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        file.originalname,
        `/uploads/files/${file.filename}`,
        file.filename,
        file.mimetype,
        file.size,
        userId,
      ],
    );
  }
}

async function insertCommentAttachments(taskId, commentId, files, userId) {
  for (const file of files) {
    await pool.query(
      `
      INSERT INTO attachments
      (task_id, comment_id, originalName, file_url, fileName, mimeType, size, upload_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        commentId,
        file.originalname,
        `/uploads/files/${file.filename}`,
        file.filename,
        file.mimetype,
        file.size,
        userId,
      ],
    );
  }
}

// GET /api/projects/:projectId/tasks
exports.getTasks = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    await ensureTaskLabelsColumn();
    await ensureTaskWorkflowSchema();
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
          WHERE comment_id IS NULL
          GROUP BY task_id
        ) first_attachment ON first_attachment.attachment_id = a.attachment_id
      ) ta ON ta.task_id = t.task_id
      WHERE t.project_id = ?
        AND p.deleted_at IS NULL
        AND (
          p.owner_id = ?
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = p.project_id
              AND pm.user_id = ?
          )
        )
        AND t.deleted_at IS NULL
        AND t.completed_at IS NULL
      ORDER BY t.created_at ASC
      `,
      [projectId, req.user.id, req.user.id],
    );
    res.json({ success: true, tasks: normalizeTaskRows(rows) });
  } catch (err) {
    console.error("Loi getTasks:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/projects/:projectId/tasks
exports.createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, deadline, time, priority, labels, assigned_to, note } = req.body;
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    await ensureTaskLabelsColumn();
    await ensureTaskWorkflowSchema();

    const role = await getProjectRole(projectId, req.user.id);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a project member",
      });
    }
    if (role === "member") {
      return res.status(403).json({
        success: false,
        message: "Only owner/leader can create tasks in this team project",
      });
    }

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

    let assignmentStatus = "none";
    let assignedTo = assigned_to ? Number(assigned_to) : null;

    if (assignedTo) {
      const requesterRole =
        Number(project.owner_id) === Number(req.user.id)
          ? "owner"
          : await getProjectRole(projectId, req.user.id);

      if (!["owner", "leader"].includes(requesterRole)) {
        return res.status(403).json({
          success: false,
          message: "Only owner or leader can assign tasks",
        });
      }

      const assigneeIsMember = await isProjectMember(projectId, assignedTo);
      if (!assigneeIsMember) {
        return res.status(400).json({
          success: false,
          message: "Assigned user must be a project member",
        });
      }

      assignmentStatus = requesterRole === "owner" ? "approved" : "pending";
    }

    const [result] = await pool.query(
      `
    INSERT INTO tasks 
    (title, description, deadline, time, priority, labels, project_id, assigned_to, assignment_status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        description || null,
        deadlineDate,
        time || null,
        priority || "medium",
        JSON.stringify(parseTaskLabels(labels)),
        projectId,
        assignedTo,
        assignmentStatus,
        req.user.id,
      ],
    );

    const taskId = result.insertId;

    if (assignedTo && assignmentStatus === "pending") {
      await pool.query(
        `
        INSERT INTO task_assignment_requests
        (task_id, project_id, assigned_to, requested_by, note)
        VALUES (?, ?, ?, ?, ?)
        `,
        [taskId, projectId, assignedTo, req.user.id, note || null],
      );
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_request', ?)",
        [project.owner_id, taskId],
      );
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_pending', ?)",
        [assignedTo, taskId],
      );
    } else if (assignedTo && assignmentStatus === "approved") {
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_assigned', ?)",
        [assignedTo, taskId],
      );
    }

    await insertTaskAttachments(taskId, getUploadedTaskFiles(req), req.user.id);

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
    res.status(201).json({ success: true, task: normalizeTaskRows(rows)[0] });
  } catch (err) {
    console.error("Loi createTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
// PUT /api/projects/:projectId/tasks/:taskId
exports.updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, deadline, time, priority, labels } = req.body;
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    await ensureTaskLabelsColumn();

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

    const role = await getProjectRole(projectId, req.user.id);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a project member",
      });
    }

    if (role !== "member") {
      const [result] = await pool.query(
        `
        UPDATE tasks
        SET
            title = ?,
            description = ?,
            deadline = ?,
            time = ?,
            priority = ?,
            labels = ?
        WHERE task_id = ?
          AND project_id = ?
          AND deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.project_id = ?
              AND p.deleted_at IS NULL
          )
        `,
        [
          title.trim(),
          description || null,
          deadlineDate,
          time || null,
          priority || "medium",
          JSON.stringify(parseTaskLabels(labels)),
          taskId,
          projectId,
          projectId,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }
    } else {
      const [[task]] = await pool.query("SELECT 1 FROM tasks WHERE task_id = ? AND project_id = ? AND deleted_at IS NULL", [taskId, projectId]);
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    }

    await insertTaskAttachments(taskId, getUploadedTaskFiles(req), req.user.id);

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
      task: normalizeTaskRows(rows)[0],
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
    await ensureTaskLabelsColumn();
    await ensureTaskWorkflowSchema();
    const { projectId, taskId } = req.params;
    const { note } = req.body || {};

    const [[task]] = await pool.query(
      `
      SELECT t.*, p.owner_id
      FROM tasks t
      JOIN projects p ON p.project_id = t.project_id
      WHERE t.task_id = ?
        AND t.project_id = ?
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
      `,
      [taskId, projectId],
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const role = await getProjectRole(projectId, req.user.id);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a project member",
      });
    }

    if (
      Number(task.assigned_to) === Number(req.user.id) &&
      !["owner", "leader"].includes(role)
    ) {
      const [[pendingSubmission]] = await pool.query(
        `
        SELECT submission_id
        FROM task_submissions
        WHERE task_id = ?
          AND submitted_by = ?
          AND status = 'pending'
        LIMIT 1
        `,
        [taskId, req.user.id],
      );

      if (!pendingSubmission) {
        await pool.query(
          `
          INSERT INTO task_submissions (task_id, project_id, submitted_by, note)
          VALUES (?, ?, ?, ?)
          `,
          [taskId, projectId, req.user.id, note || null],
        );
      }

      await pool.query(
        "UPDATE tasks SET status = 'in_progress' WHERE task_id = ? AND project_id = ?",
        [taskId, projectId],
      );

      return res.json({
        success: true,
        pendingApproval: true,
        message: "Task submitted. Waiting for leader approval.",
        task: normalizeTaskRows([{ ...task, status: "in_progress" }])[0],
      });
    }

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

    res.json({ success: true, task: normalizeTaskRows(rows)[0] });
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
    await ensureTaskLabelsColumn();

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
          WHERE comment_id IS NULL
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

    res.json({ success: true, tasks: normalizeTaskRows(rows) });
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

exports.getTaskDetails = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    const { projectId, taskId } = req.params;

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const [subtasks] = await pool.query(
      `
      SELECT subtask_id, task_id, project_id, title, completed_at, created_at
      FROM task_subtasks
      WHERE task_id = ?
        AND project_id = ?
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      `,
      [taskId, projectId],
    );

    const [comments] = await pool.query(
      `
      SELECT c.comment_id, c.task_id, c.project_id, c.user_id, c.body, c.created_at,
             u.username, u.email, u.user_photo
      FROM task_comments c
      LEFT JOIN users u ON u.user_id = c.user_id
      WHERE c.task_id = ?
        AND c.project_id = ?
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      `,
      [taskId, projectId],
    );

    const [commentAttachments] = await pool.query(
      `
      SELECT attachment_id, comment_id, originalName, file_url, fileName, mimeType, size
      FROM attachments
      WHERE task_id = ? AND comment_id IS NOT NULL
      `,
      [taskId]
    );

    comments.forEach((c) => {
      c.attachments = commentAttachments.filter((a) => a.comment_id === c.comment_id);
    });

    const [taskAttachments] = await pool.query(
      `
      SELECT attachment_id, originalName, file_url, fileName, mimeType, size, upload_by
      FROM attachments
      WHERE task_id = ? AND comment_id IS NULL
      `,
      [taskId]
    );

    const role = await getProjectRole(projectId, req.user.id);

    res.json({ success: true, subtasks, comments, role, attachments: taskAttachments });
  } catch (err) {
    console.error("Loi getTaskDetails:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

exports.createSubtask = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    const { projectId, taskId } = req.params;
    const title = String(req.body.title || "").trim();

    if (!title) {
      return res.status(400).json({ success: false, message: "Subtask title is required" });
    }

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO task_subtasks (task_id, project_id, title)
      VALUES (?, ?, ?)
      `,
      [taskId, projectId, title],
    );

    const [[subtask]] = await pool.query(
      `
      SELECT subtask_id, task_id, project_id, title, completed_at, created_at
      FROM task_subtasks
      WHERE subtask_id = ?
      `,
      [result.insertId],
    );

    res.status(201).json({ success: true, subtask });
  } catch (err) {
    console.error("Loi createSubtask:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

exports.updateSubtask = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    const { projectId, taskId, subtaskId } = req.params;
    const completed = Boolean(req.body.completed);
    const title = req.body.title;

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (typeof title === "string") {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ success: false, message: "Subtask title is required" });
      }

      await pool.query(
        `
        UPDATE task_subtasks
        SET title = ?
        WHERE subtask_id = ?
          AND task_id = ?
          AND project_id = ?
          AND deleted_at IS NULL
        `,
        [trimmedTitle, subtaskId, taskId, projectId],
      );
    } else {
      await pool.query(
        `
        UPDATE task_subtasks
        SET completed_at = ?
        WHERE subtask_id = ?
          AND task_id = ?
          AND project_id = ?
          AND deleted_at IS NULL
        `,
        [completed ? new Date() : null, subtaskId, taskId, projectId],
      );
    }

    const [[subtask]] = await pool.query(
      `
      SELECT subtask_id, task_id, project_id, title, completed_at, created_at
      FROM task_subtasks
      WHERE subtask_id = ?
        AND deleted_at IS NULL
      `,
      [subtaskId],
    );

    res.json({ success: true, subtask });
  } catch (err) {
    console.error("Loi updateSubtask:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

exports.deleteSubtask = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    const { projectId, taskId, subtaskId } = req.params;

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    await pool.query(
      `
      UPDATE task_subtasks
      SET deleted_at = NOW()
      WHERE subtask_id = ?
        AND task_id = ?
        AND project_id = ?
      `,
      [subtaskId, taskId, projectId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Loi deleteSubtask:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

exports.createTaskComment = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    await ensureTaskAttachmentTable();
    const { projectId, taskId } = req.params;
    const body = String(req.body.body || "").trim();
    const files = getUploadedTaskFiles(req);

    if (!body && files.length === 0) {
      return res.status(400).json({ success: false, message: "Comment body or attachments are required" });
    }

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO task_comments (task_id, project_id, user_id, body)
      VALUES (?, ?, ?, ?)
      `,
      [taskId, projectId, req.user.id, body],
    );

    const commentId = result.insertId;

    if (files.length > 0) {
      await insertCommentAttachments(taskId, commentId, files, req.user.id);
    }

    const [[comment]] = await pool.query(
      `
      SELECT c.comment_id, c.task_id, c.project_id, c.user_id, c.body, c.created_at,
             u.username, u.email, u.user_photo
      FROM task_comments c
      LEFT JOIN users u ON u.user_id = c.user_id
      WHERE c.comment_id = ?
      `,
      [commentId],
    );

    const [attachments] = await pool.query(
      `
      SELECT attachment_id, comment_id, originalName, file_url, fileName, mimeType, size
      FROM attachments
      WHERE comment_id = ?
      `,
      [commentId]
    );

    comment.attachments = attachments;

    res.status(201).json({ success: true, comment });
  } catch (err) {
    console.error("Loi createTaskComment:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.deleteTaskComment = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    const { projectId, taskId, commentId } = req.params;

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    await pool.query(
      `
      UPDATE task_comments
      SET deleted_at = NOW()
      WHERE comment_id = ?
        AND task_id = ?
        AND project_id = ?
        AND user_id = ?
      `,
      [commentId, taskId, projectId, req.user.id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Loi deleteTaskComment:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

// GET /api/tasks/today
exports.getTasksToday = async (req, res) => {
  try {
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    await ensureTaskLabelsColumn();
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
           WHERE comment_id IS NULL
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
    res.json({ success: true, tasks: normalizeTaskRows(rows) });
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
    await ensureTaskLabelsColumn();
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
           WHERE comment_id IS NULL
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
    res.json({ success: true, tasks: normalizeTaskRows(rows) });
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

// POST /api/projects/:projectId/tasks/:taskId/assign
exports.requestTaskAssignment = async (req, res) => {
  try {
    await ensureTaskWorkflowSchema();
    const { projectId, taskId } = req.params;
    const { assigned_to, note } = req.body;

    if (!assigned_to) {
      return res.status(400).json({ success: false, message: "assigned_to is required" });
    }

    const role = await getProjectRole(projectId, req.user.id);
    if (!["owner", "leader"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only owner or leader can assign tasks",
      });
    }

    const assigneeIsMember = await isProjectMember(projectId, assigned_to);
    if (!assigneeIsMember) {
      return res.status(400).json({
        success: false,
        message: "Assigned user must be a project member",
      });
    }

    const [[task]] = await pool.query(
      `
      SELECT task_id
      FROM tasks
      WHERE task_id = ?
        AND project_id = ?
        AND deleted_at IS NULL
      `,
      [taskId, projectId],
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (role === "owner") {
      await pool.query(
        `
        UPDATE tasks
        SET assigned_to = ?, assignment_status = 'approved'
        WHERE task_id = ? AND project_id = ?
        `,
        [assigned_to, taskId, projectId],
      );
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_assigned', ?)",
        [assigned_to, taskId],
      );

      return res.json({ success: true, message: "Task assigned" });
    }

    const [[existingRequest]] = await pool.query(
      `
      SELECT request_id
      FROM task_assignment_requests
      WHERE task_id = ?
        AND status = 'pending'
      LIMIT 1
      `,
      [taskId],
    );

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "Task already has a pending assignment request",
      });
    }

    await pool.query(
      `
      UPDATE tasks
      SET assigned_to = ?, assignment_status = 'pending'
      WHERE task_id = ? AND project_id = ?
      `,
      [assigned_to, taskId, projectId],
    );

    const [result] = await pool.query(
      `
      INSERT INTO task_assignment_requests
      (task_id, project_id, assigned_to, requested_by, note)
      VALUES (?, ?, ?, ?, ?)
      `,
      [taskId, projectId, assigned_to, req.user.id, note || null],
    );

    const [[project]] = await pool.query(
      "SELECT owner_id FROM projects WHERE project_id = ?",
      [projectId],
    );
    if (project?.owner_id) {
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_request', ?)",
        [project.owner_id, taskId],
      );
    }
    await pool.query(
      "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_pending', ?)",
      [assigned_to, taskId],
    );

    res.status(201).json({
      success: true,
      message: "Assignment request created. Waiting for owner approval.",
      request_id: result.insertId,
    });
  } catch (err) {
    console.error("Loi requestTaskAssignment:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/projects/:projectId/task-assignment-requests
exports.getTaskAssignmentRequests = async (req, res) => {
  try {
    await ensureTaskWorkflowSchema();
    const { projectId } = req.params;
    const role = await getProjectRole(projectId, req.user.id);

    if (role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only owner can view assignment requests",
      });
    }

    const [requests] = await pool.query(
      `
      SELECT tar.*, t.title, t.deadline, t.priority,
             assignee.username AS assigned_username, assignee.email AS assigned_email,
             requester.username AS requested_by_username, requester.email AS requested_by_email
      FROM task_assignment_requests tar
      JOIN tasks t ON t.task_id = tar.task_id
      JOIN users assignee ON assignee.user_id = tar.assigned_to
      JOIN users requester ON requester.user_id = tar.requested_by
      WHERE tar.project_id = ?
      ORDER BY tar.created_at DESC
      `,
      [projectId],
    );

    res.json({ success: true, requests });
  } catch (err) {
    console.error("Loi getTaskAssignmentRequests:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// PUT /api/projects/:projectId/task-assignment-requests/:requestId
exports.reviewTaskAssignmentRequest = async (req, res) => {
  try {
    await ensureTaskWorkflowSchema();
    const { projectId, requestId } = req.params;
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be approve or reject",
      });
    }

    const role = await getProjectRole(projectId, req.user.id);
    if (role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only owner can review assignment requests",
      });
    }

    const [[request]] = await pool.query(
      `
      SELECT *
      FROM task_assignment_requests
      WHERE request_id = ?
        AND project_id = ?
        AND status = 'pending'
      `,
      [requestId, projectId],
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Pending request not found",
      });
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    await pool.query(
      `
      UPDATE task_assignment_requests
      SET status = ?, reviewed_at = NOW(), reviewed_by = ?
      WHERE request_id = ?
      `,
      [nextStatus, req.user.id, requestId],
    );

    await pool.query(
      `
      UPDATE tasks
      SET assigned_to = ?, assignment_status = ?
      WHERE task_id = ? AND project_id = ?
      `,
      [
        action === "approve" ? request.assigned_to : null,
        action === "approve" ? "approved" : "rejected",
        request.task_id,
        projectId,
      ],
    );

    if (action === "approve") {
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_assigned', ?)",
        [request.assigned_to, request.task_id],
      );
    } else {
      await pool.query(
        "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_rejected', ?)",
        [request.requested_by, request.task_id],
      );
    }

    res.json({
      success: true,
      message:
        action === "approve"
          ? "Assignment request approved"
          : "Assignment request rejected",
    });
  } catch (err) {
    console.error("Loi reviewTaskAssignmentRequest:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/projects/:projectId/task-submissions
exports.getTaskSubmissions = async (req, res) => {
  try {
    await ensureTaskWorkflowSchema();
    const { projectId } = req.params;
    const role = await getProjectRole(projectId, req.user.id);

    if (!["owner", "leader"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only owner or leader can view task submissions",
      });
    }

    const [submissions] = await pool.query(
      `
      SELECT ts.*, t.title, t.deadline, t.priority,
             submitter.username AS submitted_by_username, submitter.email AS submitted_by_email
      FROM task_submissions ts
      JOIN tasks t ON t.task_id = ts.task_id
      JOIN users submitter ON submitter.user_id = ts.submitted_by
      WHERE ts.project_id = ?
      ORDER BY ts.created_at DESC
      `,
      [projectId],
    );

    res.json({ success: true, submissions });
  } catch (err) {
    console.error("Loi getTaskSubmissions:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// PUT /api/projects/:projectId/task-submissions/:submissionId
exports.reviewTaskSubmission = async (req, res) => {
  try {
    await ensureTaskWorkflowSchema();
    await ensureTaskCompletionColumn();
    const { projectId, submissionId } = req.params;
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be approve or reject",
      });
    }

    const role = await getProjectRole(projectId, req.user.id);
    if (!["owner", "leader"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only owner or leader can review task submissions",
      });
    }

    const [[submission]] = await pool.query(
      `
      SELECT *
      FROM task_submissions
      WHERE submission_id = ?
        AND project_id = ?
        AND status = 'pending'
      `,
      [submissionId, projectId],
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Pending submission not found",
      });
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    await pool.query(
      `
      UPDATE task_submissions
      SET status = ?, reviewed_at = NOW(), reviewed_by = ?
      WHERE submission_id = ?
      `,
      [nextStatus, req.user.id, submissionId],
    );

    if (action === "approve") {
      await pool.query(
        `
        UPDATE tasks
        SET status = 'done', completed_at = COALESCE(completed_at, NOW())
        WHERE task_id = ? AND project_id = ?
        `,
        [submission.task_id, projectId],
      );
    } else {
      await pool.query(
        `
        UPDATE tasks
        SET status = 'in_progress'
        WHERE task_id = ? AND project_id = ?
        `,
        [submission.task_id, projectId],
      );
    }

    res.json({
      success: true,
      message:
        action === "approve"
          ? "Task submission approved"
          : "Task submission rejected",
    });
  } catch (err) {
    console.error("Loi reviewTaskSubmission:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.checkOverdueTasks = async () => {
  await ensureTaskWorkflowSchema();
  await ensureTaskCompletionColumn();

  const [tasks] = await pool.query(
    `
    SELECT t.task_id, t.title, t.deadline, p.name AS project_name,
           assigned.user_id AS assigned_user_id,
           assigned.email AS assigned_email,
           leader.user_id AS leader_user_id,
           leader.email AS leader_email
    FROM tasks t
    JOIN projects p ON p.project_id = t.project_id
    LEFT JOIN users assigned ON assigned.user_id = t.assigned_to
    LEFT JOIN users leader ON leader.user_id = t.created_by
    WHERE t.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND t.completed_at IS NULL
      AND t.assignment_status IN ('none', 'approved')
      AND t.deadline IS NOT NULL
      AND t.deadline < NOW()
      AND t.deadline_notified_at IS NULL
      AND t.assigned_to IS NOT NULL
    LIMIT 50
    `,
  );

  let sent = 0;
  for (const task of tasks) {
    try {
      const wasSent = await sendDeadlineMail(task);
      if (wasSent) {
        sent += 1;
        const recipients = [task.assigned_user_id, task.leader_user_id]
          .filter(Boolean)
          .filter((id, index, ids) => ids.indexOf(id) === index);
        for (const userId of recipients) {
          await pool.query(
            "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'deadline_overdue', ?)",
            [userId, task.task_id],
          );
        }
        await pool.query(
          "UPDATE tasks SET deadline_notified_at = NOW() WHERE task_id = ?",
          [task.task_id],
        );
      }
    } catch (err) {
      console.error("Loi gui mail deadline:", err.message);
    }
  }

  return sent;
};

// POST /api/tasks/overdue/check
exports.checkOverdueTasksNow = async (req, res) => {
  try {
    const sent = await exports.checkOverdueTasks();
    res.json({ success: true, sent });
  } catch (err) {
    console.error("Loi checkOverdueTasksNow:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
