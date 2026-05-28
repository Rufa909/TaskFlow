import json
import pickle

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

with open("dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

texts = [item["text"] for item in data]
labels = [item["intent"] for item in data]

vectorizer = TfidfVectorizer()

X = vectorizer.fit_transform(texts)

model = LogisticRegression()

model.fit(X, labels)

pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))

print("AI da duoc train!")