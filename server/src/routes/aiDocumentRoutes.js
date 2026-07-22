/**
 * aiDocumentRoutes.js
 * RAG (Retrieval-Augmented Generation) — Quản lý tài liệu cho AI ChatBox
 *
 * Luồng hoạt động:
 *  1. User upload PDF/MD/TXT → backend trích xuất text → chunk → embed qua Ollama → lưu DB
 *  2. Khi user hỏi AI → backend tìm chunk liên quan → nhét vào system prompt
 */

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ─── Config ─────────────────────────────────────────────────────────────────

/** Ollama embedding endpoint (dùng chung base URL với chat) */
const OLLAMA_BASE_URL = (process.env.LLAMA_API_BASE_URL || "http://localhost:11434/v1")
  .replace(/\/v1\/?$/, "")
  .replace(/\/$/, "");

const EMBED_MODEL = "nomic-embed-text"; // ~274MB, cài bằng: ollama pull nomic-embed-text
const CHUNK_WORDS = 350;  // số từ mỗi đoạn
const CHUNK_OVERLAP = 50; // số từ overlap giữa các đoạn (giúp AI không bỏ sót ngữ cảnh)
const MAX_FILE_SIZE_MB = 5;
const MAX_CHUNKS_PER_USER = 1000; // giới hạn tổng chunk mỗi user

// ─── Multer (xử lý upload file) ─────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(), // không lưu file lên ổ cứng, chỉ process rồi bỏ
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".md", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Chỉ hỗ trợ: ${allowed.join(", ")}`));
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Kiểm tra bảng DB tồn tại (tránh crash nếu chưa migrate) */
async function tableExists(tableName) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [tableName],
  );
  return rows[0].cnt > 0;
}

/** Tách văn bản thành các chunk nhỏ có overlap */
function chunkText(text, chunkWords = CHUNK_WORDS, overlapWords = CHUNK_OVERLAP) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkWords - overlapWords) {
    const chunk = words.slice(i, i + chunkWords).join(" ");
    if (chunk.trim().length > 30) chunks.push(chunk); // bỏ chunk quá ngắn
  }
  return chunks;
}

/** Trích xuất text thuần từ file buffer */
async function extractText(buffer, ext) {
  if (ext === ".pdf") {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    if (!data.text || data.text.trim().length < 50) {
      throw new Error("PDF không đọc được text. Đảm bảo file không phải ảnh scan.");
    }
    return data.text;
  }
  // MD, TXT: đọc trực tiếp
  return buffer.toString("utf8");
}

/** Lấy vector embedding từ Ollama */
async function getEmbedding(text) {
  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/embeddings`,
    { model: EMBED_MODEL, prompt: text.slice(0, 2000) },
    { timeout: 90000 },
  );
  const embedding = response.data?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`Ollama không trả về embedding. Đảm bảo đã cài model: ollama pull ${EMBED_MODEL}`);
  }
  return embedding;
}

/** Cosine similarity giữa 2 vector */
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// ─── Export utilities dùng trong aiRoutes.js ─────────────────────────────────

/**
 * Tìm chunk tài liệu liên quan nhất với câu hỏi của user.
 * Được gọi từ aiRoutes.js trước khi build system prompt.
 */
async function retrieveRelevantChunks(userId, queryText, topK = 3) {
  try {
    if (!(await tableExists("ai_documents"))) return [];

    // 1. Embed câu hỏi
    const queryEmbedding = await getEmbedding(queryText);

    // 2. Load tất cả chunk của user từ DB
    const [rows] = await pool.query(
      "SELECT file_name, chunk_text, embedding FROM ai_documents WHERE user_id = ? LIMIT ?",
      [userId, MAX_CHUNKS_PER_USER],
    );
    if (rows.length === 0) return [];

    // 3. Tính cosine similarity và sắp xếp
    const scored = rows.map((row) => ({
      fileName: row.file_name,
      text: row.chunk_text,
      score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding)),
    }));
    scored.sort((a, b) => b.score - a.score);

    // 4. Trả về topK chunk có score > 0.25 (ngưỡng liên quan)
    return scored.filter((r) => r.score > 0.25).slice(0, topK);
  } catch (err) {
    console.error("retrieveRelevantChunks error:", err.message);
    return []; // graceful degradation — không crash AI chat
  }
}

module.exports.retrieveRelevantChunks = retrieveRelevantChunks;

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/documents/upload
 * Upload và index tài liệu PDF/MD/TXT vào DB
 */
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Không có file nào được gửi." });

  const ext      = path.extname(req.file.originalname).toLowerCase();
  const fileName = req.file.originalname;

  try {
    if (!(await tableExists("ai_documents"))) {
      return res.status(503).json({ error: "Bảng ai_documents chưa tồn tại. Vui lòng chạy migration." });
    }

    // Trích xuất text
    const rawText = await extractText(req.file.buffer, ext);
    const chunks  = chunkText(rawText);
    if (chunks.length === 0) return res.status(400).json({ error: "File quá ngắn hoặc không có nội dung." });

    // Kiểm tra giới hạn tổng chunk của user
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM ai_documents WHERE user_id = ?",
      [req.user.id],
    );
    if (Number(total) + chunks.length > MAX_CHUNKS_PER_USER) {
      return res.status(400).json({
        error: `Đã đạt giới hạn tài liệu (${MAX_CHUNKS_PER_USER} đoạn). Xóa bớt tài liệu cũ trước khi upload.`,
      });
    }

    // Xóa doc cũ cùng tên nếu upload lại
    await pool.query("DELETE FROM ai_documents WHERE user_id = ? AND file_name = ?", [req.user.id, fileName]);

    // Embed và lưu từng chunk
    let indexed = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await getEmbedding(chunks[i]);
        await pool.query(
          "INSERT INTO ai_documents (user_id, file_name, file_type, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?, ?, ?)",
          [req.user.id, fileName, ext.replace(".", ""), i, chunks[i], JSON.stringify(embedding)],
        );
        indexed++;
      } catch (embErr) {
        console.error(`Chunk ${i} embed error:`, embErr.message);
      }
    }

    return res.json({
      success: true,
      fileName,
      totalChunks: chunks.length,
      indexedChunks: indexed,
      message: indexed === chunks.length
        ? `✅ Đã index ${indexed} đoạn từ "${fileName}"`
        : `⚠️ Index ${indexed}/${chunks.length} đoạn. Một số chunk bị lỗi embed.`,
    });
  } catch (err) {
    console.error("Upload doc error:", err.message);
    return res.status(500).json({ error: err.message || "Lỗi xử lý file." });
  }
});

/**
 * GET /api/ai/documents
 * Danh sách tài liệu đã upload
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!(await tableExists("ai_documents"))) return res.json({ documents: [] });

    const [rows] = await pool.query(
      `SELECT file_name, file_type, COUNT(*) AS chunk_count, MAX(created_at) AS uploaded_at
       FROM ai_documents
       WHERE user_id = ?
       GROUP BY file_name, file_type
       ORDER BY uploaded_at DESC`,
      [req.user.id],
    );
    return res.json({ documents: rows });
  } catch (err) {
    console.error("List docs error:", err.message);
    return res.json({ documents: [] });
  }
});

/**
 * DELETE /api/ai/documents/:fileName
 * Xóa tài liệu theo tên file
 */
router.delete("/:fileName", authMiddleware, async (req, res) => {
  try {
    if (!(await tableExists("ai_documents"))) return res.json({ success: false });

    await pool.query("DELETE FROM ai_documents WHERE user_id = ? AND file_name = ?", [
      req.user.id,
      decodeURIComponent(req.params.fileName),
    ]);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete doc error:", err.message);
    return res.json({ success: false });
  }
});

module.exports.router = router;
