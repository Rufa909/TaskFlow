const db = require('../config/db');

let stageActivitiesReady;
let projectStagesReady;

const DEFAULT_WORKFLOW_STAGES = [
  {
    name: 'Planning',
    description: 'Requirement analysis & planning phase'
  },
  {
    name: 'Development',
    description: 'Implementation & coding phase'
  },
  {
    name: 'Testing',
    description: 'QA & testing phase'
  },
  {
    name: 'Deployment',
    description: 'Release to production'
  }
];

function normalizeWorkflowStages(stages) {
  if (!Array.isArray(stages)) return DEFAULT_WORKFLOW_STAGES;

  const normalized = stages
    .map((stage) => ({
      ...stage,
      name: String(stage?.name || '').trim(),
      description: String(stage?.description || '').trim(),
    }))
    .filter((stage) => stage.name);

  return normalized.length > 0 ? normalized : DEFAULT_WORKFLOW_STAGES;
}

async function ensureStageActivitiesTable() {
  if (!stageActivitiesReady) {
    stageActivitiesReady = db.query(`
      CREATE TABLE IF NOT EXISTS stage_activities (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        project_stage_id INT NOT NULL,
        user_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        comment TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stage_activities_stage (project_stage_id),
        INDEX idx_stage_activities_user (user_id)
      )
    `);
  }
  return stageActivitiesReady;
}

async function ensureProjectStagesTable(connection = db) {
  if (!projectStagesReady) {
    projectStagesReady = connection.query(`
      CREATE TABLE IF NOT EXISTS project_stages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        stage_order INT NOT NULL,
        stage_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status ENUM('pending','in_progress','completed') DEFAULT 'pending',
        assigned_to INT NULL,
        deadline DATE NULL,
        approved_by INT NULL,
        approved_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project_stages_project_order (project_id, stage_order),
        INDEX idx_project_stages_status (project_id, status),
        CONSTRAINT fk_project_stages_project
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      )
    `).catch((err) => {
      projectStagesReady = null;
      throw err;
    });
  }
  return projectStagesReady;
}

const ProjectStage = {
  DEFAULT_WORKFLOW_STAGES,
  normalizeWorkflowStages,
  ensureProjectStagesTable,

  // Lấy toàn bộ workflow của một project
  async getByProjectId(projectId) {
    await ensureProjectStagesTable();
    const sql = `
      SELECT ps.*, u.username as assignee_name, u2.username as approver_name
      FROM project_stages ps
      LEFT JOIN users u ON ps.assigned_to = u.user_id
      LEFT JOIN users u2 ON ps.approved_by = u2.user_id
      WHERE ps.project_id = ?
      ORDER BY ps.stage_order ASC
    `;
    const [stages] = await db.query(sql, [projectId]);
    return stages;
  },

  // Tạo mặc định workflow khi tạo project mới
  async createDefaultStages(projectId, stagesTemplate, connection = db) {
    await ensureProjectStagesTable(connection);
    const stages = normalizeWorkflowStages(stagesTemplate);
    for (let i = 0; i < stages.length; i++) {
      await connection.query(`
        INSERT INTO project_stages 
        (project_id, stage_order, stage_name, description, assigned_to, deadline)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        projectId,
        i + 1,
        stages[i].name,
        stages[i].description,
        stages[i].assigned_to || null,
        stages[i].deadline || null
      ]);
    }
  },

  async ensureDefaultStages(projectId, connection = db) {
    await ensureProjectStagesTable(connection);
    const [existing] = await connection.query(
      'SELECT COUNT(*) AS stage_count FROM project_stages WHERE project_id = ?',
      [projectId]
    );

    if (Number(existing[0]?.stage_count || 0) > 0) return false;

    await this.createDefaultStages(projectId, DEFAULT_WORKFLOW_STAGES, connection);
    return true;
  },

  // Move to next stage - mark current as completed, prepare next
  async moveNext(stageId, userId) {
    await ensureStageActivitiesTable();

    // Update current stage to completed
    await db.query(`
      UPDATE project_stages 
      SET status = 'completed', 
          approved_by = ?, 
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [userId, stageId]);

    // Log activity
    await db.query(`
      INSERT INTO stage_activities (project_stage_id, user_id, action, comment)
      VALUES (?, ?, 'approve', 'Moved to next stage')
    `, [stageId, userId]);
  },

  // Move to previous stage - mark current as pending, revert previous from completed
  async movePrevious(stageId, userId, options = {}) {
    await ensureStageActivitiesTable();

    // Get current stage info to find previous one
    const [current] = await db.query(`
      SELECT project_id, stage_order FROM project_stages WHERE id = ?
    `, [stageId]);

    if (current.length === 0) throw new Error('Stage not found');

    const { project_id, stage_order } = current[0];

    if (Number(stage_order) <= 1) {
      throw new Error('Cannot move back from the first stage');
    }

    if (!options.bypassPreviousLimits) {
      const [latestActivities] = await db.query(`
        SELECT sa.action, sa.created_at
        FROM stage_activities sa
        JOIN project_stages ps ON ps.id = sa.project_stage_id
        WHERE ps.project_id = ?
        ORDER BY sa.created_at DESC
        LIMIT 1
      `, [project_id]);

      if (latestActivities[0]?.action !== 'approve') {
        throw new Error('You can only move back once after moving to a new stage');
      }

      const movedAt = latestActivities[0]?.created_at ? new Date(latestActivities[0].created_at) : null;
      const previousWindowMs = 12 * 60 * 60 * 1000;
      if (!movedAt || Date.now() - movedAt.getTime() > previousWindowMs) {
        throw new Error('You can only move back within 12 hours after moving to a new stage');
      }
    }

    // Update current stage to pending
    await db.query(`
      UPDATE project_stages 
      SET status = 'pending',
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
      WHERE id = ?
    `, [stageId]);

    // Find and update previous stage
    if (stage_order > 1) {
      const [prevStage] = await db.query(`
        SELECT id FROM project_stages 
        WHERE project_id = ? AND stage_order = ?
      `, [project_id, stage_order - 1]);

      if (prevStage.length > 0) {
        await db.query(`
          UPDATE project_stages 
          SET status = 'in_progress',
              approved_by = NULL,
              approved_at = NULL,
              updated_at = NOW()
          WHERE id = ?
        `, [prevStage[0].id]);
      }
    }

    // Log activity
    await db.query(`
      INSERT INTO stage_activities (project_stage_id, user_id, action, comment)
      VALUES (?, ?, 'reject', ?)
    `, [stageId, userId, options.bypassPreviousLimits ? 'Admin moved to previous stage' : 'Moved to previous stage']);
  }
};

module.exports = ProjectStage;
