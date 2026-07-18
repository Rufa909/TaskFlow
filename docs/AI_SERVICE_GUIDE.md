# AI Service Guide cho TaskFlow

## Llama 4 trong AI Chat Box

Backend route `/api/ai/chat` sẽ ưu tiên gọi Llama nếu có API key, đồng thời truyền context thật từ database TaskFlow: project, task đang mở, deadline, priority, stage, assignee, subtask/comment gần nhất và notification chưa đọc.

Thêm các biến sau vào `.env`:

```env
LLAMA_API_KEY=your_provider_key
LLAMA_API_BASE_URL=https://api.groq.com/openai/v1
LLAMA_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
```

Nếu dùng OpenRouter:

```env
LLAMA_API_KEY=your_openrouter_key
LLAMA_API_BASE_URL=https://openrouter.ai/api/v1
LLAMA_MODEL=meta-llama/llama-4-maverick
```

Nếu chưa cấu hình `LLAMA_API_KEY`, hệ thống tự fallback về AI local Flask ở `LOCAL_AI_URL` hoặc `http://localhost:5001/ai`.

## AI Local Cũ

- Flask service nằm trong `ai-service/app.py`.
- Model tự train dùng `model.pkl` và `vectorizer.pkl`.
- Chạy service local trên port `5001`.
- Node backend vẫn gọi service này khi Llama chưa được cấu hình hoặc provider Llama bị lỗi.
