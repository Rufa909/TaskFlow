const pool = require("../config/db");
const { emitProjectMessage } = require("../socket");

let initPromise = null;

function ensureProjectMessagesTable() {
  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS project_messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_messages_project_created (project_id, created_at),
        CONSTRAINT fk_project_messages_project
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        CONSTRAINT fk_project_messages_sender
          FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
  }

  return initPromise;
}

async function getAccessibleProject(projectId, userId) {
  const [rows] = await pool.query(
    `SELECT p.project_id, p.name, p.owner_id
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.project_id
      AND pm.user_id = ?
     WHERE p.project_id = ?
       AND p.deleted_at IS NULL
       AND (p.owner_id = ? OR pm.user_id IS NOT NULL)
     LIMIT 1`,
    [userId, projectId, userId],
  );

  return rows[0] || null;
}

function normalizeMessage(row) {
  return {
    message_id: row.message_id,
    project_id: row.project_id,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
    sender_username: row.sender_username,
    sender_email: row.sender_email,
    sender_photo: row.sender_photo,
  };
}

async function fetchMessageById(messageId) {
  const [rows] = await pool.query(
    `SELECT pm.message_id, pm.project_id, pm.sender_id, pm.content, pm.created_at,
            u.username AS sender_username,
            u.email AS sender_email,
            u.user_photo AS sender_photo
     FROM project_messages pm
     JOIN users u ON u.user_id = pm.sender_id
     WHERE pm.message_id = ?
     LIMIT 1`,
    [messageId],
  );

  return rows[0] ? normalizeMessage(rows[0]) : null;
}

const getProjectMessages = async (req, res) => {
  try {
    await ensureProjectMessagesTable();

    const projectId = Number(req.params.projectId);
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied",
      });
    }

    const [rows] = await pool.query(
      `SELECT pm.message_id, pm.project_id, pm.sender_id, pm.content, pm.created_at,
              u.username AS sender_username,
              u.email AS sender_email,
              u.user_photo AS sender_photo
       FROM project_messages pm
       JOIN users u ON u.user_id = pm.sender_id
       WHERE pm.project_id = ?
       ORDER BY pm.created_at DESC, pm.message_id DESC
       LIMIT ?`,
      [projectId, limit],
    );

    res.json({
      success: true,
      project,
      messages: rows.reverse().map(normalizeMessage),
    });
  } catch (err) {
    console.error("Cannot load project messages:", err);
    res.status(500).json({ success: false, message: "Cannot load messages" });
  }
};

const createProjectMessage = async (req, res) => {
  try {
    await ensureProjectMessagesTable();

    const projectId = Number(req.params.projectId);
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const project = await getAccessibleProject(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied",
      });
    }

    const [result] = await pool.query(
      "INSERT INTO project_messages (project_id, sender_id, content) VALUES (?, ?, ?)",
      [projectId, req.user.id, content],
    );

    const message = await fetchMessageById(result.insertId);
    emitProjectMessage(projectId, message);

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error("Cannot create project message:", err);
    res.status(500).json({ success: false, message: "Cannot send message" });
  }
};

module.exports = {
  getProjectMessages,
  createProjectMessage,
};
