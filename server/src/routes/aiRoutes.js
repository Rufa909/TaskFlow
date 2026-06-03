const express = require("express");
const axios = require("axios");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function normalizeTaskForAI(task) {
  return {
    id: task.task_id,
    title: task.title,
    description: task.description,
    deadline: task.deadline_for_ai,
    time: task.time,
    priority: task.priority,
    status: task.status,
    projectName: task.project_name,
    labels: task.labels,
  };
}

async function getUserTaskContext(userId, selectedTaskIds = []) {
  const selectedIds = selectedTaskIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const selectedFilter =
    selectedIds.length > 0
      ? `AND t.task_id IN (${selectedIds.map(() => "?").join(",")})`
      : "";

  const [rows] = await pool.query(
    `
    SELECT
      t.task_id,
      t.title,
      t.description,
      t.deadline,
      DATE_FORMAT(t.deadline, '%Y-%m-%d %H:%i:%s') AS deadline_for_ai,
      t.time,
      t.priority,
      t.status,
      t.labels,
      p.name AS project_name
    FROM tasks t
    JOIN projects p ON p.project_id = t.project_id
    WHERE (
        p.owner_id = ?
        OR EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = p.project_id
            AND pm.user_id = ?
        )
      )
      AND p.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND t.completed_at IS NULL
      ${selectedFilter}
    ORDER BY
      CASE t.priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END,
      t.deadline IS NULL,
      t.deadline ASC,
      t.created_at ASC
    LIMIT 50
    `,
    [userId, userId, ...selectedIds],
  );

  return rows.map(normalizeTaskForAI);
}

router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        intent: "unknown",
        reply: "Bạn chưa nhập nội dung. Hãy nhập câu hỏi của bạn nhé!",
      });
    }

    const selectedTaskIds = Array.isArray(req.body.selectedTaskIds)
      ? req.body.selectedTaskIds
      : [];
    const tasks = await getUserTaskContext(req.user.id, selectedTaskIds);
    const response = await axios.post("http://localhost:5001/ai", {
      message,
      tasks,
      selectedTaskIds,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error("AI service error:", err.message);

    res.status(500).json({
      intent: "unknown",
      reply: "Lỗi kết nối tới AI service. Vui lòng thử lại sau.",
    });
  }
});

module.exports = router;
