const ProjectStage = require('../models/ProjectStage');
const db = require('../config/db');

const workflowController = {
  // Lấy workflow của project
  async getProjectWorkflow(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.user.id || req.user.user_id;

      // Kiểm tra quyền truy cập dự án (phải là chủ dự án hoặc thành viên dự án)
      const [projectRows] = await db.query(
        `SELECT p.owner_id, pm.role 
         FROM projects p 
         LEFT JOIN project_members pm ON p.project_id = pm.project_id AND pm.user_id = ?
         WHERE p.project_id = ? AND p.deleted_at IS NULL`,
        [userId, projectId]
      );

      if (projectRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Dự án không tồn tại!' });
      }

      const isOwner = Number(projectRows[0].owner_id) === Number(userId);
      const isMember = projectRows[0].role !== null;

      if (!isOwner && !isMember) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dự án này!' });
      }

      const stages = await ProjectStage.getByProjectId(projectId);
      
      // Xử lý status: Giai đoạn đầu tiên chưa hoàn thành (không phải 'completed') sẽ là 'in_progress'
      if (stages.length > 0) {
        for (let i = 0; i < stages.length; i++) {
          if (stages[i].status !== 'completed') {
            stages[i].status = 'in_progress';
            break;
          }
        }
      }

      res.json({ success: true, data: stages, isOwner });
    } catch (error) {
      console.error('Workflow getProjectWorkflow error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Move to next stage (Mark current as completed, next as in_progress)
  async moveNextStage(req, res) {
    try {
      const { projectId } = req.params;
      const { stageId } = req.body;
      const userId = req.user.id || req.user.user_id;

      // Kiểm tra xem người dùng có phải là owner không
      const [projectRows] = await db.query(
        `SELECT owner_id FROM projects WHERE project_id = ? AND deleted_at IS NULL`,
        [projectId]
      );

      if (projectRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Dự án không tồn tại!' });
      }

      const isOwner = Number(projectRows[0].owner_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Chỉ có owner mới có quyền xác nhận chuyển giai đoạn!' });
      }

      await ProjectStage.moveNext(stageId, userId);
      
      // Get updated workflow
      const stages = await ProjectStage.getByProjectId(projectId);
      
      // Reprocess statuses: Giai đoạn đầu tiên chưa hoàn thành sẽ là 'in_progress'
      if (stages.length > 0) {
        for (let i = 0; i < stages.length; i++) {
          if (stages[i].status !== 'completed') {
            stages[i].status = 'in_progress';
            break;
          }
        }
      }

      res.json({ 
        success: true, 
        message: 'Đã hoàn thành giai đoạn',
        data: stages,
        isOwner: true
      });
    } catch (error) {
      console.error('Workflow moveNextStage error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Move to previous stage (Mark current as pending, previous as in_progress)
  async movePreviousStage(req, res) {
    try {
      const { projectId } = req.params;
      const { stageId } = req.body;
      const userId = req.user.id || req.user.user_id;

      // Kiểm tra xem người dùng có phải là owner không
      const [projectRows] = await db.query(
        `SELECT owner_id FROM projects WHERE project_id = ? AND deleted_at IS NULL`,
        [projectId]
      );

      if (projectRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Dự án không tồn tại!' });
      }

      const isOwner = Number(projectRows[0].owner_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Chỉ có owner mới có quyền xác nhận chuyển giai đoạn!' });
      }

      await ProjectStage.movePrevious(stageId, userId);
      
      // Get updated workflow
      const stages = await ProjectStage.getByProjectId(projectId);
      
      // Reprocess statuses: Giai đoạn đầu tiên chưa hoàn thành sẽ là 'in_progress'
      if (stages.length > 0) {
        for (let i = 0; i < stages.length; i++) {
          if (stages[i].status !== 'completed') {
            stages[i].status = 'in_progress';
            break;
          }
        }
      }

      res.json({ 
        success: true, 
        message: 'Đã quay lại giai đoạn trước',
        data: stages,
        isOwner: true
      });
    } catch (error) {
      console.error('Workflow movePreviousStage error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = workflowController;