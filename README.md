# CardioScope — Cardiovascular Risk Visualization & Prediction

> **Clinical Safety Disclaimer:** CardioScope is for **educational and decision-support purposes only**. Predictions are not a substitute for formal diagnostic imaging, clinical examination, or advice from a qualified medical professional. Always consult a licensed cardiologist.

---

## Overview

CardioScope is an interactive full-stack application for the Multimodal AI Hackathon 2026 (Track A). It visualises coronary artery disease (CAD) predictions and vessel-level stenosis probabilities for 303 patients from the Z-Alizadeh Sani dataset, displayed on a rotatable 3D heart model with SHAP-based clinical explanations.

### Key Features

| Feature | Detail |
|---|---|
| **Patient Browser** | Searchable, filterable list of all 303 patients with mini risk bars |
| **Risk Cards** | Arc-gauge cards for CAD / LAD / LCX / RCA with colour-coded risk levels |
| **3D Heart Viewer** | Rotatable / zoomable GLB heart with colour-tinted mesh and interactive vessel markers |
| **SHAP Analysis** | Per-patient, per-model horizontal bar charts showing feature contributions |
| **Patient Vitals** | Combined top-feature panel with vessel risk bar chart |
| **Cohort Stats** | Pie chart (CAD+/−), radar chart (avg risk per vessel), count grid |
| **Clinical Disclaimer** | Persistent banner + floating toast on every page |

---

## Project Structure

```
CardioScope/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app + routes
│   │   ├── models.py        # Pydantic response models
│   │   └── data_loader.py   # JSON loading, caching, feature prettifier
│   ├── data/
│   │   ├── cardiovascular_predictions.json   # 303 patient predictions
│   │   └── cardiovascular_shap.json          # SHAP values (Cath/LAD/LCX/RCA)
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py      # 16 pytest tests
│   ├── heart.ipynb          # Original ML notebook
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx          # Main dashboard (patient state, tabs, layout)
    │   └── globals.css
    ├── components/
    │   ├── Header.tsx
    │   ├── Disclaimer.tsx
    │   ├── PatientSelector.tsx
    │   ├── RiskCards.tsx
    │   ├── HeartViewer.tsx   # React Three Fiber + GLB + vessel markers
    │   ├── ShapPanel.tsx
    │   ├── PatientVitals.tsx
    │   └── SummaryStats.tsx
    ├── lib/
    │   ├── types.ts          # Shared TypeScript interfaces
    │   ├── api.ts            # Typed fetch wrapper
    │   └── utils.ts          # riskColor, riskLabel, lerpColor helpers
    ├── public/models/
    │   └── heart.glb         # 3D heart mesh
    ├── types/r3f.d.ts
    └── package.json
```

---

## Prerequisites

| Tool | Version tested |
|---|---|
| Python | 3.12 |
| Node.js | 20+ |
| npm | 10+ |

---

## Quick Start

### 1 — Clone / open workspace

```bash
cd CardioScope
```

### 2 — Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

### 3 — Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Dashboard is now live at **http://localhost:3000**

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/patients` | All 303 patient summaries |
| `GET` | `/patients?cad_only=true` | CAD-positive patients only |
| `GET` | `/patients/{id}` | Full prediction for patient 1–303 |
| `GET` | `/shap/{id}` | SHAP explanations (all 4 models) for patient |
| `GET` | `/summary` | Cohort aggregate statistics (CAD/vessel counts, percentages, multi-vessel disease) |

### Example responses

**`GET /patients/1`**
```json
{
  "patient_id": 1,
  "risk": { "cad": 0.9281, "lad": 0.9307, "lcx": 0.1068, "rca": 0.4389 },
  "prediction": { "cad": 1, "lad": 1, "lcx": 0, "rca": 0 }
}
```

**`GET /shap/1`** — returns top-10 SHAP features per model (Cath, LAD, LCX, RCA), sorted by absolute value, with human-readable `feature_label`.

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

All 19 tests pass in ~1.2 s.

```
tests/test_api.py::test_health PASSED
tests/test_api.py::test_get_all_patients_count PASSED
tests/test_api.py::test_patient_summary_fields PASSED
tests/test_api.py::test_patient_risk_range PASSED
tests/test_api.py::test_cad_only_filter PASSED
tests/test_api.py::test_get_patient_1 PASSED
tests/test_api.py::test_get_patient_303 PASSED
tests/test_api.py::test_get_patient_invalid_0 PASSED
tests/test_api.py::test_get_patient_invalid_304 PASSED
tests/test_api.py::test_patient_prediction_binary PASSED
tests/test_api.py::test_shap_patient_1 PASSED
tests/test_api.py::test_shap_entry_fields PASSED
tests/test_api.py::test_shap_sorted_by_abs PASSED
tests/test_api.py::test_shap_invalid_patient PASSED
tests/test_api.py::test_summary PASSED
tests/test_api.py::test_summary_vessel_counts PASSED
tests/test_api.py::test_summary_new_fields PASSED
tests/test_api.py::test_shap_feature_label_not_empty PASSED
tests/test_api.py::test_all_shap_models_have_data PASSED
19 passed in 1.16s
```

---

## Dataset

**Z-Alizadeh Sani Dataset** — 303 patient records with:
- Demographics, vital signs, lab values, ECG measurements, echocardiographic findings
- Ground-truth labels: `Cath` (overall CAD), `LAD`, `LCX`, `RCA` stenosis status

Available on [UCI ML Repository](https://archive.ics.uci.edu/dataset/412/z+alizadeh+sani) and [Kaggle](https://www.kaggle.com/).

**Target leakage prevention:** LAD, LCX, RCA, and Cath columns are excluded from model input features as required by the hackathon spec.

---

## Technology Stack

### Backend
- **FastAPI** — async REST API
- **Pydantic v2** — request/response validation
- **Uvicorn** — ASGI server
- **pytest** — test suite

### Frontend
- **Next.js 15** (App Router) — React framework
- **TypeScript** — full type safety
- **Tailwind CSS** — utility-first styling
- **React Three Fiber + Drei** — 3D heart rendering
- **Three.js** — WebGL engine
- **Recharts** — SHAP bar charts, radar, pie charts
- **Framer Motion** — UI transitions
- **Anime.js** — animation utilities

---

## Risk Level Thresholds

| Probability | Label | Colour |
|---|---|---|
| 0–34% | LOW | 🟢 Green |
| 35–64% | MODERATE | 🟡 Amber |
| 65–100% | HIGH | 🔴 Red |

---

## 3D Model Notes

The `heart.glb` file contains a single heart mesh. Because separate coronary artery meshes are not available in this asset:

- The **mesh colour is tinted** from green → amber → red based on overall CAD risk probability
- **Interactive HTML markers** are overlaid at anatomically approximate positions for LAD, LCX, and RCA
- Markers **pulse** (animated ring) for vessels with positive stenosis predictions
- Hovering a marker shows the vessel name, risk %, and prediction status
- The 3D viewer supports **drag-to-rotate**, **scroll-to-zoom**, and **OrbitControls** damping

---

## Evaluation Alignment

| Criterion | Implementation |
|---|---|
| **Predictive Performance (30%)** | Pre-computed ML predictions from XGBoost/LR pipeline; risk probabilities and binary predictions for all 4 targets |
| **3D Visualization (25%)** | Interactive GLB heart with risk-tinted mesh, vessel marker overlay, rotate/zoom |
| **Clinical Interpretability (20%)** | Per-patient SHAP bar charts for all 4 models; feature labels mapped to clinical names |
| **System Integration (15%)** | FastAPI backend → typed fetch → React state; all panels update on patient change |
| **Technical Implementation (10%)** | TypeScript + Pydantic validation, 16 tests, clean architecture, this README |
