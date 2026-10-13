"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PatientShap, PatientPrediction, SHAP_MODELS, ShapModelKey, ShapEntry } from "@/lib/types";
import { riskLabel, riskBgClass } from "@/lib/utils";

interface Props {
  shap: PatientShap;
  prediction: PatientPrediction;
}

const MODEL_COLORS: Record<ShapModelKey, string> = {
  cath: "#8b5cf6",
  lad: "#ef4444",
  lcx: "#f59e0b",
  rca: "#3b82f6",
};

// Plain-language interpretation of a SHAP value magnitude
function shapMagnitudeLabel(absVal: number): string {
  if (absVal >= 0.8) return "Strong";
  if (absVal >= 0.4) return "Moderate";
  if (absVal >= 0.1) return "Mild";
  return "Slight";
}

// Custom tooltip showing feature name, SHAP value, and plain-language explanation
function ShapTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ShapEntry & { shortLabel: string };
  const val = d.shap_value;
  const absVal = Math.abs(val);
  const direction = val >= 0 ? "increases" : "decreases";
  const magnitude = shapMagnitudeLabel(absVal);

  return (
    <div className="bg-[#0d1530] border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl text-xs max-w-[220px]">
      <p className="text-slate-200 font-semibold mb-1 leading-tight">{d.feature_label}</p>
      <p className={val >= 0 ? "text-red-400 font-mono" : "text-green-400 font-mono"}>
        SHAP: {val > 0 ? "+" : ""}{val.toFixed(4)}
      </p>
      <p className="text-slate-400 text-[10px] mt-1 leading-snug">
        {magnitude}ly {direction} predicted risk for this patient.
      </p>
    </div>
  );
}

// Summary sentence at the top of the panel
function ShapSummary({
  entries,
  modelLabel,
  riskPct,
  pred,
}: {
  entries: ShapEntry[];
  modelLabel: string;
  riskPct: string;
  pred: number;
}) {
  if (entries.length === 0) return null;

  const top = entries[0];
  const topDir = top.shap_value >= 0 ? "elevated" : "reduced";
  const positiveCount = entries.filter((e) => e.shap_value > 0).length;
  const negativeCount = entries.length - positiveCount;

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2.5 mb-4 text-xs leading-relaxed text-slate-300">
      <span className="text-slate-400">For this patient, </span>
      <strong className="text-white">{top.feature_label}</strong>
      <span className="text-slate-400"> is the strongest factor {topDir} {modelLabel} risk. </span>
      <span className="text-red-400">{positiveCount} feature{positiveCount !== 1 ? "s" : ""} push risk up</span>
      <span className="text-slate-500"> and </span>
      <span className="text-green-400">{negativeCount} push{negativeCount === 1 ? "es" : ""} it down</span>
      <span className="text-slate-400"> among the top 10 contributors.</span>
    </div>
  );
}

export default function ShapPanel({ shap, prediction }: Props) {
  const [activeModel, setActiveModel] = useState<ShapModelKey>("cath");

  // Use patient_id as key so the chart re-mounts when patient changes (task 3)
  const panelKey = `${shap.patient_id}-${activeModel}`;

  const entries = shap[activeModel];          // always 10 items from API
  const topEntries = entries.slice(0, 10);
  const color = MODEL_COLORS[activeModel];

  const riskKey = activeModel === "cath" ? "cad" : activeModel;
  const riskVal = prediction.risk[riskKey as keyof typeof prediction.risk];
  const riskPct = (riskVal * 100).toFixed(1) + "%";
  const pred = prediction.prediction[riskKey as keyof typeof prediction.prediction];

  const modelLabel =
    activeModel === "cath"
      ? "overall CAD"
      : activeModel.toUpperCase();

  // Chart data: truncate labels, keep full data for tooltip
  const chartData = topEntries.map((e) => ({
    ...e,
    shortLabel:
      e.feature_label.length > 24
        ? e.feature_label.slice(0, 22) + "…"
        : e.feature_label,
  }));

  return (
    <div className="flex flex-col" style={{ minHeight: 520 }}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            SHAP Feature Explanations
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Why did the model predict this risk score? Top 10 contributing features.
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500 shrink-0 ml-3">
          <div>Patient #{shap.patient_id}</div>
          <div className="mt-0.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                pred === 1
                  ? "bg-red-500/15 border border-red-500/30 text-red-400"
                  : "bg-green-500/15 border border-green-500/30 text-green-400"
              }`}
            >
              {modelLabel.toUpperCase()} {pred === 1 ? "POSITIVE" : "NEGATIVE"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Model Tabs ── */}
      <div className="flex gap-1 mb-4">
        {SHAP_MODELS.map((m) => {
          const mRiskKey = m.key === "cath" ? "cad" : m.key;
          const mRisk = prediction.risk[mRiskKey as keyof typeof prediction.risk];
          const mPred = prediction.prediction[mRiskKey as keyof typeof prediction.prediction];
          return (
            <button
              key={m.key}
              onClick={() => setActiveModel(m.key)}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all flex flex-col items-center gap-0.5 border ${
                activeModel === m.key ? "border-opacity-50" : "border-transparent hover:border-white/10"
              }`}
              style={
                activeModel === m.key
                  ? {
                      backgroundColor: MODEL_COLORS[m.key] + "18",
                      borderColor: MODEL_COLORS[m.key] + "50",
                      color: MODEL_COLORS[m.key],
                    }
                  : { color: "#64748b" }
              }
            >
              <span>{m.label}</span>
              <span
                className="text-[9px] font-mono"
                style={{ color: activeModel === m.key ? MODEL_COLORS[m.key] : "#475569" }}
              >
                {(mRisk * 100).toFixed(0)}%
                {mPred === 1 ? " +" : " −"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Risk context banner ── */}
      <div
        className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between"
        style={{ backgroundColor: color + "10", border: `1px solid ${color}25` }}
      >
        <div className="text-xs text-slate-400">
          Predicted{" "}
          <span className="font-semibold text-slate-200">{modelLabel}</span>{" "}
          risk probability
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono" style={{ color }}>
            {riskPct}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskBgClass(riskVal)}`}
          >
            {riskLabel(riskVal)}
          </span>
        </div>
      </div>

      {/* ── Plain-language summary sentence ── */}
      <ShapSummary
        entries={topEntries}
        modelLabel={modelLabel}
        riskPct={riskPct}
        pred={pred}
      />

      {/* ── Chart ── */}
      {chartData.length > 0 ? (
        <div key={panelKey} style={{ flex: 1, minHeight: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v) => v.toFixed(2)}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                width={148}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ShapTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <ReferenceLine
                x={0}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <Bar dataKey="shap_value" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.shap_value >= 0 ? "#ef4444" : "#22c55e"}
                    fillOpacity={Math.min(0.6 + Math.abs(entry.shap_value) * 0.4, 0.95)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
          <span className="text-3xl opacity-30">📊</span>
          <p className="text-sm">No SHAP data available for this patient / model.</p>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500/70 shrink-0" />
          <span className="text-[10px] text-slate-400">Increases predicted risk</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500/70 shrink-0" />
          <span className="text-[10px] text-slate-400">Decreases predicted risk</span>
        </div>
        <div className="ml-auto text-[9px] text-slate-600 italic text-right leading-tight">
          SHAP values from pre-trained ML models.<br />Not a diagnostic tool.
        </div>
      </div>
    </div>
  );
}
