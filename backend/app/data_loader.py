"""Data loading and caching layer for CardioScope."""

import json
import re
from functools import lru_cache
from pathlib import Path

from app.models import (
    BinaryPredictions,
    PatientPrediction,
    PatientShap,
    PatientSummary,
    RiskScores,
    ShapEntry,
    SummaryStats,
)

DATA_DIR = Path(__file__).parent.parent / "data"
PREDICTIONS_PATH = DATA_DIR / "cardiovascular_predictions.json"
SHAP_PATH = DATA_DIR / "cardiovascular_shap.json"

# ---------------------------------------------------------------------------
# Feature name prettifier
# ---------------------------------------------------------------------------

_FEATURE_LABELS: dict[str, str] = {
    "num__Age": "Age",
    "num__Weight": "Weight (kg)",
    "num__Length": "Height (cm)",
    "num__BMI": "BMI",
    "num__BP": "Blood Pressure",
    "num__PR": "Pulse Rate",
    "num__FBS": "Fasting Blood Sugar",
    "num__CR": "Creatinine",
    "num__TG": "Triglycerides",
    "num__LDL": "LDL Cholesterol",
    "num__HDL": "HDL Cholesterol",
    "num__BUN": "Blood Urea Nitrogen",
    "num__ESR": "ESR",
    "num__HB": "Hemoglobin",
    "num__K": "Potassium (K)",
    "num__Na": "Sodium (Na)",
    "num__WBC": "WBC Count",
    "num__Lymph": "Lymphocytes",
    "num__Neut": "Neutrophils",
    "num__PLT": "Platelets",
    "num__EF-TTE": "Ejection Fraction (Echo)",
    "num__Region RWMA": "Region RWMA",
    "num__Wall Motion Abnormality": "Wall Motion Abnormality",
    "num__Typical Chest Pain": "Typical Chest Pain",
    "num__Atypical": "Atypical Chest Pain",
    "num__Dyspnea": "Dyspnea",
    "num__Tinversion": "T Inversion (ECG)",
    "num__St Elevation": "ST Elevation (ECG)",
    "num__St Depression": "ST Depression (ECG)",
    "num__Current Smoker": "Current Smoker",
    "num__Ex-Smoker": "Ex-Smoker",
    "num__DM": "Diabetes Mellitus",
    "num__HTN": "Hypertension",
    "num__Obesity": "Obesity",
    "num__CRF": "Chronic Renal Failure",
    "num__CVA": "Cerebrovascular Accident",
    "num__Airway disease": "Airway Disease",
    "num__Thyroid Disease": "Thyroid Disease",
    "num__CHF": "Congestive Heart Failure",
    "num__DLP": "Dyslipidemia",
    "num__Edema": "Edema",
    "num__Weak Peripheral Pulse": "Weak Peripheral Pulse",
    "num__Lung rales": "Lung Rales",
    "num__Systolic Murmur": "Systolic Murmur",
    "num__Diastolic Murmur": "Diastolic Murmur",
    "num__Levine": "Levine Sign",
}


def _prettify_feature(raw: str) -> str:
    """Return a human-readable feature label."""
    if raw in _FEATURE_LABELS:
        return _FEATURE_LABELS[raw]
    # Strip prefix and title-case the remainder
    cleaned = re.sub(r"^(num__|cat__)", "", raw)
    cleaned = re.sub(r"_[YN]$", "", cleaned)
    return cleaned.replace("_", " ").strip()


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_predictions() -> list[PatientPrediction]:
    """Load and validate all 303 prediction records."""
    with open(PREDICTIONS_PATH, "r", encoding="utf-8") as f:
        raw: list[dict] = json.load(f)

    result: list[PatientPrediction] = []
    for item in raw:
        result.append(
            PatientPrediction(
                patient_id=item["patient_id"],
                risk=RiskScores(**item["risk"]),
                prediction=BinaryPredictions(**item["prediction"]),
            )
        )
    return result


@lru_cache(maxsize=1)
def _load_raw_shap() -> dict:
    with open(SHAP_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_shap_entries(raw_list: list[dict]) -> list[ShapEntry]:
    entries = []
    for item in raw_list:
        entries.append(
            ShapEntry(
                feature=item["feature"],
                shap_value=item["shap_value"],
                feature_label=_prettify_feature(item["feature"]),
            )
        )
    # Sort descending by absolute value
    entries.sort(key=lambda e: abs(e.shap_value), reverse=True)
    return entries


def load_shap_for_patient(patient_id: int) -> PatientShap:
    """Return SHAP explanations for a single patient across all 4 models."""
    raw = _load_raw_shap()
    pid = str(patient_id)

    def _get(model_key: str) -> list[ShapEntry]:
        model_data = raw.get(model_key, {})
        return _parse_shap_entries(model_data.get(pid, []))

    return PatientShap(
        patient_id=patient_id,
        cath=_get("Cath"),
        lad=_get("LAD"),
        lcx=_get("LCX"),
        rca=_get("RCA"),
    )


# ---------------------------------------------------------------------------
# Derived helpers
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_patient_summaries() -> list[PatientSummary]:
    preds = load_predictions()
    return [
        PatientSummary(
            patient_id=p.patient_id,
            cad_risk=p.risk.cad,
            cad_pred=p.prediction.cad,
            lad_risk=p.risk.lad,
            lcx_risk=p.risk.lcx,
            rca_risk=p.risk.rca,
        )
        for p in preds
    ]


@lru_cache(maxsize=1)
def load_summary_stats() -> SummaryStats:
    preds = load_predictions()
    total = len(preds)
    cad_pos = sum(p.prediction.cad for p in preds)
    lad_pos = sum(p.prediction.lad for p in preds)
    lcx_pos = sum(p.prediction.lcx for p in preds)
    rca_pos = sum(p.prediction.rca for p in preds)

    # Multi-vessel: patients with stenosis in ≥2 of LAD/LCX/RCA
    multi = sum(
        1 for p in preds
        if (p.prediction.lad + p.prediction.lcx + p.prediction.rca) >= 2
    )

    return SummaryStats(
        total_patients=total,
        cad_positive=cad_pos,
        cad_negative=total - cad_pos,
        cad_positive_pct=round(cad_pos / total * 100, 1),
        lad_positive=lad_pos,
        lcx_positive=lcx_pos,
        rca_positive=rca_pos,
        lad_positive_pct=round(lad_pos / total * 100, 1),
        lcx_positive_pct=round(lcx_pos / total * 100, 1),
        rca_positive_pct=round(rca_pos / total * 100, 1),
        avg_cad_risk=round(sum(p.risk.cad for p in preds) / total, 4),
        avg_lad_risk=round(sum(p.risk.lad for p in preds) / total, 4),
        avg_lcx_risk=round(sum(p.risk.lcx for p in preds) / total, 4),
        avg_rca_risk=round(sum(p.risk.rca for p in preds) / total, 4),
        multi_vessel=multi,
        multi_vessel_pct=round(multi / total * 100, 1),
    )
