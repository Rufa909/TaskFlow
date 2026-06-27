const pool = require("../config/db");
const { emitTaskChanged } = require("../socket");
const nodemailer = require("nodemailer");
const fs = require("fs/promises");
const path = require("path");
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
          AND COLUMN_NAME IN ('assignment_status', 'deadline_notified_at', 'stage_id')
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
      if (!taskColumnNames.has("stage_id")) {
        await pool.query("ALTER TABLE tasks ADD COLUMN stage_id INT NULL");
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

      await pool.query(
        `
        CREATE TABLE IF NOT EXISTS task_assignees (
          task_id INT NOT NULL,
          user_id INT NOT NULL,
          accepted_at DATETIME NULL,
          submitted_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (task_id, user_id),
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_task_assignees_user (user_id)
        )
        `,
      );

      await pool.query(
        `
        INSERT IGNORE INTO task_assignees (task_id, user_id, accepted_at, submitted_at)
        SELECT
          task_id,
          assigned_to,
          CASE
            WHEN status IN ('ACCEPTED','IN_PROGRESS','SUBMITTED','LEADER_APPROVED','OWNER_APPROVED','COMPLETED','CHANGES_REQUESTED')
              THEN updated_at
            ELSE NULL
          END,
          CASE
            WHEN status IN ('SUBMITTED','LEADER_APPROVED','OWNER_APPROVED','COMPLETED')
              THEN updated_at
            ELSE NULL
          END
        FROM tasks
        WHERE assigned_to IS NOT NULL
        `,
      );

      const [submissionStatusColumns] = await pool.query(
        `
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'task_submissions'
          AND COLUMN_NAME = 'status'
        `,
      );

      if (
        submissionStatusColumns.length > 0 &&
        !String(submissionStatusColumns[0].COLUMN_TYPE).includes("leader_approved")
      ) {
        await pool.query(
          "ALTER TABLE task_submissions MODIFY COLUMN status ENUM('pending','leader_approved','approved','rejected') DEFAULT 'pending'",
        );
      }

      await pool.query(
        `
        UPDATE tasks t
        JOIN task_submissions ts ON ts.task_id = t.task_id
        SET t.status = 'SUBMITTED'
        WHERE ts.status = 'pending'
          AND t.completed_at IS NULL
          AND t.status <> 'SUBMITTED'
        `,
      );

      await pool.query(
        `
        INSERT INTO notifications (user_id, type, reference_id)
        SELECT pm.user_id, 'task_submitted', ts.task_id
        FROM task_submissions ts
        JOIN project_members pm
          ON pm.project_id = ts.project_id
         AND pm.role = 'leader'
        WHERE ts.status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.user_id = pm.user_id
              AND n.type = 'task_submitted'
              AND n.reference_id = ts.task_id
          )
        `,
      );

      await pool.query(
        `
        DELETE older_notification
        FROM notifications older_notification
        JOIN notifications newer_notification
          ON newer_notification.user_id = older_notification.user_id
         AND newer_notification.type = older_notification.type
         AND newer_notification.reference_id = older_notification.reference_id
         AND newer_notification.noti_id > older_notification.noti_id
        WHERE older_notification.type IN ('task_submitted', 'leader_approved_task')
        `,
      );

      await pool.query(
        `
        INSERT INTO notifications (user_id, type, reference_id)
        SELECT p.owner_id, 'task_submitted', ts.task_id
        FROM task_submissions ts
        JOIN projects p ON p.project_id = ts.project_id
        WHERE ts.status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = ts.project_id
              AND pm.role = 'leader'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.user_id = p.owner_id
              AND n.type = 'task_submitted'
              AND n.reference_id = ts.task_id
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

async function getProjectUserCounts(projectIds) {
  const ids = [...new Set(projectIds.map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return new Map();

  const [rows] = await pool.query(
    `
    SELECT project_id, COUNT(DISTINCT user_id) AS user_count
    FROM (
      SELECT project_id, owner_id AS user_id
      FROM projects
      WHERE project_id IN (?)
      UNION
      SELECT project_id, user_id
      FROM project_members
      WHERE project_id IN (?)
    ) project_users
    GROUP BY project_id
    `,
    [ids, ids],
  );

  return new Map(
    rows.map((row) => [
      Number(row.project_id),
      Number(row.user_count || 0),
    ]),
  );
}

async function isSoloProject(projectId) {
  const counts = await getProjectUserCounts([projectId]);
  return Number(counts.get(Number(projectId)) || 0) <= 1;
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

function formatDateTimeForApi(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeTaskRows(rows) {
  return rows.map((task) => ({
    ...task,
    deadline: formatDateTimeForApi(task.deadline),
    labels: parseTaskLabels(task.labels),
  }));
}

async function enrichTaskRows(rows) {
  const normalized = normalizeTaskRows(rows);
  const taskIds = [...new Set(normalized.map((task) => Number(task.task_id)).filter(Boolean))];
  if (taskIds.length === 0) return normalized;
  const projectIds = [...new Set(normalized.map((task) => Number(task.project_id)).filter(Boolean))];
  const projectUserCounts = await getProjectUserCounts(projectIds);

  const [assignees] = await pool.query(
    `
    SELECT ta.task_id, ta.user_id, ta.accepted_at, ta.submitted_at,
           u.username, u.email, u.user_photo
    FROM task_assignees ta
    JOIN users u ON u.user_id = ta.user_id
    WHERE ta.task_id IN (?)
    ORDER BY u.username ASC
    `,
    [taskIds],
  );

  const byTask = new Map();
  for (const assignee of assignees) {
    const list = byTask.get(Number(assignee.task_id)) || [];
    list.push(assignee);
    byTask.set(Number(assignee.task_id), list);
  }

  return Promise.all(normalized.map(async (task) => {
    const taskAssignees = byTask.get(Number(task.task_id)) || [];
    const projectUserCount = projectUserCounts.get(Number(task.project_id)) || 0;
    const shouldRepairDraftStatus = taskAssignees.length > 0 && task.status === "DRAFT";
    if (shouldRepairDraftStatus) {
      await pool.query(
        `
        UPDATE tasks
        SET assigned_to = ?, assignment_status = 'approved', status = 'ASSIGNED'
        WHERE task_id = ?
        `,
        [taskAssignees[0].user_id, task.task_id],
      );
    }

    return {
      ...task,
      status: shouldRepairDraftStatus ? "ASSIGNED" : task.status,
      assignment_status: shouldRepairDraftStatus ? "approved" : task.assignment_status,
      assigned_to: shouldRepairDraftStatus ? taskAssignees[0].user_id : task.assigned_to,
      assignees: taskAssignees,
      assignee_ids: taskAssignees.map((assignee) => assignee.user_id),
      assignee_count: taskAssignees.length,
      accepted_count: taskAssignees.filter((assignee) => assignee.accepted_at).length,
      submitted_count: taskAssignees.filter((assignee) => assignee.submitted_at).length,
      project_user_count: projectUserCount,
      is_solo_project: projectUserCount <= 1,
    };
  }));
}

function parseAssigneeIds(value) {
  if (value === undefined || value === null || value === "") return [];
  let values = value;
  if (typeof value === "string") {
    try {
      values = JSON.parse(value);
    } catch {
      values = [value];
    }
  }
  if (!Array.isArray(values)) values = [values];
  return [...new Set(values.map(Number).filter(Number.isInteger))];
}

function hasBodyField(req, field) {
  return Object.prototype.hasOwnProperty.call(req.body || {}, field);
}

function buildDeadlineDate(deadline, time) {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return null;

  if (time) {
    const [hours, minutes] = String(time).split(":");
    deadlineDate.setHours(Number(hours), Number(minutes), 0, 0);
  } else {
    deadlineDate.setHours(0, 0, 0, 0);
  }

  return deadlineDate;
}

function isPastDeadlineDate(deadlineDate) {
  if (!deadlineDate) return false;

  const deadlineDay = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return deadlineDay < today;
}

async function validateAssigneeIds(projectId, assigneeIds) {
  for (const userId of assigneeIds) {
    if ((await getProjectRole(projectId, userId)) !== "member") {
      const error = new Error("Tasks can only be assigned to members");
      error.statusCode = 400;
      throw error;
    }
  }
}

async function replaceTaskAssignees(taskId, assigneeIds) {
  const [existingRows] = await pool.query(
    "SELECT user_id FROM task_assignees WHERE task_id = ?",
    [taskId],
  );
  const existingIds = existingRows.map((row) => Number(row.user_id)).sort();
  const nextIds = [...assigneeIds].map(Number).sort();
  const changed =
    existingIds.length !== nextIds.length ||
    existingIds.some((id, index) => id !== nextIds[index]);

  if (!changed) {
    await pool.query(
      `
      UPDATE tasks
      SET
        assigned_to = ?,
        assignment_status = CASE
          WHEN ? > 0 AND status = 'DRAFT' THEN 'approved'
          WHEN ? = 0 THEN 'none'
          ELSE assignment_status
        END,
        status = CASE
          WHEN ? > 0 AND status = 'DRAFT' THEN 'ASSIGNED'
          WHEN ? = 0 THEN 'DRAFT'
          ELSE status
        END
      WHERE task_id = ?
      `,
      [
        assigneeIds[0] || null,
        assigneeIds.length,
        assigneeIds.length,
        assigneeIds.length,
        assigneeIds.length,
        taskId,
      ],
    );
    return;
  }

  if (nextIds.length === 0) {
    await pool.query("DELETE FROM task_assignees WHERE task_id = ?", [taskId]);
  } else {
    await pool.query(
      "DELETE FROM task_assignees WHERE task_id = ? AND user_id NOT IN (?)",
      [taskId, nextIds],
    );
  }
  for (const userId of assigneeIds) {
    await pool.query(
      "INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)",
      [taskId, userId],
    );
  }
  await pool.query(
    "UPDATE task_assignees SET accepted_at = NULL, submitted_at = NULL WHERE task_id = ?",
    [taskId],
  );
  await pool.query(
    `
    UPDATE tasks
    SET assigned_to = ?, assignment_status = ?, status = ?
    WHERE task_id = ?
    `,
    [
      assigneeIds[0] || null,
      assigneeIds.length > 0 ? "approved" : "none",
      assigneeIds.length > 0 ? "ASSIGNED" : "DRAFT",
      taskId,
    ],
  );
}

async function resolveTaskStageId(projectId, rawStageId) {
  const [[stageSummary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_stages,
      SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) AS open_stages
    FROM project_stages
    WHERE project_id = ?
    `,
    [projectId],
  );

  if (
    Number(stageSummary?.total_stages || 0) > 0 &&
    Number(stageSummary?.open_stages || 0) === 0
  ) {
    const error = new Error("Project is completed. Cannot create new tasks.");
    error.statusCode = 409;
    throw error;
  }

  if (
    rawStageId !== undefined &&
    rawStageId !== null &&
    rawStageId !== "" &&
    rawStageId !== "null" &&
    rawStageId !== "undefined"
  ) {
    const [[stage]] = await pool.query(
      "SELECT id FROM project_stages WHERE id = ? AND project_id = ? LIMIT 1",
      [rawStageId, projectId],
    );

    if (!stage) {
      const error = new Error("Stage does not belong to this project");
      error.statusCode = 400;
      throw error;
    }

    return stage.id;
  }

  const [[activeStage]] = await pool.query(
    `
    SELECT id
    FROM project_stages
    WHERE project_id = ?
      AND status = 'in_progress'
    ORDER BY stage_order ASC
    LIMIT 1
    `,
    [projectId],
  );

  if (activeStage) return activeStage.id;

  const [[nextStage]] = await pool.query(
    `
    SELECT id
    FROM project_stages
    WHERE project_id = ?
      AND status <> 'completed'
    ORDER BY stage_order ASC
    LIMIT 1
    `,
    [projectId],
  );

  return nextStage?.id || null;
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
        p.name AS project_name,
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
    res.json({ success: true, tasks: await enrichTaskRows(rows) });
  } catch (err) {
    console.error("Loi getTasks:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/projects/:projectId/tasks
exports.createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, deadline, time, priority, labels, assigned_to, note, stage_id, stageId } = req.body;
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

    const deadlineDate = buildDeadlineDate(deadline, time);
    if (isPastDeadlineDate(deadlineDate)) {
      return res.status(400).json({
        success: false,
        message: "Ngày đã qua, vui lòng chọn hôm nay hoặc ngày sau.",
      });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    let assignmentStatus = "none";
    const assigneeIds = parseAssigneeIds(assigned_to);
    const assignedTo = assigneeIds[0] || null;

    if (assigneeIds.length > 0) {
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

      await validateAssigneeIds(projectId, assigneeIds);

      assignmentStatus = "approved";
    }

    const taskStageId = await resolveTaskStageId(projectId, stage_id ?? stageId);

    const [result] = await pool.query(
      `
    INSERT INTO tasks 
    (title, description, deadline, time, priority, labels, project_id, assigned_to, assignment_status, created_by, stage_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        taskStageId,
      ],
    );

    const taskId = result.insertId;
    await replaceTaskAssignees(taskId, assigneeIds);
    if (assignmentStatus === "pending") {
      await pool.query("UPDATE tasks SET status = 'DRAFT' WHERE task_id = ?", [taskId]);
    }

    if (assigneeIds.length > 0 && assignmentStatus === "pending") {
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
      for (const userId of assigneeIds) {
        await pool.query(
          "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'assignment_pending', ?)",
          [userId, taskId],
        );
      }
    } else if (assigneeIds.length > 0 && assignmentStatus === "approved") {
      for (const userId of assigneeIds) {
        await pool.query(
          "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_assigned', ?)",
          [userId, taskId],
        );
      }
    }

    await insertTaskAttachments(taskId, getUploadedTaskFiles(req), req.user.id);

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
      LEFT JOIN attachments ta ON ta.task_id = t.task_id
      WHERE t.task_id = ?
      `,
      [taskId],
    );
const enrichedTask = (await enrichTaskRows(rows))[0];

// realtime push
try {
  emitTaskChanged(projectId, {
    type: 'created',
    task: enrichedTask,
  });
} catch (_) {}

res.status(201).json({ success: true, task: enrichedTask });
  } catch (err) {
    console.error("Loi createTask:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : "Lỗi server",
    });
  }
};
// PUT /api/projects/:projectId/tasks/:taskId
exports.updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, deadline, time, priority, labels, assigned_to, stage_id, stageId } = req.body;
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
        message: "Members cannot edit tasks",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    const deadlineDate = buildDeadlineDate(deadline, time);
    if (isPastDeadlineDate(deadlineDate)) {
      return res.status(400).json({
        success: false,
        message: "Ngày đã qua, vui lòng chọn hôm nay hoặc ngày sau.",
      });
    }

    if (assigned_to !== undefined) {
      let assigneeIds = parseAssigneeIds(assigned_to);
      if (await isSoloProject(projectId)) {
        assigneeIds = assigneeIds.filter(
          (userId) => Number(userId) !== Number(req.user.id),
        );
      }
      await validateAssigneeIds(projectId, assigneeIds);
      await replaceTaskAssignees(taskId, assigneeIds);
    }

    let taskStageId = undefined;
    if (hasBodyField(req, "stage_id")) {
      taskStageId = stage_id;
    } else if (hasBodyField(req, "stageId")) {
      taskStageId = stageId;
    }

    if (taskStageId === undefined) {
      const [[existingTask]] = await pool.query(
        "SELECT stage_id FROM tasks WHERE task_id = ? AND project_id = ? AND deleted_at IS NULL",
        [taskId, projectId],
      );
      taskStageId = existingTask ? existingTask.stage_id : null;
    }

    if (taskStageId === "" || taskStageId === "null" || taskStageId === "undefined") {
      taskStageId = null;
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
          labels = ?,
          stage_id = ?
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
        taskStageId,
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

    await insertTaskAttachments(taskId, getUploadedTaskFiles(req), req.user.id);

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
      LEFT JOIN attachments ta ON ta.task_id = t.task_id
      WHERE t.task_id = ? AND t.project_id = ?
      `,
      [taskId, projectId],
    );

const enrichedTask = (await enrichTaskRows(rows))[0];

try {
  emitTaskChanged(projectId, {
    type: 'updated',
    task: enrichedTask,
  });
} catch (_) {}

res.json({
      success: true,
      task: enrichedTask,
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

    const canSelfApproveSoloTask =
      (await isSoloProject(projectId)) &&
      Number(task.created_by) === Number(req.user.id);

    if (!["owner", "leader"].includes(role) && !canSelfApproveSoloTask) {
      const [[assignee]] = await pool.query(
        `
        SELECT *
        FROM task_assignees
        WHERE task_id = ? AND user_id = ?
        `,
        [taskId, req.user.id],
      );

      if (!assignee) {
        return res.status(403).json({
          success: false,
          message: "Only assigned members can update task progress",
        });
      }

      if (task.status === "ASSIGNED") {
        await pool.query(
          "UPDATE task_assignees SET accepted_at = COALESCE(accepted_at, NOW()) WHERE task_id = ? AND user_id = ?",
          [taskId, req.user.id],
        );
        const [[progress]] = await pool.query(
          `
          SELECT COUNT(*) AS total,
                 SUM(accepted_at IS NOT NULL) AS accepted
          FROM task_assignees
          WHERE task_id = ?
          `,
          [taskId],
        );
        if (Number(progress.total) > 0 && Number(progress.accepted) === Number(progress.total)) {
          await pool.query(
            "UPDATE tasks SET status = 'IN_PROGRESS' WHERE task_id = ? AND project_id = ?",
            [taskId, projectId],
          );
        }
        const [rows] = await pool.query(
          "SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON p.project_id = t.project_id WHERE t.task_id = ?",
          [taskId],
        );
        return res.json({
          success: true,
          message: "Task accepted",
          task: (await enrichTaskRows(rows))[0],
        });
      }

      if (!["ACCEPTED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(task.status)) {
        return res.status(409).json({
          success: false,
          message: "Task is not ready for this action",
        });
      }

      await pool.query(
        "UPDATE task_assignees SET submitted_at = COALESCE(submitted_at, NOW()) WHERE task_id = ? AND user_id = ?",
        [taskId, req.user.id],
      );
      const [[submitProgress]] = await pool.query(
        `
        SELECT COUNT(*) AS total,
               SUM(submitted_at IS NOT NULL) AS submitted
        FROM task_assignees
        WHERE task_id = ?
        `,
        [taskId],
      );

      if (Number(submitProgress.submitted) < Number(submitProgress.total)) {
        const [rows] = await pool.query(
          "SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON p.project_id = t.project_id WHERE t.task_id = ?",
          [taskId],
        );
        return res.json({
          success: true,
          pendingMembers: true,
          message: "Waiting for the remaining assigned members.",
          task: (await enrichTaskRows(rows))[0],
        });
      }

      const [[pendingSubmission]] = await pool.query(
        `
        SELECT submission_id
        FROM task_submissions
        WHERE task_id = ?
          AND status = 'pending'
        LIMIT 1
        `,
        [taskId],
      );

      if (!pendingSubmission) {
        await pool.query(
          `
          INSERT INTO task_submissions (task_id, project_id, submitted_by, note)
          VALUES (?, ?, ?, ?)
          `,
          [taskId, projectId, req.user.id, note || null],
        );

        await pool.query(
          `
          DELETE FROM notifications
          WHERE reference_id = ?
            AND type IN ('task_submitted', 'leader_approved_task')
          `,
          [taskId],
        );

        const [leaders] = await pool.query(
          `
          SELECT user_id
          FROM project_members
          WHERE project_id = ?
            AND role = 'leader'
          `,
          [projectId],
        );

        const reviewerIds =
          leaders.length > 0
            ? leaders.map((leader) => leader.user_id)
            : [task.owner_id];

        for (const reviewerId of reviewerIds) {
          await pool.query(
            "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_submitted', ?)",
            [reviewerId, taskId],
          );
        }

        // Nếu không có leader trong project thì owner sẽ duyệt ngay (không đi qua bước leader_approved)
        // Logic này được đảm bảo bởi getTaskSubmissions/reviewTaskSubmission thông qua leader_count.
      }

      await pool.query(
        "UPDATE tasks SET status = 'SUBMITTED' WHERE task_id = ? AND project_id = ?",
        [taskId, projectId],
      );

      const submittedTask = (await enrichTaskRows([{ ...task, status: "SUBMITTED" }]))[0];

      try {
        emitTaskChanged(projectId, {
          type: "submitted",
          task: submittedTask,
        });
      } catch (_) {}

      return res.json({
        success: true,
        pendingApproval: true,
        message: "Task submitted. Waiting for leader approval.",
        task: submittedTask,
      });
    }

    const [result] = await pool.query(
      `
      UPDATE tasks
      SET status = 'COMPLETED',
          completed_at = COALESCE(completed_at, NOW())
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
      return res.status(404).json({ success: false, message: "Task not found" });
    }

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

const enrichedTask = (await enrichTaskRows(rows))[0];

try {
  emitTaskChanged(projectId, {
    type: 'completed',
    task: enrichedTask,
  });
} catch (_) {}

res.json({ success: true, task: enrichedTask });
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

    res.json({ success: true, tasks: await enrichTaskRows(rows) });
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
        message: "Members cannot delete tasks",
      });
    }

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
try {
      emitTaskChanged(projectId, {
        type: 'deleted',
        taskId: Number(taskId),
      });
    } catch (_) {}

res.json({ success: true, message: "Đã xóa task" });
  } catch (err) {
    console.error("Loi deleteTask:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.getTaskDetails = async (req, res) => {
  try {
    await ensureTaskDetailSchema();
    await ensureTaskWorkflowSchema();
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
      ORDER BY attachment_id ASC
      `,
      [taskId]
    );

    const role = await getProjectRole(projectId, req.user.id);
    const [[project]] = await pool.query(
      "SELECT name FROM projects WHERE project_id = ? AND deleted_at IS NULL",
      [projectId],
    );
    const [members] = await pool.query(
      `
      SELECT pm.user_id, pm.role, u.username, u.email, u.user_photo
      FROM project_members pm
      JOIN users u ON u.user_id = pm.user_id
      WHERE pm.project_id = ?
        AND pm.role = 'member'
      ORDER BY u.username ASC
      `,
      [projectId],
    );
    const [assignees] = await pool.query(
      `
      SELECT ta.user_id, ta.accepted_at, ta.submitted_at,
             u.username, u.email, u.user_photo
      FROM task_assignees ta
      JOIN users u ON u.user_id = ta.user_id
      WHERE ta.task_id = ?
      ORDER BY u.username ASC
      `,
      [taskId],
    );

    res.json({
      success: true,
      subtasks,
      comments,
      role,
      attachments: taskAttachments,
      project_name: project?.name || "",
      members,
      assignees,
    });
  } catch (err) {
    console.error("Loi getTaskDetails:", err);
    res.status(500).json({ success: false, message: "Lá»—i server" });
  }
};

exports.deleteTaskAttachment = async (req, res) => {
  try {
    await ensureTaskAttachmentTable();
    const { projectId, taskId, attachmentId } = req.params;

    const role = await getProjectRole(projectId, req.user.id);
    if (!["owner", "leader"].includes(role)) {
      return res.status(403).json({ success: false, message: "You cannot delete task attachments" });
    }

    if (!(await canAccessTask(projectId, taskId, req.user.id))) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const [[attachment]] = await pool.query(
      `
      SELECT attachment_id, fileName
      FROM attachments
      WHERE attachment_id = ?
        AND task_id = ?
        AND comment_id IS NULL
      LIMIT 1
      `,
      [attachmentId, taskId],
    );

    if (!attachment) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    await pool.query("DELETE FROM attachments WHERE attachment_id = ?", [attachmentId]);

    const filePath = path.resolve(__dirname, "../../uploads/files", attachment.fileName);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("Cannot delete attachment file:", err.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Loi deleteTaskAttachment:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
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
    await ensureTaskWorkflowSchema();
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
    res.json({ success: true, tasks: await enrichTaskRows(rows) });
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
    await ensureTaskWorkflowSchema();
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
    res.json({ success: true, tasks: await enrichTaskRows(rows) });
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

    const assigneeRole = await getProjectRole(projectId, assigned_to);
    if (assigneeRole !== "member") {
      return res.status(400).json({
        success: false,
        message: "Tasks can only be assigned to members",
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
        SET assigned_to = ?, assignment_status = 'approved', status = 'ASSIGNED'
        WHERE task_id = ? AND project_id = ?
        `,
        [assigned_to, taskId, projectId],
      );
      await pool.query(
        "INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)",
        [taskId, assigned_to],
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
      SET assigned_to = ?, assignment_status = ?, status = ?
      WHERE task_id = ? AND project_id = ?
      `,
      [
        action === "approve" ? request.assigned_to : null,
        action === "approve" ? "approved" : "rejected",
        action === "approve" ? "ASSIGNED" : "DRAFT",
        request.task_id,
        projectId,
      ],
    );

    if (action === "approve") {
      await pool.query(
        "INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)",
        [request.task_id, request.assigned_to],
      );
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
    const includeHistory = req.query.includeHistory === "true";
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

    let visibleSubmissions = submissions;
    if (includeHistory) {
      visibleSubmissions = submissions;
    } else if (role === "leader") {
      visibleSubmissions = submissions.filter(
        (submission) => submission.status === "pending",
      );
    } else {
      const [[{ leader_count: leaderCount }]] = await pool.query(
        `
        SELECT COUNT(*) AS leader_count
        FROM project_members
        WHERE project_id = ?
          AND role = 'leader'
        `,
        [projectId],
      );
      visibleSubmissions = submissions.filter(
        (submission) =>
          submission.status === "leader_approved" ||
          (Number(leaderCount) === 0 && submission.status === "pending"),
      );
    }

    res.json({ success: true, submissions: visibleSubmissions });
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
    const { projectId, submissionId, taskId } = req.params;
    const { action, reason } = req.body;

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

    const submissionLookup = submissionId
      ? {
          sql: `
            SELECT *
            FROM task_submissions
            WHERE submission_id = ?
              AND project_id = ?
              AND status IN ('pending', 'leader_approved')
          `,
          params: [submissionId, projectId],
        }
      : {
          sql: `
            SELECT *
            FROM task_submissions
            WHERE task_id = ?
              AND project_id = ?
              AND status IN ('pending', 'leader_approved')
            ORDER BY submission_id DESC
            LIMIT 1
          `,
          params: [taskId, projectId],
        };

    const [[submission]] = await pool.query(
      submissionLookup.sql,
      submissionLookup.params,
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Pending submission not found",
      });
    }

    if (role === "leader" && submission.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This submission is waiting for owner approval",
      });
    }

    if (action === "reject") {
      await pool.query(
        `
        UPDATE task_submissions
        SET status = 'rejected', note = ?, reviewed_at = NOW(), reviewed_by = ?
        WHERE submission_id = ?
        `,
        [reason || null, req.user.id, submission.submission_id],
      );
      await pool.query(
        `
        UPDATE tasks
        SET status = 'CHANGES_REQUESTED'
        WHERE task_id = ? AND project_id = ?
        `,
        [submission.task_id, projectId],
      );
      await pool.query(
        "UPDATE task_assignees SET submitted_at = NULL WHERE task_id = ?",
        [submission.task_id],
      );
      await pool.query(
        `
        UPDATE notifications
        SET is_read = 1
        WHERE reference_id = ?
          AND type IN ('task_submitted', 'leader_approved_task')
        `,
        [submission.task_id],
      );
      await pool.query(
        `
        DELETE FROM notifications
        WHERE user_id = ?
          AND reference_id = ?
          AND type = 'task_changes_requested'
        `,
        [submission.submitted_by, submission.task_id],
      );
      const [assignedMembers] = await pool.query(
        "SELECT user_id FROM task_assignees WHERE task_id = ?",
        [submission.task_id],
      );
      for (const member of assignedMembers) {
        await pool.query(
          "DELETE FROM notifications WHERE user_id = ? AND reference_id = ? AND type = 'task_changes_requested'",
          [member.user_id, submission.task_id],
        );
        await pool.query(
          "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'task_changes_requested', ?)",
          [member.user_id, submission.task_id],
        );
      }
    } else if (role === "leader") {
      await pool.query(
        `
        UPDATE task_submissions
        SET status = 'leader_approved', reviewed_at = NOW(), reviewed_by = ?
        WHERE submission_id = ?
        `,
        [req.user.id, submission.submission_id],
      );
      await pool.query(
        `
        UPDATE tasks
        SET status = 'LEADER_APPROVED'
        WHERE task_id = ? AND project_id = ?
        `,
        [submission.task_id, projectId],
      );
      await pool.query(
        `
        UPDATE notifications
        SET is_read = 1
        WHERE reference_id = ?
          AND type = 'task_submitted'
        `,
        [submission.task_id],
      );

      const [[project]] = await pool.query(
        "SELECT owner_id FROM projects WHERE project_id = ?",
        [projectId],
      );
      if (project?.owner_id) {
        await pool.query(
          "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'leader_approved_task', ?)",
          [project.owner_id, submission.task_id],
        );
      }
    } else {
      // Owner duyệt.
      // Nếu project có leader => chỉ chuyển từ pending/leader_approved về trạng thái phù hợp.
      // Nếu project không có leader => owner duyệt thẳng pending => COMPLETED.
      const [[{ leader_count }]] = await pool.query(
        `
        SELECT COUNT(*) AS leader_count
        FROM project_members
        WHERE project_id = ?
          AND role = 'leader'
        `,
        [projectId],
      );

      if (Number(leader_count) > 0) {
        if (submission.status === 'pending') {
          // Trường hợp này không nên xảy ra nếu UI gửi đúng người duyệt,
          // nhưng vẫn xử lý để không bypass luồng.
          return res.status(409).json({
            success: false,
            message: 'Waiting for leader approval',
          });
        }

        // submission.status phải là leader_approved
        await pool.query(
          `
          UPDATE task_submissions
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?
          WHERE submission_id = ?
          `,
          [req.user.id, submission.submission_id],
        );
        await pool.query(
          `
          UPDATE tasks
          SET status = 'COMPLETED', completed_at = COALESCE(completed_at, NOW())
          WHERE task_id = ? AND project_id = ?
          `,
          [submission.task_id, projectId],
        );
        await pool.query(
          `
          UPDATE notifications
          SET is_read = 1
          WHERE reference_id = ?
            AND type IN ('task_submitted', 'leader_approved_task')
          `,
          [submission.task_id],
        );
      } else {
        // Không có leader => owner duyệt thẳng pending => COMPLETED
        await pool.query(
          `
          UPDATE task_submissions
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?
          WHERE submission_id = ?
          `,
          [req.user.id, submission.submission_id],
        );
        await pool.query(
          `
          UPDATE tasks
          SET status = 'COMPLETED', completed_at = COALESCE(completed_at, NOW())
          WHERE task_id = ? AND project_id = ?
          `,
          [submission.task_id, projectId],
        );
        await pool.query(
          `
          UPDATE notifications
          SET is_read = 1
          WHERE reference_id = ?
            AND type IN ('task_submitted', 'leader_approved_task')
          `,
          [submission.task_id],
        );
      }
    }

    const [[updatedTask]] = await pool.query(
      `
      SELECT t.*, p.name AS project_name
      FROM tasks t
      JOIN projects p ON p.project_id = t.project_id
      WHERE t.task_id = ? AND t.project_id = ?
      `,
      [submission.task_id, projectId],
    );

    res.json({
      success: true,
      message:
        action === "reject"
          ? "Task submission rejected"
          : role === "leader"
            ? "Leader approved. Waiting for owner approval."
            : "Task submission approved",
      task: (await enrichTaskRows([updatedTask]))[0],
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
    SELECT t.task_id, t.title,
           CASE
             WHEN t.time IS NULL OR t.time = '00:00:00'
               THEN DATE_ADD(DATE(t.deadline), INTERVAL 1 DAY)
             ELSE t.deadline
           END AS deadline,
           p.name AS project_name,
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
      AND (
        CASE
          WHEN t.time IS NULL OR t.time = '00:00:00'
            THEN DATE_ADD(DATE(t.deadline), INTERVAL 1 DAY)
          ELSE t.deadline
        END
      ) < NOW()
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

// GET /api/projects/:projectId/stages/:stageId/tasks
exports.getTasksByStage = async (req, res) => {
  try {
    const { projectId, stageId } = req.params;
    await ensureTaskCompletionColumn();
    await ensureTaskAttachmentTable();
    await ensureTaskLabelsColumn();
    await ensureTaskWorkflowSchema();

    // Check project role/membership
    const role = await getProjectRole(projectId, req.user.id);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a project member",
      });
    }

    // stageId could be "unassigned" (for tasks with stage_id IS NULL) or a number
    let query = `
      SELECT
        t.*,
        p.name AS project_name,
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
        AND t.deleted_at IS NULL
    `;

    const queryParams = [projectId];

    if (stageId === "unassigned") {
      query += " AND t.stage_id IS NULL";
    } else {
      query += " AND t.stage_id = ?";
      queryParams.push(stageId);
    }

    query += " ORDER BY t.created_at ASC";

    const [rows] = await pool.query(query, queryParams);
    res.json({ success: true, tasks: await enrichTaskRows(rows) });
  } catch (err) {
    console.error("Loi getTasksByStage:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
