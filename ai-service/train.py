import json
import pickle
from pathlib import Path

from sklearn.metrics import classification_report
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion

BASE_DIR = Path(__file__).resolve().parent

with open(BASE_DIR / "dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

texts = [item["text"] for item in data]
labels = [item["intent"] for item in data]

vectorizer = FeatureUnion([
    (
        "word",
        TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            lowercase=True,
            strip_accents="unicode",
            min_df=1,
        ),
    ),
    (
        "char",
        TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            lowercase=True,
            strip_accents="unicode",
            min_df=1,
        ),
    ),
])

train_texts, test_texts, train_labels, test_labels = train_test_split(
    texts,
    labels,
    test_size=0.2,
    random_state=42,
    stratify=labels,
)

X_train = vectorizer.fit_transform(train_texts)
X_test = vectorizer.transform(test_texts)

model = LogisticRegression(
    class_weight="balanced",
    max_iter=1000,
)

model.fit(X_train, train_labels)

predicted = model.predict(X_test)
print(classification_report(test_labels, predicted, zero_division=0))

X_all = vectorizer.fit_transform(texts)
model.fit(X_all, labels)

with open(BASE_DIR / "model.pkl", "wb") as model_file:
    pickle.dump(model, model_file)

with open(BASE_DIR / "vectorizer.pkl", "wb") as vectorizer_file:
    pickle.dump(vectorizer, vectorizer_file)

print(f"AI da duoc train voi {len(data)} cau mau!")
