from flask import Flask, request, jsonify
import pickle

app = Flask(__name__)

# Load trained model
model = pickle.load(open("model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

# Response logic
responses = {
    "deadline_help": "Bạn nên ưu tiên các task có deadline gần nhất.",

    "task_breakdown": "Hãy chia project thành nhiều task nhỏ để dễ quản lý.",

    "productivity_help": "Bạn nên tập trung hoàn thành các task high priority trước."
}

@app.route("/ai", methods=["POST"])
def ai_chat():

    data = request.json

    if not data or "message" not in data:
        return jsonify({
            "error": "Message is required"
        }), 400

    message = data["message"]

    X = vectorizer.transform([message])

    intent = model.predict(X)[0]

    reply = responses.get(
        intent,
        "Tôi chỉ hỗ trợ workflow và task management."
    )

    return jsonify({
        "intent": intent,
        "reply": reply
    })