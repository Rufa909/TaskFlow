const pool = require("../config/db");
const { emitProjectMessage } = require("../socket");

const PROJECT_ROLES = ["leader", "member", "ba", "developer", "qa", "devops", "viewer"];
const GROUP_ROLES = ["admin", "member"];
let initPromise = null;

async function ensureColumns(tableName, columns) {
  const [existing] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName],
  );
  const existingNames = new Set(existing.map((column) => column.COLUMN_NAME));

  for (const column of columns) {
    if (!existingNames.has(column.name)) {
      await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${column.definition}`);
    }
  }
}

function ensureProjectChatTables() {
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
    `).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS project_chat_conversations (
        conversation_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        type ENUM('direct','group') NOT NULL,
        name VARCHAR(160) NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_chat_conversations_project (project_id, type, created_at),
        CONSTRAINT fk_project_chat_conversations_project
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        CONSTRAINT fk_project_chat_conversations_creator
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `)).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS project_chat_participants (
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('admin','member') NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id),
        INDEX idx_project_chat_participants_user (user_id),
        CONSTRAINT fk_project_chat_participants_conversation
          FOREIGN KEY (conversation_id) REFERENCES project_chat_conversations(conversation_id) ON DELETE CASCADE,
        CONSTRAINT fk_project_chat_participants_user
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `)).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS project_chat_messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_chat_messages_conversation_created (conversation_id, created_at),
        CONSTRAINT fk_project_chat_messages_conversation
          FOREIGN KEY (conversation_id) REFERENCES project_chat_conversations(conversation_id) ON DELETE CASCADE,
        CONSTRAINT fk_project_chat_messages_sender
          FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `)).then(() => Promise.all([
      ensureColumns("project_messages", [
        { name: "attachment_url", definition: "attachment_url VARCHAR(500) NULL" },
        { name: "attachment_name", definition: "attachment_name VARCHAR(255) NULL" },
        { name: "attachment_type", definition: "attachment_type VARCHAR(120) NULL" },
        { name: "attachment_size", definition: "attachment_size INT NULL" },
      ]),
      ensureColumns("project_chat_messages", [
        { name: "attachment_url", definition: "attachment_url VARCHAR(500) NULL" },
        { name: "attachment_name", definition: "attachment_name VARCHAR(255) NULL" },
        { name: "attachment_type", definition: "attachment_type VARCHAR(120) NULL" },
        { name: "attachment_size", definition: "attachment_size INT NULL" },
      ]),
    ]));
  }

  return initPromise;
}

async function getAccessibleProject(projectId, userId) {
  const [rows] = await pool.query(
    `SELECT p.project_id, p.name, p.owner_id,
            CASE WHEN p.owner_id = ? THEN 'owner' ELSE pm.role END AS user_role
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.project_id
      AND pm.user_id = ?
     WHERE p.project_id = ?
       AND p.deleted_at IS NULL
       AND (p.owner_id = ? OR pm.user_id IS NOT NULL)
     LIMIT 1`,
    [userId, userId, projectId, userId],
  );

  return rows[0] || null;
}

async function getProjectMembersRows(projectId) {
  const [members] = await pool.query(
    `SELECT pm.role, pm.joined_at, u.user_id, u.username, u.email, u.user_photo
     FROM project_members pm
     JOIN users u ON pm.user_id = u.user_id
     WHERE pm.project_id = ?`,
    [projectId],
  );

  const [owners] = await pool.query(
    `SELECT u.user_id, u.username, u.email, u.user_photo, 'owner' AS role
     FROM projects p
     JOIN users u ON p.owner_id = u.user_id
     WHERE p.project_id = ? AND p.deleted_at IS NULL`,
    [projectId],
  );

  const ownerIds = new Set(owners.map((owner) => Number(owner.user_id)));
  return [...owners, ...members.filter((member) => !ownerIds.has(Number(member.user_id)))];
}

function normalizeMessage(row, conversationId = null) {
  return {
    message_id: row.message_id,
    project_id: row.project_id,
    conversation_id: conversationId || row.conversation_id || null,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
    sender_username: row.sender_username,
    sender_email: row.sender_email,
    sender_photo: row.sender_photo,
    attachment_url: row.attachment_url || null,
    attachment_name: row.attachment_name || null,
    attachment_type: row.attachment_type || null,
    attachment_size: row.attachment_size || null,
  };
}

function canManageProject(role) {
  return ["owner", "leader"].includes(String(role || "").toLowerCase());
}

async function assertConversationAccess(conversationId, projectId, userId) {
  const [rows] = await pool.query(
    `SELECT c.*, p.role AS participant_role
     FROM project_chat_conversations c
     JOIN project_chat_participants p ON p.conversation_id = c.conversation_id
     WHERE c.conversation_id = ?
       AND c.project_id = ?
       AND p.user_id = ?
     LIMIT 1`,
    [conversationId, projectId, userId],
  );

  return rows[0] || null;
}

async function fetchConversationMessageById(messageId) {
  const [rows] = await pool.query(
    `SELECT m.message_id, m.conversation_id, m.sender_id, m.content, m.created_at,
            m.attachment_url, m.attachment_name, m.attachment_type, m.attachment_size,
            c.project_id,
            u.username AS sender_username,
            u.email AS sender_email,
            u.user_photo AS sender_photo
     FROM project_chat_messages m
     JOIN project_chat_conversations c ON c.conversation_id = m.conversation_id
     JOIN users u ON u.user_id = m.sender_id
     WHERE m.message_id = ?
     LIMIT 1`,
    [messageId],
  );

  return rows[0] ? normalizeMessage(rows[0]) : null;
}

async function fetchProjectMessageById(messageId, conversationId) {
  const [rows] = await pool.query(
    `SELECT pm.message_id, pm.project_id, pm.sender_id, pm.content, pm.created_at,
            pm.attachment_url, pm.attachment_name, pm.attachment_type, pm.attachment_size,
            u.username AS sender_username,
            u.email AS sender_email,
            u.user_photo AS sender_photo
     FROM project_messages pm
     JOIN users u ON u.user_id = pm.sender_id
     WHERE pm.message_id = ?
     LIMIT 1`,
    [messageId],
  );

  return rows[0] ? normalizeMessage(rows[0], conversationId) : null;
}

function projectConversation(project) {
  return {
    conversation_id: `project-${project.project_id}`,
    project_id: project.project_id,
    type: "project",
    name: project.name,
    member_count: null,
    last_message_at: null,
  };
}

const getProjectChatOverview = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied" });
    }

    const members = await getProjectMembersRows(projectId);
    const [conversations] = await pool.query(
      `SELECT c.conversation_id, c.project_id, c.type, c.name, c.created_by, c.created_at,
              COUNT(cp2.user_id) AS member_count,
              GROUP_CONCAT(cp2.user_id) AS participant_ids,
              MAX(m.created_at) AS last_message_at
       FROM project_chat_conversations c
       JOIN project_chat_participants cp ON cp.conversation_id = c.conversation_id
       LEFT JOIN project_chat_participants cp2 ON cp2.conversation_id = c.conversation_id
       LEFT JOIN project_chat_messages m ON m.conversation_id = c.conversation_id
       WHERE c.project_id = ? AND cp.user_id = ?
       GROUP BY c.conversation_id
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC`,
      [projectId, req.user.id],
    );

    res.json({
      success: true,
      project,
      members,
      conversations: [
        projectConversation(project),
        ...conversations.map((conversation) => ({
          ...conversation,
          participants: String(conversation.participant_ids || "")
            .split(",")
            .map(Number)
            .filter(Boolean),
        })),
      ],
      can_manage_project: canManageProject(project.user_role),
    });
  } catch (err) {
    console.error("Cannot load project chat overview:", err);
    res.status(500).json({ success: false, message: "Cannot load project chat" });
  }
};

const getProjectMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();

    const projectId = Number(req.params.projectId);
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied" });
    }

    const [rows] = await pool.query(
      `SELECT pm.message_id, pm.project_id, pm.sender_id, pm.content, pm.created_at,
              pm.attachment_url, pm.attachment_name, pm.attachment_type, pm.attachment_size,
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

    const conversationId = `project-${projectId}`;
    res.json({
      success: true,
      project,
      conversation: projectConversation(project),
      messages: rows.reverse().map((row) => normalizeMessage(row, conversationId)),
    });
  } catch (err) {
    console.error("Cannot load project messages:", err);
    res.status(500).json({ success: false, message: "Cannot load messages" });
  }
};

const getConversationMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = project && await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found or access denied" });
    }

    const [rows] = await pool.query(
      `SELECT m.message_id, m.conversation_id, m.sender_id, m.content, m.created_at,
              m.attachment_url, m.attachment_name, m.attachment_type, m.attachment_size,
              u.username AS sender_username,
              u.email AS sender_email,
              u.user_photo AS sender_photo
       FROM project_chat_messages m
       JOIN users u ON u.user_id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at DESC, m.message_id DESC
       LIMIT ?`,
      [conversationId, limit],
    );

    res.json({ success: true, conversation, messages: rows.reverse().map(normalizeMessage) });
  } catch (err) {
    console.error("Cannot load conversation messages:", err);
    res.status(500).json({ success: false, message: "Cannot load messages" });
  }
};

const createProjectMessage = async (req, res) => {
  try {
    await ensureProjectChatTables();

    const projectId = Number(req.params.projectId);
    const content = String(req.body.content || "").trim();
    const conversationId = req.body.conversation_id || `project-${projectId}`;
    const attachment = req.file ? {
      url: `/uploads/files/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    } : null;

    if (!content && !attachment) {
      return res.status(400).json({ success: false, message: "Message content or attachment is required" });
    }

    const project = await getAccessibleProject(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied" });
    }

    if (String(conversationId) === `project-${projectId}`) {
      const [result] = await pool.query(
        `INSERT INTO project_messages
         (project_id, sender_id, content, attachment_url, attachment_name, attachment_type, attachment_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          req.user.id,
          content,
          attachment?.url || null,
          attachment?.name || null,
          attachment?.type || null,
          attachment?.size || null,
        ],
      );
      const message = await fetchProjectMessageById(result.insertId, conversationId);
      emitProjectMessage(projectId, message, conversationId);
      return res.status(201).json({ success: true, message });
    }

    const conversation = await assertConversationAccess(Number(conversationId), projectId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found or access denied" });
    }

    const [result] = await pool.query(
      `INSERT INTO project_chat_messages
       (conversation_id, sender_id, content, attachment_url, attachment_name, attachment_type, attachment_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        conversation.conversation_id,
        req.user.id,
        content,
        attachment?.url || null,
        attachment?.name || null,
        attachment?.type || null,
        attachment?.size || null,
      ],
    );
    const message = await fetchConversationMessageById(result.insertId);
    emitProjectMessage(projectId, message, conversation.conversation_id);
    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error("Cannot create project message:", err);
    res.status(500).json({ success: false, message: "Cannot send message" });
  }
};

const createConversation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const type = req.body.type;
    const name = String(req.body.name || "").trim();
    const memberIds = [...new Set((req.body.member_ids || []).map(Number).filter(Boolean))];
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied" });
    }
    if (!["direct", "group"].includes(type)) {
      return res.status(400).json({ success: false, message: "Conversation type is invalid" });
    }
    if (type === "direct" && memberIds.length !== 1) {
      return res.status(400).json({ success: false, message: "Direct chat needs exactly one member" });
    }
    if (type === "group" && (!name || memberIds.length === 0)) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
    }

    const participants = [...new Set([req.user.id, ...memberIds])];
    const members = await getProjectMembersRows(projectId);
    const memberSet = new Set(members.map((member) => Number(member.user_id)));
    if (participants.some((id) => !memberSet.has(Number(id)))) {
      return res.status(400).json({ success: false, message: "All chat members must belong to this project" });
    }

    if (type === "direct") {
      const otherId = memberIds[0];
      const [existing] = await pool.query(
        `SELECT c.conversation_id
         FROM project_chat_conversations c
         JOIN project_chat_participants me ON me.conversation_id = c.conversation_id AND me.user_id = ?
         JOIN project_chat_participants them ON them.conversation_id = c.conversation_id AND them.user_id = ?
         WHERE c.project_id = ? AND c.type = 'direct'
         LIMIT 1`,
        [req.user.id, otherId, projectId],
      );
      if (existing.length > 0) {
        return res.status(200).json({ success: true, conversation: { conversation_id: existing[0].conversation_id } });
      }
    }

    await connection.beginTransaction();
    const [created] = await connection.query(
      "INSERT INTO project_chat_conversations (project_id, type, name, created_by) VALUES (?, ?, ?, ?)",
      [projectId, type, type === "group" ? name : null, req.user.id],
    );
    for (const userId of participants) {
      await connection.query(
        "INSERT INTO project_chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
        [created.insertId, userId, Number(userId) === Number(req.user.id) ? "admin" : "member"],
      );
    }
    await connection.commit();

    res.status(201).json({
      success: true,
      conversation: {
        conversation_id: created.insertId,
        project_id: projectId,
        type,
        name: type === "group" ? name : null,
        member_count: participants.length,
        participants,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Cannot create conversation:", err);
    res.status(500).json({ success: false, message: "Cannot create conversation" });
  } finally {
    connection.release();
  }
};

const addProjectMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = req.body.role || "member";
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project || !canManageProject(project.user_role)) {
      return res.status(403).json({ success: false, message: "Only owner or leader can add members" });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    if (!PROJECT_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Role is invalid" });
    }

    const [users] = await pool.query(
      "SELECT user_id, username, email, user_photo FROM users WHERE LOWER(email) = ? LIMIT 1",
      [email],
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (Number(users[0].user_id) === Number(project.owner_id)) {
      return res.status(400).json({ success: false, message: "User is already the project owner" });
    }

    const [existingMembers] = await pool.query(
      "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1",
      [projectId, users[0].user_id],
    );

    if (existingMembers.length > 0) {
      await pool.query(
        "UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?",
        [role, projectId, users[0].user_id],
      );
    } else {
      await pool.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
        [projectId, users[0].user_id, role],
      );
    }

    res.status(201).json({ success: true, member: { ...users[0], role } });
  } catch (err) {
    console.error("Cannot add project member:", err);
    res.status(500).json({ success: false, message: "Cannot add member" });
  }
};

const addConversationMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const userId = Number(req.body.user_id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!conversation || conversation.type !== "group" || conversation.participant_role !== "admin") {
      return res.status(403).json({ success: false, message: "Only group admin can add members" });
    }

    const members = await getProjectMembersRows(projectId);
    if (!members.some((member) => Number(member.user_id) === userId)) {
      return res.status(400).json({ success: false, message: "User must belong to this project first" });
    }

    await pool.query(
      "INSERT IGNORE INTO project_chat_participants (conversation_id, user_id, role) VALUES (?, ?, 'member')",
      [conversationId, userId],
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Cannot add conversation member:", err);
    res.status(500).json({ success: false, message: "Cannot add group member" });
  }
};

const updateConversationMemberRole = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const userId = Number(req.params.userId);
    const role = req.body.role;
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!conversation || conversation.type !== "group" || conversation.participant_role !== "admin") {
      return res.status(403).json({ success: false, message: "Only group admin can promote members" });
    }
    if (!GROUP_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Role is invalid" });
    }

    const [result] = await pool.query(
      "UPDATE project_chat_participants SET role = ? WHERE conversation_id = ? AND user_id = ?",
      [role, conversationId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Group member not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot update conversation member role:", err);
    res.status(500).json({ success: false, message: "Cannot promote group member" });
  }
};

module.exports = {
  getProjectChatOverview,
  getProjectMessages,
  getConversationMessages,
  createProjectMessage,
  createConversation,
  addProjectMember,
  addConversationMember,
  updateConversationMemberRole,
};
