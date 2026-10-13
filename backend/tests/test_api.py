"""Tests for the CardioScope FastAPI backend."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# /patients
# ---------------------------------------------------------------------------


def test_get_all_patients_count():
    r = client.get("/patients")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 303


def test_patient_summary_fields():
    r = client.get("/patients")
    item = r.json()[0]
    required = {"patient_id", "cad_risk", "cad_pred", "lad_risk", "lcx_risk", "rca_risk"}
    assert required.issubset(item.keys())


def test_patient_risk_range():
    r = client.get("/patients")
    for item in r.json():
        assert 0.0 <= item["cad_risk"] <= 1.0
        assert 0.0 <= item["lad_risk"] <= 1.0
        assert 0.0 <= item["lcx_risk"] <= 1.0
        assert 0.0 <= item["rca_risk"] <= 1.0


def test_cad_only_filter():
    r = client.get("/patients?cad_only=true")
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(p["cad_pred"] == 1 for p in data)


# ---------------------------------------------------------------------------
# /patients/{id}
# ---------------------------------------------------------------------------


def test_get_patient_1():
    r = client.get("/patients/1")
    assert r.status_code == 200
    data = r.json()
    assert data["patient_id"] == 1
    assert "risk" in data
    assert "prediction" in data


def test_get_patient_303():
    r = client.get("/patients/303")
    assert r.status_code == 200
    assert r.json()["patient_id"] == 303


def test_get_patient_invalid_0():
    r = client.get("/patients/0")
    assert r.status_code == 404


def test_get_patient_invalid_304():
    r = client.get("/patients/304")
    assert r.status_code == 404


def test_patient_prediction_binary():
    r = client.get("/patients/1")
    pred = r.json()["prediction"]
    for key in ["cad", "lad", "lcx", "rca"]:
        assert pred[key] in [0, 1]


# ---------------------------------------------------------------------------
# /shap/{id}
# ---------------------------------------------------------------------------


def test_shap_patient_1():
    r = client.get("/shap/1")
    assert r.status_code == 200
    data = r.json()
    assert data["patient_id"] == 1
    for key in ["cath", "lad", "lcx", "rca"]:
        assert key in data
        assert isinstance(data[key], list)
        assert len(data[key]) > 0


def test_shap_entry_fields():
    r = client.get("/shap/1")
    entry = r.json()["cath"][0]
    assert "feature" in entry
    assert "shap_value" in entry
    assert "feature_label" in entry


def test_shap_sorted_by_abs():
    r = client.get("/shap/1")
    values = [abs(e["shap_value"]) for e in r.json()["cath"]]
    assert values == sorted(values, reverse=True)


def test_shap_invalid_patient():
    r = client.get("/shap/999")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /summary
# ---------------------------------------------------------------------------


def test_summary():
    r = client.get("/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["total_patients"] == 303
    assert data["cad_positive"] + data["cad_negative"] == 303
    assert 0 <= data["cad_positive_pct"] <= 100
    assert 0.0 <= data["avg_cad_risk"] <= 1.0


def test_summary_vessel_counts():
    r = client.get("/summary")
    data = r.json()
    for key in ["lad_positive", "lcx_positive", "rca_positive"]:
        assert 0 <= data[key] <= 303


def test_summary_new_fields():
    r = client.get("/summary")
    data = r.json()
    # Percentage fields
    for key in ["lad_positive_pct", "lcx_positive_pct", "rca_positive_pct"]:
        assert 0 <= data[key] <= 100
    # Multi-vessel
    assert 0 <= data["multi_vessel"] <= 303
    assert 0 <= data["multi_vessel_pct"] <= 100


def test_shap_feature_label_not_empty():
    r = client.get("/shap/1")
    for model_key in ["cath", "lad", "lcx", "rca"]:
        for entry in r.json()[model_key]:
            assert entry["feature_label"] != "", f"Empty feature_label in {model_key}"


def test_all_shap_models_have_data():
    """Spot-check 5 patients to confirm all 4 models have entries."""
    for pid in [1, 50, 100, 200, 303]:
        r = client.get(f"/shap/{pid}")
        assert r.status_code == 200
        data = r.json()
        for model_key in ["cath", "lad", "lcx", "rca"]:
            assert len(data[model_key]) == 10, \
                f"Patient {pid} model {model_key} has {len(data[model_key])} entries, expected 10"


# ---------------------------------------------------------------------------
# /predict  (live inference)
# ---------------------------------------------------------------------------

# Minimal valid patient payload — values from dataset row 1
VALID_PATIENT = {
    "Age": 53, "Weight": 90, "Length": 175, "Sex": "Male", "BMI": 29.39,
    "DM": 0, "HTN": 1, "Current Smoker": 1, "EX-Smoker": 0, "FH": 0,
    "Obesity": "Y", "CRF": "N", "CVA": "N", "Airway disease": "N",
    "Thyroid Disease": "N", "CHF": "N", "DLP": "Y",
    "BP": 110, "PR": 80, "Edema": 0,
    "Weak Peripheral Pulse": "N", "Lung rales": "N",
    "Systolic Murmur": "N", "Diastolic Murmur": "N",
    "Typical Chest Pain": 0, "Dyspnea": "N", "Function Class": 0,
    "Atypical": "N", "Nonanginal": "N", "LowTH Ang": "N",
    "Q Wave": 0, "St Elevation": 0, "St Depression": 1, "Tinversion": 1,
    "LVH": "N", "Poor R Progression": "N", "BBB": "N",
    "FBS": 90, "CR": 0.7, "TG": 250, "LDL": 155, "HDL": 30,
    "BUN": 8, "ESR": 7, "HB": 15.6, "K": 4.7, "Na": 141,
    "WBC": 5700, "Lymph": 39, "Neut": 52, "PLT": 261,
    "EF-TTE": 50, "Region RWMA": 0, "VHD": "N",
}

LOW_RISK_PATIENT = {
    "Age": 35, "Weight": 65, "Length": 170, "Sex": "Male", "BMI": 22.5,
    "DM": 0, "HTN": 0, "Current Smoker": 0, "EX-Smoker": 0, "FH": 0,
    "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N",
    "Thyroid Disease": "N", "CHF": "N", "DLP": "N",
    "BP": 120, "PR": 70, "Edema": 0,
    "Weak Peripheral Pulse": "N", "Lung rales": "N",
    "Systolic Murmur": "N", "Diastolic Murmur": "N",
    "Typical Chest Pain": 0, "Dyspnea": "N", "Function Class": 0,
    "Atypical": "N", "Nonanginal": "N", "LowTH Ang": "N",
    "Q Wave": 0, "St Elevation": 0, "St Depression": 0, "Tinversion": 0,
    "LVH": "N", "Poor R Progression": "N", "BBB": "N",
    "FBS": 85, "CR": 1.0, "TG": 120, "LDL": 100, "HDL": 55,
    "BUN": 14, "ESR": 10, "HB": 15.0, "K": 4.2, "Na": 140,
    "WBC": 6000, "Lymph": 35, "Neut": 58, "PLT": 250,
    "EF-TTE": 65, "Region RWMA": 0, "VHD": "N",
}


def test_predict_returns_200():
    r = client.post("/predict", json=VALID_PATIENT)
    assert r.status_code == 200


def test_predict_response_structure():
    r = client.post("/predict", json=VALID_PATIENT)
    data = r.json()
    assert "risk" in data
    assert "prediction" in data
    assert "source" in data
    assert data["source"] == "live_inference"
    for key in ["cad", "lad", "lcx", "rca"]:
        assert key in data["risk"]
        assert key in data["prediction"]


def test_predict_risk_range():
    r = client.post("/predict", json=VALID_PATIENT)
    risk = r.json()["risk"]
    for key in ["cad", "lad", "lcx", "rca"]:
        assert 0.0 <= risk[key] <= 1.0, f"{key} risk out of range: {risk[key]}"


def test_predict_binary_predictions():
    r = client.post("/predict", json=VALID_PATIENT)
    pred = r.json()["prediction"]
    for key in ["cad", "lad", "lcx", "rca"]:
        assert pred[key] in [0, 1], f"{key} prediction not binary: {pred[key]}"


def test_predict_high_risk_patient():
    """Row-1 patient should be CAD-positive."""
    r = client.post("/predict", json=VALID_PATIENT)
    assert r.json()["prediction"]["cad"] == 1


def test_predict_low_risk_patient_cad_probability():
    """Low-risk profile should yield lower CAD probability."""
    r_high = client.post("/predict", json=VALID_PATIENT)
    r_low = client.post("/predict", json=LOW_RISK_PATIENT)
    assert r_low.json()["risk"]["cad"] < r_high.json()["risk"]["cad"]


def test_predict_missing_required_field():
    """Omitting a required field must return 422."""
    bad = dict(VALID_PATIENT)
    del bad["Age"]
    r = client.post("/predict", json=bad)
    assert r.status_code == 422


def test_predict_invalid_sex_value():
    bad = {**VALID_PATIENT, "Sex": "Unknown"}
    r = client.post("/predict", json=bad)
    assert r.status_code == 422


def test_predict_invalid_bbb_value():
    bad = {**VALID_PATIENT, "BBB": "RBBB_bad"}
    r = client.post("/predict", json=bad)
    assert r.status_code == 422


def test_predict_age_out_of_range():
    bad = {**VALID_PATIENT, "Age": 5}
    r = client.post("/predict", json=bad)
    assert r.status_code == 422


def test_predict_deterministic():
    """Same input must return same output on repeated calls."""
    r1 = client.post("/predict", json=VALID_PATIENT)
    r2 = client.post("/predict", json=VALID_PATIENT)
    assert r1.json()["risk"] == r2.json()["risk"]
    assert r1.json()["prediction"] == r2.json()["prediction"]


def test_model_evaluation_endpoint():
    r = client.get("/model/evaluation")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 4
    targets = {row["Target"] for row in data}
    assert targets == {"Cath", "LAD", "LCX", "RCA"}
    for row in data:
        assert 0.0 <= row["ROC-AUC"] <= 1.0
