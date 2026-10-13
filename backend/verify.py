"""Final live end-to-end verification for CardioScope."""
import sys
import requests

BASE = "http://localhost:8000"
results = []


def chk(label: str, ok: bool):
    results.append((label, ok))
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")


# ── Health ────────────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/health")
chk("GET /health → 200", r.status_code == 200)
chk("GET /health version=2.0.0", r.json().get("version") == "2.0.0")

# ── /patients ─────────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/patients")
chk("GET /patients → 303 records", len(r.json()) == 303)

# ── /patients/1 ───────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/patients/1")
p1 = r.json()
chk("GET /patients/1 → 200", r.status_code == 200)
chk("GET /patients/1 cad_risk in [0,1]", 0 <= p1["risk"]["cad"] <= 1)

# ── /shap/1 ───────────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/shap/1")
s = r.json()
chk("GET /shap/1 → 4 models × 10 entries", all(len(s[m]) == 10 for m in ["cath","lad","lcx","rca"]))
chk("GET /shap/1 feature_label populated", s["cath"][0]["feature_label"] != "")

# ── /summary ──────────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/summary")
d = r.json()
chk("GET /summary total_patients=303", d["total_patients"] == 303)
chk("GET /summary cad_positive_pct=72.3", d["cad_positive_pct"] == 72.3)
chk("GET /summary multi_vessel exists", "multi_vessel" in d)
chk("GET /summary multi_vessel_pct in [0,100]", 0 <= d["multi_vessel_pct"] <= 100)

# ── /model/evaluation ─────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/model/evaluation")
ev = r.json()
chk("GET /model/evaluation → 4 rows", len(ev) == 4)
targets_in_ev = {row["Target"] for row in ev}
chk("GET /model/evaluation targets={Cath,LAD,LCX,RCA}", targets_in_ev == {"Cath","LAD","LCX","RCA"})
cath_auc = next(x for x in ev if x["Target"] == "Cath")["ROC-AUC"]
lad_auc  = next(x for x in ev if x["Target"] == "LAD")["ROC-AUC"]
chk(f"Cath ROC-AUC={cath_auc:.4f} > 0.85", cath_auc > 0.85)
chk(f"LAD  ROC-AUC={lad_auc:.4f} > 0.80", lad_auc  > 0.80)

# ── POST /predict — high-risk patient (dataset row 1) ─────────────────────────
high_risk = {
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
r = requests.post(f"{BASE}/predict", json=high_risk)
chk("POST /predict → 200", r.status_code == 200)
ph = r.json()
chk("POST /predict source=live_inference", ph["source"] == "live_inference")
chk("POST /predict all 4 vessel keys in risk", all(k in ph["risk"] for k in ["cad","lad","lcx","rca"]))
chk("POST /predict all 4 predictions binary", all(ph["prediction"][k] in [0,1] for k in ["cad","lad","lcx","rca"]))
chk(f"POST /predict CAD pred=1 (high-risk patient)", ph["prediction"]["cad"] == 1)
chk(f"POST /predict CAD risk={ph['risk']['cad']:.4f} in [0,1]", 0 <= ph["risk"]["cad"] <= 1)
chk(f"POST /predict LAD risk={ph['risk']['lad']:.4f} > 0.8", ph["risk"]["lad"] > 0.8)

# ── POST /predict — low-risk patient ─────────────────────────────────────────
low_risk = {
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
r = requests.post(f"{BASE}/predict", json=low_risk)
pl = r.json()
chk(f"POST /predict low-risk CAD={pl['risk']['cad']:.4f} < high-risk {ph['risk']['cad']:.4f}",
    pl["risk"]["cad"] < ph["risk"]["cad"])

# ── Validation errors ─────────────────────────────────────────────────────────
bad = dict(high_risk); bad["Age"] = 5
r = requests.post(f"{BASE}/predict", json=bad)
chk("POST /predict Age=5 → 422", r.status_code == 422)

bad2 = dict(high_risk); bad2["Sex"] = "Robot"
r = requests.post(f"{BASE}/predict", json=bad2)
chk("POST /predict Sex=Robot → 422", r.status_code == 422)

bad3 = dict(high_risk); del bad3["FBS"]
r = requests.post(f"{BASE}/predict", json=bad3)
chk("POST /predict missing FBS → 422", r.status_code == 422)

# ── Determinism ───────────────────────────────────────────────────────────────
r1 = requests.post(f"{BASE}/predict", json=high_risk).json()
r2 = requests.post(f"{BASE}/predict", json=high_risk).json()
chk("POST /predict is deterministic", r1["risk"] == r2["risk"])

# ── Frontend ──────────────────────────────────────────────────────────────────
try:
    r = requests.get("http://localhost:3000/", timeout=5)
    chk("Frontend HTTP 200", r.status_code == 200)
    chk("Frontend contains 'CardioScope'", "CardioScope" in r.text)
except Exception as e:
    chk(f"Frontend reachable ({e})", False)

# ── Final ─────────────────────────────────────────────────────────────────────
print()
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
print(f"{'='*50}")
print(f"  {passed} passed   {failed} failed")
print(f"{'='*50}")
if failed:
    sys.exit(1)
