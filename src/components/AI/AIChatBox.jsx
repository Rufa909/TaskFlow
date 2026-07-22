import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosInstance";
import "./AIChatBox.css";

const OLLAMA_AVATAR_SRC = "/ollama-avatar.png";

function inlineMarkdown(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(text) {
  if (!text) return "";

  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      result.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (/^[-*]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ""));
        i++;
      }
      result.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)?.[1].length || 1;
      const content = line.replace(/^#{1,3}\s/, "");
      result.push(`<h${level + 2}>${inlineMarkdown(content)}</h${level + 2}>`);
      i++;
      continue;
    }

    result.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }

  return result.join("");
}

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

export default function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: "Xin chào! Tôi là trợ lý AI của TaskFlow.\n\nTôi có thể giúp bạn:\n- Xem và phân tích task, project của bạn\n- Gợi ý ưu tiên công việc theo deadline\n- Giải đáp câu hỏi về công việc trong hệ thống\n\nHãy hỏi tôi bất cứ điều gì về task của bạn!",
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
  const [isComposing, setIsComposing] = useState(false);
  // session_id nhóm các lượt chat cùng phiên; một phiên mới khi user xóa chat
  const [sessionId, setSessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
  );
  // RAG: tài liệu đã upload
  const [documents, setDocuments] = useState([]);
  const [isDocPanelOpen, setIsDocPanelOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedTaskIdSet = useMemo(
    () => new Set(selectedTaskIds.map(String)),
    [selectedTaskIds],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIdSet.has(String(task.task_id))),
    [tasks, selectedTaskIdSet],
  );

  const toggleChat = useCallback(() => {
    setIsOpen((value) => !value);
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
        const [tasksRes, projectsRes, historyRes, docsRes] = await Promise.allSettled([
          api.get("/tasks"),
          api.get("/projects"),
          api.get("/ai/history"),
          api.get("/ai/documents"),  // RAG: load danh sách tài liệu
        ]);

        if (tasksRes.status === "fulfilled") {
          setTasks(tasksRes.value.data.tasks || []);
        }
        if (projectsRes.status === "fulfilled") {
          setProjects(projectsRes.value.data.projects || projectsRes.value.data || []);
        }
        if (historyRes.status === "fulfilled") {
          const { history, sessionId: dbSessionId } = historyRes.value.data;
          if (Array.isArray(history) && history.length > 0) {
            // Khôi phục lịch sử chat cũ từ DB
            setMessages(
              history.map((h) => ({
                text: h.content,
                sender: h.role === "user" ? "user" : "bot",
                time: new Date(h.created_at),
                provider: h.provider,
              })),
            );
            if (dbSessionId) setSessionId(dbSessionId);
          }
        }
        if (docsRes.status === "fulfilled") {
          setDocuments(docsRes.value.data.documents || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadData();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const toggleTaskSelection = useCallback((taskId) => {
    const normalizedId = String(taskId);
    setSelectedTaskIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId],
    );
  }, []);

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const handleSend = useCallback(
    async (event) => {
      event?.preventDefault();
      const text = inputValue.trim();
      if (!text || isLoading) return;

      // Build history TRƯEỚC khi thêm tin nhắn hiện tại vào state
      // để Ollama có ngữ cảnh các lượt trước (multi-turn memory)
      const chatHistory = messages
        .filter((m) => m.sender === "user" || m.sender === "bot")
        .slice(-20)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      setMessages((prev) => [...prev, { text, sender: "user", time: new Date() }]);
      setInputValue("");
      setIsLoading(true);

      try {
        const response = await api.post("/ai/chat", {
          message: text,
          selectedTaskIds,
          sessionId,
          chatHistory,
        });
        const data = response.data;

        if (data.provider) setAiProvider(data.provider);

        setMessages((prev) => [
          ...prev,
          {
            text: data.reply || "Xin lỗi, tôi chưa hiểu ý bạn.",
            sender: "bot",
            time: new Date(),
            provider: data.provider,
          },
        ]);
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            text: "Không kết nối được tới AI. Hãy đảm bảo dịch vụ AI đang chạy và thử lại.",
            sender: "bot",
            time: new Date(),
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, selectedTaskIds, messages, sessionId],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.nativeEvent?.isComposing || isComposing || event.keyCode === 229) return;

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend(event);
      }
    },
    [handleSend, isComposing],
  );

  // RAG: upload tài liệu lên server để index
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/ai/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Refresh danh sách tài liệu
      const docsRes = await api.get("/ai/documents");
      setDocuments(docsRes.data.documents || []);
      setMessages((prev) => [
        ...prev,
        { text: res.data.message || `✅ Đã upload "${file.name}"`, sender: "bot", time: new Date() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          text: `❌ Upload thất bại: ${err.response?.data?.error || err.message}`,
          sender: "bot",
          time: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsUploading(false);
      event.target.value = ""; // reset input để upload lại cùng file
    }
  }, []);

  const handleDeleteDoc = useCallback(async (fileName) => {
    try {
      await api.delete(`/ai/documents/${encodeURIComponent(fileName)}`);
      setDocuments((prev) => prev.filter((d) => d.file_name !== fileName));
    } catch (err) {
      console.error("Delete doc error:", err);
    }
  }, []);

  const clearMessages = useCallback(() => {
    // Tạo session mới để lịch sử cũ không ảnh hưởng phiên chat mới
    const newSessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36);
    setSessionId(newSessionId);
    // Xóa lịch sử trên DB (non-blocking)
    api.delete("/ai/history").catch((err) => console.error("Failed to clear AI history:", err));
    setMessages([
      {
        text: "Cuộc trò chuyện đã được xóa. Tôi vẫn có thể truy cập dữ liệu task và project của bạn. Hỏi tôi bất cứ điều gì!",
        sender: "bot",
        time: new Date(),
      },
    ]);
  }, []);

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

  const highPriorityCount = tasks.filter((task) => task.priority === "high").length;

  return (
    <div className={`ai-chatbox-container ${isOpen ? "open" : ""}`}>
      {isOpen && (
        <div className="ai-chatbox-window">
          <div className="ai-chatbox-header">
            <div className="ai-header-left">
              <div className="ai-avatar">
                <img src={OLLAMA_AVATAR_SRC} alt="Ollama" />
              </div>
              <div className="ai-header-info">
                <h3>Trợ lý AI TaskFlow</h3>
                <span className="ai-status">
                  <span className="ai-status-dot" />
                  {aiProvider ? `Powered by ${aiProvider}` : "TaskFlow AI"}
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
                <span aria-hidden="true">⌫</span>
              </button>
              <button
                type="button"
                className="ai-header-btn close-btn"
                onClick={toggleChat}
                aria-label="Đóng Chat"
              >
                ×
              </button>
            </div>
          </div>

          {!isLoadingTasks && (tasks.length > 0 || projects.length > 0) && (
            <div className="ai-context-bar">
              <span className="ai-context-item">{projects.length} project</span>
              <span className="ai-context-item">{tasks.length} task đang mở</span>
              {highPriorityCount > 0 && (
                <span className="ai-context-item ai-context-urgent">
                  {highPriorityCount} ưu tiên cao
                </span>
              )}
              {documents.length > 0 && (
                <span className="ai-context-item ai-context-docs">
                  📎 {documents.length} tài liệu
                </span>
              )}
            </div>
          )}

          <div className="ai-task-picker">
            <button
              type="button"
              className="ai-task-picker-toggle"
              onClick={() => setIsTaskPanelOpen((value) => !value)}
            >
              <span>
                {selectedTaskIds.length > 0
                  ? `${selectedTaskIds.length} task đã chọn để hỏi`
                  : "Chọn task cụ thể để hỏi AI"}
              </span>
              <span className="picker-arrow" aria-hidden="true">
                {isTaskPanelOpen ? "▲" : "▼"}
              </span>
            </button>

            {isTaskPanelOpen && (
              <div className="ai-task-picker-panel">
                <div className="ai-task-picker-actions">
                  <span className="ai-task-count">
                    {isLoadingTasks ? "Đang tải..." : `${tasks.length} task đang mở`}
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
                          {task.deadline && <span>{formatTaskDate(task.deadline)}</span>}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RAG: Panel quản lý tài liệu */}
          <div className="ai-task-picker">
            <button
              type="button"
              className="ai-task-picker-toggle"
              onClick={() => setIsDocPanelOpen((v) => !v)}
            >
              <span>
                {documents.length > 0
                  ? `📎 ${documents.length} tài liệu đã upload`
                  : "📎 Upload tài liệu cho AI (PDF, MD, TXT)"}
              </span>
              <span className="picker-arrow" aria-hidden="true">
                {isDocPanelOpen ? "▲" : "▼"}
              </span>
            </button>

            {isDocPanelOpen && (
              <div className="ai-task-picker-panel">
                <div className="ai-task-picker-actions">
                  <span className="ai-task-count">
                    {documents.length === 0 ? "Chưa có tài liệu nào" : `${documents.length} tài liệu`}
                  </span>
                  <button
                    type="button"
                    className="ai-clear-btn"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? "Đang xử lý..." : "+ Upload"}
                  </button>
                </div>

                <div className="ai-task-list">
                  {documents.length === 0 && (
                    <div className="ai-task-empty">
                      Upload PDF, Markdown hoặc TXT để AI đọc và trả lời dựa trên tài liệu của bạn.
                    </div>
                  )}
                  {documents.map((doc) => (
                    <div key={doc.file_name} className="ai-task-option" style={{ cursor: "default" }}>
                      <span className="ai-task-option-main">
                        <span className="ai-task-title">{doc.file_name}</span>
                        <span className="ai-task-meta">
                          <span>{doc.file_type?.toUpperCase()}</span>
                          <span>{doc.chunk_count} đoạn</span>
                        </span>
                      </span>
                      <button
                        type="button"
                        className="ai-clear-btn"
                        style={{ color: "#e53e3e" }}
                        onClick={() => handleDeleteDoc(doc.file_name)}
                        aria-label={`Xóa ${doc.file_name}`}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Hidden file input cho RAG upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

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


          <div className="ai-chatbox-messages">
            {messages.map((msg, index) => (
              <div key={`${msg.sender}-${index}`} className={`ai-message-wrap ${msg.sender}`}>
                {msg.sender === "bot" && (
                  <div className="ai-bot-avatar">
                    <img src={OLLAMA_AVATAR_SRC} alt="Ollama" />
                  </div>
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
                <div className="ai-bot-avatar">
                  <img src={OLLAMA_AVATAR_SRC} alt="Ollama" />
                </div>
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

          <form className="ai-chatbox-input-area" onSubmit={handleSend}>
            <button
              type="button"
              className="ai-upload-btn"
              title={isUploading ? "Đang xử lý..." : "Upload tài liệu cho AI"}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload tài liệu"
            >
              {isUploading ? <span className="send-spinner" /> : "📎"}
            </button>
            <textarea
              ref={inputRef}
              placeholder="Hỏi AI về task, deadline, project của bạn..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
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
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </form>
          </div>
      )}

      <button
        className={`ai-chatbox-toggle ${isOpen ? "active" : ""}`}
        onClick={toggleChat}
        aria-label="Mở Trợ lý AI"
      >
        {isOpen ? (
          <span>×</span>
        ) : (
          <span className="ai-toggle-icon">
            <img src={OLLAMA_AVATAR_SRC} alt="Ollama" />
          </span>
        )}
      </button>
    </div>
  );
}
