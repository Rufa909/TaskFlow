# AI Service Guide cho TaskFlow

## Ollama (Local) — Provider hiện tại

Backend route `/api/ai/chat` gọi Ollama local tại `http://localhost:11434/api/chat`.

Model được chọn tự động theo thứ tự ưu tiên:
```
qwen2.5:3b → qwen2.5:7b → llama3.2:latest → model đầu tiên có sẵn
```

Cấu hình trong `.env` (tuỳ chọn):
```env
# Mặc định: http://localhost:11434/v1 và llama3.2:latest
LLAMA_API_BASE_URL=http://localhost:11434/v1
LLAMA_MODEL=llama3.2:latest
LLAMA_TIMEOUT_MS=30000
LLAMA_MAX_TOKENS=220
```

## Dùng Cloud Provider (Groq / OpenRouter)

```env
LLAMA_API_KEY=your_provider_key
LLAMA_API_BASE_URL=https://api.groq.com/openai/v1
LLAMA_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
```

Nếu chưa cấu hình `LLAMA_API_KEY`, hệ thống tự fallback về AI local Flask ở `LOCAL_AI_URL` hoặc `http://localhost:5001/ai`.

## Fallback chain

```
Ollama local (localhost:11434)
    ↓ lỗi
Flask AI local (localhost:5001) — model.pkl tự train
    ↓ lỗi
Node fallback — trả lời cứng từ dữ liệu DB
```

## AI Local Cũ

- Flask service nằm trong `ai-service/app.py`.
- Model tự train dùng `model.pkl` và `vectorizer.pkl`.
- Chạy service local trên port `5001`.
- Node backend vẫn gọi service này khi Ollama chưa được cấu hình hoặc bị lỗi.

---

## Tính năng AI nâng cao (mới thêm)

### Cấp 1 — Multi-turn Memory
Mỗi request gửi tối đa **10 lượt hội thoại gần nhất** (20 message) cho Ollama.
AI sẽ nhớ ngữ cảnh trong cùng phiên chat — không cần hỏi lại.

### Cấp 2 — Lịch sử chat lưu DB
Bảng `ai_chat_history` lưu mọi cặp hỏi/đáp theo `session_id`.

| Trường | Mô tả |
|---|---|
| `user_id` | User đang chat |
| `session_id` | UUID phiên chat (tạo mới khi user bấm Xóa chat) |
| `role` | `user` hoặc `assistant` |
| `content` | Nội dung tin nhắn (tối đa 8000 ký tự) |
| `provider` | `ollama`, `groq`, `local-ai`... |

Routes mới:
- `GET /api/ai/history` — load lại lịch sử khi mở chatbox
- `DELETE /api/ai/history` — xóa khi user bấm nút ⌫
- Tự động dọn history cũ hơn **30 ngày** (2% xác suất mỗi request)

### Cấp 3 — Thu thập hành vi & cá nhân hóa
Bảng `ai_user_insights` ghi nhận hành vi người dùng:

| Trường | Mô tả |
|---|---|
| `frequent_topics` | JSON: chủ đề hay hỏi `{ "deadline": 5, "task": 3 }` |
| `active_hours` | JSON: thời gian dùng app `{ "morning": 8 }` |
| `total_messages` | Tổng số câu hỏi |

Sau **5 câu hỏi**, system prompt được bổ sung hint cá nhân hóa:
```
Hành vi người dùng ghi nhận: hay hỏi về deadline/hạn chót, ưu tiên công việc;
thường dùng app vào buổi tối. Ưu tiên trả lời ngắn gọn, đúng trọng tâm.
```

Chủ đề được nhận diện: `deadline`, `priority`, `project`, `task`, `workflow`, `team`, `report`.
