import React, { useState, useRef, useEffect } from "react";
import api from "../../api/axiosInstance";
import "./AIChatBox.css";

export default function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?", sender: "bot" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = { text: inputValue, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5001/ai", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ message: userMessage.text }) });
  const data = await response.json();
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
