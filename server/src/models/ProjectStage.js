const db = require('../config/db');

const ProjectStage = {
  // Lấy toàn bộ workflow của một project
  async getByProjectId(projectId) {
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
  async createDefaultStages(projectId, stagesTemplate) {
    for (let i = 0; i < stagesTemplate.length; i++) {
      await db.query(`
        INSERT INTO project_stages 
        (project_id, stage_order, stage_name, description, assigned_to, deadline)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        projectId,
        i + 1,
        stagesTemplate[i].name,
        stagesTemplate[i].description,
        stagesTemplate[i].assigned_to || null,
        stagesTemplate[i].deadline || null
      ]);
    }
  },

  // Move to next stage - mark current as completed, prepare next
  async moveNext(stageId, userId) {
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
  async movePrevious(stageId, userId) {
    // Get current stage info to find previous one
    const [current] = await db.query(`
      SELECT project_id, stage_order FROM project_stages WHERE id = ?
    `, [stageId]);

    if (current.length === 0) throw new Error('Stage not found');

    const { project_id, stage_order } = current[0];

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
          SET status = 'completed'
          WHERE id = ?
        `, [prevStage[0].id]);
      }
    }

    // Log activity
    await db.query(`
      INSERT INTO stage_activities (project_stage_id, user_id, action, comment)
      VALUES (?, ?, 'reject', 'Moved to previous stage')
    `, [stageId, userId]);
  }
};

module.exports = ProjectStage;