from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import re

app = Flask(__name__)
CORS(app)

# Load trained model
model = pickle.load(open("model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

# Response logic
responses = {
    "unknown": "Xin lỗi, tôi chưa hiểu ý bạn. Tôi hỗ trợ về: quản lý công việc (task), deadline, chia nhỏ project, năng suất, xem lịch, gắn nhãn, và marketing doanh nghiệp.",
    "deadline_help": "Bạn nên ưu tiên các task có deadline gần nhất. Hãy kiểm tra tab 'Sắp tới' để xem task nào cần hoàn thành trước.",
    "task_breakdown": "Hãy chia project thành nhiều task nhỏ để dễ quản lý. Bạn có thể tạo các subtask bên trong mỗi task chính.",
    "productivity_help": "Bạn nên tập trung hoàn thành các task high priority trước. Hãy dùng tính năng sắp xếp theo độ ưu tiên để biết task nào cần làm gấp.",
    "add_task_help": "Bạn có thể tạo task mới bằng cách nhập tên task ở thanh 'Tạo task nhanh' phía trên danh sách công việc.",
    "delete_task_help": "Để xóa task, bạn hãy di chuột lên task và bấm vào biểu tượng thùng rác màu đỏ nhé.",
    "view_upcoming": "Bạn có thể chuyển sang tab 'Sắp tới' ở menu bên trái để xem các task có hạn chót trong tương lai.",
    "label_help": "Để phân loại công việc tốt hơn, bạn có thể tạo và gắn các Nhãn (Labels) nhiều màu sắc cho mỗi task.",
    "marketing_help": "Để phát triển marketing hiệu quả, bạn nên: 1) Lên kế hoạch chi tiết, 2) Phân chia công việc thành các task nhỏ, 3) Đặt deadline rõ ràng, 4) Theo dõi tiến độ từng chiến dịch. Hãy sử dụng ứng dụng này để quản lý các task marketing của bạn."
}

# Confidence threshold
CONFIDENCE_THRESHOLD = 0.35


def is_gibberish(text):
    """Check if input is gibberish (random characters, no real words)."""
    cleaned = re.sub(r'[^a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\s]', '', text.lower().strip())
    if len(cleaned) == 0:
        return True
    # If text has no vowels at all (Vietnamese or English), likely gibberish
    vowels = set('aeiouyàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ')
    if not any(c in vowels for c in cleaned):
        return True
    return False


@app.route("/ai", methods=["POST"])
def ai_chat():
    data = request.json
    if not data or "message" not in data:
        return jsonify({"error": "Message is required"}), 400

    message = data["message"].strip()

    # Guard: empty message
    if not message:
        return jsonify({
            "intent": "unknown",
            "reply": "Bạn chưa nhập nội dung. Hãy nhập câu hỏi của bạn nhé!"
        })

    # Guard: gibberish input
    if is_gibberish(message):
        return jsonify({
            "intent": "unknown",
            "reply": responses["unknown"]
        })

    # Guard: too short (single word) — not enough context
    if len(message.split()) <= 1:
        return jsonify({
            "intent": "unknown",
            "reply": "Câu hỏi quá ngắn, bạn có thể diễn đạt rõ hơn được không? Ví dụ: 'Làm sao tạo task mới?'"
        })

    # Predict with model
    X = vectorizer.transform([message])
    probabilities = model.predict_proba(X)[0]
    max_prob = probabilities.max()
    intent = model.predict(X)[0]

    # Guard: low confidence — model is not sure
    if max_prob < CONFIDENCE_THRESHOLD:
        return jsonify({
            "intent": "unknown",
            "reply": responses["unknown"]
        })

    # If model predicts "unknown" intent explicitly
    if intent == "unknown":
        return jsonify({
            "intent": "unknown",
            "reply": responses["unknown"]
        })

    reply = responses.get(intent, responses["unknown"])

    return jsonify({
        "intent": intent,
        "reply": reply
    })


if __name__ == "__main__":
    app.run(port=5001, debug=True)