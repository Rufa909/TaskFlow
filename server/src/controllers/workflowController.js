const ProjectStage = require("../models/ProjectStage");
const db = require("../config/db");
const { generateLeaderSuggestionsWithAi } = require("../services/leaderSuggestionAiService");

let workflowHandoverSchemaReady;

function getUserId(req) {
  return req.user.id || req.user.user_id;
}

function formatDocument(row) {
  return {
    ...row,
    file_url: row.file_url || null,
    url: row.file_url || null,
  };
}

async function ensureWorkflowHandoverSchema() {
  if (!workflowHandoverSchemaReady) {
    workflowHandoverSchemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_documents (
          document_id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          stage_id INT NOT NULL,
          uploaded_by INT NOT NULL,
          document_type VARCHAR(80) NOT NULL,
          title VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NULL,
          file_name VARCHAR(255) NULL,
          file_url VARCHAR(500) NULL,
          mime_type VARCHAR(120) NULL,
          file_size INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_documents_stage (stage_id),
          INDEX idx_stage_documents_type (stage_id, document_type)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_discussions (
          discussion_id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          stage_id INT NOT NULL,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_discussions_stage (stage_id, created_at)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_decisions (
          decision_id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          stage_id INT NOT NULL,
          created_by INT NOT NULL,
          decision TEXT NOT NULL,
          reason TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_decisions_stage (stage_id, created_at)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_handover_notes (
          handover_id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          stage_id INT NOT NULL,
          created_by INT NOT NULL,
          summary TEXT NOT NULL,
          open_issues TEXT NULL,
          technical_limits TEXT NULL,
          recommendations TEXT NULL,
          package_snapshot JSON NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_stage_handover (stage_id),
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_handover_project (project_id)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_deliverables (
          deliverable_id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          stage_id INT NOT NULL,
          created_by INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          status ENUM('draft','ready','accepted') DEFAULT 'ready',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_deliverables_stage (stage_id, status)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_members (
          stage_id INT NOT NULL,
          user_id INT NOT NULL,
          role ENUM('owner','member') DEFAULT 'member',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (stage_id, user_id),
          FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          INDEX idx_stage_members_user (user_id)
        )
      `);
    })();
  }

  return workflowHandoverSchemaReady;
}

async function getProjectAccess(projectId, userId) {
  const [projectRows] = await db.query(
    `SELECT p.owner_id, pm.role
     FROM projects p
     LEFT JOIN project_members pm ON p.project_id = pm.project_id AND pm.user_id = ?
     WHERE p.project_id = ? AND p.deleted_at IS NULL`,
    [userId, projectId],
  );

  if (projectRows.length === 0) return null;

  return {
    ownerId: projectRows[0].owner_id,
    role: projectRows[0].role,
    isOwner: Number(projectRows[0].owner_id) === Number(userId),
    isMember: projectRows[0].role !== null,
  };
}

async function requireProjectAccess(req, res) {
  const projectId = req.params.projectId || req.params.id;
  const userId = getUserId(req);
  const access = await getProjectAccess(projectId, userId);

  if (!access) {
    res.status(404).json({ success: false, message: "Project not found" });
    return null;
  }

  if (!access.isOwner && !access.isMember) {
    res.status(403).json({ success: false, message: "You cannot access this project" });
    return null;
  }

  return { projectId, userId, access };
}

async function getStage(projectId, stageId) {
  const [rows] = await db.query(
    "SELECT * FROM project_stages WHERE id = ? AND project_id = ? LIMIT 1",
    [stageId, projectId],
  );
  return rows[0] || null;
}

function canMoveStage(access) {
  return access?.isOwner || String(access?.role || "").toLowerCase() === "leader";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function pickMemberForRole(members, roleHints = []) {
  const normalizedHints = roleHints.map(normalizeText);
  const preferred = members.filter((member) => {
    const role = normalizeText(member.role);
    return normalizedHints.some((hint) => role.includes(hint));
  });
  const pool = preferred.length > 0 ? preferred : members.filter((member) => normalizeText(member.role) !== "owner");
  const candidates = pool.length > 0 ? pool : members;

  return [...candidates].sort((a, b) => (
    Number(a.active_task_count || 0) - Number(b.active_task_count || 0)
      || Number(a.total_task_count || 0) - Number(b.total_task_count || 0)
      || String(a.username || a.email || "").localeCompare(String(b.username || b.email || ""))
  ))[0] || null;
}

function memberPayload(member) {
  if (!member) return null;
  return {
    user_id: member.user_id,
    username: member.username,
    email: member.email,
    role: member.role,
    active_task_count: Number(member.active_task_count || 0),
    total_task_count: Number(member.total_task_count || 0),
  };
}

async function getProjectMembersWithWorkload(projectId) {
  const [members] = await db.query(
    `SELECT p.owner_id AS user_id, u.username, u.email, 'owner' AS role
     FROM projects p
     JOIN users u ON u.user_id = p.owner_id
     WHERE p.project_id = ? AND p.deleted_at IS NULL
     UNION
     SELECT pm.user_id, u.username, u.email, pm.role
     FROM project_members pm
     JOIN users u ON u.user_id = pm.user_id
     WHERE pm.project_id = ?`,
    [projectId, projectId],
  );

  const [workload] = await db.query(
    `SELECT ta.user_id,
            COUNT(DISTINCT t.task_id) AS total_task_count,
            SUM(CASE WHEN t.status NOT IN ('COMPLETED','OWNER_APPROVED') THEN 1 ELSE 0 END) AS active_task_count
     FROM task_assignees ta
     JOIN tasks t ON t.task_id = ta.task_id
     WHERE t.project_id = ?
       AND t.deleted_at IS NULL
     GROUP BY ta.user_id`,
    [projectId],
  );
  const workloadByUser = new Map(workload.map((item) => [Number(item.user_id), item]));

  return members.map((member) => ({
    ...member,
    total_task_count: Number(workloadByUser.get(Number(member.user_id))?.total_task_count || 0),
    active_task_count: Number(workloadByUser.get(Number(member.user_id))?.active_task_count || 0),
  }));
}

async function getStageTasksForLeader(projectId, stageId) {
  const [rows] = await db.query(
    `SELECT t.task_id, t.title, t.description, t.status, t.priority, t.deadline, t.labels,
            COUNT(ta.user_id) AS assignee_count,
            GROUP_CONCAT(DISTINCT ta.user_id ORDER BY u.username SEPARATOR ',') AS assignee_ids,
            GROUP_CONCAT(DISTINCT COALESCE(u.username, u.email) ORDER BY u.username SEPARATOR ', ') AS assignee_names
     FROM tasks t
     LEFT JOIN task_assignees ta ON ta.task_id = t.task_id
     LEFT JOIN users u ON u.user_id = ta.user_id
     WHERE t.project_id = ?
       AND t.stage_id = ?
       AND t.deleted_at IS NULL
     GROUP BY t.task_id
     ORDER BY t.created_at ASC`,
    [projectId, stageId],
  );

  return rows.map((task) => ({
    ...task,
    assignee_count: Number(task.assignee_count || 0),
    assignee_ids: task.assignee_ids ? String(task.assignee_ids).split(",").map(Number) : [],
  }));
}

function buildDataDrivenLeaderSuggestions({ tasks, incomingPackage, currentPackage, members }) {
  const incomingDocuments = incomingPackage?.documents || [];
  const incomingDiscussions = incomingPackage?.discussions || [];
  const incomingDeliverables = incomingPackage?.deliverables || [];
  const previousContext = normalizeText([
    incomingPackage?.stage?.stage_name,
    incomingPackage?.handover?.summary,
    incomingPackage?.handover?.open_issues,
    incomingPackage?.handover?.technical_limits,
    incomingPackage?.handover?.recommendations,
    ...incomingDocuments.map((item) => `${item.title || ""} ${item.document_type || ""}`),
    ...incomingDiscussions.map((item) => item.message || ""),
    ...incomingDeliverables.map((item) => `${item.title || ""} ${item.description || ""}`),
  ].join(" "));
  const taskText = normalizeText(tasks.map((task) => `${task.title} ${task.description || ""}`).join(" "));
  const combinedText = `${previousContext} ${taskText}`;
  const suggestions = [];
  const addSuggestion = (suggestion) => {
    suggestions.push({
      id: `sg-${suggestions.length + 1}`,
      priority: suggestion.priority || "medium",
      ...suggestion,
      recommended_member: memberPayload(suggestion.recommended_member),
    });
  };

  const unassignedTasks = tasks.filter((task) => Number(task.assignee_count || 0) === 0);
  const reviewTasks = tasks.filter((task) => ["SUBMITTED", "LEADER_APPROVED"].includes(task.status));
  const blockedTasks = tasks.filter((task) => ["REJECTED", "CHANGES_REQUESTED"].includes(task.status));
  const completedTasks = tasks.filter((task) => ["COMPLETED", "OWNER_APPROVED"].includes(task.status));
  const statusCounts = countBy(tasks, (task) => task.status || "DRAFT");

  if (unassignedTasks.length > 0) {
    addSuggestion({
      type: "assignment",
      title: `${unassignedTasks.length} tasks are unassigned`,
      detail: `Assign these tasks first: ${unassignedTasks.slice(0, 3).map((task) => task.title).join("; ")}.`,
      source: "current_tasks",
      recommended_role: "leader/member",
      recommended_member: pickMemberForRole(members, ["leader", "ba", "developer", "qa", "devops", "member"]),
      priority: "high",
      related_task_ids: unassignedTasks.slice(0, 5).map((task) => task.task_id),
    });
  }

  if (reviewTasks.length > 0) {
    addSuggestion({
      type: "review",
      title: `${reviewTasks.length} tasks need leader/owner review`,
      detail: "Review these first so members are not blocked waiting for feedback and the stage does not bottleneck near the end.",
      source: "task_status",
      recommended_role: "leader",
      recommended_member: pickMemberForRole(members, ["leader"]),
      priority: "high",
      related_task_ids: reviewTasks.slice(0, 5).map((task) => task.task_id),
    });
  }

  if (blockedTasks.length > 0) {
    addSuggestion({
      type: "risk",
      title: `${blockedTasks.length} tasks need unblocking`,
      detail: "Use a discussion to agree on the reason for rejection or change requests, then reassign with a clear deadline.",
      source: "task_status",
      recommended_role: "leader",
      recommended_member: pickMemberForRole(members, ["leader"]),
      priority: "high",
      related_task_ids: blockedTasks.slice(0, 5).map((task) => task.task_id),
    });
  }

  if (combinedText.match(/requirement|srs|scope|mvp|user story|use case|stakeholder|khao sat|yeu cau|pham vi/)) {
    addSuggestion({
      type: "planning",
      title: "Turn previous-stage requirements into implementation tasks",
      detail: "Use the handed-over requirements, MVP scope, and use cases to create module-level tasks with acceptance criteria.",
      source: "previous_stage_documents",
      recommended_role: "ba",
      recommended_member: pickMemberForRole(members, ["ba", "leader"]),
      priority: "medium",
    });
  }

  if (combinedText.match(/wireframe|ui|ux|prototype|screen|giao dien|man hinh/)) {
    addSuggestion({
      type: "assignment",
      title: "Prioritize UI/UX tasks before development",
      detail: "Assign ownership for screen flows, wireframes, and UI review to reduce rework after backend work is done.",
      source: "previous_stage_documents",
      recommended_role: "developer/ba",
      recommended_member: pickMemberForRole(members, ["developer", "ba"]),
      priority: "medium",
    });
  }

  if (combinedText.match(/api|database|erd|schema|backend|integration|payment|momo|cod|thanh toan/)) {
    addSuggestion({
      type: "technical",
      title: "Separate API, database, and integration tasks",
      detail: "Data, API, and payment or integration work should have separate owners and early review checkpoints.",
      source: "previous_stage_documents",
      recommended_role: "developer/devops",
      recommended_member: pickMemberForRole(members, ["developer", "devops"]),
      priority: "medium",
    });
  }

  if (combinedText.match(/test|qa|performance|load|bug|kiem thu|tai|cao diem/)) {
    addSuggestion({
      type: "quality",
      title: "Prepare QA in parallel with implementation",
      detail: "Create tasks for test cases, sample data, and performance checks early instead of pushing QA to the end.",
      source: "previous_stage_discussions",
      recommended_role: "qa",
      recommended_member: pickMemberForRole(members, ["qa", "tester"]),
      priority: "medium",
    });
  }

  if ((incomingDocuments.length + incomingDiscussions.length + incomingDeliverables.length) === 0) {
    addSuggestion({
      type: "handover",
      title: "Previous-stage handover data is missing",
      detail: "Ask for a summary document or discussion before making detailed assignments.",
      source: "handover_gap",
      recommended_role: "leader",
      recommended_member: pickMemberForRole(members, ["leader"]),
      priority: "medium",
    });
  }

  return {
    metrics: {
      total_tasks: tasks.length,
      completed_tasks: completedTasks.length,
      unassigned_tasks: unassignedTasks.length,
      review_tasks: reviewTasks.length,
      blocked_tasks: blockedTasks.length,
      status_counts: statusCounts,
      previous_documents: incomingDocuments.length,
      previous_discussions: incomingDiscussions.length,
      previous_deliverables: incomingDeliverables.length,
      current_documents: currentPackage?.documents?.length || 0,
      current_discussions: currentPackage?.discussions?.length || 0,
    },
    suggestions: suggestions.slice(0, 8),
    workload: members.map(memberPayload),
    attention_tasks: [...unassignedTasks, ...reviewTasks, ...blockedTasks]
      .filter((task, index, list) => list.findIndex((item) => item.task_id === task.task_id) === index)
      .slice(0, 8),
  };
}

async function getStageDocuments(stageId) {
  const [rows] = await db.query(
    `SELECT sd.*, u.username AS uploaded_by_name
     FROM stage_documents sd
     LEFT JOIN users u ON u.user_id = sd.uploaded_by
     WHERE sd.stage_id = ?
     ORDER BY sd.created_at DESC`,
    [stageId],
  );
  return rows.map(formatDocument);
}

async function getStageDiscussions(stageId) {
  const [rows] = await db.query(
    `SELECT sd.*, u.username AS user_name
     FROM stage_discussions sd
     LEFT JOIN users u ON u.user_id = sd.user_id
     WHERE sd.stage_id = ?
     ORDER BY sd.created_at ASC`,
    [stageId],
  );
  return rows;
}

async function getStageDecisions(stageId) {
  const [rows] = await db.query(
    `SELECT sd.*, u.username AS created_by_name
     FROM stage_decisions sd
     LEFT JOIN users u ON u.user_id = sd.created_by
     WHERE sd.stage_id = ?
     ORDER BY sd.created_at DESC`,
    [stageId],
  );
  return rows;
}

async function getStageHandover(stageId) {
  const [rows] = await db.query(
    `SELECT shn.*, u.username AS created_by_name
     FROM stage_handover_notes shn
     LEFT JOIN users u ON u.user_id = shn.created_by
     WHERE shn.stage_id = ?
     LIMIT 1`,
    [stageId],
  );
  return rows[0] || null;
}

async function getStageDeliverables(stageId) {
  const [rows] = await db.query(
    `SELECT sd.*, u.username AS created_by_name
     FROM stage_deliverables sd
     LEFT JOIN users u ON u.user_id = sd.created_by
     WHERE sd.stage_id = ?
     ORDER BY sd.created_at DESC`,
    [stageId],
  );
  return rows;
}

async function buildStagePackage(projectId, stage) {
  const [previousStages] = await db.query(
    `SELECT id, stage_name, stage_order
     FROM project_stages
     WHERE project_id = ? AND stage_order < ?
     ORDER BY stage_order DESC
     LIMIT 1`,
    [projectId, stage.stage_order],
  );

  const previousStage = previousStages[0] || null;
  const current = {
    stage,
    documents: await getStageDocuments(stage.id),
    discussions: await getStageDiscussions(stage.id),
    decisions: await getStageDecisions(stage.id),
    handover: await getStageHandover(stage.id),
    deliverables: await getStageDeliverables(stage.id),
  };

  const incoming = previousStage
    ? {
        stage: previousStage,
        documents: await getStageDocuments(previousStage.id),
        discussions: await getStageDiscussions(previousStage.id),
        decisions: await getStageDecisions(previousStage.id),
        handover: await getStageHandover(previousStage.id),
        deliverables: await getStageDeliverables(previousStage.id),
      }
    : null;

  return { incoming, current };
}

async function buildCompletionChecklist(stage) {
  return {
    items: [],
    missing: [],
    canComplete: true,
  };
}

async function normalizeWorkflow(projectId) {
  const stages = await ProjectStage.getByProjectId(projectId);
  if (stages.length > 0) {
    for (let index = 0; index < stages.length; index += 1) {
      if (stages[index].status !== "completed") {
        stages[index].status = "in_progress";
        break;
      }
    }
  }
  return stages;
}

async function notifyNextStageMembers(projectId, stage) {
  const [nextStages] = await db.query(
    `SELECT id, assigned_to
     FROM project_stages
     WHERE project_id = ? AND stage_order > ?
     ORDER BY stage_order ASC
     LIMIT 1`,
    [projectId, stage.stage_order],
  );

  const nextStage = nextStages[0];
  if (!nextStage) return;

  const [members] = await db.query(
    "SELECT user_id FROM stage_members WHERE stage_id = ?",
    [nextStage.id],
  );

  const recipients = [
    ...members.map((member) => member.user_id),
    nextStage.assigned_to,
  ].filter(Boolean);

  for (const userId of [...new Set(recipients.map(Number))]) {
    await db.query(
      "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'workflow_handover_ready', ?)",
      [userId, stage.id],
    );
  }
}

const workflowController = {
  async getProjectWorkflow(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      const stages = await normalizeWorkflow(context.projectId);

      res.json({
        success: true,
        data: stages,
        isOwner: context.access.isOwner,
      });
    } catch (error) {
      console.error("Workflow getProjectWorkflow error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getStageOverview(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      const stage = await getStage(context.projectId, req.params.stageId);
      if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });

      const packageData = await buildStagePackage(context.projectId, stage);
      const checklist = await buildCompletionChecklist(stage);
      const canCompleteStage = canMoveStage(context.access);

      res.json({
        success: true,
        stage,
        incoming: packageData.incoming,
        current: packageData.current,
        checklist,
        canCompleteStage,
      });
    } catch (error) {
      console.error("Workflow getStageOverview error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getLeaderSuggestions(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      if (!canMoveStage(context.access)) {
        return res.status(403).json({ success: false, message: "Only owner or leader can view leader suggestions" });
      }

      const stage = await getStage(context.projectId, req.params.stageId);
      if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });

      const packageData = await buildStagePackage(context.projectId, stage);
      const tasks = await getStageTasksForLeader(context.projectId, stage.id);
      const members = await getProjectMembersWithWorkload(context.projectId);
      const suggestionData = buildDataDrivenLeaderSuggestions({
        tasks,
        incomingPackage: packageData.incoming,
        currentPackage: packageData.current,
        members,
      });
      let aiSuggestionData = null;
      let aiError = null;

      try {
        aiSuggestionData = await generateLeaderSuggestionsWithAi({
          stage,
          incomingPackage: packageData.incoming,
          currentPackage: packageData.current,
          tasks,
          members,
          metrics: suggestionData.metrics,
        });
      } catch (error) {
        aiError = error.message;
        console.warn("Leader suggestions AI fallback:", error.message);
      }

      const finalSuggestionData = aiSuggestionData?.suggestions?.length
        ? {
            ...suggestionData,
            suggestions: aiSuggestionData.suggestions,
            risks: aiSuggestionData.risks || [],
            next_actions: aiSuggestionData.next_actions || [],
            suggestion_source: "ai",
            ai_model: aiSuggestionData.model,
          }
        : {
            ...suggestionData,
            risks: [],
            next_actions: [],
            suggestion_source: "rules",
            ai_error: aiError,
          };

      res.json({
        success: true,
        stage,
        ...finalSuggestionData,
      });
    } catch (error) {
      console.error("Workflow getLeaderSuggestions error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDocuments(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      res.json({ success: true, documents: await getStageDocuments(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createDocument(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      const stage = await getStage(context.projectId, req.params.stageId);
      if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });

      const file = req.file;
      const title = req.body.title || file?.originalname || "Document";
      const documentType = req.body.document_type || req.body.documentType || "other";
      const fileUrl = file ? `/uploads/files/${file.filename}` : req.body.file_url || null;

      const [result] = await db.query(
        `INSERT INTO stage_documents
         (project_id, stage_id, uploaded_by, document_type, title, original_name, file_name, file_url, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          context.projectId,
          stage.id,
          context.userId,
          documentType,
          title,
          file?.originalname || null,
          file?.filename || null,
          fileUrl,
          file?.mimetype || null,
          file?.size || null,
        ],
      );

      const [rows] = await db.query(
        "SELECT * FROM stage_documents WHERE document_id = ?",
        [result.insertId],
      );
      res.status(201).json({ success: true, document: formatDocument(rows[0]) });
    } catch (error) {
      console.error("Workflow createDocument error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDiscussions(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      res.json({ success: true, discussions: await getStageDiscussions(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createDiscussion(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      const message = String(req.body.message || "").trim();
      if (!message) return res.status(400).json({ success: false, message: "Message is required" });

      const [result] = await db.query(
        `INSERT INTO stage_discussions (project_id, stage_id, user_id, message)
         VALUES (?, ?, ?, ?)`,
        [context.projectId, req.params.stageId, context.userId, message],
      );
      const [rows] = await db.query(
        `SELECT sd.*, u.username AS user_name
         FROM stage_discussions sd
         LEFT JOIN users u ON u.user_id = sd.user_id
         WHERE sd.discussion_id = ?`,
        [result.insertId],
      );
      res.status(201).json({ success: true, discussion: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDecisions(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      res.json({ success: true, decisions: await getStageDecisions(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createDecision(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      const decision = String(req.body.decision || "").trim();
      if (!decision) return res.status(400).json({ success: false, message: "Decision is required" });

      const [result] = await db.query(
        `INSERT INTO stage_decisions (project_id, stage_id, created_by, decision, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [context.projectId, req.params.stageId, context.userId, decision, req.body.reason || null],
      );
      const [rows] = await db.query(
        `SELECT sd.*, u.username AS created_by_name
         FROM stage_decisions sd
         LEFT JOIN users u ON u.user_id = sd.created_by
         WHERE sd.decision_id = ?`,
        [result.insertId],
      );
      res.status(201).json({ success: true, decision: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getHandover(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      res.json({ success: true, handover: await getStageHandover(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDeliverables(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      res.json({ success: true, deliverables: await getStageDeliverables(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createDeliverable(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      const title = String(req.body.title || "").trim();
      if (!title) return res.status(400).json({ success: false, message: "Deliverable title is required" });

      const [result] = await db.query(
        `INSERT INTO stage_deliverables (project_id, stage_id, created_by, title, description, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          context.projectId,
          req.params.stageId,
          context.userId,
          title,
          req.body.description || null,
          req.body.status || "ready",
        ],
      );
      const [rows] = await db.query(
        `SELECT sd.*, u.username AS created_by_name
         FROM stage_deliverables sd
         LEFT JOIN users u ON u.user_id = sd.created_by
         WHERE sd.deliverable_id = ?`,
        [result.insertId],
      );
      res.status(201).json({ success: true, deliverable: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async upsertHandover(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;
      const summary = String(req.body.summary || "").trim();
      if (!summary) return res.status(400).json({ success: false, message: "Summary is required" });

      await db.query(
        `INSERT INTO stage_handover_notes
         (project_id, stage_id, created_by, summary, open_issues, technical_limits, recommendations)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           created_by = VALUES(created_by),
           summary = VALUES(summary),
           open_issues = VALUES(open_issues),
           technical_limits = VALUES(technical_limits),
           recommendations = VALUES(recommendations),
           updated_at = NOW()`,
        [
          context.projectId,
          req.params.stageId,
          context.userId,
          summary,
          req.body.open_issues || req.body.openIssues || null,
          req.body.technical_limits || req.body.technicalLimits || null,
          req.body.recommendations || null,
        ],
      );
      res.json({ success: true, handover: await getStageHandover(req.params.stageId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async completeStage(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      const stageId = req.params.stageId || req.body.stageId;
      const stage = await getStage(context.projectId, stageId);
      if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });

      const canCompleteStage = canMoveStage(context.access);
      if (!canCompleteStage) {
        return res.status(403).json({
          success: false,
          message: "Only project owner or leader can move to the next stage",
        });
      }

      const checklist = await buildCompletionChecklist(stage);

      const packageData = await buildStagePackage(context.projectId, stage);
      await db.query(
        "UPDATE stage_handover_notes SET package_snapshot = ? WHERE stage_id = ?",
        [JSON.stringify(packageData.current), stage.id],
      );

      await ProjectStage.moveNext(stage.id, context.userId);
      await db.query(
        `UPDATE project_stages
         SET status = 'in_progress', updated_at = NOW()
         WHERE project_id = ? AND stage_order = ? AND status <> 'completed'`,
        [context.projectId, Number(stage.stage_order) + 1],
      );
      await notifyNextStageMembers(context.projectId, stage);

      const stages = await normalizeWorkflow(context.projectId);

      res.json({
        success: true,
        message: "Stage completed and handover package created",
        data: stages,
        checklist,
        handoverPackage: packageData.current,
        isOwner: context.access.isOwner,
      });
    } catch (error) {
      console.error("Workflow completeStage error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async moveNextStage(req, res) {
    req.params.stageId = req.body.stageId;
    return workflowController.completeStage(req, res);
  },

  async movePreviousStage(req, res) {
    try {
      await ensureWorkflowHandoverSchema();
      const context = await requireProjectAccess(req, res);
      if (!context) return;

      if (!context.access.isOwner) {
        return res.status(403).json({ success: false, message: "Only project owner can move a stage back" });
      }

      await ProjectStage.movePrevious(req.body.stageId, context.userId);
      const stages = await normalizeWorkflow(context.projectId);

      res.json({
        success: true,
        message: "Moved back to previous stage",
        data: stages,
        isOwner: true,
      });
    } catch (error) {
      console.error("Workflow movePreviousStage error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = workflowController;
