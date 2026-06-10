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
        t.project_id AS task_project_id,
        tp.name AS task_project_name,
        t.deadline,
        t.time,
        CASE
          WHEN n.type = 'task_changes_requested' THEN (
            SELECT ts.note
            FROM task_submissions ts
            WHERE ts.task_id = t.task_id
              AND ts.status = 'rejected'
            ORDER BY ts.reviewed_at DESC, ts.submission_id DESC
            LIMIT 1
          )
          ELSE NULL
        END AS change_note,
        CASE
          WHEN n.type = 'role_updated' THEN CONCAT('Role updated in ', COALESCE(p.name, 'project'))
          WHEN n.type = 'task_assigned' THEN CONCAT('New task assigned: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'deadline_overdue' THEN CONCAT('Deadline overdue: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_request' THEN CONCAT('Task assignment waiting for approval: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_pending' THEN CONCAT('Task pending owner approval: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'assignment_rejected' THEN CONCAT('Task assignment rejected: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'task_submitted' THEN CONCAT('Task submitted for review: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'leader_approved_task' THEN CONCAT('Task waiting for owner approval: ', COALESCE(t.title, 'Task'))
          WHEN n.type = 'task_changes_requested' THEN CONCAT('Changes requested: ', COALESCE(t.title, 'Task'))
          ELSE 'New notification'
        END AS title
      FROM notifications n
      LEFT JOIN projects p
        ON n.type = 'role_updated'
       AND p.project_id = n.reference_id
      LEFT JOIN tasks t
        ON n.type IN ('task_assigned', 'deadline_overdue', 'assignment_request', 'assignment_pending', 'assignment_rejected', 'task_submitted', 'leader_approved_task', 'task_changes_requested')
       AND t.task_id = n.reference_id
      LEFT JOIN projects tp ON tp.project_id = t.project_id
      WHERE n.user_id = ?
        AND (
          n.type NOT IN ('task_submitted', 'leader_approved_task')
          OR (
            n.type = 'task_submitted'
            AND EXISTS (
              SELECT 1
              FROM task_submissions pending_submission
              WHERE pending_submission.task_id = n.reference_id
                AND pending_submission.status = 'pending'
            )
            AND (
              EXISTS (
                SELECT 1
                FROM tasks submitted_task
                JOIN project_members reviewer
                  ON reviewer.project_id = submitted_task.project_id
                 AND reviewer.role = 'leader'
                 AND reviewer.user_id = n.user_id
                WHERE submitted_task.task_id = n.reference_id
              )
              OR (
                NOT EXISTS (
                  SELECT 1
                  FROM tasks submitted_task
                  JOIN project_members project_leader
                    ON project_leader.project_id = submitted_task.project_id
                   AND project_leader.role = 'leader'
                  WHERE submitted_task.task_id = n.reference_id
                )
                AND EXISTS (
                  SELECT 1
                  FROM tasks submitted_task
                  JOIN projects submitted_project
                    ON submitted_project.project_id = submitted_task.project_id
                   AND submitted_project.owner_id = n.user_id
                  WHERE submitted_task.task_id = n.reference_id
                )
              )
            )
          )
          OR (
            n.type = 'leader_approved_task'
            AND EXISTS (
              SELECT 1
              FROM task_submissions owner_submission
              WHERE owner_submission.task_id = n.reference_id
                AND owner_submission.status = 'leader_approved'
            )
            AND EXISTS (
              SELECT 1
              FROM tasks approved_task
              JOIN projects approved_project
                ON approved_project.project_id = approved_task.project_id
               AND approved_project.owner_id = n.user_id
              WHERE approved_task.task_id = n.reference_id
            )
          )
        )
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

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [req.user.id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Loi markAllNotificationsRead:", err);
    res.status(500).json({ success: false, message: "Loi server" });
  }
};
