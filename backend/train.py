"""
CardioScope — Model Training Script
====================================
Trains four binary classifiers on the Z-Alizadeh Sani dataset:
  Cath  → XGBoost   (overall CAD)
  LAD   → ExtraTrees
  LCX   → XGBoost
  RCA   → Logistic Regression

Saves per-model Pipeline artifacts to backend/data/models/.
Prints 5-fold cross-validated evaluation metrics for each target.

Run:
    cd backend
    python train.py
"""

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
MODELS_DIR = DATA_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

DATASET_PATH = DATA_DIR / "dataset.xlsx"

# ─── Load dataset ─────────────────────────────────────────────────────────────
print("Loading dataset …")
df = pd.read_excel(DATASET_PATH, sheet_name="Sheet 1 - Table 1")
print(f"  Shape: {df.shape}")

TARGET_COLS = ["Cath", "LAD", "LCX", "RCA"]

# ─── Encode targets ───────────────────────────────────────────────────────────
y = {
    "Cath": df["Cath"].map({"CAD": 1, "Normal": 0}),
    "LAD":  df["LAD"].map({"Stenotic": 1, "Normal": 0}),
    "LCX":  df["LCX"].map({"Stenotic": 1, "Normal": 0}),
    "RCA":  df["RCA"].map({"Stenotic": 1, "Normal": 0}),
}
for t, s in y.items():
    assert s.isna().sum() == 0, f"NaNs in target {t}"

# ─── Feature matrix — drop targets ───────────────────────────────────────────
X_raw = df.drop(columns=TARGET_COLS)

# Drop constant features (e.g. "Exertional CP" is all "N")
constant_cols = [c for c in X_raw.columns if X_raw[c].nunique() <= 1]
print(f"  Dropping constant columns: {constant_cols}")
X = X_raw.drop(columns=constant_cols)

# Save which columns were kept so inference can reproduce the same X
feature_cols = X.columns.tolist()

numeric_features = X.select_dtypes(include=np.number).columns.tolist()
categorical_features = X.select_dtypes(exclude=np.number).columns.tolist()
print(f"  Numeric features : {len(numeric_features)}")
print(f"  Categorical features: {len(categorical_features)}")

# ─── Preprocessing ────────────────────────────────────────────────────────────
numeric_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler",  StandardScaler()),
])
categorical_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot",  OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
])
preprocessor = ColumnTransformer([
    ("num", numeric_transformer,    numeric_features),
    ("cat", categorical_transformer, categorical_features),
])

# ─── Model definitions (matching notebook final selection) ────────────────────
def make_xgb() -> Pipeline:
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", XGBClassifier(
            n_estimators=300,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            reg_alpha=0.1,
            reg_lambda=1.0,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )),
    ])


def make_extratrees() -> Pipeline:
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", ExtraTreesClassifier(
            n_estimators=700,
            max_depth=None,
            min_samples_split=3,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])


def make_logreg() -> Pipeline:
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(
            max_iter=3000,
            class_weight="balanced",
            C=1.0,
        )),
    ])


MODEL_FACTORIES = {
    "Cath": (make_xgb,        "XGBoost"),
    "LAD":  (make_extratrees, "ExtraTrees"),
    "LCX":  (make_xgb,        "XGBoost"),
    "RCA":  (make_logreg,     "LogisticRegression"),
}

# ─── Cross-validation ─────────────────────────────────────────────────────────
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

eval_rows = []
print("\n5-fold cross-validated evaluation:")
print("=" * 70)

for target, (factory, model_name) in MODEL_FACTORIES.items():
    model = factory()
    cv_prob = cross_val_predict(
        model, X, y[target], cv=cv, method="predict_proba", n_jobs=-1
    )[:, 1]
    cv_pred = (cv_prob >= 0.5).astype(int)

    acc  = accuracy_score(y[target],  cv_pred)
    prec = precision_score(y[target], cv_pred, zero_division=0)
    rec  = recall_score(y[target],    cv_pred, zero_division=0)
    f1   = f1_score(y[target],        cv_pred, zero_division=0)
    auc  = roc_auc_score(y[target],   cv_prob)

    row = {
        "Target": target, "Model": model_name,
        "Accuracy": round(acc, 4), "Precision": round(prec, 4),
        "Recall": round(rec, 4), "F1": round(f1, 4), "ROC-AUC": round(auc, 4),
    }
    eval_rows.append(row)
    print(f"\n  {target} ({model_name})")
    print(f"    Accuracy  : {acc:.4f}")
    print(f"    Precision : {prec:.4f}")
    print(f"    Recall    : {rec:.4f}")
    print(f"    F1        : {f1:.4f}")
    print(f"    ROC-AUC   : {auc:.4f}")

# Save evaluation results to JSON for the API to serve
eval_path = DATA_DIR / "model_evaluation.json"
with open(eval_path, "w") as f:
    json.dump(eval_rows, f, indent=2)
print(f"\nEvaluation saved → {eval_path}")

# ─── Train final models on full dataset & save ────────────────────────────────
print("\n" + "=" * 70)
print("Training final models on full dataset …")

trained = {}
for target, (factory, model_name) in MODEL_FACTORIES.items():
    print(f"  Training {target} ({model_name}) …")
    model = factory()
    model.fit(X, y[target])
    trained[target] = model
    out = MODELS_DIR / f"model_{target.lower()}.joblib"
    joblib.dump(model, out)
    print(f"    Saved → {out}")

# Save feature metadata so inference can reconstruct the same DataFrame columns
meta = {
    "feature_cols":       feature_cols,
    "numeric_features":   numeric_features,
    "categorical_features": categorical_features,
    "constant_cols_dropped": constant_cols,
    "target_encodings": {
        "Cath": {"CAD": 1, "Normal": 0},
        "LAD":  {"Stenotic": 1, "Normal": 0},
        "LCX":  {"Stenotic": 1, "Normal": 0},
        "RCA":  {"Stenotic": 1, "Normal": 0},
    },
}
meta_path = MODELS_DIR / "feature_meta.json"
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"  Feature metadata saved → {meta_path}")

# ─── Quick sanity-check: predict first row ────────────────────────────────────
print("\nSanity check — predict first row:")
row0 = X.iloc[[0]]
for target, model in trained.items():
    prob = model.predict_proba(row0)[0][1]
    pred = model.predict(row0)[0]
    print(f"  {target}: prob={prob:.4f}  pred={pred}")

print("\n✓ Training complete.")
