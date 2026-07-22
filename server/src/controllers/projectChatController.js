const pool = require("../config/db");

const PROJECT_ROLES = ["leader", "member", "ba", "developer", "qa", "devops", "viewer"];
const GROUP_ROLES = ["admin", "member"];
let initPromise = null;
let notificationSchemaPromise = null;

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
        project_id INT NULL,
        type ENUM('direct','group') NOT NULL,
        name VARCHAR(160) NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_chat_conversations_project (project_id, type, created_at),
        CONSTRAINT fk_project_chat_conversations_project
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL,
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
      pool.query(`
        CREATE TABLE IF NOT EXISTS project_removed_members (
          project_id INT NOT NULL,
          user_id INT NOT NULL,
          removed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (project_id, user_id),
          INDEX idx_project_removed_members_user (user_id),
          CONSTRAINT fk_project_removed_members_project
            FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          CONSTRAINT fk_project_removed_members_user
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `),
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
      ensureColumns("project_chat_conversations", [
        { name: "disbanded_at", definition: "disbanded_at TIMESTAMP NULL" },
      ]),
      ensureDirectConversationSchema(),
      ensureColumns("project_chat_participants", [
        { name: "removed_at", definition: "removed_at TIMESTAMP NULL" },
        { name: "cleared_at", definition: "cleared_at TIMESTAMP NULL" },
        { name: "hidden_at", definition: "hidden_at TIMESTAMP NULL" },
      ]),
    ]));
  }

  return initPromise;
}

async function ensureDirectConversationSchema() {
  const [columns] = await pool.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'project_chat_conversations'
       AND COLUMN_NAME = 'project_id'
     LIMIT 1`,
  );

  if (columns[0]?.IS_NULLABLE === "NO") {
    const [constraints] = await pool.query(
      `SELECT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'project_chat_conversations'
         AND COLUMN_NAME = 'project_id'
         AND REFERENCED_TABLE_NAME = 'projects'`,
    );

    for (const constraint of constraints) {
      await pool.query(
        `ALTER TABLE project_chat_conversations DROP FOREIGN KEY ${pool.escapeId(constraint.CONSTRAINT_NAME)}`,
      );
    }

    await pool.query("ALTER TABLE project_chat_conversations MODIFY COLUMN project_id INT NULL");
    await pool.query(
      `ALTER TABLE project_chat_conversations
       ADD CONSTRAINT fk_project_chat_conversations_project
       FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL`,
    );
  }
}

async function getAccessibleProject(projectId, userId) {
  const [rows] = await pool.query(
    `SELECT p.project_id, p.name, p.owner_id,
            CASE
              WHEN p.owner_id = ? THEN 'owner'
              WHEN pm.user_id IS NOT NULL THEN pm.role
              WHEN prm.user_id IS NOT NULL THEN 'removed'
              ELSE NULL
            END AS user_role,
            prm.removed_at AS project_removed_at
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.project_id
      AND pm.user_id = ?
     LEFT JOIN project_removed_members prm
       ON prm.project_id = p.project_id
      AND prm.user_id = ?
     WHERE p.project_id = ?
       AND p.deleted_at IS NULL
       AND (p.owner_id = ? OR pm.user_id IS NOT NULL OR prm.user_id IS NOT NULL)
     LIMIT 1`,
    [userId, userId, userId, projectId, userId],
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

function canManageGroupConversation(conversation, project, userId, { allowDisbanded = false } = {}) {
  if (!conversation || conversation.type !== "group" || conversation.removed_at) return false;
  if (!allowDisbanded && conversation.disbanded_at) return false;
  return conversation.participant_role === "admin"
    || Number(conversation.created_by) === Number(userId)
    || canManageProject(project?.user_role);
}

async function assertConversationAccess(conversationId, projectId, userId) {
  const [rows] = await pool.query(
    `SELECT c.*, p.role AS participant_role, p.removed_at AS removed_at,
            p.cleared_at AS cleared_at, p.hidden_at AS hidden_at
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
    removed_at: project.project_removed_at || null,
  };
}

async function assertDirectConversationAccess(conversationId, userId) {
  const [rows] = await pool.query(
    `SELECT c.*, p.role AS participant_role, p.removed_at AS removed_at,
            p.cleared_at AS cleared_at, p.hidden_at AS hidden_at
     FROM project_chat_conversations c
     JOIN project_chat_participants p ON p.conversation_id = c.conversation_id
     WHERE c.conversation_id = ?
       AND c.type = 'direct'
       AND p.user_id = ?
     LIMIT 1`,
    [conversationId, userId],
  );

  return rows[0] || null;
}

async function assertGlobalGroupConversationAccess(conversationId, userId) {
  const [rows] = await pool.query(
    `SELECT c.*, p.role AS participant_role, p.removed_at AS removed_at,
            p.cleared_at AS cleared_at, p.hidden_at AS hidden_at,
            pm.role AS project_role,
            CASE WHEN pr.owner_id = ? THEN 'owner' ELSE NULL END AS project_owner_role
     FROM project_chat_conversations c
     JOIN project_chat_participants p ON p.conversation_id = c.conversation_id
     LEFT JOIN projects pr
       ON pr.project_id = c.project_id
      AND pr.deleted_at IS NULL
     LEFT JOIN project_members pm
       ON pm.project_id = c.project_id
      AND pm.user_id = ?
     WHERE c.conversation_id = ?
       AND c.type = 'group'
       AND p.user_id = ?
     LIMIT 1`,
    [userId, userId, conversationId, userId],
  );

  return rows[0] || null;
}

function canManageGlobalGroupConversation(conversation, userId, { allowDisbanded = false } = {}) {
  if (!conversation || conversation.type !== "group" || conversation.removed_at) return false;
  if (!allowDisbanded && conversation.disbanded_at) return false;
  return conversation.participant_role === "admin"
    || Number(conversation.created_by) === Number(userId)
    || canManageProject(conversation.project_owner_role || conversation.project_role);
}

function normalizeConversation(row) {
  const participantRoles = {};
  String(row.participant_roles || "")
    .split(",")
    .filter(Boolean)
    .forEach((entry) => {
      const [userId, role] = entry.split(":");
      if (userId && role) participantRoles[userId] = role;
    });

  return {
    ...row,
    participants: String(row.participant_ids || "")
      .split(",")
      .map(Number)
      .filter(Boolean),
    participant_roles: participantRoles,
  };
}

async function ensureChatNotificationSchema() {
  if (!notificationSchemaPromise) {
    notificationSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          noti_id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          type VARCHAR(80) NOT NULL,
          reference_id INT NULL,
          is_read TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notifications_user_created (user_id, created_at)
        )
      `);

      const [columns] = await pool.query(
        `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'notifications'
           AND COLUMN_NAME = 'type'
         LIMIT 1`,
      );
      const column = columns[0];
      const columnType = String(column?.COLUMN_TYPE || "");
      if (!columnType.startsWith("enum(")) return;

      const values = [...columnType.matchAll(/'((?:''|[^'])*)'/g)]
        .map((match) => match[1].replace(/''/g, "'"));
      const nextValues = [...new Set([...values, "chat_message", "project_chat_message", "group_invited"])];
      if (nextValues.length === values.length) return;

      const nullable = column.IS_NULLABLE === "NO" ? "NOT NULL" : "NULL";
      const defaultClause = column.COLUMN_DEFAULT == null
        ? ""
        : ` DEFAULT ${pool.escape(column.COLUMN_DEFAULT)}`;

      await pool.query(
        `ALTER TABLE notifications MODIFY COLUMN type ENUM(${nextValues.map((value) => pool.escape(value)).join(",")}) ${nullable}${defaultClause}`,
      );
    })();
  }

  return notificationSchemaPromise;
}

async function createChatNotifications(type, messageId, recipientIds, senderId) {
  const uniqueRecipients = [...new Set(recipientIds.map(Number).filter(Boolean))]
    .filter((userId) => Number(userId) !== Number(senderId));

  if (uniqueRecipients.length === 0) return;

  try {
    await ensureChatNotificationSchema();
    await pool.query(
      "INSERT INTO notifications (user_id, type, reference_id) VALUES ?",
      [uniqueRecipients.map((userId) => [userId, type, messageId])],
    );
  } catch (err) {
    console.error("Cannot create chat notifications:", err);
  }
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
      `SELECT c.conversation_id, c.project_id, c.type, c.name, c.created_by, c.created_at, c.disbanded_at,
              MAX(cp.role) AS participant_role,
              MAX(cp.removed_at) AS removed_at,
              MAX(cp.cleared_at) AS cleared_at,
              MAX(cp.hidden_at) AS hidden_at,
              COUNT(cp2.user_id) AS member_count,
              GROUP_CONCAT(DISTINCT cp2.user_id) AS participant_ids,
              GROUP_CONCAT(DISTINCT CONCAT(cp2.user_id, ':', cp2.role)) AS participant_roles,
              MAX(m.created_at) AS last_message_at
       FROM project_chat_conversations c
       JOIN project_chat_participants cp ON cp.conversation_id = c.conversation_id
       LEFT JOIN project_chat_participants cp2
         ON cp2.conversation_id = c.conversation_id
        AND cp2.removed_at IS NULL
       LEFT JOIN project_chat_messages m ON m.conversation_id = c.conversation_id
       WHERE c.project_id = ?
         AND cp.user_id = ?
         AND cp.removed_at IS NULL
       GROUP BY c.conversation_id
       HAVING MAX(cp.hidden_at) IS NULL OR MAX(m.created_at) > MAX(cp.hidden_at)
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC`,
      [projectId, req.user.id],
    );
    const [chatUsers] = await pool.query(
      `SELECT DISTINCT u.user_id, u.username, u.email, u.user_photo
       FROM project_chat_conversations c
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
       JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
       JOIN users u ON u.user_id = cp.user_id
       WHERE c.project_id = ?`,
      [req.user.id, projectId],
    );

    res.json({
      success: true,
      project,
      members,
      chat_users: chatUsers,
      conversations: [
        projectConversation(project),
        ...conversations.map(normalizeConversation),
      ],
      can_manage_project: canManageProject(project.user_role),
    });
  } catch (err) {
    console.error("Cannot load project chat overview:", err);
    res.status(500).json({ success: false, message: "Cannot load project chat" });
  }
};

const getDirectConversations = async (req, res) => {
  try {
    await ensureProjectChatTables();

    const [conversations] = await pool.query(
      `SELECT c.conversation_id, c.project_id, p.name AS project_name, c.type, c.name, c.created_by,
              c.created_at, c.disbanded_at,
              MAX(me.role) AS participant_role,
              MAX(me.removed_at) AS removed_at,
              MAX(me.cleared_at) AS cleared_at,
              MAX(me.hidden_at) AS hidden_at,
              COUNT(cp.user_id) AS member_count,
              GROUP_CONCAT(DISTINCT cp.user_id) AS participant_ids,
              GROUP_CONCAT(DISTINCT CONCAT(cp.user_id, ':', cp.role)) AS participant_roles,
              MAX(m.created_at) AS last_message_at
       FROM project_chat_conversations c
       LEFT JOIN projects p
         ON p.project_id = c.project_id
        AND p.deleted_at IS NULL
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
        AND me.removed_at IS NULL
       LEFT JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
        AND cp.removed_at IS NULL
       LEFT JOIN project_chat_messages m ON m.conversation_id = c.conversation_id
       WHERE c.type = 'direct'
       GROUP BY c.conversation_id, c.project_id, p.name, c.type, c.name, c.created_by, c.created_at, c.disbanded_at
       HAVING MAX(me.hidden_at) IS NULL OR MAX(m.created_at) > MAX(me.hidden_at)
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC`,
      [req.user.id],
    );

    const [chatUsers] = await pool.query(
      `SELECT DISTINCT u.user_id, u.username, u.email, u.user_photo
       FROM project_chat_conversations c
       LEFT JOIN projects p
         ON p.project_id = c.project_id
        AND p.deleted_at IS NULL
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
        AND me.removed_at IS NULL
       JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
        AND cp.removed_at IS NULL
       JOIN users u ON u.user_id = cp.user_id
       WHERE c.type = 'direct'`,
      [req.user.id],
    );

    res.json({
      success: true,
      conversations: conversations.map(normalizeConversation),
      chat_users: chatUsers,
    });
  } catch (err) {
    console.error("Cannot load direct conversations:", err);
    res.status(500).json({ success: false, message: "Cannot load direct chats" });
  }
};

const getGroupConversations = async (req, res) => {
  try {
    await ensureProjectChatTables();

    const [conversations] = await pool.query(
      `SELECT c.conversation_id, c.project_id, p.name AS project_name, c.type, c.name, c.created_by,
              c.created_at, c.disbanded_at,
              MAX(me.role) AS participant_role,
              MAX(me.removed_at) AS removed_at,
              MAX(me.cleared_at) AS cleared_at,
              MAX(me.hidden_at) AS hidden_at,
              COUNT(cp.user_id) AS member_count,
              GROUP_CONCAT(DISTINCT cp.user_id) AS participant_ids,
              GROUP_CONCAT(DISTINCT CONCAT(cp.user_id, ':', cp.role)) AS participant_roles,
              MAX(m.created_at) AS last_message_at
       FROM project_chat_conversations c
       LEFT JOIN projects p
         ON p.project_id = c.project_id
        AND p.deleted_at IS NULL
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
        AND me.removed_at IS NULL
       LEFT JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
        AND cp.removed_at IS NULL
       LEFT JOIN project_chat_messages m ON m.conversation_id = c.conversation_id
       WHERE c.type = 'group'
       GROUP BY c.conversation_id, c.project_id, p.name, c.type, c.name, c.created_by, c.created_at, c.disbanded_at
       HAVING MAX(me.hidden_at) IS NULL OR MAX(m.created_at) > MAX(me.hidden_at)
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC`,
      [req.user.id],
    );

    const [chatUsers] = await pool.query(
      `SELECT DISTINCT u.user_id, u.username, u.email, u.user_photo
       FROM project_chat_conversations c
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
        AND me.removed_at IS NULL
       JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
        AND cp.removed_at IS NULL
       JOIN users u ON u.user_id = cp.user_id
       WHERE c.type = 'group'`,
      [req.user.id],
    );

    res.json({
      success: true,
      conversations: conversations.map(normalizeConversation),
      chat_users: chatUsers,
    });
  } catch (err) {
    console.error("Cannot load group conversations:", err);
    res.status(500).json({ success: false, message: "Cannot load groups" });
  }
};

const searchGlobalChatUsers = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const query = String(req.query.q || "").trim().toLowerCase();

    if (query.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const [users] = await pool.query(
      `SELECT user_id, username, email, user_photo
       FROM users
       WHERE user_id <> ?
         AND LOWER(email) LIKE ?
       ORDER BY
         CASE WHEN LOWER(email) = ? THEN 0 ELSE 1 END,
         email ASC
       LIMIT 8`,
      [req.user.id, `%${query}%`, query],
    );

    res.json({ success: true, users });
  } catch (err) {
    console.error("Cannot search global chat users:", err);
    res.status(500).json({ success: false, message: "Cannot search users" });
  }
};

const createDirectConversation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureProjectChatTables();
    const email = String(req.body.email || "").trim().toLowerCase();
    let targetUserId = Number(req.body.user_id);
    if (!email && !targetUserId) {
      return res.status(400).json({ success: false, message: "Email or user_id is required" });
    }

    if (email) {
      const [users] = await pool.query(
        "SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1",
        [email],
      );
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: "User email not found" });
      }
      targetUserId = Number(users[0].user_id);
    }

    if (!targetUserId || Number(targetUserId) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: "Direct chat member is invalid" });
    }

    const [existing] = await pool.query(
      `SELECT c.conversation_id, c.project_id, p.name AS project_name, c.type, c.name, c.created_by,
              c.created_at, c.disbanded_at,
              MAX(me.role) AS participant_role,
              MAX(me.removed_at) AS removed_at,
              COUNT(cp.user_id) AS member_count,
              GROUP_CONCAT(DISTINCT cp.user_id) AS participant_ids,
              GROUP_CONCAT(DISTINCT CONCAT(cp.user_id, ':', cp.role)) AS participant_roles,
              MAX(m.created_at) AS last_message_at
       FROM project_chat_conversations c
       LEFT JOIN projects p
         ON p.project_id = c.project_id
        AND p.deleted_at IS NULL
       JOIN project_chat_participants me
         ON me.conversation_id = c.conversation_id
        AND me.user_id = ?
        AND me.removed_at IS NULL
       JOIN project_chat_participants them
         ON them.conversation_id = c.conversation_id
        AND them.user_id = ?
        AND them.removed_at IS NULL
       LEFT JOIN project_chat_participants cp
         ON cp.conversation_id = c.conversation_id
        AND cp.removed_at IS NULL
       LEFT JOIN project_chat_messages m ON m.conversation_id = c.conversation_id
       WHERE c.type = 'direct'
       GROUP BY c.conversation_id, c.project_id, p.name, c.type, c.name, c.created_by, c.created_at, c.disbanded_at
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
       LIMIT 1`,
      [req.user.id, targetUserId],
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE project_chat_participants SET hidden_at = NULL WHERE conversation_id = ? AND user_id = ?",
        [existing[0].conversation_id, req.user.id],
      );
      return res.json({ success: true, conversation: normalizeConversation(existing[0]) });
    }

    await connection.beginTransaction();
    const [created] = await connection.query(
      "INSERT INTO project_chat_conversations (project_id, type, name, created_by) VALUES (?, 'direct', NULL, ?)",
      [null, req.user.id],
    );
    await connection.query(
      "INSERT INTO project_chat_participants (conversation_id, user_id, role) VALUES (?, ?, 'admin'), (?, ?, 'member')",
      [created.insertId, req.user.id, created.insertId, targetUserId],
    );
    await connection.commit();

    res.status(201).json({
      success: true,
      conversation: {
        conversation_id: created.insertId,
        project_id: null,
        project_name: null,
        type: "direct",
        name: null,
        created_by: req.user.id,
        participant_role: "admin",
        participant_roles: {
          [req.user.id]: "admin",
          [targetUserId]: "member",
        },
        member_count: 2,
        participants: [req.user.id, targetUserId],
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Cannot create direct conversation:", err);
    res.status(500).json({ success: false, message: "Cannot create direct chat" });
  } finally {
    connection.release();
  }
};

const createGroupConversation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureProjectChatTables();
    const name = String(req.body.name || "").trim();
    const memberIds = [...new Set((req.body.member_ids || []).map(Number).filter(Boolean))];
    const inviteEmails = [
      ...new Set(
        (Array.isArray(req.body.invite_emails)
          ? req.body.invite_emails
          : String(req.body.invite_email || "")
              .split(","))
          .map((email) => String(email || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    if (!name || (memberIds.length === 0 && inviteEmails.length === 0)) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
    }

    let invitedMemberIds = [];
    if (inviteEmails.length > 0) {
      const [invitedUsers] = await pool.query(
        `SELECT user_id, email
         FROM users
         WHERE LOWER(email) IN (?)`,
        [inviteEmails],
      );
      const foundEmails = new Set(invitedUsers.map((item) => String(item.email || "").toLowerCase()));
      const missingEmails = inviteEmails.filter((email) => !foundEmails.has(email));
      if (missingEmails.length > 0) {
        return res.status(404).json({
          success: false,
          message: `User email not found: ${missingEmails.join(", ")}`,
        });
      }
      invitedMemberIds = invitedUsers.map((item) => Number(item.user_id));
    }

    const participants = [...new Set([req.user.id, ...memberIds, ...invitedMemberIds])]
      .filter(Boolean);
    if (participants.length < 2) {
      return res.status(400).json({ success: false, message: "Group needs at least one other member" });
    }

    await connection.beginTransaction();
    const [created] = await connection.query(
      "INSERT INTO project_chat_conversations (project_id, type, name, created_by) VALUES (NULL, 'group', ?, ?)",
      [name, req.user.id],
    );
    for (const userId of participants) {
      await connection.query(
        "INSERT INTO project_chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
        [created.insertId, userId, Number(userId) === Number(req.user.id) ? "admin" : "member"],
      );
    }
    await connection.commit();
    await createChatNotifications("group_invited", created.insertId, participants, req.user.id);

    res.status(201).json({
      success: true,
      conversation: {
        conversation_id: created.insertId,
        project_id: null,
        project_name: null,
        type: "group",
        name,
        created_by: req.user.id,
        participant_role: "admin",
        participant_roles: participants.reduce((roles, userId) => ({
          ...roles,
          [userId]: Number(userId) === Number(req.user.id) ? "admin" : "member",
        }), {}),
        member_count: participants.length,
        participants,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Cannot create group conversation:", err);
    res.status(500).json({ success: false, message: "Cannot create group" });
  } finally {
    connection.release();
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
    if (conversation.disbanded_at) {
      return res.json({ success: true, conversation, messages: [] });
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
         AND (? IS NULL OR m.created_at > ?)
       ORDER BY m.created_at DESC, m.message_id DESC
       LIMIT ?`,
      [conversationId, conversation.cleared_at, conversation.cleared_at, limit],
    );

    res.json({ success: true, conversation, messages: rows.reverse().map(normalizeMessage) });
  } catch (err) {
    console.error("Cannot load conversation messages:", err);
    res.status(500).json({ success: false, message: "Cannot load messages" });
  }
};

const getDirectConversationMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const conversation = await assertDirectConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Direct chat not found or access denied" });
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
         AND (? IS NULL OR m.created_at > ?)
       ORDER BY m.created_at DESC, m.message_id DESC
       LIMIT ?`,
      [conversationId, conversation.cleared_at, conversation.cleared_at, limit],
    );

    res.json({ success: true, conversation, messages: rows.reverse().map(normalizeMessage) });
  } catch (err) {
    console.error("Cannot load direct messages:", err);
    res.status(500).json({ success: false, message: "Cannot load direct messages" });
  }
};

async function removeConversationNotificationsForUser(conversationId, userId) {
  await ensureChatNotificationSchema();
  await pool.query(
    `DELETE n
     FROM notifications n
     JOIN project_chat_messages m
       ON m.message_id = n.reference_id
      AND n.type = 'chat_message'
     WHERE n.user_id = ?
       AND m.conversation_id = ?`,
    [userId, conversationId],
  );
  await pool.query(
    "DELETE FROM notifications WHERE user_id = ? AND type = 'group_invited' AND reference_id = ?",
    [userId, conversationId],
  );
}

async function clearConversationForUser(conversationId, userId, { hide = false } = {}) {
  await pool.query(
    `UPDATE project_chat_participants
     SET cleared_at = NOW(),
         hidden_at = ${hide ? "NOW()" : "NULL"}
     WHERE conversation_id = ?
       AND user_id = ?
       AND removed_at IS NULL`,
    [conversationId, userId],
  );
  await removeConversationNotificationsForUser(conversationId, userId);
}

const clearDirectConversationMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertDirectConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Direct chat not found or access denied" });
    }

    await clearConversationForUser(conversationId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Cannot clear direct messages:", err);
    res.status(500).json({ success: false, message: "Cannot clear direct chat history" });
  }
};

const removeDirectConversationForMe = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertDirectConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Direct chat not found or access denied" });
    }

    await clearConversationForUser(conversationId, req.user.id, { hide: true });

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot remove direct chat:", err);
    res.status(500).json({ success: false, message: "Cannot remove direct chat" });
  }
};

const createDirectConversationMessage = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const content = String(req.body.content || "").trim();
    const attachment = req.file ? {
      url: `/uploads/files/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    } : null;

    if (!content && !attachment) {
      return res.status(400).json({ success: false, message: "Message content or attachment is required" });
    }

    const conversation = await assertDirectConversationAccess(conversationId, req.user.id);
    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Direct chat not found or access denied" });
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
    const [participants] = await pool.query(
      "SELECT user_id FROM project_chat_participants WHERE conversation_id = ? AND removed_at IS NULL",
      [conversation.conversation_id],
    );
    await createChatNotifications(
      "chat_message",
      result.insertId,
      participants.map((participant) => participant.user_id),
      req.user.id,
    );

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error("Cannot create direct message:", err);
    res.status(500).json({ success: false, message: "Cannot send direct message" });
  }
};

const getGroupConversationMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Group not found or access denied" });
    }
    if (conversation.disbanded_at) {
      return res.json({ success: true, conversation, messages: [] });
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
         AND (? IS NULL OR m.created_at > ?)
       ORDER BY m.created_at DESC, m.message_id DESC
       LIMIT ?`,
      [conversationId, conversation.cleared_at, conversation.cleared_at, limit],
    );

    res.json({ success: true, conversation, messages: rows.reverse().map(normalizeMessage) });
  } catch (err) {
    console.error("Cannot load group messages:", err);
    res.status(500).json({ success: false, message: "Cannot load group messages" });
  }
};

const createGroupConversationMessage = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const content = String(req.body.content || "").trim();
    const attachment = req.file ? {
      url: `/uploads/files/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    } : null;

    if (!content && !attachment) {
      return res.status(400).json({ success: false, message: "Message content or attachment is required" });
    }

    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);
    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Group not found or access denied" });
    }
    if (conversation.disbanded_at) {
      return res.status(403).json({ success: false, message: "This group has been disbanded" });
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
    const [participants] = await pool.query(
      "SELECT user_id FROM project_chat_participants WHERE conversation_id = ? AND removed_at IS NULL",
      [conversation.conversation_id],
    );
    await createChatNotifications(
      "chat_message",
      result.insertId,
      participants.map((participant) => participant.user_id),
      req.user.id,
    );

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error("Cannot create group message:", err);
    res.status(500).json({ success: false, message: "Cannot send group message" });
  }
};

const clearGroupConversationMessages = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Group not found or access denied" });
    }
    await clearConversationForUser(conversationId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Cannot clear group messages:", err);
    res.status(500).json({ success: false, message: "Cannot clear group history" });
  }
};

const removeGroupConversationForMe = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!conversation || conversation.removed_at) {
      return res.status(404).json({ success: false, message: "Group not found or access denied" });
    }

    await clearConversationForUser(conversationId, req.user.id, { hide: true });

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot remove group chat:", err);
    res.status(500).json({ success: false, message: "Cannot remove group chat" });
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

    if (project.user_role === "removed") {
      return res.status(403).json({ success: false, message: "You were removed from this project" });
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
      const recipients = (await getProjectMembersRows(projectId))
        .map((member) => member.user_id);
      await createChatNotifications("project_chat_message", result.insertId, recipients, req.user.id);
      return res.status(201).json({ success: true, message });
    }

    const conversation = await assertConversationAccess(Number(conversationId), projectId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found or access denied" });
    }
    if (conversation.removed_at) {
      return res.status(403).json({ success: false, message: "You were removed from this group" });
    }
    if (conversation.disbanded_at) {
      return res.status(403).json({ success: false, message: "This group has been disbanded" });
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
    const [participants] = await pool.query(
      "SELECT user_id FROM project_chat_participants WHERE conversation_id = ? AND removed_at IS NULL",
      [conversation.conversation_id],
    );
    await createChatNotifications(
      "chat_message",
      result.insertId,
      participants.map((participant) => participant.user_id),
      req.user.id,
    );
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
    const inviteEmails = [
      ...new Set(
        (Array.isArray(req.body.invite_emails)
          ? req.body.invite_emails
          : String(req.body.invite_email || "")
              .split(","))
          .map((email) => String(email || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
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
    if (type === "group" && (!name || (memberIds.length === 0 && inviteEmails.length === 0))) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
    }

    let invitedMemberIds = [];
    if (type === "group" && inviteEmails.length > 0) {
      const [invitedUsers] = await pool.query(
        `SELECT user_id, email
         FROM users
         WHERE LOWER(email) IN (?)`,
        [inviteEmails],
      );
      const foundEmails = new Set(invitedUsers.map((item) => String(item.email || "").toLowerCase()));
      const missingEmails = inviteEmails.filter((email) => !foundEmails.has(email));
      if (missingEmails.length > 0) {
        return res.status(404).json({
          success: false,
          message: `User email not found: ${missingEmails.join(", ")}`,
        });
      }
      invitedMemberIds = invitedUsers.map((item) => Number(item.user_id));
    }

    const participants = [...new Set([req.user.id, ...memberIds, ...invitedMemberIds])];
    const members = await getProjectMembersRows(projectId);
    const memberSet = new Set(members.map((member) => Number(member.user_id)));
    const nonProjectParticipants = participants.filter(
      (id) => Number(id) !== Number(req.user.id) && !memberSet.has(Number(id)),
    );
    const nonInvitedProjectParticipants = nonProjectParticipants.filter(
      (id) => !invitedMemberIds.includes(Number(id)),
    );

    if (nonInvitedProjectParticipants.length > 0) {
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
    for (const userId of nonProjectParticipants) {
      await connection.query(
        "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
        [projectId, userId],
      );
      await connection.query(
        "DELETE FROM project_removed_members WHERE project_id = ? AND user_id = ?",
        [projectId, userId],
      );
    }
    for (const userId of participants) {
      await connection.query(
        "INSERT INTO project_chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
        [created.insertId, userId, Number(userId) === Number(req.user.id) ? "admin" : "member"],
      );
    }
    await connection.commit();
    if (type === "group") {
      await createChatNotifications("group_invited", created.insertId, participants, req.user.id);
    }

    res.status(201).json({
      success: true,
      conversation: {
        conversation_id: created.insertId,
        project_id: projectId,
        type,
        name: type === "group" ? name : null,
        created_by: req.user.id,
        participant_role: "admin",
        participant_roles: participants.reduce((roles, userId) => ({
          ...roles,
          [userId]: Number(userId) === Number(req.user.id) ? "admin" : "member",
        }), {}),
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
    const userId = Number(req.body.user_id);
    const role = req.body.role || "member";
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project || !canManageProject(project.user_role)) {
      return res.status(403).json({ success: false, message: "Only owner or leader can add members" });
    }
    if (!email && !userId) {
      return res.status(400).json({ success: false, message: "Email or user_id is required" });
    }
    if (!PROJECT_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Role is invalid" });
    }

    const [users] = await pool.query(
      userId
        ? "SELECT user_id, username, email, user_photo FROM users WHERE user_id = ? LIMIT 1"
        : "SELECT user_id, username, email, user_photo FROM users WHERE LOWER(email) = ? LIMIT 1",
      [userId || email],
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
    await pool.query(
      "DELETE FROM project_removed_members WHERE project_id = ? AND user_id = ?",
      [projectId, users[0].user_id],
    );

    res.status(201).json({ success: true, member: { ...users[0], role } });
  } catch (err) {
    console.error("Cannot add project member:", err);
    res.status(500).json({ success: false, message: "Cannot add member" });
  }
};

const getProjectMemberCandidates = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project || !canManageProject(project.user_role)) {
      return res.status(403).json({ success: false, message: "Only owner or leader can view member candidates" });
    }

    const [users] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.user_photo
       FROM users u
       LEFT JOIN project_removed_members prm
         ON prm.project_id = ?
        AND prm.user_id = u.user_id
       WHERE u.user_id <> ?
         AND u.user_id <> ?
         AND (
           prm.user_id IS NOT NULL
           OR NOT EXISTS (
             SELECT 1
             FROM project_members pm
             WHERE pm.project_id = ?
               AND pm.user_id = u.user_id
           )
         )
       ORDER BY u.username ASC, u.email ASC
       LIMIT 100`,
      [projectId, req.user.id, project.owner_id, projectId],
    );

    res.json({ success: true, users });
  } catch (err) {
    console.error("Cannot load project member candidates:", err);
    res.status(500).json({ success: false, message: "Cannot load member candidates" });
  }
};

const searchProjectChatUsers = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const query = String(req.query.q || "").trim().toLowerCase();
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied" });
    }
    if (query.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const [users] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.user_photo,
              CASE
                WHEN u.user_id = ? THEN 'self'
                WHEN u.user_id = ? THEN 'owner'
                WHEN pm.user_id IS NOT NULL THEN pm.role
                ELSE NULL
              END AS project_role
       FROM users u
       LEFT JOIN project_members pm
         ON pm.project_id = ?
        AND pm.user_id = u.user_id
       WHERE u.user_id <> ?
         AND LOWER(u.email) LIKE ?
       ORDER BY
         CASE WHEN LOWER(u.email) = ? THEN 0 ELSE 1 END,
         u.email ASC
       LIMIT 8`,
      [req.user.id, project.owner_id, projectId, req.user.id, `%${query}%`, query],
    );

    res.json({ success: true, users });
  } catch (err) {
    console.error("Cannot search chat users:", err);
    res.status(500).json({ success: false, message: "Cannot search users" });
  }
};

const removeProjectMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const userId = Number(req.params.userId);
    const project = await getAccessibleProject(projectId, req.user.id);

    if (!project || !canManageProject(project.user_role)) {
      return res.status(403).json({ success: false, message: "Only owner or leader can remove members" });
    }
    if (Number(userId) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot remove yourself from the project" });
    }
    if (Number(userId) === Number(project.owner_id)) {
      return res.status(400).json({ success: false, message: "Project owner cannot be removed" });
    }

    const [targetMembers] = await pool.query(
      "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1",
      [projectId, userId],
    );

    if (targetMembers.length === 0) {
      return res.status(404).json({ success: false, message: "Project member not found" });
    }

    await pool.query(
      `INSERT INTO project_removed_members (project_id, user_id, removed_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE removed_at = VALUES(removed_at)`,
      [projectId, userId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot remove project member:", err);
    res.status(500).json({ success: false, message: "Cannot remove project member" });
  }
};

const addConversationMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const email = String(req.body.email || "").trim().toLowerCase();
    let userId = Number(req.body.user_id);
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!canManageGroupConversation(conversation, project, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin or project manager can add members" });
    }
    if (!email && !userId) {
      return res.status(400).json({ success: false, message: "Email or user_id is required" });
    }

    let invitedUser = null;
    if (email) {
      const [users] = await pool.query(
        "SELECT user_id, username, email, user_photo FROM users WHERE LOWER(email) = ? LIMIT 1",
        [email],
      );
      invitedUser = users[0] || null;
      if (!invitedUser) {
        return res.status(404).json({ success: false, message: "User email not found" });
      }
      userId = Number(invitedUser.user_id);
    }

    const members = await getProjectMembersRows(projectId);
    const projectMember = members.find((member) => Number(member.user_id) === userId);
    if (!projectMember) {
      await pool.query(
        "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
        [projectId, userId],
      );
      await pool.query(
        "DELETE FROM project_removed_members WHERE project_id = ? AND user_id = ?",
        [projectId, userId],
      );
    }

    await pool.query(
      `INSERT INTO project_chat_participants (conversation_id, user_id, role, removed_at)
       VALUES (?, ?, 'member', NULL)
       ON DUPLICATE KEY UPDATE removed_at = NULL, role = 'member'`,
      [conversationId, userId],
    );
    await createChatNotifications("group_invited", conversationId, [userId], req.user.id);

    res.status(201).json({ success: true, member: invitedUser || null });
  } catch (err) {
    console.error("Cannot add conversation member:", err);
    res.status(500).json({ success: false, message: "Cannot add group member" });
  }
};

const addGlobalGroupMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const email = String(req.body.email || "").trim().toLowerCase();
    let userId = Number(req.body.user_id);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!canManageGlobalGroupConversation(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin can add members" });
    }
    if (!email && !userId) {
      return res.status(400).json({ success: false, message: "Email or user_id is required" });
    }

    let invitedUser = null;
    if (email) {
      const [users] = await pool.query(
        "SELECT user_id, username, email, user_photo FROM users WHERE LOWER(email) = ? LIMIT 1",
        [email],
      );
      invitedUser = users[0] || null;
      if (!invitedUser) {
        return res.status(404).json({ success: false, message: "User email not found" });
      }
      userId = Number(invitedUser.user_id);
    }

    await pool.query(
      `INSERT INTO project_chat_participants (conversation_id, user_id, role, removed_at)
       VALUES (?, ?, 'member', NULL)
       ON DUPLICATE KEY UPDATE removed_at = NULL, role = 'member'`,
      [conversationId, userId],
    );
    await createChatNotifications("group_invited", conversationId, [userId], req.user.id);

    res.status(201).json({ success: true, member: invitedUser || null });
  } catch (err) {
    console.error("Cannot add global group member:", err);
    res.status(500).json({ success: false, message: "Cannot add group member" });
  }
};

const getGlobalGroupMemberCandidates = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!canManageGlobalGroupConversation(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin can view member candidates" });
    }

    const [users] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.user_photo
       FROM users u
       WHERE u.user_id <> ?
         AND NOT EXISTS (
           SELECT 1
           FROM project_chat_participants p
           WHERE p.conversation_id = ?
             AND p.user_id = u.user_id
             AND p.removed_at IS NULL
         )
       ORDER BY u.username ASC, u.email ASC
       LIMIT 100`,
      [req.user.id, conversationId],
    );

    res.json({ success: true, users });
  } catch (err) {
    console.error("Cannot load global group member candidates:", err);
    res.status(500).json({ success: false, message: "Cannot load group member candidates" });
  }
};

const removeGlobalGroupMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const userId = Number(req.params.userId);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!canManageGlobalGroupConversation(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin can remove members" });
    }
    if (Number(userId) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: "Group admin cannot remove themselves" });
    }

    const [result] = await pool.query(
      "UPDATE project_chat_participants SET removed_at = NOW() WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL",
      [conversationId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Group member not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot remove global group member:", err);
    res.status(500).json({ success: false, message: "Cannot remove group member" });
  }
};

const disbandGlobalGroup = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const conversationId = Number(req.params.conversationId);
    const conversation = await assertGlobalGroupConversationAccess(conversationId, req.user.id);

    if (!canManageGlobalGroupConversation(conversation, req.user.id, { allowDisbanded: true })) {
      return res.status(403).json({ success: false, message: "Only group admin can disband this group" });
    }
    if (conversation.disbanded_at) {
      return res.json({ success: true });
    }

    await pool.query(
      "UPDATE project_chat_conversations SET disbanded_at = NOW() WHERE conversation_id = ?",
      [conversationId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot disband global group:", err);
    res.status(500).json({ success: false, message: "Cannot disband group" });
  }
};

const getConversationMemberCandidates = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!canManageGroupConversation(conversation, project, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin or project manager can view member candidates" });
    }

    const members = await getProjectMembersRows(projectId);
    const [activeParticipants] = await pool.query(
      "SELECT user_id FROM project_chat_participants WHERE conversation_id = ? AND removed_at IS NULL",
      [conversationId],
    );
    const activeParticipantIds = new Set(activeParticipants.map((member) => Number(member.user_id)));
    const users = members.filter((member) => (
      Number(member.user_id) !== Number(req.user.id)
      && !activeParticipantIds.has(Number(member.user_id))
    ));

    res.json({ success: true, users });
  } catch (err) {
    console.error("Cannot load conversation member candidates:", err);
    res.status(500).json({ success: false, message: "Cannot load group member candidates" });
  }
};

const removeConversationMember = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const userId = Number(req.params.userId);
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!canManageGroupConversation(conversation, project, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin or project manager can remove members" });
    }
    if (Number(userId) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: "Group owner cannot remove themselves" });
    }

    const [result] = await pool.query(
      "UPDATE project_chat_participants SET removed_at = NOW() WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL",
      [conversationId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Group member not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot remove conversation member:", err);
    res.status(500).json({ success: false, message: "Cannot remove group member" });
  }
};

const disbandConversation = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!canManageGroupConversation(conversation, project, req.user.id, { allowDisbanded: true })) {
      return res.status(403).json({ success: false, message: "Only group admin or project manager can disband this group" });
    }
    if (conversation.disbanded_at) {
      return res.json({ success: true });
    }

    await pool.query(
      "UPDATE project_chat_conversations SET disbanded_at = NOW() WHERE conversation_id = ? AND project_id = ?",
      [conversationId, projectId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Cannot disband conversation:", err);
    res.status(500).json({ success: false, message: "Cannot disband group" });
  }
};

const updateConversationMemberRole = async (req, res) => {
  try {
    await ensureProjectChatTables();
    const projectId = Number(req.params.projectId);
    const conversationId = Number(req.params.conversationId);
    const userId = Number(req.params.userId);
    const role = req.body.role;
    const project = await getAccessibleProject(projectId, req.user.id);
    const conversation = await assertConversationAccess(conversationId, projectId, req.user.id);

    if (!canManageGroupConversation(conversation, project, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only group admin or project manager can promote members" });
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
  ensureProjectChatTables,
  getProjectChatOverview,
  getDirectConversations,
  getGroupConversations,
  searchGlobalChatUsers,
  createDirectConversation,
  createGroupConversation,
  getProjectMessages,
  getConversationMessages,
  getDirectConversationMessages,
  getGroupConversationMessages,
  clearDirectConversationMessages,
  clearGroupConversationMessages,
  removeDirectConversationForMe,
  removeGroupConversationForMe,
  createProjectMessage,
  createDirectConversationMessage,
  createGroupConversationMessage,
  createConversation,
  addProjectMember,
  getProjectMemberCandidates,
  searchProjectChatUsers,
  removeProjectMember,
  addGlobalGroupMember,
  getGlobalGroupMemberCandidates,
  removeGlobalGroupMember,
  disbandGlobalGroup,
  addConversationMember,
  getConversationMemberCandidates,
  removeConversationMember,
  disbandConversation,
  updateConversationMemberRole,
};
