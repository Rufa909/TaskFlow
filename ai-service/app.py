from datetime import datetime
from pathlib import Path
import pickle
import re

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)
CORS(app)

with open(BASE_DIR / "model.pkl", "rb") as model_file:
    model = pickle.load(model_file)

with open(BASE_DIR / "vectorizer.pkl", "rb") as vectorizer_file:
    vectorizer = pickle.load(vectorizer_file)

OUT_OF_SCOPE_REPLY = (
    "Xin lỗi, tôi chỉ hỗ trợ các câu hỏi liên quan đến task, deadline, "
    "project, năng suất làm việc và marketing."
)

responses = {
    "unknown": OUT_OF_SCOPE_REPLY,
    "out_of_scope": OUT_OF_SCOPE_REPLY,
    "deadline_help": (
        "Bạn nên ưu tiên các task có deadline gần nhất. Hãy kiểm tra tab "
        "'Sắp tới' để xem task nào cần hoàn thành trước."
    ),
    "task_breakdown": (
        "Hãy chia project thành nhiều task nhỏ, mỗi task có deadline và độ ưu "
        "tiên rõ ràng. Với task lớn, bạn nên tách thành các bước có thể hoàn "
        "thành trong 1-2 ngày."
    ),
    "productivity_help": (
        "Bạn nên tập trung vào task có độ ưu tiên cao và deadline gần trước. "
        "Sau đó gom các task nhỏ cùng loại để xử lý theo từng nhóm."
    ),
    "add_task_help": (
        "Bạn có thể tạo task mới bằng cách nhập tên task ở thanh tạo task nhanh "
        "phía trên danh sách công việc."
    ),
    "delete_task_help": (
        "Để xóa task, hãy di chuột lên task và bấm biểu tượng thùng rác màu đỏ."
    ),
    "view_upcoming": (
        "Bạn có thể chuyển sang tab 'Sắp tới' ở menu bên trái để xem các task "
        "có hạn chót trong tương lai."
    ),
    "label_help": (
        "Bạn có thể dùng nhãn để phân loại task theo chiến dịch, kênh marketing, "
        "mức độ ưu tiên hoặc loại công việc."
    ),
    "marketing_help": (
        "Để triển khai marketing hiệu quả, bạn nên xác định mục tiêu, khách hàng "
        "mục tiêu, thông điệp chính, kênh triển khai, ngân sách, deadline và các "
        "task cụ thể để theo dõi tiến độ."
    ),
}

CONFIDENCE_THRESHOLD = 0.35

TASK_CONTEXT_KEYWORDS = [
    "task",
    "tsk",
    "công việc",
    "cong viec",
    "việc",
    "viec",
    "cv",
    "deadline",
    "dl",
    "due",
    "hạn chót",
    "han chot",
    "quá hạn",
    "qua han",
    "hôm nay",
    "hom nay",
    "hn",
    "ngày mai",
    "ngay mai",
    "ưu tiên",
    "uu tien",
    "gấp",
    "gap",
    "làm gì trước",
    "lam gi truoc",
    "nên làm gì",
    "nen lam gi",
    "sắp tới",
    "sap toi",
    "lịch",
    "lich",
]

TASK_CONTEXT_STRONG_KEYWORDS = [
    "deadline",
    "dl",
    "due",
    "hạn chót",
    "han chot",
    "quá hạn",
    "qua han",
    "ưu tiên",
    "uu tien",
    "gấp",
    "gap",
    "làm gì trước",
    "lam gi truoc",
    "nên làm gì",
    "nen lam gi",
    "sắp tới",
    "sap toi",
]

TASK_CONTEXT_TIME_KEYWORDS = [
    "hôm nay",
    "hom nay",
    "hn",
    "ngày mai",
    "ngay mai",
    "lịch",
    "lich",
]

TASK_CONTEXT_WORK_KEYWORDS = [
    "task",
    "tsk",
    "công việc",
    "cong viec",
    "việc",
    "viec",
    "cv",
    "deadline",
    "dl",
    "due",
    "hạn chót",
    "han chot",
    "ưu tiên",
    "uu tien",
]

ALLOWED_KEYWORDS = TASK_CONTEXT_KEYWORDS + [
    "project",
    "dự án",
    "subtask",
    "năng suất",
    "marketing",
    "quảng cáo",
    "chiến dịch",
    "content",
    "seo",
    "khách hàng",
    "thương hiệu",
    "doanh số",
    "bán hàng",
]


def is_gibberish(text):
    cleaned = re.sub(
        r"[^a-zA-ZÀ-ỹ\s]",
        "",
        text.lower().strip(),
    )
    if len(cleaned) == 0:
        return True

    vowels = set("aeiouyàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ")
    return not any(char in vowels for char in cleaned)


def parse_deadline(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text).replace(tzinfo=None)
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue

    return None


def priority_score(priority):
    return {
        "high": 0,
        "medium": 1,
        "low": 2,
    }.get(str(priority or "").lower(), 3)


def task_sort_key(task):
    deadline = parse_deadline(task.get("deadline"))
    now = datetime.now()
    is_overdue = deadline is not None and deadline < now

    return (
        0 if is_overdue else 1,
        deadline is None,
        deadline or datetime.max,
        priority_score(task.get("priority")),
    )


def format_deadline(value):
    deadline = parse_deadline(value)
    if not deadline:
        return "chưa có deadline"

    return deadline.strftime("%d/%m/%Y %H:%M")


def should_use_task_context(message):
    text = message.lower()
    has_strong_context = any(keyword in text for keyword in TASK_CONTEXT_STRONG_KEYWORDS)
    has_time_context = any(keyword in text for keyword in TASK_CONTEXT_TIME_KEYWORDS)
    has_work_context = any(keyword in text for keyword in TASK_CONTEXT_WORK_KEYWORDS)

    return has_strong_context or (has_time_context and has_work_context)


def is_in_allowed_scope(message):
    text = message.lower()
    return any(keyword in text for keyword in ALLOWED_KEYWORDS)


def build_task_recommendation(tasks):
    if not tasks:
        return (
            "Hiện tại tôi chưa thấy task đang mở nào của bạn. Bạn có thể tạo task "
            "mới rồi hỏi lại tôi để được gợi ý ưu tiên."
        )

    sorted_tasks = sorted(tasks, key=task_sort_key)[:5]
    lines = []

    for index, task in enumerate(sorted_tasks, start=1):
        title = task.get("title") or "Task chưa có tên"
        priority = task.get("priority") or "chưa đặt"
        project_name = task.get("projectName") or "không rõ project"
        deadline = format_deadline(task.get("deadline"))
        lines.append(
            f"{index}. {title} - priority: {priority}, deadline: {deadline}, project: {project_name}"
        )

    return (
        "Dựa trên task hiện tại, bạn nên ưu tiên theo thứ tự này:\n"
        + "\n".join(lines)
        + "\n\nLý do: tôi ưu tiên task quá hạn hoặc gần deadline trước, sau đó xét độ ưu tiên."
    )


def predict_intent(message):
    X = vectorizer.transform([message])
    probabilities = model.predict_proba(X)[0]
    max_prob = probabilities.max()
    intent = model.predict(X)[0]

    if max_prob < CONFIDENCE_THRESHOLD:
        return "unknown", max_prob

    return intent, max_prob


@app.route("/ai", methods=["POST"])
def ai_chat():
    data = request.json or {}
    message = str(data.get("message", "")).strip()
    tasks = data.get("tasks") or []

    if not message:
        return jsonify({
            "intent": "unknown",
            "reply": "Bạn chưa nhập nội dung. Hãy nhập câu hỏi của bạn nhé!",
        })

    if is_gibberish(message):
        return jsonify({
            "intent": "out_of_scope",
            "reply": OUT_OF_SCOPE_REPLY,
        })

    if len(message.split()) <= 1:
        return jsonify({
            "intent": "unknown",
            "reply": "Câu hỏi quá ngắn, bạn có thể diễn đạt rõ hơn được không?",
        })

    if should_use_task_context(message):
        return jsonify({
            "intent": "task_context",
            "reply": build_task_recommendation(tasks),
        })

    intent, confidence = predict_intent(message)

    if intent in ("unknown", "out_of_scope"):
        if not is_in_allowed_scope(message):
            return jsonify({
                "intent": "out_of_scope",
                "confidence": float(confidence),
                "reply": OUT_OF_SCOPE_REPLY,
            })

    reply = responses.get(intent, responses["unknown"])

    return jsonify({
        "intent": intent,
        "confidence": float(confidence),
        "reply": reply,
    })


if __name__ == "__main__":
    app.run(port=5001, debug=True)
