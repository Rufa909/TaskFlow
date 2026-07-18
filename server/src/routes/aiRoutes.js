const express = require("express");
const axios = require("axios");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const DEFAULT_LLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_LLAMA_MODEL = "llama3.2:latest";

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
    stageName: task.stage_name,
    labels: parseLabels(task.labels),
    assignees: task.assignee_names ? String(task.assignee_names).split(", ") : [],
    subtaskCount: Number(task.subtask_count || 0),
    completedSubtaskCount: Number(task.completed_subtask_count || 0),
    latestComment: task.latest_comment,
  };
}

function parseLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
  }
}

function getLlamaConfig() {
  const apiKey = process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || "ollama";

  return {
    apiKey,
    baseUrl: (process.env.LLAMA_API_BASE_URL || DEFAULT_LLAMA_BASE_URL).replace(/\/$/, ""),
    model: process.env.LLAMA_MODEL || DEFAULT_LLAMA_MODEL,
    timeoutMs: Number(process.env.LLAMA_TIMEOUT_MS || 120000),
  };
}

function buildSelectedTaskFilter(selectedIds) {
  if (selectedIds.length === 0) {
    return { sql: "", params: [] };
  }

  return {
    sql: `AND t.task_id IN (${selectedIds.map(() => "?").join(",")})`,
    params: selectedIds,
  };
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [tableName],
  );

  return rows.length > 0;
}

async function getUserTaskContext(userId, selectedTaskIds = []) {
  const selectedIds = selectedTaskIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const selectedFilter = buildSelectedTaskFilter(selectedIds);
  const [hasSubtasks, hasComments, hasStages, hasAssignees] = await Promise.all([
    tableExists("task_subtasks"),
    tableExists("task_comments"),
    tableExists("project_stages"),
    tableExists("task_assignees"),
  ]);
  const subtaskSelect = hasSubtasks
    ? `
      COUNT(DISTINCT st.subtask_id) AS subtask_count,
      COUNT(DISTINCT CASE WHEN st.completed_at IS NOT NULL THEN st.subtask_id END) AS completed_subtask_count,
    `
    : `
      0 AS subtask_count,
      0 AS completed_subtask_count,
    `;
  const commentSelect = hasComments
    ? `
      (
        SELECT tc.body
        FROM task_comments tc
        WHERE tc.task_id = t.task_id
          AND tc.deleted_at IS NULL
        ORDER BY tc.created_at DESC
        LIMIT 1
      ) AS latest_comment
    `
    : "NULL AS latest_comment";
  const subtaskJoin = hasSubtasks
    ? "LEFT JOIN task_subtasks st ON st.task_id = t.task_id AND st.deleted_at IS NULL"
    : "";
  const stageSelect = hasStages ? "ps.stage_name" : "NULL AS stage_name";
  const stageJoin = hasStages ? "LEFT JOIN project_stages ps ON ps.id = t.stage_id" : "";
  const assigneeSelect = hasAssignees
    ? "GROUP_CONCAT(DISTINCT u.username ORDER BY u.username SEPARATOR ', ') AS assignee_names"
    : "NULL AS assignee_names";
  const assigneeJoin = hasAssignees
    ? `
    LEFT JOIN task_assignees ta ON ta.task_id = t.task_id
    LEFT JOIN users u ON u.user_id = ta.user_id
    `
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
      p.name AS project_name,
      ${stageSelect},
      ${assigneeSelect},
      ${subtaskSelect}
      ${commentSelect}
    FROM tasks t
    JOIN projects p ON p.project_id = t.project_id
    ${stageJoin}
    ${assigneeJoin}
    ${subtaskJoin}
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
      ${selectedFilter.sql}
    GROUP BY
      t.task_id,
      t.title,
      t.description,
      t.deadline,
      t.time,
      t.priority,
      t.status,
      t.labels,
      p.name
      ${hasStages ? ", ps.stage_name" : ""}
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
    LIMIT 60
    `,
    [userId, userId, ...selectedFilter.params],
  );

  return rows.map(normalizeTaskForAI);
}

async function getUserProjectContext(userId) {
  const hasStages = await tableExists("project_stages");
  const stageSelect = hasStages
    ? "GROUP_CONCAT(DISTINCT ps.stage_name ORDER BY ps.stage_order SEPARATOR ' | ') AS workflowStages"
    : "NULL AS workflowStages";
  const stageJoin = hasStages ? "LEFT JOIN project_stages ps ON ps.project_id = p.project_id" : "";

  const [rows] = await pool.query(
    `
    SELECT
      p.project_id AS id,
      p.name,
      CASE
        WHEN p.owner_id = ? THEN 'owner'
        ELSE pm.role
      END AS userRole,
      COUNT(DISTINCT t.task_id) AS openTaskCount,
      COUNT(DISTINCT CASE WHEN t.priority = 'high' THEN t.task_id END) AS highPriorityCount,
      COUNT(DISTINCT CASE WHEN t.deadline IS NOT NULL AND t.deadline < NOW() AND t.completed_at IS NULL THEN t.task_id END) AS overdueCount,
      ${stageSelect}
    FROM projects p
    LEFT JOIN project_members pm
      ON pm.project_id = p.project_id
     AND pm.user_id = ?
    LEFT JOIN tasks t
      ON t.project_id = p.project_id
     AND t.deleted_at IS NULL
     AND t.completed_at IS NULL
    ${stageJoin}
    WHERE (p.owner_id = ? OR pm.user_id IS NOT NULL)
      AND p.deleted_at IS NULL
    GROUP BY p.project_id, p.name, p.owner_id, pm.role
    ORDER BY p.created_at ASC
    LIMIT 30
    `,
    [userId, userId, userId],
  );

  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    userRole: project.userRole,
    openTaskCount: Number(project.openTaskCount || 0),
    highPriorityCount: Number(project.highPriorityCount || 0),
    overdueCount: Number(project.overdueCount || 0),
    workflowStages: project.workflowStages ? String(project.workflowStages).split(" | ") : [],
  }));
}

async function getUserNotificationContext(userId) {
  if (!(await tableExists("notifications"))) {
    return [];
  }

  const [rows] = await pool.query(
    `
    SELECT n.type, n.reference_id AS referenceId, n.created_at AS createdAt
    FROM notifications n
    WHERE n.user_id = ?
      AND n.is_read = 0
    ORDER BY n.created_at DESC
    LIMIT 20
    `,
    [userId],
  );

  return rows;
}

async function getTaskFlowContext(userId, selectedTaskIds) {
  const [tasks, projects, notifications] = await Promise.all([
    getUserTaskContext(userId, selectedTaskIds),
    getUserProjectContext(userId),
    getUserNotificationContext(userId),
  ]);

  return {
    currentDate: new Date().toISOString(),
    projects,
    tasks,
    unreadNotifications: notifications,
  };
}

function buildSystemPrompt(context) {
  const now = new Date(context.currentDate);
  const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const projectSummary = context.projects.length > 0
    ? context.projects.map(p =>
        `- "${p.name}" (vai trò: ${p.userRole}, ${p.openTaskCount} task mở, ${p.overdueCount} quá hạn${p.highPriorityCount > 0 ? `, ${p.highPriorityCount} ưu tiên cao` : ``}${p.workflowStages.length > 0 ? `, stages: ${p.workflowStages.join(" → ")}` : ""})`
      ).join("\n")
    : "Chưa có project nào.";

  const taskSummary = context.tasks.length > 0
    ? context.tasks.map((t, i) => {
        const parts = [
          `${i + 1}. [${t.priority?.toUpperCase() || "?"}] "${t.title}"`
        ];
        if (t.projectName) parts.push(`project: ${t.projectName}`);
        if (t.stageName) parts.push(`stage: ${t.stageName}`);
        if (t.deadline) parts.push(`deadline: ${t.deadline}`);
        if (t.status) parts.push(`trạng thái: ${t.status}`);
        if (t.assignees?.length) parts.push(`người phụ trách: ${t.assignees.join(", ")}`);
        if (t.subtaskCount > 0) parts.push(`subtask: ${t.completedSubtaskCount}/${t.subtaskCount} hoàn thành`);
        if (t.description) parts.push(`mô tả: ${t.description.slice(0, 120)}`);
        if (t.latestComment) parts.push(`comment mới nhất: "${t.latestComment.slice(0, 80)}"`);
        return parts.join(" | ");
      }).join("\n")
    : "Chưa có task nào đang mở.";

  const notifSummary = context.unreadNotifications?.length > 0
    ? `${context.unreadNotifications.length} thông báo chưa đọc.`
    : "Không có thông báo mới.";

  return (
    `Bạn là trợ lý AI thông minh tích hợp trong ứng dụng quản lý công việc TaskFlow.\n` +
    `Thời điểm hiện tại: ${dateStr}\n\n` +
    `=== DỮ LIỆU TASKFLOW CỦA NGƯỜI DÙNG ===\n\n` +
    `** DANH SÁCH PROJECT (${context.projects.length} project):**\n${projectSummary}\n\n` +
    `** DANH SÁCH TASK ĐANG MỞ (${context.tasks.length} task):**\n${taskSummary}\n\n` +
    `** THÔNG BÁO:** ${notifSummary}\n\n` +
    `=== HƯỚNG DẪN TRẢ LỜI ===\n` +
    `- Trả lời bằng tiếng Việt tự nhiên, rõ ràng, có cấu trúc.\n` +
    `- Dùng markdown (bold, bullet list, số thứ tự) để trình bày khi cần.\n` +
    `- CHỈ dựa vào dữ liệu TaskFlow ở trên để trả lời về task/project của người dùng.\n` +
    `- Nếu câu hỏi về task cụ thể, tìm trong danh sách trên và trích dẫn thông tin chính xác.\n` +
    `- Khi gợi ý ưu tiên: xét deadline gần, priority cao, task quá hạn trước.\n` +
    `- Nếu không có dữ liệu liên quan, nói rõ "Tôi không thấy thông tin đó trong hệ thống của bạn".\n` +
    `- Không bịa đặt task, deadline hoặc thông tin không có trong dữ liệu.`
  );
}

function buildLlamaMessages({ message, context, user }) {
  return [
    {
      role: "system",
      content: buildSystemPrompt(context),
    },
    {
      role: "user",
      content: `Người dùng: ${user.username}\n\nCâu hỏi: ${message}`,
    },
  ];
}

async function callOllamaNative({ message, context, user }) {
  const ollamaBaseUrl = (process.env.LLAMA_API_BASE_URL || "http://localhost:11434/v1")
    .replace(/\/v1\/?$/, "")
    .replace(/\/$/, "");
  const model = process.env.LLAMA_MODEL || DEFAULT_LLAMA_MODEL;
  const timeoutMs = Number(process.env.LLAMA_TIMEOUT_MS || 120000);

  const systemPrompt = buildSystemPrompt(context);
  const userContent = `Người dùng: ${user.username}\n\nCâu hỏi: ${message}`;

  const response = await axios.post(
    `${ollamaBaseUrl}/api/chat`,
    {
      model,
      stream: false,
      options: {
        temperature: Number(process.env.LLAMA_TEMPERATURE || 0.3),
        num_predict: Number(process.env.LLAMA_MAX_TOKENS || 1500),
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    },
    {
      timeout: timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { "Content-Type": "application/json" },
    },
  );

  const reply = response.data?.message?.content?.trim();

  if (!reply) {
    throw new Error("Ollama native API returned an empty response");
  }

  return {
    intent: "llama_taskflow_context",
    provider: "ollama",
    model,
    reply,
  };
}

async function callLlama({ message, context, user }) {
  const config = getLlamaConfig();
  const messages = buildLlamaMessages({ message, context, user });

  const response = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      temperature: Number(process.env.LLAMA_TEMPERATURE || 0.3),
      max_tokens: Number(process.env.LLAMA_MAX_TOKENS || 1500),
      messages,
    },
    {
      timeout: config.timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "TaskFlow",
      },
    },
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Ollama returned an empty response");
  }

  return {
    intent: "llama_taskflow_context",
    provider: "ollama",
    model: config.model,
    reply,
  };
}


async function callLocalAI({ message, tasks, selectedTaskIds, user }) {
  const response = await axios.post(
    process.env.LOCAL_AI_URL || "http://localhost:5001/ai",
    {
      message,
      tasks,
      selectedTaskIds,
      user,
    },
    { timeout: Number(process.env.LOCAL_AI_TIMEOUT_MS || 10000) },
  );

  return {
    ...response.data,
    provider: response.data?.provider || "local-ai",
  };
}

function formatTaskLine(task, index) {
  const parts = [
    task.title || "Task chưa có tên",
    task.projectName ? `project: ${task.projectName}` : null,
    task.priority ? `priority: ${task.priority}` : null,
    task.deadline ? `deadline: ${task.deadline}` : "chưa có deadline",
    task.stageName ? `stage: ${task.stageName}` : null,
  ].filter(Boolean);

  return `${index + 1}. ${parts.join(" - ")}`;
}

function buildOfflineReply(message, context) {
  const selectedOrTopTasks = context.tasks.slice(0, 5);

  if (selectedOrTopTasks.length === 0) {
    return {
      intent: "taskflow_context_fallback",
      provider: "node-fallback",
      reply:
        "Hiện tôi chưa thấy task đang mở nào trong dữ liệu TaskFlow của bạn. Bạn có thể tạo task mới hoặc chọn project/task cụ thể rồi hỏi lại để tôi gợi ý chính xác hơn.\n\n" +
        "Lưu ý: Llama/AI local chưa được cấu hình hoặc chưa chạy, nên tôi đang dùng chế độ gợi ý cơ bản từ backend.",
    };
  }

  const taskLines = selectedOrTopTasks.map(formatTaskLine).join("\n");
  const projectSummary = context.projects
    .slice(0, 3)
    .map((project) => `${project.name}: ${project.openTaskCount} task mở, ${project.overdueCount} quá hạn`)
    .join("; ");

  return {
    intent: "taskflow_context_fallback",
    provider: "node-fallback",
    reply:
      "Tôi đã đọc dữ liệu TaskFlow hiện có. Gợi ý nhanh:\n" +
      `${taskLines}\n\n` +
      "Nên ưu tiên task có deadline gần hoặc priority cao trước, sau đó xử lý theo stage hiện tại và cập nhật trạng thái sau khi làm xong." +
      (projectSummary ? `\n\nTổng quan project: ${projectSummary}.` : "") +
      `\n\nCâu hỏi của bạn: "${message}".\n` +
      "Lưu ý: Llama/AI local chưa được cấu hình hoặc chưa chạy, nên đây là chế độ gợi ý cơ bản từ backend.",
  };
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
    const context = await getTaskFlowContext(req.user.id, selectedTaskIds);
    const user = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
    };

    try {
      // 1. Try Ollama native API first (most reliable for local Ollama)
      const ollamaReply = await callOllamaNative({ message, context, user });
      if (ollamaReply) {
        return res.json(ollamaReply);
      }
    } catch (ollamaErr) {
      console.error("Ollama native error:", ollamaErr.message);

      try {
        // 2. Fallback: OpenAI-compatible endpoint (/v1/chat/completions)
        const llamaReply = await callLlama({ message, context, user });
        if (llamaReply) {
          return res.json(llamaReply);
        }
      } catch (llamaErr) {
        console.error("Ollama OpenAI-compat error:", llamaErr.response?.data || llamaErr.message);
      }
    }

    try {
      // 3. Fallback: Python local AI
      const localReply = await callLocalAI({
        message,
        tasks: context.tasks,
        selectedTaskIds,
        user,
      });

      return res.json(localReply);
    } catch (localErr) {
      console.error("Local AI service error:", localErr.response?.data || localErr.message);
      // 4. Final fallback: static offline reply
      return res.json(buildOfflineReply(message, context));
    }
  } catch (err) {
    console.error("AI route error:", err.response?.data || err.message);

    res.status(500).json({
      intent: "unknown",
      reply: "Lỗi kết nối tới AI service. Vui lòng thử lại sau.",
    });
  }
});

module.exports = router;
