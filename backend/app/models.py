"""Pydantic models for CardioScope API."""

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field


# ─── Existing prediction / SHAP models (unchanged) ───────────────────────────


class RiskScores(BaseModel):
    cad: float = Field(..., ge=0.0, le=1.0)
    lad: float = Field(..., ge=0.0, le=1.0)
    lcx: float = Field(..., ge=0.0, le=1.0)
    rca: float = Field(..., ge=0.0, le=1.0)


class BinaryPredictions(BaseModel):
    cad: int = Field(..., ge=0, le=1)
    lad: int = Field(..., ge=0, le=1)
    lcx: int = Field(..., ge=0, le=1)
    rca: int = Field(..., ge=0, le=1)


class PatientPrediction(BaseModel):
    patient_id: int = Field(..., ge=1, le=303)
    risk: RiskScores
    prediction: BinaryPredictions


class ShapEntry(BaseModel):
    feature: str
    shap_value: float
    feature_label: str = ""


class PatientShap(BaseModel):
    patient_id: int
    cath: list[ShapEntry]
    lad: list[ShapEntry]
    lcx: list[ShapEntry]
    rca: list[ShapEntry]


class PatientSummary(BaseModel):
    patient_id: int
    cad_risk: float
    cad_pred: int
    lad_risk: float
    lcx_risk: float
    rca_risk: float


class SummaryStats(BaseModel):
    total_patients: int
    cad_positive: int
    cad_negative: int
    cad_positive_pct: float
    lad_positive: int
    lcx_positive: int
    rca_positive: int
    lad_positive_pct: float
    lcx_positive_pct: float
    rca_positive_pct: float
    avg_cad_risk: float
    avg_lad_risk: float
    avg_lcx_risk: float
    avg_rca_risk: float
    multi_vessel: int
    multi_vessel_pct: float


# ─── Real-time prediction input ───────────────────────────────────────────────
# Use Annotated[type, Field(alias=...)] everywhere an alias contains spaces or
# special characters so Pydantic v2 registers them correctly.

YN = Literal["Y", "N"]
SexType = Literal["Male", "Fmale"]
BBBType = Literal["N", "LBBB", "RBBB"]
VHDType = Literal["N", "mild", "Moderate", "Severe"]


class PatientInput(BaseModel):
    """
    Manual patient data for real-time ML inference.

    54 features matching the training dataset (Exertional CP excluded —
    it was a constant column and is dropped at training time).
    Send field names exactly as the dataset column names.
    """

    # ── Demographics ──────────────────────────────────────────────────────────
    Age: float = Field(..., ge=18, le=120, description="Age in years")
    Weight: float = Field(..., ge=20, le=250, description="Weight (kg)")
    Length: float = Field(..., ge=100, le=220, description="Height (cm)")
    Sex: SexType
    BMI: float = Field(..., ge=10.0, le=70.0)

    # ── Medical history (numeric 0/1) ─────────────────────────────────────────
    DM: int = Field(..., ge=0, le=1, description="Diabetes Mellitus")
    HTN: int = Field(..., ge=0, le=1, description="Hypertension")

    # Aliases: field name in Python uses underscore; JSON key uses dataset name
    Current_Smoker: Annotated[int, Field(ge=0, le=1, alias="Current Smoker")] = 0
    EX_Smoker: Annotated[int, Field(ge=0, le=1, alias="EX-Smoker")] = 0
    FH: int = Field(..., ge=0, le=1, description="Family history of CAD")

    # ── Comorbidities (Y/N) ───────────────────────────────────────────────────
    Obesity: YN
    CRF: YN
    CVA: YN
    Airway_disease: Annotated[YN, Field(alias="Airway disease")] = "N"
    Thyroid_Disease: Annotated[YN, Field(alias="Thyroid Disease")] = "N"
    CHF: YN
    DLP: YN

    # ── Vitals ────────────────────────────────────────────────────────────────
    BP: float = Field(..., ge=50, le=280, description="Systolic BP (mmHg)")
    PR: float = Field(..., ge=20, le=250, description="Pulse rate (bpm)")

    # ── Symptoms ─────────────────────────────────────────────────────────────
    Edema: int = Field(..., ge=0, le=1)
    Weak_Peripheral_Pulse: Annotated[YN, Field(alias="Weak Peripheral Pulse")] = "N"
    Lung_rales: Annotated[YN, Field(alias="Lung rales")] = "N"
    Systolic_Murmur: Annotated[YN, Field(alias="Systolic Murmur")] = "N"
    Diastolic_Murmur: Annotated[YN, Field(alias="Diastolic Murmur")] = "N"
    Typical_Chest_Pain: Annotated[int, Field(ge=0, le=1, alias="Typical Chest Pain")] = 0
    Dyspnea: YN
    Function_Class: Annotated[int, Field(ge=0, le=4, alias="Function Class")] = 0
    Atypical: YN
    Nonanginal: YN
    LowTH_Ang: Annotated[YN, Field(alias="LowTH Ang")] = "N"

    # ── ECG ───────────────────────────────────────────────────────────────────
    Q_Wave: Annotated[int, Field(ge=0, le=1, alias="Q Wave")] = 0
    St_Elevation: Annotated[int, Field(ge=0, le=1, alias="St Elevation")] = 0
    St_Depression: Annotated[int, Field(ge=0, le=1, alias="St Depression")] = 0
    Tinversion: int = Field(..., ge=0, le=1, description="T-wave inversion")
    LVH: YN
    Poor_R_Progression: Annotated[YN, Field(alias="Poor R Progression")] = "N"
    BBB: BBBType

    # ── Labs ─────────────────────────────────────────────────────────────────
    FBS: float = Field(..., ge=50, le=600, description="Fasting blood sugar (mg/dL)")
    CR: float = Field(..., ge=0.1, le=20.0, description="Creatinine (mg/dL)")
    TG: float = Field(..., ge=20, le=2000, description="Triglycerides (mg/dL)")
    LDL: float = Field(..., ge=10, le=400, description="LDL (mg/dL)")
    HDL: float = Field(..., ge=5, le=150, description="HDL (mg/dL)")
    BUN: float = Field(..., ge=2, le=200, description="BUN (mg/dL)")
    ESR: float = Field(..., ge=0, le=150)
    HB: float = Field(..., ge=3, le=25, description="Hemoglobin (g/dL)")
    K: float = Field(..., ge=1.5, le=9.0, description="Potassium (mEq/L)")
    Na: float = Field(..., ge=110, le=170, description="Sodium (mEq/L)")
    WBC: float = Field(..., ge=1000, le=50000, description="WBC (/µL)")
    Lymph: float = Field(..., ge=0, le=100, description="Lymphocytes (%)")
    Neut: float = Field(..., ge=0, le=100, description="Neutrophils (%)")
    PLT: float = Field(..., ge=10, le=1000, description="Platelets (×10³/µL)")

    # ── Echo ──────────────────────────────────────────────────────────────────
    EF_TTE: Annotated[float, Field(ge=5, le=80, alias="EF-TTE")] = 55.0
    Region_RWMA: Annotated[int, Field(ge=0, le=5, alias="Region RWMA")] = 0
    VHD: VHDType

    model_config = {"populate_by_name": True}


# ─── Prediction response ──────────────────────────────────────────────────────


class LivePredictionResponse(BaseModel):
    risk: RiskScores
    prediction: BinaryPredictions
    source: str = "live_inference"
