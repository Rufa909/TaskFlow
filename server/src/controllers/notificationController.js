const pool = require("../config/db");

exports.getMyNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `
      SELECT
        n.noti_id,
        n.type,
        n.reference_id,
        n.is_read,
        n.created_at,
        p.name AS project_name,
        t.title AS task_title,
        tp.name AS task_project_name,
        t.deadline,
        t.time,
        CASE
          WHEN n.type = 'role_updated' THEN CONCAT('Role updated in ', COALESCE(p.name, 'project'))
          WHEN n.type = 'task_assigned' THEN CONCAT('New task assigned: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'deadline_overdue' THEN CONCAT('Deadline overdue: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_request' THEN CONCAT('Task assignment waiting for approval: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_pending' THEN CONCAT('Task pending owner approval: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_rejected' THEN CONCAT('Task assignment rejected: ', COALESCE(t.title, 'Task'))
          ELSE 'New notification'
        END AS title
      FROM notifications n
      LEFT JOIN projects p
        ON n.type = 'role_updated'
       AND p.project_id = n.reference_id
      LEFT JOIN tasks t
        ON n.type IN ('task_assigned', 'deadline_overdue', 'assignment_request', 'assignment_pending', 'assignment_rejected')
       AND t.task_id = n.reference_id
      LEFT JOIN projects tp ON tp.project_id = t.project_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
      `,
      [req.user.id],
    );

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("Loi getMyNotifications:", err);
    res.status(500).json({ success: false, message: "Loi server" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE noti_id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Loi markNotificationRead:", err);
    res.status(500).json({ success: false, message: "Loi server" });
  }
};
