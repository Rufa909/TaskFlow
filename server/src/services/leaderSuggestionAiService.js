const axios = require("axios");

const DEFAULT_LLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_LLAMA_MODEL = "llama3.2:latest";

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getAiConfig() {
  const enabled = String(process.env.LEADER_SUGGESTIONS_AI_ENABLED || "true").toLowerCase() !== "false";
  return {
    enabled,
    apiKey: process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || "ollama",
    baseUrl: (process.env.LEADER_SUGGESTIONS_AI_BASE_URL || process.env.LLAMA_API_BASE_URL || DEFAULT_LLAMA_BASE_URL).replace(/\/$/, ""),
    model: process.env.LEADER_SUGGESTIONS_AI_MODEL || process.env.LLAMA_MODEL || DEFAULT_LLAMA_MODEL,
    timeoutMs: getNumberEnv("LEADER_SUGGESTIONS_AI_TIMEOUT_MS", getNumberEnv("LLAMA_TIMEOUT_MS", 30000)),
    maxTokens: getNumberEnv("LEADER_SUGGESTIONS_AI_MAX_TOKENS", 900),
    temperature: Number.isFinite(Number(process.env.LEADER_SUGGESTIONS_AI_TEMPERATURE))
      ? Number(process.env.LEADER_SUGGESTIONS_AI_TEMPERATURE)
      : 0.2,
  };
}

function compactText(value, maxLength = 420) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function summarizePackage(packageData) {
  if (!packageData) return null;
  return {
    stage: packageData.stage
      ? {
          id: packageData.stage.id,
          name: packageData.stage.stage_name,
          order: packageData.stage.stage_order,
          status: packageData.stage.status,
        }
      : null,
    documents: (packageData.documents || []).slice(0, 8).map((doc) => ({
      title: compactText(doc.title, 160),
      type: doc.document_type,
    })),
    discussions: (packageData.discussions || []).slice(-8).map((discussion) => ({
      author: discussion.user_name || "Member",
      message: compactText(discussion.message, 260),
    })),
    deliverables: (packageData.deliverables || []).slice(0, 8).map((item) => ({
      title: compactText(item.title, 160),
      description: compactText(item.description, 260),
      status: item.status,
    })),
    handover: packageData.handover
      ? {
          summary: compactText(packageData.handover.summary, 400),
          open_issues: compactText(packageData.handover.open_issues, 320),
          technical_limits: compactText(packageData.handover.technical_limits, 320),
          recommendations: compactText(packageData.handover.recommendations, 320),
        }
      : null,
  };
}

function summarizeTasks(tasks) {
  return (tasks || []).slice(0, 40).map((task) => ({
    task_id: task.task_id,
    title: compactText(task.title, 180),
    description: compactText(task.description, 300),
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    assignee_count: Number(task.assignee_count || 0),
    assignee_names: task.assignee_names || "",
  }));
}

function summarizeMembers(members) {
  return (members || []).slice(0, 30).map((member) => ({
    user_id: member.user_id,
    username: member.username,
    email: member.email,
    role: member.role,
    active_task_count: Number(member.active_task_count || 0),
    total_task_count: Number(member.total_task_count || 0),
  }));
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // Continue to brace extraction.
      }
    }

    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function sanitizePriority(priority) {
  const value = String(priority || "medium").toLowerCase();
  return ["high", "medium", "low"].includes(value) ? value : "medium";
}

function sanitizeSuggestion(item, index, membersById) {
  if (!item || typeof item !== "object") return null;
  const title = compactText(item.title, 180);
  const detail = compactText(item.detail, 520);
  if (!title || !detail) return null;

  const memberId = Number(item.recommended_member_id || item.recommended_member?.user_id);
  const recommendedMember = Number.isFinite(memberId) ? membersById.get(memberId) : null;

  return {
    id: item.id || `ai-${index + 1}`,
    type: compactText(item.type || "ai", 40),
    priority: sanitizePriority(item.priority),
    title,
    detail,
    source: compactText(item.source || "ai_analysis", 80),
    recommended_role: compactText(item.recommended_role || recommendedMember?.role || "", 80),
    recommended_member: recommendedMember || null,
    related_task_ids: Array.isArray(item.related_task_ids)
      ? item.related_task_ids.map(Number).filter((id) => Number.isFinite(id)).slice(0, 8)
      : [],
  };
}

function sanitizeAiPayload(payload, members) {
  const membersById = new Map((members || []).map((member) => [Number(member.user_id), member]));
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions
        .map((item, index) => sanitizeSuggestion(item, index, membersById))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    suggestions,
    risks: Array.isArray(payload?.risks) ? payload.risks.map((item) => compactText(item, 220)).filter(Boolean).slice(0, 5) : [],
    next_actions: Array.isArray(payload?.next_actions) ? payload.next_actions.map((item) => compactText(item, 220)).filter(Boolean).slice(0, 5) : [],
  };
}

function buildPrompt(context) {
  return [
    {
      role: "system",
      content:
        "You are TaskFlow's project leadership assistant. Return only valid JSON. Give practical, data-driven suggestions for a project leader. Use English only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        instruction:
          "Analyze the previous-stage handover, current stage tasks, member roles, and workload. Suggest concrete task assignment/help for the leader. Prefer existing member roles and avoid inventing people. Return JSON with suggestions, risks, and next_actions.",
        output_schema: {
          suggestions: [
            {
              type: "assignment | review | risk | planning | technical | quality | handover",
              priority: "high | medium | low",
              title: "short title",
              detail: "specific explanation",
              source: "current_tasks | previous_stage_documents | previous_stage_discussions | workload | ai_analysis",
              recommended_role: "role name",
              recommended_member_id: "existing user_id if clearly appropriate, otherwise null",
              related_task_ids: ["task ids if relevant"],
            },
          ],
          risks: ["short risk notes"],
          next_actions: ["short next actions"],
        },
        project_context: context,
      }),
    },
  ];
}

async function generateLeaderSuggestionsWithAi({ stage, incomingPackage, currentPackage, tasks, members, metrics }) {
  const config = getAiConfig();
  if (!config.enabled) return null;

  const context = {
    stage: stage
      ? {
          id: stage.id,
          name: stage.stage_name,
          order: stage.stage_order,
          status: stage.status,
        }
      : null,
    metrics,
    previous_stage: summarizePackage(incomingPackage),
    current_stage: summarizePackage(currentPackage),
    tasks: summarizeTasks(tasks),
    members: summarizeMembers(members),
  };

  const response = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: buildPrompt(context),
      response_format: { type: "json_object" },
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

  const content = response.data?.choices?.[0]?.message?.content || response.data?.message?.content || "";
  const parsed = extractJson(content);
  const sanitized = sanitizeAiPayload(parsed, members);

  if (sanitized.suggestions.length === 0) {
    throw new Error("AI returned no usable leader suggestions");
  }

  return {
    provider: "ai",
    model: config.model,
    ...sanitized,
  };
}

module.exports = {
  generateLeaderSuggestionsWithAi,
};
