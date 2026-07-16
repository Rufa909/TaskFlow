const ProjectStage = require("../models/ProjectStage");
const db = require("../config/db");
const { emitWorkflowChanged } = require("../socket");

let workflowHandoverSchemaReady;

const REQUIRED_DOCUMENTS_BY_STAGE = {
  1: [
    { type: "requirement_document", label: "Requirement Document" },
    { type: "user_story", label: "User Story" },
    { type: "erd", label: "ERD" },
    { type: "wireframe", label: "Wireframe" },
  ],
};

const DEFAULT_REQUIRED_DOCUMENTS = [];

function getUserId(req) {
  return req.user.id || req.user.user_id;
}

function getRequiredDocuments(stage) {
  return REQUIRED_DOCUMENTS_BY_STAGE[Number(stage.stage_order)] || DEFAULT_REQUIRED_DOCUMENTS;
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

async function isStageResponsible(stage, userId, access) {
  const [members] = await db.query(
    "SELECT user_id FROM stage_members WHERE stage_id = ?",
    [stage.id],
  );

  if (members.length > 0) {
    return members.some((member) => Number(member.user_id) === Number(userId));
  }

  if (stage.assigned_to) return Number(stage.assigned_to) === Number(userId);

  return access.isOwner;
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
  const requiredDocuments = getRequiredDocuments(stage);
  const documents = await getStageDocuments(stage.id);
  const handover = await getStageHandover(stage.id);
  const uploadedTypes = new Set(documents.map((doc) => doc.document_type));

  const documentItems = requiredDocuments.map((item) => ({
    key: item.type,
    label: item.label,
    complete: uploadedTypes.has(item.type),
  }));

  const handoverItem = {
    key: "handover_notes",
    label: "Handover Notes",
    complete: Boolean(handover?.summary && String(handover.summary).trim()),
  };

  const items = [...documentItems, handoverItem];

  return {
    items,
    missing: items.filter((item) => !item.complete).map((item) => item.label),
    canComplete: items.every((item) => item.complete),
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
      const canCompleteStage = await isStageResponsible(stage, context.userId, context.access);

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
      emitWorkflowChanged(context.projectId, { type: "stage_document_created", stageId: stage.id });

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
      emitWorkflowChanged(context.projectId, { type: "stage_discussion_created", stageId: Number(req.params.stageId) });
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
      emitWorkflowChanged(context.projectId, { type: "stage_decision_created", stageId: Number(req.params.stageId) });
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
      emitWorkflowChanged(context.projectId, { type: "stage_deliverable_created", stageId: Number(req.params.stageId) });
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
      emitWorkflowChanged(context.projectId, { type: "stage_handover_updated", stageId: Number(req.params.stageId) });
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

      const canCompleteStage = await isStageResponsible(stage, context.userId, context.access);
      if (!canCompleteStage) {
        return res.status(403).json({
          success: false,
          message: "Only stage owners can complete this stage",
        });
      }

      const checklist = await buildCompletionChecklist(stage);
      if (!checklist.canComplete) {
        return res.status(400).json({
          success: false,
          message: "Cannot move to the next stage. Required handover information is missing.",
          missing: checklist.missing,
          checklist,
        });
      }

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
      emitWorkflowChanged(context.projectId, {
        type: "stage_completed",
        stageId: stage.id,
        stages,
      });

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
      emitWorkflowChanged(context.projectId, { type: "stage_reopened", stageId: req.body.stageId, stages });

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
