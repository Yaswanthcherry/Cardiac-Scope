"use client";

import { PatientPrediction, PatientShap } from "@/lib/types";
import { riskToHex } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  prediction: PatientPrediction;
  shap: PatientShap;
}

// Clinical units for well-known features
const FEATURE_UNITS: Record<string, string> = {
  Age: "yrs",
  BMI: "kg/m²",
  "Blood Pressure": "mmHg",
  "Pulse Rate": "bpm",
  "Fasting Blood Sugar": "mg/dL",
  Triglycerides: "mg/dL",
  "LDL Cholesterol": "mg/dL",
  "HDL Cholesterol": "mg/dL",
  "Ejection Fraction (Echo)": "%",
  Creatinine: "mg/dL",
  "Blood Urea Nitrogen": "mg/dL",
  Hemoglobin: "g/dL",
  Platelets: "×10³/µL",
  ESR: "mm/hr",
};

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function PatientVitals({ prediction, shap }: Props) {
  // Combine all 4 models, deduplicate by feature_label, sort by |shap_value|
  const seen = new Set<string>();
  const topFeatures = [
    ...shap.cath,
    ...shap.lad,
    ...shap.lcx,
    ...shap.rca,
  ]
    .filter((e) => {
      if (!e.feature_label || seen.has(e.feature_label)) return false;
      seen.add(e.feature_label);
      return true;
    })
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, 8);

  // Vessel risk bar chart data
  const vesselData = [
    { name: "CAD", risk: +(prediction.risk.cad * 100).toFixed(1), pred: prediction.prediction.cad },
    { name: "LAD", risk: +(prediction.risk.lad * 100).toFixed(1), pred: prediction.prediction.lad },
    { name: "LCX", risk: +(prediction.risk.lcx * 100).toFixed(1), pred: prediction.prediction.lcx },
    { name: "RCA", risk: +(prediction.risk.rca * 100).toFixed(1), pred: prediction.prediction.rca },
  ];

  const cadColor = riskToHex(prediction.risk.cad);
  const maxAbsShap = topFeatures.length > 0 ? Math.abs(topFeatures[0].shap_value) : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Patient badge + vessel chart ── */}
      <div className="bg-[#0d1530] rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Patient</p>
            <p className="text-2xl font-bold text-white leading-none mt-0.5">
              #{prediction.patient_id}
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{
              backgroundColor: cadColor + "18",
              color: cadColor,
              border: `1px solid ${cadColor}35`,
            }}
          >
            CAD {prediction.prediction.cad === 1 ? "Positive" : "Negative"}
          </div>
        </div>

        {/* Vessel risk bar chart */}
        <div style={{ height: 112 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={vesselData}
              margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: number) => [`${val}%`, "Risk Score"]}
                contentStyle={{
                  background: "#0d1530",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
                {vesselData.map((entry, i) => (
                  <Cell key={i} fill={riskToHex(entry.risk / 100)} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top SHAP features panel ── */}
      <div className="bg-[#0d1530] rounded-xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
          Top Clinical Features
        </p>
        <p className="text-[10px] text-slate-600 mb-3">
          Ranked by SHAP importance across all 4 models
        </p>

        {topFeatures.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-4">No feature data available.</p>
        ) : (
          <div className="space-y-3">
            {topFeatures.map((f, i) => {
              const absVal = Math.abs(f.shap_value);
              const pct = (absVal / maxAbsShap) * 100;
              const barColor = f.shap_value >= 0 ? "#ef4444" : "#22c55e";
              const unit = FEATURE_UNITS[f.feature_label] ?? "";
              const direction = f.shap_value >= 0 ? "↑ risk" : "↓ risk";

              return (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] text-slate-600 font-mono w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-300 truncate">
                        {f.feature_label}
                        {unit && (
                          <span className="text-slate-600 ml-1 text-[9px]">{unit}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: barColor }}
                      >
                        {direction}
                      </span>
                      <span
                        className="text-xs font-mono font-bold tabular-nums"
                        style={{ color: barColor }}
                      >
                        {f.shap_value >= 0 ? "+" : ""}
                        {f.shap_value.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <MiniBar pct={pct} color={barColor} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
