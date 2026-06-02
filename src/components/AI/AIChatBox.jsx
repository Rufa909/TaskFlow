import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosInstance";
import "./AIChatBox.css";

function formatTaskDate(value) {
  if (!value) return "No deadline";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?", sender: "bot" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const messagesEndRef = useRef(null);

  const selectedTaskIdSet = useMemo(
    () => new Set(selectedTaskIds.map(String)),
    [selectedTaskIds],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIdSet.has(String(task.task_id))),
    [tasks, selectedTaskIdSet],
  );

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;

    const loadTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const response = await api.get("/tasks");
        setTasks(response.data.tasks || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, [isOpen]);

  const toggleTaskSelection = (taskId) => {
    const normalizedId = String(taskId);

    setSelectedTaskIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId],
    );
  };

  const clearTaskSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = { text: inputValue, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await api.post("/ai/chat", {
        message: userMessage.text,
        selectedTaskIds,
      });
      const data = response.data;
      const botMessage = { text: data.reply || "Xin lỗi, tôi chưa hiểu ý bạn.", sender: "bot" };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage = { text: "Lỗi kết nối tới AI. Vui lòng thử lại sau.", sender: "bot" };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`ai-chatbox-container ${isOpen ? "open" : ""}`}>
      {isOpen && (
        <div className="ai-chatbox-window">
          <div className="ai-chatbox-header">
            <h3>Trợ lý AI</h3>
            <button className="close-btn" onClick={toggleChat} aria-label="Đóng Chat">
              &times;
            </button>
          </div>

          <div className="ai-task-picker">
            <button
              type="button"
              className="ai-task-picker-toggle"
              onClick={() => setIsTaskPanelOpen((value) => !value)}
            >
              <span>
                {selectedTaskIds.length > 0
                  ? `${selectedTaskIds.length} task đã chọn`
                  : "Chọn task cho AI"}
              </span>
              <span aria-hidden="true">{isTaskPanelOpen ? "−" : "+"}</span>
            </button>

            {isTaskPanelOpen && (
              <div className="ai-task-picker-panel">
                <div className="ai-task-picker-actions">
                  <span>{isLoadingTasks ? "Đang tải task..." : `${tasks.length} task đang mở`}</span>
                  {selectedTaskIds.length > 0 && (
                    <button type="button" onClick={clearTaskSelection}>
                      Bỏ chọn
                    </button>
                  )}
                </div>

                <div className="ai-task-list">
                  {!isLoadingTasks && tasks.length === 0 && (
                    <div className="ai-task-empty">Chưa có task đang mở.</div>
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
                          {task.project_name || "No project"} · {task.priority || "medium"} · {formatTaskDate(task.deadline)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedTasks.length > 0 && (
            <div className="ai-selected-tasks">
              {selectedTasks.slice(0, 3).map((task) => (
                <span key={task.task_id}>{task.title}</span>
              ))}
              {selectedTasks.length > 3 && <span>+{selectedTasks.length - 3}</span>}
            </div>
          )}

          <div className="ai-chatbox-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="message-bubble bot typing">
                <span>.</span><span>.</span><span>.</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="ai-chatbox-input-area" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Nhập câu hỏi..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !inputValue.trim()}>
              Gửi
            </button>
          </form>
        </div>
      )}
      <button className="ai-chatbox-toggle" onClick={toggleChat} aria-label="Mở Trợ lý AI">
        SP
      </button>
    </div>
  );
}
