"""CardioScope FastAPI backend."""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.data_loader import (
    load_patient_summaries,
    load_predictions,
    load_shap_for_patient,
    load_summary_stats,
)
from app.models import (
    LivePredictionResponse,
    PatientInput,
    PatientPrediction,
    PatientShap,
    PatientSummary,
    SummaryStats,
)
from app.predictor import predict as run_predict

app = FastAPI(
    title="CardioScope API",
    description=(
        "Cardiovascular risk prediction API — educational / decision-support only. "
        "Not a substitute for clinical diagnosis."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "CardioScope API", "version": "2.0.0"}


# ── Stored-patient routes (unchanged) ────────────────────────────────────────


@app.get("/patients", response_model=list[PatientSummary], tags=["patients"])
def get_all_patients(
    cad_only: bool = Query(False, description="Return only CAD-positive patients"),
):
    summaries = load_patient_summaries()
    if cad_only:
        summaries = [s for s in summaries if s.cad_pred == 1]
    return summaries


@app.get("/patients/{patient_id}", response_model=PatientPrediction, tags=["patients"])
def get_patient(patient_id: int):
    if patient_id < 1 or patient_id > 303:
        raise HTTPException(status_code=404, detail="Patient ID must be between 1 and 303")
    preds = load_predictions()
    try:
        return next(p for p in preds if p.patient_id == patient_id)
    except StopIteration:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")


@app.get("/shap/{patient_id}", response_model=PatientShap, tags=["shap"])
def get_shap(patient_id: int):
    if patient_id < 1 or patient_id > 303:
        raise HTTPException(status_code=404, detail="Patient ID must be between 1 and 303")
    return load_shap_for_patient(patient_id)


@app.get("/summary", response_model=SummaryStats, tags=["summary"])
def get_summary():
    return load_summary_stats()


# ── Live inference ─────────────────────────────────────────────────────────────


@app.post(
    "/predict",
    response_model=LivePredictionResponse,
    tags=["predict"],
    summary="Real-time CAD / vessel stenosis prediction from patient features",
    description=(
        "Accepts clinical, demographic, ECG, and lab features for a single patient "
        "and returns predicted probabilities and binary classifications for overall CAD "
        "(Cath), LAD, LCX, and RCA stenosis using trained ML models. "
        "**For educational and decision-support purposes only.**"
    ),
)
def predict_patient(patient: PatientInput):
    """Run genuine model inference on manually entered patient data."""
    try:
        return run_predict(patient)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


# ── Model evaluation metadata ─────────────────────────────────────────────────


@app.get("/model/evaluation", tags=["model"])
def get_model_evaluation():
    """Return cross-validated evaluation metrics for each trained model."""
    eval_path = Path(__file__).parent.parent / "data" / "model_evaluation.json"
    if not eval_path.exists():
        raise HTTPException(status_code=404, detail="Evaluation data not found. Run train.py first.")
    with open(eval_path) as f:
        return json.load(f)
