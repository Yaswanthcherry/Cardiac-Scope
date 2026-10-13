"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { SummaryStats as Stats } from "@/lib/types";
import { riskToHex } from "@/lib/utils";

interface Props {
  stats: Stats;
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-3 border flex items-start gap-3"
      style={{ backgroundColor: color + "0e", borderColor: color + "25" }}
    >
      <span className="text-xl leading-none mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">
          {label}
        </p>
        <p className="text-base font-bold leading-none" style={{ color }}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-slate-500 mt-1 leading-tight">{sub}</p>
        )}
      </div>
    </div>
  );
}

export default function SummaryStatsPanel({ stats }: Props) {
  // Pie: CAD+ vs CAD−
  const pieData = [
    { name: "CAD Positive", value: stats.cad_positive, color: "#ef4444" },
    { name: "CAD Negative", value: stats.cad_negative, color: "#22c55e" },
  ];

  // Radar: avg risk per vessel (0–100 scale)
  const radarData = [
    { subject: "CAD", risk: Math.round(stats.avg_cad_risk * 100) },
    { subject: "LAD", risk: Math.round(stats.avg_lad_risk * 100) },
    { subject: "LCX", risk: Math.round(stats.avg_lcx_risk * 100) },
    { subject: "RCA", risk: Math.round(stats.avg_rca_risk * 100) },
  ];

  // Bar: stenosis positive counts per vessel
  const vesselBarData = [
    {
      vessel: "LAD",
      positive: stats.lad_positive,
      pct: stats.lad_positive_pct,
      color: "#ef4444",
    },
    {
      vessel: "LCX",
      positive: stats.lcx_positive,
      pct: stats.lcx_positive_pct,
      color: "#f59e0b",
    },
    {
      vessel: "RCA",
      positive: stats.rca_positive,
      pct: stats.rca_positive_pct,
      color: "#3b82f6",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Insight Cards Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InsightCard
          icon="🫀"
          label="CAD Prevalence"
          value={`${stats.cad_positive_pct}%`}
          sub={`${stats.cad_positive} of ${stats.total_patients} patients`}
          color="#ef4444"
        />
        <InsightCard
          icon="🩸"
          label="Most Affected Vessel"
          value={`LAD`}
          sub={`${stats.lad_positive_pct}% stenosis positive (${stats.lad_positive} pts)`}
          color="#ef4444"
        />
        <InsightCard
          icon="🔀"
          label="Multi-Vessel Disease"
          value={`${stats.multi_vessel_pct}%`}
          sub={`${stats.multi_vessel} patients with ≥2 vessel stenoses`}
          color="#8b5cf6"
        />
        <InsightCard
          icon="📉"
          label="Avg. CAD Risk Score"
          value={`${(stats.avg_cad_risk * 100).toFixed(1)}%`}
          sub={`Cohort mean across all 303 patients`}
          color={riskToHex(stats.avg_cad_risk)}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Pie: CAD Distribution */}
        <div className="bg-[#0d1530] rounded-xl p-4 border border-white/5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            CAD Distribution
          </p>
          <div className="flex-1" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="35%"
                  outerRadius="65%"
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `${val} patients (${((val / stats.total_patients) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    background: "#0d1530",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-[10px] text-slate-400">
                  {d.name.replace("CAD ", "")}:{" "}
                  <span className="font-semibold" style={{ color: d.color }}>
                    {d.value}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar: Vessel Stenosis Counts */}
        <div className="bg-[#0d1530] rounded-xl p-4 border border-white/5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Stenosis Positive (by Vessel)
          </p>
          <div className="flex-1" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={vesselBarData}
                margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
                barCategoryGap="30%"
              >
                <XAxis
                  dataKey="vessel"
                  tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, stats.total_patients]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: number, _name: string, props: any) => [
                    `${val} patients (${props.payload.pct}%)`,
                    "Stenosis+",
                  ]}
                  contentStyle={{
                    background: "#0d1530",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="positive" radius={[4, 4, 0, 0]}>
                  {vesselBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 justify-center mt-2">
            {vesselBarData.map((d) => (
              <div key={d.vessel} className="text-center">
                <p className="text-[10px] font-semibold" style={{ color: d.color }}>
                  {d.vessel}
                </p>
                <p className="text-[10px] text-slate-500">{d.pct}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Radar: Avg Risk */}
        <div className="bg-[#0d1530] rounded-xl p-4 border border-white/5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Average Risk Score (%)
          </p>
          <div className="flex-1" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="65%">
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  axisLine={false}
                />
                <Radar
                  dataKey="risk"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
                <Tooltip
                  formatter={(val: number) => [`${val}%`, "Avg Risk"]}
                  contentStyle={{
                    background: "#0d1530",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 text-center leading-tight">
            Mean predicted risk probability across all {stats.total_patients} patients
          </div>
        </div>
      </div>

      {/* ── Data footnote ── */}
      <p className="text-[10px] text-slate-600 leading-relaxed px-1">
        Data source: Z-Alizadeh Sani dataset (303 patients). Predictions generated by
        pre-trained XGBoost / Logistic Regression classifiers. LAD = Left Anterior
        Descending; LCX = Left Circumflex; RCA = Right Coronary Artery. Multi-vessel
        disease = stenosis in ≥2 of the three target vessels.
      </p>
    </div>
  );
}
