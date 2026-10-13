"use client";

/**
 * PatientInputForm
 *
 * Multi-section form covering the clinical features used by CardioScope.
 * Calls POST /predict and returns the result through onResult.
 *
 * Fixes:
 * - Prevents NaN from being rendered in numeric input values.
 * - Handles empty numeric inputs safely.
 * - Calculates BMI only when height and weight are valid.
 * - Validates all numeric values before submitting.
 * - Prevents duplicate submissions while prediction is running.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  BBBType,
  LivePredictionResponse,
  PatientInputData,
  SexType,
  VHDType,
  YN,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Default form values ─────────────────────────────────────────────────────

const DEFAULTS: PatientInputData = {
  Age: 55,
  Weight: 75,
  Length: 170,
  Sex: "Male",
  BMI: 25.95,

  DM: 0,
  HTN: 0,
  "Current Smoker": 0,
  "EX-Smoker": 0,
  FH: 0,

  Obesity: "N",
  CRF: "N",
  CVA: "N",
  "Airway disease": "N",
  "Thyroid Disease": "N",
  CHF: "N",
  DLP: "N",

  BP: 120,
  PR: 75,
  Edema: 0,

  "Weak Peripheral Pulse": "N",
  "Lung rales": "N",
  "Systolic Murmur": "N",
  "Diastolic Murmur": "N",

  "Typical Chest Pain": 0,
  Dyspnea: "N",
  "Function Class": 0,
  Atypical: "N",
  Nonanginal: "N",
  "LowTH Ang": "N",

  "Q Wave": 0,
  "St Elevation": 0,
  "St Depression": 0,
  Tinversion: 0,
  LVH: "N",
  "Poor R Progression": "N",
  BBB: "N",

  FBS: 90,
  CR: 1.0,
  TG: 150,
  LDL: 120,
  HDL: 50,
  BUN: 14,
  ESR: 12,
  HB: 14.0,
  K: 4.2,
  Na: 140,
  WBC: 7000,
  Lymph: 35,
  Neut: 58,
  PLT: 250,

  "EF-TTE": 55,
  "Region RWMA": 0,
  VHD: "N",
};

// ─── Section component ──────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>{icon}</span>
        {title}
      </h4>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

// ─── Numeric field ──────────────────────────────────────────────────────────

interface NumericFieldProps {
  label: string;
  fieldKey: keyof PatientInputData;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (key: keyof PatientInputData, value: number) => void;
  error?: string;
}

function NumericField({
  label,
  fieldKey,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  error,
}: NumericFieldProps) {
  // Never pass NaN or Infinity to an HTML input's value.
  const safeValue = Number.isFinite(value) ? value : "";

  return (
    <div>
      <label
        htmlFor={`field-${String(fieldKey)}`}
        className="mb-1 block text-[11px] leading-tight text-slate-400"
      >
        {label}
        {unit && <span className="ml-1 text-slate-600">({unit})</span>}
      </label>

      <input
        id={`field-${String(fieldKey)}`}
        type="number"
        value={safeValue}
        min={min}
        max={max}
        step={step}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `error-${String(fieldKey)}` : undefined}
        onChange={(event) => {
          const rawValue = event.currentTarget.value;

          // An empty input is represented as NaN in state.
          // NumericField converts it to "" for display, avoiding React warnings.
          if (rawValue.trim() === "") {
            onChange(fieldKey, Number.NaN);
            return;
          }

          const parsedValue = Number(rawValue);

          onChange(
            fieldKey,
            Number.isFinite(parsedValue) ? parsedValue : Number.NaN
          );
        }}
        className={cn(
          "w-full rounded-lg border bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 transition-colors focus:outline-none focus:ring-1",
          error
            ? "border-red-500/50 focus:ring-red-500/30"
            : "border-white/10 focus:border-blue-500/40 focus:ring-blue-500/20"
        )}
      />

      {error && (
        <p
          id={`error-${String(fieldKey)}`}
          className="mt-0.5 text-[10px] text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Select field ───────────────────────────────────────────────────────────

interface SelectFieldProps<T extends string> {
  label: string;
  fieldKey: keyof PatientInputData;
  value: T;
  options: { value: T; label: string }[];
  onChange: (key: keyof PatientInputData, value: T) => void;
}

function SelectField<T extends string>({
  label,
  fieldKey,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <div>
      <label
        htmlFor={`select-${String(fieldKey)}`}
        className="mb-1 block text-[11px] text-slate-400"
      >
        {label}
      </label>

      <select
        id={`select-${String(fieldKey)}`}
        value={value}
        onChange={(event) =>
          onChange(fieldKey, event.currentTarget.value as T)
        }
        className="w-full rounded-lg border border-white/10 bg-[#0d1530] px-2.5 py-1.5 text-sm text-slate-200 transition-colors focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Binary toggle ──────────────────────────────────────────────────────────

interface BinaryToggleProps {
  label: string;
  fieldKey: keyof PatientInputData;
  value: 0 | 1;
  onChange: (key: keyof PatientInputData, value: 0 | 1) => void;
}

function BinaryToggle({
  label,
  fieldKey,
  value,
  onChange,
}: BinaryToggleProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-slate-400">
        {label}
      </label>

      <div className="flex gap-1">
        {([0, 1] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(fieldKey, option)}
            className={cn(
              "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all",
              value === option
                ? option === 1
                  ? "border-red-500/40 bg-red-500/20 text-red-400"
                  : "border-green-500/30 bg-green-500/15 text-green-400"
                : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
            )}
          >
            {option === 1 ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Yes/no toggle ──────────────────────────────────────────────────────────

interface YNToggleProps {
  label: string;
  fieldKey: keyof PatientInputData;
  value: YN;
  onChange: (key: keyof PatientInputData, value: YN) => void;
}

function YNToggle({
  label,
  fieldKey,
  value,
  onChange,
}: YNToggleProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-slate-400">
        {label}
      </label>

      <div className="flex gap-1">
        {(["N", "Y"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(fieldKey, option)}
            className={cn(
              "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all",
              value === option
                ? option === "Y"
                  ? "border-red-500/40 bg-red-500/20 text-red-400"
                  : "border-green-500/30 bg-green-500/15 text-green-400"
                : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

type Errors = Partial<Record<keyof PatientInputData, string>>;

const NUMERIC_FIELDS: (keyof PatientInputData)[] = [
  "Age",
  "Weight",
  "Length",
  "BMI",
  "BP",
  "PR",
  "Function Class",
  "FBS",
  "CR",
  "TG",
  "LDL",
  "HDL",
  "BUN",
  "ESR",
  "HB",
  "K",
  "Na",
  "WBC",
  "Lymph",
  "Neut",
  "PLT",
  "EF-TTE",
  "Region RWMA",
];

function validate(form: PatientInputData): Errors {
  const errors: Errors = {};

  // Check missing, NaN, and infinite numeric values first.
  for (const key of NUMERIC_FIELDS) {
    const value = form[key];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors[key] = "Enter a valid number";
    }
  }

  // Do not run range checks on invalid numbers.
  if (Number.isFinite(form.Age) && (form.Age < 18 || form.Age > 120)) {
    errors.Age = "18–120";
  }

  if (
    Number.isFinite(form.Weight) &&
    (form.Weight < 20 || form.Weight > 250)
  ) {
    errors.Weight = "20–250 kg";
  }

  if (
    Number.isFinite(form.Length) &&
    (form.Length < 100 || form.Length > 220)
  ) {
    errors.Length = "100–220 cm";
  }

  if (
    Number.isFinite(form.BMI) &&
    (form.BMI < 10 || form.BMI > 70)
  ) {
    errors.BMI = "10–70";
  }

  if (Number.isFinite(form.BP) && (form.BP < 50 || form.BP > 280)) {
    errors.BP = "50–280 mmHg";
  }

  if (Number.isFinite(form.PR) && (form.PR < 20 || form.PR > 250)) {
    errors.PR = "20–250 bpm";
  }

  if (Number.isFinite(form["Function Class"]) &&
      (form["Function Class"] < 0 || form["Function Class"] > 4)) {
    errors["Function Class"] = "0–4";
  }

  if (Number.isFinite(form.FBS) && (form.FBS < 50 || form.FBS > 600)) {
    errors.FBS = "50–600 mg/dL";
  }

  if (Number.isFinite(form.CR) && (form.CR < 0.1 || form.CR > 20)) {
    errors.CR = "0.1–20";
  }

  if (Number.isFinite(form.TG) && (form.TG < 20 || form.TG > 2000)) {
    errors.TG = "20–2000";
  }

  if (Number.isFinite(form.LDL) && (form.LDL < 10 || form.LDL > 400)) {
    errors.LDL = "10–400";
  }

  if (Number.isFinite(form.HDL) && (form.HDL < 5 || form.HDL > 150)) {
    errors.HDL = "5–150";
  }

  if (Number.isFinite(form.BUN) && (form.BUN < 2 || form.BUN > 200)) {
    errors.BUN = "2–200";
  }

  if (Number.isFinite(form.ESR) && (form.ESR < 0 || form.ESR > 150)) {
    errors.ESR = "0–150";
  }

  if (Number.isFinite(form.HB) && (form.HB < 3 || form.HB > 25)) {
    errors.HB = "3–25 g/dL";
  }

  if (Number.isFinite(form.K) && (form.K < 1.5 || form.K > 9)) {
    errors.K = "1.5–9.0";
  }

  if (Number.isFinite(form.Na) && (form.Na < 110 || form.Na > 170)) {
    errors.Na = "110–170";
  }

  if (Number.isFinite(form.WBC) && (form.WBC < 1000 || form.WBC > 50000)) {
    errors.WBC = "1000–50000";
  }

  if (Number.isFinite(form.Lymph) && (form.Lymph < 0 || form.Lymph > 100)) {
    errors.Lymph = "0–100%";
  }

  if (Number.isFinite(form.Neut) && (form.Neut < 0 || form.Neut > 100)) {
    errors.Neut = "0–100%";
  }

  if (Number.isFinite(form.PLT) && (form.PLT < 10 || form.PLT > 1000)) {
    errors.PLT = "10–1000";
  }

  if (
    Number.isFinite(form["EF-TTE"]) &&
    (form["EF-TTE"] < 5 || form["EF-TTE"] > 80)
  ) {
    errors["EF-TTE"] = "5–80%";
  }

  if (
    Number.isFinite(form["Region RWMA"]) &&
    (form["Region RWMA"] < 0 || form["Region RWMA"] > 5)
  ) {
    errors["Region RWMA"] = "0–5";
  }

  return errors;
}

// ─── Main form ──────────────────────────────────────────────────────────────

interface Props {
  onResult: (result: LivePredictionResponse) => void;
  onLoading: (loading: boolean) => void;
}

export default function PatientInputForm({
  onResult,
  onLoading,
}: Props) {
  const [form, setForm] = useState<PatientInputData>({ ...DEFAULTS });
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Compute BMI only when height and weight are finite and valid.
  useEffect(() => {
    const weight = form.Weight;
    const length = form.Length;

    if (
      !Number.isFinite(weight) ||
      !Number.isFinite(length) ||
      weight <= 0 ||
      length <= 0
    ) {
      return;
    }

    const heightInMeters = length / 100;
    const bmi = Number((weight / (heightInMeters * heightInMeters)).toFixed(2));

    if (!Number.isFinite(bmi)) {
      return;
    }

    setForm((current) =>
      current.BMI === bmi ? current : { ...current, BMI: bmi }
    );
  }, [form.Weight, form.Length]);

  function set<K extends keyof PatientInputData>(
    key: K,
    value: PatientInputData[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));

    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    setSubmitError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const validationErrors = validate(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    onLoading(true);
    setSubmitError(null);

    try {
      // All numeric fields have been validated before reaching the API.
      const result = await api.predict(form);
      onResult(result);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Prediction failed. Check whether the backend is running."
      );
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }

  function handleReset() {
    setForm({ ...DEFAULTS });
    setErrors({});
    setSubmitError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Demographics */}
      <Section title="Demographics" icon="👤">
        <NumericField
          label="Age"
          fieldKey="Age"
          value={form.Age}
          min={18}
          max={120}
          onChange={set}
          error={errors.Age}
        />

        <NumericField
          label="Weight"
          fieldKey="Weight"
          value={form.Weight}
          min={20}
          max={250}
          unit="kg"
          step={0.1}
          onChange={set}
          error={errors.Weight}
        />

        <NumericField
          label="Height"
          fieldKey="Length"
          value={form.Length}
          min={100}
          max={220}
          unit="cm"
          step={0.1}
          onChange={set}
          error={errors.Length}
        />

        <div>
          <label className="mb-1 block text-[11px] text-slate-400">
            BMI <span className="text-slate-600">(auto)</span>
          </label>
          <div className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-400">
            {Number.isFinite(form.BMI) ? form.BMI.toFixed(2) : "—"}
          </div>
          {errors.BMI && (
            <p className="mt-0.5 text-[10px] text-red-400">{errors.BMI}</p>
          )}
        </div>

        <SelectField<SexType>
          label="Sex"
          fieldKey="Sex"
          value={form.Sex}
          options={[
            { value: "Male", label: "Male" },
            { value: "Fmale", label: "Female" },
          ]}
          onChange={set}
        />
      </Section>

      {/* Medical History */}
      <Section title="Medical History" icon="📋">
        <BinaryToggle label="Diabetes (DM)" fieldKey="DM" value={form.DM as 0 | 1} onChange={set} />
        <BinaryToggle label="Hypertension (HTN)" fieldKey="HTN" value={form.HTN as 0 | 1} onChange={set} />
        <BinaryToggle label="Current Smoker" fieldKey="Current Smoker" value={form["Current Smoker"] as 0 | 1} onChange={set} />
        <BinaryToggle label="Ex-Smoker" fieldKey="EX-Smoker" value={form["EX-Smoker"] as 0 | 1} onChange={set} />
        <BinaryToggle label="Family History (FH)" fieldKey="FH" value={form.FH as 0 | 1} onChange={set} />

        <YNToggle label="Obesity" fieldKey="Obesity" value={form.Obesity} onChange={set} />
        <YNToggle label="Dyslipidemia (DLP)" fieldKey="DLP" value={form.DLP} onChange={set} />
        <YNToggle label="CHF" fieldKey="CHF" value={form.CHF} onChange={set} />
        <YNToggle label="CRF" fieldKey="CRF" value={form.CRF} onChange={set} />
        <YNToggle label="CVA" fieldKey="CVA" value={form.CVA} onChange={set} />
        <YNToggle label="Airway Disease" fieldKey="Airway disease" value={form["Airway disease"]} onChange={set} />
        <YNToggle label="Thyroid Disease" fieldKey="Thyroid Disease" value={form["Thyroid Disease"]} onChange={set} />
      </Section>

      {/* Vitals and Symptoms */}
      <Section title="Vitals & Symptoms" icon="🩺">
        <NumericField label="Blood Pressure" fieldKey="BP" value={form.BP} min={50} max={280} unit="mmHg" onChange={set} error={errors.BP} />
        <NumericField label="Pulse Rate" fieldKey="PR" value={form.PR} min={20} max={250} unit="bpm" onChange={set} error={errors.PR} />
        <BinaryToggle label="Edema" fieldKey="Edema" value={form.Edema as 0 | 1} onChange={set} />

        <YNToggle label="Weak Peripheral Pulse" fieldKey="Weak Peripheral Pulse" value={form["Weak Peripheral Pulse"]} onChange={set} />
        <YNToggle label="Lung Rales" fieldKey="Lung rales" value={form["Lung rales"]} onChange={set} />
        <YNToggle label="Systolic Murmur" fieldKey="Systolic Murmur" value={form["Systolic Murmur"]} onChange={set} />
        <YNToggle label="Diastolic Murmur" fieldKey="Diastolic Murmur" value={form["Diastolic Murmur"]} onChange={set} />

        <BinaryToggle label="Typical Chest Pain" fieldKey="Typical Chest Pain" value={form["Typical Chest Pain"] as 0 | 1} onChange={set} />
        <YNToggle label="Dyspnea" fieldKey="Dyspnea" value={form.Dyspnea} onChange={set} />

        <NumericField label="Function Class" fieldKey="Function Class" value={form["Function Class"]} min={0} max={4} onChange={set} error={errors["Function Class"]} />

        <YNToggle label="Atypical Chest Pain" fieldKey="Atypical" value={form.Atypical} onChange={set} />
        <YNToggle label="Non-anginal Pain" fieldKey="Nonanginal" value={form.Nonanginal} onChange={set} />
        <YNToggle label="Low-threshold Angina" fieldKey="LowTH Ang" value={form["LowTH Ang"]} onChange={set} />
      </Section>

      {/* ECG Findings */}
      <Section title="ECG Findings" icon="💓">
        <BinaryToggle label="Q Wave" fieldKey="Q Wave" value={form["Q Wave"] as 0 | 1} onChange={set} />
        <BinaryToggle label="ST Elevation" fieldKey="St Elevation" value={form["St Elevation"] as 0 | 1} onChange={set} />
        <BinaryToggle label="ST Depression" fieldKey="St Depression" value={form["St Depression"] as 0 | 1} onChange={set} />
        <BinaryToggle label="T Inversion" fieldKey="Tinversion" value={form.Tinversion as 0 | 1} onChange={set} />

        <YNToggle label="LVH" fieldKey="LVH" value={form.LVH} onChange={set} />
        <YNToggle label="Poor R Progression" fieldKey="Poor R Progression" value={form["Poor R Progression"]} onChange={set} />

        <SelectField<BBBType>
          label="Bundle Branch Block"
          fieldKey="BBB"
          value={form.BBB}
          options={[
            { value: "N", label: "None" },
            { value: "LBBB", label: "LBBB" },
            { value: "RBBB", label: "RBBB" },
          ]}
          onChange={set}
        />
      </Section>

      {/* Laboratory Values */}
      <Section title="Laboratory Values" icon="🧪">
        <NumericField label="FBS" fieldKey="FBS" value={form.FBS} min={50} max={600} unit="mg/dL" step={0.1} onChange={set} error={errors.FBS} />
        <NumericField label="Creatinine" fieldKey="CR" value={form.CR} min={0.1} max={20} unit="mg/dL" step={0.1} onChange={set} error={errors.CR} />
        <NumericField label="Triglycerides" fieldKey="TG" value={form.TG} min={20} max={2000} unit="mg/dL" onChange={set} error={errors.TG} />
        <NumericField label="LDL" fieldKey="LDL" value={form.LDL} min={10} max={400} unit="mg/dL" onChange={set} error={errors.LDL} />
        <NumericField label="HDL" fieldKey="HDL" value={form.HDL} min={5} max={150} unit="mg/dL" onChange={set} error={errors.HDL} />
        <NumericField label="BUN" fieldKey="BUN" value={form.BUN} min={2} max={200} unit="mg/dL" onChange={set} error={errors.BUN} />
        <NumericField label="ESR" fieldKey="ESR" value={form.ESR} min={0} max={150} step={0.1} onChange={set} error={errors.ESR} />
        <NumericField label="Hemoglobin" fieldKey="HB" value={form.HB} min={3} max={25} unit="g/dL" step={0.1} onChange={set} error={errors.HB} />
        <NumericField label="Potassium (K)" fieldKey="K" value={form.K} min={1.5} max={9} step={0.1} onChange={set} error={errors.K} />
        <NumericField label="Sodium (Na)" fieldKey="Na" value={form.Na} min={110} max={170} onChange={set} error={errors.Na} />
        <NumericField label="WBC" fieldKey="WBC" value={form.WBC} min={1000} max={50000} unit="/µL" step={100} onChange={set} error={errors.WBC} />
        <NumericField label="Lymphocytes" fieldKey="Lymph" value={form.Lymph} min={0} max={100} unit="%" step={0.1} onChange={set} error={errors.Lymph} />
        <NumericField label="Neutrophils" fieldKey="Neut" value={form.Neut} min={0} max={100} unit="%" step={0.1} onChange={set} error={errors.Neut} />
        <NumericField label="Platelets" fieldKey="PLT" value={form.PLT} min={10} max={1000} unit="×10³/µL" onChange={set} error={errors.PLT} />
      </Section>

      {/* Echocardiography */}
      <Section title="Echocardiography" icon="🫀">
        <NumericField label="Ejection Fraction" fieldKey="EF-TTE" value={form["EF-TTE"]} min={5} max={80} unit="%" onChange={set} error={errors["EF-TTE"]} />
        <NumericField label="Region RWMA" fieldKey="Region RWMA" value={form["Region RWMA"]} min={0} max={5} onChange={set} error={errors["Region RWMA"]} />

        <SelectField<VHDType>
          label="Valvular Heart Disease"
          fieldKey="VHD"
          value={form.VHD}
          options={[
            { value: "N", label: "None" },
            { value: "mild", label: "Mild" },
            { value: "Moderate", label: "Moderate" },
            { value: "Severe", label: "Severe" },
          ]}
          onChange={set}
        />
      </Section>

      {/* Error message */}
      {submitError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 text-sm text-red-300"
        >
          <span className="shrink-0">⚠</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Submit and Reset */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
            loading
              ? "cursor-not-allowed bg-blue-600/30 text-blue-300/60"
              : "bg-blue-600 text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500"
          )}
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Running inference…
            </>
          ) : (
            <>🔬 Predict Risk</>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Clinical disclaimer */}
      <p className="text-[10px] leading-relaxed text-slate-600">
        ⚠️ Predictions are generated by machine-learning models trained on
        patients from the Z-Alizadeh Sani dataset. For{" "}
        <strong className="text-slate-500">
          educational and decision-support purposes only
        </strong>
        . This tool is not a diagnostic device and does not replace
        evaluation by a qualified healthcare professional.
      </p>
    </form>
  );
}