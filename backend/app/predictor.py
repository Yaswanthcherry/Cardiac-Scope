"""
CardioScope — live inference engine.

Loads the four trained model pipelines once (lazy, cached) and exposes
a single `predict()` function that takes a PatientInput and returns a
LivePredictionResponse with genuine probabilities and binary predictions.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.models import BinaryPredictions, LivePredictionResponse, PatientInput, RiskScores

MODELS_DIR = Path(__file__).parent.parent / "data" / "models"

# ─── Lazy artifact loading ────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _load_meta() -> dict:
    with open(MODELS_DIR / "feature_meta.json") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_models() -> dict[str, Any]:
    targets = {"Cath": "cath", "LAD": "lad", "LCX": "lcx", "RCA": "rca"}
    return {
        target: joblib.load(MODELS_DIR / f"model_{short}.joblib")
        for target, short in targets.items()
    }


# ─── Build a single-row DataFrame in the exact column order seen at training ──


def _input_to_dataframe(patient: PatientInput) -> pd.DataFrame:
    """
    Convert a PatientInput to a one-row DataFrame with the original
    column names (using field aliases) in the order stored in feature_meta.json.
    """
    meta = _load_meta()
    feature_cols: list[str] = meta["feature_cols"]

    # model_dump(by_alias=True) gives us original dataset column names
    raw: dict = patient.model_dump(by_alias=True)

    # Build the row using exactly the columns the model was trained on
    row = {col: raw.get(col, None) for col in feature_cols}
    return pd.DataFrame([row], columns=feature_cols)


# ─── Public inference function ────────────────────────────────────────────────


def predict(patient: PatientInput) -> LivePredictionResponse:
    """
    Run genuine model inference and return predicted probabilities + classes.

    Probabilities are the model's predict_proba()[:,1] (positive class).
    Binary threshold is 0.5.
    """
    models = _load_models()
    df = _input_to_dataframe(patient)

    # Each target → (prob, pred)
    results: dict[str, tuple[float, int]] = {}
    for target, model in models.items():
        prob: float = float(model.predict_proba(df)[0][1])
        pred: int = int(model.predict(df)[0])
        results[target] = (prob, pred)

    return LivePredictionResponse(
        risk=RiskScores(
            cad=round(results["Cath"][0], 4),
            lad=round(results["LAD"][0], 4),
            lcx=round(results["LCX"][0], 4),
            rca=round(results["RCA"][0], 4),
        ),
        prediction=BinaryPredictions(
            cad=results["Cath"][1],
            lad=results["LAD"][1],
            lcx=results["LCX"][1],
            rca=results["RCA"][1],
        ),
        source="live_inference",
    )
