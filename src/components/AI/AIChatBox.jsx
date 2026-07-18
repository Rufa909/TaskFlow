import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosInstance";
import "./AIChatBox.css";

// ─── Simple Markdown Renderer ───────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return "";

  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Numbered list: collect consecutive items
    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      result.push(
        `<ol>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`
      );
      continue;
    }

    // Bullet list: - or *
    if (/^[-*]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ""));
        i++;
      }
      result.push(
        `<ul>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`
      );
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)[1].length;
      const content = line.replace(/^#{1,3}\s/, "");
      result.push(`<h${level + 2}>${inlineMarkdown(content)}</h${level + 2}>`);
      i++;
      continue;
    }

    // Normal paragraph
    result.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }

  return result.join("");
}

function inlineMarkdown(text) {
  return text
    // Bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

// ─── Date formatter ──────────────────────────────────────────────────────────
function formatTaskDate(value) {
  if (!value) return "Không có deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không có deadline";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: "Xin chào! Tôi là trợ lý AI của TaskFlow, được tích hợp với **Ollama (llama3.2)**.\n\nTôi có thể giúp bạn:\n- Xem và phân tích task, project của bạn\n- Gợi ý ưu tiên công việc theo deadline\n- Giải đáp câu hỏi về công việc trong hệ thống\n\nHãy hỏi tôi bất cứ điều gì về task của bạn!",
      sender: "bot",
      time: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [aiProvider, setAiProvider] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const selectedTaskIdSet = useMemo(
    () => new Set(selectedTaskIds.map(String)),
    [selectedTaskIds]
  );

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIdSet.has(String(task.task_id))),
    [tasks, selectedTaskIdSet]
  );

  const toggleChat = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingTasks(true);
      try {
        const [tasksRes, projectsRes] = await Promise.allSettled([
          api.get("/tasks"),
          api.get("/projects"),
        ]);
        if (tasksRes.status === "fulfilled") {
          setTasks(tasksRes.value.data.tasks || []);
        }
        if (projectsRes.status === "fulfilled") {
          setProjects(projectsRes.value.data.projects || projectsRes.value.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadData();

    // Focus input when opened
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const toggleTaskSelection = useCallback((taskId) => {
    const normalizedId = String(taskId);
    setSelectedTaskIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId]
    );
  }, []);

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const handleSend = useCallback(
    async (e) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text || isLoading) return;

      const userMessage = { text, sender: "user", time: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);

      try {
        const response = await api.post("/ai/chat", {
          message: text,
          selectedTaskIds,
        });
        const data = response.data;

        if (data.provider) setAiProvider(data.provider);

        const botMessage = {
          text: data.reply || "Xin lỗi, tôi chưa hiểu ý bạn.",
          sender: "bot",
          time: new Date(),
          provider: data.provider,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch (err) {
        console.error(err);
        const errorMessage = {
          text: "⚠️ Không kết nối được tới AI. Hãy đảm bảo Ollama đang chạy (`ollama serve`) và thử lại.",
          sender: "bot",
          time: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, selectedTaskIds]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(e);
      }
    },
    [handleSend]
  );

  const clearMessages = useCallback(() => {
    setMessages([
      {
        text: "Cuộc trò chuyện đã được xóa. Tôi vẫn có thể truy cập dữ liệu task và project của bạn. Hỏi tôi bất cứ điều gì!",
        sender: "bot",
        time: new Date(),
      },
    ]);
  }, []);

  // Priority badge color
  const getPriorityClass = (priority) => {
    if (priority === "high") return "priority-high";
    if (priority === "low") return "priority-low";
    return "priority-medium";
  };

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`ai-chatbox-container ${isOpen ? "open" : ""}`}>
      {isOpen && (
        <div className="ai-chatbox-window">
          {/* Header */}
          <div className="ai-chatbox-header">
            <div className="ai-header-left">
              <div className="ai-avatar">
                <span>🤖</span>
              </div>
              <div className="ai-header-info">
                <h3>Trợ lý AI TaskFlow</h3>
                <span className="ai-status">
                  <span className="ai-status-dot" />
                  {aiProvider ? `Powered by ${aiProvider}` : "Ollama · llama3.2"}
                </span>
              </div>
            </div>
            <div className="ai-header-actions">
              <button
                type="button"
                className="ai-header-btn"
                onClick={clearMessages}
                title="Xóa cuộc trò chuyện"
                aria-label="Xóa lịch sử chat"
              >
                🗑️
              </button>
              <button
                type="button"
                className="ai-header-btn close-btn"
                onClick={toggleChat}
                aria-label="Đóng Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Context Summary Bar */}
          {!isLoadingTasks && (tasks.length > 0 || projects.length > 0) && (
            <div className="ai-context-bar">
              <span className="ai-context-item">
                📁 {projects.length} project
              </span>
              <span className="ai-context-item">
                ✅ {tasks.length} task đang mở
              </span>
              {tasks.filter(t => t.priority === "high").length > 0 && (
                <span className="ai-context-item ai-context-urgent">
                  🔥 {tasks.filter(t => t.priority === "high").length} ưu tiên cao
                </span>
              )}
            </div>
          )}

          {/* Task Picker */}
          <div className="ai-task-picker">
            <button
              type="button"
              className="ai-task-picker-toggle"
              onClick={() => setIsTaskPanelOpen((v) => !v)}
            >
              <span>
                {selectedTaskIds.length > 0
                  ? `📌 ${selectedTaskIds.length} task đã chọn để hỏi`
                  : "📌 Chọn task cụ thể để hỏi AI"}
              </span>
              <span className="picker-arrow" aria-hidden="true">
                {isTaskPanelOpen ? "▲" : "▼"}
              </span>
            </button>

            {isTaskPanelOpen && (
              <div className="ai-task-picker-panel">
                <div className="ai-task-picker-actions">
                  <span className="ai-task-count">
                    {isLoadingTasks ? "⏳ Đang tải..." : `${tasks.length} task đang mở`}
                  </span>
                  {selectedTaskIds.length > 0 && (
                    <button type="button" className="ai-clear-btn" onClick={clearTaskSelection}>
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>

                <div className="ai-task-list">
                  {!isLoadingTasks && tasks.length === 0 && (
                    <div className="ai-task-empty">Chưa có task nào đang mở.</div>
                  )}

                  {tasks.map((task) => (
                    <label className="ai-task-option" key={task.task_id}>
                      <input
                        type="checkbox"
                        checked={selectedTaskIdSet.has(String(task.task_id))}
                        onChange={() => toggleTaskSelection(task.task_id)}
                      />
                      <span className="ai-task-option-main">
                        <span className="ai-task-title">{task.title}</span>
                        <span className="ai-task-meta">
                          <span className={`ai-priority-badge ${getPriorityClass(task.priority)}`}>
                            {task.priority || "medium"}
                          </span>
                          <span>{task.project_name || "No project"}</span>
                          {task.deadline && (
                            <span>📅 {formatTaskDate(task.deadline)}</span>
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Tasks Chips */}
          {selectedTasks.length > 0 && (
            <div className="ai-selected-chips">
              {selectedTasks.slice(0, 3).map((task) => (
                <span key={task.task_id} className="ai-chip">
                  {task.title}
                  <button
                    type="button"
                    onClick={() => toggleTaskSelection(task.task_id)}
                    aria-label={`Bỏ chọn ${task.title}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedTasks.length > 3 && (
                <span className="ai-chip ai-chip-more">+{selectedTasks.length - 3}</span>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="ai-chatbox-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`ai-message-wrap ${msg.sender}`}>
                {msg.sender === "bot" && (
                  <div className="ai-bot-avatar">🤖</div>
                )}
                <div className={`message-bubble ${msg.sender} ${msg.isError ? "error" : ""}`}>
                  {msg.sender === "bot" ? (
                    <div
                      className="markdown-content"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  ) : (
                    <span>{msg.text}</span>
                  )}
                  <span className="message-time">{formatTime(msg.time)}</span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="ai-message-wrap bot">
                <div className="ai-bot-avatar">🤖</div>
                <div className="message-bubble bot typing">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="typing-label">AI đang suy nghĩ...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="ai-chatbox-input-area" onSubmit={handleSend}>
            <textarea
              ref={inputRef}
              placeholder="Hỏi AI về task, deadline, project của bạn..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="ai-textarea"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="ai-send-btn"
              aria-label="Gửi tin nhắn"
            >
              {isLoading ? (
                <span className="send-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </form>
          <div className="ai-footer-hint">
            Enter để gửi · Shift+Enter xuống dòng
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        className={`ai-chatbox-toggle ${isOpen ? "active" : ""}`}
        onClick={toggleChat}
        aria-label="Mở Trợ lý AI"
      >
        {isOpen ? (
          <span>✕</span>
        ) : (
          <span className="ai-toggle-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
            <span className="ai-toggle-label">AI</span>
          </span>
        )}
      </button>
    </div>
  );
}
